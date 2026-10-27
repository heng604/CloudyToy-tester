import CheckoutForm from "@/components/CheckoutForm";
import RequireUser from "@/components/RequireUser";
import Skeleton from "@/components/Skeleton";
import { useProducts, useSettings } from "@/lib/store";
import { useTitle } from "@/lib/title";
import { useI18n } from "@/lib/i18n";
import { isPreorder, nameFor } from "@shared/products";
export default function Checkout() {
  useTitle("Checkout");
  const { data: all } = useProducts(); const { settings: s } = useSettings(); const { lang } = useI18n();
  if (!all) return <Skeleton />;
  const products = all.map((p) => ({ id: p.id, name: nameFor(p, lang), price: p.price, salePrice: p.salePrice, category: p.category, preorder: isPreorder(p) }));
  return <RequireUser allowAdmin>{() => <CheckoutForm fees={{ pp: s.shipPhnomPenhCents, prov: s.shipProvinceCents }} products={products} telegram={s.telegramUrl} facebook={s.facebookUrl} />}</RequireUser>;
}
