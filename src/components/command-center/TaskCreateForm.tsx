"use client";

import { useMemo, useState } from "react";
import { BellRing, CalendarPlus, Flag, UserRoundPlus } from "lucide-react";
import { createWorkTaskAction } from "@/app/tasks/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import type { WorkTaskBrand, WorkTaskMember } from "@/lib/marketing/workTasks";

export function TaskCreateForm({
  brands,
  members,
  returnPath,
}: {
  brands: WorkTaskBrand[];
  members: WorkTaskMember[];
  returnPath: string;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const eligibleMembers = useMemo(
    () => members.filter((member) => member.isMaster || member.brandIds.includes(brandId)),
    [brandId, members]
  );

  return (
    <form action={createWorkTaskAction} className="grid gap-4">
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
              <option key={brand.id} value={brand.id}>{brand.name}</option>
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
              <option key={member.id} value={member.id}>{member.name}</option>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-[#755568]"><CalendarPlus size={13} /> Due Date</span>
          <input name="dueDate" type="date" className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">Due Time</span>
          <input name="dueTime" type="time" className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]" />
        </label>
        <label className="grid gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-[#755568]"><Flag size={13} /> Priority</span>
          <select name="priority" defaultValue="normal" className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">狀態</span>
          <select name="status" defaultValue="todo" className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]">
            <option value="todo">待辦</option>
            <option value="in_progress">進行中</option>
            <option value="done">完成</option>
          </select>
        </label>
        <label className="flex min-h-[64px] items-center gap-2 rounded-xl border border-[#ead9cf] bg-[#fff9f3] px-3 py-2 text-xs font-bold text-[#6c4d60]">
          <input name="performanceMarker" type="checkbox" className="h-4 w-4 accent-[#7c365f]" />
          <span>
            <b className="flex items-center gap-1"><BellRing size={13} /> 成效里程碑</b>
            <small className="mt-1 block font-semibold text-[#9b7b8c]">完成後顯示於成效時間線</small>
          </span>
        </label>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3">
        <span className="flex items-center gap-2 text-xs font-bold text-[#806174]">
          <UserRoundPlus size={15} /> 派 Job 後，負責人會收到 Growth OS 內通知。
        </span>
        <SubmitButton className="command-primary-button" pendingLabel="建立中…" disabled={!brandId}>
          建立工作
        </SubmitButton>
      </footer>
    </form>
  );
}
