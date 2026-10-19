-- ============================================================================
-- Terada Finance - Migração: tipo em categorias + view unificada do dashboard
-- ----------------------------------------------------------------------------
-- Script idempotente: pode ser executado mais de uma vez sem erro.
-- Execute no SQL Editor do Supabase ANTES de subir a nova versão do frontend.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) categories: coluna tipo (receita | despesa)
--    Usada pelo CRUD de categorias e para filtrar os <select> de despesa.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists tipo text not null default 'despesa';

alter table public.categories drop constraint if exists categories_tipo_check;
alter table public.categories
  add constraint categories_tipo_check check (tipo in ('receita', 'despesa'));

-- ---------------------------------------------------------------------------
-- 2) View vw_dashboard_gastos_unificados
--    UNION de lancamentos (expenses) + contas a pagar em aberto.
--
--    Regras:
--    - Lancamentos: todos os status ('pago' | 'pendente').
--    - Contas a pagar: apenas 'Pendente'/'Parcial'. Contas 'Pago' NAO entram
--      porque a baixa ja gera um lancamento vinculado (trigger v3), o que
--      evitaria dupla contagem. 'Cancelada' tambem fica de fora.
--    - data_referencia: dos lancamentos deriva do reference_month (dia 01);
--      das contas usa o vencimento (fallback: current_date).
--    - security_invoker = true: as politicas RLS das tabelas base continuam
--      valendo para o usuario que consulta a view.
-- ---------------------------------------------------------------------------
create or replace view public.vw_dashboard_gastos_unificados
with (security_invoker = true) as
select
  e.id,
  e.description::text                                     as descricao,
  coalesce(e.actual_value, e.planned_value, 0)::numeric   as valor,
  to_date(e.reference_month || '-01', 'YYYY-MM-DD')::date as data_referencia,
  e.status::text                                          as status_pagamento,
  'lancamento'::text                                      as origem,
  c.name::text                                            as categoria_nome,
  c.color::text                                           as categoria_cor
from public.expenses e
left join public.categories c on c.id = e.category_id
union all
select
  cap.id,
  cap.descricao::text,
  coalesce(cap.valor, 0)::numeric,
  coalesce(cap.data_vencimento, current_date)::date,
  'pendente'::text,
  'conta_a_pagar'::text,
  c.name::text,
  c.color::text
from public.contas_a_pagar cap
left join public.categories c on c.id = cap.category_id
where cap.status in ('Pendente', 'Parcial');

grant select on public.vw_dashboard_gastos_unificados to authenticated;
