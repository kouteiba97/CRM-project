"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { Modal } from "@/components/ui/Modal";
import { deleteFile } from "./file-actions";

const MAX = 4 * 1024 * 1024;

/** Drop zone + "Choose files": uploads one by one with a toast per file. */
export function FileUploader({ entityType, entityId }: { entityType: string; entityId: string }) {
  const t = useTranslations("files");
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const upload = async (list: FileList | File[]) => {
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > MAX) {
        toast({ tone: "danger", title: t("error_size", { name: file.name }) });
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      body.set("entityType", entityType);
      body.set("entityId", entityId);
      const res = await fetch("/api/files", { method: "POST", body }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (json?.ok) toast({ tone: "success", title: t("uploaded", { name: file.name }) });
      else {
        const code = ["size", "type", "storage", "invalid", "forbidden"].includes(json?.error ?? "") ? json!.error! : "storage";
        toast({ tone: "danger", title: t(`error_${code}` as "error_storage", { name: file.name }) });
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div
      className={`files-drop${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
      <Upload className="ax-icon" aria-hidden />
      <span>{t("drop")}</span>
      <label className="ax-btn ax-btn-secondary ax-btn-sm">
        {busy ? <span className="ax-spinner" aria-hidden /> : null}
        {t("choose")}
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => e.target.files?.length && void upload(e.target.files)}
        />
      </label>
    </div>
  );
}

export function FileRowDelete({ id, name }: { id: string; name: string }) {
  const t = useTranslations("files");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon" aria-label={t("deleteOf", { name })} onClick={() => setOpen(true)}>
        <Trash2 className="ax-icon" aria-hidden />
      </button>
      {open && (
        <Modal
          title={t("deleteTitle", { name })}
          size="sm"
          submitLabel={t("delete")}
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={() =>
            start(async () => {
              const res = await deleteFile(id);
              setOpen(false);
              toast(res.ok ? { tone: "success", title: t("deleted", { name }) } : { tone: "danger", title: t("error_forbidden") });
              router.refresh();
            })
          }
        >
          <p>{t("deleteBody")}</p>
        </Modal>
      )}
    </>
  );
}
