-- Super Admin layer: units (centre / branch / fellowship), admins with privileges, Leaders, assets, church profile & features.
-- Run ONCE in Supabase > SQL Editor, AFTER schema, auth, birthdays, departments and staff.sql.

-- 1. Units: centre / branch / fellowship, each optionally sitting under another unit
alter table branches add column if not exists kind text not null default 'fellowship';
alter table branches drop constraint if exists branches_kind_check;
alter table branches add constraint branches_kind_check check (kind in ('center','branch','fellowship'));
alter table branches add column if not exists parent_id bigint references branches(id);
drop index if exists one_main_church;
update branches set kind='center' where is_main;
update branches set parent_id=(select id from branches where is_main limit 1) where not is_main and parent_id is null;

-- the label follows the name and kind: "Lusaka" + centre -> "Lusaka Centre" (KHI CITY CENTRE is left as it is)
create or replace function unit_label(n text,k text) returns text language sql immutable as $$
 select case when upper(n) like '%'||upper(case k when 'center' then 'centre' when 'branch' then 'branch' else 'fellowship' end)
          or (k='center' and upper(n) like '%CENTER') then n
        else n||' '||case k when 'center' then 'Centre' when 'branch' then 'Branch' else 'Fellowship' end end $$;

-- a unit plus everything under it (used to limit an admin to their own branch and the fellowships beneath it)
create or replace function unit_scope(p_unit bigint) returns bigint[] language sql stable as $$
 with recursive t as (select id from branches where id=p_unit union all select b.id from branches b join t on b.parent_id=t.id)
 select array_agg(id) from t $$;

create or replace function unit_parent_guard() returns trigger language plpgsql as $$
begin
 if new.parent_id is not null and new.parent_id = any(coalesce(unit_scope(new.id),'{}')) then raise exception 'A unit cannot sit under itself or under one of its own fellowships'; end if;
 return new;
end $$;
drop trigger if exists unit_parent_guard on branches;
create trigger unit_parent_guard before update on branches for each row execute function unit_parent_guard();

-- 2. Staff: Super Admin (all powers) > Admin (one unit + below, chosen privileges only) > Secretary
alter table staff drop constraint if exists staff_role_check;
alter table staff drop constraint if exists staff_check;
alter table staff add column if not exists privileges text[] not null default '{}';
-- the Super Admin accounts that existed so far become church admins
update staff set role='admin',branch_id=(select id from branches where is_main limit 1),
  privileges=array['accounts','members','events','programs','attendance','reports','void','audit','assets'] where role='superadmin';
alter table staff add constraint staff_role_check check (role in ('superadmin','admin','secretary'));
-- BLOCKED privileges (units, admins, leaders, features, profile) can never be held by an admin: the database refuses them
alter table staff add constraint staff_shape check (
 (role='superadmin' and branch_id is null and slot is null and privileges='{}') or
 (role='admin' and branch_id is not null and slot is null and privileges <@ array['accounts','members','events','programs','attendance','reports','void','audit','assets']) or
 (role='secretary' and branch_id is not null and slot is not null and privileges='{}'));

drop function if exists create_staff(text,bigint,text,text,text,text);
create function create_staff(p_role text,p_branch bigint,p_slot text,p_name text,p_username text,p_password text,p_privileges text[] default '{}') returns bigint language plpgsql as $$
declare sid bigint;
begin
 if length(p_password)<8 then raise exception 'Password must be 8+ characters'; end if;
 insert into staff(role,branch_id,slot,full_name,username,password_hash,privileges)
  values (p_role,p_branch,p_slot,trim(p_name),trim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),coalesce(p_privileges,'{}')) returning id into sid;
 insert into audit_log(actor,action,detail) values ('system','staff_created',p_role||' '||trim(p_username));
 return sid;
end $$;

create function staff_set_password(p_id bigint,p_password text) returns void language plpgsql as $$
begin
 if length(p_password)<8 then raise exception 'Password must be 8+ characters'; end if;
 update staff set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf')) where id=p_id;
end $$;

create function member_reset_password(p_id bigint) returns text language plpgsql as $$
declare t text:=substr(encode(extensions.gen_random_bytes(6),'hex'),1,8);
begin
 update members set password_hash=extensions.crypt(t,extensions.gen_salt('bf')),must_change=true where id=p_id;
 return t;
end $$;

-- 3. LEADER: only the Super Admin can make or remove one. The database itself refuses any other route.
alter table people drop constraint if exists people_kind_check;
alter table people add constraint people_kind_check check (kind in ('member','visitor','leader'));
alter table people add column if not exists leader_since date;
create or replace function leader_guard() returns trigger language plpgsql as $$
begin
 if coalesce(current_setting('khi.allow_leader',true),'')<>'on' then
  if tg_op='INSERT' and new.kind='leader' then raise exception 'Only the Super Admin can make someone a Leader'; end if;
  if tg_op='UPDATE' and (new.kind='leader') is distinct from (old.kind='leader') then raise exception 'Only the Super Admin can change a Leader status'; end if;
 end if;
 return new;
end $$;
drop trigger if exists leader_guard on people;
create trigger leader_guard before insert or update on people for each row execute function leader_guard();

create function set_leader(p_person bigint,p_make boolean,p_by text) returns text language plpgsql as $$
declare pe record;
begin
 select * into pe from people where id=p_person for update;
 if not found then return 'Person not found.'; end if;
 perform set_config('khi.allow_leader','on',true);
 if p_make then update people set kind='leader',leader_since=current_date where id=p_person;
 else update people set kind='member',leader_since=null where id=p_person; end if;
 insert into audit_log(actor,action,detail) values (p_by,case when p_make then 'make_leader' else 'remove_leader' end,pe.full_name||' (#'||p_person||')');
 return case when p_make then pe.full_name||' is now a Leader.' else pe.full_name||' is no longer a Leader.' end;
end $$;

-- 4. Church profile (vision, mission...) and switchable features
create table if not exists settings(key text primary key,value jsonb not null);
insert into settings(key,value) values
 ('features','{"assets":false}'),
 ('profile','{"vision":"To reach all nations for Christ","mission":"Raising true Christians who will impact nations with God''s kingdom.","founded":2015,"email":"kingdomheralds.info@gmail.com"}')
on conflict (key) do nothing;

-- 5. Church assets (a simple register; the feature is switched on or off by the Super Admin)
create table if not exists assets(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 name text not null, category text,
 quantity int not null default 1 check (quantity>0),
 value numeric(12,2) check (value>=0),
 condition text not null default 'Good' check (condition in ('New','Good','Fair','Poor','Needs repair')),
 acquired_on date, notes text, created_by text,
 created_at timestamptz not null default now());
create index if not exists assets_branch on assets(branch_id);

alter table settings enable row level security;
alter table assets enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
