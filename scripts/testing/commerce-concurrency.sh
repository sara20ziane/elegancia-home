#!/usr/bin/env bash
# Runs only inside the disposable network-isolated container owned by native-postgres.sh.
set -euo pipefail
commerce_container="$1"
commerce_tmp="$(mktemp -d)"
trap 'rm -rf "$commerce_tmp"' EXIT
commerce_docker() {
 env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"
}
commerce_docker exec -i "$commerce_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' > /dev/null
insert into products(id,slug,name,status,kind) values
 ('98989898-0000-4000-8000-000000000001','native-component','Composant test','published','single'),
 ('98989898-0000-4000-8000-000000000002','native-pack','Pack test','published','pack');
insert into product_variants(id,product_id,size,price,stock) values
 ('98989898-0000-4000-8000-000000000001','98989898-0000-4000-8000-000000000001','Test',1000,2),
 ('98989898-0000-4000-8000-000000000002','98989898-0000-4000-8000-000000000002','Test',1500,10);
insert into pack_items(product_id,variant_id,quantity) values('98989898-0000-4000-8000-000000000002','98989898-0000-4000-8000-000000000001',2);
create function public.native_commerce_attempt(v uuid,p text) returns text language plpgsql as $$
begin
 perform place_order(jsonb_build_object('customer_name','Concurrency test','phone',p,'wilaya','Alger','commune','Alger Centre','address','Adresse synthétique'),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',1)));
 return 'created';
exception when check_violation then return 'limited';
end $$;
SQL
for commerce_mode in pack phone; do
 if [ "$commerce_mode" = phone ]; then
  commerce_docker exec "$commerce_container" psql -U postgres -v ON_ERROR_STOP=1 -c "update product_variants set stock=100 where id='98989898-0000-4000-8000-000000000001'" >/dev/null
 fi
 commerce_pids=()
 for commerce_n in $(seq 1 16); do
  if [ "$commerce_mode" = pack ]; then
   commerce_variant='98989898-0000-4000-8000-000000000002'
   commerce_phone="$(printf '0555000%03d' "$commerce_n")"
  else
   commerce_variant='98989898-0000-4000-8000-000000000001'
   commerce_phone='0555444433'
  fi
  commerce_docker exec "$commerce_container" psql -U postgres -Atv ON_ERROR_STOP=1 -c "select native_commerce_attempt('$commerce_variant','$commerce_phone')" > "$commerce_tmp/$commerce_mode-$commerce_n" &
  commerce_pids+=("$!")
 done
 for commerce_pid in "${commerce_pids[@]}"; do wait "$commerce_pid"; done
 if [ "$commerce_mode" = pack ]; then commerce_expected=1; else commerce_expected=3; fi
 test "$(awk '$0 == "created" { count++ } END { print count+0 }' "$commerce_tmp"/"$commerce_mode"-*)" -eq "$commerce_expected"
done
commerce_docker exec -i "$commerce_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
-- Actual pgcrypto HMAC, with a known test vector. No external HTTP request.
create schema native_crypto;
create extension pgcrypto with schema native_crypto;
do $$begin
 assert encode(native_crypto.hmac('The quick brown fox jumps over the lazy dog','key','sha256'),'hex')='f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8';
 assert (select stock=9 from product_variants where id='98989898-0000-4000-8000-000000000002');
 assert (select count(*)=3 from orders where phone='0555444433' and status='pending');
end$$;
SQL
echo 'PASS: 16 concurrent pack checkouts -> one reservation; 16 same-phone checkouts -> three pending; native pgcrypto HMAC vector.'
