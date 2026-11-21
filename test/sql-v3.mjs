// v3 features: Announcements, Branch budgets & budget_vs_actual, Feature flags & RLS in PGlite Postgres
import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const db=new PGlite();let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const q=async(sql,p)=>(await db.query(sql,p)).rows;const one=async(sql,p)=>(await q(sql,p))[0];
const as=async(role,claims,fn)=>{await db.query(`select set_config('request.jwt.claims',$1,false)`,[claims?JSON.stringify(claims):'']);await db.exec(`set role ${role}`);try{return await fn()}finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claims','',false)`)}};
const denied=async(role,claims,sql)=>as(role,claims,async()=>{try{await db.exec(sql);return false}catch(e){return /permission denied|row-level security|not found|only the super admin|violates|duplicate key/i.test(e.message)}});

await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;
 alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on functions to service_role; alter default privileges in schema public grant all on sequences to service_role;
 create function extensions.gen_salt(t text) returns text language sql as $$ select 'S' $$;
 create function extensions.crypt(p text,s text) returns text language sql as $$ select 'h:'||md5(p) $$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;`);

for(const f of ['schema','auth','birthdays','departments','staff','hierarchy','dev','v2']){
 await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8').replace(/create extension[^;]*;/i,''));
}
await db.exec(`insert into branches(name,kind,parent_id) values ('NIPA FELLOWSHIP','fellowship',1),('Matero','branch',1);
 select create_staff('admin',1,null,'Main Admin','mainadmin','Password123',array['accounts','members','events','programs','attendance','reports','void','audit','assets','expenses']);
 select create_staff('admin',2,null,'Limited Admin','limadmin','Password123',array['events','reports']);`);

await db.exec(fs.readFileSync('supabase/v3.sql','utf8'));
await db.exec(fs.readFileSync('supabase/v3.sql','utf8'));
ok('v3.sql runs cleanly after v2.sql and is idempotent',true);

// 1. Feature flags
const feats=await as('service_role',null,()=>one(`select my_features(1) m`));
ok('v3 feature flags added and default ON',
 ['feature.announcements','feature.budgets','feature.exports'].every(k=>feats.m[k]===true));

// 2. Staff privileges upgrade & shape check
const admMain=await one(`select privileges from staff where username='mainadmin'`);
const admLim=await one(`select privileges from staff where username='limadmin'`);
ok('full admin received announcements and budgets privileges; limited admin unchanged',
 admMain.privileges.includes('announcements')&&admMain.privileges.includes('budgets')
 &&!admLim.privileges.includes('announcements')&&!admLim.privileges.includes('budgets'));

// 3. Announcements schema & constraints
await db.exec(`insert into announcements(branch_id,title,body,expires_at,created_by) values
 (null,'General Fasting','Church-wide fasting week',null,'superadmin:super'),
 (1,'City Youth Night','Friday 18:00','2026-12-31','admin:mainadmin'),
 (2,'Nipa Choir','Past notice','2020-01-01','admin:limadmin')`);
const anns=await q(`select id,branch_id,title from announcements order by id`);
ok('announcements store global (null branch_id) and branch-specific rows',anns.length===3&&anns[0].branch_id===null&&anns[1].branch_id===1);
ok('blank announcement title/body rejected by check constraint',await denied('service_role',null,`insert into announcements(branch_id,title,body,created_by) values (1,'   ','Body','admin:mainadmin')`));

// 4. Branch budgets & budget_vs_actual calculation (>90% threshold)
const admRec=await one(`select id from staff where username='mainadmin'`);
const supRec=await one(`select id from staff where role='superadmin' limit 1`);
await db.exec(`insert into branch_budgets(branch_id,budget_year,category,amount,updated_by) values
 (1,2026,'Utilities',1000,'admin:mainadmin'),
 (1,2026,'Welfare',100,'admin:mainadmin'),
 (2,2026,'Maintenance',200,'admin:limadmin');
 insert into expenses(branch_id,expense_date,category,amount,description,status,logged_by,logged_by_staff_id,reviewed_by,reviewed_by_staff_id) values
 (1,'2026-04-01','Utilities',900,'Power bills','approved','admin:mainadmin',${admRec.id},'superadmin:super',${supRec.id}),
 (1,'2026-04-02','Welfare',95,'Hospital support','approved','admin:mainadmin',${admRec.id},'superadmin:super',${supRec.id}),
 (1,'2026-04-03','Welfare',500,'Pending welfare','pending','admin:mainadmin',${admRec.id},null,null),
 (2,'2026-04-04','Maintenance',100,'Rejected repair','rejected','admin:limadmin',${admRec.id},'superadmin:super',${supRec.id});`);
ok('duplicate (branch_id, budget_year, category) prevented by unique constraint',
 await denied('service_role',null,`insert into branch_budgets(branch_id,budget_year,category,amount,updated_by) values (1,2026,'Utilities',500,'admin:mainadmin')`));

const bva=await as('service_role',null,()=>q(`select * from budget_vs_actual(2026,null)`));
const uRow=bva.find(x=>Number(x.branch_id)===1&&x.category==='Utilities');
const wRow=bva.find(x=>Number(x.branch_id)===1&&x.category==='Welfare');
const mRow=bva.find(x=>Number(x.branch_id)===2&&x.category==='Maintenance');
ok('budget_vs_actual computes approved spend only, exact pct_used, and warns strictly > 90%',
 Number(uRow.actual_spent)===900&&Number(uRow.pct_used)===90&&uRow.over_90===false
 &&Number(wRow.actual_spent)===95&&Number(wRow.pct_used)===95&&wRow.over_90===true
 &&Number(mRow.actual_spent)===0&&Number(mRow.pct_used)===0&&mRow.over_90===false);

// 5. RLS isolation on announcements & branch_budgets
for(const t of ['announcements','branch_budgets']){
 ok(`anon has NO access to ${t}`,await denied('anon',null,`select * from ${t}`));
 ok(`authenticated non-dev sees 0 rows on ${t}`,((await as('authenticated',{khi_role:'admin'},()=>one(`select count(*)::int n from ${t}`))).n===0));
 ok(`authenticated non-dev cannot insert into ${t}`,await denied('authenticated',{khi_role:'admin'},t==='announcements'
  ?`insert into announcements(branch_id,title,body,created_by) values (1,'Hack','X','admin:x')`
  :`insert into branch_budgets(branch_id,budget_year,category,amount,updated_by) values (1,2026,'Other',1,'admin:x')`));
}
await as('authenticated',{khi_role:'developer'},async()=>{
 await db.exec(`insert into announcements(branch_id,title,body,created_by) values (null,'Dev Notice','Created via RLS dev claim','developer:timothy')`);
});
ok('developer (RLS khi_role=developer) can read/write announcements and budgets',
 ((await as('authenticated',{khi_role:'developer'},()=>one(`select count(*)::int n from announcements`))).n===4)
 &&((await as('authenticated',{khi_role:'developer'},()=>one(`select count(*)::int n from branch_budgets`))).n===3));

console.log(fails?`\n${fails} FAILED`:'\nAll v3 SQL & RLS rules verified in a real Postgres engine');
process.exit(fails?1:0);
