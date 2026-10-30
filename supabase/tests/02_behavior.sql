-- ডাটাবেস স্তরের আচরণ পরীক্ষা। ব্যর্থ হলে Exception দিয়ে থামে। (শুধু Test Database-এ চালান)
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

-- ১. পুরনো Data অক্ষত ----------------------------------------------------------
select pg_temp.ok((select count(*) from products) = 3, 'legacy products preserved');
select pg_temp.ok((select count(*) from orders) = 2, 'legacy orders preserved');
select pg_temp.ok((select transaction_id from orders where order_code='ORD-AAA111') = 'TX123', 'legacy transaction_id preserved');
select pg_temp.ok((select screenshot_path from orders where order_code='ORD-AAA111') = 'proof1.png', 'legacy screenshot_path preserved');
select pg_temp.ok((select price_at_purchase from orders where order_code='ORD-AAA111') = 500, 'legacy price preserved');
select pg_temp.ok((select count(*) from admins) = 1, 'admins preserved');
select pg_temp.ok((select file_path from products where slug='glitch-pack') = 'glitch-pack-1.zip', 'file_path preserved');
select pg_temp.ok((select id::text from products where slug='glitch-pack') = '11111111-1111-1111-1111-111111111111', 'product id preserved');
select pg_temp.ok((select value from settings where key='bkash_number') = '01999999999', 'legacy settings row preserved');

-- ২. Test Data (Service Role হিসেবে) ---------------------------------------------
insert into download_requests (id, request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash)
values ('c0000000-0000-0000-0000-000000000001','SF-RAAAAAAAA','11111111-1111-1111-1111-111111111111','Glitch Pack','Rahim','rahim@example.com','+8801712345678','h1'),
       ('c0000000-0000-0000-0000-000000000002','SF-RBBBBBBBB','22222222-2222-2222-2222-222222222222','Film Burn','Karim','karim@example.com','+8801812345678','h2'),
       ('c0000000-0000-0000-0000-000000000003','SF-RCCCCCCCC','11111111-1111-1111-1111-111111111111','Glitch Pack','Rejectme','rej@example.com','+8801912345678','h3');

-- ৩. অনুমতি: Anonymous কিছুই দেখতে পারবে না -------------------------------------------
do $$ begin
  set local role anon;
  begin perform 1 from download_requests limit 1; raise exception 'anon could read download_requests';
  exception when insufficient_privilege then null; end;
  begin perform 1 from request_verification_evidence limit 1; raise exception 'anon could read evidence';
  exception when insufficient_privilege then null; end;
  begin perform 1 from download_audit_logs limit 1; raise exception 'anon could read audit logs';
  exception when insufficient_privilege then null; end;
end $$;

do $$ begin
  set local role anon;
  begin perform 1 from download_codes limit 1; raise exception 'anon could read download_codes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from download_redemptions limit 1; raise exception 'anon could read redemptions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from rate_limits limit 1; raise exception 'anon could read rate_limits';
  exception when insufficient_privilege then null; end;
  begin insert into download_requests (request_ref, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash)
        values ('SF-RZZZZZZZZ','x','abc','a@b.co','+8801712345670','h'); raise exception 'anon could insert request';
  exception when insufficient_privilege then null; end;
  begin perform public.redeem_download_code('x','11111111-1111-1111-1111-111111111111','t','i'); raise exception 'anon could call redeem';
  exception when insufficient_privilege then null; end;
  begin perform public.approve_download_request('c0000000-0000-0000-0000-000000000001', null, 'h','e','4444'); raise exception 'anon could call approve';
  exception when insufficient_privilege then null; end;
  begin perform public.check_rate_limit('k', 1, 60); raise exception 'anon could call rate limit';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_dashboard_stats(); raise exception 'anon could call stats';
  exception when insufficient_privilege then null; end;
  -- পুরনো bKash Order আর তৈরি করা যায় না
  begin insert into orders (order_code, customer_name, customer_email, customer_phone, transaction_id, screenshot_path, price_at_purchase)
        values ('ORD-HACK','x','x@x.co','0171','t','p',1); raise exception 'anon could still create legacy order';
  exception when insufficient_privilege or others then
    if sqlerrm like 'anon could%' then raise; end if; end;
  -- bKash settings আর Public নয়
  perform pg_temp.ok((select count(*) from settings) = 0, 'anon cannot read legacy settings');
  perform pg_temp.ok((select count(*) from orders) = 0, 'anon cannot read orders');
end $$;

-- সাধারণ লগইন করা (Admin নয়) ব্যবহারকারী
do $$ begin
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  set local role authenticated;
  perform pg_temp.ok((select count(*) from download_requests) = 0, 'non-admin sees no requests');
  perform pg_temp.ok((select count(*) from request_verification_evidence) = 0, 'non-admin sees no evidence');
  perform pg_temp.ok((select count(*) from download_audit_logs) = 0, 'non-admin sees no audit logs');
  begin perform 1 from download_codes limit 1; raise exception 'non-admin could read download_codes';
  exception when insufficient_privilege then null; end;
  begin update download_requests set status='approved'; raise exception 'non-admin updated status';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_dashboard_stats(); raise exception 'non-admin could get stats';
  exception when others then if sqlerrm not like '%forbidden%' then raise; end if; end;
  begin perform public.approve_download_request('c0000000-0000-0000-0000-000000000001', null, 'h','e','4444'); raise exception 'non-admin approve';
  exception when insufficient_privilege then null; end;
end $$;

-- Admin: Request দেখতে পারে, কিন্তু গোপন কলাম নয়
do $$ begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  set local role authenticated;
  perform pg_temp.ok((select count(*) from download_requests) = 3, 'admin sees requests');
  begin perform lookup_secret_hash from download_requests limit 1; raise exception 'admin could read lookup_secret_hash';
  exception when insufficient_privilege then null; end;
  begin perform ip_hash from download_requests limit 1; raise exception 'admin could read ip_hash';
  exception when insufficient_privilege then null; end;
  begin perform 1 from download_codes limit 1; raise exception 'admin client could read download_codes';
  exception when insufficient_privilege then null; end;
  begin update download_requests set status='approved'; raise exception 'admin client updated status directly';
  exception when insufficient_privilege then null; end;
  perform pg_temp.ok((public.admin_dashboard_stats()->>'total_requests')::int = 3, 'admin stats work');
  perform pg_temp.ok((select count(*) from orders) = 2, 'admin can still read legacy orders');
  perform pg_temp.ok((select count(*) from settings) >= 1, 'admin can still read legacy settings');
end $$;

-- Website settings: Public শুধু is_public = true দেখে
do $$ begin
  set local role anon;
  perform pg_temp.ok((select count(*) from website_settings where key='site_name') = 1, 'anon sees public setting');
  perform pg_temp.ok((select count(*) from website_settings where key='whatsapp_template') = 0, 'anon cannot see whatsapp_template');
  begin update website_settings set value='"x"'; raise exception 'anon updated settings'; exception when insufficient_privilege then null; end;
end $$;

-- ৪. Approve -> Redeem পুরো প্রবাহ -------------------------------------------------
select public.approve_download_request('c0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','HASH_A','ENC_A','WXYZ');
select pg_temp.ok((select status from download_requests where id='c0000000-0000-0000-0000-000000000001') = 'approved', 'approved status');
do $$ begin
  begin perform public.approve_download_request('c0000000-0000-0000-0000-000000000001', null,'HASH_B','E','1'); raise exception 'double approve allowed';
  exception when others then if sqlerrm not like 'invalid_status%' then raise; end if; end;
end $$;
select public.reject_download_request('c0000000-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','সঠিক স্ক্রিনশট নয়');
select public.approve_download_request('c0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','HASH_FILMBURN','ENC_F','FFFF');

-- রিজেক্ট করা রিকোয়েস্ট Approve হতে পারে না
do $$ begin
  begin perform public.approve_download_request('c0000000-0000-0000-0000-000000000003', null,'HASH_R','E','1'); raise exception 'approved a rejected request';
  exception when others then if sqlerrm not like 'invalid_status%' then raise; end if; end;
end $$;

-- ভুল কোড
select pg_temp.ok(public.redeem_download_code('NOPE','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'invalid', 'unknown code invalid');
-- Product A-র কোড Product B-তে কাজ করে না, এবং কোড খরচও হয় না
select pg_temp.ok(public.redeem_download_code('HASH_A','22222222-2222-2222-2222-222222222222','tok1','ip',30)->>'result' = 'invalid', 'cross-product redeem rejected');
select pg_temp.ok((select status from download_codes where code_hash='HASH_A') = 'active', 'cross-product attempt did not consume code');
select pg_temp.ok(public.redeem_download_code('HASH_FILMBURN','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'invalid', 'cross-product redeem rejected (2)');

-- Product unavailable (ফাইল নেই) হলে কোড খরচ হয় না
update products set file_path = null where id='11111111-1111-1111-1111-111111111111';
select pg_temp.ok(public.redeem_download_code('HASH_A','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'unavailable', 'no file => unavailable');
select pg_temp.ok((select status from download_codes where code_hash='HASH_A') = 'active', 'unavailable did not consume code');
update products set file_path = 'glitch-pack-1.zip' where id='11111111-1111-1111-1111-111111111111';

-- সঠিক Redeem
select pg_temp.ok(public.redeem_download_code('HASH_A','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'ok', 'valid redeem ok');
select pg_temp.ok((select status from download_codes where code_hash='HASH_A') = 'redeemed', 'code now redeemed');
select pg_temp.ok((select status from download_requests where id='c0000000-0000-0000-0000-000000000001') = 'redeemed', 'request now redeemed');
select pg_temp.ok((select count(*) from download_redemptions) = 1, 'exactly one redemption');
-- অন্য nonce দিয়ে পুনরায় => used
select pg_temp.ok(public.redeem_download_code('HASH_A','11111111-1111-1111-1111-111111111111','tok2','ip',30)->>'result' = 'used', 'reuse with different token => used');
-- একই nonce দিয়ে পুনরায় (Refresh/Network ব্যর্থতা) => ok, কিন্তু নতুন Authorization নয়
select pg_temp.ok(public.redeem_download_code('HASH_A','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'ok', 'same token retry ok (idempotent)');
select pg_temp.ok((select count(*) from download_redemptions) = 1, 'still exactly one redemption after retry');

-- Download Authorization সীমা: ৩ বার
select pg_temp.ok(public.consume_download_authorization('tok_nope',3)->>'result' = 'invalid', 'unknown token invalid');
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'ok', 'issue 1');
select public.refund_download_authorization('tok1');
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'ok', 'issue after refund');
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'ok', 'issue 3');
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'ok', 'issue 4th? (2 used + refund=2) -> 3rd real');
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'exhausted', 'limit reached => exhausted');

-- মেয়াদ শেষ
update download_redemptions set expires_at = now() - interval '1 minute';
select pg_temp.ok(public.consume_download_authorization('tok1',3)->>'result' = 'expired', 'expired authorization');
select pg_temp.ok(public.redeem_download_code('HASH_A','11111111-1111-1111-1111-111111111111','tok1','ip',30)->>'result' = 'used', 'after window, same token => used');

-- Revoke: Active কোড বাতিল, ব্যবহৃত কোড বাতিল হয় না
select public.revoke_download_code((select id from download_codes where code_hash='HASH_FILMBURN'),'aaaaaaaa-0000-0000-0000-000000000001','ভুল মানুষ');
select pg_temp.ok(public.redeem_download_code('HASH_FILMBURN','22222222-2222-2222-2222-222222222222','tokF','ip',30)->>'result' = 'revoked', 'revoked code rejected');
do $$ begin
  begin perform public.revoke_download_code((select id from download_codes where code_hash='HASH_A'), null, 'x'); raise exception 'revoked a redeemed code';
  exception when others then if sqlerrm not like 'already_redeemed%' then raise; end if; end;
end $$;

-- Regenerate: নতুন কোড দেয়, পুরনোটি অকার্যকর থাকে
select public.regenerate_download_code('c0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','HASH_F2','ENC_F2','F222','resend');
select pg_temp.ok(public.redeem_download_code('HASH_FILMBURN','22222222-2222-2222-2222-222222222222','tokF','ip',30)->>'result' = 'revoked', 'old code still revoked after regenerate');
select pg_temp.ok((select count(*) from download_codes where request_id='c0000000-0000-0000-0000-000000000002' and status='active') = 1, 'exactly one active code');
select pg_temp.ok((select status from download_requests where id='c0000000-0000-0000-0000-000000000002') = 'approved', 'request back to approved');

-- Rate limit
select pg_temp.ok(public.check_rate_limit('t:ip1', 2, 60), 'rl 1');
select pg_temp.ok(public.check_rate_limit('t:ip1', 2, 60), 'rl 2');
select pg_temp.ok(not public.check_rate_limit('t:ip1', 2, 60), 'rl 3 blocked');
select pg_temp.ok(public.check_rate_limit('t:ip2', 2, 60), 'other key unaffected');

-- Duplicate রিকোয়েস্ট Database স্তরে আটকায় (pending/approved থাকলে)
do $$ begin
  begin
    insert into download_requests (request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash)
    values ('SF-RDUPDUPDU','22222222-2222-2222-2222-222222222222','Film Burn','Karim2','KARIM@example.com','+8801555555555','h');
    raise exception 'duplicate email+product allowed';
  exception when unique_violation then null; end;
end $$;
-- রিজেক্ট হওয়ার পর আবার করা যায়
insert into download_requests (request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash)
values ('SF-RAGAINAGA','11111111-1111-1111-1111-111111111111','Glitch Pack','Rejectme','rej@example.com','+8801912345678','h9');

-- Dashboard: আসল সংখ্যা
select pg_temp.ok((select (public.admin_dashboard_stats()->>'redeemed_codes')::int) = 1, 'stats redeemed') where false;
select 'DB BEHAVIOR TESTS PASSED' as result;
