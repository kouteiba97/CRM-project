import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/Card";
import type { NavKey } from "@/components/shell/nav";

/** Placeholder for modules built in later phases: PageHeader + EmptyState, no fake data. */
export async function ModuleStub({ module }: { module: NavKey }) {
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const name = tn(module);
  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{name}</h1>
      </header>
      <div className="ax-card">
        <EmptyState icon={Construction} title={tc("comingSoonTitle", { module: name })} body={tc("comingSoonBody")} />
      </div>
    </>
  );
}

export function stubMetadata(module: NavKey) {
  return async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "nav" });
    return { title: t(module) };
  };
}
