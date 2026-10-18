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
  status            text not null default 'pendente' check (status in ('pendente', 'pago')),
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
