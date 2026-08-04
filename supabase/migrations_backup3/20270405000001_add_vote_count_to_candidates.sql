-- Add vote_count column to president_candidates if it doesn't exist
alter table president_candidates
add column if not exists vote_count integer default 0;