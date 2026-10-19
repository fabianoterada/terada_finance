-- ============================================================================
-- Terada Finance - Setup do modulo Contas a Pagar (execute no SQL Editor)
-- ----------------------------------------------------------------------------
-- Script idempotente: pode ser executado mais de uma vez sem erro.
-- Cria a tabela contas_a_pagar, o bucket privado de comprovantes e as
-- politicas de Row Level Security (cada usuario acessa apenas seus dados).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Funcao generica para atualizar updated_at (reutiliza a do schema principal)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabela: contas_a_pagar
-- ---------------------------------------------------------------------------
create table if not exists public.contas_a_pagar (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  descricao         text not null default '',
  valor             numeric(14, 2) not null default 0,
  data_vencimento   date,
  data_pagamento    date,
  status            text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelada')),
  metodo_pagamento  text check (metodo_pagamento in ('pix', 'boleto', 'dinheiro', 'cartao', 'transferencia')),
  codigo_barras     text,
  chave_pix         text,
  tipo_chave_pix    text,
  documento_url     text,
  observacoes       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Compatibilidade com bancos onde a tabela ja exista sem as colunas novas
alter table public.contas_a_pagar add column if not exists metodo_pagamento text;
alter table public.contas_a_pagar add column if not exists codigo_barras text;
alter table public.contas_a_pagar add column if not exists chave_pix text;
alter table public.contas_a_pagar add column if not exists tipo_chave_pix text;
alter table public.contas_a_pagar add column if not exists documento_url text;

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
create index if not exists idx_contas_a_pagar_user on public.contas_a_pagar (user_id);
create index if not exists idx_contas_a_pagar_vencimento on public.contas_a_pagar (data_vencimento);
create index if not exists idx_contas_a_pagar_status on public.contas_a_pagar (status);

-- ---------------------------------------------------------------------------
-- Trigger de updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists trg_contas_a_pagar_updated on public.contas_a_pagar;
create trigger trg_contas_a_pagar_updated
  before update on public.contas_a_pagar
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.contas_a_pagar enable row level security;

drop policy if exists "contas_a_pagar_owner" on public.contas_a_pagar;
create policy "contas_a_pagar_owner" on public.contas_a_pagar
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para boletos e comprovantes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes_contas', 'comprovantes_contas', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- No Supabase hospedado o RLS ja vem habilitado em storage.objects e o
-- ALTER exige ownership (falharia com 42501 no SQL Editor). Por isso a
-- operacao e tolerada: se nao houver permissao, apenas avisa e segue.
do $$
begin
  execute 'alter table storage.objects enable row level security';
exception
  when insufficient_privilege then
    raise notice 'storage.objects: RLS ja habilitado (sem permissao de owner — ignorado).';
end $$;

do $$
begin
  execute 'drop policy if exists "comprovantes_contas_insert" on storage.objects';
  execute $p$create policy "comprovantes_contas_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'comprovantes_contas' and auth.uid() = owner)$p$;
exception
  when insufficient_privilege then
    raise notice 'Falha ao criar policy "comprovantes_contas_insert" (sem permissao em storage.objects).';
end $$;

do $$
begin
  execute 'drop policy if exists "comprovantes_contas_select" on storage.objects';
  execute $p$create policy "comprovantes_contas_select" on storage.objects
    for select to authenticated
    using (bucket_id = 'comprovantes_contas' and auth.uid() = owner)$p$;
exception
  when insufficient_privilege then
    raise notice 'Falha ao criar policy "comprovantes_contas_select" (sem permissao em storage.objects).';
end $$;

do $$
begin
  execute 'drop policy if exists "comprovantes_contas_delete" on storage.objects';
  execute $p$create policy "comprovantes_contas_delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'comprovantes_contas' and auth.uid() = owner)$p$;
exception
  when insufficient_privilege then
    raise notice 'Falha ao criar policy "comprovantes_contas_delete" (sem permissao em storage.objects).';
end $$;

-- ============================================================================
-- v2 - Integracao com Lancamentos, categorias, anexos e status cancelada
-- ============================================================================

-- Categoria e subcategoria com a MESMA tipagem de public.expenses
alter table public.contas_a_pagar
  add column if not exists category_id uuid references public.categories (id) on delete cascade;
alter table public.contas_a_pagar
  add column if not exists subcategory_id uuid references public.subcategories (id) on delete set null;

-- Substitui o constraint antigo (pendente/pago) e libera "cancelada"
alter table public.contas_a_pagar drop constraint if exists contas_a_pagar_status_check;
alter table public.contas_a_pagar
  add constraint contas_a_pagar_status_check
  check (status in ('pendente', 'pago', 'cancelada'));

-- Referencia ao lancamento espelho gerado (evita duplicidade ao alternar status)
alter table public.contas_a_pagar
  add column if not exists lancamento_gerado_id uuid references public.expenses (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tabela: contas_anexos (comprovantes enviados para o Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.contas_anexos (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references public.contas_a_pagar (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  arquivo_path text not null,
  nome         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists idx_contas_anexos_conta on public.contas_anexos (conta_id);

alter table public.contas_anexos enable row level security;

-- ---------------------------------------------------------------------------
-- Trigger: conta marcada como "pago" gera lancamento espelho em expenses;
-- ao sair de "pago", o lancamento espelho e removido. SECURITY DEFINER para
-- gravar em expenses sem depender das policies do usuario final.
-- ---------------------------------------------------------------------------
create or replace function public.sync_contas_a_pagar_lancamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lancamento_id uuid;
  v_mes           text;
begin
  -- Virou "pago" (insert ja pago ou transicao para pago): cria o espelho.
  if new.status = 'pago' and (tg_op = 'INSERT' or old.status is distinct from 'pago') then
    if new.lancamento_gerado_id is null then
      v_mes := to_char(coalesce(new.data_pagamento, new.data_vencimento, now()), 'YYYY-MM');
      insert into public.expenses (
        user_id, description, category_id, subcategory_id,
        expense_type, value_type, planned_value, actual_value,
        status, reference_month, notes
      ) values (
        new.user_id, new.descricao, new.category_id, new.subcategory_id,
        'variavel', 'manual', new.valor, new.valor,
        'pago', v_mes, coalesce(new.observacoes, '')
      ) returning id into v_lancamento_id;
      new.lancamento_gerado_id := v_lancamento_id;
    end if;
  end if;

  -- Saiu de "pago": remove o lancamento espelho correspondente.
  if tg_op = 'UPDATE' and old.status = 'pago' and new.status is distinct from 'pago' then
    if new.lancamento_gerado_id is not null then
      delete from public.expenses where id = new.lancamento_gerado_id;
      new.lancamento_gerado_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contas_a_pagar_sync_lancamento on public.contas_a_pagar;
create trigger trg_contas_a_pagar_sync_lancamento
  before insert or update on public.contas_a_pagar
  for each row execute function public.sync_contas_a_pagar_lancamento();

revoke all on function public.sync_contas_a_pagar_lancamento() from public;
revoke all on function public.sync_contas_a_pagar_lancamento() from anon;
revoke all on function public.sync_contas_a_pagar_lancamento() from authenticated;

-- ============================================================================
-- v3 - Baixa por lancamentos vinculados (conta_origem_id), status capitalizado,
--      anexos com metadados e trigger de pagamentos parciais.
--
--   - "Lancamentos" = public.expenses. Cada pagamento de uma conta e um lancamento
--     com conta_origem_id; o trigger recalcula valor_pago/status/data_pagamento.
--   - Remove o lancamento espelho da v2 (duplicaria despesas no novo modelo).
--   - Status de contas_a_pagar: 'Pendente' | 'Parcial' | 'Pago' (+ 'Cancelada',
--     preservada para nao perder dados e a acao de cancelar ja existente).
--   - Script idempotente: re-executar nao altera dados ja migrados.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Remove o espelho da v2 ANTES de mexer em qualquer status
--    (senao o backfill abaixo duplicaria despesas pagas)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_contas_a_pagar_sync_lancamento on public.contas_a_pagar;
drop function if exists public.sync_contas_a_pagar_lancamento();

-- ---------------------------------------------------------------------------
-- 2) Lancamentos (public.expenses) passam a apontar para a conta de origem
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column if not exists conta_origem_id uuid references public.contas_a_pagar (id) on delete cascade;

create index if not exists idx_expenses_conta_origem
  on public.expenses (conta_origem_id)
  where conta_origem_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Migra os espelhos ja gerados (v2) para conta_origem_id e remove a coluna
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'contas_a_pagar'
       and column_name = 'lancamento_gerado_id'
  ) then
    execute $q$
      update public.expenses e
         set conta_origem_id = c.id
        from public.contas_a_pagar c
       where c.lancamento_gerado_id = e.id
         and e.conta_origem_id is null
    $q$;
  end if;
end $$;

alter table public.contas_a_pagar drop column if exists lancamento_gerado_id;

-- ---------------------------------------------------------------------------
-- 4) Colunas novas em contas_a_pagar: snapshot textual + valor ja quitado
-- ---------------------------------------------------------------------------
alter table public.contas_a_pagar add column if not exists categoria text;
alter table public.contas_a_pagar add column if not exists subcategoria text;
alter table public.contas_a_pagar add column if not exists valor_pago numeric(10, 2) not null default 0;

update public.contas_a_pagar c
   set categoria = (select cat.name from public.categories cat where cat.id = c.category_id),
       subcategoria = (select sub.name from public.subcategories sub where sub.id = c.subcategory_id)
 where c.categoria is null
   and c.category_id is not null;

-- ---------------------------------------------------------------------------
-- 5) Status capitalizado (migra dados em minusculas e troca o constraint)
-- ---------------------------------------------------------------------------
alter table public.contas_a_pagar drop constraint if exists contas_a_pagar_status_check;

update public.contas_a_pagar
   set status = case status
         when 'pendente' then 'Pendente'
         when 'pago' then 'Pago'
         when 'cancelada' then 'Cancelada'
         else status
       end;

alter table public.contas_a_pagar alter column status set default 'Pendente';

alter table public.contas_a_pagar
  add constraint contas_a_pagar_status_check
  check (status in ('Pendente', 'Parcial', 'Pago', 'Cancelada'));

-- ---------------------------------------------------------------------------
-- 6) Contas 'Pago' ainda sem lancamento vinculado recebem baixa sintetica
--    (mantem valor_pago = soma dos lancamentos, regra do trigger)
-- ---------------------------------------------------------------------------
insert into public.expenses (
  user_id, description, category_id, subcategory_id,
  expense_type, value_type, planned_value, actual_value,
  status, reference_month, notes, conta_origem_id
)
select c.user_id,
       c.descricao,
       c.category_id,
       c.subcategory_id,
       'variavel',
       'manual',
       c.valor,
       c.valor,
       'pago',
       to_char(coalesce(c.data_pagamento, c.data_vencimento, now()), 'YYYY-MM'),
       'Baixa migrada automaticamente (v3)',
       c.id
  from public.contas_a_pagar c
 where c.status = 'Pago'
   and not exists (
     select 1 from public.expenses e where e.conta_origem_id = c.id
   );

-- ---------------------------------------------------------------------------
-- 7) Recalcula valor_pago, status e data_pagamento de todas as contas
--    (fonte da verdade = soma de actual_value dos lancamentos vinculados)
-- ---------------------------------------------------------------------------
do $$
declare
  v_conta record;
  v_pago  numeric;
begin
  for v_conta in select * from public.contas_a_pagar loop
    select coalesce(sum(e.actual_value), 0)
      into v_pago
      from public.expenses e
     where e.conta_origem_id = v_conta.id;

    update public.contas_a_pagar
       set valor_pago = v_pago,
           status = case
             when v_conta.status = 'Cancelada' and v_pago < v_conta.valor then 'Cancelada'
             when v_conta.valor > 0 and v_pago >= v_conta.valor then 'Pago'
             when v_pago > 0 then 'Parcial'
             else 'Pendente'
           end,
           data_pagamento = case
             when v_conta.valor > 0 and v_pago >= v_conta.valor
               then coalesce(v_conta.data_pagamento, current_date)
             else null
           end
     where id = v_conta.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8) contas_anexos no formato v3 (metadados do arquivo enviado)
-- ---------------------------------------------------------------------------
create table if not exists public.contas_anexos (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null references public.contas_a_pagar (id) on delete cascade,
  nome_arquivo  text not null default '',
  tipo_conteudo text not null default 'application/octet-stream',
  tamanho_bytes bigint,
  storage_path  text not null unique,
  criado_em     timestamptz not null default now()
);

alter table public.contas_anexos add column if not exists nome_arquivo text not null default '';
alter table public.contas_anexos add column if not exists tipo_conteudo text not null default 'application/octet-stream';
alter table public.contas_anexos add column if not exists tamanho_bytes bigint;
alter table public.contas_anexos add column if not exists storage_path text;
alter table public.contas_anexos add column if not exists criado_em timestamptz not null default now();

-- Backfill do formato antigo (arquivo_path/nome/created_at) quando existir
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'contas_anexos'
       and column_name = 'arquivo_path'
  ) then
    execute $q$
      update public.contas_anexos
         set storage_path = arquivo_path,
             nome_arquivo = coalesce(nome, ''),
             criado_em = created_at,
             tipo_conteudo = case
               when arquivo_path ilike '%.pdf' then 'application/pdf'
               when arquivo_path ilike '%.png' then 'image/png'
               when arquivo_path ilike '%.jpg' or arquivo_path ilike '%.jpeg' then 'image/jpeg'
               else 'application/octet-stream'
             end
       where storage_path is null
    $q$;
  end if;
end $$;

-- Remove possiveis caminhos duplicados antes da restricao UNIQUE
delete from public.contas_anexos a
 using public.contas_anexos b
 where a.storage_path = b.storage_path
   and a.ctid < b.ctid;

alter table public.contas_anexos alter column storage_path set not null;

create unique index if not exists contas_anexos_storage_path_key
  on public.contas_anexos (storage_path);
create index if not exists idx_contas_anexos_conta
  on public.contas_anexos (conta_id);

-- ---------------------------------------------------------------------------
-- 9) RLS dos anexos: acesso apenas as contas do proprio usuario
--    (o formato v3 nao tem user_id; o dono e verificado via contas_a_pagar)
-- ---------------------------------------------------------------------------
alter table public.contas_anexos enable row level security;

drop policy if exists "contas_anexos_owner" on public.contas_anexos;
drop policy if exists "contas_anexos_conta_owner" on public.contas_anexos;

create policy "contas_anexos_conta_owner" on public.contas_anexos
  for all
  using (exists (
    select 1 from public.contas_a_pagar c
     where c.id = conta_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.contas_a_pagar c
     where c.id = conta_id and c.user_id = auth.uid()
  ));

alter table public.contas_anexos drop column if exists arquivo_path;
alter table public.contas_anexos drop column if exists nome;
alter table public.contas_anexos drop column if exists created_at;
alter table public.contas_anexos drop column if exists user_id;

-- ---------------------------------------------------------------------------
-- 10) Trigger: a cada lancamento vinculado (insert/update/delete) recalcula
--     valor_pago/status/data_pagamento da conta. O frontend NUNCA altera status.
--     SECURITY DEFINER: a soma precisa ver todos os lancamentos da conta e a
--     atualizacao da conta e limitada ao dono (auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.trg_fn_atualiza_conta_parcial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids   uuid[] := array[]::uuid[];
  v_id    uuid;
  v_valor numeric;
  v_status text;
  v_pago  numeric;
begin
  -- Coleta as contas afetadas (old e new cobrem mudanca de conta_origem_id).
  -- Blocos IF explicitos: em INSERT, a variavel OLD nao esta disponivel.
  if tg_op = 'INSERT' then
    if new.conta_origem_id is not null then
      v_ids := v_ids || new.conta_origem_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.conta_origem_id is not null then
      v_ids := v_ids || new.conta_origem_id;
    end if;
    if old.conta_origem_id is not null then
      v_ids := v_ids || old.conta_origem_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.conta_origem_id is not null then
      v_ids := v_ids || old.conta_origem_id;
    end if;
  end if;

  foreach v_id in array v_ids loop
    -- Apenas contas do usuario autenticado (ou migracao via SQL sem sessao)
    select c.valor, c.status
      into v_valor, v_status
      from public.contas_a_pagar c
     where c.id = v_id
       and (auth.uid() is null or c.user_id = auth.uid());

    if not found then
      continue;
    end if;

    select coalesce(sum(e.actual_value), 0)
      into v_pago
      from public.expenses e
     where e.conta_origem_id = v_id;

    update public.contas_a_pagar
       set valor_pago = v_pago,
           status = case
             when v_status = 'Cancelada' and v_pago < v_valor then 'Cancelada'
             when v_valor > 0 and v_pago >= v_valor then 'Pago'
             when v_pago > 0 then 'Parcial'
             else 'Pendente'
           end,
           data_pagamento = case
             when v_valor > 0 and v_pago >= v_valor
               then coalesce(data_pagamento, current_date)
             else null
           end
     where id = v_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_fn_atualiza_conta_parcial on public.expenses;
create trigger trg_fn_atualiza_conta_parcial
  after insert or update or delete on public.expenses
  for each row execute function public.trg_fn_atualiza_conta_parcial();

revoke all on function public.trg_fn_atualiza_conta_parcial() from public;
revoke all on function public.trg_fn_atualiza_conta_parcial() from anon;
revoke all on function public.trg_fn_atualiza_conta_parcial() from authenticated;
