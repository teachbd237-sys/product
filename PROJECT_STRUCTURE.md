# PluginHub — Project Folder Structure

```
plugin-store/
├── index.html                     ← App-এর Entry HTML
├── package.json                   ← Dependencies List
├── vite.config.js                 ← Vite Config
├── netlify.toml                   ← Netlify Build/Redirect/Functions Config
├── .env.example                   ← Environment Variable-এর Template (Copy করে .env বানাও)
├── .gitignore
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.jsx                   ← React App Bootstrap
│   ├── App.jsx                    ← সব Route এখানে Define করা
│   ├── index.css                  ← পুরো Design System (Colors, Layout, Components)
│   ├── supabaseClient.js          ← Supabase Connection Setup
│   │
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── ProductCard.jsx
│   │   └── ProtectedRoute.jsx     ← Admin Route Guard
│   │
│   └── pages/
│       ├── Home.jsx               ← Product List (Homepage)
│       ├── ProductPage.jsx        ← Single Product Details
│       ├── Checkout.jsx           ← bKash Payment + Proof Submit Form
│       ├── OrderTracking.jsx      ← Order ID দিয়ে Search করার Page
│       ├── PurchaseStatus.jsx     ← Order Status দেখানো + Download
│       │
│       └── admin/
│           ├── AdminLogin.jsx
│           ├── AdminLayout.jsx    ← Sidebar সহ Admin Wrapper
│           ├── AdminDashboard.jsx ← Stats (Total/Pending/Approved/Rejected/Products)
│           ├── AdminProducts.jsx  ← Product List + Delete
│           ├── AdminProductForm.jsx ← Product Add/Edit
│           ├── AdminOrders.jsx    ← Order List
│           ├── AdminOrderDetail.jsx ← Order Details + Approve/Reject
│           └── AdminSettings.jsx  ← bKash Number Change
│
├── netlify/
│   └── functions/
│       └── order-status.js        ← Customer-কে Secure Signed Download Link দেয়
│
└── supabase/
    ├── schema.sql                 ← Database Table + RLS Policy (Supabase-এ Run করবে)
    └── storage-setup.sql          ← Storage Bucket Policy (Supabase-এ Run করবে)
```

## কোন Table কী কাজ করে

| Table | কাজ |
|---|---|
| `products` | সব Plugin/Product তথ্য (Price, Description, File Path ইত্যাদি) |
| `orders` | প্রতিটি Customer-এর Order + Payment Proof + Status |
| `settings` | bKash Number-এর মতো Site Setting |
| `admins` | কোন User Admin Panel Access করতে পারবে |

## কোন Storage Bucket কী কাজ করে

| Bucket | Public/Private | কাজ |
|---|---|---|
| `product-images` | Public | Product-এর Thumbnail Image |
| `product-files` | Private | আসল Plugin File (.zip) — কখনো Direct Link দেওয়া হয় না |
| `payment-proofs` | Private | Customer-এর Payment Screenshot |
