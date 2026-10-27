import { useI18n } from "@/lib/i18n";
import { useSearchParams } from "react-router-dom";
import { PAGE_DEFS, MAX_CONTENT, type PageData, type PageSlug } from "@shared/pages";
import DeleteButton from "@/components/admin/DeleteButton";
import Skeleton from "@/components/Skeleton";
import { post } from "@/lib/api";
import { useTitle } from "@/lib/title";
import { useAdmin, refreshAdmin, Msg } from "./hooks";
export default function AdminPages() {
  const { t } = useI18n(); useTitle(t("Pages"), true);
  const [sp, setSp] = useSearchParams(); const { data } = useAdmin<{ pages: Record<PageSlug, PageData> }>("/admin/pages");
  if (!data) return <Skeleton />;
  const pages = data.pages;
  const done = async (r: Response, ok: Record<string, string>) => { const j = await r.json().catch(() => ({})) as { ok?: boolean; error?: string }; refreshAdmin(); setSp(j.ok ? ok : { error: j.error ?? "Could not save" }); window.scrollTo({ top: 0 }); };
  return (<div className="max-w-3xl space-y-6"><h1 className="text-2xl font-extrabold sm:text-3xl">{t("Pages")}</h1>
    <p className="text-sm text-mute">Write the text of your shop pages here. Use a line starting with <code>## </code> for a heading, and a blank line between paragraphs. Plain text only. The Contact page also shows your Telegram, Facebook (set in Settings) and email buttons automatically. Shipping Policy and Pre-Order FAQ are the policy pages linked in the footer (the Pre-Order FAQ also shows your current deposit % and dispatch time from Promotions automatically). Deleting a page hides it and removes its footer link; you can restore it any time.</p>
    <Msg ok={sp.get("saved") ? "Saved" : sp.get("deleted") ? "Page deleted (hidden from the shop)" : null} err={sp.get("error")} />
    {PAGE_DEFS.map((d) => { const p = pages[d.slug]; return (<section key={d.slug} className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{d.title}{p.deleted && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Deleted</span>}</h2>
        <div className="flex gap-2"><a href={`/${d.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-sky-border px-4 py-2 text-sm font-bold hover:bg-sky-pale">View page</a>
          {d.deletable && (p.deleted ? <button onClick={async () => done(await post(`/admin/pages/${d.slug}/restore`), { saved: d.slug })} className="rounded-full border border-sky-border px-4 py-2 text-sm font-bold hover:bg-sky-pale">Restore</button>
            : <DeleteButton action={async () => done(await post(`/admin/pages/${d.slug}/delete`), { deleted: d.slug })} message={`Delete the ${d.title} page? It will be hidden from the shop and its footer link removed.`} />)}</div></div>
      <form key={p.content + p.deleted} onSubmit={async (e) => { e.preventDefault(); done(await post("/admin/pages/save", { slug: d.slug, content: new FormData(e.currentTarget).get("content") }), { saved: d.slug }); }} className="space-y-2">
        <textarea name="content" rows={d.slug === "about" ? 14 : 8} maxLength={MAX_CONTENT} defaultValue={p.content} placeholder={`Write the ${d.title} page here…`} className="w-full rounded-xl border border-sky-border bg-white px-4 py-3" />
        <button className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover">{p.deleted ? "Save and restore" : "Save"}</button></form></section>); })}</div>);
}
