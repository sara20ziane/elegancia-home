#!/usr/bin/env bash
# Disposable local PostgreSQL, no host port, no Supabase credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
finance_container="elegancia-finance-test-$$"
finance_tmp="$(mktemp -d)"
finance_docker() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
finance_cleanup() {
  finance_docker rm -f "$finance_container" >/dev/null 2>&1 || true
  rm -rf "$finance_tmp"
}
trap finance_cleanup EXIT
finance_docker run -d --name "$finance_container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for finance_attempt in $(seq 1 30); do
  if finance_docker exec "$finance_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
python3 - "$finance_tmp/setup.sql" <<'PY'
import pathlib, re, sys
parts = [pathlib.Path('supabase/tests/native-bootstrap.sql').read_text()]
for path in sorted(pathlib.Path('supabase/migrations').glob('*.sql')):
    parts.append(re.sub(r'^create extension[^;]+;', '', path.read_text(), flags=re.M | re.I))
parts.append(pathlib.Path('supabase/tests/native-finance.sql').read_text())
pathlib.Path(sys.argv[1]).write_text('\n'.join(parts))
PY
finance_docker exec -i "$finance_container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$finance_tmp/setup.sql" > "$finance_tmp/setup.log"
finance_docker exec -i "$finance_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' > /dev/null
insert into auth.users values('ffffffff-0000-4000-8000-000000000001');
insert into public.admin_users(user_id,role) values('ffffffff-0000-4000-8000-000000000001','owner');
select set_config('request.jwt.claim.sub','ffffffff-0000-4000-8000-000000000001',false);
select finance_save_entity('account','{"id":"ffffffff-1000-4000-8000-000000000001","name":"Test cash","kind":"cash"}');
select finance_save_entity('account','{"id":"ffffffff-1000-4000-8000-000000000002","name":"Test COD","kind":"receivable"}');
select finance_configure('{"enabled":true,"cod_account_id":"ffffffff-1000-4000-8000-000000000002"}');
update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
insert into delivery_zones(wilaya,fee,stopdesk_fee) values('Alger',600,400) on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true;
insert into products(id,slug,name,status) values('ffffffff-4000-4000-8000-000000000001','concurrency-fixture','Test','published');
insert into product_variants(id,product_id,price,stock) values('ffffffff-5000-4000-8000-000000000001','ffffffff-4000-4000-8000-000000000001',10000,20);
create table public.native_test_fixture(invoice_id uuid,settlement jsonb);
do $$ declare token uuid; oid uuid; inv uuid; begin
 token:=place_order('{"customer_name":"Fixture","phone":"0555123456","wilaya":"Alger","commune":"Alger Centre","address":"Adresse test"}','[{"variant_id":"ffffffff-5000-4000-8000-000000000001","quantity":1}]');
 select id into oid from orders where public_token=token;
 update orders set status='confirmed',confirmed_at=now(),carrier='Packers' where id=oid;
 update orders set status='shipped' where id=oid;
 update orders set status='delivered',delivered_at=now() where id=oid;
 inv:=finance_prepare_order(oid);
 insert into native_test_fixture values(inv,jsonb_build_object('id',gen_random_uuid(),'orders',jsonb_build_array(oid),'carrier','Packers','reference','CONCURRENT','date',(now() at time zone 'Africa/Algiers')::date,'expected_gross',10600,'fees',600,'withheld',0,'net',10000,'account_id','ffffffff-1000-4000-8000-000000000001'));
end $$;
SQL
# Separate psql processes are separate PostgreSQL sessions, exercising real locks.
finance_pids=()
for finance_n in $(seq 1 40); do
  finance_docker exec "$finance_container" psql -U postgres -Atv ON_ERROR_STOP=1 \
    -c "select finance_private.number('FAC')" >> "$finance_tmp/numbers" &
  finance_pids+=("$!")
done
for finance_pid in "${finance_pids[@]}"; do wait "$finance_pid"; done
test "$(sort -u "$finance_tmp/numbers" | wc -l)" -eq 40
for finance_operation in issue settlement; do
  finance_pids=()
  for finance_n in $(seq 1 16); do
    if [ "$finance_operation" = issue ]; then
      finance_query='select finance_issue_invoice(invoice_id) from native_test_fixture'
    else
      finance_query='select finance_record_settlement(settlement) from native_test_fixture'
    fi
    finance_docker exec "$finance_container" psql -U postgres -Atv ON_ERROR_STOP=1 \
      -c "select set_config('request.jwt.claim.sub','ffffffff-0000-4000-8000-000000000001',false); $finance_query" \
      > "$finance_tmp/$finance_operation-$finance_n" &
    finance_pids+=("$!")
  done
  for finance_pid in "${finance_pids[@]}"; do wait "$finance_pid"; done
done
finance_docker exec "$finance_container" psql -U postgres -v ON_ERROR_STOP=1 -c \
  "do \$\$ begin if (select count(*) from invoices where number is not null)<>1 or (select count(*) from cod_settlements)<>1 or (select count(*) from financial_movements where domain='cash')<>1 or (select status from invoices)<>'paid' then raise exception 'Concurrent actions duplicated or incomplete'; end if; end \$\$;"
echo 'PASS: all migrations + SQL regression; 40 concurrent numbers; 16 concurrent issues; 16 concurrent COD receipts.'
