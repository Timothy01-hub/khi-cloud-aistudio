// UI + API tests for branding, hidden /dev/ role, feature flags, future stubs, CRUD, and impersonation. Usage: npm test
import {JSDOM} from 'jsdom';import {execFileSync} from 'child_process';import fs from 'fs';
execFileSync('node',['scripts/build-preview.mjs','test/.out/preview.html'],{stdio:'ignore'});
const html=fs.readFileSync('test/.out/preview.html','utf8');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const errors=[];

// Helper that shares one persistent window/mock backend per session OR fresh per open
function boot(hash){
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://preview.test/#'+hash,pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.confirm=()=>true;w.prompt=()=>'test';w.alert=()=>{};w.addEventListener('error',e=>errors.push(e.message));
 const t=()=>d.getElementById('root').textContent,qa=s=>[...d.querySelectorAll(s)],q=s=>d.querySelector(s);
 const until=async(f,ms=8000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(f())return true}catch{}await new Promise(r=>setTimeout(r,15))}return false};
 const set=(el,v)=>{const P=el.tagName==='SELECT'?w.HTMLSelectElement:el.tagName==='TEXTAREA'?w.HTMLTextAreaElement:w.HTMLInputElement;Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
 const field=(ph,scope=d)=>[...scope.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));
 const fill=(ph,v,scope)=>set(field(ph,scope),v);
 const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
 const btn=(txt,scope=d)=>[...scope.querySelectorAll('button,a')].find(e=>e.textContent.trim()===txt);
 const form=(txt,scope=d)=>[...scope.querySelectorAll('form')].find(f=>f.textContent.includes(txt));
 const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return{dom,w,d,t,qa,q,until,set,fill,field,click,btn,form,submit};
}

// Also test direct mockapi state persistence across apps in Node
import {build} from 'esbuild';
await build({entryPoints:['web/src/mockapi.js'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/mock-dev.mjs',logLevel:'silent'});
const {api}=await import('./.out/mock-dev.mjs');

/* ---------- 1. Branding & Super Admin Seed ---------- */
let m=boot('/member/');
await m.until(()=>m.t().includes('Member Sign in'));
m.fill('Phone number','0951234567');m.fill('Password','demo1234');m.submit(m.form('Member Sign in'));
ok('branding (member): NIPA FELLOWSHIP · KHI CITY CENTRE beside logo',await m.until(()=>m.q('header')?.textContent.includes('NIPA FELLOWSHIP · KHI CITY CENTRE')));

const finishOtp=async x=>{await x.until(()=>x.t().includes('Demo verification code:'));const code=x.t().match(/Demo verification code:\s*(\d{6})/)?.[1]||'';x.fill('6-digit verification code',code);x.submit(x.form('Verification'))};
const staffLogin=async(username,app)=>{const r=await api('/api/staff/login',{username,password:'demo1234',app});if(r?.otp_required)return api('/api/staff/otp',{challenge:r.challenge,code:r.demo_code});return r};
const devLogin=async(username='timothy')=>{const r=await api('/api/dev/login',{username,password:'demo1234'});if(r?.otp_required)return api('/api/dev/otp',{challenge:r.challenge,code:r.demo_code});return r};

let sc=boot('/secretary/');
await sc.until(()=>sc.t().includes('Secretary Sign in'));
sc.fill('Username','nipa1');sc.fill('Password','demo1234');sc.submit(sc.form('Secretary Sign in'));await finishOtp(sc);
ok('branding (secretary): NIPA FELLOWSHIP · KHI CITY CENTRE beside logo',await sc.until(()=>sc.q('header')?.textContent.includes('NIPA FELLOWSHIP · KHI CITY CENTRE')));

let ad=boot('/admin/');
await ad.until(()=>ad.t().includes('Admin Sign in'));
ad.fill('Username','nipaadmin');ad.fill('Password','demo1234');ad.submit(ad.form('Admin Sign in'));await finishOtp(ad);
ok('branding (admin): NIPA FELLOWSHIP · KHI CITY CENTRE beside logo',await ad.until(()=>ad.q('header')?.textContent.includes('NIPA FELLOWSHIP · KHI CITY CENTRE')));

let sa=boot('/superadmin/');
await sa.until(()=>sa.t().includes('Super Admin Sign in'));
sa.fill('Username','super');sa.fill('Password','demo1234');sa.submit(sa.form('Super Admin Sign in'));await finishOtp(sa);
ok('branding (superadmin): KINGDOM HERALDS INTERNATIONAL CHURCH only',await sa.until(()=>{const h=sa.q('header div')?.textContent||'';return h==='KINGDOM HERALDS INTERNATIONAL CHURCH'}));

/* ---------- 2. Hidden /dev/ & 404 invisibility ---------- */
let l=boot('/');
await l.until(()=>l.t().includes('Kingdom Heralds'));
ok('launcher: /dev/ is hidden from app launcher',!l.t().toLowerCase().includes('developer'));

const bad=async(p,b)=>api(p,b).then(()=>false,e=>e.status===404);
ok('unauth: /api/dev/me returns 404',await bad('/api/dev/me'));
ok('unauth: /api/dev/flags returns 404',await bad('/api/dev/flags'));
await staffLogin('super','superadmin');
ok('superadmin: /api/dev/gate returns 404',await bad('/api/dev/gate'));
ok('superadmin: /api/dev/users returns 404',await bad('/api/dev/users'));
await api('/api/staff/logout',{});

/* ---------- 3. Developer UI (/dev/): Flags, Stubs, CRUD, Impersonation ---------- */
let dv=boot('/dev/');
ok('/dev/: Developer Sign in opens when no other role signed in',await dv.until(()=>dv.t().includes('Developer Sign in')));
dv.fill('Username','timothy');dv.fill('Password','demo1234');dv.submit(dv.form('Developer Sign in'));await finishOtp(dv);
ok('/dev/: Timothy logs into Developer console with all tabs',await dv.until(()=>dv.t().includes('Developer · Timothy')&&['Flags & Stubs','Users & Roles','Settings & Units','Data'].every(x=>dv.btn(x))));
ok('/dev/: future stubs are listed and OFF by default',dv.t().includes('SMS notifications')&&dv.t().includes('Mobile-money payments')&&dv.t().includes('Backups and data export')&&dv.t().includes('Multi-language')&&dv.t().includes('API keys')&&dv.t().includes('Payments reports'));

// Toggle a stub ON via UI
const smsRow=dv.qa('tr').find(r=>r.textContent.includes('SMS notifications'));
dv.click(dv.btn('ON',smsRow));
ok('/dev/: stub.sms switched ON via UI',await dv.until(()=>dv.t().includes('stub.sms set to ON')));

// Toggle member.menu.pledges OFF globally via UI
const plRow=dv.qa('tr').find(r=>r.textContent.includes('Member menu: Pledges'));
dv.click(dv.btn('OFF',plRow));
ok('/dev/: member.menu.pledges switched OFF globally',await dv.until(()=>dv.t().includes('member.menu.pledges set to OFF')));

// Users & Roles tab: create Leader directly, impersonate
dv.click(dv.btn('Users & Roles'));
await dv.until(()=>dv.t().includes('People & Leaders'));
ok('/dev/: Super Admin seeded as Apostle Felix Mwamba',dv.t().includes('Apostle Felix Mwamba'));
const pf=dv.form('Add person / Leader');
dv.set(pf.querySelector('select'),'1');dv.fill('Full name','Direct Leader',pf);dv.fill('Address','Lusaka',pf);dv.submit(pf);
ok('/dev/: developer adds Leader directly',await dv.until(()=>dv.t().includes('Person added.')&&dv.t().includes('Direct Leader')));

// Settings & Units tab
dv.click(dv.btn('Settings & Units'));
ok('/dev/: Settings & Units CRUD loads',await dv.until(()=>dv.t().includes('Settings CRUD')&&dv.t().includes('Church units CRUD')));

// Data tab
dv.click(dv.btn('Data'));
ok('/dev/: Data CRUD loads offerings + dev_audit',await dv.until(()=>dv.t().includes('Data CRUD')&&dv.t().includes('offerings')));
dv.set(dv.q('select'),'dev_audit');
ok('/dev/: developer audit shows actions',await dv.until(()=>dv.t().includes('flag_set')&&dv.t().includes('dev_create_person')));

/* ---------- 4. Feature flags actually hide/disable features across apps (API + UI) ---------- */
await devLogin('timothy');
// Verify stub never leaked to public /api/features
const pubFeats=await api('/api/features');
ok('stubs never revealed in /api/features',!Object.keys(pubFeats).some(k=>k.startsWith('stub.')));

// Global OFF -> override ON for NIPA FELLOWSHIP (id=2)
await api('/api/dev/flags',{key:'member.menu.pledges',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'member.menu.pledges',unit_id:2,enabled:true});
await api('/api/member/login',{phone:'0971234567',password:'demo1234'});
const home1=await api('/api/member/home');
ok('flag: global OFF hides member.menu.pledges at City Centre',home1.features['member.menu.pledges']===false);
ok('flag: global OFF blocks /api/member/pledge',await api('/api/member/pledge',{program:1,amount:10}).then(()=>false,e=>e.status===403));

await api('/api/member/login',{phone:'0951234567',password:'demo1234'});
const home2=await api('/api/member/home');
ok('flag: unit override ON restores member.menu.pledges at NIPA',home2.features['member.menu.pledges']===true);

// feature.self_checkin OFF + feature.departments OFF
await api('/api/dev/flags',{key:'feature.self_checkin',unit_id:null,enabled:false});
ok('flag: self_checkin OFF hides check-in services and blocks check-in',(await api('/api/member/home')).services.length===0&&await api('/api/member/checkin',{id:1}).then(()=>false,e=>e.status===403));
await api('/api/dev/flags',{key:'feature.departments',unit_id:null,enabled:false});
ok('flag: feature.departments OFF empties departments list',(await api('/api/departments')).length===0);

// secretary.menu.reports OFF + admin.menu.audit OFF
await api('/api/dev/flags',{key:'secretary.menu.reports',unit_id:null,enabled:false});
await staffLogin('sec1','secretary');
ok('flag: secretary.menu.reports OFF disables reports endpoint',await api('/api/staff/report?kind=offerings&from=2020-01-01&to=2030-01-01').then(()=>false,e=>e.status===403));

await devLogin('timothy');
await api('/api/dev/flags',{key:'admin.menu.audit',unit_id:null,enabled:false});
await staffLogin('super','superadmin');
const admMe=await api('/api/admin/me');
ok('flag: admin.menu.audit OFF hides audit tab and blocks endpoint',!admMe.tabs.includes('audit')&&await api('/api/admin/audit').then(()=>false,e=>e.status===403));
ok('branding: superadmin /api/admin/me returns KINGDOM HERALDS INTERNATIONAL CHURCH',admMe.brand==='KINGDOM HERALDS INTERNATIONAL CHURCH');

// Impersonate via API + check dev_audit vs audit_log
const imp=await api('/api/dev/impersonate',{kind:'staff',id:2});
ok('impersonate: redirects to /secretary/home and signs in sec1',imp.redirect==='/secretary/home'&&(await api('/api/staff/home')).me.name==='Mary Banda');
const dAudit=(await api('/api/dev/data?table=dev_audit')).rows;
const cAudit=(await api('/api/dev/data?table=audit_log')).rows;
ok('impersonate: logged in dev_audit, never church audit_log',dAudit.some(r=>r.action==='impersonate')&&!cAudit.some(r=>r.action==='impersonate'));

// app.member OFF blocks member login
await api('/api/dev/flags',{key:'app.member',unit_id:null,enabled:false});
ok('flag: app.member OFF blocks member login',await api('/api/member/login',{phone:'0971234567',password:'demo1234'}).then(()=>false,e=>e.status===403));

/* ---------- 5. Developer Church powers (Super Admin + scoped unit Admin) ---------- */
// Turn OFF admin/superadmin apps, menu flags, and assets setting — developer must still have ALL powers
await devLogin('timothy');
await api('/api/dev/flags',{key:'app.superadmin',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'app.admin',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'admin.menu.events',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'admin.menu.assets',unit_id:null,enabled:false});
await api('/api/admin/profile',{feature:'assets',on:false});

const devSuperMe=await api('/api/admin/me');
const ALL_TABS=['overview','units','admins','leaders','accounts','members','events','programs','attendance','reports','assets','audit','profile'];
ok('dev admin (whole church): returns superadmin role with all 13 tabs despite disabled flags/assets',devSuperMe.role==='superadmin'&&ALL_TABS.every(x=>devSuperMe.tabs.includes(x)));

const [dOv,dAu,dAs,dLd,dUn,dAd,dPr]=await Promise.all([
 api('/api/admin/overview'),api('/api/admin/audit'),api('/api/admin/assets'),
 api('/api/admin/leaders'),api('/api/admin/fellowships'),api('/api/admin/admins'),api('/api/admin/profile')
]);
ok('dev admin (whole church): can access all superadmin & admin endpoints',dOv.rows.length>=2&&Array.isArray(dAu.rows)&&Array.isArray(dAs.rows)&&Array.isArray(dLd.people)&&Array.isArray(dUn)&&Array.isArray(dAd.admins)&&!!dPr.profile);

// Mutate as developer at whole-church scope and confirm audit goes to dev_audit, not audit_log / Felix Mwamba
const cAuditBefore=(await api('/api/dev/data?table=audit_log')).rows.length;
await api('/api/admin/event',{branch:'',title:'Dev Super Event',date:'2026-08-01',location:'City Centre',description:'Whole church'});
const dAuditAfter=(await api('/api/dev/data?table=dev_audit')).rows;
const cAuditAfter=(await api('/api/dev/data?table=audit_log')).rows;
ok('dev admin: mutations log to dev_audit as developer, never audit_log or Felix Mwamba',
 dAuditAfter.some(r=>r.action==='admin_add_event'&&String(r.detail).includes('Dev Super Event'))
 &&cAuditAfter.length===cAuditBefore
 &&!cAuditAfter.some(r=>String(r.detail||'').includes('Dev Super Event')||String(r.actor||'').includes('Felix')));

// Scoped unit_id=2 (NIPA FELLOWSHIP): acts as Admin of NIPA with all privileges, unit scope enforced
const devUnitMe=await api('/api/admin/me?unit_id=2');
const UNIT_TABS=['overview','accounts','members','events','programs','attendance','reports','assets','audit'];
ok('dev admin (unit_id=2): returns admin role scoped to NIPA FELLOWSHIP with all 9 unit admin tabs',
 devUnitMe.role==='admin'&&devUnitMe.brand==='NIPA FELLOWSHIP · KHI CITY CENTRE'&&UNIT_TABS.every(x=>devUnitMe.tabs.includes(x))&&!devUnitMe.tabs.includes('units')&&!devUnitMe.tabs.includes('leaders'));
const devUnitOv=await api('/api/admin/overview?unit_id=2');
ok('dev admin (unit_id=2): overview scoped to NIPA only',devUnitOv.rows.length===1&&devUnitOv.rows[0].id===2);
ok('dev admin (unit_id=2): superadmin-only routes blocked at unit scope',
 await api('/api/admin/leaders?unit_id=2').then(()=>false,e=>e.status===403)
 &&await api('/api/admin/fellowships?unit_id=2').then(()=>false,e=>e.status===403));
ok('dev admin (unit_id=2): unit scope enforced on mutations',
 await api('/api/admin/event?unit_id=2',{branch:'',title:'Blocked Global',date:'2026-08-02',location:'Lusaka'}).then(()=>false,e=>e.status===400)
 &&await api('/api/admin/event?unit_id=2',{branch:1,title:'Blocked Other',date:'2026-08-02',location:'Lusaka'}).then(()=>false,e=>e.status===403));
await api('/api/admin/event?unit_id=2',{branch:2,title:'Dev Nipa Event',date:'2026-08-03',location:'NIPA'});
ok('dev admin (unit_id=2): unit-scoped mutation succeeds and logs to dev_audit',
 (await api('/api/dev/data?table=dev_audit')).rows.some(r=>r.action==='admin_add_event'&&String(r.detail).includes('Dev Nipa Event')));

// Developer UI: Church tab with scope picker and admin.jsx tabs
let dvc=boot('/dev/');
await dvc.until(()=>dvc.t().includes('Developer Sign in'));
dvc.fill('Username','timothy');dvc.fill('Password','demo1234');dvc.submit(dvc.form('Developer Sign in'));await finishOtp(dvc);
await dvc.until(()=>dvc.btn('Church'));
dvc.click(dvc.btn('Church'));
ok('/dev/ UI: Church tab renders scope picker and all 13+ admin tabs',
 await dvc.until(()=>dvc.t().includes('Whole church (Super Admin)')&&['Overview','Units','Admins','Leaders','Accounts','Members','Events','Programs','Expenses','Approvals','Attendance','Reports','Assets','Audit log','Church profile'].every(x=>dvc.btn(x))));
dvc.click(dvc.btn('Units'));
ok('/dev/ UI: Church -> Units tab reuses admin.jsx Units view',await dvc.until(()=>dvc.t().includes('Add a centre, branch or fellowship')));
const scopeSel=dvc.qa('select').find(s=>[...s.options].some(o=>o.textContent.includes('Whole church (Super Admin)')));
dvc.set(scopeSel,'2');
ok('/dev/ UI: switching scope to NIPA FELLOWSHIP acts as unit Admin and hides Super Admin tabs',
 await dvc.until(()=>dvc.t().includes('Acting as Admin of NIPA FELLOWSHIP')&&!dvc.btn('Units')&&!dvc.btn('Leaders')&&!!dvc.btn('Audit log')));

// Re-enable apps & confirm Super Admin and Admin still get 404 on /dev/ and /api/dev/* and cannot escalate via unit_id
await devLogin('timothy');
await api('/api/dev/flags',{key:'app.superadmin',unit_id:null,enabled:true});
await api('/api/dev/flags',{key:'app.admin',unit_id:null,enabled:true});
await api('/api/dev/logout',{});

await staffLogin('super','superadmin');
ok('superadmin: /api/dev/* still returns 404',await bad('/api/dev/gate')&&await bad('/api/dev/me')&&await bad('/api/dev/flags')&&await bad('/api/dev/users'));
await staffLogin('nipaadmin','admin');
ok('admin: /api/dev/* still returns 404',await bad('/api/dev/gate')&&await bad('/api/dev/me')&&await bad('/api/dev/flags')&&await bad('/api/dev/users'));
const nipaOv=await api('/api/admin/overview?unit_id=1');
ok('admin: passing ?unit_id=1 does NOT escalate scope',nipaOv.rows.length===1&&nipaOv.rows[0].id===2);
await api('/api/staff/logout',{});

ok('no browser errors during /dev/ & branding run',errors.length===0);
if(errors.length)console.log(errors.slice(0,3));
console.log(fails?`\n${fails} FAILED`:'\nAll /dev/, branding, and feature-flag checks passed');
process.exit(fails?1:0);
