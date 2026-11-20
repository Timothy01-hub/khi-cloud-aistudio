-- KHI Offering System · Supabase (PostgreSQL) schema, Stage 1
-- Run once in Supabase > SQL Editor > New query > paste > Run.
-- Security model: Row Level Security is ON for every table and NO public access is granted.
-- Only the server (Cloudflare Worker using the secret service_role key) can read or write.

create table branches(
 id bigint generated always as identity primary key,
 name text not null unique,
 momo_number text unique,
 is_main boolean not null default false,
 created_at timestamptz not null default now());
create unique index one_main_church on branches(is_main) where is_main;

create table staff(
 id bigint generated always as identity primary key,
 branch_id bigint references branches(id),
 role text not null check (role in ('superadmin','secretary')),
 slot text check (slot in ('main','assistant')),
 full_name text not null,
 username text not null unique,
 password_hash text not null,
 active boolean not null default true,
 unique (branch_id, slot),                       -- at most 2 accounts per fellowship
 check ((role='superadmin' and branch_id is null and slot is null) or (role='secretary' and branch_id is not null and slot is not null)));

create table members(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 full_name text not null,
 phone text not null unique,
 password_hash text not null,
 must_change boolean not null default false,
 consent_at timestamptz,
 created_at timestamptz not null default now());

create table people(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 full_name text not null,
 address text not null default '',
 phone text,
 kind text not null default 'visitor' check (kind in ('member','visitor')),
 member_id bigint unique references members(id),
 notes text,
 created_by text,
 created_at timestamptz not null default now());
create index on people(branch_id, full_name);
create index on people(branch_id, phone);

create table services(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 service_date date not null,
 service_type text not null,
 is_open boolean not null default true,
 created_by text,
 created_at timestamptz not null default now(),
 unique (branch_id, service_date, service_type));

create table attendance(
 id bigint generated always as identity primary key,
 service_id bigint not null references services(id) on delete cascade,
 person_id bigint not null references people(id),
 via text not null default 'secretary' check (via in ('secretary','self')),
 created_at timestamptz not null default now(),
 unique (service_id, person_id));

create table programs(
 id bigint generated always as identity primary key,
 branch_id bigint references branches(id),
 title text not null,
 description text,
 deadline date,
 location text,
 banner text,
 lat numeric(9,6),
 lng numeric(9,6),
 active boolean not null default true);

create table events(
 id bigint generated always as identity primary key,
 branch_id bigint references branches(id),
 title text not null,
 event_date date not null,
 location text not null,
 description text,
 banner text,
 lat numeric(9,6),
 lng numeric(9,6),
 notified_on date,
 created_at timestamptz not null default now());

create table offerings(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 type text not null check (type in ('physical','digital')),
 category text not null default 'Offering',
 amount numeric(12,2) not null check (amount > 0),
 sender text,
 reference text unique,
 note text,
 recorded_by text,
 voided boolean not null default false,
 void_reason text,
 voided_by text,
 voided_at timestamptz,
 created_at timestamptz not null default now());
create index on offerings(branch_id, created_at);

create table pledges(
 id bigint generated always as identity primary key,
 member_id bigint not null references members(id),
 program_id bigint not null references programs(id),
 amount numeric(12,2) not null check (amount > 0),
 last_reminded timestamptz,
 created_at timestamptz not null default now(),
 unique (member_id, program_id));                -- a second pledge tops up the first

create table pledge_payments(
 id bigint generated always as identity primary key,
 pledge_id bigint not null references pledges(id),
 amount numeric(12,2) not null check (amount > 0),
 offering_id bigint references offerings(id),
 recorded_by text,
 created_at timestamptz not null default now());

create table notifications(
 id bigint generated always as identity primary key,
 member_id bigint not null references members(id),
 message text not null,
 is_read boolean not null default false,
 created_at timestamptz not null default now());
create index on notifications(member_id, is_read);

create table login_attempts(
 id bigint generated always as identity primary key,
 ident text not null,
 ip text not null,
 created_at timestamptz not null default now());
create index on login_attempts(ident, created_at);
create index on login_attempts(ip, created_at);

create table audit_log(
 id bigint generated always as identity primary key,
 actor text not null,
 action text not null,
 detail text,
 ip text,
 created_at timestamptz not null default now());

insert into branches(name,is_main) values ('KHI CITY CENTRE',true);

-- ---------- business rules as database functions (atomic, safe under simultaneous use) ----------
create function today_lz() returns date language sql stable as $$ select (now() at time zone 'Africa/Lusaka')::date $$;

create function make_pledge(p_member bigint,p_program bigint,p_amount numeric) returns numeric language plpgsql as $$
declare total numeric;
begin
 if p_amount < 1 then raise exception 'Invalid amount'; end if;
 insert into pledges(member_id,program_id,amount,last_reminded) values (p_member,p_program,p_amount,now())
 on conflict (member_id,program_id) do update set amount = pledges.amount + excluded.amount
 returning amount into total;
 return total;
end $$;

create function record_pledge_payment(p_pledge bigint,p_amount numeric,p_by text,p_type text,p_ref text default null) returns numeric language plpgsql as $$
declare pl record; bal numeric; amt numeric; oid bigint; remaining numeric;
begin
 select p.id,p.amount,g.title,m.id as mid,m.full_name,m.branch_id into pl
  from pledges p join programs g on g.id=p.program_id join members m on m.id=p.member_id
  where p.id=p_pledge for update of p;
 if not found then return 0; end if;
 select pl.amount - coalesce(sum(x.amount),0) into bal from pledge_payments x where x.pledge_id=p_pledge;
 amt := least(p_amount, bal);
 if amt <= 0 then return 0; end if;
 insert into offerings(branch_id,type,category,amount,sender,reference,note,recorded_by)
  values (pl.branch_id,p_type,pl.title,amt,pl.full_name,p_ref,'Pledge #'||p_pledge,p_by) returning id into oid;
 insert into pledge_payments(pledge_id,amount,offering_id,recorded_by) values (p_pledge,amt,oid,p_by);
 remaining := bal - amt;
 insert into notifications(member_id,message) values (pl.mid,
  'Payment of K'||to_char(amt,'FM999999990.00')||' received for '||pl.title||'. '||
  case when remaining>0 then 'Balance remaining: K'||to_char(remaining,'FM999999990.00') else 'Your pledge is fully paid. God bless you!' end);
 insert into audit_log(actor,action,detail) values (coalesce(p_by,'system'),'pledge_payment','K'||amt||' pledge #'||p_pledge);
 return amt;
end $$;

create function void_offering(p_id bigint,p_reason text,p_by text,p_branch bigint default null) returns text language plpgsql as $$
declare o record; x record;
begin
 select * into o from offerings where id=p_id and not voided for update;
 if not found or (p_branch is not null and o.branch_id<>p_branch) or coalesce(trim(p_reason),'')='' then return 'Cannot void this entry.'; end if;
 update offerings set voided=true,void_reason=left(trim(p_reason),255),voided_by=p_by,voided_at=now() where id=p_id;
 for x in select pp.id,pp.amount,p.member_id,g.title from pledge_payments pp join pledges p on p.id=pp.pledge_id join programs g on g.id=p.program_id where pp.offering_id=p_id loop
  delete from pledge_payments where id=x.id;
  insert into notifications(member_id,message) values (x.member_id,'A payment of K'||to_char(x.amount,'FM999999990.00')||' for '||x.title||' was reversed by the church office. Your balance has been restored.');
 end loop;
 insert into audit_log(actor,action,detail) values (p_by,'void_offering','#'||p_id||' - '||p_reason);
 return 'Entry voided.';
end $$;

-- 5-hour pledge reminders + "event is today" alerts. Run every 15 minutes (Cloudflare cron trigger).
create function notify_run() returns void language plpgsql as $$
begin
 with due as (
  select p.id,p.member_id,p.amount,g.title,
         p.amount - coalesce((select sum(x.amount) from pledge_payments x where x.pledge_id=p.id),0) as bal
  from pledges p join programs g on g.id=p.program_id
  where p.last_reminded is null or p.last_reminded <= now() - interval '24 hours'),
 upd as (update pledges set last_reminded=now() where id in (select id from due where bal>0) returning id)
 insert into notifications(member_id,message)
 select member_id,'Reminder: you pledged K'||to_char(amount,'FM999999990.00')||' to '||title||'. Balance remaining: K'||to_char(bal,'FM999999990.00')
 from due where bal>0 and id in (select id from upd);

 with ev as (select id,title,location,branch_id from events where event_date=today_lz() and (notified_on is null or notified_on<today_lz())),
 mark as (update events set notified_on=today_lz() where id in (select id from ev) returning id)
 insert into notifications(member_id,message)
 select m.id,'TODAY: '||e.title||' at '||e.location from ev e join members m on (e.branch_id is null or e.branch_id=m.branch_id);
end $$;

-- ---------- lock everything down: no access for the public web API ----------
alter table branches enable row level security;
alter table staff enable row level security;
alter table members enable row level security;
alter table people enable row level security;
alter table services enable row level security;
alter table attendance enable row level security;
alter table programs enable row level security;
alter table events enable row level security;
alter table offerings enable row level security;
alter table pledges enable row level security;
alter table pledge_payments enable row level security;
alter table notifications enable row level security;
alter table login_attempts enable row level security;
alter table audit_log enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
