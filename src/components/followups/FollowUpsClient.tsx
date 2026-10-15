"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { planFollowUp } from "@/components/clients/actions";
import { patchQuery } from "@/components/clients/url";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  type Option,
} from "@/components/list/ListControls";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field, FormDrawer } from "@/components/ui/FormDrawer";

/** Search · Channel · On (clients / leads) · Owner · Clear. */
export function FollowUpsToolbar({
  channels,
  kinds,
  owners,
  resultsLabel,
}: {
  channels: Option[];
  kinds: Option[];
  owners: Option[];
  resultsLabel: string;
}) {
  const t = useTranslations("followUps");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = [
    { param: "channel", label: t("filterChannel"), options: channels },
    { param: "on", label: t("filterOn"), options: kinds },
    { param: "owner", label: t("filterOwner"), options: owners },
  ];
  const active = groups.filter((g) => sp.get(g.param)).length;
  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath="/follow-ups"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? (
              <FilterChip key={g.param} basePath="/follow-ups" {...g} />
            ) : null,
          )}
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`/follow-ups${patchQuery(sp, { channel: null, on: null, owner: null })}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
        </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/follow-ups"
          title={tc("filterButton")}
          groups={groups}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const tomorrowAt10 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
};

/** New follow-up (`?new=1`): subject, the client or lead it is about, channel, date and time. */
export function FollowUpDrawer({
  clients,
  leads,
  closeHref,
  initialTarget,
}: {
  clients: Option[];
  leads: Option[];
  closeHref: string;
  initialTarget: string;
}) {
  const t = useTranslations("followUps.form");
  const tch = useTranslations("channel");
  const router = useRouter();
  const toast = useToast();
  const initial = { subject: "", target: initialTarget, channel: "call", when: tomorrowAt10() };
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => v[k] !== initial[k]);
  const set = (k: keyof typeof initial, value: string) => {
    setV((x) => ({ ...x, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };
  const close = () => router.replace(closeHref, { scroll: false });

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!v.subject.trim()) errs.subject = t("subjectRequired");
    if (!v.target) errs.target = t("targetRequired");
    if (!v.when) errs.when = t("whenRequired");
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) return document.getElementById(`fu-${first}`)?.focus();
    const [type, id] = v.target.split(":") as ["client" | "lead", string];
    start(async () => {
      try {
        await planFollowUp(
          { type, id },
          { subject: v.subject, channel: v.channel, dueAt: new Date(v.when).toISOString() },
        );
        toast({ tone: "success", title: t("created", { subject: v.subject.trim() }) });
        close();
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <FormDrawer
      size="sm"
      title={t("title")}
      dirty={dirty}
      pending={pending}
      submitLabel={t("create")}
      savingLabel={t("saving")}
      discardQuestion={t("discardQuestion")}
      formError={failed ? t("failed") : null}
      onSubmit={submit}
      onClose={close}
    >
      <Field
        id="fu-subject"
        label={t("subject")}
        required
        error={errors.subject || null}
        optionalLabel={t("optional")}
      >
        <input
          id="fu-subject"
          className="ax-input"
          value={v.subject}
          placeholder={t("subjectPlaceholder")}
          aria-invalid={errors.subject ? true : undefined}
          aria-describedby={describedBy("fu-subject", errors.subject)}
          onChange={(e) => set("subject", e.target.value)}
        />
      </Field>
      <Field
        id="fu-target"
        label={t("about")}
        required
        error={errors.target || null}
        optionalLabel={t("optional")}
      >
        <select
          id="fu-target"
          className="ax-input"
          value={v.target}
          aria-invalid={errors.target ? true : undefined}
          aria-describedby={describedBy("fu-target", errors.target)}
          onChange={(e) => set("target", e.target.value)}
        >
          <option value="">{t("chooseTarget")}</option>
          <optgroup label={t("clients")}>
            {clients.map((c) => (
              <option key={c.value} value={`client:${c.value}`}>
                {c.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("leads")}>
            {leads.map((l) => (
              <option key={l.value} value={`lead:${l.value}`}>
                {l.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <div className="nc-grid">
        <Field id="fu-channel" label={t("channel")} required optionalLabel={t("optional")}>
          <select
            id="fu-channel"
            className="ax-input"
            value={v.channel}
            onChange={(e) => set("channel", e.target.value)}
          >
            {(["call", "email", "meeting"] as const).map((c) => (
              <option key={c} value={c}>
                {tch(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="fu-when"
          label={t("when")}
          required
          error={errors.when || null}
          optionalLabel={t("optional")}
        >
          <input
            id="fu-when"
            className="ax-input"
            type="datetime-local"
            value={v.when}
            aria-invalid={errors.when ? true : undefined}
            aria-describedby={describedBy("fu-when", errors.when)}
            onChange={(e) => set("when", e.target.value)}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
