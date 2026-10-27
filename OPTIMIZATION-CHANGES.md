# API speed-up: what changed

## 1. N+1 / repeated queries fixed
| Where | Before | After |
|---|---|---|
| `sendItemsMail` | loaded the WHOLE product table to find images | 1 query: `firstImagesById(ids)` |
| Bakong stale sweep | listed pending orders, then re-read every order again before releasing | uses the already-loaded order (`markUnpaidOnce(..., known)`), releases run in parallel |
| Checkout e-mails | 3 e-mails one after another + 2 separate read+write order updates | 3 e-mails in parallel + 1 order update |
| `DELETE /admin/products/:id` | read product, then delete | 1 query (`delete ... returning images`) |
| Product save | `skuTaken` then `getProductById` one by one | run together |
| `GET /admin/products/:id` | product then categories one by one | run together |

## 2. Return only the data that is needed
- Checkout and discount preview read only the products in the cart (`listProductsByIds`), not the whole catalogue.
- Category list reads the `category` column only (`categoryCounts`), not full product rows.
- Admin order list filters FAILED / EXPIRED / pending-Bakong in SQL, not after downloading everything.
- "Clear all transactions" reads only the proof paths (`listProofPaths`), not every order.
- "My orders" is capped at 200 per lookup.

## 3. Caching (new `server/lib/cache.ts`: TTL + in-flight de-duplication + safe invalidation)
- Login token check: remembered up to 60 s (never longer than the token lives) -> no Supabase round trip on every request.
- Storefront product list: 5 s, cleared on every product / stock change. Checkout always reads fresh stock.
- Discount codes: 10 s for the preview only; real checkout always checks fresh. Cleared on create/update/delete.
- Site pages: 15 s, cleared on save.
- Payment-proof signed links: reused for 30 min instead of re-signing every screenshot on every admin poll.
- API responses send `Cache-Control: private, no-cache` (browser revalidates, ETag gives cheap 304).

## 4. Database indexes
Run `supabase/migrations/0016_performance_indexes.sql` (also appended to `setup_all.sql`) in Supabase > SQL Editor. Safe to run again.

## After deploying
`api/index.js` is a build output: run `npm run build` (Vercel does this automatically) so the bundle includes these changes.
