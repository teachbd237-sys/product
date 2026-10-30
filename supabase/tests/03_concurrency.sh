#!/bin/bash
# একই কোড একসাথে অনেকগুলো আলাদা Connection থেকে Redeem করার চেষ্টা — ঠিক একটি সফল হতে হবে।
# ব্যবহার (শুধু Test Database-এ): DB=sf_test ./03_concurrency.sh
DB=${DB:-sf_test}
P="psql -q -tA -d $DB -v ON_ERROR_STOP=0"
PROD=11111111-1111-1111-1111-111111111111
$P <<SQL >/dev/null
insert into download_requests (id, request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash)
values ('c0000000-0000-0000-0000-0000000000a1','SF-RCONCUR01','$PROD','Glitch Pack','Conc','conc@example.com','+8801700000001','h'),
       ('c0000000-0000-0000-0000-0000000000a2','SF-RCONCUR02','$PROD','Glitch Pack','Conc2','conc2@example.com','+8801700000002','h')
on conflict do nothing;
SQL

echo "--- ১. ৩০টি আলাদা Browser (আলাদা nonce) একই কোড Redeem করছে"
$P -c "select public.approve_download_request('c0000000-0000-0000-0000-0000000000a1', null, 'CONC_HASH_1', 'enc', 'ABCD')" >/dev/null
rm -f /tmp/conc1.out
for i in $(seq 1 30); do
  $P -c "select public.redeem_download_code('CONC_HASH_1', '$PROD', 'nonce_$i', 'ip', 30)->>'result'" >> /tmp/conc1.out &
done
wait
OKS=$(grep -c '^ok$' /tmp/conc1.out); USED=$(grep -c '^used$' /tmp/conc1.out)
ROWS=$($P -c "select count(*) from download_redemptions where code_id=(select id from download_codes where code_hash='CONC_HASH_1')")
echo "ok=$OKS used=$USED redemption_rows=$ROWS"
[ "$OKS" = "1" ] && [ "$USED" = "29" ] && [ "$ROWS" = "1" ] || { echo "FAIL: concurrent redemption"; exit 1; }

echo "--- ২. একই Browser থেকে ২০ বার Double-click (একই nonce)"
$P -c "select public.approve_download_request('c0000000-0000-0000-0000-0000000000a2', null, 'CONC_HASH_2', 'enc', 'EFGH')" >/dev/null
rm -f /tmp/conc2.out
for i in $(seq 1 20); do
  $P -c "select public.redeem_download_code('CONC_HASH_2', '$PROD', 'same_nonce', 'ip', 30)->>'result'" >> /tmp/conc2.out &
done
wait
OKS=$(grep -c '^ok$' /tmp/conc2.out)
ROWS=$($P -c "select count(*) from download_redemptions where code_id=(select id from download_codes where code_hash='CONC_HASH_2')")
echo "ok=$OKS redemption_rows=$ROWS"
[ "$OKS" = "20" ] && [ "$ROWS" = "1" ] || { echo "FAIL: double click"; exit 1; }

echo "--- ৩. একই Download Authorization থেকে ২০টি সমান্তরাল Signed-URL অনুরোধ (সীমা ৩)"
rm -f /tmp/conc3.out
for i in $(seq 1 20); do
  $P -c "select public.consume_download_authorization('same_nonce', 3)->>'result'" >> /tmp/conc3.out &
done
wait
OKS=$(grep -c '^ok$' /tmp/conc3.out); EX=$(grep -c '^exhausted$' /tmp/conc3.out)
echo "ok=$OKS exhausted=$EX"
[ "$OKS" = "3" ] && [ "$EX" = "17" ] || { echo "FAIL: authorization limit"; exit 1; }

echo "--- ৪. একই Request একসাথে ১০ জন Admin Approve করছে — ঠিক একটি সফল"
$P -c "insert into download_requests (id, request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, lookup_secret_hash) values ('c0000000-0000-0000-0000-0000000000a3','SF-RCONCUR03','$PROD','Glitch Pack','Conc3','conc3@example.com','+8801700000003','h') on conflict do nothing" >/dev/null
rm -f /tmp/conc4.out
for i in $(seq 1 10); do
  $P -c "select public.approve_download_request('c0000000-0000-0000-0000-0000000000a3', null, 'CONC_APP_$i', 'enc', 'X$i')" >> /tmp/conc4.out 2>&1 &
done
wait
OKS=$(grep -Ec '^[0-9a-f-]{36}$' /tmp/conc4.out)
CODES=$($P -c "select count(*) from download_codes where request_id='c0000000-0000-0000-0000-0000000000a3'")
echo "approve_success=$OKS codes_created=$CODES"
[ "$OKS" = "1" ] && [ "$CODES" = "1" ] || { echo "FAIL: concurrent approve"; exit 1; }

echo "--- ৫. Rate limit: ৫০টি সমান্তরাল অনুরোধ, সীমা ১০"
rm -f /tmp/conc5.out
for i in $(seq 1 50); do $P -c "select public.check_rate_limit('conc:k', 10, 600)" >> /tmp/conc5.out & done
wait
T=$(grep -c '^t$' /tmp/conc5.out)
echo "allowed=$T"
[ "$T" = "10" ] || { echo "FAIL: rate limit"; exit 1; }
echo "CONCURRENCY TESTS PASSED"
