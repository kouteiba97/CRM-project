import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectRecordPage, loadProjectForMeta } from "@/components/projects/ProjectRecordPage";
import { ProjectsPage } from "@/components/projects/ProjectsPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  if (slug?.length === 1 && slug[0]) {
    const project = await loadProjectForMeta(slug[0]);
    if (project) return { title: `${project.name} · ${t("projects")}` };
  }
  return { title: t("projects") };
}

/** `/projects` is the list (`?new=1` drawer, also from "Convert to project"); `/projects/[id]` is the record. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (!slug || slug.length === 0) return <ProjectsPage searchParams={sp} />;
  if (slug.length === 1 && slug[0]) return <ProjectRecordPage id={slug[0]} sp={sp} />;
  notFound();
}
