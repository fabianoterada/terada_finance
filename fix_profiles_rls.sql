-- ============================================================================
-- Terada Finance - Correcao/diagnostico de bloqueio de edicao de usuarios
-- ----------------------------------------------------------------------------
-- NAO e executado automaticamente pela aplicacao. Rode manualmente no SQL
-- Editor do Supabase, primeiro a secao de diagnostico e depois a correcao.
-- Script idempotente (pode ser reexecutado sem erro).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) DIAGNOSTICO (somente leitura) - execute e confira o resultado
-- ---------------------------------------------------------------------------
-- 1.1) Politicas atuais da tabela profiles.
--      A edicao de OUTRO usuario exige uma policy de UPDATE cujo USING e
--      WITH CHECK aceitem administradores (public.is_admin()).
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'profiles';

-- 1.2) Administradores cadastrados (o usuario logado precisa aparecer aqui).
select id, email, full_name, is_active, is_admin
  from public.profiles
 where is_admin = true;

-- 1.3) A funcao helper precisa existir (e usada pelas policies/trigger).
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'is_admin';

-- 1.4) BUG 1 - contas a pagar: confira a grafia dos status e as colunas que
--      o frontend consulta. Se houver status em minusculas ('pendente'),
--      a query do FinanceContext (.in('status', ['Pendente', 'Parcial']))
--      nao retorna nada e os relatorios ficam sem as contas.
select status, count(*) as total
  from public.contas_a_pagar
 group by status
 order by status;

select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'contas_a_pagar'
   and column_name in ('category_id', 'subcategory_id', 'valor_pago', 'data_vencimento');

-- ---------------------------------------------------------------------------
-- 2) CORRECAO - RLS de profiles para permitir ao admin editar qualquer usuario
-- ---------------------------------------------------------------------------
-- 2.1) Helper usado nas policies (SECURITY DEFINER evita recursao na RLS).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- 2.2) Garante os privilegios da role authenticated na tabela.
grant select, insert, update, delete on public.profiles to authenticated;

-- 2.3) Remove a policy antiga (permitia apenas o proprio perfil) e garante a
--      policy que tambem libera administradores.
alter table public.profiles enable row level security;

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_update" on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- 2.4) Trigger de protecao: mantem a regra de que somente admins podem alterar
--      is_admin/is_active de terceiros (nao bloqueia o admin).
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

-- 2.5) Confirmacao: deve exibir a policy "profiles_update" com o USING/WITH
--      CHECK contendo public.is_admin().
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'profiles'
 order by policyname;

-- 2.6) Teste rapido (substitua o e-mail): deve retornar 1 linha alterada.
-- update public.profiles
--    set full_name = full_name
--  where email = 'usuario@exemplo.com'
--  returning id, email, full_name, is_active, is_admin;

-- ---------------------------------------------------------------------------
-- 3) OPCIONAL - BUG 1: normalizar status de contas_a_pagar em minusculas
-- ---------------------------------------------------------------------------
-- SO execute se o diagnostico 1.4 mostrar 'pendente'/'parcial' em minusculas
-- E se o schema v3 ainda nao tiver sido aplicado. Caso contrario, ignore.
--
-- alter table public.contas_a_pagar drop constraint if exists contas_a_pagar_status_check;
-- update public.contas_a_pagar
--    set status = case status
--          when 'pendente' then 'Pendente'
--          when 'parcial'  then 'Parcial'
--          when 'pago'     then 'Pago'
--          when 'cancelada' then 'Cancelada'
--          else status
--        end;
-- alter table public.contas_a_pagar alter column status set default 'Pendente';
-- alter table public.contas_a_pagar
--   add constraint contas_a_pagar_status_check
--   check (status in ('Pendente', 'Parcial', 'Pago', 'Cancelada'));
