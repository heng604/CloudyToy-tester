/** The ONLY accounts allowed into the admin area. Not configurable from env on purpose. */
export const ADMIN_EMAILS = ["toyscloudy@gmail.com", "seangheng2006@gmail.com"];
/** Primary admin address, used as the public contact / notification fallback. */
export const ADMIN_EMAIL = ADMIN_EMAILS[0];
export function isAdminEmail(email: string | null | undefined, verified: boolean | undefined, allowlist: string = ADMIN_EMAILS.join(",")): boolean {
  if (!email || !verified) return false;
  return allowlist.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
