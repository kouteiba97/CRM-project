import { and, desc, eq, isNull } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { files, users } from "@/db/schema";
import { formatter, type Locale } from "@/lib/format";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { EmptyState } from "@/components/ui/Card";
import { FileRowDelete, FileUploader } from "./FileParts";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Files tab of a client or project: upload (drag & drop or pick), list, download, delete. */
export async function FilesPanel({
  entityType,
  entityId,
  emptyTitle,
  emptyBody,
}: {
  entityType: "client" | "project";
  entityId: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const session = await getSession();
  const t = await getTranslations("files");
  const f = formatter((await getLocale()) as Locale);
  const rows = await db
    .select({ file: files, by: users.name })
    .from(files)
    .leftJoin(users, eq(users.id, files.createdBy))
    .where(
      and(
        eq(files.workspaceId, session.workspaceId),
        eq(files.entityType, entityType),
        eq(files.entityId, entityId),
        isNull(files.archivedAt),
      ),
    )
    .orderBy(desc(files.createdAt));

  return (
    <div className="ax-card ax-card-body files-panel">
      <FileUploader entityType={entityType} entityId={entityId} />
      {rows.length === 0 ? (
        <EmptyState icon={Paperclip} title={emptyTitle} body={emptyBody} />
      ) : (
        <ul className="files-list">
          {rows.map(({ file, by }) => (
            <li key={file.id} className="files-row">
              <Paperclip className="ax-icon" aria-hidden />
              <span className="files-name">
                <a className="ax-link" href={`/api/files/${file.id}`} download>
                  {file.name}
                </a>
                <span className="ax-faint">
                  {kb(file.size)} · {by ?? "—"} · {f.date(file.createdAt)}
                </span>
              </span>
              {(file.createdBy === session.userId || can(session.role, "admin")) && (
                <FileRowDelete id={file.id} name={file.name} />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="ax-help">{t("limits")}</p>
    </div>
  );
}
