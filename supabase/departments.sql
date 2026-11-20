-- Departments at registration. Run ONCE in Supabase > SQL Editor, AFTER birthdays.sql.
-- (The list of departments itself lives in the Worker for now: src/index.js, DEPTS.)
alter table members add column if not exists department text;
alter table people add column if not exists department text;

drop function if exists member_register(bigint,text,text,text,text,date,date);
create function member_register(p_branch bigint,p_name text,p_phone text,p_password text,p_address text,p_birth date,p_marriage date default null,p_department text default null) returns bigint language plpgsql as $$
declare mid bigint; pid bigint;
begin
 insert into members(branch_id,full_name,phone,password_hash,consent_at,birth_date,marriage_date,department)
  values (p_branch,trim(p_name),p_phone,extensions.crypt(p_password,extensions.gen_salt('bf')),now(),p_birth,p_marriage,p_department) returning id into mid;
 select id into pid from people where branch_id=p_branch and phone=p_phone and member_id is null limit 1;
 if pid is not null then
  update people set kind='member',member_id=mid,full_name=trim(p_name),address=trim(p_address),department=p_department where id=pid;
 else
  insert into people(branch_id,full_name,address,phone,kind,member_id,created_by,department) values (p_branch,trim(p_name),trim(p_address),p_phone,'member',mid,'app',p_department);
 end if;
 return mid;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
