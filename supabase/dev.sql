-- Hidden Developer role, feature flags, branding text and the Super Admin name.
-- Run ONCE in Supabase > SQL Editor, AFTER hierarchy.sql. Safe to run again.

-- 1. Branding: a church unit + the centre above it ("NIPA FELLOWSHIP · KHI CITY CENTRE")
create or replace function unit_brand(p_unit bigint) returns jsonb language sql stable as $$
 with recursive up as (select id,name,kind,parent_id,0 as d from branches where id=p_unit
   union all select b.id,b.name,b.kind,b.parent_id,up.d+1 from branches b join up on b.id=up.parent_id)
 select jsonb_build_object('branch',(select unit_label(name,kind) from up where d=0),
  'centre',(select unit_label(name,kind) from up where kind='center' and d>0 order by d limit 1)) $$;

-- 2. Who is the Developer? Only a signed token from the server carries khi_role=developer; RLS policies below check it.
create or replace function is_dev() returns boolean language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'khi_role','')='developer' $$;

-- 3. Developer accounts live in their OWN table, so they never appear in staff lists
create table if not exists dev_accounts(id bigint generated always as identity primary key,username text not null unique,full_name text not null,password_hash text not null,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists dev_audit(id bigint generated always as identity primary key,dev_id bigint,action text not null,detail text,ip text,created_at timestamptz not null default now());

-- 4. Feature catalog + flags (global, or per church/branch/centre; the nearest unit wins, then global, then the default)
create table if not exists feature_catalog(key text primary key,label text not null,kind text not null check (kind in ('app','menu','feature','stub')),default_enabled boolean not null default true,note text);
create table if not exists feature_flags(id bigint generated always as identity primary key,key text not null references feature_catalog(key) on delete cascade,unit_id bigint references branches(id) on delete cascade,enabled boolean not null);
create unique index if not exists feature_flags_one on feature_flags(key,coalesce(unit_id,0));
insert into feature_catalog(key,label,kind,default_enabled,note) values
 ('app.member','Member app','app',true,null),('app.secretary','Secretary app','app',true,null),('app.admin','Admin app','app',true,null),('app.superadmin','Super Admin app','app',true,null),
 ('member.menu.events','Member menu: Events','menu',true,null),('member.menu.pledges','Member menu: Pledges','menu',true,null),('member.menu.alerts','Member menu: Alerts','menu',true,null),('member.menu.account','Member menu: Account','menu',true,null),('member.menu.about','Member menu: About us','menu',true,null),
 ('secretary.menu.attendance','Secretary menu: Attendance','menu',true,null),('secretary.menu.reports','Secretary menu: Reports','menu',true,null),
 ('admin.menu.accounts','Admin menu: Accounts','menu',true,null),('admin.menu.members','Admin menu: Members','menu',true,null),('admin.menu.events','Admin menu: Events','menu',true,null),('admin.menu.programs','Admin menu: Programs','menu',true,null),('admin.menu.attendance','Admin menu: Attendance','menu',true,null),('admin.menu.reports','Admin menu: Reports','menu',true,null),('admin.menu.assets','Admin menu: Assets','menu',true,null),('admin.menu.audit','Admin menu: Audit log','menu',true,null),
 ('feature.self_checkin','Member self check-in','feature',true,null),('feature.departments','Department choice at registration','feature',true,null),
 ('stub.sms','SMS notifications','stub',false,'Not built yet'),('stub.mobile_money','Mobile-money payments','stub',false,'Not built yet'),('stub.backups_export','Backups and data export','stub',false,'Not built yet'),
 ('stub.multi_language','Multi-language','stub',false,'Not built yet'),('stub.audit_log_advanced','Audit log (advanced)','stub',false,'Not built yet'),('stub.api_keys','API keys','stub',false,'Not built yet'),('stub.payments_reports','Payments reports','stub',false,'Not built yet')
on conflict (key) do nothing;

create or replace function feature_enabled(p_key text,p_unit bigint default null) returns boolean language sql stable security definer set search_path=public as $$
 with recursive up as (select id,parent_id,0 as d from branches where id=p_unit union all select b.id,b.parent_id,up.d+1 from branches b join up on b.id=up.parent_id)
 select coalesce((select f.enabled from feature_flags f join up on up.id=f.unit_id where f.key=p_key order by up.d limit 1),
                 (select f.enabled from feature_flags f where f.key=p_key and f.unit_id is null),
                 (select default_enabled from feature_catalog where key=p_key),false) $$;
-- what the apps may see: on/off for real features only. Stubs are never revealed.
create or replace function my_features(p_unit bigint default null) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_object_agg(c.key,feature_enabled(c.key,p_unit)),'{}'::jsonb) from feature_catalog c where c.kind<>'stub' $$;

create or replace function create_dev(p_name text,p_username text,p_password text) returns bigint language plpgsql as $$
declare i bigint;
begin
 if length(p_password)<10 then raise exception 'Developer password must be 10+ characters'; end if;
 insert into dev_accounts(username,full_name,password_hash) values (trim(p_username),trim(p_name),extensions.crypt(p_password,extensions.gen_salt('bf'))) returning id into i;
 return i;
end $$;
create or replace function dev_login(p_username text,p_password text) returns bigint language sql stable security definer set search_path=public as $$
 select id from dev_accounts where username=trim(p_username) and active and password_hash=extensions.crypt(p_password,password_hash) limit 1 $$;
create or replace function dev_change_password(p_id bigint,p_password text) returns void language plpgsql security definer set search_path=public as $$
begin if not is_dev() then raise exception 'Not found'; end if; if length(p_password)<10 then raise exception 'Password must be 10+ characters'; end if;
 update dev_accounts set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf')) where id=p_id; end $$;
create or replace function dev_create_staff(p_role text,p_branch bigint,p_slot text,p_name text,p_username text,p_password text,p_privileges text[] default '{}') returns bigint language plpgsql security definer set search_path=public as $$
begin if not is_dev() then raise exception 'Not found'; end if; return create_staff(p_role,p_branch,p_slot,p_name,p_username,p_password,p_privileges); end $$;
create or replace function dev_set_staff_password(p_id bigint,p_password text) returns void language plpgsql security definer set search_path=public as $$
begin if not is_dev() then raise exception 'Not found'; end if; perform staff_set_password(p_id,p_password); end $$;
create or replace function dev_reset_member_password(p_id bigint) returns text language plpgsql security definer set search_path=public as $$
begin if not is_dev() then raise exception 'Not found'; end if; return member_reset_password(p_id); end $$;
create or replace function dev_create_member(p_branch bigint,p_name text,p_phone text,p_password text,p_address text,p_birth date,p_marriage date default null,p_department text default null) returns bigint language plpgsql security definer set search_path=public as $$
begin if not is_dev() then raise exception 'Not found'; end if; return member_register(p_branch,p_name,p_phone,p_password,p_address,p_birth,p_marriage,p_department); end $$;

-- The Developer may also set Leader status directly (the guard still stops everybody else)
create or replace function leader_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if coalesce(current_setting('khi.allow_leader',true),'')<>'on' and not is_dev() then
  if tg_op='INSERT' and new.kind='leader' then raise exception 'Only the Super Admin can make someone a Leader'; end if;
  if tg_op='UPDATE' and (new.kind='leader') is distinct from (old.kind='leader') then raise exception 'Only the Super Admin can change a Leader status'; end if;
 end if;
 return new;
end $$;
alter function unit_parent_guard() security definer set search_path=public;

-- 5. ENFORCEMENT IN THE DATABASE (RLS + privileges)
--    * the server key (service_role) is stripped of ALL access to the developer tables
--    * every table gets a policy: only a token with khi_role=developer may read or write it as an end-user role
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table %I enable row level security',t);
  execute format('grant select,insert,update,delete on %I to authenticated',t);
  execute format('drop policy if exists dev_all on %I',t);
  execute format('create policy dev_all on %I for all to authenticated using (is_dev()) with check (is_dev())',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on dev_accounts,dev_audit,feature_catalog,feature_flags from public,anon,service_role;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function is_dev() to authenticated,service_role;
grant execute on function feature_enabled(text,bigint),my_features(bigint),unit_brand(bigint),dev_login(text,text) to service_role;
grant execute on function dev_change_password(bigint,text),dev_create_staff(text,bigint,text,text,text,text,text[]),dev_set_staff_password(bigint,text),dev_reset_member_password(bigint),dev_create_member(bigint,text,text,text,text,date,date,text) to authenticated;

-- 6. The Super Admin account is Apostle Felix Mwamba (renamed if it exists; otherwise created, and the password is printed ONCE below)
do $$ declare pw text; begin
 if exists (select 1 from staff where role='superadmin') then
  update staff set full_name='Apostle Felix Mwamba' where role='superadmin';
 else
  pw:=substr(encode(extensions.gen_random_bytes(9),'hex'),1,12);
  perform create_staff('superadmin',null,null,'Apostle Felix Mwamba','apostle',pw);
  raise notice 'Super Admin created. Username: apostle   Password: %   (change it now)',pw;
 end if;
end $$;

-- Create Timothy's Developer account once in Supabase SQL Editor:
-- select create_dev('Timothy', 'timothy', 'ChangeThisLongPassword123');
