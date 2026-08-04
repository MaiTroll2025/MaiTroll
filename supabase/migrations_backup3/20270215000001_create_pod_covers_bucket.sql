-- Migration: Create pod-covers bucket
insert into storage.buckets (id, name, public)
values ('pod-covers', 'pod-covers', true)
on conflict (id) do nothing;

-- Policy: Allow public read
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'pod-covers' );

-- Policy: Allow authenticated users to upload
create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'pod-covers' and auth.role() = 'authenticated' );

-- Policy: Users can update their own files (optional, depending on need)
create policy "Users can update own files"
  on storage.objects for update
  using ( bucket_id = 'pod-covers' and auth.uid() = owner );
