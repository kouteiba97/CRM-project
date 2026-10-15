"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { record: string | null; setRecord: (v: string | null) => void };
const CrumbContext = createContext<Ctx>({ record: null, setRecord: () => {} });

/** Holds the record name a page adds after the module crumb (Dashboard › Clients › Media Pro). */
export function CrumbProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<string | null>(null);
  return <CrumbContext.Provider value={{ record, setRecord }}>{children}</CrumbContext.Provider>;
}

export const useRecordCrumb = () => useContext(CrumbContext).record;

/** Rendered by a record page; the crumb disappears when the page unmounts. */
export function RecordCrumb({ label }: { label: string }) {
  const { setRecord } = useContext(CrumbContext);
  useEffect(() => {
    setRecord(label);
    return () => setRecord(null);
  }, [label, setRecord]);
  return null;
}
