import { titleColor } from "@/lib/kamino/titles";
import { cn } from "@/lib/utils";

export function TitleChip({
  label,
  color,
  hall,
  pinned,
  onClick,
}: {
  label: string;
  color: string;
  hall?: string;
  pinned?: boolean;
  onClick?: () => void;
}) {
  const c = titleColor(color);
  const className = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide",
    pinned && "outline outline-2 outline-offset-1 outline-warn",
  );
  const style = { background: c.hex, color: c.fg };
  const inner = (
    <>
      <span className="truncate">{label}</span>
      {hall ? <span className="hidden font-semibold opacity-70 sm:inline">· {hall}</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style} title={hall ? `${label} · ${hall}` : label}>
        {inner}
      </button>
    );
  }
  return (
    <span className={className} style={style} title={hall ? `${label} · ${hall}` : label}>
      {inner}
    </span>
  );
}
