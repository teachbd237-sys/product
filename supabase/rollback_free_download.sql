-- ============================================================================
-- ROLLBACK — upgrade_free_download.sql-এর পরিবর্তন ফিরিয়ে নেওয়া
--
-- ⚠ এটি নতুন সিস্টেমের টেবিলগুলো (রিকোয়েস্ট, কোড, স্ক্রিনশট রেকর্ড, লগ, সেটিংস) মুছে দেয়।
--    চালানোর আগে অবশ্যই নতুন টেবিলের ডাটা Backup/Export করুন।
-- ✅ পুরনো products / orders / settings / admins-এর Data মোছে না।
-- ✅ পুরনো bKash-এর Public Policy ফিরিয়ে আনে (শুধু তখনই দরকার যখন পুরনো Website কোডে ফিরে যাচ্ছেন)।
-- ✅ Storage-এর verification-evidence Bucket-এর ফাইল এই SQL মোছে না (Dashboard থেকে নিজে মুছুন)।
-- ============================================================================
begin;

drop function if exists public.admin_dashboard_stats();
drop function if exists public.refund_download_authorization(text);
drop function if exists public.consume_download_authorization(text, integer);
drop function if exists public.redeem_download_code(text, uuid, text, text, integer);
drop function if exists public.regenerate_download_code(uuid, uuid, text, text, text, text);
drop function if exists public.revoke_download_code(uuid, uuid, text);
drop function if exists public.reject_download_request(uuid, uuid, text);
drop function if exists public.approve_download_request(uuid, uuid, text, text, text);
drop function if exists public.check_rate_limit(text, integer, integer);

drop table if exists public.rate_limits;
drop table if exists public.download_audit_logs;
drop table if exists public.download_redemptions;
drop table if exists public.download_codes;
drop table if exists public.request_verification_evidence;
drop table if exists public.download_requests;
drop table if exists public.verification_requirements;
drop table if exists public.website_settings;

-- products-এর নতুন কলামগুলো থেকে যায় (ক্ষতিকর নয়)। শুধু 'archived' Status পুরনো নিয়মে বেমানান;
-- তাই আগে সেগুলোকে inactive করা হয়।
update public.products set status = 'inactive' where status = 'archived';
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('active', 'inactive'));

-- পুরনো Public Policy ফিরিয়ে আনা (পুরনো Website-এর জন্য)
drop policy if exists "Anyone can create an order" on public.orders;
create policy "Anyone can create an order" on public.orders for insert with check (true);
drop policy if exists "Public can read settings" on public.settings;
create policy "Public can read settings" on public.settings for select using (true);
drop policy if exists "Anyone can upload payment proof" on storage.objects;
create policy "Anyone can upload payment proof" on storage.objects for insert with check (bucket_id = 'payment-proofs');

commit;
