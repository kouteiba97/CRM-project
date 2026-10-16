import type { ReactNode } from "react";
import { CircleCheck, CircleAlert, Info } from "lucide-react";

/** The centred card every signed-out screen uses (login, sign-up, forgot and reset password). */
export function AuthCard({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="ax-avatar md sq" data-hue="1" aria-hidden>
            A
          </span>
          <span className="login-brand-name">Apex CRM</span>
        </div>
        <h1 className="t-page-title">{title}</h1>
        {lead && <p className="login-lead">{lead}</p>}
        {children}
        {footer && <p className="login-footer">{footer}</p>}
      </div>
    </main>
  );
}

const ICON = { error: CircleAlert, success: CircleCheck, info: Info } as const;

/** Inline notice inside the card; errors are announced (role=alert), the rest politely. */
export function AuthNotice({
  tone,
  id,
  children,
}: {
  tone: keyof typeof ICON;
  id?: string;
  children: ReactNode;
}) {
  const Icon = ICON[tone];
  return (
    <div className={`login-alert is-${tone}`} id={id} role={tone === "error" ? "alert" : "status"}>
      <Icon className="ax-icon" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
