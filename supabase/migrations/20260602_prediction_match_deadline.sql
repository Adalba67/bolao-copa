drop policy if exists "public_insert_palpites_before_deadline" on public.palpites;
drop policy if exists "public_update_palpites_before_deadline" on public.palpites;

revoke delete on public.palpites from anon, authenticated;

create policy "public_insert_palpites_before_deadline"
on public.palpites
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.jogos j
    where j.id_jogo = palpites.id_jogo
      and (now() at time zone 'America/Sao_Paulo') < j.data_hora
  )
  and exists (
    select 1
    from public.participantes p
    where p.company_id = palpites.company_id
      and p.id_participante = palpites.id_participante
      and p.ativo = true
      and p.access_blocked = false
  )
);

create policy "public_update_palpites_before_deadline"
on public.palpites
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.jogos j
    where j.id_jogo = palpites.id_jogo
      and (now() at time zone 'America/Sao_Paulo') < j.data_hora
  )
  and exists (
    select 1
    from public.participantes p
    where p.company_id = palpites.company_id
      and p.id_participante = palpites.id_participante
      and p.ativo = true
      and p.access_blocked = false
  )
)
with check (
  exists (
    select 1
    from public.jogos j
    where j.id_jogo = palpites.id_jogo
      and (now() at time zone 'America/Sao_Paulo') < j.data_hora
  )
  and exists (
    select 1
    from public.participantes p
    where p.company_id = palpites.company_id
      and p.id_participante = palpites.id_participante
      and p.ativo = true
      and p.access_blocked = false
  )
);
