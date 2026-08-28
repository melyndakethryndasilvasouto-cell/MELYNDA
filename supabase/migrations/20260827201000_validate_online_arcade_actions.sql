-- Valida no servidor as ações dos modos online compartilhados.
create or replace function public.record_online_game_action(room uuid, action jsonb)
returns public.online_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid(); current_room public.online_rooms%rowtype; action_type text;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if action is null or jsonb_typeof(action) <> 'object' then raise exception 'INVALID_ACTION'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  if caller <> current_room.host_id and caller <> current_room.guest_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if current_room.game not in ('coloring', 'snake', 'simon', 'puzzle', 'pong', 'hangman') then raise exception 'INVALID_GAME'; end if;

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
  end if;

  update public.online_rooms set
    state = state || jsonb_build_object('last_action', action, 'last_actor', caller, 'last_action_at', now()),
    updated_at = now(), version = version + 1
  where id = room returning * into current_room;
  return current_room;
end;
$$;

revoke all on function public.record_online_game_action(uuid, jsonb) from public, anon;
grant execute on function public.record_online_game_action(uuid, jsonb) to authenticated;

create or replace function public.finish_online_room(room uuid, winner text default null)
returns public.online_rooms
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if winner is not null and winner not in ('host', 'guest', 'draw') then raise exception 'INVALID_WINNER'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if caller <> current_room.host_id and caller <> current_room.guest_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  update public.online_rooms set
    state = state || jsonb_build_object('result', coalesce(winner, 'finished'), 'winner', winner),
    status = 'finished', updated_at = now(), version = version + 1
  where id = room returning * into current_room;
  return current_room;
end;
$$;

revoke all on function public.finish_online_room(uuid, text) from public, anon;
grant execute on function public.finish_online_room(uuid, text) to authenticated;
