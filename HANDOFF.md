# Handoff: unfinished work (Claude stopped at usage limit)

Done (from Claude): 4 apps (member/secretary/admin/superadmin) React + Supabase + Cloudflare worker, all prior tests pass.
Partially done: `supabase/dev.sql` (Developer role `is_dev()`/`dev_accounts`, feature flags, branding function, Super Admin rename) and `test/sql-dev.mjs` (not yet run green).

## Still to do (change only these; keep all existing tests passing)
1. Branding: same KHI logo in every app. Member/Secretary/Admin: text beside logo = the user's branch + centre assigned by Super Admin (read from DB via the branding function). Super Admin app: logo + "KINGDOM HERALDS INTERNATIONAL CHURCH" only.
2. Super Admin = Apostle Felix Mwamba (seed in dev.sql).
3. Hidden Developer app at /dev/ for Timothy (programmer), above Super Admin: invisible to every other role (route 404s for them), feature-flag screen (on/off per church, branch, or global) that actually hides/disables features in all apps, full CRUD on users/roles/settings/data, impersonate any user, disabled-by-default future feature stubs (SMS, mobile money, backups/export, multi-language, audit log, API keys, payment reports) only the developer can enable. Enforced by Supabase RLS, not just UI.
4. Make `node test/sql-dev.mjs` pass; add UI tests for /dev/ and flags.
