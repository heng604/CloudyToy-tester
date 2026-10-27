// Admin staff roles. Owners are the fixed emails in shared/admin.ts; the others are added on the Admin Permissions page.
export const ROLES = ["owner", "admin", "editor"] as const;
export type Role = (typeof ROLES)[number];
export const isRole = (v: unknown): v is Role => (ROLES as readonly unknown[]).includes(v);
export type Perm = "orders" | "products" | "pages" | "promotions" | "settings" | "staff";
const ALL: Perm[] = ["orders", "products", "pages", "promotions", "settings", "staff"];
const PERMS: Record<Role, Perm[]> = { owner: ALL, admin: ALL.filter((p) => p !== "staff"), editor: ["products", "pages"] };
/** Owner: everything. Admin: everything except managing staff. Editor: products, stock, categories and pages only. */
export const can = (role: Role | null | undefined, p: Perm) => !!role && PERMS[role].includes(p);
export const ROLE_NAME: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor" };
export const initialsOf = (name: string, email = "") => { const w = (name || email.split("@")[0] || "?").trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "?") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };
