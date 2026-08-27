drop policy if exists "group messages read after joining" on public.online_group_messages;
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

revoke all on function public.block_online_player(uuid) from public, anon;
grant execute on function public.block_online_player(uuid) to authenticated;
