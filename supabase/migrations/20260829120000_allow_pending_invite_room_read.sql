-- O destinatário precisa ler o tipo da sala para exibir o convite.
-- Enquanto o convite está pendente, guest_id ainda é nulo; o acesso fica
-- limitado ao usuário indicado na própria linha do convite.
drop policy if exists "room pending invite read" on public.online_rooms;
create policy "room pending invite read"
  on public.online_rooms for select to authenticated
  using (
    (select auth.uid()) = host_id
    or (select auth.uid()) = guest_id
    or exists (
      select 1
      from public.online_invites invite
      where invite.room_id = online_rooms.id
        and invite.to_user = (select auth.uid())
        and invite.status = 'pending'
        and invite.expires_at > now()
    )
  );
