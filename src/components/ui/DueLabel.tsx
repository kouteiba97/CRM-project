import { CircleAlert, Clock } from "lucide-react";
import type { Due } from "@/lib/due";

/** Due date with the DS due styling; the absolute date is always available as a tooltip. */
export function DueLabel({ due }: { due: Due }) {
  const cls = due.tone === "overdue" ? " overdue" : due.tone === "soon" ? " soon" : "";
  return (
    <span className={`ax-due${cls}`} title={due.absolute}>
      {due.tone === "overdue" ? (
        <CircleAlert className="ax-icon" aria-hidden />
      ) : due.tone === "soon" ? (
        <Clock className="ax-icon" aria-hidden />
      ) : null}
      {due.label}
    </span>
  );
}
