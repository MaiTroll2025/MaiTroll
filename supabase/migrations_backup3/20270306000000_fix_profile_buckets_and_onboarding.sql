-- Ensure storage buckets exist and are public
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('troll-city-assets', 'troll-city-assets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do update set public = true;

-- Drop existing policies to avoid conflicts and ensure clean state
-- drop policy if exists "Avatar images are publicly accessible" on storage.objects;
-- drop policy if exists "Anyone can upload an avatar" on storage.objects;
-- drop policy if exists "Anyone can update an avatar" on storage.objects;
-- drop policy if exists "Authenticated users can upload avatars" on storage.objects;
-- drop policy if exists "Users can update their own avatars" on storage.objects;

-- drop policy if exists "Assets are publicly accessible" on storage.objects;
-- drop policy if exists "Anyone can upload assets" on storage.objects;
-- drop policy if exists "Authenticated users can upload assets" on storage.objects;

-- AVATARS POLICIES
-- create policy "Avatar images are publicly accessible"
--   on storage.objects for select
--   using ( bucket_id = 'avatars' );

-- create policy "Authenticated users can upload avatars"
--   on storage.objects for insert
--   to authenticated
--   with check ( bucket_id = 'avatars' );

-- create policy "Users can update their own avatars"
--   on storage.objects for update
--   to authenticated
--   using ( bucket_id = 'avatars' AND auth.uid() = owner )
--   with check ( bucket_id = 'avatars' AND auth.uid() = owner );

-- TROLL-CITY-ASSETS POLICIES (Cover photos)
-- create policy "Assets are publicly accessible"
--   on storage.objects for select
--   using ( bucket_id = 'troll-city-assets' );

-- create policy "Authenticated users can upload assets"
--   on storage.objects for insert
--   to authenticated
--   with check ( bucket_id = 'troll-city-assets' );

-- create policy "Users can update their own assets"
--   on storage.objects for update
--   to authenticated
--   using ( bucket_id = 'troll-city-assets' AND auth.uid() = owner )
--   with check ( bucket_id = 'troll-city-assets' AND auth.uid() = owner );

-- PUBLIC BUCKET POLICIES (Fallback)
-- create policy "Public bucket is publicly accessible"
--   on storage.objects for select
--   using ( bucket_id = 'public' );

-- create policy "Authenticated users can upload to public"
--   on storage.objects for insert
--   to authenticated
--   with check ( bucket_id = 'public' );
