"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CalendarPlus,
  Flag,
  UserRoundPlus,
} from "lucide-react";
import { createWorkTaskAction } from "@/app/tasks/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import type {
  WorkTaskBrand,
  WorkTaskMember,
} from "@/lib/marketing/workTasks";

export function TaskCreateForm({
  brands,
  members,
  returnPath,
  defaultStartDate,
}: {
  brands: WorkTaskBrand[];
  members: WorkTaskMember[];
  returnPath: string;
  defaultStartDate: string;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [dueDate, setDueDate] = useState("");
  const eligibleMembers = useMemo(
    () =>
      members.filter(
        (member) => member.isMaster || member.brandIds.includes(brandId)
      ),
    [brandId, members]
  );

  return (
    <form
      action={createWorkTaskAction}
      className="grid gap-4"
      data-testid="task-create-form"
    >
      <input type="hidden" name="returnPath" value={returnPath} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 xl:col-span-2">
          <span className="text-xs font-black text-[#755568]">工作事項</span>
          <input
            name="title"
            required
            maxLength={180}
            placeholder="例如：GOS 脫毛 Campaign Final QA"
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2.5 text-sm font-bold text-[#4d2d40] outline-none focus:border-[#a76a88]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">品牌</span>
          <select
            name="brandId"
            required
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2.5 text-sm font-bold text-[#4d2d40]"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">負責人</span>
          <select
            name="assigneeMemberId"
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2.5 text-sm font-bold text-[#4d2d40]"
          >
            <option value="">未指派</option>
            {eligibleMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <small className="text-[10px] font-semibold text-[#9b7b8c]">
            只顯示擁有此品牌 Access 嘅同事。
          </small>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-black text-[#755568]">內容 / Brief</span>
        <textarea
          name="description"
          maxLength={4000}
          rows={3}
          placeholder="需要完成咩、交付物、注意事項…"
          className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-[#4d2d40] outline-none focus:border-[#a76a88]"
        />
      </label>

      <section className="rounded-2xl border border-[#ead9cf] bg-[#fffaf7] p-3">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <strong className="flex items-center gap-1.5 text-xs text-[#5a2348]">
              <CalendarClock size={14} /> 工作時間
            </strong>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-[#8b7180]">
              工作列表按 Start Day 顯示；Due Day 只控制截止、出街、日曆及到期提醒。
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#7c365f]">
            Start ≠ Due
          </span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-black text-[#755568]">
              Start Day／派 Job 日
            </span>
            <input
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(event) => {
                const next = event.target.value;
                setStartDate(next);
                if (dueDate && next && dueDate < next) setDueDate("");
              }}
              className="rounded-xl border border-[#a76a88] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
            />
            <small className="text-[10px] font-semibold text-[#9b7b8c]">
              決定個 Job 出現喺邊一週工作列表。
            </small>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black text-[#755568]">
              Start Time（可留空）
            </span>
            <input
              name="startTime"
              type="time"
              className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
            />
            <small className="text-[10px] font-semibold text-[#9b7b8c]">
              留空會於 Start Day 09:00 HKT 提醒。
            </small>
          </label>
          <label className="grid gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-black text-[#755568]">
              <CalendarPlus size={13} /> Due Day／截止・出街
            </span>
            <input
              name="dueDate"
              type="date"
              min={startDate || undefined}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
            />
            <small className="text-[10px] font-semibold text-[#9b7b8c]">
              加入營銷日曆及出街日期會跟呢一日。
            </small>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black text-[#755568]">
              Due Time（可留空）
            </span>
            <input
              name="dueTime"
              type="time"
              className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
            />
            <small className="text-[10px] font-semibold text-[#9b7b8c]">
              留空以 12:00 HKT 作日曆／到期時間。
            </small>
          </label>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-[#755568]">
            <Flag size={13} /> Priority
          </span>
          <select
            name="priority"
            defaultValue="normal"
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">狀態</span>
          <select
            name="status"
            defaultValue="todo"
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          >
            <option value="todo">待辦</option>
            <option value="in_progress">進行中</option>
            <option value="done">完成</option>
          </select>
        </label>
        <label className="flex min-h-[64px] items-center gap-2 rounded-xl border border-[#ead9cf] bg-[#fff9f3] px-3 py-2 text-xs font-bold text-[#6c4d60]">
          <input
            name="performanceMarker"
            type="checkbox"
            className="h-4 w-4 accent-[#7c365f]"
          />
          <span>
            <b className="flex items-center gap-1">
              <BellRing size={13} /> 成效里程碑
            </b>
            <small className="mt-1 block font-semibold text-[#9b7b8c]">
              完成後顯示於成效時間線
            </small>
          </span>
        </label>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3">
        <span className="flex items-center gap-2 text-xs font-bold leading-5 text-[#806174]">
          <UserRoundPlus size={15} />
          派 Job 後會發系統通知；負責人開啟桌面通知後，關閉網頁都會收到。
        </span>
        <SubmitButton
          className="command-primary-button"
          pendingLabel="建立中…"
          disabled={!brandId || !startDate}
        >
          建立工作
        </SubmitButton>
      </footer>
    </form>
  );
}
