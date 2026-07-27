"use client";

import { useRouter } from "next/navigation";

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

export function SettingsBrandPicker({
  brands,
  selectedBrandId,
  basePath,
  label = "管理品牌",
}: {
  brands: BrandOption[];
  selectedBrandId?: string | null;
  basePath: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <label className="block w-full min-w-0 sm:w-auto sm:min-w-64">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <select
        aria-label={label}
        value={selectedBrandId || ""}
        onChange={(event) => {
          const brand = brands.find((item) => item.id === event.target.value);
          const query = brand ? `?brand=${encodeURIComponent(brand.slug)}` : "";
          router.push(`${basePath}${query}`);
        }}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-bold text-[#5a2348] outline-none transition focus:border-[#e46f64]"
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </label>
  );
}
