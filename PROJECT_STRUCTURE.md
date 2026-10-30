# Story Frame — Project Structure

```
├── index.html, package.json, package-lock.json, vite.config.js, netlify.toml, .env.example
├── shared/                         Frontend ও Netlify Function দুই জায়গায় ব্যবহৃত কোড
│   ├── phone.js                    ফোন normalize (+880 ডিফল্ট, E.164)
│   ├── validation.js               নাম/ইমেইল/URL/ছবির Magic-byte যাচাই
│   ├── codes.js                    কোড Format/Normalize
│   ├── requirements.js             কোন প্রোডাক্টে কোন সোশ্যাল ধাপ প্রযোজ্য
│   ├── settingsSchema.js           Admin Settings-এর সব ফিল্ড + Server Validation
│   ├── defaults.js                 Default বাংলা লেখা
│   └── whatsapp.js                 মেসেজ টেমপ্লেট ও wa.me লিংক
├── netlify/functions/
│   ├── request-submit.js           গ্রাহকের রিকোয়েস্ট জমা (Server-side যাচাই + Screenshot আপলোড)
│   ├── request-status.js           Reference + Status Key দিয়ে নিরাপদ স্ট্যাটাস
│   ├── code-redeem.js              কোড Atomic Redeem
│   ├── download-file.js            ২ মিনিটের Signed URL (সর্বোচ্চ ৩ বার/৩০ মিনিট)
│   ├── admin-api.js                Approve/Reject/Revoke/Regenerate/Settings/Requirements
│   └── _lib/                       supabase, crypto, http, ratelimit, auth, audit
├── src/
│   ├── App.jsx, main.jsx, index.css (Design System), supabaseClient.js
│   ├── lib/                        api, settings Provider, image, clientToken, myRequests, format
│   ├── components/                 Navbar, Footer, ProductCard, RedeemCard, ProtectedRoute, ui
│   └── pages/                      Home, ProductPage, RequestPage, RequestStatus
│       └── admin/                  Dashboard, Requests, RequestDetail, Codes, Products, ProductForm,
│                                   Requirements, Settings, LegacyOrders, Layout, Login
├── supabase/
│   ├── schema.sql, storage-setup.sql      মূল (আগের) Baseline
│   ├── migrations/upgrade_free_download.sql
│   ├── rollback_free_download.sql
│   ├── MIGRATION_GUIDE.md
│   └── tests/                      Database পরীক্ষা (ঐচ্ছিক)
└── tests/                          Automated Test (npm test)
```
