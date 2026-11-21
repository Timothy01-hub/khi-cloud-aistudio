// v2 features: Receipts & statements, Expenses, Two-step approval, Staff login OTP & account unlock in a real Postgres engine (PGlite) with RLS.
import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const db=new PGlite();let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const q=async(sql,p)=>(await db.query(sql,p)).rows;const one=async(sql,p)=>(await q(sql,p))[0];
const as=async(role,claims,fn)=>{await db.query(`select set_config('request.jwt.claims',$1,false)`,[claims?JSON.stringify(claims):'']);await db.exec(`set role ${role}`);try{return await fn()}finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claims','',false)`)}};
const denied=async(role,claims,sql)=>as(role,claims,async()=>{try{await db.exec(sql);return false}catch(e){return /permission denied|row-level security|not found|only the super admin|violates|different admin|requester cannot/i.test(e.message)}});

await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;
 alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on functions to service_role; alter default privileges in schema public grant all on sequences to service_role;
 create function extensions.gen_salt(t text) returns text language sql as $$ select 'S' $$;
 create function extensions.crypt(p text,s text) returns text language sql as $$ select 'h:'||md5(p) $$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;`);
for(const f of ['schema','auth','birthdays','departments','staff','hierarchy','dev']){
 await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8').replace(/create extension[^;]*;/i,''));
}
await db.exec(`insert into branches(name,kind,parent_id) values ('NIPA FELLOWSHIP','fellowship',1),('Matero','branch',1);
 select create_staff('admin',1,null,'Main Admin','mainadmin','Password123',array['accounts','members','events','programs','attendance','reports','void','audit','assets']);
 select create_staff('admin',1,null,'Second Admin','secadmin','Password123',array['events','reports']);
 select create_staff('secretary',1,'main','Sec One','sec1','Password123');
 insert into members(branch_id,full_name,phone,password_hash) values (1,'Grace Phiri','0971234567','x'),(2,'Mary Tembo','0951234567','x');
 insert into programs(branch_id,title,active) values (null,'Building Project',true);
 insert into pledges(member_id,program_id,amount) values (1,1,1000);
 insert into offerings(branch_id,type,category,amount,sender) values (1,'physical','Offering',850,'Grace Phiri'),(2,'physical','Tithe',400,'Mary Tembo');
 select record_pledge_payment(1,200,'sec1','physical');`);

await db.exec(fs.readFileSync('supabase/v2.sql','utf8'));
await db.exec(fs.readFileSync('supabase/v2.sql','utf8'));
ok('v2.sql runs cleanly (and is idempotent)',true);

// 1. Feature catalog flags
let r=await as('service_role',null,()=>one(`select my_features(1) m`));
ok('v2 feature flags added and default ON',['feature.receipts','feature.expenses','feature.two_step_approval','feature.login_otp'].every(k=>r.m[k]===true));

// 2. Receipts & branch codes
let brs=await q(`select id,name,code from branches order by id`);
ok('branches get clean unique uppercase codes',brs.every(b=>/^[A-Z0-9]+$/.test(b.code))&&new Set(brs.map(b=>b.code)).size===brs.length);
let offs=await q(`select id,branch_id,receipt_no,member_id from offerings order by id`);
let pps=await q(`select id,offering_id,receipt_no from pledge_payments order by id`);
ok('all pre-existing offerings & pledge payments backfilled with unique KHI-... receipt numbers',
 offs.every(o=>/^KHI-[A-Z0-9]+-\d{4}-\d{4}$/.test(o.receipt_no))
 &&pps.every(p=>/^KHI-[A-Z0-9]+-\d{4}-\d{4}$/.test(p.receipt_no))
 &&new Set(offs.map(o=>o.receipt_no)).size===offs.length
 &&pps[0].receipt_no===offs[2].receipt_no
 &&offs[2].member_id===1);
await db.exec(`insert into offerings(branch_id,type,category,amount,member_id) values (1,'digital','Offering',100,1)`);
r=await one(`select receipt_no from offerings order by id desc limit 1`);
ok('new offerings auto-receive incrementing KHI-<code >-<year>-<seq>',r.receipt_no.startsWith(`KHI-${brs[0].code}-`)&&r.receipt_no!==offs[2].receipt_no);

// 3. Expenses & financial summary
let adm1=await one(`select id,privileges from staff where username='mainadmin'`);
let adm2=await one(`select id from staff where username='secadmin'`);
let sup=await one(`select id from staff where role='superadmin' limit 1`);
ok('full admin received expenses privilege',adm1.privileges.includes('expenses'));
await db.exec(`insert into expenses(branch_id,expense_date,category,amount,description,logged_by,logged_by_staff_id) values (1,'2026-11-20','Utilities',150,'Power bill','admin:mainadmin',${adm1.id}),(2,'2026-11-20','Maintenance',50,'Bulb','admin:secadmin',${adm2.id})`);
ok('same admin cannot approve own expense (DB guard)',await denied('service_role',null,`update expenses set status='approved',reviewed_by='admin:mainadmin',reviewed_by_staff_id=${adm1.id} where id=1`));
await db.exec(`update expenses set status='approved',reviewed_by='admin:secadmin',reviewed_by_staff_id=${adm2.id},reviewed_at=now() where id=1`);
await db.exec(`update expenses set status='rejected',reviewed_by='superadmin:apostle',reviewed_by_staff_id=${sup.id},reviewed_at=now() where id=2`);
let fin=await as('service_role',null,()=>q(`select * from financial_summary('2020-01-01','2030-01-01',null)`));
let b1=fin.find(x=>Number(x.branch_id)===1),b2=fin.find(x=>Number(x.branch_id)===2);
ok('financial_summary computes per-branch income, approved expenses (ignoring rejected), and balance',
 Number(b1.income)===1150&&Number(b1.approved_expenses)===150&&Number(b1.balance)===1000
 &&Number(b2.income)===400&&Number(b2.approved_expenses)===0&&Number(b2.balance)===400);

// 4. Two-step approval
r=await one(`select (value->>'amount')::int a from settings where key='approval_threshold'`);
ok('approval_threshold seeded at 500',r.a===500);
await db.exec(`insert into approval_requests(branch_id,offering_id,action,amount,reason,requested_by,requested_by_staff_id) values (1,1,'void',850,'Duplicate','admin:mainadmin',${adm1.id})`);
ok('duplicate pending request on same offering blocked',await denied('service_role',null,`insert into approval_requests(branch_id,offering_id,action,amount,reason,requested_by,requested_by_staff_id) values (1,1,'void',850,'Again','admin:secadmin',${adm2.id})`));
ok('requester cannot approve own request (DB guard + resolve_approval)',await denied('service_role',null,`select resolve_approval(1,true,'admin:mainadmin',${adm1.id},null,'',null,true)`));
let res=await as('service_role',null,()=>one(`select resolve_approval(1,true,'admin:secadmin',${adm2.id},null,'Confirmed',null,true) m`));
ok('second authorised staff approves and voids offering + audits',res.m==='Entry voided.'&&(await one(`select voided from offerings where id=1`)).voided===true&&(await one(`select count(*)::int n from audit_log where action='approval_approved'`)).n===1);

// 5. Login OTP & lock/unlock
let tok=(await as('service_role',null,()=>one(`select create_login_otp('admin',${adm1.id},'123456',600) t`))).t;
let badOtp=await as('service_role',null,()=>one(`select * from verify_login_otp($1,'000000')`,[tok]));
ok('wrong OTP rejected',badOtp.ok===false);
let goodOtp=await as('service_role',null,()=>one(`select * from verify_login_otp($1,'123456')`,[tok]));
ok('valid 6-digit OTP succeeds once',goodOtp.ok===true&&goodOtp.role==='admin'&&Number(goodOtp.user_id)===Number(adm1.id));
let reuseOtp=await as('service_role',null,()=>one(`select * from verify_login_otp($1,'123456')`,[tok]));
ok('used OTP cannot be replayed',reuseOtp.ok===false);

for(let i=0;i<5;i++)await db.exec(`select login_fail('s:mainadmin','1.2.3.4')`);
ok('5 wrong passwords lock account',((await as('service_role',null,()=>one(`select count(*)::int n from locked_idents() where ident='s:mainadmin'`))).n===1));
await as('service_role',null,()=>db.exec(`select unlock_login('s:mainadmin','superadmin:apostle')`));
ok('unlock_login clears lock and records audit',((await as('service_role',null,()=>one(`select count(*)::int n from locked_idents() where ident='s:mainadmin'`))).n===0)&&(await one(`select count(*)::int n from audit_log where action='unlock_account'`)).n===1);

// 6. RLS boundaries on v2 tables
for(const t of ['receipt_counters','expenses','approval_requests','login_otps']){
 ok(`anon has NO access to ${t}`,await denied('anon',null,`select * from ${t}`));
 ok(`authenticated without dev claim sees 0 / denied on ${t}`,
  t==='login_otps'
   ? await denied('authenticated',{khi_role:'admin'},`select * from ${t}`)
   : ((await as('authenticated',{khi_role:'admin'},()=>one(`select count(*)::int n from ${t}`))).n===0));
}
ok('authenticated cannot read login_otps even with dev claim',await denied('authenticated',{khi_role:'developer'},`select * from login_otps`));
await as('authenticated',{khi_role:'developer'},async()=>{
 await db.exec(`insert into expenses(branch_id,expense_date,category,amount,description,logged_by) values (1,'2026-11-20','Other',25,'Dev exp','developer:timothy')`);
});
ok('developer (RLS khi_role=developer) can read/write expenses',((await as('authenticated',{khi_role:'developer'},()=>one(`select count(*)::int n from expenses`))).n>=3));

console.log(fails?`\n${fails} FAILED`:'\nAll v2 SQL & RLS rules verified in a real Postgres engine');
process.exit(fails?1:0);
