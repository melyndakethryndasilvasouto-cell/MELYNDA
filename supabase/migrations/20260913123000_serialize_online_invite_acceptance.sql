-- Serializa aceites por destinatário e evita encerrar uma partida ativa sem
-- uma ação clara do jogador.

create or replace function public.respond_online_invite(invite uuid, accept_invite boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sender uuid;
  recipient uuid;
  current_invite public.online_invites%rowtype;
  current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Todos os convites recebidos pela mesma pessoa passam pelo mesmo lock.
  -- Assim, dois toques simultâneos nunca ativam duas salas diferentes.
  perform pg_advisory_xact_lock(hashtextextended('online-invite-recipient:' || caller::text, 0));

  select from_user, to_user into strict sender, recipient
    from public.online_invites
    where id = invite;
  if recipient <> caller then raise exception 'INVITE_UNAVAILABLE'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, sender::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, sender::text), 0));

  select * into strict current_invite
    from public.online_invites
    where id = invite
    for update;
  select * into strict current_room
    from public.online_rooms
    where id = current_invite.room_id
    for update;

  -- Um retry depois de uma resposta perdida retorna a mesma sala.
  if current_invite.to_user = caller
    and current_invite.status = 'accepted'
    and current_room.guest_id = caller
    and accept_invite then
    return current_room.id;
  end if;
  if current_invite.to_user <> caller or current_invite.status <> 'pending' then
    raise exception 'INVITE_UNAVAILABLE';
  end if;

  if current_invite.expires_at <= now() or current_room.status <> 'waiting' or current_room.guest_id is not null then
    update public.online_invites set status = 'expired' where id = invite;
    update public.online_rooms
      set status = 'cancelled', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
    return null;
  end if;
  if private.online_users_blocked(current_invite.from_user, caller) then
    raise exception 'PLAYER_BLOCKED';
  end if;

  if accept_invite then
    -- Recupera salas ativas abandonadas quando a presença já expirou.
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

    if exists (
      select 1 from public.online_rooms
      where status = 'active' and caller in (host_id, guest_id)
    ) then
      raise exception 'PLAYER_BUSY';
    end if;

    -- A aceitação escolhe uma única espera do destinatário; salas ativas
    -- nunca entram nesta limpeza automática.
    update public.online_invites
      set status = 'expired'
      where to_user = caller and status = 'pending' and id <> invite;
    update public.online_rooms room
      set status = 'cancelled', updated_at = now(), version = version + 1
      where room.status = 'waiting'
        and exists (
          select 1 from public.online_invites other_invite
          where other_invite.room_id = room.id
            and other_invite.to_user = caller
            and other_invite.status = 'expired'
        );

    update public.online_rooms
      set guest_id = caller, status = 'active', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
    update public.online_invites set status = 'accepted' where id = invite;
  else
    update public.online_invites set status = 'declined' where id = invite;
    update public.online_rooms
      set status = 'cancelled', updated_at = now(), version = version + 1
      where id = current_invite.room_id;
  end if;
  return current_invite.room_id;
end;
$$;

revoke all on function public.respond_online_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_online_invite(uuid, boolean) to authenticated;
