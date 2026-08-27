ALTER TABLE public.online_rooms DROP CONSTRAINT IF EXISTS online_rooms_game_check;

ALTER TABLE public.online_rooms
ADD CONSTRAINT online_rooms_game_check 
CHECK (game IN ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong', 'uno'));

create or replace function public.create_online_invite(guest uuid, game_type text default 'tic-tac-toe')
returns uuid as $$
declare
  caller uuid := auth.uid();
  new_room_id uuid;
  new_invite_id uuid;
begin
  if game_type not in ('tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong', 'uno') then
    raise exception 'INVALID_GAME';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));

  if not exists (select 1 from public.online_profiles where user_id = guest) then
    raise exception 'PLAYER_OFFLINE';
  end if;
  if exists (select 1 from public.online_blocks where blocker = caller and blocked = guest or blocker = guest and blocked = caller) then
    raise exception 'PLAYER_BLOCKED';
  end if;
  if exists (
    select 1 from public.online_rooms
    where (host_id = caller or guest_id = caller) and status in ('waiting', 'active')
    and updated_at > now() - interval '2 minutes'
  ) then
    raise exception 'PLAYER_BUSY';
  end if;
  if exists (
    select 1 from public.online_invites
    where host_id = caller and status = 'pending' and expires_at > now()
  ) then
    raise exception 'PLAYER_BUSY';
  end if;
  if (
    select count(*) from public.online_invites
    where host_id = caller and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'INVITE_RATE_LIMIT';
  end if;

  insert into public.online_rooms (
    host_id, guest_id, game, status, state
  ) values (
    caller, guest, 
    game_type,
    'waiting',
    case game_type
      when 'tic-tac-toe' then '{"board": [null,null,null,null,null,null,null,null,null], "turn": "host", "winner": null}'::jsonb
      else '{}'::jsonb
    end
  ) returning id into new_room_id;

  insert into public.online_invites (
    host_id, guest_id, room_id, expires_at
  ) values (
    caller, guest, new_room_id, now() + interval '30 seconds'
  ) returning id into new_invite_id;

  return new_room_id;
end;
$$ language plpgsql security definer;