import { useState, type FormEvent } from "react";
import Icon from "@/components/admin/Icons";
import Modal from "@/components/admin/Modal";
import Skeleton from "@/components/Skeleton";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTitle } from "@/lib/title";
import { initialsOf, ROLE_NAME, type Role } from "@shared/roles";
import { useAdmin, refreshAdmin } from "./hooks";
type Staff = { email: string; name: string; role: Role; active: boolean; lastActiveAt: string | null };
const ROLE_CLS: Record<Role, string> = { owner: "bg-[#EBE2FF] text-[#7A4FD0]", admin: "bg-[#DCEEFF] text-[#2F7FC6]", editor: "bg-[#FFF1C9] text-[#A97A0B]" };
const field = "w-full rounded-xl border border-sky-border bg-[#F3F9FE] px-3.5 py-2.5 outline-none";
const ago = (iso: string | null, t: (s: string, v?: Record<string, string | number>) => string) => {
  if (!iso) return t("Never"); const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return t("Just now"); if (s < 3600) return t("{n} minutes ago", { n: Math.round(s / 60) }); if (s < 86400) return t("{n} hours ago", { n: Math.round(s / 3600) }); return t("{n} days ago", { n: Math.round(s / 86400) });
};
function StaffModal({ s, me, onClose, onDone }: { s?: Staff; me: string; onClose: () => void; onDone: (m: { ok: boolean; text: string }) => void }) {
  const mine = !!s && s.email === me;
  const { t } = useI18n(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>, close: () => void) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(""); const f = new FormData(e.currentTarget);
    const body = s ? { email: s.email, name: f.get("name"), ...(f.get("role") ? { role: f.get("role"), active: f.get("active") === "on" } : {}) } : { email: f.get("email"), name: f.get("name"), role: f.get("role") };
    try { const j = await (await post(s ? "/admin/staff/update" : "/admin/staff/add", body)).json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (j.ok) { refreshAdmin(); onDone({ ok: true, text: s ? t("Saved") : t("Admin added") }); close(); return; } setErr(j.error ?? "Could not save. Please try again.");
    } catch { setErr("Could not reach the server. Please try again."); } finally { setBusy(false); }
  }
  return (<Modal icon="users" title={s ? t("Edit Admin") : t("Add New Admin")} onClose={onClose}>{(close) => (<form onSubmit={(e) => submit(e, close)} className="space-y-4 p-5 sm:p-7">
    {err && <p role="alert" className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{err}</p>}
    <label className="block text-sm font-bold">{t("Email")}<input name="email" type="email" required={!s} disabled={!!s} defaultValue={s?.email} maxLength={200} placeholder="name@example.com" className={`${field} mt-1 disabled:opacity-60`} /></label>
    <label className="block text-sm font-bold">{t("Full name")}<input name="name" maxLength={80} defaultValue={s?.name} className={`${field} mt-1`} /></label>
    <label className="block text-sm font-bold">{t("Role")}<select name="role" disabled={mine} defaultValue={s?.role ?? "editor"} className={`${field} mt-1 disabled:opacity-60`}><option value="owner">{t("Owner")}: {t("everything, including managing admins")}</option><option value="admin">{t("Admin")}: {t("everything except managing admins")}</option><option value="editor">{t("Editor")}: {t("products, stock, categories and pages")}</option></select></label>
    {s && <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" disabled={mine} defaultChecked={s.active} className="h-4 w-4" />{t("Active (can sign in to the admin area)")}</label>}
    {mine && <p className="rounded-xl bg-sky-pale p-3 text-xs text-mute">{t("You cannot change or remove your own access. Ask another owner.")}</p>}
    {!s && <p className="text-xs text-mute">{t("They sign in on the admin login page with this email (Google or email and password). The email must be verified.")}</p>}
    <div className="flex justify-end gap-3 border-t border-sky-border pt-4"><button type="button" onClick={close} className="rounded-xl border border-sky-border bg-white px-6 py-2.5 font-bold hover:bg-sky-pale">{t("Cancel")}</button><button disabled={busy} className="rounded-xl bg-sky px-6 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-50">{busy ? t("Saving…") : s ? t("Save changes") : t("Add New Admin")}</button></div>
  </form>)}</Modal>);
}
export default function StaffPage() {
  const { t } = useI18n(); useTitle(t("Admin Permissions"), true);
  const { data } = useAdmin<{ staff: Staff[]; me: string; ready?: boolean }>("/admin/staff"); const [edit, setEdit] = useState<Staff | "new" | null>(null); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return <Skeleton />;
  const del = async (s: Staff) => {
    try { const j = await (await post("/admin/staff/delete", { email: s.email })).json().catch(() => ({})) as { ok?: boolean; error?: string }; refreshAdmin(); setMsg(j.ok ? { ok: true, text: t("Admin removed") } : { ok: false, text: j.error ?? "Could not remove. Please try again." }); }
    catch { setMsg({ ok: false, text: "Could not reach the server. Please try again." }); }
  };
  const th = "px-4 py-3 text-xs font-bold uppercase tracking-wide text-mute";
  return (<div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">{t("Admin Staff & Permissions")}</h1><p className="text-sm text-mute">{t("Manage portal access, roles, and administrative staff accounts.")}</p></div>
      <button type="button" onClick={() => setEdit("new")} className="inline-flex items-center gap-2 rounded-xl bg-sky px-5 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover"><Icon name="plus" size={18} />{t("Add New Admin")}</button></div>
    {data.ready === false && <p role="alert" className="rounded-xl bg-amber-100 p-3 text-sm font-semibold text-amber-900">The staff table is not in your database yet, so only the owners are shown and adding staff is off. Open Supabase &gt; SQL Editor, paste <code>supabase/setup_all.sql</code>, click Run (safe to run again), then reload this page.</p>}
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 font-semibold ${msg.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-800"}`}>{msg.text}</p>}
    <div className="overflow-x-auto rounded-3xl bg-white shadow-soft"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-sky-border">{["User details", "Email", "Role", "Status", "Last active", ""].map((h, i) => <th key={i} className={`${th} ${i === 5 ? "text-right" : ""}`}>{h && t(h)}</th>)}</tr></thead>
      <tbody>{data.staff.map((s) => <tr key={s.email} className="border-b border-sky-border/70 last:border-0">
        <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-sky-pale text-xs font-extrabold text-sky-hover" aria-hidden="true">{initialsOf(s.name, s.email)}</span><span className="font-extrabold">{s.name || s.email.split("@")[0]}{s.email === data.me && <span className="ml-2 text-xs font-semibold text-mute">({t("you")})</span>}</span></div></td>
        <td className="px-4 py-3 font-mono text-xs">{s.email}</td>
        <td className="px-4 py-3"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${ROLE_CLS[s.role]}`}>{t(ROLE_NAME[s.role])}</span></td>
        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.active ? "bg-[#DDF6E8] text-[#2F8F5B]" : "bg-[#FFE3E8] text-[#C0304F]"}`}>● {s.active ? t("Active") : t("Inactive")}</span></td>
        <td className="px-4 py-3 text-mute">{ago(s.lastActiveAt, t)}</td>
        <td className="px-4 py-3"><div className="flex items-center justify-end gap-4 font-bold"><button type="button" onClick={() => setEdit(s)} className="text-sky-hover hover:underline">{t("Edit")}</button>{s.email !== data.me && <button type="button" onClick={() => del(s)} className="text-[#E0456B] hover:underline">{t("Delete")}</button>}</div></td></tr>)}</tbody></table></div>
    {edit && <StaffModal key={edit === "new" ? "new" : edit.email} me={data.me} s={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onDone={setMsg} />}
  </div>);
}
