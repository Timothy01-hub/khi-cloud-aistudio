# KHI Offering System - Cloudflare + Supabase (Stage 2: member app)

## 1. Database (Supabase)
1. Create a project (pick the region nearest Zambia).
2. SQL Editor -> paste and Run `supabase/schema.sql`, then Run `supabase/auth.sql`.
3. Settings -> API: copy the Project URL, and the **service_role** key (keep it secret).

## 2. Run on your computer (Windows)
1. Install Node.js LTS from nodejs.org.
2. In this folder: `npm install`
3. Copy `.dev.vars.example` to `.dev.vars` and fill in the 3 values.
4. `npm test` (should say "All checks passed"), then `npm run dev`
5. Open http://localhost:8787/member/

## 3. Deploy to Cloudflare
1. Put your Project URL in `wrangler.toml` (SUPABASE_URL).
2. `npx wrangler login`
3. `npx wrangler secret put SUPABASE_SERVICE_KEY` and `npx wrangler secret put SESSION_SECRET` (and `PROXYCHECK_KEY`)
4. `npm run deploy`
5. Test on phones. Then set GEO_ENFORCE = "true" in wrangler.toml and deploy again.

## Not built yet
Secretary app, Super Admin app, banner uploads, reports/exports, scheduled backups, payment webhook.
