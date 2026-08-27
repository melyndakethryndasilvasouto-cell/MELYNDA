-- Corrige a função multi-jogo criada pela migração de UNO.
-- O esquema social usa from_user/to_user e blocker_id/blocked_id;
-- host_id/guest_id e blocker/blocked nunca fizeram parte dessas tabelas.

alter table public.online_rooms
  drop constraint if exists online_rooms_game_check;

alter table public.online_rooms
  add constraint online_rooms_game_check
  check (game in ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong', 'uno'));

create or replace function public.create_online_invite(guest uuid, game_type text default 'tic-tac-toe')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_profile public.online_profiles%rowtype;
  new_room uuid;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if guest is null or guest = caller then raise exception 'CANNOT_INVITE_SELF'; end if;
  if game_type not in ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong', 'uno') then
    raise exception 'INVALID_GAME';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));

  update public.online_invites
    set status = 'expired'
    where status = 'pending' and expires_at <= now();
  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting'
      and exists (
        select 1 from public.online_invites invite
        where invite.room_id = room.id and invite.status = 'expired'
      );

  if not exists (
    select 1 from public.online_presence
    where user_id = guest and updated_at > now() - interval '90 seconds'
  ) then raise exception 'PLAYER_OFFLINE'; end if;
  if private.online_users_blocked(caller, guest) then raise exception 'PLAYER_BLOCKED'; end if;
  if exists (
    select 1 from public.online_rooms
    where status in ('waiting', 'active') and caller in (host_id, guest_id)
  ) then raise exception 'PLAYER_BUSY'; end if;
  if exists (
    select 1 from public.online_invites
    where from_user = caller and created_at > now() - interval '8 seconds'
  ) then raise exception 'INVITE_RATE_LIMIT'; end if;

  select * into strict caller_profile
    from public.online_profiles where user_id = caller;

  insert into public.online_rooms (host_id, game, state)
  values (
    caller,
    game_type,
    case game_type
      when 'tic-tac-toe' then
        '{"board":[null,null,null,null,null,null,null,null,null],"turn":"X","result":"playing","round":1}'::jsonb
      else jsonb_build_object('result', 'playing', 'round', 1)
    end
  ) returning id into new_room;

  insert into public.online_invites (room_id, from_user, to_user, from_name, from_avatar)
    values (new_room, caller, guest, caller_profile.display_name, caller_profile.avatar);

  return new_room;
end;
$$;

revoke all on function public.create_online_invite(uuid, text) from public, anon;
grant execute on function public.create_online_invite(uuid, text) to authenticated;
