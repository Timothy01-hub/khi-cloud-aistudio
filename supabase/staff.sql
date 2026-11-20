-- Stage 3: staff accounts + secretary dashboard helpers. Run once in Supabase > SQL Editor (after schema.sql and auth.sql).
create function create_staff(p_role text,p_branch bigint,p_slot text,p_name text,p_username text,p_password text) returns bigint language plpgsql as $$
declare sid bigint;
begin
 if length(p_password)<8 then raise exception 'Password must be 8+ characters'; end if;
 insert into staff(role,branch_id,slot,full_name,username,password_hash)
  values (p_role,p_branch,p_slot,trim(p_name),trim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf'))) returning id into sid;
 insert into audit_log(actor,action,detail) values ('system','staff_created',p_role||' '||trim(p_username));
 return sid;
end $$;

create function staff_login(p_username text,p_password text,p_role text) returns table(id bigint,role text) language sql stable as $$
 select s.id,s.role from staff s
  where s.username=trim(p_username) and s.role=p_role and s.active and s.password_hash=extensions.crypt(p_password,s.password_hash) limit 1 $$;

create function branch_totals(p_branch bigint default null) returns table(type text,today numeric,month numeric) language sql stable as $$
 select o.type,
  coalesce(sum(o.amount) filter (where (o.created_at at time zone 'Africa/Lusaka')::date=today_lz()),0),
  coalesce(sum(o.amount) filter (where date_trunc('month',o.created_at at time zone 'Africa/Lusaka')=date_trunc('month',now() at time zone 'Africa/Lusaka')),0)
 from offerings o where not o.voided and (p_branch is null or o.branch_id=p_branch) group by o.type $$;

create function owing_pledges(p_branch bigint) returns table(id bigint,member_id bigint,member text,phone text,program text,balance numeric) language sql stable as $$
 select p.id,m.id,m.full_name,m.phone,g.title,p.amount-coalesce(sum(x.amount),0)
 from pledges p join members m on m.id=p.member_id join programs g on g.id=p.program_id left join pledge_payments x on x.pledge_id=p.id
 where m.branch_id=p_branch group by p.id,m.id,g.title
 having p.amount-coalesce(sum(x.amount),0)>0 order by m.full_name $$;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Create your first accounts (change the names and passwords!):
-- select create_staff('superadmin', null, null, 'System Admin', 'admin', 'ChangeThis123');
-- select create_staff('secretary', (select id from branches where is_main), 'main', 'Main Secretary', 'sec1', 'ChangeThis123');
-- select create_staff('secretary', (select id from branches where is_main), 'assistant', 'Assistant Secretary', 'sec2', 'ChangeThis123');
