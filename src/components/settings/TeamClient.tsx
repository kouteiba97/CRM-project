"use client";

import { useState, useTransition } from "react";
import { MailPlus, RotateCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { initials } from "@/components/shell/initials";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { Modal } from "@/components/ui/Modal";
import { can, ROLES, type Role } from "@/lib/roles";
import { changeRole, inviteMember, leaveWorkspace, removeMember, resendInvite, revokeInvite } from "./team-actions";

type Member = { userId: string; name: string; email: string; role: Role; since: string };
type Invite = { id: string; email: string; role: Role; expires: string; expired: boolean };

const assignable = (me: Role) => ROLES.filter((r) => me === "owner" || r !== "owner");

export function TeamClient({
  myId,
  myRole,
  members,
  invites,
}: {
  myId: string;
  myRole: Role;
  members: Member[];
  invites: Invite[];
}) {
  const t = useTranslations("settings.team");
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);
  const manage = can(myRole, "admin");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ tone: "danger", title: t(`error_${res.error ?? "forbidden"}` as never) });
        return;
      }
      toast({ tone: "success", title: done });
      router.refresh();
    });

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await inviteMember(email, role);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t("invited", { email }) });
      setEmail("");
      router.refresh();
    });
  };

  return (
    <div className="settings-stack">
      {manage && (
        <form className="ax-card ax-card-body settings-section settings-form" onSubmit={invite} noValidate aria-labelledby="inv-title">
          <h2 id="inv-title" className="rail-title">
            {t("inviteTitle")}
          </h2>
          <p className="ax-help">{t("inviteHelp")}</p>
          <div className="team-invite-row">
            <Field
              id="inv-email"
              label={t("email")}
              required
              error={error && error !== "mail" && error !== "limit" ? t(`error_${error}` as never) : null}
              optionalLabel=""
            >
              <input
                id="inv-email"
                type="email"
                dir="ltr"
                className="ax-input"
                autoComplete="off"
                value={email}
                aria-invalid={error && error !== "mail" ? true : undefined}
                aria-describedby={describedBy("inv-email", error)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            <Field id="inv-role" label={t("role")} required optionalLabel="">
              <select id="inv-role" className="ax-input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {assignable(myRole).map((r) => (
                  <option key={r} value={r}>
                    {t(`role_${r}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="ax-help">{t(`roleHelp_${role}`)}</p>
          {(error === "mail" || error === "limit") && <p className="ax-banner danger">{t(`error_${error}`)}</p>}
          <div className="settings-actions">
            <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" disabled={pending || !email} aria-busy={pending}>
              <MailPlus className="ax-icon" aria-hidden />
              {t("sendInvite")}
            </button>
          </div>
        </form>
      )}

      <section className="ax-card ax-card-body settings-section" aria-labelledby="mem-title">
        <h2 id="mem-title" className="rail-title">
          {t("membersTitle", { count: members.length })}
        </h2>
        <ul className="team-list">
          {members.map((m) => {
            const editable = manage && m.userId !== myId && (myRole === "owner" || m.role !== "owner");
            return (
              <li key={m.userId} className="team-row">
                <span className="ax-avatar md" data-hue="2" aria-hidden>
                  {initials(m.name)}
                </span>
                <span className="team-who">
                  <span className="t-body-strong">
                    {m.name}
                    {m.userId === myId && <span className="ax-faint"> · {t("you")}</span>}
                  </span>
                  <span className="ax-faint" dir="ltr">
                    {m.email}
                  </span>
                </span>
                <span className="ax-faint team-since">{t("since", { date: m.since })}</span>
                {editable ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.userId}`}>
                      {t("roleOf", { name: m.name })}
                    </label>
                    <select
                      id={`role-${m.userId}`}
                      className="ax-input team-role"
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => run(() => changeRole(m.userId, e.target.value), t("roleChanged", { name: m.name }))}
                    >
                      {assignable(myRole).map((r) => (
                        <option key={r} value={r}>
                          {t(`role_${r}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
                      aria-label={t("removeOf", { name: m.name })}
                      onClick={() => setRemoving(m)}
                    >
                      <X className="ax-icon" aria-hidden />
                    </button>
                  </>
                ) : (
                  <span className="ax-badge team-role-badge">{t(`role_${m.role}`)}</span>
                )}
              </li>
            );
          })}
        </ul>
        {members.length > 1 && (
          <div>
            <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm" onClick={() => setLeaving(true)}>
              {t("leave")}
            </button>
          </div>
        )}
      </section>

      {manage && invites.length > 0 && (
        <section className="ax-card ax-card-body settings-section" aria-labelledby="pend-title">
          <h2 id="pend-title" className="rail-title">
            {t("pendingTitle")}
          </h2>
          <ul className="team-list">
            {invites.map((i) => (
              <li key={i.id} className="team-row">
                <span className="team-who">
                  <span dir="ltr">{i.email}</span>
                  <span className="ax-faint">
                    {t(`role_${i.role}`)} · {i.expired ? t("expired") : t("expires", { date: i.expires })}
                  </span>
                </span>
                <button
                  type="button"
                  className="ax-btn ax-btn-tertiary ax-btn-sm"
                  disabled={pending}
                  onClick={() => run(() => resendInvite(i.id), t("resent", { email: i.email }))}
                >
                  <RotateCw className="ax-icon" aria-hidden />
                  {t("resend")}
                </button>
                <button
                  type="button"
                  className="ax-btn ax-btn-tertiary ax-btn-sm"
                  disabled={pending}
                  onClick={() => run(() => revokeInvite(i.id), t("revoked", { email: i.email }))}
                >
                  {t("revoke")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {removing && (
        <Modal
          title={t("removeTitle", { name: removing.name })}
          size="sm"
          submitLabel={t("remove")}
          pending={pending}
          onClose={() => setRemoving(null)}
          onSubmit={() => {
            const m = removing;
            setRemoving(null);
            run(() => removeMember(m.userId), t("removed", { name: m.name }));
          }}
        >
          <p>{t("removeBody")}</p>
        </Modal>
      )}
      {leaving && (
        <Modal
          title={t("leaveTitle")}
          size="sm"
          submitLabel={t("leave")}
          pending={pending}
          onClose={() => setLeaving(false)}
          onSubmit={() => {
            setLeaving(false);
            start(async () => {
              const res = await leaveWorkspace();
              if (!res.ok) return toast({ tone: "danger", title: t(`error_${res.error}` as never) });
              router.push("/");
              router.refresh();
            });
          }}
        >
          <p>{t("leaveBody")}</p>
        </Modal>
      )}
    </div>
  );
}
