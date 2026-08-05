-- Ejecutar en Supabase > InventariosCotizacion > SQL Editor.
-- La pestaña se usa sin iniciar sesión de Inventory, por lo que estas tablas
-- deben aparecer como UNRESTRICTED en el Table Editor.

alter table public.response_templates disable row level security;
alter table public.response_template_usages disable row level security;

grant select, insert, update, delete on public.response_templates to anon, authenticated;
grant select, insert, update, delete on public.response_template_usages to anon, authenticated;

-- Verificación: si la tabla vuelve a tener RLS habilitado, DELETE puede responder
-- 204 sin afectar filas. Este módulo directo requiere que relrowsecurity sea false.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'response_template_usages'
      and c.relrowsecurity
  ) then
    raise exception 'RLS sigue habilitado en public.response_template_usages';
  end if;
end $$;
