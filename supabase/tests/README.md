# Database পরীক্ষা (ঐচ্ছিক, ডেভেলপারদের জন্য)

এই ফোল্ডারের ফাইলগুলো একটি **লোকাল, খালি Postgres Test Database**-এ Migration ও কোড-Redemption লজিক পরীক্ষা করে।
Supabase-এর `auth`/`storage` স্কিমা ও Roles নকল করা হয়েছে (`00_supabase_stub.sql`)।

**Production Supabase-এ এগুলো কখনো চালাবেন না।**

```bash
createdb sf_test
./supabase/tests/run_all.sh sf_test
```

কী পরীক্ষা হয়:

- `01_legacy_seed.sql` — পুরনো Schema-তে নমুনা Product/Order/Admin বসায়
- Migration দুইবার চলে (Idempotent) এবং পুরনো Data অক্ষত থাকে
- `02_behavior.sql` — অনুমতি (anon/অন্য ইউজার কিছুই দেখতে পায় না), Approve/Reject/Revoke/Regenerate, Cross-product কোড ব্যর্থ,
  এককালীন Redemption, একই token-এ পুনরায় চেষ্টা, Authorization সীমা, মেয়াদ, Rate limit, Duplicate রিকোয়েস্ট
- `03_concurrency.sh` — একসাথে ৩০টি আলাদা Connection থেকে একই কোড Redeem: ঠিক ১টি সফল
