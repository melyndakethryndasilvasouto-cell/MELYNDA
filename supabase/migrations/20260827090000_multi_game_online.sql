-- ============================================================
-- Migration: Multi-game online support
-- Expands online_rooms to support Memory, Checkers, Quiz, Pong
-- Uses Supabase Realtime Broadcast for non-TTT game state sync
-- ============================================================

-- 1. Remove TicTacToe-only constraints on online_rooms
alter table public.online_rooms
  drop constraint if exists online_rooms_game_check;

alter table public.online_rooms
  drop constraint if exists online_rooms_check;

-- 2. Add expanded game type constraint
alter table public.online_rooms
  add constraint online_rooms_game_check
  check (game in ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong'));

-- 3. Replace create_online_invite to accept game_type parameter
--    Old signature: create_online_invite(guest uuid)
--    New signature: create_online_invite(guest uuid, game_type text DEFAULT 'tic-tac-toe')
drop function if exists public.create_online_invite(uuid);

create or replace function public.create_online_invite(guest uuid, game_type text default 'tic-tac-toe')
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
  if game_type not in ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong') then
    raise exception 'INVALID_GAME';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));
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

  -- Create room with correct game type and minimal initial state
  insert into public.online_rooms (host_id, game, state)
  values (
    caller,
    game_type,
    case game_type
      when 'tic-tac-toe' then
        '{"board":[null,null,null,null,null,null,null,null,null],"turn":"X","result":"playing","round":1}'::jsonb
      else
        jsonb_build_object('result', 'playing', 'round', 1)
    end
  )
  returning id into new_room;

  insert into public.online_invites (room_id, from_user, to_user, from_name, from_avatar)
  values (new_room, caller, guest, caller_profile.display_name, caller_profile.avatar);

  return new_room;
end;
$$;

-- 4. Generic host-side game state update (for non-TTT games via broadcast)
--    Host calls this to mark room as finished when game ends
create or replace function public.finish_online_room(room uuid, winner text default null)
returns public.online_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if caller <> current_room.host_id and caller <> current_room.guest_id then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  update public.online_rooms set
    state = state || jsonb_build_object('result', coalesce(winner, 'finished'), 'winner', winner),
    status = 'finished',
    updated_at = now(),
    version = version + 1
  where id = room
  returning * into current_room;
  return current_room;
end;
$$;

-- 5. Generic room restart (works for any game)
create or replace function public.restart_online_room(room uuid)
returns public.online_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
  new_state jsonb;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if caller <> current_room.host_id and caller <> current_room.guest_id then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  if current_room.status <> 'finished' then raise exception 'ROOM_NOT_FINISHED'; end if;
  if current_room.guest_id is null then raise exception 'WAITING_FOR_GUEST'; end if;

  new_state := case current_room.game
    when 'tic-tac-toe' then
      jsonb_build_object(
        'board', jsonb_build_array(null,null,null,null,null,null,null,null,null),
        'turn', 'X', 'result', 'playing',
        'round', coalesce((current_room.state->>'round')::integer, 1) + 1
      )
    else
      jsonb_build_object('result', 'playing', 'round', coalesce((current_room.state->>'round')::integer, 1) + 1)
  end;

  update public.online_rooms set
    state = new_state,
    status = 'active',
    updated_at = now(),
    version = version + 1
  where id = room
  returning * into current_room;
  return current_room;
end;
$$;

-- 6. Grant permissions
revoke all on function public.create_online_invite(uuid, text) from public, anon;
grant execute on function public.create_online_invite(uuid, text) to authenticated;
revoke all on function public.finish_online_room(uuid, text) from public, anon;
grant execute on function public.finish_online_room(uuid, text) to authenticated;
revoke all on function public.restart_online_room(uuid) from public, anon;
grant execute on function public.restart_online_room(uuid) to authenticated;
