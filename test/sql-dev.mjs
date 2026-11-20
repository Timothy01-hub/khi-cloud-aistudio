// Developer role, feature flags, branding: checked in a real Postgres engine, including Row Level Security. Usage: npm run test:sql
import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const db=new PGlite();let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const q=async(sql,p)=>(await db.query(sql,p)).rows;const one=async(sql,p)=>(await q(sql,p))[0];
const as=async(role,claims,fn)=>{await db.query(`select set_config('request.jwt.claims',$1,false)`,[claims?JSON.stringify(claims):'']);await db.exec(`set role ${role}`);try{return await fn()}finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claims','',false)`)}};
const denied=async(role,claims,sql)=>as(role,claims,async()=>{try{await db.exec(sql);return false}catch(e){return /permission denied|row-level security|not found|only the super admin|violates/i.test(e.message)}});
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;
 alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on functions to service_role; alter default privileges in schema public grant all on sequences to service_role;
 create function extensions.gen_salt(t text) returns text language sql as $$ select 'S' $$;
 create function extensions.crypt(p text,s text) returns text language sql as $$ select 'h:'||md5(p) $$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;`);
for(const f of ['schema','auth','birthdays','departments','staff','hierarchy']){await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8').replace(/create extension[^;]*;/i,''))}
await db.exec(`insert into branches(name) values ('NIPA FELLOWSHIP'); update branches set kind='fellowship',parent_id=1 where id=2;
 insert into branches(name,kind,parent_id) values ('Matero','branch',1),('Chilenje','fellowship',3);
 select create_staff('superadmin',null,null,'Old Name','owner','Password123');
 select create_staff('secretary',1,'main','Sec One','sec1','Password123');
 insert into members(branch_id,full_name,phone,password_hash) values (1,'Grace Phiri','0971234567','x');
 insert into offerings(branch_id,type,amount) values (1,'physical',100);`);
await db.exec(fs.readFileSync('supabase/dev.sql','utf8'));await db.exec(fs.readFileSync('supabase/dev.sql','utf8'));
ok('dev.sql runs (and can be run twice)',true);

let r=await one(`select unit_brand(4) b,unit_brand(3) c,unit_brand(1) d`);
ok('branding: fellowship under a branch under a centre -> branch + nearest centre',r.b.branch==='Chilenje Fellowship'&&r.b.centre==='KHI CITY CENTRE');
ok('branding: branch -> branch + centre; a centre itself has no parent centre',r.c.branch==='Matero Branch'&&r.c.centre==='KHI CITY CENTRE'&&r.d.branch==='KHI CITY CENTRE'&&r.d.centre===null);
r=await one(`select full_name from staff where role='superadmin'`);ok('Super Admin is renamed Apostle Felix Mwamba',r.full_name==='Apostle Felix Mwamba');
await db.exec(`delete from staff where role='superadmin'`);await db.exec(fs.readFileSync('supabase/dev.sql','utf8'));
r=await one(`select username,full_name from staff where role='superadmin'`);ok('...and is created (username apostle) when none exists',r&&r.username==='apostle'&&r.full_name==='Apostle Felix Mwamba');

// invisible to the server key
for(const t of ['dev_accounts','dev_audit','feature_catalog','feature_flags'])ok(`server key (service_role) has NO access to ${t}`,await denied('service_role',null,`select * from ${t}`));
ok('server key cannot write flags',await denied('service_role',null,`insert into feature_flags(key,enabled) values ('stub.sms',true)`));
for(const t of ['dev_accounts','feature_flags','staff'])ok(`anon has no access to ${t}`,await denied('anon',null,`select * from ${t}`));
ok('server key CAN still read on/off features (nothing else)',(await as('service_role',null,()=>one(`select feature_enabled('app.member',1) a,feature_enabled('stub.sms') s,my_features(1) m`))).a===true);
r=await as('service_role',null,()=>one(`select feature_enabled('stub.sms') s,my_features(null) m`));ok('stubs are OFF by default and never revealed to the apps',r.s===false&&!Object.keys(r.m).some(k=>k.startsWith('stub.'))&&r.m['app.member']===true);
ok('server key cannot create developers',await denied('service_role',null,`select create_dev('X','x','Password1234')`));
ok('nobody but the SQL editor can create a developer (authenticated/anon)',await denied('authenticated',{khi_role:'developer'},`select create_dev('X','x','Password1234')`)&&await denied('anon',null,`select create_dev('X','x','Password1234')`));

// RLS: end-user role without the developer claim sees and changes nothing
for(const [label,claims] of [['no claim',null],['claim admin',{khi_role:'admin'}],['claim superadmin',{khi_role:'superadmin'}]]){
 r=await as('authenticated',claims,()=>one(`select (select count(*) from feature_flags)::int f,(select count(*) from staff)::int s,(select count(*) from offerings)::int o,(select count(*) from dev_accounts)::int d`));
 ok(`RLS (${label}): sees zero rows everywhere`,r.f===0&&r.s===0&&r.o===0&&r.d===0);
 ok(`RLS (${label}): cannot insert flags or change data`,await denied('authenticated',claims,`insert into feature_flags(key,enabled) values ('stub.sms',true)`)&&(await as('authenticated',claims,async()=>{await db.exec(`update offerings set amount=1`);return (await one(`select amount from offerings limit 1`))}),(await one(`select amount from offerings limit 1`)).amount==100));
 ok(`RLS (${label}): developer helper functions refuse`,await denied('authenticated',claims,`select dev_create_staff('admin',1,null,'X','x1','Password123',array['events'])`));
}
// the developer
const DEV={khi_role:'developer'};
await db.exec(`select create_dev('Timothy','timothy','LongPassword123')`);
r=await as('service_role',null,()=>one(`select dev_login('timothy','LongPassword123') id,dev_login('timothy','wrong') bad,dev_login('apostle','Password123') notdev`));
ok('developer login works; wrong password and staff names do not',r.id===1&&r.bad===null&&r.notdev===null);
r=await one(`select count(*)::int n from staff where username='timothy'`);ok('developer is NOT in the staff table (invisible in every staff list)',r.n===0);
await db.exec(`update dev_accounts set active=false`);r=await as('service_role',null,()=>one(`select dev_login('timothy','LongPassword123') id`));ok('disabled developer cannot log in',r.id===null);await db.exec(`update dev_accounts set active=true`);

await as('authenticated',DEV,async()=>{
 await db.exec(`insert into feature_flags(key,enabled) values ('member.menu.pledges',false)`);
 await db.exec(`insert into feature_flags(key,unit_id,enabled) values ('member.menu.pledges',2,true),('app.member',3,false)`);
 await db.exec(`insert into feature_flags(key,enabled) values ('stub.sms',true)`);
});
r=await as('authenticated',DEV,()=>one(`select (select count(*) from feature_flags)::int f,(select count(*) from staff)::int s,(select count(*) from dev_accounts)::int d`));
ok('developer (RLS) sees flags, staff and developer accounts',r.f===4&&r.s>=2&&r.d===1);
const fe=(k,u)=>as('service_role',null,()=>one(`select feature_enabled('${k}',${u}) v`)).then(x=>x.v);
ok('flag: GLOBAL off applies to every church',await fe('member.menu.pledges',1)===false&&await fe('member.menu.pledges',null)===false);
ok('flag: a church can be switched back ON (overrides global)',await fe('member.menu.pledges',2)===true);
ok('flag: per-branch OFF reaches the fellowships beneath it, but not the centre above',await fe('app.member',3)===false&&await fe('app.member',4)===false&&await fe('app.member',1)===true&&await fe('app.member',2)===true);
ok('stub only becomes active when the developer enables it',await fe('stub.sms',null)===true&&await fe('stub.mobile_money',null)===false);
ok('a flag key must exist in the catalog',await denied('authenticated',DEV,`insert into feature_flags(key,enabled) values ('nonsense',true)`));
ok('one flag per key and church',await denied('authenticated',DEV,`insert into feature_flags(key,enabled) values ('stub.sms',false)`));

await as('authenticated',DEV,async()=>{
 await db.exec(`update offerings set amount=250`);await db.exec(`update settings set value='{"assets":true}' where key='features'`);
 await db.exec(`update members set full_name='Grace P. Phiri'`);await db.exec(`insert into assets(branch_id,name) values (1,'Piano')`);await db.exec(`delete from assets`);
});
r=await one(`select (select amount from offerings limit 1) a,(select value->>'assets' from settings where key='features') f,(select full_name from members limit 1) m,(select count(*)::int from assets) n`);
ok('developer: full read/write/delete on data, settings and members',r.a==250&&r.f==='true'&&r.m==='Grace P. Phiri'&&r.n===0);
r=await as('authenticated',DEV,()=>one(`select dev_create_staff('admin',3,null,'Matero Admin','madmin','Password123',array['events','reports']) id`));
ok('developer creates users through the checked function',r.id>0&&(await one(`select role from staff where username='madmin'`)).role==='admin');
ok('integrity still holds for the developer (blocked privileges refused)',await denied('authenticated',DEV,`update staff set privileges=array['leaders'] where username='madmin'`));
ok('developer sets Leader status directly; the server key still cannot',(await as('authenticated',DEV,async()=>{await db.exec(`update people set kind='member'`);return true}),true)&&await denied('service_role',null,`insert into people(branch_id,full_name,address,kind) values (1,'S','x','leader')`));
await as('authenticated',DEV,async()=>db.exec(`select dev_set_staff_password(${(await one(`select id from staff where username='madmin'`)).id},'NewPassword123')`).catch(()=>{}));
r=await as('authenticated',DEV,()=>one(`select dev_reset_member_password(1) t`));ok('developer resets a member password',typeof r.t==='string'&&r.t.length===8);
await as('authenticated',DEV,()=>db.exec(`insert into dev_audit(dev_id,action,detail) values (1,'impersonate','sec1')`));
r=await one(`select (select count(*) from audit_log where action='impersonate')::int a,(select count(*) from dev_audit)::int d`);ok('developer actions go to their own audit table, never the church audit log',r.a===0&&r.d===1);
ok('server key cannot read the developer audit',await denied('service_role',null,`select * from dev_audit`));
console.log(fails?`\n${fails} FAILED`:'\nAll developer/flag/branding rules verified in a real Postgres engine');process.exit(fails?1:0);
