import { CopyButton } from "./CopyButton";

type Props = {
  code: string;
  title?: string;
  description?: string;
};

export function EmbedCodeCard({
  code,
  title = "嵌入 script",
  description,
}: Props) {
  return (
    <div className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#9a5d76]">{title}</p>
          {description && (
            <p className="mt-1 text-sm leading-6 text-[#7b5a6a]">{description}</p>
          )}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
        {code}
      </pre>
    </div>
  );
}
