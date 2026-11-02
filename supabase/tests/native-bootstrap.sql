-- Disposable PostgreSQL test harness. Never apply to a Supabase project.
create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions; create schema net; create schema cron;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text,owner uuid);
    create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(repeat('00',$1),'hex') $$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
