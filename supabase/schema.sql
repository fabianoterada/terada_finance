-- ============================================================================
-- Terada Finance - Schema Supabase (execute no SQL Editor do Supabase)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Funcao generica para atualizar updated_at
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
-- Tabela: categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#ef4444',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabela: subcategories
-- ---------------------------------------------------------------------------
create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabela: expenses (lancamentos)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description     text not null,
  category_id     uuid references public.categories (id) on delete cascade,
  subcategory_id  uuid references public.subcategories (id) on delete set null,
  expense_type    text not null default 'variavel' check (expense_type in ('fixa', 'variavel')),
  value_type      text not null default 'manual' check (value_type in ('fixo', 'manual')),
  planned_value   numeric(14, 2) not null default 0,
  actual_value    numeric(14, 2) not null default 0,
  status          text not null default 'pendente' check (status in ('pago', 'pendente')),
  reference_month text not null,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
create index if not exists idx_subcategories_category on public.subcategories (category_id);
create index if not exists idx_subcategories_user on public.subcategories (user_id);
create index if not exists idx_expenses_category on public.expenses (category_id);
create index if not exists idx_expenses_user on public.expenses (user_id);
create index if not exists idx_expenses_month on public.expenses (reference_month);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subcategories_updated on public.subcategories;
create trigger trg_subcategories_updated
  before update on public.subcategories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (cada usuario acessa apenas seus proprios dados)
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "categories_owner" on public.categories;
create policy "categories_owner" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subcategories_owner" on public.subcategories;
create policy "subcategories_owner" on public.subcategories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expenses_owner" on public.expenses;
create policy "expenses_owner" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
