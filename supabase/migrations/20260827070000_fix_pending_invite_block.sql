create or replace function public.block_online_player(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); expired_room_ids uuid[] := '{}'::uuid[];
begin
  if caller is null or target is null or caller = target then raise exception 'INVALID_PLAYER'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, target::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, target::text), 0));

  insert into public.online_blocks (blocker_id, blocked_id)
    values (caller, target)
    on conflict do nothing;

  with expired as (
    update public.online_invites
      set status = 'expired'
      where status = 'pending'
        and ((from_user = caller and to_user = target) or (from_user = target and to_user = caller))
      returning room_id
  )
  select coalesce(array_agg(room_id), '{}'::uuid[]) into expired_room_ids from expired;

  update public.online_group_invites
    set status = 'cancelled'
    where status = 'pending'
      and ((from_user = caller and to_user = target) or (from_user = target and to_user = caller));

  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status in ('waiting', 'active')
      and (
        (room.host_id = caller and room.guest_id = target)
        or (room.host_id = target and room.guest_id = caller)
        or room.id = any(expired_room_ids)
      );

  delete from public.online_group_members member
    using public.online_groups online_group
    where member.group_id = online_group.id
      and online_group.status = 'active'
      and (
        (online_group.owner_id = caller and member.user_id = target and member.role = 'member')
        or
        (member.user_id = caller and member.role = 'member' and exists (
          select 1 from public.online_group_members peer
          where peer.group_id = member.group_id and peer.user_id = target
        ))
      );
end;
$$;

revoke all on function public.block_online_player(uuid) from public, anon;
grant execute on function public.block_online_player(uuid) to authenticated;

create or replace function public.respond_online_invite(invite uuid, accept_invite boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); sender uuid; recipient uuid; current_invite public.online_invites%rowtype; current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select from_user, to_user into strict sender, recipient from public.online_invites where id = invite;
  if recipient <> caller then raise exception 'INVITE_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, sender::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, sender::text), 0));
  select * into strict current_invite from public.online_invites where id = invite for update;
  if current_invite.to_user <> caller or current_invite.status <> 'pending' then raise exception 'INVITE_UNAVAILABLE'; end if;
  select * into strict current_room from public.online_rooms where id = current_invite.room_id for update;
  if current_invite.expires_at <= now() or current_room.status <> 'waiting' or current_room.guest_id is not null then
    update public.online_invites set status = 'expired' where id = invite;
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1 where id = current_invite.room_id;
    return null;
  end if;
  if private.online_users_blocked(current_invite.from_user, caller) then raise exception 'PLAYER_BLOCKED'; end if;
  if accept_invite then
    update public.online_invites set status = 'expired' where to_user = caller and status = 'pending' and id <> invite;
    update public.online_rooms room set status = 'cancelled', updated_at = now(), version = version + 1
      where room.status = 'waiting'
        and exists (
          select 1 from public.online_invites other_invite
          where other_invite.room_id = room.id
            and other_invite.to_user = caller
            and other_invite.status = 'expired'
        );
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
      where status in ('waiting', 'active') and id <> current_invite.room_id and caller in (host_id, guest_id);
    update public.online_rooms set guest_id = caller, status = 'active', updated_at = now(), version = version + 1 where id = current_invite.room_id;
    update public.online_invites set status = 'accepted' where id = invite;
  else
    update public.online_invites set status = 'declined' where id = invite;
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1 where id = current_invite.room_id;
  end if;
  return current_invite.room_id;
end;
$$;

create or replace function public.go_offline()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); expired_room_ids uuid[] := '{}'::uuid[];
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));

  delete from public.online_presence where user_id = caller;

  with expired as (
    update public.online_invites
      set status = 'expired'
      where status = 'pending' and caller in (from_user, to_user)
      returning room_id
  )
  select coalesce(array_agg(room_id), '{}'::uuid[]) into expired_room_ids from expired;

  update public.online_group_invites
    set status = 'cancelled'
    where status = 'pending' and caller in (from_user, to_user);

  update public.online_rooms
    set status = 'cancelled', updated_at = now(), version = version + 1
    where status in ('waiting', 'active')
      and (caller in (host_id, guest_id) or id = any(expired_room_ids));
end;
$$;

revoke all on function public.respond_online_invite(uuid, boolean), public.go_offline() from public, anon;
grant execute on function public.respond_online_invite(uuid, boolean), public.go_offline() to authenticated;
