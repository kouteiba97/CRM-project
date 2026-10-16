/**
 * Workspace roles. Owner: everything, including deleting the workspace and transferring
 * ownership. Admin: team, workspace details, voiding invoices, data export. Member: day-to-day
 * work (clients, leads, projects, tasks, documents, payments).
 */
export type Role = "owner" | "admin" | "member";
export const ROLES: Role[] = ["owner", "admin", "member"];
export const ACTIVE_WORKSPACE_COOKIE = "ws";

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };
export const can = (role: Role, min: Role) => RANK[role] >= RANK[min];
