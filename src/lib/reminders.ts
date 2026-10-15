/** DS › Payments › reminders: at the due date, then +3, +7 and +14 days. */
export const REMINDER_OFFSETS = [0, 3, 7, 14] as const;

export type ReminderStep = { offset: number; date: string; state: "sent" | "due" | "upcoming"; sentAt: Date | null };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Steps of an invoice's reminder schedule. Logged reminders are matched to steps in order: a reminder
 * sent on or after a step's date (and before the next match) fulfils it. A step whose date has come
 * without a reminder is "due"; a future one is "upcoming".
 */
export function reminderSchedule(dueDate: string, sent: Date[], now: Date = new Date()): ReminderStep[] {
  const today = localDay(now);
  const pool = [...sent].sort((a, b) => a.getTime() - b.getTime());
  return REMINDER_OFFSETS.map((offset) => {
    const date = addDays(dueDate, offset);
    const i = pool.findIndex((s) => localDay(s) >= date);
    if (i >= 0) {
      const [hit] = pool.splice(i, 1);
      return { offset, date, state: "sent" as const, sentAt: hit! };
    }
    return { offset, date, state: date <= today ? ("due" as const) : ("upcoming" as const), sentAt: null };
  });
}
