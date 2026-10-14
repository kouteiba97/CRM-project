import { setRequestLocale } from "next-intl/server";
import { ModuleStub, stubMetadata } from "@/components/ModuleStub";

export const generateMetadata = stubMetadata("invoices");

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ModuleStub module="invoices" />;
}
