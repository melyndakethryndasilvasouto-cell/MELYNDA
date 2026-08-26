create schema if not exists private;

create table if not exists public.online_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 1 and 16
    and display_name !~ '[[:cntrl:]]'
  ),
  avatar text not null check (char_length(avatar) between 1 and 12),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'tic-tac-toe' check (game = 'tic-tac-toe'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'cancelled')),
  state jsonb not null default '{"board":[null,null,null,null,null,null,null,null,null],"turn":"X","result":"playing","round":1}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guest_id is null or guest_id <> host_id),
  check (jsonb_typeof(state->'board') = 'array' and jsonb_array_length(state->'board') = 9)
);

create table if not exists public.online_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.online_rooms(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 16),
  from_avatar text not null check (char_length(from_avatar) between 1 and 12),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  check (from_user <> to_user)
);

create index if not exists online_invites_to_user_status_idx
  on public.online_invites (to_user, status, created_at desc);
create index if not exists online_rooms_participants_idx
  on public.online_rooms (host_id, guest_id, updated_at desc);

alter table public.online_profiles enable row level security;
alter table public.online_rooms enable row level security;
alter table public.online_invites enable row level security;

revoke all on table public.online_profiles, public.online_rooms, public.online_invites from anon, authenticated;
grant select, insert, update on table public.online_profiles to authenticated;
grant select on table public.online_rooms, public.online_invites to authenticated;

create policy "online profile read for participants"
  on public.online_profiles for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.online_rooms room
      where room.status <> 'cancelled'
        and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
        and (user_id = room.host_id or user_id = room.guest_id)
    )
  );
create policy "online profile insert own"
  on public.online_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "online profile update own"
  on public.online_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "room participants read"
  on public.online_rooms for select to authenticated
  using ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);

create policy "invite participants read"
  on public.online_invites for select to authenticated
  using ((select auth.uid()) = from_user or (select auth.uid()) = to_user);

create or replace function private.online_ttt_result(board jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  line integer[];
  mark text;
begin
  foreach line slice 1 in array array[
    array[0,1,2], array[3,4,5], array[6,7,8],
    array[0,3,6], array[1,4,7], array[2,5,8],
    array[0,4,8], array[2,4,6]
  ] loop
    mark := board->>line[1];
    if mark is not null and mark = board->>line[2] and mark = board->>line[3] then
      return mark;
    end if;
  end loop;
  if not board @> '[null]'::jsonb then return 'draw'; end if;
  return 'playing';
end;
$$;

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
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  if current_invite.expires_at <= now() then
    update public.online_invites set status = 'expired' where id = invite;
    update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
    raise exception 'INVITE_EXPIRED';
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

create or replace function public.play_online_ttt(room uuid, cell integer)
returns public.online_rooms
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
  symbol text;
  board jsonb;
  outcome text;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if cell < 0 or cell > 8 then raise exception 'INVALID_CELL'; end if;
  select * into strict current_room from public.online_rooms where id = room for update;
  if current_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  symbol := case when caller = current_room.host_id then 'X'
                 when caller = current_room.guest_id then 'O' end;
  if symbol is null then raise exception 'NOT_A_PARTICIPANT'; end if;
  if current_room.state->>'turn' <> symbol then raise exception 'NOT_YOUR_TURN'; end if;
  board := current_room.state->'board';
  if board->cell <> 'null'::jsonb then raise exception 'CELL_OCCUPIED'; end if;
  board := jsonb_set(board, array[cell::text], to_jsonb(symbol), false);
  outcome := private.online_ttt_result(board);

  update public.online_rooms set
    state = jsonb_build_object(
      'board', board,
      'turn', case when symbol = 'X' then 'O' else 'X' end,
      'result', outcome,
      'round', coalesce((state->>'round')::integer, 1)
    ),
    status = case when outcome = 'playing' then 'active' else 'finished' end,
    updated_at = now(),
    version = version + 1
  where id = room
  returning * into current_room;
  return current_room;
end;
$$;

create or replace function public.restart_online_ttt(room uuid)
returns public.online_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_room public.online_rooms%rowtype;
begin
  select * into strict current_room from public.online_rooms where id = room for update;
  if caller is null or (caller <> current_room.host_id and caller <> current_room.guest_id) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  if current_room.status <> 'finished' then raise exception 'ROOM_NOT_FINISHED'; end if;
  if current_room.guest_id is null then raise exception 'WAITING_FOR_GUEST'; end if;
  update public.online_rooms set
    state = jsonb_build_object(
      'board', jsonb_build_array(null,null,null,null,null,null,null,null,null),
      'turn', 'X', 'result', 'playing',
      'round', coalesce((state->>'round')::integer, 1) + 1
    ),
    status = 'active', updated_at = now(), version = version + 1
  where id = room returning * into current_room;
  return current_room;
end;
$$;

create or replace function public.leave_online_room(room uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
  where id = room and ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);
end;
$$;

revoke all on function public.create_online_invite(uuid) from public, anon;
revoke all on function public.respond_online_invite(uuid, boolean) from public, anon;
revoke all on function public.play_online_ttt(uuid, integer) from public, anon;
revoke all on function public.restart_online_ttt(uuid) from public, anon;
revoke all on function public.leave_online_room(uuid) from public, anon;
grant execute on function public.create_online_invite(uuid) to authenticated;
grant execute on function public.respond_online_invite(uuid, boolean) to authenticated;
grant execute on function public.play_online_ttt(uuid, integer) to authenticated;
grant execute on function public.restart_online_ttt(uuid) to authenticated;
grant execute on function public.leave_online_room(uuid) to authenticated;

create policy "online channels receive"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() = 'online:lobby'
    or exists (
      select 1 from public.online_rooms room
      where realtime.topic() = 'online:room:' || room.id::text
        and room.status <> 'cancelled'
        and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
    )
  );
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

do $$ begin
  alter publication supabase_realtime add table public.online_rooms;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_invites;
exception when duplicate_object then null;
end $$;
