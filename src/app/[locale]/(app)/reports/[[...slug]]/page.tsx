import { setRequestLocale } from "next-intl/server";
import { ModuleStub, stubMetadata } from "@/components/ModuleStub";

export const generateMetadata = stubMetadata("reports");

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ModuleStub module="reports" />;
}
