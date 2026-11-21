-- KHI Offering System · v2 features: Receipts & statements, Expenses, Two-step approval, Staff login protection
-- Run ONCE in Supabase > SQL Editor, AFTER dev.sql. Safe to run again.

-- 1. Feature flags in Developer catalog (all default ON)
insert into feature_catalog(key,label,kind,default_enabled,note) values
 ('feature.receipts','Receipts & yearly statements','feature',true,null),
 ('feature.expenses','Expenses tracking','feature',true,null),
 ('feature.two_step_approval','Two-step approval for void/edit','feature',true,null),
 ('feature.login_otp','Staff 6-digit login verification code','feature',true,null)
on conflict (key) do nothing;

-- 2. Receipts & statements: KHI-<branch code>-<year>-<seq>
alter table branches add column if not exists code text unique;

create or replace function unit_code_gen(p_name text, p_id bigint default null) returns text language plpgsql immutable as $$
declare raw text;
begin
 raw := upper(regexp_replace(regexp_replace(coalesce(p_name,''), '\y(KHI|FELLOWSHIP|BRANCH|CENTRE|CENTER)\y', '', 'gi'), '[^A-Z0-9]+', '', 'g'));
 if raw = '' then raw := 'U' || coalesce(p_id::text, ''); end if;
 return left(raw, 4);
end $$;

create or replace function branch_code_assign() returns trigger language plpgsql as $$
declare base text; cand text;
begin
 if coalesce(trim(new.code), '') = '' then
  base := unit_code_gen(new.name, new.id);
  cand := base;
  if exists (select 1 from branches where upper(code) = cand and id is distinct from new.id) then
   cand := left(base, 3) || coalesce(new.id::text, substr(md5(coalesce(new.name,'')||random()::text),1,3));
  end if;
  new.code := upper(cand);
 else
  new.code := upper(regexp_replace(trim(new.code), '[^A-Z0-9]+', '', 'g'));
 end if;
 return new;
end $$;

do $$ declare r record; c text; begin
 for r in select id, name from branches where coalesce(trim(code),'')='' order by id loop
  c := unit_code_gen(r.name, r.id);
  if exists (select 1 from branches where upper(code)=c and id<>r.id) then c := left(c,3)||r.id::text; end if;
  update branches set code=c where id=r.id;
 end loop;
end $$;

drop trigger if exists branch_code_assign on branches;
create trigger branch_code_assign before insert or update of name, code on branches for each row execute function branch_code_assign();

create table if not exists receipt_counters(
 branch_id bigint not null references branches(id) on delete cascade,
 yr int not null,
 last_seq int not null default 0,
 primary key (branch_id, yr));

create or replace function next_receipt_no(p_branch bigint, p_ts timestamptz default now()) returns text
language plpgsql security definer set search_path=public as $$
declare v_yr int := extract(year from coalesce(p_ts, now()) at time zone 'Africa/Lusaka')::int;
        v_seq int; c text;
begin
 select upper(code) into c from branches where id = p_branch;
 if coalesce(c,'') = '' then c := 'B' || p_branch; end if;
 insert into receipt_counters(branch_id, yr, last_seq) values (p_branch, v_yr, 1)
  on conflict (branch_id, yr) do update set last_seq = receipt_counters.last_seq + 1
  returning last_seq into v_seq;
 return 'KHI-' || c || '-' || v_yr || '-' || lpad(v_seq::text, 4, '0');
end $$;

alter table offerings add column if not exists receipt_no text unique;
alter table offerings add column if not exists member_id bigint references members(id);
alter table pledge_payments add column if not exists receipt_no text unique;

create or replace function offerings_receipt_bi() returns trigger language plpgsql as $$
begin
 if coalesce(trim(new.receipt_no), '') = '' then
  new.receipt_no := next_receipt_no(new.branch_id, new.created_at);
 end if;
 return new;
end $$;
drop trigger if exists offerings_receipt_bi on offerings;
create trigger offerings_receipt_bi before insert on offerings for each row execute function offerings_receipt_bi();

create or replace function pledge_payments_receipt_bi() returns trigger language plpgsql as $$
declare rno text; br bigint;
begin
 if coalesce(trim(new.receipt_no), '') = '' then
  if new.offering_id is not null then
   select receipt_no into rno from offerings where id = new.offering_id;
  end if;
  if coalesce(rno,'') = '' then
   select m.branch_id into br from pledges p join members m on m.id=p.member_id where p.id=new.pledge_id;
   rno := next_receipt_no(br, new.created_at);
  end if;
  new.receipt_no := rno;
 end if;
 return new;
end $$;
drop trigger if exists pledge_payments_receipt_bi on pledge_payments;
create trigger pledge_payments_receipt_bi before insert on pledge_payments for each row execute function pledge_payments_receipt_bi();

do $$ declare r record; begin
 for r in select id, branch_id, created_at from offerings where receipt_no is null order by created_at, id loop
  update offerings set receipt_no = next_receipt_no(r.branch_id, r.created_at) where id = r.id;
 end loop;
 update offerings o set member_id = p.member_id
  from pledge_payments pp join pledges p on p.id = pp.pledge_id
  where pp.offering_id = o.id and o.member_id is null;
 update offerings o set member_id = m.id
  from members m where o.member_id is null and o.sender = m.phone;
 for r in select pp.id, pp.offering_id, pp.created_at, m.branch_id from pledge_payments pp join pledges p on p.id=pp.pledge_id join members m on m.id=p.member_id where pp.receipt_no is null order by pp.created_at, pp.id loop
  update pledge_payments pp set receipt_no = coalesce((select o.receipt_no from offerings o where o.id = r.offering_id), next_receipt_no(r.branch_id, r.created_at)) where pp.id = r.id;
 end loop;
end $$;

create or replace function record_pledge_payment(p_pledge bigint,p_amount numeric,p_by text,p_type text,p_ref text default null) returns numeric language plpgsql as $$
declare pl record; bal numeric; amt numeric; oid bigint; remaining numeric;
begin
 select p.id,p.amount,g.title,m.id as mid,m.full_name,m.branch_id into pl
  from pledges p join programs g on g.id=p.program_id join members m on m.id=p.member_id
  where p.id=p_pledge for update of p;
 if not found then return 0; end if;
 select pl.amount - coalesce(sum(x.amount),0) into bal from pledge_payments x where x.pledge_id=p_pledge;
 amt := least(p_amount, bal);
 if amt <= 0 then return 0; end if;
 insert into offerings(branch_id,type,category,amount,sender,reference,note,recorded_by,member_id)
  values (pl.branch_id,p_type,pl.title,amt,pl.full_name,p_ref,'Pledge #'||p_pledge,p_by,pl.mid) returning id into oid;
 insert into pledge_payments(pledge_id,amount,offering_id,recorded_by) values (p_pledge,amt,oid,p_by);
 remaining := bal - amt;
 insert into notifications(member_id,message) values (pl.mid,
  'Payment of K'||to_char(amt,'FM999999990.00')||' received for '||pl.title||'. '||
  case when remaining>0 then 'Balance remaining: K'||to_char(remaining,'FM999999990.00') else 'Your pledge is fully paid. God bless you!' end);
 insert into audit_log(actor,action,detail) values (coalesce(p_by,'system'),'pledge_payment','K'||amt||' pledge #'||p_pledge);
 return amt;
end $$;

-- 3. Expenses (branch scope for Admin, all units for Super Admin / Developer)
alter table staff drop constraint if exists staff_shape;
alter table staff add constraint staff_shape check (
 (role='superadmin' and branch_id is null and slot is null and privileges='{}') or
 (role='admin' and branch_id is not null and slot is null and privileges <@ array['accounts','members','events','programs','attendance','reports','void','audit','assets','expenses']) or
 (role='secretary' and branch_id is not null and slot is not null and privileges='{}'));

update staff set privileges = array_append(privileges, 'expenses')
 where role='admin' and array_length(privileges,1) >= 9 and not ('expenses' = any(privileges));

create table if not exists expenses(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 expense_date date not null,
 category text not null,
 amount numeric(12,2) not null check (amount > 0),
 description text not null,
 receipt_photo text,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 logged_by text not null,
 logged_by_staff_id bigint references staff(id),
 logged_by_dev_id bigint,
 reviewed_by text,
 reviewed_by_staff_id bigint references staff(id),
 reviewed_by_dev_id bigint,
 review_note text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now());
create index if not exists expenses_branch_date on expenses(branch_id, expense_date desc);

create or replace function expenses_review_guard() returns trigger language plpgsql as $$
begin
 if old.status <> 'pending' and (new.status is distinct from old.status) then
  raise exception 'Expense has already been reviewed';
 end if;
 if new.status in ('approved','rejected') and old.status = 'pending' then
  if coalesce(trim(new.reviewed_by),'') = '' then raise exception 'Reviewer required'; end if;
  if not is_dev() and coalesce(new.reviewed_by,'') not like 'superadmin:%' then
   if (new.reviewed_by = old.logged_by) or (new.reviewed_by_staff_id is not null and new.reviewed_by_staff_id = old.logged_by_staff_id) then
    raise exception 'A different admin or Super Admin must review this expense';
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists expenses_review_guard on expenses;
create trigger expenses_review_guard before update on expenses for each row execute function expenses_review_guard();

create or replace function financial_summary(p_from date, p_to date, p_scope bigint[] default null)
returns table(branch_id bigint, branch_name text, income numeric, approved_expenses numeric, balance numeric)
language sql stable security definer set search_path=public as $$
 select b.id, unit_label(b.name, b.kind),
  coalesce((select sum(o.amount) from offerings o where o.branch_id=b.id and not o.voided and (o.created_at at time zone 'Africa/Lusaka')::date between p_from and p_to), 0)::numeric(12,2),
  coalesce((select sum(e.amount) from expenses e where e.branch_id=b.id and e.status='approved' and e.expense_date between p_from and p_to), 0)::numeric(12,2),
  (coalesce((select sum(o.amount) from offerings o where o.branch_id=b.id and not o.voided and (o.created_at at time zone 'Africa/Lusaka')::date between p_from and p_to), 0)
   - coalesce((select sum(e.amount) from expenses e where e.branch_id=b.id and e.status='approved' and e.expense_date between p_from and p_to), 0))::numeric(12,2)
 from branches b where (p_scope is null or b.id = any(p_scope))
 order by b.is_main desc, b.name asc $$;

-- 4. Two-step approval for void/edit >= threshold (default ZMW 500)
insert into settings(key, value) values ('approval_threshold', '{"amount":500}')
on conflict (key) do nothing;

create table if not exists approval_requests(
 id bigint generated always as identity primary key,
 branch_id bigint not null references branches(id),
 offering_id bigint not null references offerings(id) on delete cascade,
 action text not null check (action in ('void','edit')),
 amount numeric(12,2) not null check (amount > 0),
 payload jsonb not null default '{}'::jsonb,
 reason text not null,
 requested_by text not null,
 requested_by_staff_id bigint references staff(id),
 requested_by_dev_id bigint,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_by text,
 reviewed_by_staff_id bigint references staff(id),
 reviewed_by_dev_id bigint,
 review_note text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now());
create unique index if not exists approval_one_pending on approval_requests(offering_id) where status='pending';

create or replace function approval_self_guard() returns trigger language plpgsql as $$
begin
 if old.status <> 'pending' then
  raise exception 'Approval request has already been resolved';
 end if;
 if new.status in ('approved','rejected') then
  if (new.reviewed_by = old.requested_by)
     or (new.reviewed_by_staff_id is not null and new.reviewed_by_staff_id = old.requested_by_staff_id)
     or (new.reviewed_by_dev_id is not null and new.reviewed_by_dev_id = old.requested_by_dev_id) then
   raise exception 'Requester cannot approve or reject their own request';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists approval_self_guard on approval_requests;
create trigger approval_self_guard before update on approval_requests for each row execute function approval_self_guard();

create or replace function edit_offering(p_id bigint, p_amount numeric, p_category text, p_sender text, p_note text, p_reason text, p_by text, p_branch bigint default null, p_audit boolean default true)
returns text language plpgsql as $$
declare o record; pp record;
begin
 select * into o from offerings where id=p_id and not voided for update;
 if not found or (p_branch is not null and o.branch_id<>p_branch) or coalesce(trim(p_reason),'')='' or p_amount is null or p_amount <= 0 then
  return 'Cannot edit this entry.';
 end if;
 update offerings set amount=p_amount, category=coalesce(nullif(trim(p_category),''), o.category),
  sender=nullif(trim(coalesce(p_sender,'')),''), note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_id;
 for pp in select x.id, p.member_id, g.title from pledge_payments x join pledges p on p.id=x.pledge_id join programs g on g.id=p.program_id where x.offering_id=p_id loop
  update pledge_payments set amount=p_amount where id=pp.id;
  insert into notifications(member_id,message) values (pp.member_id,'A pledge payment for '||pp.title||' was updated to K'||to_char(p_amount,'FM999999990.00')||' ('||left(trim(p_reason),120)||').');
 end loop;
 if p_audit then
  insert into audit_log(actor,action,detail) values (p_by,'edit_offering','#'||p_id||' K'||to_char(o.amount,'FM999999990.00')||' -> K'||to_char(p_amount,'FM999999990.00')||' - '||p_reason);
 end if;
 return 'Entry updated.';
end $$;

create or replace function resolve_approval(p_req bigint, p_approve boolean, p_by text, p_staff_id bigint default null, p_dev_id bigint default null, p_note text default '', p_scope bigint[] default null, p_audit boolean default true)
returns text language plpgsql security definer set search_path=public as $$
declare r record; res text;
begin
 select * into r from approval_requests where id=p_req for update;
 if not found or r.status <> 'pending' then return 'Approval request not found or already resolved.'; end if;
 if p_scope is not null and not (r.branch_id = any(p_scope)) then raise exception 'Outside your area'; end if;
 update approval_requests set
  status = case when p_approve then 'approved' else 'rejected' end,
  reviewed_by = p_by, reviewed_by_staff_id = p_staff_id, reviewed_by_dev_id = p_dev_id,
  review_note = nullif(trim(coalesce(p_note,'')),''), reviewed_at = now()
  where id = p_req;
 if p_approve then
  if r.action = 'void' then
   if p_audit then
    res := void_offering(r.offering_id, r.reason, p_by, null);
   else
    update offerings set voided=true, void_reason=left(trim(r.reason),255), voided_by=p_by, voided_at=now() where id=r.offering_id and not voided;
    delete from pledge_payments where offering_id=r.offering_id;
    res := 'Entry voided.';
   end if;
  else
   res := edit_offering(r.offering_id, (r.payload->>'amount')::numeric, r.payload->>'category', r.payload->>'sender', r.payload->>'note', r.reason, p_by, null, p_audit);
  end if;
  if p_audit then insert into audit_log(actor,action,detail) values (p_by,'approval_approved','Req #'||r.id||' ('||r.action||' #'||r.offering_id||')'); end if;
  return coalesce(res, 'Approved.');
 else
  if p_audit then insert into audit_log(actor,action,detail) values (p_by,'approval_rejected','Req #'||r.id||' ('||r.action||' #'||r.offering_id||')'||case when coalesce(trim(p_note),'')<>'' then ' - '||trim(p_note) else '' end); end if;
  return 'Request rejected.';
 end if;
end $$;

-- 5. Staff login protection (6-digit OTP + lock/unlock)
alter table staff add column if not exists email text;
alter table dev_accounts add column if not exists email text;

create table if not exists login_otps(
 id bigint generated always as identity primary key,
 token text not null unique,
 role text not null check (role in ('admin','superadmin','developer')),
 user_id bigint not null,
 code_hash text not null,
 attempts int not null default 0,
 expires_at timestamptz not null,
 used boolean not null default false,
 created_at timestamptz not null default now());

create or replace function create_login_otp(p_role text, p_user_id bigint, p_code text, p_ttl_seconds int default 600)
returns text language plpgsql security definer set search_path=public as $$
declare tok text := encode(extensions.gen_random_bytes(16), 'hex');
begin
 update login_otps set used = true where role = p_role and user_id = p_user_id and not used;
 insert into login_otps(token, role, user_id, code_hash, expires_at)
  values (tok, p_role, p_user_id, extensions.crypt(trim(p_code), extensions.gen_salt('bf')), now() + make_interval(secs => greatest(60, coalesce(p_ttl_seconds, 600))));
 return tok;
end $$;

create or replace function verify_login_otp(p_token text, p_code text)
returns table(ok boolean, role text, user_id bigint, err text) language plpgsql security definer set search_path=public as $$
declare r record;
begin
 select * into r from login_otps where token = trim(coalesce(p_token,'')) for update;
 if not found or r.used or r.expires_at <= now() or r.attempts >= 5 then
  return query select false, null::text, null::bigint, 'Verification code expired or invalid. Please sign in again.'::text;
  return;
 end if;
 if r.code_hash = extensions.crypt(trim(coalesce(p_code,'')), r.code_hash) then
  update login_otps set used = true where id = r.id;
  return query select true, r.role, r.user_id, null::text;
  return;
 end if;
 update login_otps set attempts = r.attempts + 1, used = (r.attempts + 1 >= 5) where id = r.id;
 if r.attempts + 1 >= 5 then
  return query select false, r.role, r.user_id, 'Too many invalid codes. Please sign in again.'::text;
 else
  return query select false, r.role, r.user_id, 'Invalid verification code.'::text;
 end if;
end $$;

create or replace function locked_idents()
returns table(ident text, fails bigint, locked_until timestamptz) language sql stable security definer set search_path=public as $$
 select ident, count(*) as fails, max(created_at) + interval '15 minutes' as locked_until
 from login_attempts
 where created_at > now() - interval '15 minutes'
 group by ident having count(*) >= 5
 order by locked_until desc $$;

create or replace function unlock_login(p_ident text, p_by text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 delete from login_attempts where ident = p_ident;
 if coalesce(trim(p_by),'') <> '' then
  insert into audit_log(actor, action, detail) values (p_by, 'unlock_account', p_ident);
 end if;
end $$;

create or replace function dev_unlock_login(p_ident text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_dev() then raise exception 'Not found'; end if;
 delete from login_attempts where ident = p_ident;
end $$;

create or replace function dev_locked_idents()
returns table(ident text, fails bigint, locked_until timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
 if not is_dev() then raise exception 'Not found'; end if;
 return query select l.ident, l.fails, l.locked_until from locked_idents() l;
end $$;

create or replace function dev_resolve_approval(p_req bigint, p_approve boolean, p_by text, p_dev_id bigint, p_note text default '', p_scope bigint[] default null)
returns text language plpgsql security definer set search_path=public as $$
begin
 if not is_dev() then raise exception 'Not found'; end if;
 return resolve_approval(p_req, p_approve, p_by, null, p_dev_id, p_note, p_scope, false);
end $$;

-- 6. Row Level Security for new tables + developer isolation
do $$ declare t text; begin
 for t in select unnest(array['receipt_counters','expenses','approval_requests','login_otps']) loop
  execute format('alter table %I enable row level security', t);
 end loop;
 for t in select unnest(array['receipt_counters','expenses','approval_requests']) loop
  execute format('grant select,insert,update,delete on %I to authenticated', t);
  execute format('drop policy if exists dev_all on %I', t);
  execute format('create policy dev_all on %I for all to authenticated using (is_dev()) with check (is_dev())', t);
 end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated;
revoke all on receipt_counters, expenses, approval_requests, login_otps from public, anon;
revoke all on login_otps from authenticated;
revoke all on dev_accounts, dev_audit, feature_catalog, feature_flags from public, anon, service_role;

revoke execute on function unit_code_gen(text,bigint), next_receipt_no(bigint,timestamptz), financial_summary(date,date,bigint[]),
 edit_offering(bigint,numeric,text,text,text,text,text,bigint,boolean), resolve_approval(bigint,boolean,text,bigint,bigint,text,bigint[],boolean),
 create_login_otp(text,bigint,text,int), verify_login_otp(text,text), locked_idents(), unlock_login(text,text),
 dev_unlock_login(text), dev_locked_idents(), dev_resolve_approval(bigint,boolean,text,bigint,text,bigint[])
 from public, anon, authenticated;

grant execute on function next_receipt_no(bigint,timestamptz), financial_summary(date,date,bigint[]),
 edit_offering(bigint,numeric,text,text,text,text,text,bigint,boolean), resolve_approval(bigint,boolean,text,bigint,bigint,text,bigint[],boolean),
 create_login_otp(text,bigint,text,int), verify_login_otp(text,text), locked_idents(), unlock_login(text,text)
 to service_role;

grant execute on function dev_unlock_login(text), dev_locked_idents(), dev_resolve_approval(bigint,boolean,text,bigint,text,bigint[]),
 financial_summary(date,date,bigint[]), next_receipt_no(bigint,timestamptz)
 to authenticated;
