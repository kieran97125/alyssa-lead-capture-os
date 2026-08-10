import type {
  LeadSheetLeadGroup,
  LeadSheetGroupRow,
  SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";
import {
  annotationMatchesTreatment,
  type OperationalAnnotation,
} from "@/lib/marketing/operationalAnnotations";
import {
  calculatePerformanceTrendPoint,
  emptyPerformanceTrendBase,
  type PerformanceTrendSeries,
} from "@/lib/marketing/performanceTrend";
import {
  brandIdsForScope,
  brandScopeOptions,
  brandsForScope,
} from "@/lib/marketing/brandScope";

export type LeadDashboardFilters = {
  startDate: string;
  endDate: string;
  brandId: string;
  treatment: string;
};

export type LeadDashboardStats = {
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  outstanding: number;
  bookRate: number | null;
  showRate: number | null;
  showUpRate: number | null;
  noShowRate: number | null;
};

export type LeadDashboardDimensionRow = LeadDashboardStats & {
  key: string;
  brandId: string;
  brandLabel: string;
  treatmentLabel: string;
  sourceLabel: string;
  campaignLabel: string;
};

export type LeadDashboardOutstandingRow = {
  key: string;
  appointmentDate: string;
  appointmentTime: string;
  brandId: string;
  brandLabel: string;
  branchLabel: string;
  treatmentLabel: string;
  statusLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  createdAt: string;
  csRemark: string;
};

export type LeadDashboardModel = {
  totals: LeadDashboardStats;
  brandRows: LeadDashboardDimensionRow[];
  treatmentRows: LeadDashboardDimensionRow[];
  campaignRows: LeadDashboardDimensionRow[];
  outstandingRows: LeadDashboardOutstandingRow[];
  brandOptions: Array<{ value: string; label: string }>;
  treatmentOptions: Array<{ value: string; label: string }>;
  outstandingMonthStart: string;
  outstandingMonthEnd: string;
};

function dashboardDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end && dates.length <= 366) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function buildLeadDashboardTrend(input: {
  groups: LeadSheetLeadGroup[];
  filters: LeadDashboardFilters;
  brands: SheetBrandReference[];
  brandColors: Record<string, string>;
  annotations: OperationalAnnotation[];
}): PerformanceTrendSeries[] {
  const selectedBrandIds = new Set(
    brandIdsForScope(input.brands, input.filters.brandId)
  );
  const groups = input.groups.filter((group) => {
    if (!selectedBrandIds.has(group.brandId)) return false;
    if (input.filters.treatment && group.treatmentLabel !== input.filters.treatment) return false;
    return true;
  });
  const seriesBrands = brandsForScope(input.brands, input.filters.brandId);
  const dates = dashboardDates(input.filters.startDate, input.filters.endDate);

  return seriesBrands.map((brand) => {
    const brandGroups = groups.filter((group) => group.brandId === brand.id);
    return {
      key: brand.id,
      label: brand.name,
      color: input.brandColors[brand.id] || "#5a2348",
      brandId: brand.id,
      treatmentLabel: input.filters.treatment || undefined,
      points: dates.map((date, index) => {
        const base = emptyPerformanceTrendBase();
        brandGroups.forEach((group) => {
          if (group.firstTouchDate === date) {
            base.leads += 1;
            if (group.rows.some((row) => row.status !== "lead")) base.bookings += 1;
          }
          if (
            group.rows.some(
              (row) => row.status === "show" && row.confirmationDate === date
            )
          ) base.shows += 1;
          if (
            group.rows.some(
              (row) => row.status === "no_show" && row.appointmentDate === date
            )
          ) base.noShows += 1;
          if (
            group.rows.some(
              (row) => row.status === "booked" && row.appointmentDate === date
            )
          ) base.pendingShows += 1;
        });
        return calculatePerformanceTrendPoint(base, {
          day: index + 1,
          date,
          annotations: input.annotations.filter(
            (annotation) =>
              annotation.date === date &&
              annotation.brandId === brand.id &&
              (!input.filters.treatment ||
                annotationMatchesTreatment(
                  annotation,
                  brand.id,
                  input.filters.treatment
                ))
          ),
        });
      }),
    };
  });
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function monthRange(value: string) {
  const start = `${value.slice(0, 7)}-01`;
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return { start, end: date.toISOString().slice(0, 10) };
}

function inRange(value: string | null, start: string, end: string) {
  return Boolean(value && value >= start && value <= end);
}

function firstOutstandingRow(
  group: LeadSheetLeadGroup,
  startDate: string,
  endDate: string
) {
  return (
    group.rows
      .filter(
        (row) =>
          row.status === "booked" &&
          inRange(row.appointmentDate, startDate, endDate)
      )
      .sort(
        (left, right) =>
          String(left.appointmentDate).localeCompare(
            String(right.appointmentDate)
          ) || left.rowNumber - right.rowNumber
      )[0] ?? null
  );
}

function statsForGroups(
  groups: LeadSheetLeadGroup[],
  filters: LeadDashboardFilters,
  outstandingStart: string,
  outstandingEnd: string
): LeadDashboardStats {
  let leads = 0;
  let bookings = 0;
  let shows = 0;
  let noShows = 0;
  let outstanding = 0;

  groups.forEach((group) => {
    const leadInRange = inRange(
      group.firstTouchDate,
      filters.startDate,
      filters.endDate
    );
    if (leadInRange) {
      leads += 1;
      if (group.rows.some((row) => row.status !== "lead")) bookings += 1;
    }
    if (
      group.rows.some(
        (row) =>
          row.status === "show" &&
          inRange(row.confirmationDate, filters.startDate, filters.endDate)
      )
    ) {
      shows += 1;
    }
    if (
      group.rows.some(
        (row) =>
          row.status === "no_show" &&
          inRange(row.appointmentDate, filters.startDate, filters.endDate)
      )
    ) {
      noShows += 1;
    }
    if (firstOutstandingRow(group, outstandingStart, outstandingEnd)) {
      outstanding += 1;
    }
  });

  return {
    leads,
    bookings,
    shows,
    noShows,
    outstanding,
    bookRate: ratio(bookings, leads),
    showRate: ratio(shows, leads),
    showUpRate: ratio(shows, bookings),
    noShowRate: ratio(noShows, bookings),
  };
}

function formatSheetTime(value: string) {
  const numeric = Number(value);
  if (value && Number.isFinite(numeric) && numeric >= 0 && numeric < 1) {
    const totalMinutes = Math.round(numeric * 24 * 60);
    return `${String(Math.floor(totalMinutes / 60) % 24).padStart(
      2,
      "0"
    )}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  const match = value.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value || "—";
}

function formatCreatedAt(row: LeadSheetGroupRow) {
  if (typeof row.createdAt === "number" && Number.isFinite(row.createdAt)) {
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + row.createdAt * 86_400_000);
    if (!Number.isNaN(date.getTime())) {
      return `${date.toISOString().slice(0, 10)} ${date
        .toISOString()
        .slice(11, 16)}`;
    }
  }
  return String(row.createdAt || row.createdDate || "—");
}

function dimensionRow(input: {
  key: string;
  groups: LeadSheetLeadGroup[];
  filters: LeadDashboardFilters;
  outstandingStart: string;
  outstandingEnd: string;
  brandId?: string;
  brandLabel?: string;
  treatmentLabel?: string;
  sourceLabel?: string;
  campaignLabel?: string;
}): LeadDashboardDimensionRow {
  const first = input.groups[0];
  return {
    key: input.key,
    brandId: input.brandId ?? first?.brandId ?? "",
    brandLabel: input.brandLabel ?? first?.brandLabel ?? "全部品牌",
    treatmentLabel:
      input.treatmentLabel ?? first?.treatmentLabel ?? "全部療程",
    sourceLabel: input.sourceLabel ?? first?.sourceLabel ?? "全部來源",
    campaignLabel:
      input.campaignLabel ?? first?.campaignLabel ?? "全部 Campaign",
    ...statsForGroups(
      input.groups,
      input.filters,
      input.outstandingStart,
      input.outstandingEnd
    ),
  };
}

export function buildLeadDashboardModel(input: {
  groups: LeadSheetLeadGroup[];
  brands: SheetBrandReference[];
  treatmentLabels?: string[];
  filters: LeadDashboardFilters;
  allowedBrandIds?: string[] | null;
}): LeadDashboardModel {
  const allowedBrandIds =
    input.allowedBrandIds === null || input.allowedBrandIds === undefined
      ? null
      : new Set(input.allowedBrandIds);
  const allowedGroups = input.groups.filter(
    (group) => !allowedBrandIds || allowedBrandIds.has(group.brandId)
  );
  const visibleBrands = input.brands.filter(
    (brand) => !allowedBrandIds || allowedBrandIds.has(brand.id)
  );
  const scopedBrands = brandsForScope(visibleBrands, input.filters.brandId);
  const scopedBrandIds = new Set(scopedBrands.map((brand) => brand.id));
  const scopedGroups = allowedGroups.filter((group) =>
    scopedBrandIds.has(group.brandId)
  );
  const visibleGroups = scopedGroups.filter((group) => {
    if (
      input.filters.treatment &&
      group.treatmentLabel !== input.filters.treatment
    ) {
      return false;
    }
    return true;
  });
  const outstandingMonth = monthRange(input.filters.startDate);
  const brandRows = scopedBrands.map((brand) =>
    dimensionRow({
      key: brand.id,
      groups: visibleGroups.filter((group) => group.brandId === brand.id),
      filters: input.filters,
      outstandingStart: outstandingMonth.start,
      outstandingEnd: outstandingMonth.end,
      brandId: brand.id,
      brandLabel: brand.name,
    })
  );
  const treatmentLabels = Array.from(
    new Set([
      ...(input.treatmentLabels ?? []),
      ...scopedGroups.map((group) => group.treatmentLabel),
    ])
  ).filter(Boolean);
  const treatmentRows = [
    dimensionRow({
      key: "all-treatment",
      groups: visibleGroups,
      filters: input.filters,
      outstandingStart: outstandingMonth.start,
      outstandingEnd: outstandingMonth.end,
      treatmentLabel: "全部療程",
    }),
    ...treatmentLabels.map((treatment) =>
      dimensionRow({
        key: treatment,
        groups: visibleGroups.filter(
          (group) => group.treatmentLabel === treatment
        ),
        filters: input.filters,
        outstandingStart: outstandingMonth.start,
        outstandingEnd: outstandingMonth.end,
        treatmentLabel: treatment,
      })
    ),
  ];
  const campaignBuckets = new Map<string, LeadSheetLeadGroup[]>();
  visibleGroups.forEach((group) => {
    const key = JSON.stringify([
      group.brandId,
      group.treatmentLabel,
      group.sourceLabel,
      group.campaignLabel,
    ]);
    const existing = campaignBuckets.get(key);
    if (existing) existing.push(group);
    else campaignBuckets.set(key, [group]);
  });
  const campaignRows = Array.from(campaignBuckets.entries())
    .map(([key, groups]) =>
      dimensionRow({
        key,
        groups,
        filters: input.filters,
        outstandingStart: outstandingMonth.start,
        outstandingEnd: outstandingMonth.end,
      })
    )
    .sort(
      (left, right) =>
        right.leads - left.leads ||
        right.bookings - left.bookings ||
        right.shows - left.shows ||
        left.brandLabel.localeCompare(right.brandLabel, "zh-HK")
    );
  const outstandingRows = visibleGroups
    .map((group) => {
      const row = firstOutstandingRow(
        group,
        outstandingMonth.start,
        outstandingMonth.end
      );
      if (!row || !row.appointmentDate) return null;
      return {
        key: `${group.key}:${row.rowNumber}`,
        appointmentDate: row.appointmentDate,
        appointmentTime: formatSheetTime(row.appointmentTime),
        brandId: group.brandId,
        brandLabel: group.brandLabel,
        branchLabel: row.branchLabel,
        treatmentLabel: group.treatmentLabel,
        statusLabel: "已預約",
        sourceLabel: group.sourceLabel,
        campaignLabel: group.campaignLabel,
        createdAt: formatCreatedAt(group.rows[0]),
        csRemark: row.csRemark,
      } satisfies LeadDashboardOutstandingRow;
    })
    .filter((row): row is LeadDashboardOutstandingRow => row !== null)
    .sort(
      (left, right) =>
        left.appointmentDate.localeCompare(right.appointmentDate) ||
        left.appointmentTime.localeCompare(right.appointmentTime)
    );

  return {
    totals: statsForGroups(
      visibleGroups,
      input.filters,
      outstandingMonth.start,
      outstandingMonth.end
    ),
    brandRows,
    treatmentRows,
    campaignRows,
    outstandingRows,
    brandOptions: brandScopeOptions(visibleBrands),
    treatmentOptions: treatmentLabels.map((label) => ({
      value: label,
      label,
    })),
    outstandingMonthStart: outstandingMonth.start,
    outstandingMonthEnd: outstandingMonth.end,
  };
}
