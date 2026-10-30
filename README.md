# Story Frame — Free Digital Product Platform

React + Vite frontend · Netlify Functions · Supabase (Postgres, Auth, private Storage)

**কীভাবে কাজ করে:** গ্রাহক প্রোডাক্ট বেছে → Admin-নির্ধারিত সোশ্যাল ধাপ সম্পন্ন করে স্ক্রিনশটসহ রিকোয়েস্ট পাঠায় →
Admin স্ক্রিনশট দেখে Approve করে → সিস্টেম একটি ইউনিক এককালীন কোড তৈরি করে → Admin **নিজে** `wa.me` লিংকে WhatsApp-এ কোড পাঠায় →
গ্রাহক প্রোডাক্ট পেজে কোড দিয়ে ডাউনলোড করে (কোড একবারই চলে)। কোনো পেমেন্ট নেই; WhatsApp-এ স্বয়ংক্রিয় পাঠানো নেই।

শুরু করুন: **`DEPLOYMENT_GUIDE_BANGLA.md`** (ধাপে ধাপে বাংলা গাইড)।

## Environment variables

| নাম | কোথায় | বর্ণনা |
|---|---|---|
| `VITE_SUPABASE_URL` | Netlify (Build) | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Netlify (Build) | anon/public key (গোপন নয়) |
| `SUPABASE_URL` | Netlify (Functions) | একই Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify (Functions) — **গোপন** | Browser-এ কখনো যায় না |
| `CODE_SECRET` | Netlify (Functions) — **গোপন** | ≥৩২ অক্ষর; কোড HMAC/AES Key-এর উৎস। Live হওয়ার পর বদলাবেন না |

## Scripts

```bash
npm install
npm run dev        # লোকাল (.env লাগবে)
npm run build      # Production build → dist/
npm test           # Automated tests (shared logic, Functions, SSR render)
```

Database পরীক্ষা (লোকাল Postgres লাগে): `supabase/tests/README.md`।

## নিরাপত্তা সারাংশ

- কোড: `crypto.randomInt` দিয়ে ৮০-বিট; DB-তে শুধু HMAC-SHA256 Hash + AES-256-GCM ciphertext (Admin পুনরায় পাঠানোর জন্য); Browser-এ কোনো Policy নেই।
- Redemption: Postgres ফাংশনে `SELECT … FOR UPDATE` — একই সময়ে একাধিক চেষ্টায় ঠিক একটি সফল। Browser-এর গোপন token দিয়ে Refresh/Network ব্যর্থতায় একই Redemption আবার চালু হয়; নতুন Authorization তৈরি হয় না।
- ডাউনলোড: Private Bucket; ২ মিনিটের Signed URL; ৩০ মিনিটে সর্বোচ্চ ৩টি।
- Screenshot: Private Bucket; Server-এ ছবির Magic-byte যাচাই; শুধু Admin Function ১০ মিনিটের Signed URL দেয়।
- Rate limit: Database-ভিত্তিক (Netlify Stateless); সমস্যা হলে বন্ধ (fail closed)।
- Admin Function প্রতি Request-এ Supabase Token + `admins` টেবিল Server-এ যাচাই করে।
