import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Tint = "" | "blue" | "green" | "orange" | "violet" | "danger";

/** ax-card with the DS card head: icon tile + title (+ sub) + "View all" link to the filtered list. */
export function Card({
  id,
  title,
  sub,
  icon: Icon,
  tint = "",
  href,
  linkLabel,
  actions,
  className = "",
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  icon: LucideIcon;
  tint?: Tint;
  href?: string;
  linkLabel?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`ax-card card ${className}`} aria-labelledby={id}>
      <div className="ax-card-head">
        <span className={`ax-icon-tile sm ${tint}`} aria-hidden>
          <Icon className="ax-icon" />
        </span>
        <div>
          <h2 id={id}>{title}</h2>
          {sub && <span className="sub">{sub}</span>}
        </div>
        <div className="ax-actions">
          {actions}
          {href && linkLabel && (
            <Link className="ax-link" href={href}>
              {linkLabel}
              <ArrowRight className="ax-icon ax-icon-sm ax-flip" aria-hidden />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
}) {
  return (
    <div className="ax-empty">
      <span className="tile" aria-hidden>
        <Icon className="ax-icon" />
      </span>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

export function CardSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div className="ax-card skel-card" aria-busy="true" aria-label={label}>
      <span className="ax-skel" style={{ width: "40%" }} />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="ax-skel" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
