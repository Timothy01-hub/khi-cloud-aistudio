-- Birthday and wedding-anniversary wishes.
-- Run ONCE in Supabase > SQL Editor (on your existing database, or after schema.sql and auth.sql on a new one).
alter table members add column if not exists birth_date date;
alter table members add column if not exists marriage_date date;
alter table members add column if not exists bday_wished date;
alter table members add column if not exists anniv_wished date;

-- True when the day and month of d are today's (a 29 Feb date is celebrated on 28 Feb in non-leap years)
create or replace function is_today_md(d date) returns boolean language sql stable as $$
 select to_char(d,'MMDD')=to_char(today_lz(),'MMDD')
  or (to_char(d,'MMDD')='0229' and to_char(today_lz(),'MMDD')='0228'
      and not ((extract(year from today_lz())::int%4=0 and extract(year from today_lz())::int%100<>0) or extract(year from today_lz())::int%400=0)) $$;

drop function if exists member_register(bigint,text,text,text,text);
create function member_register(p_branch bigint,p_name text,p_phone text,p_password text,p_address text,p_birth date,p_marriage date default null) returns bigint language plpgsql as $$
declare mid bigint; pid bigint;
begin
 insert into members(branch_id,full_name,phone,password_hash,consent_at,birth_date,marriage_date)
  values (p_branch,trim(p_name),p_phone,extensions.crypt(p_password,extensions.gen_salt('bf')),now(),p_birth,p_marriage) returning id into mid;
 select id into pid from people where branch_id=p_branch and phone=p_phone and member_id is null limit 1;
 if pid is not null then
  update people set kind='member',member_id=mid,full_name=trim(p_name),address=trim(p_address) where id=pid;
 else
  insert into people(branch_id,full_name,address,phone,kind,member_id,created_by) values (p_branch,trim(p_name),trim(p_address),p_phone,'member',mid,'app');
 end if;
 return mid;
end $$;

create or replace function notify_run() returns void language plpgsql as $$
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
 -- birthday wishes (once a day, Lusaka time)
 with b as (update members set bday_wished=today_lz()
   where birth_date is not null and bday_wished is distinct from today_lz() and is_today_md(birth_date) returning id,full_name)
 insert into notifications(member_id,message)
 select id,'🎂 Happy Birthday, '||split_part(trim(full_name),' ',1)||'! May God bless you with another year of joy, health and favour. — Kingdom Heralds International' from b;

 -- wedding anniversary wishes
 with a as (update members set anniv_wished=today_lz()
   where marriage_date is not null and anniv_wished is distinct from today_lz() and is_today_md(marriage_date)
   returning id,full_name,(extract(year from today_lz())::int - extract(year from marriage_date)::int) as yrs)
 insert into notifications(member_id,message)
 select id,'💍 Happy Wedding Anniversary, '||split_part(trim(full_name),' ',1)||'! '||
   case when yrs>0 then 'Celebrating '||yrs||' year'||case when yrs>1 then 's' else '' end||' of marriage. ' else '' end||
   'May God keep strengthening your home. — Kingdom Heralds International' from a;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
