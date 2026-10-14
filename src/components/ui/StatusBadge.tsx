import { Check, CircleAlert, Clock, Eye, Mail, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { statusDef, type Glyph, type StatusDomain } from "@/lib/status";

const ICONS: Record<Exclude<Glyph, "dot">, typeof Check> = {
  pencil: Pencil,
  mail: Mail,
  eye: Eye,
  clock: Clock,
  check: Check,
  alert: CircleAlert,
  x: X,
};

/** DS › StatusBadge: icon or dot + the fixed-vocabulary word. `suffix` adds e.g. "· 12 days". */
export function StatusBadge({ domain, code, suffix }: { domain: StatusDomain; code: string; suffix?: string }) {
  const t = useTranslations("status");
  const def = statusDef(domain, code);
  const Icon = def.glyph === "dot" ? null : ICONS[def.glyph];
  return (
    <span className={`ax-badge ${def.tone === "neutral" ? "" : def.tone}${def.struck ? " void" : ""}`}>
      {Icon ? <Icon className="ax-icon" aria-hidden /> : <span className="dot" aria-hidden />}
      {t(`${domain}.${code}` as never)}
      {suffix ? ` · ${suffix}` : ""}
    </span>
  );
}
