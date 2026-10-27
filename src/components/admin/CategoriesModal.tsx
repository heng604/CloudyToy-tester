import { useState, type FormEvent } from "react";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAdmin, refreshAdmin } from "@/pages/admin/hooks";
import Modal from "./Modal";
type Cat = { name: string; count: number };
/** "Manage Categories": add a category, rename one (renaming to an existing name merges them), or delete an empty one. */
export default function CategoriesModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n(); const { data } = useAdmin<{ categories: Cat[] }>("/admin/categories");
  const [name, setName] = useState(""); const [edit, setEdit] = useState<{ from: string; to: string } | null>(null); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  async function run(path: string, body: object, ok: string) {
    if (busy) return false; setBusy(true); setMsg(null);
    try { const j = await (await post(path, body)).json().catch(() => ({})) as { ok?: boolean; error?: string }; if (j.ok) { refreshAdmin(); setMsg({ ok: true, text: ok }); return true; } setMsg({ ok: false, text: j.error ?? "Could not save. Please try again." }); }
    catch { setMsg({ ok: false, text: "Could not reach the server. Please try again." }); } finally { setBusy(false); } return false;
  }
  const add = async (e: FormEvent) => { e.preventDefault(); if (await run("/admin/categories/add", { name }, t("Category added"))) setName(""); };
  const inp = "min-w-0 flex-1 rounded-xl border border-sky-border bg-[#F3F9FE] px-3.5 py-2.5 outline-none";
  return (<Modal icon="folder" title={t("Manage Categories")} onClose={onClose}>{() => (<div className="space-y-4 p-5 sm:p-7">
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-800"}`}>{msg.text}</p>}
    <form onSubmit={add} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder={t("New category name")} aria-label={t("New category name")} className={inp} /><button disabled={busy} className="rounded-xl bg-sky px-5 py-2.5 font-extrabold hover:bg-sky-hover disabled:opacity-50">{t("Add")}</button></form>
    {!data ? <p className="text-mute">…</p> : data.categories.length === 0 ? <p className="rounded-xl border border-dashed border-sky-border p-4 text-center text-sm text-mute">{t("No categories yet.")}</p>
      : <ul className="divide-y divide-sky-border rounded-2xl border border-sky-border">{data.categories.map((c) => <li key={c.name} className="flex flex-wrap items-center gap-2 p-3 text-sm">
        {edit?.from === c.name ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run("/admin/categories/rename", edit, t("Category renamed"))) setEdit(null); }}>
          <input autoFocus value={edit.to} onChange={(e) => setEdit({ from: c.name, to: e.target.value })} maxLength={40} required aria-label={t("New category name")} className={inp} /><button disabled={busy} className="rounded-lg bg-sky px-3 font-bold">{t("Save")}</button><button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-sky-border px-3 font-bold">{t("Cancel")}</button></form>
          : <><span className="min-w-0 flex-1 truncate font-bold">{c.name}</span><span className="text-xs text-mute">{t("{n} products", { n: c.count })}</span>
            <button type="button" onClick={() => setEdit({ from: c.name, to: c.name })} className="font-bold text-sky-hover hover:underline">{t("Edit")}</button>
            <button type="button" onClick={() => { if (confirm(`Delete the category "${c.name}"?`)) void run("/admin/categories/delete", { name: c.name }, t("Category deleted")); }} className="font-bold text-[#E0456B] hover:underline">{t("Delete")}</button></>}</li>)}</ul>}
    <p className="text-xs text-mute">{t("Renaming a category to a name that already exists merges them. A category with products cannot be deleted.")}</p>
  </div>)}</Modal>);
}
