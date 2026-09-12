-- ============================================================
-- MADING KITA ♡ — SUPABASE SETUP
-- Jalankan SELURUH file ini di Supabase → SQL Editor → Run.
-- Setelah itu aktifkan Anonymous Sign-Ins di Authentication.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Mading Kita ♡',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Aku',
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author text not null default 'Aku',
  title text not null default '',
  text text not null default '',
  date date not null default current_date,
  color text not null default 'cream',
  photo_path text,
  voice_path text,
  favorite boolean not null default false,
  x double precision,
  y double precision,
  rot double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_room_id_idx on public.notes(room_id);
create index if not exists notes_date_idx on public.notes(date desc);

create or replace function public.is_room_member(target_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = target_room and user_id = auth.uid()
  );
$$;

grant execute on function public.is_room_member(uuid) to authenticated;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.notes enable row level security;

drop policy if exists "notes_select_members" on public.notes;
create policy "notes_select_members" on public.notes
for select to authenticated
using (public.is_room_member(room_id));

drop policy if exists "notes_insert_members" on public.notes;
create policy "notes_insert_members" on public.notes
for insert to authenticated
with check (public.is_room_member(room_id));

drop policy if exists "notes_update_members" on public.notes;
create policy "notes_update_members" on public.notes
for update to authenticated
using (public.is_room_member(room_id))
with check (public.is_room_member(room_id));

drop policy if exists "notes_delete_members" on public.notes;
create policy "notes_delete_members" on public.notes
for delete to authenticated
using (public.is_room_member(room_id));

drop policy if exists "rooms_select_members" on public.rooms;
create policy "rooms_select_members" on public.rooms
for select to authenticated
using (public.is_room_member(id));

drop policy if exists "rooms_insert_owner" on public.rooms;
create policy "rooms_insert_owner" on public.rooms
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner" on public.rooms
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "rooms_delete_owner" on public.rooms;
create policy "rooms_delete_owner" on public.rooms
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists "members_select_self" on public.room_members;
create policy "members_select_self" on public.room_members
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "members_insert_self_for_owned_room" on public.room_members;
create policy "members_insert_self_for_owned_room" on public.room_members
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = auth.uid())
);

drop policy if exists "members_update_self" on public.room_members;
create policy "members_update_self" on public.room_members
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members_delete_self" on public.room_members;
create policy "members_delete_self" on public.room_members
for delete to authenticated
using (user_id = auth.uid());

create or replace function public.join_room(p_code text, p_author_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  found_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into found_room
  from public.rooms
  where upper(code) = upper(trim(p_code))
  limit 1;

  if found_room.id is null then
    raise exception 'Room tidak ditemukan';
  end if;

  insert into public.room_members(room_id, user_id, author_name)
  values (found_room.id, auth.uid(), coalesce(nullif(trim(p_author_name), ''), 'Aku'))
  on conflict (room_id, user_id)
  do update set author_name = excluded.author_name;

  return found_room;
end;
$$;

grant execute on function public.join_room(text, text) to authenticated;

create or replace function public.create_room(p_name text, p_author_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room public.rooms;
  generated_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  generated_code := 'LOVE-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

  insert into public.rooms(name, code, owner_id)
  values (
    coalesce(nullif(trim(p_name), ''), 'Mading Kita ♡'),
    generated_code,
    auth.uid()
  ) returning * into new_room;

  insert into public.room_members(room_id, user_id, author_name)
  values (new_room.id, auth.uid(), coalesce(nullif(trim(p_author_name), ''), 'Aku'));

  return new_room;
end;
$$;

grant execute on function public.create_room(text, text) to authenticated;

-- Media bucket: PRIVATE. Foto/voice hanya bisa diakses member room melalui signed URL.
insert into storage.buckets (id, name, public)
values ('mading-media', 'mading-media', false)
on conflict (id) do update set public = false;

drop policy if exists "media_select_members" on storage.objects;
create policy "media_select_members" on storage.objects
for select to authenticated
using (
  bucket_id = 'mading-media'
  and public.is_room_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "media_insert_members" on storage.objects;
create policy "media_insert_members" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mading-media'
  and public.is_room_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "media_update_members" on storage.objects;
create policy "media_update_members" on storage.objects
for update to authenticated
using (
  bucket_id = 'mading-media'
  and public.is_room_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'mading-media'
  and public.is_room_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "media_delete_members" on storage.objects;
create policy "media_delete_members" on storage.objects
for delete to authenticated
using (
  bucket_id = 'mading-media'
  and public.is_room_member(((storage.foldername(name))[1])::uuid)
);

-- Realtime: jalankan aman berulang kali dengan DO block.
do $$
begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then
  null;
end $$;

-- updated_at otomatis.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();
