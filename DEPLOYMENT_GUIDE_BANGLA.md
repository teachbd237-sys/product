# Story Frame — Production Fix: ডিপ্লয়মেন্ট গাইড (বাংলা)

> এই গাইড `story-frame-production-fixed` ভার্সনের জন্য। আমি আপনার লাইভ Supabase/Netlify দেখিনি — তাই নিচের "লাইভ যাচাই" ধাপগুলো আপনাকে নিজে করে দেখতে হবে।

## ১. আগে ব্যাকআপ নিন
1. GitHub-এ আপনার রিপোজিটরিতে যান → **Code → Download ZIP** (বা `git clone`)। ZIP-টি কম্পিউটারে রাখুন।
2. Supabase → **Database → Backups** দেখুন; সম্ভব হলে এখনই Backup নিন।
3. Netlify → **Deploys**-এ বর্তমান সফল ডিপ্লয়টি চিহ্নিত রাখুন (রোলব্যাকের জন্য)।

## ২. GitHub ফাইল প্রতিস্থাপন
1. `story-frame-production-fixed.zip` আনজিপ করুন। ভিতরের ফোল্ডারের **ভিতরের ফাইলগুলো** রিপোজিটরির রুটে রাখতে হবে (ফোল্ডারটি নিজে নয়)।
2. পুরনো প্রজেক্ট ফোল্ডারে (git clone করা) পুরনো ফাইল মুছে নতুন ফাইল কপি করুন। **`.git` ফোল্ডার মুছবেন না।**
3. `.env` ফাইল কখনো আপলোড করবেন না।
4. `git add . && git commit -m "Production fix: Node 22 + admin fixes" && git push`

## ৩. Netlify Node Runtime (সবচেয়ে গুরুত্বপূর্ণ)
- **আসল সমস্যা:** আগের `netlify.toml`-এ `NODE_VERSION = "20"` ছিল, যা Dashboard-এর `NODE_VERSION=22`-কে Override করত। এখন `netlify.toml`-এ `22` আছে।
- Netlify Functions-এর Runtime ডিফল্টভাবে Build-এর Node ভার্সন অনুসরণ করে। তাই Build Node = 22 মানে Functions Node = 22।
- ঐচ্ছিক: Dashboard → **Site configuration → Environment variables** → `AWS_LAMBDA_JS_RUNTIME` = `nodejs22.x` (শুধু Dashboard-এ কাজ করে, `netlify.toml`-এ নয়)।
- Build Log-এ দেখবেন `✔ Node 22.x (>= 22) ঠিক আছে।` — Node কম হলে Build ইচ্ছাকৃতভাবে ব্যর্থ হবে।

## ৪. প্রয়োজনীয় Environment Variables (নাম অপরিবর্তিত)
| নাম | কোথায় |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser (গোপন নয়) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | শুধু Functions (**গোপন**) |
| `CODE_SECRET` (৩২+ অক্ষর) | শুধু Functions; লাইভের পর বদলাবেন না |

GitHub আপলোডে এই মানগুলো আপনাআপনি আপডেট হয় না — Netlify Dashboard থেকে নিজে ঠিক আছে কিনা দেখুন।

## ৫. SQL Migration লাগবে কি?
- `upgrade_free_download.sql` আগে চালানো থাকলে **এবার শুধু `supabase/migrations/fix_production_issues.sql`** চালান: Supabase → **SQL Editor** → Paste → Run।
- এটি কোনো ডাটা মোছে না, বারবার চালানো নিরাপদ। এটি অনুপস্থিত কলাম যোগ করে, `service_role`-এর অনুমতি নিশ্চিত করে এবং `notify pgrst, 'reload schema'` দিয়ে Schema Cache রিফ্রেশ করে (যা `'category' column ... schema cache` Error-এর সম্ভাব্য কারণ)।
- আগেরটি কখনোই না চালিয়ে থাকলে আগে `supabase/MIGRATION_GUIDE.md` অনুসরণ করুন।

## ৬. ডিপ্লয়
GitHub-এ Push করলে Netlify নিজে Build করবে। **Deploys → Production deploy → Building → Published** দেখুন। ব্যর্থ হলে Log-এর শেষ অংশ দেখুন।

## ৭. Function Logs দেখা
Netlify → **Logs → Functions → admin-api**। Error হলে Log-এ `E-XXXXXXXX` আইডি থাকে; Admin Panel-এর Error বার্তায় একই আইডি দেখা যায় — মিলিয়ে আসল কারণ পাবেন।

## ৮. WebSocket ক্র্যাশ ঠিক হয়েছে কিনা যাচাই (লাইভে)
1. Admin Panel-এ লগইন করে **ডাউনলোড কোড** পেজ খুলুন।
2. Browser DevTools → Network → `admin-api` → Status **200** হওয়া উচিত (কোড না থাকলে খালি তালিকা + "এখনো কোনো ডাউনলোড কোড তৈরি হয়নি।")।
3. Function Log-এ `native WebSocket not found` আর থাকা উচিত নয়। 
4. কয়েক ঘণ্টা পর এবং একটি নতুন Deploy-এর পরেও আবার দেখুন (আগে সাময়িক ঠিক হয়ে ফিরে এসেছিল)।

## ৯. ভেরিফিকেশন ধাপ পরীক্ষা
Admin → **ভেরিফিকেশন ধাপ** → "+ YouTube" → সেভ। এডিট, সুইচ বন্ধ/চালু, ডিলিট করে দেখুন। একই ধাপ দুইবার সেভ করলে "আগে থেকেই আছে" আসবে। কোনো প্রোডাক্টের ভেরিফিকেশন "Global" থাকলে সেই প্রোডাক্টের রিকোয়েস্ট পেজে Global ধাপ দেখাবে।

## ১০. ডাউনলোড কোড পেজ পরীক্ষা
কোড না থাকলে খালি বার্তা; ফিল্টার (Active/Redeemed/Revoked) কাজ করছে কিনা দেখুন। Error এলে "আবার চেষ্টা করুন" বাটন আসবে।

## ১১. পূর্ণ ওয়ার্কফ্লো পরীক্ষা (একটি টেস্ট প্রোডাক্টে)
প্রোডাক্ট পেজ → Get Free Access → ধাপ ও স্ক্রিনশট → নাম/ইমেইল/WhatsApp → সাবমিট → Admin-এ রিকোয়েস্ট → স্ক্রিনশট দেখে Approve → কোড → "WhatsApp-এ পাঠান" (এতে "Sent" চিহ্ন **নিজে হয় না**; হাতে "Sent চিহ্নিত করুন") → প্রোডাক্ট পেজে কোড দিন → ডাউনলোড → একই কোড আবার দিলে "ব্যবহৃত" আসবে।

## ১২. কিছু ভাঙলে রোলব্যাক
- Netlify → Deploys → আগের সফল ডিপ্লয় → **Publish deploy**।
- GitHub-এ: `git revert HEAD && git push`।
- SQL: `fix_production_issues.sql` কোনো ডাটা বদলায় না, তাই রোলব্যাক সাধারণত লাগে না।
