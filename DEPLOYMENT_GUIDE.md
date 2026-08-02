# PluginHub — সম্পূর্ণ Deployment ও ব্যবহার গাইড (বাংলা)

এই Guide-এ ধাপে ধাপে দেখানো হয়েছে কীভাবে পুরো Website Setup করে Netlify Free Plan-এ Live করবেন।

---

## ধাপ ১: Supabase Account ও Project তৈরি

1. https://supabase.com এ যান, **Sign Up** করুন (GitHub দিয়ে করলে সহজ)।
2. Dashboard-এ **New Project** ক্লিক করুন।
3. Project Name দিন (যেমন `plugin-store`), একটি শক্তিশালী Database Password সেট করুন এবং সংরক্ষণ করে রাখুন।
4. Region হিসেবে যেটা আপনার Customer-দের কাছাকাছি (যেমন Singapore) বেছে নিন।
5. **Create Project** চাপুন। ১-২ মিনিট সময় লাগবে।

## ধাপ ২: Database Table তৈরি (SQL Run করা)

1. Supabase Dashboard-এর বাম পাশে **SQL Editor**-এ যান।
2. **New Query** চাপুন।
3. Project-এর `supabase/schema.sql` ফাইলের সম্পূর্ণ Code Copy করে Paste করুন।
4. **Run** চাপুন। এতে `products`, `orders`, `settings`, `admins` — ৪টি Table এবং সব Security Policy (RLS) তৈরি হয়ে যাবে।

## ধাপ ৩: Supabase Storage Bucket তৈরি

1. বাম পাশে **Storage**-এ যান।
2. **New Bucket** চাপুন এবং একে একে এই ৩টি Bucket তৈরি করুন:
   - `product-images` → **Public bucket** টিক দিন
   - `product-files` → Public **টিক দেবেন না** (Private রাখুন)
   - `payment-proofs` → Public **টিক দেবেন না** (Private রাখুন)
3. এরপর আবার **SQL Editor**-এ গিয়ে `supabase/storage-setup.sql` ফাইলের Code Paste করে Run করুন। এতে প্রতিটি Bucket-এর Access Policy সেট হয়ে যাবে।

## ধাপ ৪: Admin User তৈরি (Authentication)

1. বাম পাশে **Authentication → Users**-এ যান।
2. **Add User → Create New User** চাপুন।
3. আপনার Admin Email ও একটি শক্তিশালী Password দিন। **Auto Confirm User** অপশনটি চালু রাখুন।
4. User তৈরি হওয়ার পর তার পাশে থাকা **UUID (User ID)** Copy করুন।
5. এখন **Table Editor → admins** Table-এ যান।
6. **Insert Row** চাপুন, `user_id` Field-এ ঐ UUID Paste করে Save করুন।

> এই ধাপটি না করলে Login করলেও Admin Panel Access পাবেন না, কারণ `is_admin()` চেক এই Table-এর উপর নির্ভর করে।

## ধাপ ৫: API Keys সংগ্রহ

1. বাম পাশে **Project Settings → API**-এ যান।
2. এই ৩টি Value Copy করে কোথাও Note করে রাখুন:
   - **Project URL** (যেমন `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (⚠️ এটা অত্যন্ত গোপনীয়, কাউকে দেখাবেন না)

## ধাপ ৬: GitHub-এ Code Upload

1. https://github.com এ একটি নতুন **Private Repository** তৈরি করুন (যেমন `plugin-store`)।
2. আপনার Computer-এ Project Folder-এ গিয়ে Terminal খুলুন এবং লিখুন:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/plugin-store.git
git push -u origin main
```

## ধাপ ৭: Netlify-তে Deploy করা

1. https://netlify.com এ Account তৈরি করুন (GitHub দিয়ে করলে সহজ)।
2. Dashboard-এ **Add new site → Import an existing project** চাপুন।
3. GitHub Connect করে আপনার `plugin-store` Repository বেছে নিন।
4. Build Settings এমনিতেই Detect হয়ে যাবে (কারণ `netlify.toml` আছে):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **এখনই Deploy করবেন না।** আগে নিচের ধাপে Environment Variables বসান।

## ধাপ ৮: Netlify Environment Variables Setup

Deploy Settings Page-এ **Environment variables** সেকশনে গিয়ে এই ৪টি Variable যোগ করুন:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | আপনার Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | আপনার Supabase anon public key |
| `SUPABASE_URL` | আপনার Supabase Project URL (একই) |
| `SUPABASE_SERVICE_ROLE_KEY` | আপনার Supabase service_role key |

এরপর **Deploy Site** চাপুন। ২-৩ মিনিটের মধ্যে Build সম্পন্ন হবে এবং একটি Live URL পাবেন (যেমন `https://your-site.netlify.app`)।

> চাইলে পরে **Site settings → Domain management** থেকে নিজের Custom Domain যোগ করতে পারবেন।

## ধাপ ৯: Final Website Test

Deploy হওয়ার পর নিচের Flow টেস্ট করুন:

1. প্রথমে Admin Panel-এ Login করে একটি Test Product Add করুন (নিচের "Product Add Guide" দেখুন)।
2. Homepage-এ গিয়ে Product-টি দেখুন।
3. Product-এ ঢুকে **Buy Now** চাপুন, Checkout Page-এ Test তথ্য দিয়ে Submit করুন।
4. একটি Order ID পাবেন — সেটা Note করুন।
5. Admin Panel-এর **Orders**-এ গিয়ে Order-টি **Approve** করুন।
6. Website-এর **Order Status Check** Page-এ গিয়ে Order ID ও Email দিয়ে Check করুন — Download Button দেখা উচিত।

সব ঠিকঠাক কাজ করলে আপনার Site সম্পূর্ণভাবে Live ও Functional।

---

# Admin User Guide (দৈনন্দিন ব্যবহার)

## Admin Panel-এ Login করা

1. Browser-এ যান: `https://your-site.netlify.app/admin/login`
2. Email ও Password দিয়ে Login করুন (যেটা Supabase Authentication-এ তৈরি করেছিলেন)।

## নতুন Product Add করা

1. Admin Sidebar থেকে **Products → + New Product** চাপুন।
2. তথ্য পূরণ করুন:
   - **Product Name** — যেমন "SEO Booster Pro"
   - **Slug** — স্বয়ংক্রিয়ভাবে তৈরি হবে (চাইলে বদলাতে পারেন), এটাই URL-এ ব্যবহার হবে
   - **Short Description** — Homepage Card-এ দেখাবে
   - **Full Description** — Product Page-এ বিস্তারিত
   - **Price**, **Version**, **Compatible Software**
   - **Features** — প্রতি লাইনে একটি Feature লিখুন
3. **Product Image** Upload করুন (এটি Public থাকবে, Homepage-এ দেখাবে)।
4. **Product File (.zip)** Upload করুন — এটাই Customer Payment Approve হওয়ার পর Download করবে। এই File কখনো সরাসরি Link আকারে Public হবে না।
5. Status **Active** রেখে **Save Product** চাপুন।

## Product Edit / Price / Image / File পরিবর্তন

1. **Products** Page-এ যেকোনো Product-এর পাশে **Edit** চাপুন।
2. যেকোনো Field পরিবর্তন করে **Save Product** চাপলেই আপডেট হয়ে যাবে।
3. নতুন File বা Image আপলোড না করলে আগেরটাই থেকে যাবে।

## Product Delete করা

**Products** Page-এ পাশে থাকা **Delete** বাটনে চাপুন, Confirm করুন।

## bKash Number পরিবর্তন

Sidebar থেকে **Settings**-এ গিয়ে নতুন Number বসিয়ে **Save** চাপুন। এটি সাথে সাথে Checkout Page-এ Update হয়ে যাবে।

## Customer Order দেখা ও Payment Verify করা

1. Sidebar থেকে **Orders**-এ যান। এখানে সব Order-এর List দেখতে পাবেন, Status অনুযায়ী Filter করতে পারবেন।
2. যেকোনো Order-এ **View** চাপলে দেখবেন:
   - Customer Name, Email, Phone
   - Product ও Price
   - bKash Transaction ID
   - Payment Screenshot (ছবি হিসেবে দেখা যাবে)
   - Order Date
3. bKash App/Statement-এ গিয়ে ঐ Transaction ID টি সত্যিই আছে কিনা এবং Amount ঠিক আছে কিনা মিলিয়ে দেখুন।
4. সঠিক হলে **Approve Payment** চাপুন — সাথে সাথে Customer-এর জন্য Download Access চালু হয়ে যাবে।
5. ভুল/সন্দেহজনক হলে **Reject Payment** চাপুন।

## Dashboard-এ কী দেখবেন

Sidebar-এর **Dashboard**-এ একনজরে দেখা যাবে: Total Orders, Pending Orders, Approved Orders, Rejected Orders, এবং Total Products।

---

# Optional: Purchase Confirmation Email

বর্তমান Version-এ Email পাঠানো Implement করা নেই (আপনি বলেছিলেন এটি বাধ্যতামূলক না)। ভবিষ্যতে চাইলে সহজ উপায়:

1. https://resend.com এ Free Account খুলুন এবং একটি API Key নিন।
2. `netlify/functions/order-status.js`-এর মতো আরেকটি Function বানিয়ে `RESEND_API_KEY` Netlify Environment Variable হিসেবে যোগ করুন।
3. `AdminOrderDetail.jsx`-এর **Approve Payment** বাটনে সেই Function Call যোগ করলেই Approve হওয়ার সাথে সাথে Email চলে যাবে।

এটি সম্পূর্ণ Optional — না করলেও Website পুরোপুরি কাজ করবে।

---

# ভবিষ্যতে Official bKash Payment Gateway যোগ করা

এই Project-এর Architecture এমনভাবে রাখা হয়েছে যাতে ভবিষ্যতে সহজে bKash Official API যোগ করা যায়:

- `orders` Table-এ ইতিমধ্যে `status`, `transaction_id` Field আছে — bKash API থেকে Automatic Verification হলে সরাসরি এই Field Update করলেই হবে।
- `Checkout.jsx`-এর Manual Form-এর জায়গায় ভবিষ্যতে bKash Checkout SDK/Redirect যোগ করা যাবে, বাকি Flow (Order Tracking, Admin Approve, Secure Download) অপরিবর্তিত থাকবে।
- Netlify Functions ব্যবহার করা হয়েছে বলে bKash-এর Server-to-Server Callback/Webhook ভবিষ্যতে একটি নতুন Function হিসেবে সহজেই যোগ করা যাবে (যেমন `netlify/functions/bkash-webhook.js`)।

---

# সমস্যা হলে যা যাচাই করবেন

| সমস্যা | সম্ভাব্য কারণ |
|---|---|
| Login করলেও Admin Panel-এ ঢুকতে পারছেন না | `admins` Table-এ আপনার User ID Insert করা হয়নি |
| Product Homepage-এ দেখাচ্ছে না | Product Status "Active" আছে কিনা দেখুন |
| Checkout-এ bKash Number দেখাচ্ছে না | Settings-এ গিয়ে bKash Number Save করেছেন কিনা দেখুন |
| Order Status Check কাজ করছে না | Netlify-তে `SUPABASE_URL` ও `SUPABASE_SERVICE_ROLE_KEY` ঠিকমতো বসানো হয়েছে কিনা দেখুন |
| Download Link কাজ করছে না | Product-এ File Upload করা হয়েছে কিনা, এবং Order Approved কিনা দেখুন |
