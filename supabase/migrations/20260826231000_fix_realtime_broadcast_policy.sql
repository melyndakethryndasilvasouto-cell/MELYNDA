drop policy if exists "online channels send" on realtime.messages;
create policy "online channels send"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() = 'online:lobby'
    or exists (
      select 1 from public.online_rooms room
      where realtime.topic() = 'online:room:' || room.id::text
        and room.status <> 'cancelled'
        and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
    )
  );
