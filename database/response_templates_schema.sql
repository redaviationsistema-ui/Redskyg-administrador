-- Módulo independiente: Plantillas de respuesta.
-- Ejecutar en la base de datos de INVENTARIO (VITE_SUPABASE_URL2), no en la principal.
create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.response_template_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  region text not null check (region in ('MX', 'USA')),
  display_order integer not null default 0 check (display_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, region)
);

create table if not exists public.response_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 500),
  category_id uuid not null references public.response_template_categories(id),
  region text not null check (region in ('MX', 'USA')),
  language text not null check (language in ('es', 'en')),
  subject text check (subject is null or char_length(subject) <= 250),
  content text not null check (char_length(content) between 1 and 20000),
  channels jsonb not null check (jsonb_typeof(channels) = 'array' and jsonb_array_length(channels) > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_document tsvector generated always as
    (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content, ''))) stored
);

create index if not exists response_templates_filters_idx on public.response_templates(region, category_id, language, status, display_order) where deleted_at is null;
create index if not exists response_templates_channels_idx on public.response_templates using gin(channels);
create index if not exists response_templates_search_idx on public.response_templates using gin(search_document);

create table if not exists public.response_template_usage (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.response_templates(id),
  lead_id uuid,
  channel text not null check (channel in ('copy', 'WhatsApp', 'Email', 'Instagram', 'Llamada', 'Web')),
  variable_values jsonb not null default '{}'::jsonb,
  rendered_content text not null check (char_length(rendered_content) <= 20000),
  used_by uuid default auth.uid(),
  used_at timestamptz not null default now()
);
create index if not exists response_template_usage_lead_idx on public.response_template_usage(lead_id, used_at desc);

create or replace function public.jwt_response_template_role() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', ''))
$$;
create or replace function public.can_view_response_templates() returns boolean language sql stable as $$
  select auth.uid() is null or public.jwt_response_template_role() in ('admin','administrator','supervisor','advisor','asesor')
$$;
create or replace function public.can_edit_response_templates() returns boolean language sql stable as $$
  select auth.uid() is null or public.jwt_response_template_role() in ('admin','administrator','supervisor')
$$;
create or replace function public.is_response_template_admin() returns boolean language sql stable as $$
  select auth.uid() is null or public.jwt_response_template_role() in ('admin','administrator')
$$;

create or replace function public.set_response_template_audit() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.created_by_email := auth.jwt() ->> 'email';
  end if;
  new.updated_by := auth.uid(); new.updated_by_email := auth.jwt() ->> 'email'; new.updated_at := now();
  if new.slug is null or new.slug = '' then
    new.slug := lower(regexp_replace(unaccent(new.name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8);
  end if;
  if not exists (select 1 from public.response_template_categories c where c.id = new.category_id and c.region = new.region) then
    raise exception 'La categoría no pertenece a la región seleccionada';
  end if;
  return new;
end $$;
drop trigger if exists response_templates_audit_trigger on public.response_templates;
create trigger response_templates_audit_trigger before insert or update on public.response_templates for each row execute function public.set_response_template_audit();

create or replace function public.duplicate_response_template(template_id uuid) returns uuid language plpgsql security invoker as $$
declare new_id uuid := gen_random_uuid(); source public.response_templates;
begin
  if not public.can_edit_response_templates() then raise exception 'Sin permisos'; end if;
  select * into source from public.response_templates where id = template_id and deleted_at is null;
  if not found then raise exception 'Plantilla no encontrada'; end if;
  insert into public.response_templates(id,name,slug,description,category_id,region,language,subject,content,channels,status,display_order)
  values(new_id,source.name || ' (copia)',source.slug || '-copy-' || substr(new_id::text,1,8),source.description,source.category_id,source.region,source.language,source.subject,source.content,source.channels,'inactive',source.display_order + 1);
  return new_id;
end $$;

create or replace function public.soft_delete_response_template(template_id uuid) returns void language plpgsql security invoker as $$
begin
  if not public.is_response_template_admin() then raise exception 'Sin permisos'; end if;
  update public.response_templates set deleted_at = now(), updated_by = auth.uid() where id = template_id and deleted_at is null;
end $$;

create or replace function public.render_response_template(template_id uuid, variable_values jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker as $$
declare source text; rendered text; token text; pending text[] := '{}'; allowed constant text[] := array['client_name','company_name','advisor_name','advisor_phone','advisor_email','aircraft_model','aircraft_registration','part_number','route','flight_date','passengers','quotation_number','quotation_amount','currency','email','whatsapp'];
begin
  if not public.can_view_response_templates() then raise exception 'Sin permisos'; end if;
  select content into source from public.response_templates where id = template_id and deleted_at is null;
  if source is null then raise exception 'Plantilla no encontrada'; end if;
  rendered := source;
  foreach token in array allowed loop
    if rendered like '%{{' || token || '}}%' then
      if nullif(trim(variable_values ->> token), '') is null then pending := array_append(pending, token);
      else rendered := replace(rendered, '{{' || token || '}}', variable_values ->> token); end if;
    end if;
  end loop;
  return jsonb_build_object('message', rendered, 'pending', to_jsonb(pending));
end $$;

alter table public.response_template_categories enable row level security;
alter table public.response_templates enable row level security;
alter table public.response_template_usage enable row level security;
drop policy if exists categories_read on public.response_template_categories;
create policy categories_read on public.response_template_categories for select using (public.can_view_response_templates());
drop policy if exists templates_read on public.response_templates;
create policy templates_read on public.response_templates for select using (public.can_view_response_templates() and deleted_at is null);
drop policy if exists templates_insert on public.response_templates;
create policy templates_insert on public.response_templates for insert with check (public.can_edit_response_templates());
drop policy if exists templates_update on public.response_templates;
create policy templates_update on public.response_templates for update using (public.can_edit_response_templates()) with check (public.can_edit_response_templates());
drop policy if exists usage_insert on public.response_template_usage;
create policy usage_insert on public.response_template_usage for insert with check
  (public.can_view_response_templates() and (used_by = auth.uid() or (used_by is null and auth.uid() is null)));
drop policy if exists usage_read on public.response_template_usage;
create policy usage_read on public.response_template_usage for select using (public.can_edit_response_templates());

insert into public.response_template_categories(name,region,display_order) values
('Instagram','MX',10),('WhatsApp','MX',20),('Cotización de vuelo','MX',30),('Compra de aeronave','MX',40),('Compra de partes','MX',50),('Venta de aeronave','MX',60),('Postventa','MX',70),('Speech de renta de vuelos','MX',80),('Llamada para compra de aeronave','MX',90),('Referencias para rutas','MX',100),('Venta de partes con Part Number','MX',110),('Renta de vuelos','MX',120),
('Venta de aeronaves','USA',10),('Compra de aeronaves','USA',20),('Partes','USA',30),('Renta de vuelos','USA',40),('Experiencias','USA',50),('Análisis de mercado','USA',60)
on conflict(name,region) do update set display_order = excluded.display_order, active = true;

grant select on public.response_template_categories, public.response_templates to authenticated;
grant insert, update on public.response_templates to authenticated;
grant select, insert on public.response_template_usage to authenticated;
grant execute on function public.duplicate_response_template(uuid), public.soft_delete_response_template(uuid), public.render_response_template(uuid,jsonb) to authenticated;
grant select on public.response_template_categories, public.response_templates to anon;
grant insert, update on public.response_templates to anon;
grant select, insert on public.response_template_usage to anon;
grant execute on function public.duplicate_response_template(uuid), public.soft_delete_response_template(uuid), public.render_response_template(uuid,jsonb) to anon;
