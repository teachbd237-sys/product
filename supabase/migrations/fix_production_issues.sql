-- ============================================================================
-- Story Frame — fix_production_issues.sql  (upgrade_free_download.sql-এর পরে চালান)
--
-- নিরাপদ ও বারবার চালানো যায় (idempotent):
--   * কোনো Row/ফাইল/Admin/Product মোছা বা Reset হয় না; কোনো Table DROP হয় না।
--   * শুধু: (১) অনুপস্থিত কলাম থাকলে যোগ, (২) service_role-এর অনুমতি নিশ্চিত,
--           (৩) PostgREST Schema Cache রিলোড ("Could not find the 'category' column ... schema cache" ঠিক করতে)।
-- এটি Live Database-এ আপনাকেই চালাতে হবে; আমি আপনার Database দেখিনি।
-- ============================================================================
begin;

-- (১) products: আগের Migration আংশিক চললে বাকি কলাম পূরণ (থাকলে কিছুই হয় না)
alter table public.products add column if not exists verification_mode text not null default 'global';
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists cta_label text;
alter table public.products add column if not exists updated_at timestamptz not null default now();

-- (২) Netlify Function (service_role) যেন কোনো টেবিলে "permission denied" না পায়
grant usage on schema public to service_role;
grant all on public.products, public.website_settings, public.verification_requirements,
             public.download_requests, public.request_verification_evidence, public.download_codes,
             public.download_redemptions, public.download_audit_logs, public.rate_limits
  to service_role;

-- (৩) Admin Panel-এর জন্য Admin-এর পড়ার অনুমতি অক্ষত (নতুন কিছু খোলা হচ্ছে না)

commit;

-- (৪) Schema Cache রিলোড — Transaction-এর বাইরে
notify pgrst, 'reload schema';
