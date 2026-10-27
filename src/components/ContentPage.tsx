import { usePages, useSettings, usePromotions } from "@/lib/store";
import { PAGE_DEFS, type PageSlug } from "@shared/pages";
import { ADMIN_EMAIL } from "@shared/admin";
import { ADMIN_INBOX, TELEGRAM_FALLBACK } from "@/lib/supabase";
import { useTitle } from "@/lib/title";
import NotFound from "./NotFound";

const card = "group flex items-center gap-4 rounded-xl2 border border-sky-border bg-white p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift";
const icon = "grid h-12 w-12 shrink-0 place-items-center rounded-full";

/** Public page whose text is written by the admin. "## Heading" makes a heading; blank lines separate paragraphs. Plain text only (no HTML). */
export default function ContentPage({ slug, title }: { slug: PageSlug; title: string }) {
  useTitle(title);
  const { page: getPage, loading } = usePages(); const { settings: s } = useSettings(); const { promotions } = usePromotions();
  const def = PAGE_DEFS.find((d) => d.slug === slug)!;
  const page = getPage(def.slug);
  if (!page) return loading ? <div className="max-w-2xl animate-pulse space-y-4"><div className="h-9 w-48 rounded-full bg-sky-pale" /><div className="h-4 w-full rounded-full bg-sky-pale" /><div className="h-4 w-3/4 rounded-full bg-sky-pale" /></div> : null;
  if (page.deleted) return <NotFound />;
  const isContact = slug === "contact"; const mail = ADMIN_INBOX || ADMIN_EMAIL;
  // Admin sets the link in Admin > Settings. VITE_TELEGRAM_URL is an optional fallback (e.g. https://t.me/your_username).
  const telegram = isContact ? s.telegramUrl || TELEGRAM_FALLBACK : "";
  const blocks = page.content.trim().split(/\n\s*\n/).filter(Boolean);
  return (<div className="max-w-2xl space-y-4"><h1 className="text-3xl font-extrabold">{def.title}</h1>
    {blocks.length === 0 ? <p className="text-mute">This page has not been written yet.</p> : blocks.map((b, i) => b.startsWith("## ")
      ? <h2 key={i} className="pt-2 text-xl font-extrabold">{b.slice(3).trim()}</h2>
      : <p key={i} className="whitespace-pre-line leading-relaxed text-ink">{b}</p>)}
    {slug === "preorder" && <div className="rounded-xl2 bg-[#FFF6D8] p-4 text-sm"><p className="font-extrabold">Pre-order at a glance</p><ul className="mt-1 list-disc space-y-0.5 pl-5"><li>Deposit at checkout: <b>{promotions.preorder.depositPercent}%</b></li><li>Estimated dispatch: <b>{promotions.preorder.dispatchText}</b></li><li>Pre-orders are paid online (no pay-with-delivery).</li></ul></div>}
    {isContact && (
      <div className="space-y-3 pt-4">
        {telegram && (
          <a href={telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl2 bg-[#1B8BBF] p-5 text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <span className={`${icon} bg-white text-[#1B8BBF]`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </span>
            <span className="flex-1">
              <span className="block text-lg font-extrabold">Chat with our admin on Telegram</span>
              <span className="block text-sm opacity-90">Fastest way to reach us. Please include your order number.</span>
            </span>
            <span aria-hidden="true" className="text-2xl transition group-hover:translate-x-1">→</span>
          </a>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {s.facebookUrl && (
            <a href={s.facebookUrl} target="_blank" rel="noopener noreferrer" className={card}>
              <span className={`${icon} bg-sky-pale`}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.5c0-.7.3-1 1-1h2V2h-3c-3 0-4 2-4 4v2H8v3.5h2V22h4v-10.5h2.7L17.5 8z" /></svg></span>
              <span><span className="block font-extrabold">Facebook page</span><span className="block text-sm text-mute">Message us or follow</span></span>
            </a>
          )}
          <a href={`mailto:${mail}`} className={card}>
            <span className={`${icon} bg-sky-pale`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span>
            <span className="min-w-0"><span className="block font-extrabold">Email</span><span className="block truncate text-sm text-mute">{mail}</span></span>
          </a>
        </div>
      </div>
    )}</div>);
}
