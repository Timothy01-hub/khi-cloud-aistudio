// v4 features: Africa's Talking SMS (feature.sms promoted from stub.sms, staff.phone, member OTP, sms_log RLS) in PGlite Postgres
import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const db=new PGlite();let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const q=async(sql,p)=>(await db.query(sql,p)).rows;const one=async(sql,p)=>(await q(sql,p))[0];
const as=async(role,claims,fn)=>{await db.query(`select set_config('request.jwt.claims',$1,false)`,[claims?JSON.stringify(claims):'']);await db.exec(`set role ${role}`);try{return await fn()}finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claims','',false)`)}};
const denied=async(role,claims,sql)=>as(role,claims,async()=>{try{await db.exec(sql);return false}catch(e){return /permission denied|row-level security|not found|only the super admin|violates|duplicate key|invalid otp role/i.test(e.message)}});

await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;
 alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on functions to service_role; alter default privileges in schema public grant all on sequences to service_role;
 create function extensions.gen_salt(t text) returns text language sql as $$ select 'S' $$;
 create function extensions.crypt(p text,s text) returns text language sql as $$ select 'h:'||md5(p) $$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;`);

for(const f of ['schema','auth','birthdays','departments','staff','hierarchy','dev','v2','v3']){
 await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8').replace(/create extension[^;]*;/i,''));
}

// Seed an existing override for stub.sms before v4.sql runs to verify migration
await db.exec(`insert into feature_flags(key,unit_id,enabled) values ('stub.sms',1,true)`);
await db.exec(fs.readFileSync('supabase/v4.sql','utf8'));
await db.exec(fs.readFileSync('supabase/v4.sql','utf8'));
ok('v4.sql runs cleanly after v3.sql and is idempotent',true);

// 1. stub.sms promoted to feature.sms (OFF by default globally, stub.sms removed, unit flag migrated)
const oldStub=await one(`select * from feature_catalog where key='stub.sms'`);
const newCat=await one(`select * from feature_catalog where key='feature.sms'`);
const featsGlobal=await as('service_role',null,()=>one(`select my_features(null) m`));
const featsUnit1=await as('service_role',null,()=>one(`select my_features(1) m`));
ok('stub.sms promoted to feature.sms (OFF by default) and stub row deleted',
 !oldStub&&newCat?.kind==='feature'&&newCat?.default_enabled===false&&featsGlobal.m['feature.sms']===false&&featsUnit1.m['feature.sms']===true);

// 2. staff.phone and dev_accounts.phone columns exist and store numbers
const adm=await one(`select id from staff where role='superadmin' limit 1`);
await db.exec(`update staff set phone='+260971112233' where id=${adm.id}`);
const stRow=await one(`select phone from staff where id=${adm.id}`);
ok('staff.phone column exists and stores normalised phone numbers',stRow?.phone==='+260971112233');

// 3. member role allowed in login_otps / create_login_otp / verify_login_otp
await db.exec(`select member_register(1,'SMS Member','0979998877','Password123','Lusaka','1995-05-05')`);
const mem=await one(`select id from members where phone='0979998877'`);
const tok=(await one(`select create_login_otp('member',${mem.id},'123456',600) t`)).t;
const bad1=await one(`select * from verify_login_otp('${tok}','000000')`);
const good=await one(`select * from verify_login_otp('${tok}','123456')`);
const reuse=await one(`select * from verify_login_otp('${tok}','123456')`);
ok('member OTP challenge created, fails on wrong code, succeeds once, and rejects reuse',
 !bad1.ok&&good.ok&&good.role==='member'&&Number(good.user_id)===Number(mem.id)&&!reuse.ok);

const tok2=(await one(`select create_login_otp('member',${mem.id},'654321',600) t`)).t;
for(let i=0;i<5;i++)await one(`select * from verify_login_otp('${tok2}','111111')`);
const killed=await one(`select * from verify_login_otp('${tok2}','654321')`);
ok('member OTP challenge is killed after 5 wrong attempts',!killed.ok);

// 4. sms_log table stores status & cost, and enforces dev-only RLS
ok('anon has NO access to sms_log',
 await denied('anon',null,`select * from sms_log`)
 &&await denied('anon',null,`insert into sms_log(kind,to_phone,message,status,ok) values ('test','+260971234567','hi','Success',true)`));
ok('authenticated non-dev sees 0 rows and cannot write sms_log',
 ((await as('authenticated',{khi_role:'admin'},()=>one(`select count(*)::int n from sms_log`))).n===0)
 &&await denied('authenticated',{khi_role:'admin'},`insert into sms_log(kind,to_phone,message,status,ok) values ('test','+260971234567','hi','Success',true)`));

await as('authenticated',{khi_role:'developer'},async()=>{
 await db.exec(`insert into sms_log(branch_id,kind,to_phone,message,status,status_code,cost,message_id,ok,created_by)
  values (1,'test','+260971234567','Test msg','Success',101,'ZMW 0.1500','ATXid_1',true,'developer:timothy')`);
});
const devRows=await as('authenticated',{khi_role:'developer'},()=>q(`select to_phone,status,cost,ok from sms_log`));
ok('developer (RLS khi_role=developer) reads & writes sms_log with status and cost',
 devRows.length===1&&devRows[0].to_phone==='+260971234567'&&devRows[0].status==='Success'&&devRows[0].cost==='ZMW 0.1500'&&devRows[0].ok===true);

console.log(fails?`\n${fails} FAILED`:'\nAll v4 SQL & RLS rules verified in a real Postgres engine');
process.exit(fails?1:0);
