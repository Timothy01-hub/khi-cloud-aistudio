-- KHI Offering System · v4 features: Africa's Talking SMS (feature.sms, staff.phone, member OTP, sms_log)
-- Run ONCE in Supabase > SQL Editor, AFTER v3.sql. Safe to run again.

-- 1. Promote stub.sms -> feature.sms (off by default; only the Developer can switch it on)
insert into feature_catalog(key,label,kind,default_enabled,note) values
 ('feature.sms','SMS notifications','feature',false,null)
on conflict (key) do update set label=excluded.label, kind='feature', default_enabled=false, note=null;

insert into feature_flags(key, unit_id, enabled)
 select 'feature.sms', unit_id, enabled from feature_flags where key = 'stub.sms'
 on conflict do nothing;

delete from feature_catalog where key = 'stub.sms';

-- 2. Add staff.phone (and dev_accounts.phone) for SMS login codes
alter table staff add column if not exists phone text;
alter table dev_accounts add column if not exists phone text;

-- 3. Widen login_otps + create_login_otp to allow member SMS login codes
alter table login_otps drop constraint if exists login_otps_role_check;
alter table login_otps add constraint login_otps_role_check check (role in ('member','secretary','admin','superadmin','developer'));

create or replace function create_login_otp(p_role text, p_user_id bigint, p_code text, p_ttl_seconds int default 600)
returns text language plpgsql security definer set search_path=public as $$
declare tok text := encode(extensions.gen_random_bytes(16), 'hex');
begin
 if p_role not in ('member','secretary','admin','superadmin','developer') then
  raise exception 'Invalid OTP role';
 end if;
 update login_otps set used = true where role = p_role and user_id = p_user_id and not used;
 insert into login_otps(token, role, user_id, code_hash, expires_at)
  values (tok, p_role, p_user_id, extensions.crypt(trim(p_code), extensions.gen_salt('bf')), now() + make_interval(secs => greatest(60, coalesce(p_ttl_seconds, 600))));
 return tok;
end $$;

revoke execute on function create_login_otp(text,bigint,text,int) from public, anon, authenticated;
grant execute on function create_login_otp(text,bigint,text,int) to service_role;

-- 4. SMS log table (RLS dev-only)
create table if not exists sms_log(
 id bigint generated always as identity primary key,
 branch_id bigint references branches(id) on delete set null,
 kind text not null,
 to_phone text not null,
 message text not null,
 status text not null,
 status_code int,
 cost text,
 message_id text,
 ok boolean not null default false,
 error text,
 created_by text,
 created_at timestamptz not null default now());
create index if not exists sms_log_created_idx on sms_log(created_at desc, id desc);

alter table sms_log enable row level security;
grant select, insert, update, delete on sms_log to authenticated;
drop policy if exists dev_all on sms_log;
create policy dev_all on sms_log for all to authenticated using (is_dev()) with check (is_dev());
grant usage, select on all sequences in schema public to authenticated;
revoke all on sms_log from public, anon;
