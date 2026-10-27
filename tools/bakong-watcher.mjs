// Bakong watcher: runs on a computer INSIDE Cambodia (your shop PC). Needs only outgoing internet, no tunnel and no open ports.
// Bakong only answers Cambodian IP addresses, so a website on Vercel cannot check payments itself. This program:
//   1. asks your website which Bakong orders are waiting for payment,
//   2. asks Bakong if each QR was paid,
//   3. tells your website, which then shows the green "Payment successful" popup to the customer and emails you.
// It reads BAKONG_API_TOKEN, BAKONG_WATCHER_SECRET and BAKONG_SITE_URL from .env.local (or normal environment variables).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const line of fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch { /* file missing: fine */ }
}
const TOKEN = (process.env.BAKONG_API_TOKEN ?? "").trim(), SECRET = (process.env.BAKONG_WATCHER_SECRET ?? "").trim();
const SITE = (process.env.BAKONG_SITE_URL ?? "").trim().replace(/\/+$/, ""), API = (process.env.BAKONG_API_URL ?? "https://api-bakong.nbc.gov.kh").trim().replace(/\/$/, "");
const need = [!TOKEN && "BAKONG_API_TOKEN", SECRET.length < 12 && "BAKONG_WATCHER_SECRET (12+ characters)", !/^https?:\/\//.test(SITE) && "BAKONG_SITE_URL (e.g. https://your-shop.vercel.app)"].filter(Boolean);
if (need.length) { console.error("Missing in .env.local: " + need.join(", ")); process.exit(1); }
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const site = (p, init = {}) => fetch(`${SITE}/api${p}`, { ...init, signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-relay-secret": SECRET } });
const seen = new Set(); let lastErr = "";
async function check(md5) {
  const r = await fetch(`${API}/v1/check_transaction_by_md5`, { method: "POST", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ md5 }) });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!j) throw new Error(`Bakong HTTP ${r.status}, not a Bakong reply (blocked? are you in Cambodia?)`);
  return j;
}
log(`Bakong watcher started for ${SITE}. Keep this window open while you take payments.`);
// start-up self test: shows right away what is (not) working
try { const j = await check("0".repeat(32)); log(`Bakong connection: OK (${j.responseMessage ?? "reply received"})`); } catch (e) { log("Bakong connection PROBLEM:", e instanceof Error ? e.message : e); }
try { const r = await site("/relay/pending"); log(r.ok ? "Website connection: OK. Waiting for payments..." : r.status === 401 ? "Website connection: WRONG SECRET. BAKONG_WATCHER_SECRET must be identical in Vercel and .env.local (then redeploy on Vercel)." : r.status === 404 ? "Website connection: the site has no watcher support yet. Deploy the latest project to Vercel." : `Website connection problem: HTTP ${r.status}`); } catch (e) { log("Website connection PROBLEM:", e instanceof Error ? e.message : e); }
for (;;) {
  let busy = false;
  try {
    const r = await site("/relay/pending");
    if (r.status === 401) throw new Error("Website rejected the secret: BAKONG_WATCHER_SECRET must be the same here and in Vercel (then redeploy).");
    if (!r.ok) throw new Error(`Website answered HTTP ${r.status}`);
    const { orders = [] } = await r.json(); busy = orders.length > 0;
    for (const o of orders) for (const md5 of [...o.md5s].reverse()) {
      const j = await check(md5);
      if (j.responseCode !== 0 || !j.data) continue; // not paid yet
      const c = await site("/relay/confirm", { method: "POST", body: JSON.stringify({ orderNumber: o.orderNumber, md5, data: { hash: j.data.hash, amount: j.data.amount, currency: j.data.currency, toAccountId: j.data.toAccountId } }) });
      const body = await c.json().catch(() => ({}));
      if (c.ok) { if (!seen.has(o.orderNumber)) log(`PAID ${o.orderNumber}: popup sent to the customer`); seen.add(o.orderNumber); break; }
      log(`Order ${o.orderNumber}: payment found but not accepted (${body.error ?? c.status}${body.detail ? `: ${body.detail}` : ""})`);
    }
    if (lastErr) { log("Back online."); lastErr = ""; }
  } catch (e) { const m = e instanceof Error ? e.message : String(e); if (m !== lastErr) log("Problem:", m); lastErr = m; }
  await sleep(busy ? 1500 : 4000);
}
