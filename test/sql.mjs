// Runs the real SQL files in a real Postgres engine (PGlite) and checks the rules. Usage: npm i --no-save @electric-sql/pglite && node test/sql.mjs
import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const db=new PGlite();let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const rejects=async(sql,part)=>{try{await db.exec(sql);return false}catch(e){return part?String(e.message).toLowerCase().includes(part.toLowerCase()):true}};
const one=async(sql)=>(await db.query(sql)).rows[0];
await db.exec(`create role anon; create role authenticated; create schema extensions;
 create function extensions.gen_salt(t text) returns text language sql as $$ select 'salt' $$;
 create function extensions.crypt(p text,s text) returns text language sql as $$ select md5(p||s) $$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;`);
for(const f of ['schema','auth','birthdays','departments','staff']){let s=fs.readFileSync(`supabase/${f}.sql`,'utf8').replace(/create extension[^;]*;/i,'');await db.exec(s)}
// before the upgrade: the old-style Super Admin, a secretary and a fellowship
await db.exec(`insert into branches(name) values ('NIPA FELLOWSHIP')`);
await db.exec(`select create_staff('superadmin',null,null,'Old Super','oldsuper','Password123')`);
await db.exec(`select create_staff('secretary',1,'main','Sec One','sec1','Password123')`);
await db.exec(fs.readFileSync('supabase/hierarchy.sql','utf8'));
ok('hierarchy.sql runs on top of the earlier files',true);

let r=await one(`select role,branch_id,array_length(privileges,1) n from staff where username='oldsuper'`);ok('old Super Admin became a church admin of the main church',r.role==='admin'&&r.branch_id===1&&r.n===9);
r=await one(`select kind,parent_id from branches where id=2`);ok('existing fellowship sits under the main church',r.kind==='fellowship'&&r.parent_id===1);
r=await one(`select unit_label('Lusaka','center') a,unit_label('KHI CITY CENTRE','center') b,unit_label('Matero','branch') c,unit_label('NIPA FELLOWSHIP','fellowship') d,unit_label('Kabwe','fellowship') e,unit_label('Ndola Center','center') f`);
ok('labels follow name + kind (Lusaka -> Lusaka Centre)',r.a==='Lusaka Centre'&&r.b==='KHI CITY CENTRE'&&r.c==='Matero Branch'&&r.d==='NIPA FELLOWSHIP'&&r.e==='Kabwe Fellowship'&&r.f==='Ndola Center');

await db.exec(`insert into branches(name,kind) values ('Lusaka','center'); insert into branches(name,kind,parent_id) values ('Matero','branch',3),('Chilenje','fellowship',4)`);
r=await one(`select unit_scope(3) s, unit_scope(4) t, unit_scope(5) u`);ok('scope = unit + everything beneath it',JSON.stringify(r.s.sort())==='[3,4,5]'&&JSON.stringify(r.t.sort())==='[4,5]'&&JSON.stringify(r.u)==='[5]');
ok('a unit cannot be moved under its own fellowship',await rejects(`update branches set parent_id=5 where id=3`,'cannot sit under'));

ok('admin with allowed privileges is accepted',!await rejects(`select create_staff('admin',3,null,'Lusaka Admin','ladmin','Password123',array['events','reports','accounts'])`));
for(const bad of ['units','admins','leaders','features','profile'])ok(`BLOCKED privilege "${bad}" can never be given to an admin`,await rejects(`select create_staff('admin',3,null,'X','x_${bad}','Password123',array['events','${bad}'])`));
ok('a secretary cannot carry privileges',await rejects(`select create_staff('secretary',3,'main','S','s9','Password123',array['events'])`));
ok('a Super Admin belongs to no unit',await rejects(`select create_staff('superadmin',3,null,'S','s8','Password123')`));
ok('new Super Admin is accepted',!await rejects(`select create_staff('superadmin',null,null,'Owner','owner','Password123')`));
ok('still only two secretaries per unit',await rejects(`select create_staff('secretary',1,'main','Dup','dup1','Password123')`));
ok('weak passwords refused',await rejects(`select create_staff('admin',3,null,'W','w1','short')`));

await db.exec(`insert into people(branch_id,full_name,address,kind) values (1,'Grace Phiri','Lusaka','member'),(1,'John Visitor','Lusaka','visitor')`);
ok('LEADER: direct update to leader is refused',await rejects(`update people set kind='leader' where full_name='Grace Phiri'`,'Only the Super Admin'));
ok('LEADER: direct insert as leader is refused',await rejects(`insert into people(branch_id,full_name,address,kind) values (1,'Sneaky','x','leader')`,'Only the Super Admin'));
r=await one(`select set_leader((select id from people where full_name='Grace Phiri'),true,'owner') m`);ok('LEADER: Super Admin function promotes a member',r.m==='Grace Phiri is now a Leader.');
r=await one(`select kind,leader_since is not null s from people where full_name='Grace Phiri'`);ok('person is now a Leader with a date',r.kind==='leader'&&r.s);
r=await one(`select set_leader((select id from people where full_name='John Visitor'),true,'owner') m`);ok('LEADER: a visitor can be promoted too',r.m.includes('is now a Leader'));
ok('LEADER: direct demotion is refused',await rejects(`update people set kind='member' where full_name='Grace Phiri'`,'Only the Super Admin'));
ok('LEADER: ordinary edits of a leader still work',!await rejects(`update people set address='Kabulonga' where full_name='Grace Phiri'`));
r=await one(`select set_leader((select id from people where full_name='Grace Phiri'),false,'owner') m`);ok('LEADER: Super Admin can remove leader status',r.m.includes('no longer a Leader'));
r=await one(`select count(*)::int n from audit_log where action in ('make_leader','remove_leader')`);ok('leader changes are written to the audit log',r.n===3);
ok('after the guard is closed, direct changes are refused again',await rejects(`update people set kind='leader' where full_name='Grace Phiri'`));

r=await one(`select value->>'assets' a from settings where key='features'`);ok('assets feature is OFF by default',r.a==='false');
r=await one(`select value->>'vision' v,value->>'founded' f from settings where key='profile'`);ok('profile seeded (vision, 2015)',r.v==='To reach all nations for Christ'&&r.f==='2015');
ok('asset needs a valid condition',await rejects(`insert into assets(branch_id,name,condition) values (1,'Sound desk','Broken')`));
ok('asset register accepts a valid item',!await rejects(`insert into assets(branch_id,name,category,quantity,value,condition) values (1,'Sound desk','Media',1,12000,'Good')`));
ok('public roles have no access to the new tables',await rejects(`set role anon; select * from assets`).finally(()=>db.exec('reset role')));
console.log(fails?`\n${fails} FAILED`:'\nAll database rules verified in a real Postgres engine');process.exit(fails?1:0);
