create or replace function public.create_online_invite(guest uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  caller_profile public.online_profiles%rowtype;
  new_room uuid;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if guest is null or guest = caller then raise exception 'INVALID_GUEST'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));

  update public.online_invites
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now()
      and (from_user in (caller, guest) or to_user in (caller, guest));
  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting'
      and exists (
        select 1 from public.online_invites invite
        where invite.room_id = room.id and invite.status = 'expired'
          and (invite.from_user in (caller, guest) or invite.to_user in (caller, guest))
      );

  if not exists (select 1 from public.online_profiles where user_id = guest) then
    raise exception 'PLAYER_OFFLINE';
  end if;
  if exists (
    select 1 from public.online_rooms
    where status in ('waiting', 'active')
      and (caller in (host_id, guest_id) or guest in (host_id, guest_id))
  ) then raise exception 'PLAYER_BUSY'; end if;
  if exists (
    select 1 from public.online_invites
    where from_user = caller and created_at > now() - interval '8 seconds'
  ) then raise exception 'INVITE_RATE_LIMIT'; end if;

  select * into strict caller_profile from public.online_profiles where user_id = caller;
  insert into public.online_rooms (host_id) values (caller) returning id into new_room;
  insert into public.online_invites (room_id, from_user, to_user, from_name, from_avatar)
  values (new_room, caller, guest, caller_profile.display_name, caller_profile.avatar);
  return new_room;
end;
$$;

create or replace function public.respond_online_invite(invite uuid, accept_invite boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_invite public.online_invites%rowtype;
  current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict current_invite from public.online_invites where id = invite for update;
  if current_invite.to_user <> caller or current_invite.status <> 'pending' then
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  select * into strict current_room from public.online_rooms where id = current_invite.room_id for update;
  if current_room.status <> 'waiting' or current_room.guest_id is not null then
    update public.online_invites set status = 'expired' where id = invite;
    return null;
  end if;
  if current_invite.expires_at <= now() then
    update public.online_invites set status = 'expired' where id = invite;
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
    return null;
  end if;

  if accept_invite then
    update public.online_rooms
      set guest_id = caller, status = 'active', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
    update public.online_invites set status = 'accepted' where id = invite;
  else
    update public.online_invites set status = 'declined' where id = invite;
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
  end if;
  return current_invite.room_id;
end;
$$;

revoke all on function public.create_online_invite(uuid) from public, anon;
revoke all on function public.respond_online_invite(uuid, boolean) from public, anon;
grant execute on function public.create_online_invite(uuid) to authenticated;
grant execute on function public.respond_online_invite(uuid, boolean) to authenticated;

drop policy if exists "online channels receive" on realtime.messages;
create policy "online channels receive"
  on realtime.messages for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and (
      realtime.topic() = 'online:lobby'
      or exists (
        select 1 from public.online_rooms room
        where realtime.topic() = 'online:room:' || room.id::text
          and room.status <> 'cancelled'
          and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
      )
    )
  );

drop policy if exists "online channels send" on realtime.messages;
create policy "online channels send"
  on realtime.messages for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and (
      realtime.topic() = 'online:lobby'
      or exists (
        select 1 from public.online_rooms room
        where realtime.topic() = 'online:room:' || room.id::text
          and room.status <> 'cancelled'
          and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
      )
    )
  );
