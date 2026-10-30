-- ============================================================================
-- Story Frame — Upgrade: bKash Payment  ->  Free Download Request System
-- ফাইল: supabase/migrations/upgrade_free_download.sql
--
-- এটি বারবার চালানো যায় (idempotent) এবং কোনো পুরনো Data মুছে ফেলে না:
--   * products, orders, settings, admins টেবিল ও তাদের সব Row অক্ষত থাকে
--   * orders-এর transaction_id / screenshot_path / price_at_purchase কলাম থেকে যায়
--   * শুধু নতুন টেবিল/ফাংশন/Policy যোগ হয় এবং বিপজ্জনক পুরনো Public Policy বন্ধ হয়
--
-- চালানোর আগে অবশ্যই supabase/MIGRATION_GUIDE.md পড়ুন এবং Backup নিন।
-- Supabase Dashboard > SQL Editor-এ পুরো ফাইল Paste করে একবার Run করুন।
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Helper: is_admin()  (আগের মতোই, শুধু search_path লক করা হলো)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. products: নতুন কলাম (পুরনো ID, file_path, price সব অক্ষত)
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists verification_mode text not null default 'global';
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists cta_label text;
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('active', 'inactive', 'archived'));

alter table public.products drop constraint if exists products_verification_mode_check;
alter table public.products add constraint products_verification_mode_check
  check (verification_mode in ('global', 'custom', 'combined', 'none'));

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. website_settings  (Admin Panel থেকে নিয়ন্ত্রিত সব ওয়েবসাইট কনটেন্ট)
--    is_public = false হলে Public কখনো পড়তে পারে না (যেমন WhatsApp টেমপ্লেট)
-- ---------------------------------------------------------------------------
create table if not exists public.website_settings (
  key         text primary key,
  value       jsonb not null default 'null'::jsonb,
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
alter table public.website_settings enable row level security;
revoke all on public.website_settings from anon, authenticated;
grant select on public.website_settings to anon, authenticated;
grant insert, update, delete on public.website_settings to authenticated;

drop policy if exists "website_settings public read" on public.website_settings;
create policy "website_settings public read" on public.website_settings
  for select using (is_public = true or public.is_admin());

drop policy if exists "website_settings admin write" on public.website_settings;
create policy "website_settings admin write" on public.website_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.website_settings (key, value, is_public) values
  ('site_name', '"Story Frame"'::jsonb, true),
  ('whatsapp_template', to_jsonb(
$tpl$আসসালামু আলাইকুম {customer_name}!

আপনার ফ্রি ডাউনলোড রিকোয়েস্টটি অনুমোদিত হয়েছে।

প্রোডাক্ট: {product_name}

আপনার ইউনিক ডাউনলোড কোড:
{code}

ডাউনলোড লিংক:
{product_url}

ওয়েবসাইটে গিয়ে কোডটি ব্যবহার করুন।

মনে রাখবেন, কোডটি শুধুমাত্র একবার ব্যবহার করা যাবে।

ধন্যবাদ।
{website_name}$tpl$::text), false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. verification_requirements  (Facebook/YouTube ইত্যাদি ধাপ)
--    product_id NULL  = Global,  product_id = X = শুধু ঐ Product-এর জন্য
-- ---------------------------------------------------------------------------
create table if not exists public.verification_requirements (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references public.products(id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 120),
  instruction         text not null default '' check (char_length(instruction) <= 500),
  platform            text not null default 'other'
                      check (platform in ('facebook_profile','facebook_page','facebook_group','youtube','instagram','tiktok','telegram','website','other')),
  target_url          text not null check (target_url ~* '^https?://'),
  button_label        text not null default 'লিংক খুলুন' check (char_length(button_label) between 1 and 40),
  is_enabled          boolean not null default true,
  sort_order          integer not null default 0,
  requires_screenshot boolean not null default true,
  is_mandatory        boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_vreq_product on public.verification_requirements(product_id);
create index if not exists idx_vreq_enabled_order on public.verification_requirements(is_enabled, sort_order);

drop trigger if exists trg_vreq_updated_at on public.verification_requirements;
create trigger trg_vreq_updated_at
before update on public.verification_requirements
for each row execute function public.set_updated_at();

alter table public.verification_requirements enable row level security;
revoke all on public.verification_requirements from anon, authenticated;
grant select on public.verification_requirements to anon, authenticated;
grant insert, update, delete on public.verification_requirements to authenticated;

drop policy if exists "vreq public read enabled" on public.verification_requirements;
create policy "vreq public read enabled" on public.verification_requirements
  for select using (is_enabled = true or public.is_admin());

drop policy if exists "vreq admin write" on public.verification_requirements;
create policy "vreq admin write" on public.verification_requirements
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. download_requests
-- ---------------------------------------------------------------------------
create table if not exists public.download_requests (
  id                   uuid primary key default gen_random_uuid(),
  request_ref          text not null,
  product_id           uuid references public.products(id) on delete set null,
  product_name         text not null,
  customer_name        text not null check (char_length(customer_name) between 2 and 80),
  customer_email       text not null check (char_length(customer_email) between 5 and 254),
  whatsapp_number      text not null check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  status               text not null default 'pending'
                       check (status in ('pending','approved','rejected','redeemed','revoked','cancelled')),
  admin_notes          text check (admin_notes is null or char_length(admin_notes) <= 1000),
  rejection_reason     text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  requirements_snapshot jsonb not null default '[]'::jsonb,
  lookup_secret_hash   text not null,
  ip_hash              text,
  reviewed_by          uuid references auth.users(id) on delete set null,
  reviewed_at          timestamptz,
  whatsapp_sent_at     timestamptz,
  whatsapp_sent_by     uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint download_requests_ref_key unique (request_ref)
);
create index if not exists idx_dr_status_created on public.download_requests(status, created_at desc);
create index if not exists idx_dr_product on public.download_requests(product_id);
create index if not exists idx_dr_email on public.download_requests(lower(customer_email));
create index if not exists idx_dr_whatsapp on public.download_requests(whatsapp_number);

-- একই ব্যক্তি একই Product-এর জন্য একসাথে একাধিক চালু রিকোয়েস্ট রাখতে পারবে না (Database স্তরেই বাধা)
create unique index if not exists uq_dr_open_email_product
  on public.download_requests(product_id, lower(customer_email))
  where status in ('pending', 'approved') and product_id is not null;
create unique index if not exists uq_dr_open_whatsapp_product
  on public.download_requests(product_id, whatsapp_number)
  where status in ('pending', 'approved') and product_id is not null;

drop trigger if exists trg_dr_updated_at on public.download_requests;
create trigger trg_dr_updated_at
before update on public.download_requests
for each row execute function public.set_updated_at();

alter table public.download_requests enable row level security;
revoke all on public.download_requests from anon, authenticated;
-- Admin শুধু নির্দিষ্ট কলাম পড়তে পারবে (lookup_secret_hash ও ip_hash কখনো Browser-এ যায় না)
grant select (id, request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number,
              status, admin_notes, rejection_reason, requirements_snapshot, reviewed_by, reviewed_at,
              whatsapp_sent_at, whatsapp_sent_by, created_at, updated_at)
  on public.download_requests to authenticated;

drop policy if exists "dr admin read" on public.download_requests;
create policy "dr admin read" on public.download_requests
  for select using (public.is_admin());
-- INSERT/UPDATE/DELETE-এর কোনো Policy নেই: সব পরিবর্তন শুধু Netlify Function (service role) করতে পারে।

-- ---------------------------------------------------------------------------
-- 5. request_verification_evidence  (Screenshot-এর রেকর্ড; ফাইল Private Bucket-এ)
-- ---------------------------------------------------------------------------
create table if not exists public.request_verification_evidence (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.download_requests(id) on delete cascade,
  requirement_id    uuid references public.verification_requirements(id) on delete set null,
  requirement_title text not null,
  storage_path      text not null,
  mime_type         text not null,
  size_bytes        integer not null check (size_bytes > 0),
  created_at        timestamptz not null default now()
);
create index if not exists idx_rve_request on public.request_verification_evidence(request_id);

alter table public.request_verification_evidence enable row level security;
revoke all on public.request_verification_evidence from anon, authenticated;
grant select on public.request_verification_evidence to authenticated;
drop policy if exists "rve admin read" on public.request_verification_evidence;
create policy "rve admin read" on public.request_verification_evidence
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. download_codes  (কোনো Client-এর জন্য কোনো Policy নেই — শুধু service role)
--    code_hash      : HMAC-SHA256(secret, code)  — যাচাইয়ের জন্য
--    code_encrypted : AES-256-GCM  — যাতে Admin একই কোড আবার WhatsApp-এ পাঠাতে পারে
-- ---------------------------------------------------------------------------
create table if not exists public.download_codes (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.download_requests(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  code_hash       text not null,
  code_encrypted  text not null,
  code_hint       text not null,
  status          text not null default 'active' check (status in ('active','redeemed','revoked')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  redeemed_at     timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id) on delete set null,
  revoke_reason   text,
  constraint download_codes_hash_key unique (code_hash)
);
-- একটি রিকোয়েস্টে একসাথে সর্বোচ্চ একটি Active কোড
create unique index if not exists uq_dc_one_active_per_request
  on public.download_codes(request_id) where status = 'active';
create index if not exists idx_dc_request on public.download_codes(request_id);
create index if not exists idx_dc_status on public.download_codes(status, created_at desc);

alter table public.download_codes enable row level security;
revoke all on public.download_codes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. download_redemptions  (কোড ব্যবহারের পর স্বল্পমেয়াদি ডাউনলোড অনুমতি)
-- ---------------------------------------------------------------------------
create table if not exists public.download_redemptions (
  id              uuid primary key default gen_random_uuid(),
  code_id         uuid not null references public.download_codes(id) on delete cascade,
  request_id      uuid not null references public.download_requests(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  token_hash      text not null,
  ip_hash         text,
  issued_count    integer not null default 0 check (issued_count >= 0),
  first_issued_at timestamptz,
  last_issued_at  timestamptz,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  constraint download_redemptions_token_key unique (token_hash),
  constraint download_redemptions_code_key unique (code_id)
);
alter table public.download_redemptions enable row level security;
revoke all on public.download_redemptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. download_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.download_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('admin','customer','system')),
  actor_id    uuid,
  action      text not null,
  request_id  uuid references public.download_requests(id) on delete set null,
  code_id     uuid references public.download_codes(id) on delete set null,
  product_id  uuid references public.products(id) on delete set null,
  ip_hash     text,
  meta        jsonb not null default '{}'::jsonb
);
create index if not exists idx_dal_request on public.download_audit_logs(request_id, created_at desc);
create index if not exists idx_dal_created on public.download_audit_logs(created_at desc);

alter table public.download_audit_logs enable row level security;
revoke all on public.download_audit_logs from anon, authenticated;
grant select on public.download_audit_logs to authenticated;
drop policy if exists "dal admin read" on public.download_audit_logs;
create policy "dal admin read" on public.download_audit_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9. rate_limits  (Netlify Function Stateless, তাই Rate Limit Database-এ)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
create index if not exists idx_rl_window on public.rate_limits(window_start);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- ===========================================================================
-- 10. ফাংশন — সবগুলো শুধু service_role চালাতে পারবে (Netlify Function)
--     Browser/anon/authenticated কেউ সরাসরি Call করতে পারবে না।
-- ===========================================================================

-- 10.1 Rate limit: true = অনুমোদিত, false = সীমা পার
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_hits  integer;
begin
  if p_window_seconds < 1 or p_limit < 1 then
    raise exception 'invalid_rate_limit_args';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key || ':' || p_window_seconds::text, v_start, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_limit;
end;
$$;

-- 10.2 Approve: Request লক করে, Code তৈরি, Status বদল — একটি Transaction-এ
create or replace function public.approve_download_request(
  p_request_id uuid, p_admin uuid, p_code_hash text, p_code_encrypted text, p_code_hint text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.download_requests%rowtype;
  v_code_id uuid;
begin
  select * into r from public.download_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status <> 'pending' then raise exception 'invalid_status:%', r.status; end if;
  if r.product_id is null then raise exception 'product_missing'; end if;

  insert into public.download_codes (request_id, product_id, code_hash, code_encrypted, code_hint, created_by)
  values (r.id, r.product_id, p_code_hash, p_code_encrypted, p_code_hint, p_admin)
  returning id into v_code_id;

  update public.download_requests
     set status = 'approved', reviewed_by = p_admin, reviewed_at = now(),
         rejection_reason = null, whatsapp_sent_at = null, whatsapp_sent_by = null
   where id = r.id;

  insert into public.download_audit_logs (actor_type, actor_id, action, request_id, code_id, product_id)
  values ('admin', p_admin, 'request_approved', r.id, v_code_id, r.product_id);
  return v_code_id;
end;
$$;

-- 10.3 Reject
create or replace function public.reject_download_request(p_request_id uuid, p_admin uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.download_requests%rowtype;
begin
  select * into r from public.download_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status <> 'pending' then raise exception 'invalid_status:%', r.status; end if;
  update public.download_requests
     set status = 'rejected', reviewed_by = p_admin, reviewed_at = now(), rejection_reason = p_reason
   where id = r.id;
  insert into public.download_audit_logs (actor_type, actor_id, action, request_id, product_id, meta)
  values ('admin', p_admin, 'request_rejected', r.id, r.product_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- 10.4 Revoke: শুধু ব্যবহার না হওয়া (active) কোড বাতিল করা যায়
create or replace function public.revoke_download_code(p_code_id uuid, p_admin uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.download_codes%rowtype;
begin
  select * into c from public.download_codes where id = p_code_id for update;
  if not found then raise exception 'code_not_found'; end if;
  if c.status = 'redeemed' then raise exception 'already_redeemed'; end if;
  if c.status = 'revoked' then raise exception 'already_revoked'; end if;

  update public.download_codes
     set status = 'revoked', revoked_at = now(), revoked_by = p_admin, revoke_reason = p_reason
   where id = c.id;
  update public.download_requests set status = 'revoked' where id = c.request_id and status = 'approved';
  insert into public.download_audit_logs (actor_type, actor_id, action, request_id, code_id, product_id, meta)
  values ('admin', p_admin, 'code_revoked', c.request_id, c.id, c.product_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- 10.5 Regenerate: Active কোড থাকলে বাতিল করে নতুন কোড (ব্যবহৃত কোডের ক্ষেত্রেও Admin প্রতিস্থাপন দিতে পারবে)
create or replace function public.regenerate_download_code(
  p_request_id uuid, p_admin uuid, p_code_hash text, p_code_encrypted text, p_code_hint text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.download_requests%rowtype;
  v_new uuid;
begin
  select * into r from public.download_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status not in ('approved', 'revoked', 'redeemed') then raise exception 'invalid_status:%', r.status; end if;
  if r.product_id is null then raise exception 'product_missing'; end if;

  update public.download_codes
     set status = 'revoked', revoked_at = now(), revoked_by = p_admin,
         revoke_reason = coalesce(p_reason, 'regenerated')
   where request_id = r.id and status = 'active';

  insert into public.download_codes (request_id, product_id, code_hash, code_encrypted, code_hint, created_by)
  values (r.id, r.product_id, p_code_hash, p_code_encrypted, p_code_hint, p_admin)
  returning id into v_new;

  update public.download_requests
     set status = 'approved', whatsapp_sent_at = null, whatsapp_sent_by = null
   where id = r.id;
  insert into public.download_audit_logs (actor_type, actor_id, action, request_id, code_id, product_id, meta)
  values ('admin', p_admin, 'code_regenerated', r.id, v_new, r.product_id, jsonb_build_object('reason', p_reason, 'previous_status', r.status));
  return v_new;
end;
$$;

-- 10.6 Redeem: Atomic। Code-এর Row লক করা হয়, তাই একই সময়ে দুইজন সফল হতে পারে না।
--      সফল হলে কোড 'redeemed' হয় এবং একটি স্বল্পমেয়াদি Download Authorization তৈরি হয়।
--      p_token_hash = Browser-এর গোপন nonce-এর HMAC। একই nonce দিয়ে আবার চেষ্টা (Refresh/Network ব্যর্থতা/
--      Double-click) করলে আবার সফল হয়, কিন্তু নতুন কোনো Authorization তৈরি হয় না।
create or replace function public.redeem_download_code(
  p_code_hash text, p_product_id uuid, p_token_hash text, p_ip_hash text,
  p_window_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c    public.download_codes%rowtype;
  rq   public.download_requests%rowtype;
  prod public.products%rowtype;
  rd   public.download_redemptions%rowtype;
begin
  select * into c from public.download_codes where code_hash = p_code_hash for update;
  if not found or c.product_id is distinct from p_product_id then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into prod from public.products where id = c.product_id;

  if c.status = 'revoked' then
    return jsonb_build_object('result', 'revoked');
  end if;

  if c.status = 'redeemed' then
    select * into rd from public.download_redemptions
     where code_id = c.id and token_hash = p_token_hash and expires_at > now();
    if found then
      return jsonb_build_object('result', 'ok', 'resumed', true,
        'expires_at', rd.expires_at, 'product_name', prod.name, 'product_version', prod.version,
        'remaining', greatest(0, 3 - rd.issued_count));
    end if;
    return jsonb_build_object('result', 'used');
  end if;

  -- c.status = 'active'
  select * into rq from public.download_requests where id = c.request_id for update;
  if not found or rq.status <> 'approved' then
    return jsonb_build_object('result', 'invalid');
  end if;
  -- প্রোডাক্ট এখন ডাউনলোডযোগ্য না হলে কোড খরচ হয় না
  if prod.id is null or prod.status <> 'active' or prod.file_path is null or prod.file_path = '' then
    return jsonb_build_object('result', 'unavailable');
  end if;

  update public.download_codes set status = 'redeemed', redeemed_at = now() where id = c.id;
  update public.download_requests set status = 'redeemed' where id = rq.id;
  insert into public.download_redemptions (code_id, request_id, product_id, token_hash, ip_hash, expires_at)
  values (c.id, rq.id, c.product_id, p_token_hash, p_ip_hash, now() + make_interval(mins => p_window_minutes))
  returning * into rd;
  insert into public.download_audit_logs (actor_type, action, request_id, code_id, product_id, ip_hash)
  values ('customer', 'code_redeemed', rq.id, c.id, c.product_id, p_ip_hash);

  return jsonb_build_object('result', 'ok', 'resumed', false,
    'expires_at', rd.expires_at, 'product_name', prod.name, 'product_version', prod.version, 'remaining', 3);
end;
$$;

-- 10.7 Authorization থেকে Signed URL নেওয়ার অধিকার খরচ করা (সর্বোচ্চ p_max_issues বার, মেয়াদের ভিতরে)
create or replace function public.consume_download_authorization(p_token_hash text, p_max_issues integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rd   public.download_redemptions%rowtype;
  prod public.products%rowtype;
begin
  select * into rd from public.download_redemptions where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  if rd.expires_at <= now() then return jsonb_build_object('result', 'expired'); end if;
  if rd.issued_count >= p_max_issues then return jsonb_build_object('result', 'exhausted'); end if;

  select * into prod from public.products where id = rd.product_id;
  if prod.id is null or prod.file_path is null or prod.file_path = '' then
    return jsonb_build_object('result', 'unavailable');
  end if;

  update public.download_redemptions
     set issued_count = issued_count + 1,
         first_issued_at = coalesce(first_issued_at, now()),
         last_issued_at = now()
   where id = rd.id;

  return jsonb_build_object('result', 'ok', 'file_path', prod.file_path, 'product_name', prod.name,
    'product_slug', prod.slug, 'remaining', p_max_issues - (rd.issued_count + 1), 'expires_at', rd.expires_at);
end;
$$;

-- 10.8 Signed URL তৈরি ব্যর্থ হলে অধিকারটি ফেরত দেওয়া
create or replace function public.refund_download_authorization(p_token_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.download_redemptions set issued_count = greatest(0, issued_count - 1)
   where token_hash = p_token_hash;
$$;

-- 10.9 Admin Dashboard-এর আসল পরিসংখ্যান (শুধু Admin চালাতে পারবে)
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'total_products',      (select count(*) from public.products where status <> 'archived'),
    'total_requests',      (select count(*) from public.download_requests),
    'pending_requests',    (select count(*) from public.download_requests where status = 'pending'),
    'approved_requests',   (select count(*) from public.download_requests where status = 'approved'),
    'rejected_requests',   (select count(*) from public.download_requests where status = 'rejected'),
    'redeemed_codes',      (select count(*) from public.download_codes where status = 'redeemed'),
    'unused_codes',        (select count(*) from public.download_codes where status = 'active'),
    'revoked_codes',       (select count(*) from public.download_codes where status = 'revoked'),
    'popular_products',    coalesce((
        select jsonb_agg(t) from (
          select coalesce(max(p.name), max(r.product_name)) as name, count(*) as requests
          from public.download_requests r left join public.products p on p.id = r.product_id
          group by coalesce(r.product_id::text, r.product_name)
          order by count(*) desc limit 5) t), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ফাংশনের Execute অধিকার
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.approve_download_request(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.reject_download_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_download_code(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.regenerate_download_code(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.redeem_download_code(text, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.consume_download_authorization(text, integer) from public, anon, authenticated;
revoke all on function public.refund_download_authorization(text) from public, anon, authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;

grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.approve_download_request(uuid, uuid, text, text, text) to service_role;
grant execute on function public.reject_download_request(uuid, uuid, text) to service_role;
grant execute on function public.revoke_download_code(uuid, uuid, text) to service_role;
grant execute on function public.regenerate_download_code(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.redeem_download_code(text, uuid, text, text, integer) to service_role;
grant execute on function public.consume_download_authorization(text, integer) to service_role;
grant execute on function public.refund_download_authorization(text) to service_role;
grant execute on function public.admin_dashboard_stats() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. পুরনো bKash সিস্টেম বন্ধ করা (Data মোছা হয় না, শুধু Public অ্যাক্সেস বন্ধ)
-- ---------------------------------------------------------------------------
-- নতুন bKash Order আর কেউ তৈরি করতে পারবে না
drop policy if exists "Anyone can create an order" on public.orders;
-- bKash নম্বর (settings টেবিল) আর Public পড়তে পারবে না; Admin-এর Policy অক্ষত
drop policy if exists "Public can read settings" on public.settings;
-- Payment Screenshot আর কেউ আপলোড করতে পারবে না (পুরনো ফাইল Admin দেখতে পারবে)
drop policy if exists "Anyone can upload payment proof" on storage.objects;

-- ---------------------------------------------------------------------------
-- 12. Storage Bucket ও Policy
--     verification-evidence : Private; শুধু Netlify Function (service role) লেখে, Admin Function-এর
--                             মাধ্যমে Signed URL-এ দেখে। কোনো Public Policy নেই।
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-evidence', 'verification-evidence', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- নিশ্চিত করা: প্রোডাক্ট ফাইলের Bucket Private
insert into storage.buckets (id, name, public) values ('product-files', 'product-files', false)
on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

commit;
