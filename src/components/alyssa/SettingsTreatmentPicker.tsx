"use client";

import { useRouter } from "next/navigation";

type TreatmentOption = {
  id: string;
  name: string;
  slug: string;
};

export function SettingsTreatmentPicker({
  treatments,
  selectedTreatmentId,
  brandSlug,
  basePath,
}: {
  treatments: TreatmentOption[];
  selectedTreatmentId?: string | null;
  brandSlug: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <label className="block w-full min-w-0 sm:w-auto sm:min-w-64">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        篩選療程
      </span>
      <select
        aria-label="篩選療程"
        value={selectedTreatmentId || ""}
        onChange={(event) => {
          const treatment = treatments.find(
            (item) => item.id === event.target.value
          );
          const query = new URLSearchParams();
          if (brandSlug) query.set("brand", brandSlug);
          if (treatment) query.set("treatment", treatment.slug);
          router.push(`${basePath}?${query.toString()}`);
        }}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-bold text-[#5a2348] outline-none transition focus:border-[#e46f64]"
      >
        <option value="">全部療程</option>
        {treatments.map((treatment) => (
          <option key={treatment.id} value={treatment.id}>
            {treatment.name}
          </option>
        ))}
      </select>
    </label>
  );
}
