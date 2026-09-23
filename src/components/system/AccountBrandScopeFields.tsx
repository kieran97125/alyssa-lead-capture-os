export type AccountBrandScopeOption = {
  value: string;
  label: string;
};

export function AccountBrandScopeFields({
  accountOptions,
  brandOptions,
  accountId,
  brandId,
}: {
  accountOptions: AccountBrandScopeOption[];
  brandOptions: AccountBrandScopeOption[];
  accountId: string;
  brandId: string;
}) {
  return (
    <>
      <label>
        <span>Omni Account</span>
        <select name="accountId" defaultValue={accountId}>
          <option value="">全部 Account</option>
          {accountOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>品牌</span>
        <select name="brandId" defaultValue={brandId} disabled={!accountId}>
          <option value="">{accountId ? "全部品牌" : "先揀 Account"}</option>
          {brandOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
