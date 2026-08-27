create table if not exists public.online_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.online_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 16),
  avatar text not null check (char_length(avatar) between 1 and 12),
  activity text not null default 'lobby' check (activity in ('lobby', 'playing', 'group', 'away')),
  game_key text check (game_key is null or game_key in ('memory', 'tic-tac-toe', 'checkers', 'uno', 'coloring', 'snake', 'simon', 'quiz', 'puzzle', 'pong')),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_lobby_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 16),
  sender_avatar text not null check (char_length(sender_avatar) between 1 and 12),
  message_index smallint not null check (message_index between 0 and 3),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);
create index if not exists online_lobby_messages_recent_idx on public.online_lobby_messages (created_at desc);

create table if not exists public.online_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 32 and name !~ '[[:cntrl:]]'),
  status text not null default 'active' check (status in ('active', 'closed')),
  max_members smallint not null default 8 check (max_members between 2 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_group_members (
  group_id uuid not null references public.online_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (char_length(display_name) between 1 and 16),
  avatar text not null check (char_length(avatar) between 1 and 12),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.online_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.online_groups(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 16),
  from_avatar text not null check (char_length(from_avatar) between 1 and 12),
  group_name text not null check (char_length(group_name) between 2 and 32),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  check (from_user <> to_user)
);

create unique index if not exists online_group_invites_pending_idx
  on public.online_group_invites (group_id, to_user) where status = 'pending';
create index if not exists online_group_invites_recipient_idx
  on public.online_group_invites (to_user, status, created_at desc);

create table if not exists public.online_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.online_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 16),
  sender_avatar text not null check (char_length(sender_avatar) between 1 and 12),
  kind text not null default 'text' check (kind in ('text', 'audio')),
  body text,
  audio_data text,
  audio_mime text,
  audio_duration_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (
    (kind = 'text' and body is not null and audio_data is null and audio_mime is null and audio_duration_ms is null)
    or
    (kind = 'audio' and body is null and audio_data is not null and audio_mime is not null and audio_duration_ms between 250 and 10000)
  )
);
create index if not exists online_group_messages_recent_idx
  on public.online_group_messages (group_id, created_at desc);

create table if not exists public.online_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.online_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 16),
  sender_avatar text not null check (char_length(sender_avatar) between 1 and 12),
  kind text not null default 'text' check (kind in ('text', 'audio')),
  body text,
  audio_data text,
  audio_mime text,
  audio_duration_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (
    (kind = 'text' and body is not null and audio_data is null and audio_mime is null and audio_duration_ms is null)
    or
    (kind = 'audio' and body is null and audio_data is not null and audio_mime is not null and audio_duration_ms between 250 and 10000)
  )
);
create index if not exists online_room_messages_recent_idx
  on public.online_room_messages (room_id, created_at desc);

create table if not exists public.online_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('unkind', 'personal-data', 'unsafe-audio', 'impersonation', 'other')),
  context text not null check (context in ('lobby', 'room', 'group')),
  evidence text check (evidence is null or char_length(evidence) <= 220),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.online_blocks enable row level security;
alter table public.online_presence enable row level security;
alter table public.online_lobby_messages enable row level security;
alter table public.online_groups enable row level security;
alter table public.online_group_members enable row level security;
alter table public.online_group_invites enable row level security;
alter table public.online_group_messages enable row level security;
alter table public.online_room_messages enable row level security;
alter table public.online_reports enable row level security;

create or replace function private.online_users_blocked(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.online_blocks block
    where (block.blocker_id = first_user and block.blocked_id = second_user)
       or (block.blocker_id = second_user and block.blocked_id = first_user)
  );
$$;

create or replace function private.online_group_member(target_group uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.online_group_members member
    join public.online_groups online_group on online_group.id = member.group_id
    where member.group_id = target_group
      and member.user_id = target_user
      and online_group.status = 'active'
  );
$$;

create or replace function private.online_group_topic_member(topic_name text, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.online_group_members member
    join public.online_groups online_group on online_group.id = member.group_id
    where topic_name = 'online:group:' || online_group.id::text
      and member.user_id = target_user
      and online_group.status = 'active'
  );
$$;

create or replace function private.clean_online_child_text(raw_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  clean_value text;
  normalized text;
begin
  clean_value := trim(regexp_replace(regexp_replace(coalesce(raw_value, ''), '[[:cntrl:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
  if char_length(clean_value) < 1 or char_length(clean_value) > 180 then
    raise exception 'MESSAGE_LENGTH';
  end if;
  normalized := lower(clean_value);
  if normalized ~ '(https?://|www\.|[[:alnum:]_.+-]+@[[:alnum:].-]+|(^|[^[:digit:]])([[:digit:]][ .()_-]*){7,}([[:digit:]]|$))' then
    raise exception 'MESSAGE_PERSONAL_DATA';
  end if;
  if normalized ~ '(whats[[:space:]]*app|instagram|tiktok|telegram|meu endere[cç]o|minha escola|onde voc[eê] mora|manda foto|n[aã]o conta pra|guarda segredo)' then
    raise exception 'MESSAGE_UNSAFE';
  end if;
  return clean_value;
end;
$$;

create or replace function private.clean_online_nickname(raw_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare clean_value text;
begin
  clean_value := trim(regexp_replace(coalesce(raw_value, ''), '[[:space:]]+', ' ', 'g'));
  if char_length(clean_value) < 2 or char_length(clean_value) > 16
     or clean_value ~ '[^[:alpha:][:space:]-]' then
    raise exception 'INVALID_NICKNAME';
  end if;
  return clean_value;
end;
$$;

create or replace function private.validate_online_audio(audio_value text, mime_value text, duration_value integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if duration_value is null or duration_value < 250 or duration_value > 10000 then
    raise exception 'AUDIO_DURATION';
  end if;
  if mime_value not in ('audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2') then
    raise exception 'AUDIO_FORMAT';
  end if;
  if audio_value is null or char_length(audio_value) > 250000
     or audio_value !~ '^data:audio/(webm|ogg)(;codecs=opus)?;base64,[A-Za-z0-9+/=]+$|^data:audio/mp4(;codecs=mp4a\.40\.2)?;base64,[A-Za-z0-9+/=]+$' then
    raise exception 'AUDIO_SIZE';
  end if;
end;
$$;

revoke all on function private.online_users_blocked(uuid, uuid), private.online_group_member(uuid, uuid),
  private.online_group_topic_member(text, uuid), private.clean_online_child_text(text), private.clean_online_nickname(text),
  private.validate_online_audio(text, text, integer) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.online_users_blocked(uuid, uuid) to authenticated;
grant execute on function private.online_group_member(uuid, uuid) to authenticated;
grant execute on function private.online_group_topic_member(text, uuid) to authenticated;

revoke all on table public.online_blocks, public.online_presence, public.online_lobby_messages, public.online_groups,
  public.online_group_members, public.online_group_invites, public.online_group_messages,
  public.online_room_messages, public.online_reports from anon, authenticated;
grant select on table public.online_blocks, public.online_presence, public.online_lobby_messages, public.online_groups,
  public.online_group_members, public.online_group_invites, public.online_group_messages,
  public.online_room_messages to authenticated;

create policy "blocks read own"
  on public.online_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "presence read recent and unblocked"
  on public.online_presence for select to authenticated
  using (
    updated_at > now() - interval '90 seconds'
    and not private.online_users_blocked((select auth.uid()), online_presence.user_id)
  );

create policy "lobby messages read recent"
  on public.online_lobby_messages for select to authenticated
  using (
    expires_at > now()
    and not private.online_users_blocked((select auth.uid()), sender_id)
  );

create policy "groups read by members"
  on public.online_groups for select to authenticated
  using (private.online_group_member(id, (select auth.uid())));

create policy "group members read by members"
  on public.online_group_members for select to authenticated
  using (private.online_group_member(group_id, (select auth.uid())));

create policy "group invites read participants"
  on public.online_group_invites for select to authenticated
  using ((select auth.uid()) = from_user or (select auth.uid()) = to_user);

create policy "group messages read after joining"
  on public.online_group_messages for select to authenticated
  using (
    expires_at > now()
    and private.online_group_member(group_id, (select auth.uid()))
    and exists (
      select 1 from public.online_group_members member
      where member.group_id = online_group_messages.group_id
        and member.user_id = (select auth.uid())
        and online_group_messages.created_at >= member.joined_at
    )
  );

create policy "room messages read participants"
  on public.online_room_messages for select to authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.online_rooms room
      where room.id = online_room_messages.room_id
        and room.status <> 'cancelled'
        and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
    )
  );

revoke insert, update on table public.online_profiles from authenticated;

create or replace function public.upsert_online_profile(next_display_name text, next_avatar text)
returns public.online_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text;
  profile_row public.online_profiles%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  clean_name := private.clean_online_nickname(next_display_name);
  if next_avatar not in ('⭐', '🕊️', '🐑', '🌈', '🦁', '🐟', '📖', '🌿') then raise exception 'INVALID_AVATAR'; end if;
  insert into public.online_profiles (user_id, display_name, avatar, updated_at)
    values (caller, clean_name, next_avatar, now())
    on conflict (user_id) do update set display_name = excluded.display_name, avatar = excluded.avatar, updated_at = now()
    returning * into profile_row;
  return profile_row;
end;
$$;

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
  if next_game_key is not null and next_game_key not in ('memory', 'tic-tac-toe', 'checkers', 'uno', 'coloring', 'snake', 'simon', 'quiz', 'puzzle', 'pong') then
    raise exception 'INVALID_GAME';
  end if;
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

create or replace function public.clear_online_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.online_presence where user_id = auth.uid();
$$;

create or replace function public.send_online_lobby_message(next_message_index integer)
returns public.online_lobby_messages
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; result public.online_lobby_messages%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if next_message_index < 0 or next_message_index > 3 then raise exception 'INVALID_MESSAGE'; end if;
  if not exists (select 1 from public.online_presence where user_id = caller and updated_at > now() - interval '90 seconds') then raise exception 'PLAYER_OFFLINE'; end if;
  if exists (select 1 from public.online_lobby_messages where sender_id = caller and created_at > now() - interval '2 seconds') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_lobby_messages where expires_at <= now();
  insert into public.online_lobby_messages (sender_id, sender_name, sender_avatar, message_index)
    values (caller, profile.display_name, profile.avatar, next_message_index) returning * into result;
  return result;
end;
$$;

create or replace function public.block_online_player(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  if caller is null or target is null or caller = target then raise exception 'INVALID_PLAYER'; end if;
  insert into public.online_blocks (blocker_id, blocked_id) values (caller, target) on conflict do nothing;
  update public.online_invites set status = 'cancelled'
    where status = 'pending' and ((from_user = caller and to_user = target) or (from_user = target and to_user = caller));
  update public.online_group_invites set status = 'cancelled'
    where status = 'pending' and ((from_user = caller and to_user = target) or (from_user = target and to_user = caller));
  update public.online_rooms set status = 'cancelled', updated_at = now(), version = version + 1
    where status in ('waiting', 'active')
      and ((host_id = caller and guest_id = target) or (host_id = target and guest_id = caller));
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

create or replace function public.unblock_online_player(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.online_blocks where blocker_id = auth.uid() and blocked_id = target;
$$;

create or replace function public.report_online_player(target uuid, report_reason text, report_context text, report_evidence text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); report_id uuid;
begin
  if caller is null or target is null or caller = target then raise exception 'INVALID_PLAYER'; end if;
  if report_reason not in ('unkind', 'personal-data', 'unsafe-audio', 'impersonation', 'other') then raise exception 'INVALID_REASON'; end if;
  if report_context not in ('lobby', 'room', 'group') then raise exception 'INVALID_CONTEXT'; end if;
  if exists (select 1 from public.online_reports where reporter_id = caller and created_at > now() - interval '20 seconds') then
    raise exception 'REPORT_RATE_LIMIT';
  end if;
  insert into public.online_reports (reporter_id, reported_id, reason, context, evidence)
    values (caller, target, report_reason, report_context, left(nullif(trim(report_evidence), ''), 220))
    returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.create_online_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; new_group uuid; clean_name text;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  clean_name := private.clean_online_child_text(group_name);
  if char_length(clean_name) < 2 or char_length(clean_name) > 32 or clean_name ~ '[[:cntrl:]]' then raise exception 'INVALID_GROUP_NAME'; end if;
  if exists (select 1 from public.online_groups where owner_id = caller and status = 'active' group by owner_id having count(*) >= 5) then
    raise exception 'GROUP_LIMIT';
  end if;
  select * into strict profile from public.online_profiles where user_id = caller;
  insert into public.online_groups (owner_id, name) values (caller, clean_name) returning id into new_group;
  insert into public.online_group_members (group_id, user_id, role, display_name, avatar)
    values (new_group, caller, 'owner', profile.display_name, profile.avatar);
  return new_group;
end;
$$;

create or replace function public.invite_online_group(target_group uuid, guest uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; target_profile public.online_profiles%rowtype; current_group public.online_groups%rowtype; invite_id uuid;
begin
  if caller is null or guest is null or caller = guest then raise exception 'INVALID_GUEST'; end if;
  select * into strict current_group from public.online_groups where id = target_group for update;
  if current_group.owner_id <> caller or current_group.status <> 'active' then raise exception 'OWNER_ONLY'; end if;
  if private.online_users_blocked(caller, guest) then raise exception 'PLAYER_BLOCKED'; end if;
  if not exists (select 1 from public.online_presence where user_id = guest and updated_at > now() - interval '90 seconds') then raise exception 'PLAYER_OFFLINE'; end if;
  if exists (select 1 from public.online_group_members where group_id = target_group and user_id = guest) then raise exception 'ALREADY_MEMBER'; end if;
  if (select count(*) from public.online_group_members where group_id = target_group) >= current_group.max_members then raise exception 'GROUP_FULL'; end if;
  update public.online_group_invites set status = 'expired' where status = 'pending' and expires_at <= now();
  if exists (select 1 from public.online_group_invites where from_user = caller and created_at > now() - interval '5 seconds') then raise exception 'INVITE_RATE_LIMIT'; end if;
  select * into strict profile from public.online_profiles where user_id = caller;
  select * into strict target_profile from public.online_profiles where user_id = guest;
  insert into public.online_group_invites (group_id, from_user, to_user, from_name, from_avatar, group_name)
    values (target_group, caller, guest, profile.display_name, profile.avatar, current_group.name)
    returning id into invite_id;
  return invite_id;
end;
$$;

create or replace function public.respond_online_group_invite(invite uuid, accept_invite boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); current_invite public.online_group_invites%rowtype; current_group public.online_groups%rowtype; profile public.online_profiles%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict current_invite from public.online_group_invites where id = invite for update;
  if current_invite.to_user <> caller or current_invite.status <> 'pending' then raise exception 'INVITE_UNAVAILABLE'; end if;
  select * into strict current_group from public.online_groups where id = current_invite.group_id for update;
  if current_invite.expires_at <= now() or current_group.status <> 'active' then
    update public.online_group_invites set status = 'expired' where id = invite;
    return null;
  end if;
  if private.online_users_blocked(current_invite.from_user, caller) then raise exception 'PLAYER_BLOCKED'; end if;
  if accept_invite then
    if (select count(*) from public.online_group_members where group_id = current_group.id) >= current_group.max_members then raise exception 'GROUP_FULL'; end if;
    select * into strict profile from public.online_profiles where user_id = caller;
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

create or replace function public.leave_online_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  if exists (select 1 from public.online_groups where id = target_group and owner_id = caller and status = 'active') then raise exception 'OWNER_MUST_CLOSE'; end if;
  delete from public.online_group_members where group_id = target_group and user_id = caller;
end;
$$;

create or replace function public.close_online_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  update public.online_groups set status = 'closed', updated_at = now() where id = target_group and owner_id = caller and status = 'active';
  if not found then raise exception 'OWNER_ONLY'; end if;
  update public.online_group_invites set status = 'cancelled' where group_id = target_group and status = 'pending';
end;
$$;

create or replace function public.remove_online_group_member(target_group uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  if caller = target then raise exception 'USE_LEAVE_GROUP'; end if;
  if not exists (select 1 from public.online_groups where id = target_group and owner_id = caller and status = 'active') then raise exception 'OWNER_ONLY'; end if;
  delete from public.online_group_members where group_id = target_group and user_id = target and role = 'member';
end;
$$;

create or replace function public.send_online_group_message(target_group uuid, message_text text)
returns public.online_group_messages
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; clean_text text; result public.online_group_messages%rowtype;
begin
  if not private.online_group_member(target_group, caller) then raise exception 'NOT_A_GROUP_MEMBER'; end if;
  if exists (select 1 from public.online_group_messages where sender_id = caller and created_at > now() - interval '2 seconds') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  clean_text := private.clean_online_child_text(message_text);
  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_group_messages where expires_at <= now();
  insert into public.online_group_messages (group_id, sender_id, sender_name, sender_avatar, kind, body)
    values (target_group, caller, profile.display_name, profile.avatar, 'text', clean_text) returning * into result;
  return result;
end;
$$;

create or replace function public.send_online_group_audio(target_group uuid, audio_value text, mime_value text, duration_value integer)
returns public.online_group_messages
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; result public.online_group_messages%rowtype;
begin
  if not private.online_group_member(target_group, caller) then raise exception 'NOT_A_GROUP_MEMBER'; end if;
  if exists (select 1 from public.online_group_messages where sender_id = caller and created_at > now() - interval '5 seconds') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  perform private.validate_online_audio(audio_value, mime_value, duration_value);
  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_group_messages where expires_at <= now();
  insert into public.online_group_messages (group_id, sender_id, sender_name, sender_avatar, kind, audio_data, audio_mime, audio_duration_ms)
    values (target_group, caller, profile.display_name, profile.avatar, 'audio', audio_value, mime_value, duration_value) returning * into result;
  return result;
end;
$$;

create or replace function public.send_online_room_message(target_room uuid, message_text text)
returns public.online_room_messages
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; clean_text text; result public.online_room_messages%rowtype;
begin
  if not exists (select 1 from public.online_rooms where id = target_room and status <> 'cancelled' and caller in (host_id, guest_id)) then raise exception 'NOT_A_PARTICIPANT'; end if;
  if exists (select 1 from public.online_room_messages where sender_id = caller and created_at > now() - interval '2 seconds') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  clean_text := private.clean_online_child_text(message_text);
  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_room_messages where expires_at <= now();
  insert into public.online_room_messages (room_id, sender_id, sender_name, sender_avatar, kind, body)
    values (target_room, caller, profile.display_name, profile.avatar, 'text', clean_text) returning * into result;
  return result;
end;
$$;

create or replace function public.send_online_room_audio(target_room uuid, audio_value text, mime_value text, duration_value integer)
returns public.online_room_messages
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); profile public.online_profiles%rowtype; result public.online_room_messages%rowtype;
begin
  if not exists (select 1 from public.online_rooms where id = target_room and status <> 'cancelled' and caller in (host_id, guest_id)) then raise exception 'NOT_A_PARTICIPANT'; end if;
  if exists (select 1 from public.online_room_messages where sender_id = caller and created_at > now() - interval '5 seconds') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  perform private.validate_online_audio(audio_value, mime_value, duration_value);
  select * into strict profile from public.online_profiles where user_id = caller;
  delete from public.online_room_messages where expires_at <= now();
  insert into public.online_room_messages (room_id, sender_id, sender_name, sender_avatar, kind, audio_data, audio_mime, audio_duration_ms)
    values (target_room, caller, profile.display_name, profile.avatar, 'audio', audio_value, mime_value, duration_value) returning * into result;
  return result;
end;
$$;

revoke all on function public.upsert_online_profile(text, text), public.heartbeat_online_presence(text, text), public.clear_online_presence(), public.send_online_lobby_message(integer),
  public.block_online_player(uuid), public.unblock_online_player(uuid),
  public.report_online_player(uuid, text, text, text), public.create_online_group(text),
  public.invite_online_group(uuid, uuid), public.respond_online_group_invite(uuid, boolean),
  public.leave_online_group(uuid), public.close_online_group(uuid), public.remove_online_group_member(uuid, uuid),
  public.send_online_group_message(uuid, text), public.send_online_group_audio(uuid, text, text, integer),
  public.send_online_room_message(uuid, text), public.send_online_room_audio(uuid, text, text, integer)
  from public, anon;
grant execute on function public.upsert_online_profile(text, text), public.heartbeat_online_presence(text, text), public.clear_online_presence(), public.send_online_lobby_message(integer),
  public.block_online_player(uuid), public.unblock_online_player(uuid),
  public.report_online_player(uuid, text, text, text), public.create_online_group(text),
  public.invite_online_group(uuid, uuid), public.respond_online_group_invite(uuid, boolean),
  public.leave_online_group(uuid), public.close_online_group(uuid), public.remove_online_group_member(uuid, uuid),
  public.send_online_group_message(uuid, text), public.send_online_group_audio(uuid, text, text, integer),
  public.send_online_room_message(uuid, text), public.send_online_room_audio(uuid, text, text, integer)
  to authenticated;

drop policy if exists "online profile read for participants" on public.online_profiles;
create policy "online profile read for trusted participants"
  on public.online_profiles for select to authenticated
  using (
    (select auth.uid()) = online_profiles.user_id
    or exists (
      select 1 from public.online_rooms room
      where room.status <> 'cancelled'
        and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
        and (online_profiles.user_id = room.host_id or online_profiles.user_id = room.guest_id)
    )
    or exists (
      select 1
      from public.online_group_members mine
      join public.online_group_members peer on peer.group_id = mine.group_id
      join public.online_groups online_group on online_group.id = mine.group_id and online_group.status = 'active'
      where mine.user_id = (select auth.uid()) and peer.user_id = online_profiles.user_id
    )
  );

create or replace function public.create_online_invite(guest uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); caller_profile public.online_profiles%rowtype; new_room uuid;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if guest is null or guest = caller then raise exception 'INVALID_GUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, guest::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, guest::text), 0));
  update public.online_invites set status = 'expired' where status = 'pending' and expires_at <= now();
  update public.online_rooms room set status = 'cancelled', updated_at = now(), version = version + 1
    where room.status = 'waiting' and exists (select 1 from public.online_invites invite where invite.room_id = room.id and invite.status = 'expired');
  if not exists (select 1 from public.online_presence where user_id = guest and updated_at > now() - interval '90 seconds') then raise exception 'PLAYER_OFFLINE'; end if;
  if private.online_users_blocked(caller, guest) then raise exception 'PLAYER_BLOCKED'; end if;
  if exists (select 1 from public.online_rooms where status in ('waiting', 'active') and caller in (host_id, guest_id)) then raise exception 'PLAYER_BUSY'; end if;
  if exists (select 1 from public.online_invites where from_user = caller and created_at > now() - interval '8 seconds') then raise exception 'INVITE_RATE_LIMIT'; end if;
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
set search_path = ''
as $$
declare caller uuid := auth.uid(); current_invite public.online_invites%rowtype; current_room public.online_rooms%rowtype;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict current_invite from public.online_invites where id = invite for update;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text, current_invite.from_user::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text, current_invite.from_user::text), 0));
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

revoke all on function public.create_online_invite(uuid), public.respond_online_invite(uuid, boolean) from public, anon;
grant execute on function public.create_online_invite(uuid), public.respond_online_invite(uuid, boolean) to authenticated;

drop policy if exists "online channels receive" on realtime.messages;
create policy "online channels receive"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and (
      exists (
        select 1 from public.online_rooms room
        where realtime.topic() = 'online:room:' || room.id::text
          and room.status <> 'cancelled'
          and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
      )
      or private.online_group_topic_member(realtime.topic(), (select auth.uid()))
    )
  );

drop policy if exists "online channels send" on realtime.messages;
create policy "online channels send"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and (
      exists (
        select 1 from public.online_rooms room
        where realtime.topic() = 'online:room:' || room.id::text
          and room.status <> 'cancelled'
          and ((select auth.uid()) = room.host_id or (select auth.uid()) = room.guest_id)
      )
      or private.online_group_topic_member(realtime.topic(), (select auth.uid()))
    )
  );

do $$ begin
  alter publication supabase_realtime add table public.online_presence;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_lobby_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_group_invites;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_group_members;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_group_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.online_room_messages;
exception when duplicate_object then null;
end $$;
