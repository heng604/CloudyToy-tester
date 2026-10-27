# Deploy Cloudy-Toy on Cloudflare (free plan)

Site (React) = Workers Static Assets. API (`/api/*`) = the same Express code running in one Worker.
Database/login stays on Supabase, images on R2, e-mail on Resend. Nothing else changes.

## Once (about 10 minutes)
1. Install Node 20+ and open a terminal in this folder. Run `npm install`.
2. `npx wrangler login` (opens the browser, sign in to Cloudflare).
3. Put your PUBLIC values in `.env.local` (they are baked into the site at build time):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_LOGIN`, `VITE_SESSION_HOURS` ...
4. First deploy: `npm run cf:deploy`. It builds the site and uploads it. Wrangler prints your address, e.g. `https://cloudy-toy.<your-name>.workers.dev`.
5. Add the SECRET values (one command each, paste the value when asked):
   ```
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put EMAIL_FROM
   npx wrangler secret put ADMIN_NOTIFICATION_EMAIL
   npx wrangler secret put SITE_URL            # your final address, no trailing slash
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put R2_BUCKET
   npx wrangler secret put R2_PUBLIC_URL
   npx wrangler secret put BAKONG_ACCOUNT_ID
   npx wrangler secret put BAKONG_API_TOKEN
   npx wrangler secret put BAKONG_WATCHER_SECRET
   npx wrangler secret put BAKONG_MERCHANT_NAME
   npx wrangler secret put BAKONG_MERCHANT_CITY
   ```
   (Skip the ones you do not use.) Secrets apply immediately, no redeploy needed.
6. Supabase > Authentication > URL Configuration: add `https://YOUR-ADDRESS/auth/callback` to Redirect URLs (and set Site URL).
7. Bakong: in `.env.local` on the shop PC set `BAKONG_SITE_URL=https://YOUR-ADDRESS` and keep `start-bakong-watcher.bat` running (same as on Vercel; Cloudflare is not in Cambodia either).
8. Custom domain (optional): Cloudflare dashboard > Workers & Pages > cloudy-toy > Settings > Domains & Routes > Add. If you use it, change `SITE_URL` and the Supabase redirect, and add the domain to nothing else (CSP only lists Supabase and R2).

## Every later update
`npm run cf:deploy`

## Test before going live
`npm run cf:dev` runs the same thing on your PC at http://localhost:8787 (put secrets in a `.dev.vars` file, same names as above).
Check: home page loads, sign in, add to cart, checkout (COD), admin login, upload a product photo from a phone (check it is the right way up), download Excel + PDF, open an invoice, e-mails arrive.

## Free-plan limits to know
- 100,000 API requests per day, 10 ms CPU per API request. Normal pages/images are static and do not count. Big Excel/PDF exports of thousands of orders can exceed 10 ms; if exports fail with error 1102, move to the Workers Paid plan ($5/month).
- Worker size limit 3 MB (compressed). `wrangler deploy` tells you if it is too big.
- Photo resizing uses Cloudflare Images (free allowance: 5,000 transformations a month).
- The per-visitor rate limit lives in memory of each Worker copy, so it is a speed bump, not a hard wall (same as on Vercel). For a hard limit use Cloudflare > Security > WAF > Rate limiting rules.
- Photos saved from now on go to R2 (set the R2_* secrets), because the Worker has no disk.
