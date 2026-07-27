import {
  packagePriceLabel,
  type PackageSetting,
} from "@/lib/data/configuration";

type FormPackageSelectionProps = {
  packages: PackageSetting[];
  defaultPackageId?: string | null;
  selectedPackageIds?: string[];
  selectionMode?: "fixed" | "customer_choice";
  treatmentNames?: Record<string, string>;
};

export function FormPackageSelection({
  packages,
  defaultPackageId,
  selectedPackageIds = [],
  selectionMode = "fixed",
  treatmentNames = {},
}: FormPackageSelectionProps) {
  const activePackages = packages.filter((item) => item.status === "active");
  const selectedIds = new Set(
    selectedPackageIds.length > 0
      ? selectedPackageIds
      : defaultPackageId
        ? [defaultPackageId]
        : []
  );
  const groups = Array.from(
    activePackages.reduce((map, item) => {
      const treatmentName = treatmentNames[item.treatmentId];
      const group = [treatmentName, item.groupName || "其他項目"]
        .filter(Boolean)
        .join(" · ");
      const items = map.get(group) ?? [];
      items.push(item);
      map.set(group, items);
      return map;
    }, new Map<string, PackageSetting[]>())
  );

  if (activePackages.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 md:col-span-2">
        呢個療程未有啟用中嘅項目價錢。請先到「項目及價錢」新增。
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:col-span-2">
      <fieldset className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] p-4">
        <legend className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          客人點樣選項目
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-[#5a2348]">
            <input
              type="radio"
              name="packageSelectionMode"
              value="fixed"
              defaultChecked={selectionMode !== "customer_choice"}
              className="mt-1"
            />
            <span>
              固定一個項目
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                表格只顯示後台指定嘅項目及價錢。
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-[#5a2348]">
            <input
              type="radio"
              name="packageSelectionMode"
              value="customer_choice"
              defaultChecked={selectionMode === "customer_choice"}
              className="mt-1"
            />
            <span>
              客人可以選
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                表格顯示你下面勾選嘅多個項目。
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <label className="block min-w-0">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          預設項目 / 價錢
        </span>
        <select
          name="defaultPackageId"
          required
          defaultValue={defaultPackageId || activePackages[0]?.id}
          className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
        >
          {activePackages.map((item) => (
            <option key={item.id} value={item.id}>
              {treatmentNames[item.treatmentId]
                ? `${treatmentNames[item.treatmentId]} · `
                : ""}
              {item.groupName ? `${item.groupName} · ` : ""}
              {packagePriceLabel(item)}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs font-semibold leading-5 text-[#7b5a6a]">
          固定模式會直接使用呢個項目；客人自選模式會預先選中呢個項目。
        </span>
      </label>

      <fieldset className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
        <legend className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          呢張表格可選嘅項目
        </legend>
        <div className="mt-1 grid gap-4">
          {groups.map(([groupName, items]) => (
            <section key={groupName}>
              <p className="text-sm font-bold text-[#321428]">{groupName}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 text-sm font-bold text-[#5a2348]"
                  >
                    <input
                      type="checkbox"
                      name="packageIds"
                      value={item.id}
                      defaultChecked={selectedIds.has(item.id)}
                      className="mt-1"
                    />
                    <span>
                      {item.name}
                      <span className="mt-0.5 block text-xs font-semibold text-[#9a5d76]">
                        {packagePriceLabel(item).replace(`${item.name} · `, "")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#7b5a6a]">
          客人自選模式最少要保留一個項目；預設項目會自動加入可選清單。
        </p>
      </fieldset>
    </div>
  );
}
