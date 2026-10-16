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

-- ---------------------------------------------------------------------------
-- Tabela: profiles (dados do usuario: nome, email, ativo/admin)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '',
  is_active  boolean not null default true,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mantem compatibilidade com bancos ja existentes
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists is_admin boolean not null default false;

create index if not exists idx_profiles_active on public.profiles (is_active);

-- Helper: verifica se o usuario logado e admin.
-- SECURITY DEFINER evita recursao infinita nas policies da propria tabela.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Select: o proprio perfil ou qualquer um se for admin
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Insert: apenas o proprio (usado no cadastro)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Update: o proprio perfil ou qualquer um se for admin
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------------
-- Guarda contra escalonamento de privilegio:
-- usuarios comuns nao podem alterar is_admin e so mudam o proprio is_active.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_admin() then
    new.is_admin = old.is_admin;
    if old.id <> auth.uid() then
      new.is_active = old.is_active;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Cria o profile automaticamente no cadastro.
-- O primeiro usuario cadastrado vira admin.
-- Le email, full_name e is_active.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_active, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'is_active')::boolean, true),
    (select count(*) = 0 from public.profiles)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: cria/atualiza profiles de usuarios existentes
insert into public.profiles (id, email, full_name, is_active)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data->>'full_name', ''), true
from auth.users u
on conflict (id) do nothing;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- Garante que exista ao menos um admin (o usuario mais antigo)
update public.profiles set is_admin = true
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where is_admin);

-- ---------------------------------------------------------------------------
-- Criacao interna de usuarios (usada pela tela "Gerenciar Usuarios").
-- O cadastro publico foi removido; apenas admin autenticado (ou contexto de
-- servico, sem usuario) pode criar contas.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_user(
  p_email      text,
  p_password   text,
  p_full_name  text default '',
  p_is_active  boolean default true,
  p_is_admin   boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  -- autorizacao: quando chamado por um usuario logado, exige admin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem criar usuarios.'
      using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Informe um e-mail valido.' using errcode = '22023';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha deve ter ao menos 6 caracteres.' using errcode = '22023';
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Este e-mail ja esta cadastrado.' using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', coalesce(p_full_name, ''), 'is_active', coalesce(p_is_active, true)),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  update public.profiles
  set full_name = coalesce(p_full_name, ''),
      is_active  = coalesce(p_is_active, true),
      is_admin   = coalesce(p_is_admin, false) or is_admin
  where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, boolean) from public;
grant execute on function public.admin_create_user(text, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: usuario administrador inicial (altere a senha depois de entrar).
-- E-mail: admin@sistema.com / Senha: admin123
-- ---------------------------------------------------------------------------
select public.admin_create_user('admin@sistema.com', 'admin123', 'Administrador', true, true)
where not exists (select 1 from auth.users where email = 'admin@sistema.com');
