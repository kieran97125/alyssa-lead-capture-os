import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  Palette,
  Plus,
  Save,
  Settings2,
  Trash2,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { getCreativeSettingsSnapshot } from "@/lib/creative/store";
import {
  creativeTaxonomyCategories,
  creativeTaxonomyCategoryLabels,
} from "@/lib/creative/types";
import {
  createCreativeTaxonomyAction,
  deleteCreativeTaxonomyAction,
  saveCreativeDesignerProfileAction,
  updateCreativeTaxonomyAction,
} from "@/app/creative-jobs/actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

const fieldClass =
  "h-9 rounded-xl border border-[#dfcdc4] bg-white px-3 text-xs font-bold text-[#3d2232] outline-none focus:border-[#8e5a76] focus:ring-4 focus:ring-[#8e5a76]/10";

export default async function CreativeSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    creative_status?: string | string[];
    creative_message?: string | string[];
  }>;
}) {
  const [snapshot, query] = await Promise.all([
    getCreativeSettingsSnapshot(),
    searchParams,
  ]);

  if (!snapshot) {
    return (
      <main className="alyssa-shell">
        <AppNav />
        <div className="command-page">
          <div className="command-page-inner">
            <section className="command-surface p-10 text-center">
              <Settings2 className="mx-auto text-[#9a5d76]" size={30} />
              <h1 className="mt-3 text-xl font-black">只有系統擁有人可以管理設計分類</h1>
              <p className="mt-2 text-sm font-semibold text-[#806174]">
                Marketer 只可以使用現有選項；不能新增、改名、停用或刪除分類。
              </p>
              <Link href="/creative-jobs" className="command-secondary-button mt-5 inline-flex">
                <ArrowLeft size={15} /> 返回設計工作
              </Link>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const message = firstParam(query?.creative_message);
  const status = firstParam(query?.creative_status);

  return (
    <main className="alyssa-shell">
      <AppNav access={snapshot.access} />
      <div className="command-page">
        <div className="command-page-inner !max-w-[1580px]">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Creative administration</p>
              <h1 className="command-page-title">設計工作設定</h1>
              <p className="command-page-subtitle">
                Source、用途、媒體格式完全分開管理；只有系統擁有人可以加減。Designer 名單可先建立，再連結個人帳戶收通知。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings/team" className="command-secondary-button">
                <UsersRound size={15} /> 成員及權限
              </Link>
              <Link href="/creative-jobs" className="command-primary-button">
                <Palette size={15} /> 設計工作
              </Link>
            </div>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                status === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          {!snapshot.schemaReady ? (
            <section className="command-surface p-8 text-center">
              <CircleOff className="mx-auto text-[#a43b50]" size={28} />
              <h2 className="mt-3 text-lg font-black">Creative Studio Database 尚未完成設定</h2>
            </section>
          ) : (
            <>
              <section className="grid gap-4 xl:grid-cols-3">
                {creativeTaxonomyCategories.map((category) => {
                  const items = snapshot.taxonomies.filter(
                    (item) => item.category === category
                  );
                  return (
                    <section
                      key={category}
                      className="command-surface overflow-hidden"
                    >
                      <header className="border-b border-[#ead9cf] bg-[#fffaf7] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a5d76]">
                          {category.replace("_", " ")}
                        </p>
                        <h2 className="mt-1 text-lg font-black">
                          {creativeTaxonomyCategoryLabels[category]}
                        </h2>
                        <p className="mt-1 text-[11px] font-semibold text-[#806174]">
                          {category === "source"
                            ? "素材由邊度嚟，例如 KOL 拍攝、舊素材、價目資料。"
                            : category === "usage"
                              ? "最後用喺邊度，例如 Feed、Meta AD、Website、Price List。"
                              : "Designer 最後交咩格式，例如靜態圖、Video、PDF。"}
                        </p>
                      </header>
                      <div className="grid gap-2 p-3">
                        {items.map((item) => (
                          <article
                            key={item.id}
                            className={`rounded-xl border p-3 ${
                              item.isActive
                                ? "border-[#eadfd9] bg-white"
                                : "border-[#eadfd9] bg-[#f8f5f3] opacity-75"
                            }`}
                          >
                            <form
                              action={updateCreativeTaxonomyAction}
                              className="grid gap-2"
                            >
                              <input type="hidden" name="taxonomyId" value={item.id} />
                              <input type="hidden" name="isActive" value={item.isActive ? "true" : "false"} />
                              <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                                <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                                  名稱
                                  <input
                                    name="name"
                                    defaultValue={item.name}
                                    className={fieldClass}
                                    required
                                  />
                                </label>
                                <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                                  排序
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    min={0}
                                    defaultValue={item.sortOrder}
                                    className={fieldClass}
                                  />
                                </label>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[9px] font-bold text-[#927987]">
                                  {item.usageCount || 0} 張 Job 使用
                                </span>
                                <div className="flex gap-1.5">
                                  <SubmitButton
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#dfcdc4] px-2 text-[9px] font-black text-[#5a2348]"
                                    pendingLabel="儲存中…"
                                  >
                                    <Save size={11} /> 儲存
                                  </SubmitButton>
                                </div>
                              </div>
                            </form>
                            <div className="mt-2 flex justify-end gap-1.5 border-t border-[#f0e7e2] pt-2">
                              <form action={updateCreativeTaxonomyAction}>
                                <input type="hidden" name="taxonomyId" value={item.id} />
                                <input type="hidden" name="name" value={item.name} />
                                <input type="hidden" name="sortOrder" value={item.sortOrder} />
                                <input type="hidden" name="isActive" value={item.isActive ? "false" : "true"} />
                                <SubmitButton
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#dfcdc4] px-2 text-[9px] font-black text-[#6d4a5c]"
                                  pendingLabel="更新中…"
                                >
                                  {item.isActive ? <CircleOff size={11} /> : <CheckCircle2 size={11} />}
                                  {item.isActive ? "停用" : "重新啟用"}
                                </SubmitButton>
                              </form>
                              {item.usageCount === 0 ? (
                                <form action={deleteCreativeTaxonomyAction}>
                                  <input type="hidden" name="taxonomyId" value={item.id} />
                                  <ConfirmSubmitButton
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e5c5c8] px-2 text-[9px] font-black text-[#a43b50]"
                                    pendingLabel="刪除中…"
                                    confirmMessage={`確定永久刪除「${item.name}」？`}
                                  >
                                    <Trash2 size={11} /> 刪除
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </article>
                        ))}

                        <form
                          action={createCreativeTaxonomyAction}
                          className="grid gap-2 rounded-xl border border-dashed border-[#d9b8c6] bg-[#fff9fb] p-3"
                        >
                          <input type="hidden" name="category" value={category} />
                          <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                            新增{creativeTaxonomyCategoryLabels[category]}
                            <input
                              name="name"
                              className={fieldClass}
                              placeholder="輸入新選項"
                              required
                            />
                          </label>
                          <SubmitButton
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#5a2348] text-[10px] font-black text-white"
                            pendingLabel="新增中…"
                          >
                            <Plus size={12} /> 新增選項
                          </SubmitButton>
                        </form>
                      </div>
                    </section>
                  );
                })}
              </section>

              <section className="command-surface mt-5 overflow-hidden">
                <header className="flex flex-col gap-3 border-b border-[#ead9cf] bg-[#fffaf7] p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a5d76]">
                      Designer registry
                    </p>
                    <h2 className="mt-1 text-lg font-black">Designer 名單及帳戶連結</h2>
                    <p className="mt-1 text-[11px] font-semibold text-[#806174]">
                      Amber／Vicky 已預設建立。先喺「成員及權限」建立個人帳戶，再喺呢度連結，先可以收到派 Job、Review、Due 同桌面通知。
                    </p>
                  </div>
                  <Link href="/settings/team" className="command-secondary-button">
                    <UserRoundCog size={15} /> 設定同事權限
                  </Link>
                </header>
                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {snapshot.designers.map((designer) => (
                    <form
                      key={designer.id}
                      action={saveCreativeDesignerProfileAction}
                      className="grid gap-3 rounded-2xl border border-[#e8dcd5] bg-white p-4"
                    >
                      <input type="hidden" name="profileId" value={designer.id} />
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff0f5] text-[#7c365f]">
                          <Palette size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">
                            {designer.displayName}
                          </strong>
                          <small className="text-[9px] font-bold text-[#927987]">
                            {designer.linkedMemberEmail || "未連結個人帳戶"}
                          </small>
                        </div>
                      </div>
                      <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                        顯示名稱
                        <input
                          name="displayName"
                          defaultValue={designer.displayName}
                          className={fieldClass}
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                        連結團隊帳戶
                        <select
                          name="linkedMemberId"
                          defaultValue={designer.linkedMemberId || ""}
                          className={fieldClass}
                        >
                          <option value="">未連結</option>
                          {snapshot.members
                            .filter((member) => member.status !== "removed")
                            .map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.fullName || member.email} · {member.role}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-[1fr_88px] items-end gap-2">
                        <label className="flex h-9 items-center gap-2 rounded-xl border border-[#dfcdc4] bg-[#fffaf7] px-3 text-[10px] font-black text-[#6d4a5c]">
                          <input
                            name="isActive"
                            type="checkbox"
                            defaultChecked={designer.isActive}
                          />
                          啟用 Designer
                        </label>
                        <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                          排序
                          <input
                            name="sortOrder"
                            type="number"
                            min={0}
                            defaultValue={designer.sortOrder}
                            className={fieldClass}
                          />
                        </label>
                      </div>
                      <SubmitButton
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#5a2348] text-[10px] font-black text-white"
                        pendingLabel="儲存中…"
                      >
                        <Save size={13} /> 儲存 Designer
                      </SubmitButton>
                    </form>
                  ))}

                  <form
                    action={saveCreativeDesignerProfileAction}
                    className="grid gap-3 rounded-2xl border border-dashed border-[#d9b8c6] bg-[#fff9fb] p-4"
                  >
                    <div>
                      <strong className="text-sm">新增 Designer</strong>
                      <p className="mt-1 text-[10px] font-semibold text-[#806174]">
                        將來增加第三位 Designer 唔需要改程式。
                      </p>
                    </div>
                    <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                      顯示名稱
                      <input name="displayName" className={fieldClass} required />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black text-[#6d4a5c]">
                      連結團隊帳戶
                      <select name="linkedMemberId" className={fieldClass} defaultValue="">
                        <option value="">稍後連結</option>
                        {snapshot.members
                          .filter((member) => member.status !== "removed")
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.fullName || member.email} · {member.role}
                            </option>
                          ))}
                      </select>
                    </label>
                    <input type="hidden" name="isActive" value="true" />
                    <input type="hidden" name="sortOrder" value="100" />
                    <SubmitButton
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#5a2348] text-[10px] font-black text-white"
                      pendingLabel="新增中…"
                    >
                      <Plus size={13} /> 新增 Designer
                    </SubmitButton>
                  </form>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
