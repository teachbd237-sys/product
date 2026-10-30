#!/bin/bash
# লোকাল Postgres-এ পুরো Database পরীক্ষা (শুধু একটি খালি Test Database-এ!)।
#   createdb sf_test && ./supabase/tests/run_all.sh sf_test
# Production Supabase-এ কখনো চালাবেন না: 00_supabase_stub.sql Roles ও auth/storage Schema বানায়।
set -e
DB=${1:-sf_test}
cd "$(dirname "$0")/.."
P="psql -q -tA -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_supabase_stub.sql
$P -c 'create extension if not exists "uuid-ossp"'
$P -f schema.sql
$P -f storage-setup.sql
$P -f tests/01_legacy_seed.sql
$P -f migrations/upgrade_free_download.sql
$P -f migrations/upgrade_free_download.sql   # দ্বিতীয়বার: Idempotent কিনা পরীক্ষা
$P -f tests/02_behavior.sql | tail -1
DB=$DB bash tests/03_concurrency.sh
