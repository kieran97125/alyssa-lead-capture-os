export type OperationalAnnotation = {
  id: string;
  date: string;
  title: string;
  itemType: string;
  channel: string | null;
  status: string;
  brandId: string;
  brandName: string;
  brandColor: string;
  treatmentId: string | null;
  treatmentLabel: string | null;
  notes: string | null;
};

export const operationalItemTypeLabels: Record<string, string> = {
  post: "Post",
  ad: "廣告",
  landing_page: "Landing Page",
  email: "Email",
  meeting: "會議",
  task: "任務",
};

export const operationalStatusLabels: Record<string, string> = {
  idea: "Idea",
  planned: "Planned",
  in_progress: "進行中",
  review: "審批中",
  scheduled: "已排期",
  published: "已上線",
  blocked: "受阻",
  cancelled: "已取消",
};

export function normalizeOperationalTreatment(value: string | null | undefined) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-HK")
    .replace(/\$[\d,.]+/g, "")
    .replace(/combo|treatment|療程|管理|護理|術/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function annotationMatchesTreatment(
  annotation: OperationalAnnotation,
  brandId: string,
  treatmentLabel: string
) {
  if (annotation.brandId !== brandId) return false;
  if (!annotation.treatmentLabel) return true;
  const annotationKey = normalizeOperationalTreatment(annotation.treatmentLabel);
  const treatmentKey = normalizeOperationalTreatment(treatmentLabel);
  if (!annotationKey || !treatmentKey) return false;
  return (
    annotationKey === treatmentKey ||
    annotationKey.includes(treatmentKey) ||
    treatmentKey.includes(annotationKey)
  );
}
