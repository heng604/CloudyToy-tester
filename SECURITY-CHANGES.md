# Security update (ការពារ web ពីការវាយប្រហារ)

## ចំណាំសំខាន់អំពីបញ្ជី CVE
- **Java (Log4Shell CVE-2021-44228, Struts CVE-2017-5638)** និង **Python CVE**: web នេះមិនប្រើ Java ឬ Python ទេ (Node.js + Express + React + Supabase) ដូច្នេះមិនអាចរងផលពី CVE ទាំងនោះទេ។
- **Node.js CVE (2022-29078 ejs, 2020-7660 serialize-javascript)**: project នេះមិនប្រើ `ejs` ឬ `serialize-javascript` ទេ។
- **CVE-2026-xxxx ផ្សេងៗ**: ជា CVE នៃ firewall/ផលិតផលផ្សេង មិនអាចកែនៅក្នុង code web បានទេ។ ត្រូវ patch ឧបករណ៍/ផលិតផលនោះផ្ទាល់ ឬបើក Vercel Firewall។
- ខ្ញុំមិនអាចផ្ទៀងផ្ទាត់ CVE-2026 ទាំងនោះបានទេ (គ្មានអ៊ីនធឺណិតពេលពិនិត្យ) ហើយខ្លះមានទម្រង់ខុស (ឧ. `CVE-2026-93639-53`)។ សូមពិនិត្យលើ nvd.nist.gov។

## អ្វីដែលបានកែ
| # | បញ្ហា | ការកែ |
|---|---|---|
| 1 | `GET /api/orders/:n` ផ្តល់ឈ្មោះ ទូរស័ព្ទ អាសយដ្ឋាន អ៊ីមែល ទៅអ្នកណាក៏បាន ដែលស្មានលេខ order ត្រូវ | ថ្មី `server/lib/publicOrder.ts` លុបទិន្នន័យផ្ទាល់ខ្លួន, path រូប screenshot, hash ធនាគារ, log អ៊ីមែល (ទំព័រ Payment ប្រើតែ items/សរុប/ស្ថានភាព) |
| 2 | `multer 1.4.5-lts.1` មាន CVE (DoS) | ដំឡើងទៅ `^2.0.2` + កំណត់ limit fields/parts/fieldSize |
| 3 | `express 4.21.0` (path-to-regexp ReDoS) | `^4.21.2` |
| 4 | `compression 1.7.4` (on-headers CVE-2025-7339) | `^1.8.1` |
| 5 | `vite 5.4.8` (dev server CVEs) | `^5.4.19` |
| 6 | Rate limiter ត្រូវលុបទាំងអស់ពេលមាន key >5000 (វាយប្រហារអាចលុប limit) | លុបតែ key ផុតកំណត់/ចាស់បំផុត |
| 7 | `/api/admin/bakong/diagnose` ចូលបានគ្រប់ role (រួមទាំង Editor) | ត្រូវការសិទ្ធិ `settings` |
| 8 | (reverted) "Clear all transactions" keeps working for Owner and Admin exactly as before. Optional: add needs("staff") to make it owner-only | no change |
| 9 | Error ពី JSON ខូច/upload ធំ អាចបង្ហាញព័ត៌មានខាងក្នុង | Error handler ចុងក្រោយ ឆ្លើយ JSON ខ្លី |
| 10 | Header បន្ថែម | `X-Permitted-Cross-Domain-Policies`, `X-DNS-Prefetch-Control` |
| 11 | Tests ថ្មី | `tests/security.test.ts` |

មានស្រាប់ហើយ (ល្អ): CSP តឹង, HSTS, ពិនិត្យ token ខាង server, role ក្នុង admin, RLS លើគ្រប់ table, upload ពិនិត្យ magic-bytes + បង្រួមតាម sharp, escape HTML ក្នុងអ៊ីមែល, ការពារ CSV formula, ការពារ open-redirect, `timingSafeEqual` សម្រាប់ watcher secret។

## ត្រូវធ្វើដោយខ្លួនឯង (ខ្ញុំធ្វើក្នុង zip មិនបាន)
1. `npm install` (ធ្វើ package-lock ឲ្យថ្មី) រួច `npm audit` និង `npm run check`។ ខ្ញុំមិនបានដំណើរការ test/typecheck ទេ ដោយសារគ្មាន node_modules។
2. **Vercel > Firewall**: បើក Rate Limiting លើ `/api/*` (ឧ. 100 req/នាទី/IP) និង Attack Challenge Mode ពេលត្រូវវាយប្រហារ។ Limiter ក្នុង code គ្រាន់តែបន្ថយល្បឿន ព្រោះ Vercel មានច្រើន instance។
3. លេខ order `CT-YYMMDD-XXXXX` មានតែ 5 តួ hex (~1 លានករណី/ថ្ងៃ)។ ឥឡូវមិនលេចធ្លាយ PII ទៀតទេ ប៉ុន្តែអ្នកស្មានអាចបោះបង់ order Bakong ដែលកំពុងរង់ចាំ។ ពិចារណាបង្កើនប្រវែង (ត្រូវកែ regex ក្នុង server ហើយ test)។
4. Supabase: បើក MFA/ក្រុមតូចសម្រាប់ owner, កុំចែក `SUPABASE_SERVICE_ROLE_KEY`, បង្វិល key ប្រសិនបើធ្លាប់លេចធ្លាយ។ ដូរ `BAKONG_WATCHER_SECRET` ជាអក្សរចៃដន្យ ≥32 តួ។
5. បើក GitHub Dependabot ឬ `npm audit` ក្នុង CI ជាប្រចាំ។
