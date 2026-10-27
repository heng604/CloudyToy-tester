// Bakong KHQR: builds a dynamic QR for one order and asks Bakong whether it was paid. The ONLY way a Bakong order becomes PAID is checkPaid() returning ok.
import QRCode from "qrcode";
// @ts-ignore the package ships no types (CommonJS: the default import is module.exports; works in Node and in the Workers bundle, unlike createRequire)
import khqrPkg from "bakong-khqr";
const { BakongKHQR, khqrData, IndividualInfo } = khqrPkg as any;
export const QR_MINUTES = 5;
/** A customer gets this many QR codes per order (a new one is made automatically when one expires). After the last one runs out the order is cancelled and its stock goes back to the shop. */
export const QR_MAX = 3;
/** An abandoned order (no new QR requested this long after the last QR expired) is cancelled and its stock released. */
export const QR_GRACE_MS = 5 * 60_000;
const cfg = () => ({
  account: (process.env.BAKONG_ACCOUNT_ID ?? "").trim(), // your Bakong account id, e.g. yourname@aba
  token: (process.env.BAKONG_API_TOKEN ?? "").trim(), // Bakong Open API token (https://api-bakong.nbc.gov.kh/register)
  name: (process.env.BAKONG_MERCHANT_NAME ?? "Cloudy Toys").trim().slice(0, 25),
  city: (process.env.BAKONG_MERCHANT_CITY ?? "Phnom Penh").trim().slice(0, 15),
  api: (process.env.BAKONG_API_URL ?? "https://api-bakong.nbc.gov.kh").trim().replace(/\/$/, ""),
  relay: (process.env.BAKONG_RELAY_URL ?? "").trim().replace(/\/$/, ""), // optional: small relay running on a computer inside Cambodia (tools/bakong-relay.mjs), for hosts abroad such as Vercel
  relaySecret: (process.env.BAKONG_RELAY_SECRET ?? "").trim(),
});
export const bakongEnabled = () => { const c = cfg(); return !!c.account && !!c.token; };
export const bakongAccount = () => cfg().account;
export const bakongName = () => cfg().name;
/** KHQR string + md5 + PNG data-URL for an exact USD amount. */
export async function makeKhqr(orderNumber: string, totalCents: number, reuseExpiresAt?: number) {
  const c = cfg(); const expiresAt = reuseExpiresAt ?? Date.now() + QR_MINUTES * 60_000; // same expiry = the very same QR (a page reload does not use up one of the customer's QR codes)
  const info = new IndividualInfo(c.account, c.name, c.city, { currency: khqrData.currency.usd, amount: totalCents / 100, billNumber: orderNumber, expirationTimestamp: expiresAt });
  const r = new BakongKHQR().generateIndividual(info);
  if (!r?.data?.qr || !r.data.md5) throw new Error(`KHQR failed: ${r?.status?.message ?? "unknown"}`);
  const image = await QRCode.toDataURL(r.data.qr, { errorCorrectionLevel: "M", margin: 1, width: 560 });
  return { qr: r.data.qr as string, md5: r.data.md5 as string, expiresAt, image };
}
/** One call to Bakong "check transaction": directly, or through the Cambodian relay when BAKONG_RELAY_URL is set. */
function callCheck(md5: string, ms: number): Promise<Response> {
  const c = cfg(); const signal = AbortSignal.timeout(ms);
  if (c.relay) return fetch(`${c.relay}/check`, { method: "POST", signal, headers: { "Content-Type": "application/json", "x-relay-secret": c.relaySecret }, body: JSON.stringify({ md5 }) });
  return fetch(`${c.api}/v1/check_transaction_by_md5`, { method: "POST", signal, headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ md5 }) });
}
export type PaidCheck = { ok: true; hash?: string } | { ok: false; reason: "NOT_FOUND" | "MISMATCH" | "ERROR"; detail?: string };
/** Asks Bakong about one QR (by md5). Amount, currency and receiving account must ALL match the order, otherwise it is not accepted. */
export async function checkPaid(md5: string, totalCents: number): Promise<PaidCheck> {
  try {
    const res = await callCheck(md5, 6000);
    const j = await res.json().catch(() => null) as { responseCode?: number; responseMessage?: string; data?: { hash?: string; amount?: number; currency?: string; toAccountId?: string } | null } | null;
    if (!j) return { ok: false, reason: "ERROR", detail: `Bakong HTTP ${res.status}` };
    if (j.responseCode !== 0 || !j.data) return j.responseCode === 1 ? { ok: false, reason: "NOT_FOUND" } : { ok: false, reason: "ERROR", detail: `Bakong HTTP ${res.status}: ${j.responseMessage ?? "error"}` };
    return matchPaid(j.data, totalCents);
  } catch (e) { return { ok: false, reason: "ERROR", detail: e instanceof Error ? e.message : "network error" }; }
}
/** Admin connection test: tells the shop owner exactly why automatic confirmation does (not) work. Never returns the token. */
export async function bakongDiagnose(): Promise<{ ok: boolean; steps: { label: string; ok: boolean; detail: string }[] }> {
  const c = cfg(); const steps: { label: string; ok: boolean; detail: string }[] = [];
  steps.push({ label: "BAKONG_ACCOUNT_ID", ok: !!c.account, detail: c.account ? `set (${c.account})` : "missing: add it in Vercel → Settings → Environment Variables, then redeploy" });
  steps.push({ label: "BAKONG_API_TOKEN", ok: !!c.token, detail: c.token ? "set" : "missing: get one at https://api-bakong.nbc.gov.kh/register, add it in Vercel, then redeploy" });
  if (!c.account || !c.token) return { ok: false, steps };
  try {
    const res = await callCheck("0".repeat(32), 8000);
    const text = await res.text(); let j: { responseCode?: number; responseMessage?: string } | null = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
    if (!j) steps.push({ label: "Reach Bakong API", ok: false, detail: `HTTP ${res.status}, not a Bakong reply. Bakong usually blocks servers outside Cambodia. Fix: use the shop-PC watcher: set BAKONG_WATCHER_SECRET (see README) and run start-bakong-watcher.bat on a computer in Cambodia.` });
    else if (res.status === 401 || res.status === 403 || j.responseCode === 3 || /token|unauthor|expired/i.test(j.responseMessage ?? "")) steps.push({ label: "Reach Bakong API", ok: false, detail: `Bakong answered HTTP ${res.status}: ${j.responseMessage ?? "rejected"}. The token is invalid or expired: renew it, or the request was blocked by region.` });
    else { steps.push({ label: "Reach Bakong API", ok: true, detail: `connected (HTTP ${res.status})` }); steps.push({ label: "Token accepted", ok: true, detail: j.responseMessage ?? "ok" }); }
  } catch (e) { steps.push({ label: "Reach Bakong API", ok: false, detail: `${e instanceof Error ? e.message : "network error"}. The server cannot connect to Bakong (often blocked outside Cambodia).` }); }
  return { ok: steps.every((s) => s.ok), steps };
}

/** Bakong's transaction must match the order: same amount, USD, and OUR receiving account. */
export function matchPaid(d: { hash?: string; amount?: number | string; currency?: string; toAccountId?: string }, totalCents: number): PaidCheck {
  // The md5 we asked about already covers our account and the exact amount, so these checks are a second safety net. They are tolerant about HOW the account is written.
  const local = (x: string) => x.trim().toLowerCase().split("@")[0];
  const to = (d.toAccountId ?? "").trim(), sameAccount = !to.includes("@") || local(to) === local(cfg().account); // another format (e.g. a number) is not a reason to refuse a payment found by our own md5
  const amountOk = Math.abs(Number(d.amount) * 100 - totalCents) < 0.5, currencyOk = String(d.currency ?? "USD").toUpperCase() === "USD";
  if (!currencyOk || !amountOk || !sameAccount) return { ok: false, reason: "MISMATCH", detail: `amount ${d.amount} ${d.currency} to ${d.toAccountId}` };
  return { ok: true, hash: d.hash };
}
/** When set, a small program on a computer in Cambodia (tools/bakong-watcher.mjs) checks Bakong and tells this server; the server itself never calls Bakong. */
export const watcherSecret = () => (process.env.BAKONG_WATCHER_SECRET ?? "").trim();
