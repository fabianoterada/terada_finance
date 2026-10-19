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
create index if not exists idx_contas_anexos_user on public.contas_anexos (user_id);

alter table public.contas_anexos enable row level security;

drop policy if exists "contas_anexos_owner" on public.contas_anexos;
create policy "contas_anexos_owner" on public.contas_anexos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
