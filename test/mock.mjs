// Rules of the Super Admin layer, checked on the demo backend (the real database enforces the same rules: see test/sql.mjs). Usage: npm test
import {build} from 'esbuild';
await build({entryPoints:['web/src/mockapi.js'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/mock.mjs',logLevel:'silent'});
const {api}=await import('./.out/mock.mjs');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const bad=async(p,b,part,status)=>api(p,b).then(()=>false,e=>(!part||e.message.includes(part))&&(!status||e.status===status));
const login=(u,app)=>api('/api/staff/login',{username:u,password:'demo1234',app});
await login('nipaadmin','admin');
ok('limited admin: Leaders is Super Admin only',await bad('/api/admin/leaders',undefined,'Super Admin',403));
ok('limited admin: cannot promote anyone to Leader',await bad('/api/admin/leaders',{id:1,make:true},'Super Admin',403));
ok('limited admin: cannot create admins',await bad('/api/admin/admin',{a:'create'},'Super Admin',403));
ok('limited admin: cannot add centres/branches/fellowships',await bad('/api/admin/fellowships',{a:'add',name:'X'},'Super Admin',403));
ok('limited admin: cannot switch features or edit profile',await bad('/api/admin/profile',{feature:'assets',on:true},'Super Admin',403));
ok('limited admin: no Accounts / Members / Audit privilege',await bad('/api/admin/accounts',undefined,'permission',403)&&await bad('/api/admin/members',undefined,'permission',403)&&await bad('/api/admin/audit',undefined,'permission',403));
let me=await api('/api/admin/me');ok('limited admin: tabs follow privileges',JSON.stringify(me.tabs)==='["overview","events","attendance","reports"]');
let ov=await api('/api/admin/overview');ok('limited admin: sees only Nipa',ov.rows.length===1&&ov.rows[0].name==='NIPA FELLOWSHIP'&&ov.recent.every(r=>r.branch_id===2));
ok('limited admin: cannot publish an event for another church',await bad('/api/admin/event',{a:'add',title:'T',date:'2030-01-01',location:'x',branch:'1'},'outside your area',403));
ok('limited admin: cannot void entries (no privilege)',await bad('/api/admin/void',{id:1,reason:'x'},'permission',403));

await login('admin','admin');me=await api('/api/admin/me');
ok('city centre admin: tabs include Accounts, Members, Programs, Audit but no Super Admin tabs',['accounts','members','programs','audit'].every(t=>me.tabs.includes(t))&&!['units','admins','leaders','profile'].some(t=>me.tabs.includes(t)));
ov=await api('/api/admin/overview');ok('city centre admin: sees itself + everything under it (Matero, Nipa)',ov.rows.map(r=>r.name).sort().join()==='KHI CITY CENTRE,Matero Branch,NIPA FELLOWSHIP');
ok('admin: assets blocked while the feature is OFF',await bad('/api/admin/assets',undefined,'switched off',403));
ok('admin: cannot grant themselves anything',await bad('/api/admin/admins',undefined,'Super Admin',403));

await login('super','superadmin');me=await api('/api/admin/me');
ok('Super Admin: has every tab',['units','admins','leaders','accounts','members','events','programs','attendance','reports','audit','profile'].every(t=>me.tabs.includes(t)));
ok('Super Admin: sees all churches',(await api('/api/admin/overview')).rows.length===3);
let r=await api('/api/admin/fellowships',{a:'add',name:'Lusaka',kind:'center'});ok('new centre "Lusaka" is labelled "Lusaka Centre"',r.message==='Lusaka Centre added.');
r=await api('/api/admin/fellowships',{a:'add',name:'Kabwe',kind:'fellowship',parent:'1'});ok('fellowship label follows the kind',r.message==='Kabwe Fellowship added.');
ok('labels appear everywhere units are listed',(await api('/api/branches')).some(b=>b.label==='Lusaka Centre'));
ok('a unit cannot be placed under its own fellowship',await bad('/api/admin/fellowships',{a:'save',id:1,name:'KHI CITY CENTRE',kind:'center',parent:'3'},'cannot sit under'));
for(const k of ['units','admins','leaders','features','profile'])ok(`BLOCKED privilege "${k}" cannot be given to an admin`,await bad('/api/admin/admin',{a:'create',name:'N',username:'n_'+k,password:'Password1',branch:'3',privileges:['events',k]},'reserved for the Super Admin'));
ok('admin created with allowed privileges',(await api('/api/admin/admin',{a:'create',name:'Matero Admin',username:'materoadmin',password:'Password1',branch:'3',privileges:['events','reports']})).ok);
const adm=(await api('/api/admin/admins')).admins.find(a=>a.username==='materoadmin');
ok('privileges cannot later be raised to a blocked one',await bad('/api/admin/admin',{a:'privileges',id:adm.id,privileges:['events','leaders']},'reserved'));
ok('Super Admin: assets feature OFF -> ON',(await api('/api/admin/profile',{feature:'assets',on:true})).message.includes('ON'));
ok('assets tab appears once the feature is on',(await api('/api/admin/me')).tabs.includes('assets'));
ok('Super Admin adds an asset',(await api('/api/admin/assets',{a:'add',branch:'1',name:'Microphone',quantity:'2',value:'500',condition:'Good'})).ok);
ok('asset needs a valid condition',await bad('/api/admin/assets',{a:'add',branch:'1',name:'X',quantity:'1',condition:'Broken'},'condition'));
ok('profile: vision/mission cannot be empty',await bad('/api/admin/profile',{profile:{vision:'',mission:'m'}},'cannot be empty'));
ok('profile saved and served to members',(await api('/api/admin/profile',{profile:{vision:'New vision',mission:'New mission',founded:'2015',email:'a@b.c'}})).ok&&(await api('/api/about')).vision==='New vision');

// LEADER: only the Super Admin
r=await api('/api/admin/leaders?q=grace');ok('leaders: search finds a member',r.people[0].full_name==='Grace Phiri'&&r.people[0].kind==='member');
ok('Super Admin promotes a member to Leader',(await api('/api/admin/leaders',{id:1,make:true})).message==='Grace Phiri is now a Leader.');
ok('...and the person is shown as Leader',(await api('/api/admin/leaders?q=grace')).people[0].kind==='leader');
await login('sec1','secretary');
ok('secretary: cannot turn a Leader back into a member',await bad('/api/staff/att',{a:'convert',id:1},'Only a visitor'));
await api('/api/staff/att',{a:'add',name:'Sneaky Person',address:'x',phone:'',kind:'leader',s:1});
ok('secretary: adding someone as "leader" only makes a visitor',(await api('/api/staff/attendance?s=1&dq=Sneaky')).directory[0].kind==='visitor');
ok('secretary: cannot reach admin endpoints',await bad('/api/admin/leaders',undefined,'sign in',401));
await login('super','superadmin');
ok('Super Admin removes Leader status',(await api('/api/admin/leaders',{id:1,make:false})).message==='Grace Phiri is no longer a Leader.');
ok('audit log records leader changes + unit/admin creation',(a=>['make_leader','remove_leader','admin_add_unit','admin_create_admin'].every(x=>a.includes(x)))((await api('/api/admin/audit')).rows.map(r=>r.action)));
ok('rolled-up attendance covers every church',(await api('/api/admin/attendance')).summary.length===5);
console.log(fails?`\n${fails} FAILED`:'\nAll Super Admin rules hold');process.exit(fails?1:0);
