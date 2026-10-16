import { notFound } from "next/navigation";
import { ClientsImportPage } from "@/components/clients/ClientsImportPage";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientsListPage } from "@/components/clients/ClientsListPage";
import { ClientProfilePage, loadClientForMeta } from "@/components/clients/ClientProfilePage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  if (slug?.length === 1 && slug[0]) {
    const client = await loadClientForMeta(slug[0]);
    if (client) return { title: `${client.name} · ${t("clients")}` };
  }
  return { title: t("clients") };
}

/** `/clients` is the list (with `?new=1` drawer); `/clients/[id]` is the ClientProfile. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (!slug || slug.length === 0) return <ClientsListPage searchParams={sp} />;
  if (slug.length === 1 && slug[0] === "import") return <ClientsImportPage />;
  if (slug.length === 1 && slug[0]) {
    return <ClientProfilePage id={slug[0]} sp={sp} />;
  }
  notFound();
}
