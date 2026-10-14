"use client";

import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, EmptyState } from "@/components/ui/Card";

export type RevenuePoint = {
  month: string; // YYYY-MM-01
  short: string; // "Oct"
  long: string; // "October 2026"
  invoiced: number;
  collected: number;
  invoicedText: string;
  collectedText: string;
};

const W = 600;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 44 };
const BAR = 22; // DS: bars ≤ 24px, 2px gap between series

/** DS › ChartContainer: vertical bars, two series, horizontal grid only, exact values on hover/focus, table view. */
export function RevenueCard({
  points,
  ticks,
  max,
  title,
  ariaLabel,
}: {
  points: RevenuePoint[];
  ticks: { value: number; label: string }[];
  max: number;
  title: string;
  ariaLabel: string;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [table, setTable] = useState(false);
  const [tip, setTip] = useState<{ i: number; series: 0 | 1 } | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / points.length;
  const y = (v: number) => PAD.top + plotH - (max > 0 ? (v / max) * plotH : 0);
  const empty = points.every((p) => p.invoiced === 0 && p.collected === 0);
  const open = (p: RevenuePoint) => router.push(`/invoices?month=${p.month.slice(0, 7)}`);

  const toggle = (
    <button
      type="button"
      className="ax-btn ax-btn-tertiary ax-btn-sm"
      aria-pressed={table}
      onClick={() => setTable((v) => !v)}
    >
      {table ? <ChartColumn className="ax-icon" aria-hidden /> : <Table2 className="ax-icon" aria-hidden />}
      {table ? tc("viewAsChart") : tc("viewAsTable")}
    </button>
  );

  return (
    <Card id="revenue" title={title} sub={t("revenueSub")} icon={ChartColumn} tint="green" actions={toggle} className="span-8">
      <div className="card-body">
        {empty ? (
          <EmptyState icon={ChartColumn} title={t("revenueEmpty")} />
        ) : table ? (
          <table className="ax-table data-table">
            <thead>
              <tr>
                <th scope="col">{tc("month")}</th>
                <th scope="col" className="num">{t("invoiced")}</th>
                <th scope="col" className="num">{t("collected")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <th scope="row" style={{ fontWeight: 500, background: "none", position: "static" }}>{p.long}</th>
                  <td className="num">{p.invoicedText}</td>
                  <td className="num">{p.collectedText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <div className="ax-chart-legend" style={{ marginBottom: "var(--space-2)" }}>
              <span><i style={{ background: "var(--chart-1)" }} />{t("invoiced")}</span>
              <span><i style={{ background: "var(--chart-2)" }} />{t("collected")}</span>
            </div>
            {/* Time flows left → right in every language (DS › Languages). */}
            <div className="ax-chart chart-wrap" dir="ltr">
              <svg className="chart-plot" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel}>
                {ticks.map((tk) => (
                  <g key={tk.value}>
                    <line className={tk.value === 0 ? "axis" : "grid"} x1={PAD.left} x2={W - PAD.right} y1={y(tk.value)} y2={y(tk.value)} />
                    <text x={PAD.left - 8} y={y(tk.value) + 4} textAnchor="end">{tk.label}</text>
                  </g>
                ))}
                {points.map((p, i) => {
                  const cx = PAD.left + slot * i + slot / 2;
                  const bars = [
                    { v: p.invoiced, text: p.invoicedText, name: t("invoiced"), x: cx - BAR - 1, fill: "s1" },
                    { v: p.collected, text: p.collectedText, name: t("collected"), x: cx + 1, fill: "s2" },
                  ] as const;
                  return (
                    <g key={p.month}>
                      {bars.map((b, s) => (
                        <rect
                          key={s}
                          className={`bar ${b.fill}`}
                          x={b.x}
                          y={y(b.v)}
                          width={BAR}
                          height={Math.max(0, y(0) - y(b.v))}
                          rx={2}
                          tabIndex={0}
                          role="link"
                          aria-label={`${p.long} · ${b.name} ${b.text}`}
                          style={{ cursor: "pointer", opacity: tip && (tip.i !== i || tip.series !== s) ? 0.55 : 1 }}
                          onPointerEnter={() => setTip({ i, series: s as 0 | 1 })}
                          onPointerLeave={() => setTip(null)}
                          onFocus={() => setTip({ i, series: s as 0 | 1 })}
                          onBlur={() => setTip(null)}
                          onClick={() => open(p)}
                          onKeyDown={(e) => e.key === "Enter" && open(p)}
                        />
                      ))}
                      <text x={cx} y={H - 8} textAnchor="middle">{p.short}</text>
                    </g>
                  );
                })}
              </svg>
              {tip && points[tip.i] && (
                <div
                  className="ax-tooltip chart-tip"
                  role="presentation"
                  style={{
                    left: `${((PAD.left + slot * tip.i + slot / 2) / W) * 100}%`,
                    top: `${(y(tip.series === 0 ? points[tip.i]!.invoiced : points[tip.i]!.collected) / H) * 100}%`,
                  }}
                >
                  <b>{points[tip.i]!.long}</b>
                  <span>
                    {tip.series === 0 ? t("invoiced") : t("collected")}{" "}
                    {tip.series === 0 ? points[tip.i]!.invoicedText : points[tip.i]!.collectedText}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
