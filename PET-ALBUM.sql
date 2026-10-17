-- Jalankan sekali di Supabase SQL Editor untuk album foto bersama.
-- Foto disimpan di bucket pet-album; folder pertama adalah UUID room.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('pet-album','pet-album',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=10485760;
create table if not exists public.pet_album_photos (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id) on delete cascade,
 photo_url text not null,
 storage_path text not null,
 caption text not null default 'momen kita ♡',
 created_at timestamptz not null default now()
);
alter table public.pet_album_photos enable row level security;
drop policy if exists pet_album_select_members on public.pet_album_photos;
create policy pet_album_select_members on public.pet_album_photos for select to authenticated using (public.is_room_member(room_id));
drop policy if exists pet_album_insert_members on public.pet_album_photos;
create policy pet_album_insert_members on public.pet_album_photos for insert to authenticated with check (public.is_room_member(room_id));
drop policy if exists pet_album_delete_members on public.pet_album_photos;
create policy pet_album_delete_members on public.pet_album_photos for delete to authenticated using (public.is_room_member(room_id));
grant select,insert,delete on public.pet_album_photos to authenticated;
-- Object paths use room UUID as the first folder.
drop policy if exists pet_album_storage_select on storage.objects;
create policy pet_album_storage_select on storage.objects for select to authenticated using (bucket_id='pet-album' and public.is_room_member((storage.foldername(name))[1]::uuid));
drop policy if exists pet_album_storage_insert on storage.objects;
create policy pet_album_storage_insert on storage.objects for insert to authenticated with check (bucket_id='pet-album' and public.is_room_member((storage.foldername(name))[1]::uuid));
drop policy if exists pet_album_storage_delete on storage.objects;
create policy pet_album_storage_delete on storage.objects for delete to authenticated using (bucket_id='pet-album' and public.is_room_member((storage.foldername(name))[1]::uuid));
-- Realtime sync for album; ignore if already published.
do $$ begin alter publication supabase_realtime add table public.pet_album_photos; exception when duplicate_object then null; end $$;
