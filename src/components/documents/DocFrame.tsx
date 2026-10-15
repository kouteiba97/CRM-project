"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/** A4 width at 96 dpi; the `doc-page` token. */
const PAGE_PX = 794;

/**
 * DS › InvoiceDocument › PDF preview container: toolbar (number, status, zoom Fit / 100%, actions) over a
 * sunken stage with the page centred. "Fit" scales the page to the frame width; "100%" scrolls inside.
 */
export function DocFrame({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const t = useTranslations("documents.frame");
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => {
      const pad = parseFloat(getComputedStyle(el).paddingInlineStart) * 2 || 0;
      setZoom(Math.min(1, (el.clientWidth - pad) / PAGE_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ax-pdf-frame doc-frame">
      <div className="ax-pdf-bar">
        {bar}
        <div className="ax-segmented" role="group" aria-label={t("zoom")}>
          <button type="button" aria-pressed={fit} onClick={() => setFit(true)}>
            {t("fit")}
          </button>
          <button type="button" aria-pressed={!fit} onClick={() => setFit(false)}>
            100%
          </button>
        </div>
      </div>
      <div ref={stage} className="ax-pdf-stage" tabIndex={0} role="region" aria-label={t("page")}>
        <div className="doc-zoom" style={{ zoom: fit ? zoom : 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
