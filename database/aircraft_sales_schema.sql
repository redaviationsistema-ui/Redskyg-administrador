create table if not exists public.aircraft_sales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  model text,
  slug text not null unique,
  registration text not null unique,
  price numeric(14, 2),
  currency text not null default 'USD',
  status text not null default 'ready_to_operate' check (status in ('ready_to_operate', 'out_of_service')),
  description text,
  pdf_path text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aircraft_sales_images (
  id uuid primary key default gen_random_uuid(),
  aircraft_sale_id uuid not null references public.aircraft_sales(id) on delete cascade,
  storage_path text not null unique,
  is_cover boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aircraft_sales_inquiries (
  id uuid primary key default gen_random_uuid(),
  aircraft_sale_id uuid references public.aircraft_sales(id) on delete set null,
  name text not null,
  email text,
  phone text,
  message text,
  email_verified boolean not null default false,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  pdf_sent boolean not null default false,
  pdf_sent_at timestamptz,
  status text not null default 'new' check (status in ('new', 'in_follow_up', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aircraft_sales
  add column if not exists pdf_path text;

alter table public.aircraft_sales_inquiries
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_status text not null default 'pending',
  add column if not exists pdf_sent boolean not null default false,
  add column if not exists pdf_sent_at timestamptz;

create index if not exists aircraft_sales_active_order_idx on public.aircraft_sales(is_active, display_order);
create index if not exists aircraft_sales_status_idx on public.aircraft_sales(status);
create index if not exists aircraft_sales_images_aircraft_order_idx on public.aircraft_sales_images(aircraft_sale_id, display_order);
create index if not exists aircraft_sales_inquiries_status_idx on public.aircraft_sales_inquiries(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_aircraft_sales_updated_at on public.aircraft_sales;
create trigger set_aircraft_sales_updated_at
before update on public.aircraft_sales
for each row execute function public.set_updated_at();

drop trigger if exists set_aircraft_sales_images_updated_at on public.aircraft_sales_images;
create trigger set_aircraft_sales_images_updated_at
before update on public.aircraft_sales_images
for each row execute function public.set_updated_at();

drop trigger if exists set_aircraft_sales_inquiries_updated_at on public.aircraft_sales_inquiries;
create trigger set_aircraft_sales_inquiries_updated_at
before update on public.aircraft_sales_inquiries
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('aircraft-sales', 'aircraft-sales', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('aircraft-pdfs', 'aircraft-pdfs', false)
on conflict (id) do update set public = excluded.public;

alter table public.aircraft_sales enable row level security;
alter table public.aircraft_sales_images enable row level security;
alter table public.aircraft_sales_inquiries enable row level security;

drop policy if exists "Public can read active aircraft sales" on public.aircraft_sales;
create policy "Public can read active aircraft sales"
on public.aircraft_sales
for select
using (is_active = true);

drop policy if exists "Authenticated can manage aircraft sales" on public.aircraft_sales;
create policy "Authenticated can manage aircraft sales"
on public.aircraft_sales
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active aircraft sales images" on public.aircraft_sales_images;
create policy "Public can read active aircraft sales images"
on public.aircraft_sales_images
for select
using (
  is_active = true
  and exists (
    select 1
    from public.aircraft_sales aircraft
    where aircraft.id = aircraft_sales_images.aircraft_sale_id
      and aircraft.is_active = true
  )
);

drop policy if exists "Authenticated can manage aircraft sales images" on public.aircraft_sales_images;
create policy "Authenticated can manage aircraft sales images"
on public.aircraft_sales_images
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can create aircraft sales inquiries" on public.aircraft_sales_inquiries;
create policy "Public can create aircraft sales inquiries"
on public.aircraft_sales_inquiries
for insert
with check (true);

drop policy if exists "Authenticated can manage aircraft sales inquiries" on public.aircraft_sales_inquiries;
create policy "Authenticated can manage aircraft sales inquiries"
on public.aircraft_sales_inquiries
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read aircraft sales files" on storage.objects;
create policy "Public can read aircraft sales files"
on storage.objects
for select
using (bucket_id = 'aircraft-sales');

drop policy if exists "Authenticated can manage aircraft sales files" on storage.objects;
create policy "Authenticated can manage aircraft sales files"
on storage.objects
for all
to authenticated
using (bucket_id = 'aircraft-sales')
with check (bucket_id = 'aircraft-sales');

drop policy if exists "Authenticated can manage aircraft sales PDFs" on storage.objects;
create policy "Authenticated can manage aircraft sales PDFs"
on storage.objects
for all
to authenticated
using (bucket_id = 'aircraft-pdfs')
with check (bucket_id = 'aircraft-pdfs');

notify pgrst, 'reload schema';
