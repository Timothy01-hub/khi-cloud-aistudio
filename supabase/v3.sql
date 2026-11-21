-- KHI Offering System · v3 features: Announcements, Branch budgets, Report Excel/PDF export flag
-- Run ONCE in Supabase > SQL Editor, AFTER v2.sql. Safe to run again.

-- 1. Feature flags in Developer catalog (all default ON)
insert into feature_catalog(key,label,kind,default_enabled,note) values
 ('feature.announcements','Announcements for Members & Secretaries','feature',true,null),
 ('feature.budgets','Branch yearly budgets & variance tracking','feature',true,null),
 ('feature.exports','Excel & PDF report exports','feature',true,null)
on conflict (key) do nothing;

-- 2. Admin privileges for announcements & budgets
alter table staff drop constraint if exists staff_shape;
alter table staff add constraint staff_shape check (
 (role='superadmin' and branch_id is null and slot is null and privileges='{}') or
 (role='admin' and branch_id is not null and slot is null and privileges <@ array['accounts','members','events','programs','attendance','reports','void','audit','assets','expenses','announcements','budgets']) or
 (role='secretary' and branch_id is not null and slot is not null and privileges='{}'));

update staff set privileges = array_append(privileges, 'announcements')
 where role='admin' and array_length(privileges,1) >= 9 and not ('announcements' = any(privileges));
update staff set privileges = array_append(privileges, 'budgets')
 where role='admin' and array_length(privileges,1) >= 9 and not ('budgets' = any(privileges));

-- 3. Announcements (NULL branch_id = all branches; non-null = single branch)
create table if not exists announcements(
 id bigint generated always as identity primary key,
 branch_id bigint references branches(id) on delete cascade,
 title text not null check (length(trim(title)) > 0),
 body text not null check (length(trim(body)) > 0),
 expires_at date,
 created_by text not null,
 created_by_staff_id bigint references staff(id) on delete set null,
 created_by_dev_id bigint,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
create index if not exists announcements_branch_exp on announcements(branch_id, expires_at);

-- 4. Branch yearly budgets per expense category
create table if not exists branch_budgets(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id) on delete cascade,
 budget_year int not null check (budget_year between 2000 and 2100),
 category text not null check (length(trim(category)) > 0),
 amount numeric(12,2) not null check (amount >= 0),
 updated_by text not null,
 updated_at timestamptz not null default now(),
 unique (branch_id, budget_year, category));
create index if not exists branch_budgets_yr_br on branch_budgets(budget_year, branch_id);

create or replace function budget_vs_actual(p_year int, p_scope bigint[] default null)
returns table(branch_id bigint, branch_name text, budget_year int, category text, budgeted numeric, actual_spent numeric, remaining numeric, pct_used numeric, over_90 boolean)
language sql stable security definer set search_path=public as $$
 with spent as (
  select e.branch_id, e.category, coalesce(sum(e.amount), 0)::numeric(12,2) as total
  from expenses e
  where e.status = 'approved' and extract(year from e.expense_date)::int = p_year
  group by e.branch_id, e.category
 )
 select b.branch_id, unit_label(br.name, br.kind), b.budget_year, b.category,
  b.amount::numeric(12,2) as budgeted,
  coalesce(s.total, 0)::numeric(12,2) as actual_spent,
  (b.amount - coalesce(s.total, 0))::numeric(12,2) as remaining,
  case when b.amount > 0 then round((coalesce(s.total, 0) / b.amount) * 100.0, 1)
       when coalesce(s.total, 0) > 0 then 100.0 else 0.0 end::numeric(8,1) as pct_used,
  case when b.amount > 0 then (coalesce(s.total, 0) / b.amount) * 100.0 > 90.0
       else coalesce(s.total, 0) > 0 end as over_90
 from branch_budgets b
 join branches br on br.id = b.branch_id
 left join spent s on s.branch_id = b.branch_id and lower(s.category) = lower(b.category)
 where b.budget_year = p_year and (p_scope is null or b.branch_id = any(p_scope))
 order by br.is_main desc, br.name asc, b.category asc $$;

-- 5. Row Level Security + developer isolation
do $$ declare t text; begin
 for t in select unnest(array['announcements','branch_budgets']) loop
  execute format('alter table %I enable row level security', t);
  execute format('grant select,insert,update,delete on %I to authenticated', t);
  execute format('drop policy if exists dev_all on %I', t);
  execute format('create policy dev_all on %I for all to authenticated using (is_dev()) with check (is_dev())', t);
 end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated;
revoke all on announcements, branch_budgets from public, anon;

revoke execute on function budget_vs_actual(int, bigint[]) from public, anon, authenticated;
grant execute on function budget_vs_actual(int, bigint[]) to service_role, authenticated;
