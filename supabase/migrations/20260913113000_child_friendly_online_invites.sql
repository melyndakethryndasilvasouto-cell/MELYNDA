-- Torna a conexão entre amigos simples sem expor o UUID da sessão anônima.
-- O código curto é apenas um atalho para convite; a autorização continua
-- sendo feita pelo usuário autenticado e pelas regras existentes da sala.

alter table public.online_profiles
  add column if not exists friend_code text;

do $$
declare
  profile_row record;
  candidate text;
begin
  for profile_row in
    select user_id from public.online_profiles where friend_code is null
  loop
    loop
      candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (
        select 1 from public.online_profiles where friend_code = candidate
      );
    end loop;
    update public.online_profiles
      set friend_code = candidate
      where user_id = profile_row.user_id;
  end loop;
end;
$$;

alter table public.online_profiles
  alter column friend_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
alter table public.online_profiles
  alter column friend_code set not null;
alter table public.online_profiles
  drop constraint if exists online_profiles_friend_code_check;
alter table public.online_profiles
  add constraint online_profiles_friend_code_check
  check (friend_code ~ '^[A-Z0-9]{6}$');
create unique index if not exists online_profiles_friend_code_key
  on public.online_profiles (friend_code);

create or replace function public.list_my_online_invites()
returns table (
  id uuid,
  room_id uuid,
  from_user uuid,
  to_user uuid,
  from_name text,
  from_avatar text,
  game text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select invite.id, invite.room_id, invite.from_user, invite.to_user,
    left(invite.from_name, 16), left(invite.from_avatar, 12), room.game,
    invite.status, invite.created_at, invite.expires_at
  from public.online_invites invite
  join public.online_rooms room on room.id = invite.room_id
  where auth.uid() is not null
    and invite.to_user = auth.uid()
    and invite.status = 'pending'
    and room.status = 'waiting'
    and invite.expires_at > now()
  order by invite.created_at desc
  limit 10;
$$;

create or replace function public.create_online_invite_by_code(friend_code text, game_type text default 'tic-tac-toe')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(regexp_replace(trim(coalesce(friend_code, '')), '\s+', '', 'g'));
  guest_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if normalized_code !~ '^[A-Z0-9]{6}$' then raise exception 'FRIEND_CODE_INVALID'; end if;

  select user_id into guest_id
    from public.online_profiles
    where public.online_profiles.friend_code = normalized_code;
  if guest_id is null then raise exception 'FRIEND_CODE_NOT_FOUND'; end if;

  return public.create_online_invite(guest_id, game_type);
end;
$$;

-- A nova tentativa substitui uma espera antiga abandonada. Uma sala ativa
-- continua protegida: só a saída explícita ou o fluxo de aceite pode encerrá-la.
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

  -- Evita duplo toque e encerra apenas esperas antigas do próprio remetente.
  if exists (
    select 1 from public.online_invites
    where from_user = caller and status = 'pending'
      and created_at > now() - interval '8 seconds'
  ) then raise exception 'INVITE_RATE_LIMIT'; end if;

  update public.online_invites
    set status = 'expired'
    where status = 'pending'
      and (expires_at <= now() or (from_user = caller and created_at <= now() - interval '8 seconds'));

  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting'
      and room.host_id = caller
      and not exists (
        select 1 from public.online_invites invite
        where invite.room_id = room.id
          and invite.status = 'pending'
        and invite.expires_at > now()
      );

  -- Uma aba fechada não consegue avisar o servidor. Depois que a presença
  -- deixa de renovar, libere uma partida ativa abandonada para não prender
  -- a criança em PLAYER_BUSY na próxima visita.
  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'active'
      and caller in (room.host_id, room.guest_id)
      and room.updated_at <= now() - interval '90 seconds'
      and not exists (
        select 1 from public.online_presence presence
        where presence.user_id = caller
          and presence.activity = 'playing'
          and presence.game_key = room.game
          and presence.updated_at > now() - interval '90 seconds'
      );

  if not exists (
    select 1 from public.online_presence
    where user_id = guest and updated_at > now() - interval '90 seconds'
  ) then raise exception 'PLAYER_OFFLINE'; end if;
  if private.online_users_blocked(caller, guest) then raise exception 'PLAYER_BLOCKED'; end if;
  if exists (
    select 1 from public.online_rooms
    where status = 'active' and caller in (host_id, guest_id)
  ) then raise exception 'PLAYER_BUSY'; end if;

  select * into strict caller_profile
    from public.online_profiles where user_id = caller;

  insert into public.online_rooms (host_id, game, state)
    values (
      caller,
      game_type,
      case when game_type = 'tic-tac-toe' then
        '{"board":[null,null,null,null,null,null,null,null,null],"turn":"X","result":"playing","round":1}'::jsonb
        else jsonb_build_object('result', 'playing', 'round', 1)
      end
    )
    returning id into new_room;
  insert into public.online_invites (room_id, from_user, to_user, from_name, from_avatar)
    values (new_room, caller, guest, caller_profile.display_name, caller_profile.avatar);
  return new_room;
end;
$$;

revoke all on function public.list_my_online_invites() from public, anon;
revoke all on function public.create_online_invite_by_code(text, text) from public, anon;
revoke all on function public.create_online_invite(uuid, text) from public, anon;
grant execute on function public.list_my_online_invites() to authenticated;
grant execute on function public.create_online_invite_by_code(text, text) to authenticated;
grant execute on function public.create_online_invite(uuid, text) to authenticated;
