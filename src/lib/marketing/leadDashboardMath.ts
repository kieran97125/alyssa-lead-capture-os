import {
  leadGroupBookDate,
  leadGroupCurrentBookedRow,
  leadGroupNoShowDate,
  leadGroupShowDate,
  type LeadSheetLeadGroup,
  type LeadSheetGroupRow,
  type SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";
import {
  annotationMatchesTreatment,
  type OperationalAnnotation,
} from "@/lib/marketing/operationalAnnotations";
import {
  attachDailySpendToPerformanceTrendSeries,
  calculatePerformanceTrendPoint,
  emptyPerformanceTrendBase,
  type PerformanceTrendSeries,
  type PerformanceTrendSpendFact,
} from "@/lib/marketing/performanceTrend";
import {
  brandIdsForScope,
  brandsForScope,
} from "@/lib/marketing/brandScope";
import {
  LEAD_ACCOUNTS,
  accountsForAllowedBrands,
  brandIdsForLeadAccount,
  leadAccountById,
  leadAccountColor,
} from "@/lib/marketing/leadAccountScope";

export type LeadDashboardFilters = {
  startDate: string;
  endDate: string;
  accountId?: string;
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
  accountId: string;
  accountLabel: string;
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
  accountId: string;
  accountLabel: string;
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
  accountRows: LeadDashboardDimensionRow[];
  brandRows: LeadDashboardDimensionRow[];
  treatmentRows: LeadDashboardDimensionRow[];
  campaignRows: LeadDashboardDimensionRow[];
  outstandingRows: LeadDashboardOutstandingRow[];
  accountOptions: Array<{ value: string; label: string }>;
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
  spendFacts?: PerformanceTrendSpendFact[];
  costAttributable?: boolean;
}): PerformanceTrendSeries[] {
  const selectedBrandIds = new Set(
    brandIdsForScope(input.brands, input.filters.brandId)
  );
  const groups = input.groups.filter((group) => {
    if (!selectedBrandIds.has(group.brandId)) {
      return false;
    }
    if (input.filters.accountId && group.accountId !== input.filters.accountId) {
      return false;
    }
    if (
      input.filters.treatment &&
      group.treatmentLabel !== input.filters.treatment
    ) {
      return false;
    }
    return true;
  });
  const availableAccountIds = new Set(groups.map((group) => group.accountId));
  const knownSeriesAccounts = LEAD_ACCOUNTS.filter(
    (account) =>
      availableAccountIds.has(account.id) &&
      (!input.filters.accountId || account.id === input.filters.accountId)
  );
  const knownIds = new Set(knownSeriesAccounts.map((account) => account.id));
  const legacySeriesAccounts = groups
    .filter(
      (group, index, all) =>
        Boolean(group.accountId) &&
        !knownIds.has(group.accountId) &&
        (!input.filters.accountId || group.accountId === input.filters.accountId) &&
        all.findIndex((item) => item.accountId === group.accountId) === index
    )
    .map((group) => ({
      id: group.accountId,
      label: group.accountLabel,
      color: input.brandColors[group.brandId] || "#5a2348",
    }));
  const seriesAccounts = [...knownSeriesAccounts, ...legacySeriesAccounts];
  const dates = dashboardDates(input.filters.startDate, input.filters.endDate);

  const series = seriesAccounts.map((account) => {
    const accountGroups = groups.filter((group) => group.accountId === account.id);
    const annotationBrandIds = new Set(
      brandIdsForLeadAccount(input.brands, account.id, "permission")
    );
    return {
      key: account.id,
      label: account.label,
      color: input.brandColors[account.id] || leadAccountColor(account.id),
      brandId: account.id,
      treatmentLabel: input.filters.treatment || undefined,
      points: dates.map((date, index) => {
        const base = emptyPerformanceTrendBase();
        accountGroups.forEach((group) => {
          if (group.firstTouchDate === date) base.leads += 1;
          if (leadGroupBookDate(group) === date) base.bookings += 1;
          if (leadGroupShowDate(group) === date) base.shows += 1;
          if (leadGroupNoShowDate(group) === date) base.noShows += 1;
          const pendingRow = leadGroupCurrentBookedRow(group);
          if (pendingRow?.appointmentDate === date) base.pendingShows += 1;
        });
        return calculatePerformanceTrendPoint(base, {
          day: index + 1,
          date,
          annotations: input.annotations.filter(
            (annotation) =>
              annotation.date === date &&
              annotationBrandIds.has(annotation.brandId) &&
              (!input.filters.brandId ||
                selectedBrandIds.has(annotation.brandId)) &&
              (!input.filters.treatment ||
                annotationMatchesTreatment(
                  annotation,
                  annotation.brandId,
                  input.filters.treatment
                ))
          ),
        });
      }),
    };
  });

  return attachDailySpendToPerformanceTrendSeries({
    series,
    spendFacts: input.spendFacts ?? [],
    attributable: input.costAttributable !== false,
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
  const row = leadGroupCurrentBookedRow(group);
  return row && inRange(row.appointmentDate, startDate, endDate) ? row : null;
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
    if (leadInRange) leads += 1;
    if (
      inRange(
        leadGroupBookDate(group),
        filters.startDate,
        filters.endDate
      )
    ) {
      bookings += 1;
    }
    if (
      inRange(
        leadGroupShowDate(group),
        filters.startDate,
        filters.endDate
      )
    ) {
      shows += 1;
    }
    if (
      inRange(
        leadGroupNoShowDate(group),
        filters.startDate,
        filters.endDate
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
  accountId?: string;
  accountLabel?: string;
  brandId?: string;
  brandLabel?: string;
  treatmentLabel?: string;
  sourceLabel?: string;
  campaignLabel?: string;
}): LeadDashboardDimensionRow {
  const first = input.groups[0];
  return {
    key: input.key,
    accountId: input.accountId ?? first?.accountId ?? "",
    accountLabel: input.accountLabel ?? first?.accountLabel ?? "全部 Account",
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
  const visibleAccounts = accountsForAllowedBrands(
    input.brands,
    input.allowedBrandIds
  );
  const accountScopedGroups = allowedGroups.filter(
    (group) =>
      !input.filters.accountId || group.accountId === input.filters.accountId
  );

  const accountBrandIds = input.filters.accountId
    ? new Set(
        brandIdsForLeadAccount(
          visibleBrands,
          input.filters.accountId,
          "permission"
        )
      )
    : null;
  const accountBrands = accountBrandIds
    ? visibleBrands.filter((brand) => accountBrandIds.has(brand.id))
    : visibleBrands;
  const scopedBrands = input.filters.accountId
    ? brandsForScope(accountBrands, input.filters.brandId)
    : accountBrands;
  const scopedBrandIds = new Set(scopedBrands.map((brand) => brand.id));
  const brandScopedGroups = accountScopedGroups.filter(
    (group) => !input.filters.brandId || scopedBrandIds.has(group.brandId)
  );
  const visibleGroups = brandScopedGroups.filter((group) => {
    if (
      input.filters.treatment &&
      group.treatmentLabel !== input.filters.treatment
    ) {
      return false;
    }
    return true;
  });

  const outstandingMonth = monthRange(input.filters.startDate);
  const accountRows = visibleAccounts
    .filter(
      (account) =>
        !input.filters.accountId || account.id === input.filters.accountId
    )
    .map((account) =>
      dimensionRow({
        key: account.id,
        groups: visibleGroups.filter((group) => group.accountId === account.id),
        filters: input.filters,
        outstandingStart: outstandingMonth.start,
        outstandingEnd: outstandingMonth.end,
        accountId: account.id,
        accountLabel: account.label,
        brandId: account.id,
        brandLabel: account.label,
      })
    );

  const brandBuckets = new Map<
    string,
    { accountId: string; accountLabel: string; brandId: string; brandLabel: string; groups: LeadSheetLeadGroup[] }
  >();
  visibleGroups.forEach((group) => {
    const key = JSON.stringify([group.accountId, group.brandLabel]);
    const current = brandBuckets.get(key) ?? {
      accountId: group.accountId,
      accountLabel: group.accountLabel,
      brandId: group.brandId,
      brandLabel: group.brandLabel,
      groups: [],
    };
    current.groups.push(group);
    brandBuckets.set(key, current);
  });
  const brandRows = Array.from(brandBuckets.entries())
    .map(([key, bucket]) =>
      dimensionRow({
        key,
        groups: bucket.groups,
        filters: input.filters,
        outstandingStart: outstandingMonth.start,
        outstandingEnd: outstandingMonth.end,
        accountId: bucket.accountId,
        accountLabel: bucket.accountLabel,
        brandId: bucket.brandId,
        brandLabel: bucket.brandLabel,
      })
    )
    .sort(
      (left, right) =>
        right.leads - left.leads ||
        left.accountLabel.localeCompare(right.accountLabel, "zh-HK") ||
        left.brandLabel.localeCompare(right.brandLabel, "zh-HK")
    );

  const treatmentLabels = Array.from(
    new Set([
      ...(input.treatmentLabels ?? []),
      ...brandScopedGroups.map((group) => group.treatmentLabel),
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
      group.accountId,
      group.brandLabel,
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
        left.accountLabel.localeCompare(right.accountLabel, "zh-HK") ||
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
        accountId: group.accountId,
        accountLabel: group.accountLabel,
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

  const accountOptions = visibleAccounts.map((account) => ({
    value: account.id,
    label: account.label,
  }));
  const brandOptions = input.filters.accountId
    ? Array.from(
        new Map(
          accountScopedGroups.map((group) => [
            group.brandId,
            { value: group.brandId, label: group.brandLabel },
          ])
        ).values()
      ).sort((left, right) => left.label.localeCompare(right.label, "zh-HK"))
    : [];

  return {
    totals: statsForGroups(
      visibleGroups,
      input.filters,
      outstandingMonth.start,
      outstandingMonth.end
    ),
    accountRows,
    brandRows,
    treatmentRows,
    campaignRows,
    outstandingRows,
    accountOptions,
    brandOptions,
    treatmentOptions: treatmentLabels.map((label) => ({
      value: label,
      label,
    })),
    outstandingMonthStart: outstandingMonth.start,
    outstandingMonthEnd: outstandingMonth.end,
  };
}

