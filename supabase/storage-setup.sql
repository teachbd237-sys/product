-- ============================================================
-- PluginHub — Supabase Storage Setup
-- প্রথমে Dashboard > Storage-এ গিয়ে নিচের ৩টি Bucket তৈরি করুন,
-- তারপর এই SQL Editor Script রান করুন Policy বসানোর জন্য।
--
-- Bucket তৈরি করুন:
-- 1. product-images   -> Public bucket (Product Thumbnail-এর জন্য)
-- 2. product-files     -> Private bucket (আসল Plugin File, কখনো Public না)
-- 3. payment-proofs    -> Private bucket (Payment Screenshot)
-- ============================================================

-- ---------- product-images (Public Read, Admin Write) ----------
create policy "Public read product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Admin upload product images"
on storage.objects for insert
with check (bucket_id = 'product-images' and is_admin());

create policy "Admin update product images"
on storage.objects for update
using (bucket_id = 'product-images' and is_admin());

create policy "Admin delete product images"
on storage.objects for delete
using (bucket_id = 'product-images' and is_admin());

-- ---------- product-files (কারো Direct Access নেই, শুধু Admin এবং Netlify Function/Service Role) ----------
create policy "Admin read product files"
on storage.objects for select
using (bucket_id = 'product-files' and is_admin());

create policy "Admin upload product files"
on storage.objects for insert
with check (bucket_id = 'product-files' and is_admin());

create policy "Admin update product files"
on storage.objects for update
using (bucket_id = 'product-files' and is_admin());

create policy "Admin delete product files"
on storage.objects for delete
using (bucket_id = 'product-files' and is_admin());

-- Customer কখনোই এই Bucket সরাসরি পড়তে পারবে না।
-- Approved Order-এর Customer, Netlify Function-এর মাধ্যমে একটি সাময়িক Signed URL পাবে,
-- যেটি Service Role Key ব্যবহার করে তৈরি হয় (RLS বাইপাস করে, কিন্তু শুধুমাত্র
-- Backend Function-এর ভিতরেই এই Key ব্যবহার হয়)।

-- ---------- payment-proofs (Customer Upload করতে পারবে, শুধু Admin পড়তে পারবে) ----------
create policy "Anyone can upload payment proof"
on storage.objects for insert
with check (bucket_id = 'payment-proofs');

create policy "Admin read payment proofs"
on storage.objects for select
using (bucket_id = 'payment-proofs' and is_admin());
