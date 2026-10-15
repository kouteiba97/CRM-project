/** Task completion when the project has tasks, otherwise milestone completion (0–1). */
export function progressOf(p: { tasksTotal: number; tasksDone: number; milestonesTotal: number; milestonesDone: number }) {
  if (p.tasksTotal > 0) return p.tasksDone / p.tasksTotal;
  if (p.milestonesTotal > 0) return p.milestonesDone / p.milestonesTotal;
  return 0;
}
