-- Stage 2 add-on: password hashing + login lockout run INSIDE the database (keeps the Worker fast on the free plan).
-- Run AFTER schema.sql, in the same SQL Editor.
create extension if not exists pgcrypto with schema extensions;

create function member_register(p_branch bigint,p_name text,p_phone text,p_password text,p_address text) returns bigint language plpgsql as $$
declare mid bigint; pid bigint;
begin
 insert into members(branch_id,full_name,phone,password_hash,consent_at)
  values (p_branch,trim(p_name),p_phone,extensions.crypt(p_password,extensions.gen_salt('bf')),now()) returning id into mid;
 select id into pid from people where branch_id=p_branch and phone=p_phone and member_id is null limit 1;
 if pid is not null then
  update people set kind='member',member_id=mid,full_name=trim(p_name),address=trim(p_address) where id=pid;
 else
  insert into people(branch_id,full_name,address,phone,kind,member_id,created_by) values (p_branch,trim(p_name),trim(p_address),p_phone,'member',mid,'app');
 end if;
 return mid;
end $$;

create function member_login(p_phone text,p_password text) returns bigint language sql stable as $$
 select id from members where phone=p_phone and password_hash=extensions.crypt(p_password,password_hash) limit 1 $$;

create function member_set_password(p_id bigint,p_old text,p_new text) returns boolean language plpgsql as $$
begin
 update members set password_hash=extensions.crypt(p_new,extensions.gen_salt('bf')),must_change=false
  where id=p_id and password_hash=extensions.crypt(p_old,password_hash);
 return found;
end $$;

create function login_locked(p_ident text,p_ip text) returns boolean language sql stable as $$
 select (select count(*) from login_attempts where ident=p_ident and created_at>now()-interval '15 minutes')>=5
     or (select count(*) from login_attempts where ip=p_ip and created_at>now()-interval '15 minutes')>=20 $$;

create function login_fail(p_ident text,p_ip text) returns void language sql as $$
 insert into login_attempts(ident,ip) values (left(p_ident,80),p_ip);
 insert into audit_log(actor,action,detail,ip) values ('anonymous','login_failed',left(p_ident,80),p_ip) $$;

create function login_clear(p_ident text) returns void language sql as $$ delete from login_attempts where ident=p_ident $$;

revoke execute on all functions in schema public from public, anon, authenticated;
