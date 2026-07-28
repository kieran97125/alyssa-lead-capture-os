import Image from "next/image";

export function BrandMark({
  name,
  color,
  logoUrl,
  compact = false,
}: {
  name: string;
  color: string;
  logoUrl?: string | null;
  compact?: boolean;
}) {
  if (logoUrl?.startsWith("/")) {
    return (
      <span
        className={`command-brand-logo ${compact ? "is-compact" : ""}`}
        aria-label={`${name} Logo`}
      >
        <Image
          src={logoUrl}
          width={100}
          height={58}
          sizes={compact ? "64px" : "84px"}
          alt=""
        />
      </span>
    );
  }

  return (
    <span
      className={`command-brand-initial ${compact ? "is-compact" : ""}`}
      style={{ background: color }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}
