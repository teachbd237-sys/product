# Supabase Migration Guide — bKash সিস্টেম থেকে ফ্রি ডাউনলোড সিস্টেমে

ফাইল: `supabase/migrations/upgrade_free_download.sql`

> ⚠️ GitHub-এ নতুন ফাইল আপলোড করলে Supabase-এর Table, Policy বা Storage **নিজে নিজে বদলায় না**।
> এই SQL আপনাকে নিজে একবার Supabase SQL Editor-এ চালাতে হবে।

## এই Migration কী করে

**যোগ করে:** `website_settings`, `verification_requirements`, `download_requests`, `request_verification_evidence`,
`download_codes`, `download_redemptions`, `download_audit_logs`, `rate_limits` টেবিল; `products`-এ কয়েকটি নতুন কলাম
(`verification_mode`, `is_featured`, `sort_order`, `category`, `cta_label`, `updated_at`); `verification-evidence` নামের Private Storage Bucket;
কোড তৈরি/ব্যবহারের নিরাপদ ফাংশন; কঠোর RLS Policy।

**বন্ধ করে (ডাটা না মুছে):** নতুন bKash Order তৈরির Public Policy, bKash নম্বর Public-এ পড়ার Policy, Payment Screenshot আপলোডের Public Policy।

**কিছুই মোছে না:** `products` (আইডি, ফাইল পাথ সহ), `orders` (`transaction_id`, `screenshot_path`, `price_at_purchase` সহ), `settings` (bKash নম্বর সহ), `admins`।

পুরনো অর্ডার Admin Panel-এর **"পুরনো অর্ডার (আর্কাইভ)"** পেজে শুধু-পড়ার জন্য থাকবে।

নিরাপদে বারবার চালানো যায় (Idempotent)। পুরো ফাইল একটি Transaction-এ চলে — মাঝপথে ভুল হলে কিছুই বদলায় না।

## ধাপ ১ — Backup নিন (বাধ্যতামূলক)

Supabase Dashboard → **Table Editor** → প্রতিটি টেবিল (`products`, `orders`, `settings`, `admins`) খুলে ডান উপরের মেনু থেকে **Export → CSV** করে ডাউনলোড করুন।

(ঐচ্ছিক, উন্নত: কম্পিউটারে `pg_dump` থাকলে Dashboard → Project Settings → Database থেকে Connection string নিয়ে
`pg_dump "<connection-string>" -f backup.sql` চালান।)

Storage ফাইল (`product-files`) আপনার কম্পিউটারে মূল কপি আছে কিনা নিশ্চিত করুন। এই Migration Storage-এর ফাইল মোছে না।

## ধাপ ২ — Migration চালান

1. Supabase Dashboard → **SQL Editor** → **New query**।
2. `supabase/migrations/upgrade_free_download.sql` ফাইলটি খুলে **পুরো লেখা** Copy করে Paste করুন।
3. **Run** চাপুন।
4. নিচে "Success. No rows returned" দেখালে সফল। লাল Error দেখালে কিছুই বদলায়নি (Transaction ফিরে গেছে) — Error লেখাটি সংরক্ষণ করে সাহায্য নিন।

## ধাপ ৩ — যাচাই করুন

SQL Editor-এ চালান:

```sql
select (select count(*) from products) as products,
       (select count(*) from orders)   as old_orders,
       (select count(*) from admins)   as admins,
       (select count(*) from download_requests) as new_requests;
```
`products`, `old_orders`, `admins`-এর সংখ্যা Migration-এর আগের সমান হবে; `new_requests` হবে ০।

**Storage → Buckets** দেখুন: `verification-evidence` (Private), `product-files` (Private), `product-images` (Public) থাকতে হবে।
`product-files` ও `verification-evidence`-এর পাশে "Public" লেখা থাকলে সেটি ভুল — Bucket Settings থেকে Private করুন।

## ধাপ ৪ — Admin তৈরি/যাচাই

আপনার আগের Admin একাউন্ট ও `admins` টেবিল অক্ষত আছে; নতুন কিছু করতে হবে না।
নতুন Admin যোগ করতে: Authentication → Users-এ ইউজার বানিয়ে তার UUID `admins` টেবিলে Insert করুন (Table Editor)।

## Rollback (ফিরে যাওয়া)

1. `supabase/rollback_free_download.sql` Copy করে SQL Editor-এ Run করুন।
   - নতুন টেবিলগুলো (রিকোয়েস্ট, কোড, লগ ইত্যাদি) মুছে যায় — আগে Export করে রাখুন।
   - পুরনো Data (`products`, `orders`, `settings`, `admins`) অক্ষত থাকে।
   - পুরনো Public Policy ফিরে আসে (পুরনো Website কোডের জন্য)।
2. GitHub-এ আগের কোড ফিরিয়ে আনুন (Netlify → Deploys → পুরনো সফল Deploy → **Publish deploy**)।
3. কিছু ভুলভাবে নষ্ট হলে ধাপ ১-এর CSV Backup থেকে Table Editor → Import দিয়ে ফেরত আনুন।

> `verification-evidence` Bucket-এর ছবি Rollback-এ মোছে না; দরকার না হলে Storage থেকে নিজে মুছুন।

## নিরাপত্তা নোট (কী কী বন্ধ আছে)

- `download_codes`, `download_redemptions`, `rate_limits`: কোনো Browser Policy নেই — শুধু Netlify Function (Service Role) ব্যবহার করে। Admin-ও Browser থেকে কোড Hash দেখতে পারে না।
- `download_requests`: শুধু Admin পড়তে পারে, এবং `lookup_secret_hash` ও `ip_hash` কলাম Browser-এ পড়া যায় না। কোনো Insert/Update Policy নেই।
- ফাংশনগুলো (`redeem_download_code`, `approve_download_request` ইত্যাদি) `SECURITY DEFINER`, `search_path` লক করা, এবং `PUBLIC/anon/authenticated`-এর Execute অধিকার বাতিল — শুধু `service_role` চালাতে পারে।
  একমাত্র ব্যতিক্রম `admin_dashboard_stats()` — এটি ভিতরে `is_admin()` যাচাই করে।
- `verification-evidence`-এ কোনো Public/Anon Policy নেই; ছবি শুধু Netlify Function লেখে ও Admin Function ১০ মিনিটের Signed URL দেয়।
