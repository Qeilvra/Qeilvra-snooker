import type { AppRole } from "@/types/domain";

export type Permission =
  | "tables.manage" | "sessions.use" | "bookings.manage" | "pos.use"
  | "inventory.manage" | "reports.view" | "staff.manage" | "expenses.manage"
  | "settings.manage" | "discounts.apply" | "refunds.create";

const grants: Record<AppRole, ReadonlySet<Permission>> = {
  owner: new Set(["tables.manage","sessions.use","bookings.manage","pos.use","inventory.manage","reports.view","staff.manage","expenses.manage","settings.manage","discounts.apply","refunds.create"]),
  manager: new Set(["tables.manage","sessions.use","bookings.manage","pos.use","inventory.manage","reports.view","staff.manage","expenses.manage","settings.manage","discounts.apply","refunds.create"]),
  staff: new Set(["sessions.use","bookings.manage","pos.use"]),
};

export function can(role: AppRole, permission: Permission) {
  return grants[role].has(permission);
}
