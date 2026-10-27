// Pure rules for pre-orders and automatic discounts (no I/O). Amounts are integer cents.
// Stored by the admin in site_settings (key "promotions"); the server recomputes everything at checkout.
/** Global pre-order rules. The open date and deadline are NOT here: each pre-order product has its own (see shared/products.ts). */
export type PreorderRules = { depositPercent: number; dispatchText: string; capSlots: number };
export const DEFAULT_PREORDER: PreorderRules = { depositPercent: 50, dispatchText: "10 - 14 Business Days", capSlots: 50 };
export type CampaignKind = "spend_amount" | "spend_percent" | "category_percent";
export const CAMPAIGN_KINDS: CampaignKind[] = ["spend_amount", "spend_percent", "category_percent"];
export type Campaign = { id: string; name: string; kind: CampaignKind; minSpendCents: number; amountCents: number; percent: number; category: string; active: boolean; createdAt: string };
export type Promotions = { preorder: PreorderRules; campaigns: Campaign[] };
export const DEFAULT_PROMOTIONS: Promotions = { preorder: DEFAULT_PREORDER, campaigns: [] };
export const MAX_CAMPAIGNS = 20;
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const int = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
/** Validates the "Pre-Order Global Rules" form. */
export function checkPreorder(i: { depositPercent: unknown; dispatchText: unknown; capSlots: unknown }): Checked<PreorderRules> {
  const depositPercent = int(i.depositPercent), capSlots = int(i.capSlots), dispatchText = String(i.dispatchText ?? "").trim();
  if (!Number.isInteger(depositPercent) || depositPercent < 1 || depositPercent > 100) return { ok: false, error: "Required deposit must be a whole number from 1 to 100" };
  if (dispatchText.length < 2 || dispatchText.length > 60) return { ok: false, error: "Estimated dispatch timeline needs 2 to 60 characters (e.g. 10 - 14 Business Days)" };
  if (!Number.isInteger(capSlots) || capSlots < 1 || capSlots > 100000) return { ok: false, error: "Pre-order cap slot limit must be a whole number from 1 to 100000" };
  return { ok: true, value: { depositPercent, dispatchText, capSlots } };
}
/** Validates the "Add Campaign" form (dollars in, cents out). */
export function checkCampaign(i: { name: unknown; kind: unknown; minSpend?: unknown; amount?: unknown; percent?: unknown; category?: unknown }): Checked<Omit<Campaign, "id" | "active" | "createdAt">> {
  const name = String(i.name ?? "").trim(), kind = i.kind as CampaignKind;
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Campaign name needs 2 to 60 characters" };
  if (!CAMPAIGN_KINDS.includes(kind)) return { ok: false, error: "Choose a campaign type" };
  const minSpendCents = kind === "category_percent" ? 0 : Math.round(int(i.minSpend ?? 0) * 100), amountCents = Math.round(int(i.amount ?? 0) * 100), percent = int(i.percent ?? 0), category = String(i.category ?? "").trim();
  if (kind !== "category_percent" && (!Number.isFinite(minSpendCents) || minSpendCents < 0 || minSpendCents > 10_000_000)) return { ok: false, error: "Minimum spend must be $0 or more" };
  if (kind === "spend_amount" && (!Number.isFinite(amountCents) || amountCents < 1 || amountCents > 10_000_000)) return { ok: false, error: "Discount amount must be more than $0" };
  if (kind === "spend_amount" && minSpendCents > 0 && amountCents >= minSpendCents) return { ok: false, error: "Discount amount must be smaller than the minimum spend" };
  if (kind !== "spend_amount" && (!Number.isInteger(percent) || percent < 1 || percent > 90)) return { ok: false, error: "Discount % must be a whole number from 1 to 90" };
  if (kind === "category_percent" && (category.length < 1 || category.length > 40)) return { ok: false, error: "Choose the category this discount applies to" };
  return { ok: true, value: { name, kind, minSpendCents, amountCents: kind === "spend_amount" ? amountCents : 0, percent: kind === "spend_amount" ? 0 : percent, category: kind === "category_percent" ? category : "" } };
}
/** Reads whatever is stored (old, missing or hand-edited data) and always returns a valid Promotions. */
export function normalizePromotions(v: unknown): Promotions {
  const o = (v && typeof v === "object" ? v : {}) as { preorder?: Partial<PreorderRules>; campaigns?: unknown };
  const pre = checkPreorder({ ...DEFAULT_PREORDER, ...(o.preorder ?? {}) });
  const campaigns = (Array.isArray(o.campaigns) ? o.campaigns : []).flatMap((c): Campaign[] => {
    const x = c as Partial<Campaign>; if (!x || typeof x.id !== "string" || !CAMPAIGN_KINDS.includes(x.kind as CampaignKind)) return [];
    const chk = checkCampaign({ name: x.name, kind: x.kind, minSpend: (x.minSpendCents ?? 0) / 100, amount: (x.amountCents ?? 0) / 100, percent: x.percent, category: x.category });
    return chk.ok ? [{ ...chk.value, id: x.id, active: x.active !== false, createdAt: String(x.createdAt ?? "") }] : [];
  }).slice(0, MAX_CAMPAIGNS);
  return { preorder: pre.ok ? pre.value : DEFAULT_PREORDER, campaigns };
}
/** Text shown under the campaign name in the admin list and in the shop. */
export function campaignDetail(c: Campaign): string {
  if (c.kind === "spend_amount") return c.minSpendCents > 0 ? `Orders of ${usd(c.minSpendCents)} or more get ${usd(c.amountCents)} off` : `${usd(c.amountCents)} off every order`;
  if (c.kind === "spend_percent") return c.minSpendCents > 0 ? `Orders of ${usd(c.minSpendCents)} or more get ${c.percent}% off` : `${c.percent}% off every order`;
  return `${c.percent}% off all ${c.category} products`;
}
export type AutoDiscount = { id: string; name: string; cents: number };
/** Automatic discounts for a cart. All active campaigns that match stack, and never take off more than the subtotal. Delivery is never discounted. */
export function autoDiscounts(lines: { category: string; lineCents: number }[], campaigns: Campaign[]): AutoDiscount[] {
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0); let left = subtotal; const out: AutoDiscount[] = [];
  for (const c of campaigns) {
    if (!c.active) continue; let cents = 0;
    if (c.kind === "spend_amount") cents = subtotal >= c.minSpendCents ? c.amountCents : 0;
    else if (c.kind === "spend_percent") cents = subtotal >= c.minSpendCents ? Math.round((subtotal * c.percent) / 100) : 0;
    else { const base = lines.filter((l) => l.category.trim().toLowerCase() === c.category.trim().toLowerCase()).reduce((s, l) => s + l.lineCents, 0); cents = Math.round((base * c.percent) / 100); }
    cents = Math.min(cents, left); if (cents > 0) { out.push({ id: c.id, name: c.name, cents }); left -= cents; }
  }
  return out;
}
export const autoTotal = (d: AutoDiscount[]) => d.reduce((s, x) => s + x.cents, 0);
/** Pre-order orders pay only this deposit now (or the full price when `full` is true: the customer's choice at checkout); any rest is paid when the order is dispatched. */
export function preorderSplit(totalCents: number, rules: PreorderRules, full = false) {
  const depositCents = full ? totalCents : Math.min(totalCents, Math.max(1, Math.ceil((totalCents * rules.depositPercent) / 100)));
  return { percent: full ? 100 : rules.depositPercent, ...(full ? { full: true } : {}), depositCents, balanceCents: totalCents - depositCents, dispatch: rules.dispatchText };
}
