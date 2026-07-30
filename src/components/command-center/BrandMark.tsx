export function BrandMark({
  name,
  color,
  compact = false,
}: {
  name: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`command-brand-initial ${compact ? "is-compact" : ""}`}
      style={{
        background: color,
        color: readableTextColor(color),
      }}
      aria-label={`${name} 品牌色`}
      title={name}
    >
      {brandInitials(name)}
    </span>
  );
}

function brandInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function readableTextColor(background: string) {
  const match = background.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return "#ffffff";

  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 160 ? "#173b4d" : "#ffffff";
}
