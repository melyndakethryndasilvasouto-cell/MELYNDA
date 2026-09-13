-- Descoberta online segura: retorna somente cartões mínimos para jogadores recentes.
-- A tabela de presença permanece privada; a UI usa esta RPC em vez de SELECT direto.
revoke select on table public.online_presence from authenticated, anon;

create or replace function public.list_online_players()
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  activity text,
  game_key text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, private
stable
as $$
  select p.user_id, left(p.display_name, 16), left(p.avatar, 12), p.activity, p.game_key, p.updated_at
  from public.online_presence p
  where auth.uid() is not null
    and p.updated_at > now() - interval '90 seconds'
    and p.user_id <> auth.uid()
    and not private.online_users_blocked(auth.uid(), p.user_id)
  order by p.display_name asc
  limit 100;
$$;

revoke all on function public.list_online_players() from public, anon;
grant execute on function public.list_online_players() to authenticated;
comment on function public.list_online_players() is 'Lista mínima de jogadores ativos, excluindo o próprio usuário e bloqueios.';
