-- Record the renderer at issuance, before the existing immutability guard.
-- Issued invoices and any credits drawn from them keep their original renderer.
create function finance_private.version_invoice_brand()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.payload := new.payload || pg_catalog.jsonb_build_object(
    'renderer_version', 'cotonia-a4-v2'
  );
  return new;
end;
$$;

revoke all on function finance_private.version_invoice_brand()
  from public, anon, authenticated, service_role;

create trigger cotonia_invoice_brand
before update of issued_at on public.invoices
for each row
when (
  old.issued_at is null
  and new.issued_at is not null
  and new.payload->>'renderer_version' = 'elegancia-a4-v1'
)
execute function finance_private.version_invoice_brand();
