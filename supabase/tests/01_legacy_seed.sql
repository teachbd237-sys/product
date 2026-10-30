-- পুরনো (bKash) Production Database-এর নমুনা Data — Migration Data মোছে কিনা পরীক্ষার জন্য
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'customer@example.com');
insert into admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into products (id, name, slug, price, version, file_path, status, short_description)
values ('11111111-1111-1111-1111-111111111111', 'Glitch Pack', 'glitch-pack', 500, '1.2.0', 'glitch-pack-1.zip', 'active', 'old'),
       ('22222222-2222-2222-2222-222222222222', 'Film Burn', 'film-burn', 300, '2.0', 'film-burn.zip', 'active', 'old'),
       ('33333333-3333-3333-3333-333333333333', 'Hidden Old', 'hidden-old', 100, '1.0', 'x.zip', 'inactive', 'old');
insert into orders (order_code, product_id, customer_name, customer_email, customer_phone, transaction_id, screenshot_path, price_at_purchase, status)
values ('ORD-AAA111', '11111111-1111-1111-1111-111111111111', 'Old Buyer', 'old@example.com', '01712345678', 'TX123', 'proof1.png', 500, 'approved'),
       ('ORD-BBB222', '22222222-2222-2222-2222-222222222222', 'Old Buyer 2', 'old2@example.com', '01812345678', 'TX456', 'proof2.png', 300, 'pending');
update settings set value = '01999999999' where key = 'bkash_number';
insert into storage.buckets (id, name, public) values ('product-images','product-images',true),('product-files','product-files',false),('payment-proofs','payment-proofs',false);
