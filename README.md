# Cloudy-Toy (React + Vite)

Same shop, same UI, same features, no Next.js.

- `src/`     React app (Vite + React Router + Tailwind). Same Tailwind classes as before.
- `server/`  Small Express API for what must stay private: checkout, stock, discount codes, order e-mails (Resend), image uploads (sharp), CSV/PDF export, all admin writes.
- `shared/`  Pure logic used by both sides (pricing, discounts, delivery rules, stats, image checks...).
- `supabase/` run `supabase/setup_all.sql` once in Supabase > SQL Editor (it is safe to run again; it also removes the old per-item discount table).

## Run
No Supabase keys? The shop still starts and shows 6 sample products (preview only: checkout, login and admin need real keys).
Windows: double-click `start-windows.bat` (installs, opens the browser, starts the site).
Manual, from THIS folder (the one containing package.json):
1. `npm install`
2. Copy your old `.env.local` into this folder (it works as-is) or use `.env.example`.
   Vite reads `VITE_*` and the old `NEXT_PUBLIC_*` names. The server reads `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`.
3. `npm run dev`  -> site on http://localhost:3000 (API on :3001, proxied automatically)
4. Production: `npm run build` then `npm start` (serves `dist/` and `/api` on one port, `PORT` env, default 3001).

`VITE_*` values are baked in at build time, so keep `.env.local` present when you run `npm run build`.

## Supabase settings to check
Authentication > URL Configuration: keep `https://YOUR-SITE/auth/callback` in Redirect URLs (same path as before).

## Speed changes
- Products, settings and pages are fetched directly from Supabase by the browser (RLS already allows public read of active products and settings) and cached, so page changes are instant and show last data immediately while refreshing in the background.
- Data starts loading before React renders; realtime updates patch the cache without reloading pages.
- Admin, checkout, account and payment code is loaded only when visited (code splitting).
- Hashed assets are cached for a year; responses are gzip-compressed.

## Removed (they were broken or unused in the Next.js version)
`/api/payment-qr`, `/api/payment-claim`, `/api/product-image/[file]`, `/admin/discounts` (these imported functions that no longer exist), the unlinked `/faq`, `/privacy`, `/terms`, `/shipping-returns` pages (they crashed), and the unused `simulateTestPayment` action.

## Discounts
Only subtotal codes exist. Admin > Discounts: create a code (type one or press Generate) worth 10%-50%, give it to customers; they type it at checkout and get that % off the cart subtotal. Delivery is never discounted. Codes can be edited (%) or deleted any time.

## SKU
Letters, numbers and `#` `*` `_` `-` (no spaces), 2 to 40 characters. Example: `CT-TOY-001`, `#A1`, `BEAR*2`.

## Screen sizes
Layout adapts automatically: phone, tablet/iPad, laptop, desktop and large screens (page width and text size grow with the screen).

## Automatic Bakong payment popup (hosted outside Cambodia, e.g. Vercel)
Bakong only answers Cambodian IP addresses, so a site on Vercel cannot confirm payments by itself. A small watcher on a computer in Cambodia does it:
1. Pick any long random text (12+ characters) as `BAKONG_WATCHER_SECRET`. Add it to **Vercel → Settings → Environment Variables**, then redeploy.
2. On the shop PC, in `.env.local`, add the same `BAKONG_WATCHER_SECRET`, plus `BAKONG_SITE_URL=https://your-site.vercel.app` (it already has `BAKONG_API_TOKEN`).
3. Double-click `start-bakong-watcher.bat` and keep the window open while taking payments. When a customer pays, the watcher tells the site within about 1.5 s and the green popup appears; you get the paid email.

## Stock rules
- A Bakong order holds its stock while the customer pays. Each order gets up to 3 QR codes of 5 minutes each = 15 minutes in total (a new one is made automatically when one expires). When the 3rd runs out, or the customer presses **Cancel order**, or nobody opens the payment page for 5 minutes after the last QR expired, the order is cancelled and the stock goes back to the shop (once only; a paid order is never touched).
- A sold-out product shows only the "Out of stock" label. After 2 days out of stock it disappears from the Home and Product pages (it stays in the admin dashboard and database); when the admin adds stock it shows again with all its data. Only the admin can delete a product.

## Customer accounts
- Customers can create an account with email + password (name, phone, password twice). It is stored in Supabase Auth (`auth.users`) and a row is created automatically in `public.profiles` (run `supabase/setup_all.sql` once). They sign in with the same email and password next time. Google sign-in is optional: set `VITE_GOOGLE_LOGIN=false` to hide it.
- For instant sign-in after sign-up, turn OFF Supabase > Authentication > Providers > Email > "Confirm email". If it stays ON, new customers must click the link in their email first.
- "Sign in again" rule: set `VITE_SESSION_HOURS` (e.g. 24 or 168). After that many hours since sign-in the customer is signed out and must sign in again. Empty/0 = stay signed in.


## Cloudflare R2 image storage (optional)
Set the five `R2_*` variables from `.env.example` (locally in `.env.local`, on Vercel under Environment Variables, then redeploy). New product/logo/banner/QR images are then stored in R2 and served from `R2_PUBLIC_URL`; images uploaded earlier stay in Supabase and keep working. Payment screenshots always stay in the private Supabase bucket.
If you use a custom domain for the bucket, also add it to `img-src` in `vercel.json` (the `https://*.r2.dev` entry only covers the free `r2.dev` address).
