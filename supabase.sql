-- MYSTERY UNIVERSE — ONE TABLE + ONE STORAGE BUCKET
-- Run this in Supabase SQL Editor.
-- Then create an Auth user and set its app_metadata to: { "role": "admin" }

create extension if not exists pgcrypto;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number integer not null unique,
  title text not null,
  slug text not null unique,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard','expert')),
  status text not null default 'draft' check (status in ('draft','published')),
  image_path text,
  image_url text,
  youtube_url text,
  schema_version integer not null default 1,
  case_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_status_case_number_idx on public.cases(status, case_number);
create index if not exists cases_title_lower_idx on public.cases(lower(title));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

alter table public.cases enable row level security;

-- Data API grants. RLS policies below still control what each role can actually do.
grant select on public.cases to anon;
grant select, insert, update, delete on public.cases to authenticated;

drop policy if exists "public can read published cases" on public.cases;
create policy "public can read published cases"
on public.cases
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "admins can read all cases" on public.cases;
create policy "admins can read all cases"
on public.cases
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can insert cases" on public.cases;
create policy "admins can insert cases"
on public.cases
for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can update cases" on public.cases;
create policy "admins can update cases"
on public.cases
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can delete cases" on public.cases;
create policy "admins can delete cases"
on public.cases
for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Storage bucket. Public read is intentional: public case pages need image URLs.
insert into storage.buckets (id, name, public)
values ('case-images', 'case-images', true)
on conflict (id) do update set public = true;

-- Public can view case images.
drop policy if exists "public can view case images" on storage.objects;
create policy "public can view case images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'case-images');

-- Only Supabase Auth users with app_metadata.role=admin can upload/update/delete.
drop policy if exists "admins can upload case images" on storage.objects;
create policy "admins can upload case images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'case-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "admins can update case images" on storage.objects;
create policy "admins can update case images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'case-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  bucket_id = 'case-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "admins can delete case images" on storage.objects;
create policy "admins can delete case images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'case-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
