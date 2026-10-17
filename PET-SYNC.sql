-- Mading Kita: sinkronisasi nama dan pakaian pet antarperangkat dalam room yang sama.
-- Jalankan sekali di Supabase Dashboard > SQL Editor > New query > Run.
create table if not exists public.pet_profiles (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  pet_name text not null default 'Mochi' check (char_length(pet_name) between 1 and 18),
  outfit_index integer not null default 0 check (outfit_index between 0 and 6),
  updated_at timestamptz not null default now()
);
create index if not exists pet_profiles_updated_at_idx on public.pet_profiles(updated_at desc);
alter table public.pet_profiles enable row level security;
drop policy if exists "pet_profiles_select_members" on public.pet_profiles;
create policy "pet_profiles_select_members" on public.pet_profiles for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "pet_profiles_insert_members" on public.pet_profiles;
create policy "pet_profiles_insert_members" on public.pet_profiles for insert to authenticated with check (public.is_room_member(room_id));
drop policy if exists "pet_profiles_update_members" on public.pet_profiles;
create policy "pet_profiles_update_members" on public.pet_profiles for update to authenticated using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));
grant select, insert, update on public.pet_profiles to authenticated;
alter publication supabase_realtime add table public.pet_profiles;
