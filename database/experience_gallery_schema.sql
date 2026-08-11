-- Villas y galerías. Ejecutar en el proyecto Supabase principal.
create extension if not exists pgcrypto;

create table if not exists public.experience_villas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  destination text not null default '' check (char_length(destination) <= 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  cover_path text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experience_villa_images (
  id uuid primary key default gen_random_uuid(),
  villa_id uuid not null references public.experience_villas(id) on delete cascade,
  image_path text not null unique check (image_path ~ '^villas/[a-z0-9]+(?:-[a-z0-9]+)*/[0-9a-f-]+\.(jpg|jpeg|png|webp|avif)$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Compatibilidad si las tablas fueron creadas con la versión anterior.
alter table public.experience_villas add column if not exists destination text not null default '';
alter table public.experience_villa_images add column if not exists is_active boolean not null default true;

create index if not exists experience_villas_order_idx on public.experience_villas(sort_order, created_at);
create index if not exists experience_villa_images_order_idx on public.experience_villa_images(villa_id, sort_order, created_at);
create unique index if not exists experience_villa_single_cover_idx on public.experience_villa_images(villa_id) where is_cover;

create or replace function public.set_experience_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists experience_villas_updated_at on public.experience_villas;
create trigger experience_villas_updated_at before update on public.experience_villas
for each row execute function public.set_experience_updated_at();

create or replace function public.is_experience_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and lower(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', ''
  )) in ('', 'admin', 'administrator')
$$;

alter table public.experience_villas enable row level security;
alter table public.experience_villa_images enable row level security;

drop policy if exists villas_read on public.experience_villas;
create policy villas_read on public.experience_villas for select using (is_active or public.is_experience_admin());
drop policy if exists villas_insert on public.experience_villas;
create policy villas_insert on public.experience_villas for insert to authenticated with check (public.is_experience_admin());
drop policy if exists villas_update on public.experience_villas;
create policy villas_update on public.experience_villas for update to authenticated using (public.is_experience_admin()) with check (public.is_experience_admin());
drop policy if exists villas_delete on public.experience_villas;
create policy villas_delete on public.experience_villas for delete to authenticated using (public.is_experience_admin());

drop policy if exists villa_images_read on public.experience_villa_images;
create policy villa_images_read on public.experience_villa_images for select using (
  public.is_experience_admin() or (
    is_active and exists (select 1 from public.experience_villas v where v.id = villa_id and v.is_active)
  )
);
drop policy if exists villa_images_insert on public.experience_villa_images;
create policy villa_images_insert on public.experience_villa_images for insert to authenticated with check (public.is_experience_admin());
drop policy if exists villa_images_update on public.experience_villa_images;
create policy villa_images_update on public.experience_villa_images for update to authenticated using (public.is_experience_admin()) with check (public.is_experience_admin());
drop policy if exists villa_images_delete on public.experience_villa_images;
create policy villa_images_delete on public.experience_villa_images for delete to authenticated using (public.is_experience_admin());

grant select on public.experience_villas, public.experience_villa_images to anon, authenticated;
grant insert, update, delete on public.experience_villas, public.experience_villa_images to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('experiences','experiences',true,15728640,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists experiences_admin_insert on storage.objects;
create policy experiences_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id='experiences' and (storage.foldername(name))[1]='villas' and public.is_experience_admin()
);
drop policy if exists experiences_admin_update on storage.objects;
create policy experiences_admin_update on storage.objects for update to authenticated
using(bucket_id='experiences' and public.is_experience_admin())
with check(bucket_id='experiences' and (storage.foldername(name))[1]='villas' and public.is_experience_admin());
drop policy if exists experiences_admin_delete on storage.objects;
create policy experiences_admin_delete on storage.objects for delete to authenticated
using(bucket_id='experiences' and public.is_experience_admin());

-- Habilita actualizaciones automáticas en la landing que permanezca abierta.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'experience_villas'
  ) then
    alter publication supabase_realtime add table public.experience_villas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'experience_villa_images'
  ) then
    alter publication supabase_realtime add table public.experience_villa_images;
  end if;
end $$;

-- Consulta pública sugerida: villas activas ordenadas y sus imágenes.
-- RLS oculta automáticamente las villas inactivas al rol anon.
