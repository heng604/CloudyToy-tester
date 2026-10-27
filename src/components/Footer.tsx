import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/store";
import { TELEGRAM_FALLBACK } from "@/lib/supabase";
const link = "whitespace-nowrap transition hover:text-[#1F4E9C] hover:underline";
const Dot = () => <span aria-hidden="true" className="hidden h-3 w-px bg-[#B9D2EC] sm:block" />;
const Social = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 whitespace-nowrap transition hover:text-[#1F4E9C] hover:underline">{children}{label}</a>);
/** Brand icons (round, 24 px) for the three social links. */
const TelegramIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#2AABEE" /><path fill="#fff" d="M18.500 6 5.300 11.200c-.5.200-.5.600 0 .8l3.300 1 1.300 4c.1.300.5.400.7.200l1.900-1.800 3.400 2.500c.4.300.9.100 1-.4L19.400 6.900c.1-.7-.4-1.100-.9-.9z" /><path d="M9 13.200l7.500-4.700" stroke="#2AABEE" strokeWidth="1" strokeLinecap="round" fill="none" /></svg>;
const InstagramIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".35" stopColor="#FA7E1E" /><stop offset=".65" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs><rect width="24" height="24" rx="7" fill="url(#ig-grad)" /><rect x="5.500" y="5.500" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.600" /><circle cx="12" cy="12" r="3.100" fill="none" stroke="#fff" strokeWidth="1.600" /><circle cx="16.100" cy="7.900" r=".9" fill="#fff" /></svg>;
const FacebookIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path fill="#fff" d="M13.400 19.500v-6.300h2.100l.4-2.500h-2.500V9.100c0-.7.300-1.300 1.400-1.300h1.200V5.600s-1-.2-2-.2c-2.100 0-3.400 1.200-3.400 3.500v1.800H8.500v2.500h2.100v6.300z" /></svg>;
/** Footer: a small row with the shop links on top, then one row with logo, tagline, policy links, social links and copyright. Policy pages are written by the admin in Admin > Pages. */
export default function Footer({ logoUrl = "/img/logo.png", hidden = [] }: { logoUrl?: string; hidden?: string[] }) {
  const { t } = useI18n(); const { settings: s } = useSettings(); const tg = s.telegramUrl || TELEGRAM_FALLBACK;
  return (<footer className="mt-10 border-t border-sky-border bg-gradient-to-b from-[#E8F3FF] to-[#F6FBFF] text-xs text-[#2F4D7A] sm:mt-16">
    <div className="border-b border-[#D5E6F8]"><div className="page-wrap flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2.5">
      <Link to="/shop" className={link}>{t("All Product")}</Link><Link to="/cart" className={link}>{t("Cart")}</Link><Link to="/account" className={link}>{t("My account")}</Link><Link to="/about" className={link}>{t("About")}</Link><Link to="/admin/login" className={link}>{t("Admin login")}</Link></div></div>
    <div className="page-wrap flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-4 lg:justify-between">
      <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Cloudy Toys"><img src={logoUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" /><span className="font-['Caveat'] text-3xl font-bold text-[#1F4E9C]">Cloudy Toys</span></Link>
      <span aria-hidden="true" className="hidden h-10 w-px bg-[#B9D2EC] lg:block" />
      <p className="max-w-[17rem] text-center leading-snug lg:text-left">{t("Thoughtfully chosen toys for every age, delivered across Cambodia.")} <span aria-hidden="true">🇰🇭</span></p>
      <nav aria-label="Policies and contact" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {!hidden.includes("shipping") && <Link to="/shipping" className={link}>{t("Shipping Policy")}</Link>}
        {!hidden.includes("shipping") && !hidden.includes("preorder") && <Dot />}
        {!hidden.includes("preorder") && <Link to="/preorder" className={link}>{t("Pre-Order FAQ")}</Link>}
        {!hidden.includes("contact") && <><Dot /><Link to="/contact" className={link}>{t("Contact Us")}</Link></>}
        {tg && <><Dot /><Social href={tg} label="Telegram"><TelegramIcon /></Social></>}
        {s.instagramUrl && <><Dot /><Social href={s.instagramUrl} label="Instagram"><InstagramIcon /></Social></>}
        {s.facebookUrl && <><Dot /><Social href={s.facebookUrl} label="Facebook"><FacebookIcon /></Social></>}
      </nav>
      <span className="text-center">© {new Date().getFullYear()} Cloudy Toys. {t("All rights reserved.")}</span>
    </div>
  </footer>);
}
