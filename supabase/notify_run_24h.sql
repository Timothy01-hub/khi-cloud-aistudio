-- Run this once in Supabase > SQL Editor if you already ran schema.sql.
-- Only change: pledge reminders now repeat every 24 hours instead of 5.
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
end $$;
