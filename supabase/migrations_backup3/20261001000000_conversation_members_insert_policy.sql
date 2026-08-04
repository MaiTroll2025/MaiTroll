-- Allow conversation creators (or members inserting themselves) to add members
create policy "members_insert_owner_or_self"
  on public.conversation_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.created_by = auth.uid()
    )
  );
