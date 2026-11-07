-- Keep player game RPCs available to signed-in users only.

revoke all on function public.mai_dk_tick_room(uuid),
  public.mai_dk_submit_answer(uuid, int)
from public, anon;

grant execute on function public.mai_dk_tick_room(uuid),
  public.mai_dk_submit_answer(uuid, int)
to authenticated;
