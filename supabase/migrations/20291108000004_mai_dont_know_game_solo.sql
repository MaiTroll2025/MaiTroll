-- Allow solo rooms (max_players = 1) for Mai Dont Know Game.
-- Previous migration applied max_players between 2 and 12; solo requires 1.

alter table public.mai_dk_rooms
  drop constraint if exists mai_dk_rooms_max_players_check,
  add constraint mai_dk_rooms_max_players_check check (max_players between 1 and 12);
