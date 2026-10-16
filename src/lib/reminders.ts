/** DS › Payments › reminders: at the due date, then +3, +7 and +14 days. */
export const REMINDER_OFFSETS = [0, 3, 7, 14] as const;

export type ReminderStep = {
  offset: number;
  date: string;
  state: "sent" | "due" | "upcoming" | "skipped";
  sentAt: Date | null;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Steps of an invoice's reminder schedule. Each logged reminder fulfils the latest step whose
 * date had come when it was sent (and that comes after the previous match); steps it jumped over
 * are "skipped" — so a late reminder catches up instead of leaving older steps owing. A step
 * whose date has come without a reminder is "due"; a future one is "upcoming".
 */
export function reminderSchedule(dueDate: string, sent: Date[], now: Date = new Date()): ReminderStep[] {
  const today = localDay(now);
  const steps: ReminderStep[] = REMINDER_OFFSETS.map((offset) => {
    const date = addDays(dueDate, offset);
    return { offset, date, state: date <= today ? "due" : "upcoming", sentAt: null };
  });
  let last = -1;
  for (const at of [...sent].sort((a, b) => a.getTime() - b.getTime())) {
    const day = localDay(at);
    let match = -1;
    for (let i = steps.length - 1; i > last; i--) {
      if (steps[i]!.date <= day) {
        match = i;
        break;
      }
    }
    if (match < 0) continue;
    for (let i = last + 1; i < match; i++) steps[i]!.state = "skipped";
    steps[match] = { ...steps[match]!, state: "sent", sentAt: at };
    last = match;
  }
  return steps;
}
