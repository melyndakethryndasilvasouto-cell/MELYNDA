-- Acrescenta Xadrez, Pedra/Papel/Tesoura e Adedonha ao modo Online.
-- A migração preserva todas as modalidades anteriores e mantém a limpeza
-- de convites/salas introduzida em 20260907120000_repair_online_lifecycle.sql.

alter table public.online_rooms drop constraint if exists online_rooms_game_check;
alter table public.online_rooms add constraint online_rooms_game_check
  check (game in (
    'tic-tac-toe', 'memory', 'checkers', 'chess', 'rock-paper-scissors',
    'adedonha', 'quiz', 'pong', 'uno', 'coloring', 'snake', 'simon',
    'puzzle', 'hangman'
  ));

alter table public.online_presence drop constraint if exists online_presence_game_key_check;
alter table public.online_presence add constraint online_presence_game_key_check
  check (game_key is null or game_key in (
    'memory', 'tic-tac-toe', 'checkers', 'chess', 'rock-paper-scissors',
    'adedonha', 'uno', 'coloring', 'snake', 'simon', 'quiz', 'puzzle',
    'pong', 'hangman'
  ));

create or replace function public.heartbeat_online_presence(next_activity text, next_game_key text default null)
returns public.online_presence
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  profile public.online_profiles%rowtype;
  presence_row public.online_presence%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if next_activity not in ('lobby', 'playing', 'group', 'away') then raise exception 'INVALID_ACTIVITY'; end if;
  if next_game_key is not null and next_game_key not in (
    'memory', 'tic-tac-toe', 'checkers', 'chess', 'rock-paper-scissors',
    'adedonha', 'uno', 'coloring', 'snake', 'simon', 'quiz', 'puzzle',
    'pong', 'hangman'
  ) then raise exception 'INVALID_GAME'; end if;

  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_presence where updated_at <= now() - interval '10 minutes';
  delete from public.online_lobby_messages where expires_at <= now();
  delete from public.online_group_messages where expires_at <= now();
  delete from public.online_room_messages where expires_at <= now();

  insert into public.online_presence (user_id, display_name, avatar, activity, game_key, updated_at)
    values (caller, profile.display_name, profile.avatar, next_activity, next_game_key, now())
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      avatar = excluded.avatar,
      activity = excluded.activity,
      game_key = excluded.game_key,
      updated_at = now()
    returning * into presence_row;
  return presence_row;
end;
$$;

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
  if game_type not in (
    'tic-tac-toe', 'memory', 'checkers', 'chess', 'rock-paper-scissors',
    'adedonha', 'quiz', 'pong', 'uno', 'coloring', 'snake', 'simon',
    'puzzle', 'hangman'
  ) then raise exception 'INVALID_GAME'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));

  update public.online_invites set status = 'expired'
    where status = 'pending' and expires_at <= now();
  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting' and exists (
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

  select * into strict caller_profile from public.online_profiles where user_id = caller;
  insert into public.online_rooms (host_id, game, state)
    values (
      caller,
      game_type,
      case when game_type = 'tic-tac-toe'
        then '{"board":[null,null,null,null,null,null,null,null,null],"turn":"X","result":"playing","round":1}'::jsonb
        else jsonb_build_object('result', 'playing', 'round', 1)
      end
    )
    returning id into new_room;
  insert into public.online_invites (room_id, from_user, to_user, from_name, from_avatar)
    values (new_room, caller, guest, caller_profile.display_name, caller_profile.avatar);
  return new_room;
end;
$$;

create or replace function public.record_online_game_action(room uuid, action jsonb)
returns public.online_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
  action_type text;
  answer record;
  stored_action jsonb;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if action is null or jsonb_typeof(action) <> 'object' or octet_length(action::text) > 1200 then raise exception 'INVALID_ACTION'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  if caller <> current_room.host_id and caller <> current_room.guest_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if current_room.game not in (
    'coloring', 'snake', 'simon', 'puzzle', 'pong', 'hangman',
    'chess', 'rock-paper-scissors', 'adedonha'
  ) then raise exception 'INVALID_GAME'; end if;
  if (current_room.state->>'last_action_at')::timestamptz > now() - interval '80 milliseconds' then raise exception 'ACTION_RATE_LIMIT'; end if;

  action_type := action->>'type';
  if current_room.game = 'coloring' then
    if action_type <> 'color' or (action->>'index') !~ '^[0-9]+$' or (action->>'index')::integer not between 0 and 11 or action->>'color' not in ('#EF4444', '#3B82F6', '#22C55E', '#EAB308') then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'snake' then
    if action_type <> 'collect' then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'simon' then
    if action_type <> 'simon' or (action->>'value') !~ '^[0-3]$' then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'puzzle' then
    if action_type <> 'tile' or (action->>'index') !~ '^[0-8]$' then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'pong' then
    if action_type <> 'paddle' or action->>'direction' not in ('-1', '1') then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'hangman' then
    if action_type <> 'guess' or action->>'letter' !~ '^[A-Z]$' then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'chess' then
    if action_type <> 'chess-move'
      or jsonb_typeof(action->'from') <> 'array' or jsonb_array_length(action->'from') <> 2
      or jsonb_typeof(action->'to') <> 'array' or jsonb_array_length(action->'to') <> 2
      or exists (select 1 from jsonb_array_elements_text(action->'from') value where value !~ '^[0-7]$')
      or exists (select 1 from jsonb_array_elements_text(action->'to') value where value !~ '^[0-7]$')
    then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'rock-paper-scissors' then
    if action_type <> 'rps-choice' or action->>'choice' not in ('rock', 'paper', 'scissors') then raise exception 'INVALID_ACTION'; end if;
  elsif current_room.game = 'adedonha' then
    if action_type <> 'adedonha-submit' or jsonb_typeof(action->'answers') <> 'object' then raise exception 'INVALID_ACTION'; end if;
    if (select count(*) from jsonb_object_keys(action->'answers')) <> 8
      or not ((action->'answers') ?& array['name','animal','food','country','city','state','object','bible'])
    then raise exception 'INVALID_ACTION'; end if;
    for answer in select key, value from jsonb_each_text(action->'answers') loop
      if answer.key not in ('name','animal','food','country','city','state','object','bible')
        or char_length(answer.value) > 24
        or (answer.value <> '' and (char_length(answer.value) < 2 or answer.value !~ '^[[:alpha:]À-ÿ ''-]+$'))
      then raise exception 'INVALID_ACTION'; end if;
    end loop;
  end if;

  -- Respostas livres e escolhas secretas não ficam persistidas na sala.
  stored_action := case when current_room.game in ('rock-paper-scissors', 'adedonha')
    then jsonb_build_object('type', action_type)
    else action
  end;
  update public.online_rooms set
    state = state || jsonb_build_object('last_action', stored_action, 'last_actor', caller, 'last_action_at', now()),
    updated_at = now(), version = version + 1
  where id = room returning * into current_room;
  return current_room;
end;
$$;

create or replace function public.finish_online_room(room uuid, winner text default null)
returns public.online_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if winner is not null and winner not in ('host', 'guest', 'draw') then raise exception 'INVALID_WINNER'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if caller <> current_room.host_id and caller <> current_room.guest_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  -- Nos jogos por Broadcast, somente o anfitrião mantém o estado autoritativo.
  -- Isso impede que o convidado encerre a sala declarando um placar arbitrário.
  if current_room.game <> 'tic-tac-toe' and caller <> current_room.host_id then raise exception 'NOT_AUTHORITATIVE_HOST'; end if;
  update public.online_rooms set
    state = state || jsonb_build_object('result', coalesce(winner, 'finished'), 'winner', winner),
    status = 'finished', updated_at = now(), version = version + 1
  where id = room returning * into current_room;
  return current_room;
end;
$$;

revoke all on function public.heartbeat_online_presence(text, text) from public, anon;
revoke all on function public.create_online_invite(uuid, text) from public, anon;
revoke all on function public.record_online_game_action(uuid, jsonb) from public, anon;
revoke all on function public.finish_online_room(uuid, text) from public, anon;
grant execute on function public.heartbeat_online_presence(text, text) to authenticated;
grant execute on function public.create_online_invite(uuid, text) to authenticated;
grant execute on function public.record_online_game_action(uuid, jsonb) to authenticated;
grant execute on function public.finish_online_room(uuid, text) to authenticated;
