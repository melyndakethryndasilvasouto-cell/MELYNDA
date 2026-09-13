-- Corrige regressões acumuladas nas definições finais do modo Online.
-- Esta migração é append-only porque as versões anteriores já podem estar
-- aplicadas em produção.

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
    'memory', 'tic-tac-toe', 'checkers', 'uno', 'coloring', 'snake',
    'simon', 'quiz', 'puzzle', 'pong', 'hangman'
  ) then
    raise exception 'INVALID_GAME';
  end if;

  select * into strict profile
    from public.online_profiles
    where user_id = caller;

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
    'tic-tac-toe', 'memory', 'checkers', 'quiz', 'pong', 'uno',
    'coloring', 'snake', 'simon', 'puzzle', 'hangman'
  ) then
    raise exception 'INVALID_GAME';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));

  -- A última definição desta função deixou de encerrar salas cujo convite
  -- expirou. Faça a limpeza antes de verificar se o anfitrião está ocupado.
  update public.online_invites
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now();

  update public.online_rooms room
    set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting'
      and exists (
        select 1
        from public.online_invites invite
        where invite.room_id = room.id
          and invite.status = 'expired'
      );

  if not exists (
    select 1
    from public.online_presence
    where user_id = guest
      and updated_at > now() - interval '90 seconds'
  ) then raise exception 'PLAYER_OFFLINE'; end if;
  if private.online_users_blocked(caller, guest) then raise exception 'PLAYER_BLOCKED'; end if;
  if exists (
    select 1
    from public.online_rooms
    where status in ('waiting', 'active')
      and caller in (host_id, guest_id)
  ) then raise exception 'PLAYER_BUSY'; end if;
  if exists (
    select 1
    from public.online_invites
    where from_user = caller
      and created_at > now() - interval '8 seconds'
  ) then raise exception 'INVITE_RATE_LIMIT'; end if;

  select * into strict caller_profile
    from public.online_profiles
    where user_id = caller;

  insert into public.online_rooms (host_id, game, state)
    values (
      caller,
      game_type,
      case
        when game_type = 'tic-tac-toe' then
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

create or replace function public.respond_online_group_invite(invite uuid, accept_invite boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sender uuid;
  recipient uuid;
  current_invite public.online_group_invites%rowtype;
  current_group public.online_groups%rowtype;
  profile public.online_profiles%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;

  select from_user, to_user into strict sender, recipient
    from public.online_group_invites
    where id = invite;
  if recipient <> caller then raise exception 'INVITE_UNAVAILABLE'; end if;

  -- Use exatamente a mesma ordem de locks de block_online_player para que
  -- bloqueio e aceite não possam atravessar a checagem um do outro.
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, sender::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, sender::text), 0));

  select * into strict current_invite
    from public.online_group_invites
    where id = invite
    for update;
  if current_invite.to_user <> caller or current_invite.status <> 'pending' then
    raise exception 'INVITE_UNAVAILABLE';
  end if;

  select * into strict current_group
    from public.online_groups
    where id = current_invite.group_id
    for update;
  if current_invite.expires_at <= now() or current_group.status <> 'active' then
    update public.online_group_invites set status = 'expired' where id = invite;
    return null;
  end if;
  if private.online_users_blocked(current_invite.from_user, caller) then
    raise exception 'PLAYER_BLOCKED';
  end if;

  if accept_invite then
    if (select count(*) from public.online_group_members where group_id = current_group.id) >= current_group.max_members then
      raise exception 'GROUP_FULL';
    end if;
    select * into strict profile
      from public.online_profiles
      where user_id = caller;
    insert into public.online_group_members (group_id, user_id, role, display_name, avatar)
      values (current_group.id, caller, 'member', profile.display_name, profile.avatar)
      on conflict (group_id, user_id) do nothing;
    update public.online_group_invites set status = 'accepted' where id = invite;
  else
    update public.online_group_invites set status = 'declined' where id = invite;
  end if;

  return current_group.id;
end;
$$;

revoke all on function public.heartbeat_online_presence(text, text) from public, anon;
revoke all on function public.create_online_invite(uuid, text) from public, anon;
revoke all on function public.respond_online_group_invite(uuid, boolean) from public, anon;

grant execute on function public.heartbeat_online_presence(text, text) to authenticated;
grant execute on function public.create_online_invite(uuid, text) to authenticated;
grant execute on function public.respond_online_group_invite(uuid, boolean) to authenticated;
