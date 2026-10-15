/**
 * DS › Progress (bar): `accent-secondary` fill for neutral progress; `tone` only when progress is judged
 * (budget > 90% warning, > 100% danger). Always paired with a visible text value by the caller.
 */
export function ProgressBar({
  value,
  label,
  tone,
  size,
}: {
  /** 0–1; values above 1 fill the bar. */
  value: number;
  label: string;
  tone?: "warning" | "danger" | "success";
  size?: "sm";
}) {
  const pct = Math.round(Math.max(0, value) * 100);
  return (
    <div
      className={`ax-progress${size === "sm" ? " sm" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(pct, 100)}
      aria-valuetext={`${pct}%`}
      aria-label={label}
    >
      <span className={tone ?? ""} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
