import CartView from "@/components/CartView";
import Skeleton from "@/components/Skeleton";
import { useProducts, useSettings } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { isPreorder, nameFor } from "@shared/products";
import { TELEGRAM_FALLBACK } from "@/lib/supabase";
import { useTitle } from "@/lib/title";
export default function Cart() {
  useTitle("Cart");
  const { data: all } = useProducts(); const { settings: s } = useSettings(); const { lang } = useI18n();
  if (!all) return <Skeleton />;
  const products = all.map((p) => ({ id: p.id, name: nameFor(p, lang), price: p.price, salePrice: p.salePrice, slug: p.slug, image: p.images[0]?.src, category: p.category, stock: p.stock, preorder: isPreorder(p), ...(isPreorder(p) ? { preorderStart: p.preorderStart, preorderEnd: p.preorderEnd } : {}) }));
  return <CartView products={products} telegram={s.telegramUrl || TELEGRAM_FALLBACK} />;
}
