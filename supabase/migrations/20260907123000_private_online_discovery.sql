-- O modo infantil deixa de publicar um diretÃ³rio global de pessoas.
-- Convites passam a depender do cÃ³digo privado (UUID) que o prÃ³prio jogador
-- escolhe compartilhar fora do site com um amigo conhecido.

drop policy if exists "presence read recent and unblocked" on public.online_presence;
create policy "presence read own"
  on public.online_presence for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "lobby messages read recent" on public.online_lobby_messages;
create policy "lobby messages read own"
  on public.online_lobby_messages for select to authenticated
  using ((select auth.uid()) = sender_id and expires_at > now());
