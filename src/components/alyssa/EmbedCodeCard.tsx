import { CopyButton } from "./CopyButton";

type Props = {
  code: string;
  title?: string;
  description?: string;
};

export function EmbedCodeCard({
  code,
  title = "Wix 嵌入碼",
  description,
}: Props) {
  return (
    <div className="min-w-0 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#9a5d76]">{title}</p>
          {description && (
            <p className="mt-1 text-sm leading-6 text-[#7b5a6a]">{description}</p>
          )}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="mt-4 max-w-full overflow-x-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
        {code}
      </pre>
    </div>
  );
}
