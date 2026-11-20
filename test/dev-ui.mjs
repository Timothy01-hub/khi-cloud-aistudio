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

let sc=boot('/secretary/');
await sc.until(()=>sc.t().includes('Secretary Sign in'));
sc.fill('Username','nipa1');sc.fill('Password','demo1234');sc.submit(sc.form('Secretary Sign in'));
ok('branding (secretary): NIPA FELLOWSHIP · KHI CITY CENTRE beside logo',await sc.until(()=>sc.q('header')?.textContent.includes('NIPA FELLOWSHIP · KHI CITY CENTRE')));

let ad=boot('/admin/');
await ad.until(()=>ad.t().includes('Admin Sign in'));
ad.fill('Username','nipaadmin');ad.fill('Password','demo1234');ad.submit(ad.form('Admin Sign in'));
ok('branding (admin): NIPA FELLOWSHIP · KHI CITY CENTRE beside logo',await ad.until(()=>ad.q('header')?.textContent.includes('NIPA FELLOWSHIP · KHI CITY CENTRE')));

let sa=boot('/superadmin/');
await sa.until(()=>sa.t().includes('Super Admin Sign in'));
sa.fill('Username','super');sa.fill('Password','demo1234');sa.submit(sa.form('Super Admin Sign in'));
ok('branding (superadmin): KINGDOM HERALDS INTERNATIONAL CHURCH only',await sa.until(()=>{const h=sa.q('header div')?.textContent||'';return h==='KINGDOM HERALDS INTERNATIONAL CHURCH'}));

/* ---------- 2. Hidden /dev/ & 404 invisibility ---------- */
let l=boot('/');
await l.until(()=>l.t().includes('Kingdom Heralds'));
ok('launcher: /dev/ is hidden from app launcher',!l.t().toLowerCase().includes('developer'));

const bad=async(p,b)=>api(p,b).then(()=>false,e=>e.status===404);
ok('unauth: /api/dev/me returns 404',await bad('/api/dev/me'));
ok('unauth: /api/dev/flags returns 404',await bad('/api/dev/flags'));
await api('/api/staff/login',{username:'super',password:'demo1234',app:'superadmin'});
ok('superadmin: /api/dev/gate returns 404',await bad('/api/dev/gate'));
ok('superadmin: /api/dev/users returns 404',await bad('/api/dev/users'));
await api('/api/staff/logout',{});

/* ---------- 3. Developer UI (/dev/): Flags, Stubs, CRUD, Impersonation ---------- */
let dv=boot('/dev/');
ok('/dev/: Developer Sign in opens when no other role signed in',await dv.until(()=>dv.t().includes('Developer Sign in')));
dv.fill('Username','timothy');dv.fill('Password','demo1234');dv.submit(dv.form('Developer Sign in'));
ok('/dev/: Timothy logs into Developer console with all 4 tabs',await dv.until(()=>dv.t().includes('Developer · Timothy')&&['Flags & Stubs','Users & Roles','Settings & Units','Data'].every(x=>dv.btn(x))));
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
await api('/api/dev/login',{username:'timothy',password:'demo1234'});
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
await api('/api/staff/login',{username:'sec1',password:'demo1234',app:'secretary'});
ok('flag: secretary.menu.reports OFF disables reports endpoint',await api('/api/staff/report?kind=offerings&from=2020-01-01&to=2030-01-01').then(()=>false,e=>e.status===403));

await api('/api/dev/flags',{key:'admin.menu.audit',unit_id:null,enabled:false});
await api('/api/staff/login',{username:'super',password:'demo1234',app:'superadmin'});
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

ok('no browser errors during /dev/ & branding run',errors.length===0);
if(errors.length)console.log(errors.slice(0,3));
console.log(fails?`\n${fails} FAILED`:'\nAll /dev/, branding, and feature-flag checks passed');
process.exit(fails?1:0);
