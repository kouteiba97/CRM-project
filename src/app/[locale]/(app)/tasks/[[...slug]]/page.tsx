import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TasksPage } from "@/components/tasks/TasksPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("tasks") };
}

/** `/tasks` is the task list; `?new=1` opens quick create (`T`), `?task=<id>` edits one. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (slug && slug.length > 0) notFound();
  return <TasksPage searchParams={await searchParams} />;
}
