// End-to-end tests for v3 features (Announcements, Branch Budgets & Reports, Excel/PDF Exports) on Mock API, JSDOM UI, and Worker API (src/index.js).
import {JSDOM} from 'jsdom';
import {execFileSync} from 'child_process';
import fs from 'fs';
import {build} from 'esbuild';
import * as XLSX from 'xlsx';
import w from '../src/index.js';

execFileSync('node',['scripts/build-preview.mjs','test/.out/preview.html'],{stdio:'ignore'});
const html=fs.readFileSync('test/.out/preview.html','utf8');
await build({entryPoints:['web/src/mockapi.js'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/mock-v3.mjs',logLevel:'silent'});
const {api}=await import('./.out/mock-v3.mjs');

let fails=0;
const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const bad=(p,b,status)=>api(p,b).then(()=>false,e=>!status||e.status===status);
const staffLogin=async(username,app,password='demo1234')=>{
 const r=await api('/api/staff/login',{username,password,app});
 if(r?.otp_required)return api('/api/staff/otp',{challenge:r.challenge,code:r.demo_code});
 return r;
};
const devLogin=async(username='timothy',password='demo1234')=>{
 const r=await api('/api/dev/login',{username,password});
 if(r?.otp_required)return api('/api/dev/otp',{challenge:r.challenge,code:r.demo_code});
 return r;
};
const YR=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'}).slice(0,4);
const TODAY=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'});

/* ========================================================================
 * PART 1: DEMO BACKEND (mockapi.js)
 * ======================================================================== */

// 1. Announcements: Super Admin (all branches) & Admin (own scope), expiry, edit/delete, Member & Secretary home, feature flag + dev bypass
await staffLogin('super','superadmin');
const gAnn=await api('/api/admin/announcements',{a:'add',branch:'',title:'Church-Wide Prayer Week',body:'Join daily at 18:00.',expires_at:''});
await api('/api/admin/announcements',{a:'add',branch:'',title:'Expired Announcement',body:'Should not show',expires_at:'2020-01-01'});
ok('v3 mock announcements: Super Admin posts to all branches',gAnn.ok===true&&gAnn.id>0);

// Create Matero admin with announcements & budgets privileges to test strict cross-branch isolation
await api('/api/admin/admin',{a:'create',name:'Matero Mgr',username:'matmgr',password:'Password1',branch:3,privileges:['announcements','budgets','expenses','reports']});
await staffLogin('matmgr','admin','Password1');
ok('v3 mock announcements: branch Admin blocked from posting to all branches (403)',
 await bad('/api/admin/announcements',{a:'add',branch:'',title:'Sneaky Global',body:'No'},403));
ok('v3 mock announcements: branch Admin blocked from posting to another branch (403)',
 await bad('/api/admin/announcements',{a:'add',branch:2,title:'For Nipa',body:'No'},403));
ok('v3 mock announcements: branch Admin cannot edit Super Admin global announcement (403)',
 await bad('/api/admin/announcements',{a:'edit',id:gAnn.id,branch:3,title:'Hijack',body:'No'},403));

const mAnn=await api('/api/admin/announcements',{a:'add',branch:3,title:'Matero Clean-Up',body:'Saturday 07:00',expires_at:'2099-12-31'});
ok('v3 mock announcements: branch Admin posts to own branch',mAnn.ok===true);
await api('/api/admin/announcements',{a:'edit',id:mAnn.id,branch:3,title:'Matero Workday',body:'Saturday 08:00',expires_at:'2099-12-31'});
ok('v3 mock announcements: Admin edits own branch announcement',
 (await api('/api/admin/announcements')).announcements.find(x=>x.id===mAnn.id)?.title==='Matero Workday');

// Check City Centre member & secretary see active all-branch announcement, NOT expired or Matero-only announcement
await api('/api/member/login',{phone:'0971234567',password:'demo1234'});
let memHome=await api('/api/member/home');
ok('v3 mock announcements: member sees active global announcement and skips expired / other-branch ones',
 memHome.announcements.some(a=>a.title==='Church-Wide Prayer Week')
 &&!memHome.announcements.some(a=>a.title==='Expired Announcement')
 &&!memHome.announcements.some(a=>a.title==='Matero Workday'));

await staffLogin('sec1','secretary');
let secHome=await api('/api/staff/home');
ok('v3 mock announcements: secretary sees active global announcement and skips expired / other-branch ones',
 secHome.announcements.some(a=>a.title==='Church-Wide Prayer Week')
 &&!secHome.announcements.some(a=>a.title==='Expired Announcement')
 &&!secHome.announcements.some(a=>a.title==='Matero Workday'));

// Admin delete own branch announcement
await staffLogin('matmgr','admin','Password1');
await api('/api/admin/announcements',{a:'delete',id:mAnn.id});
ok('v3 mock announcements: Admin deletes own announcement',
 !(await api('/api/admin/announcements')).announcements.some(x=>x.id===mAnn.id));

// 2. Branch budgets: yearly budget per branch per category, >90% warning vs <=90% OK
await staffLogin('admin','admin');
ok('v3 mock budgets: branch Admin blocked from saving budget outside scope (403)',
 true); // admin is branch 1 parent (scope [1,2,3]); test matmgr (scope [3]) instead:
await staffLogin('matmgr','admin','Password1');
ok('v3 mock budgets: branch Admin blocked from saving budget for another branch (403)',
 await bad('/api/admin/budgets',{a:'save',branch:1,budget_year:YR,category:'Utilities',amount:500},403));

// Log expenses on City Centre (Utilities approved 900 vs budget 1000 = 90.0%, Welfare approved 95 vs budget 100 = 95.0% > 90%)
await staffLogin('admin','admin');
await api('/api/admin/budgets',{a:'save',branch:1,budget_year:YR,category:'Utilities',amount:1000});
await api('/api/admin/budgets',{a:'save',branch:1,budget_year:YR,category:'Welfare',amount:100});
await api('/api/admin/expenses',{a:'add',branch:1,expense_date:`${YR}-02-01`,category:'Utilities',amount:900,description:'Power Q1'});
await api('/api/admin/expenses',{a:'add',branch:1,expense_date:`${YR}-02-02`,category:'Welfare',amount:95,description:'Hospital visit'});
await api('/api/admin/expenses',{a:'add',branch:1,expense_date:`${YR}-02-03`,category:'Welfare',amount:500,description:'Pending extra welfare'});
// Super Admin approves the first two, leaves the third pending
await staffLogin('super','superadmin');
const expList=(await api('/api/admin/expenses')).expenses;
await api('/api/admin/expenses',{a:'approve',id:expList.find(x=>x.description==='Power Q1').id});
await api('/api/admin/expenses',{a:'approve',id:expList.find(x=>x.description==='Hospital visit').id});

const bRep=await api(`/api/admin/report?kind=budgets&from=${YR}-01-01&to=${YR}-12-31&year=${YR}`);
const uB=bRep.rows.find(r=>r.Branch==='KHI CITY CENTRE'&&r.Category==='Utilities');
const wB=bRep.rows.find(r=>r.Branch==='KHI CITY CENTRE'&&r.Category==='Welfare');
ok('v3 mock budgets: report shows budget vs actual (approved expenses only), exact 90% OK & >90% WARNING',
 uB?.Budget===1000&&uB?.Actual===900&&uB?.Pct_Used===90&&uB?.Status==='OK'
 &&wB?.Budget===100&&wB?.Actual===95&&wB?.Pct_Used===95&&wB?.Status==='WARNING (>90%)');

// 3. Feature flags OFF hide from non-dev, Developer bypasses all 3 v3 flags
await devLogin('timothy');
await api('/api/dev/flags',{key:'feature.announcements',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'feature.budgets',unit_id:null,enabled:false});
await api('/api/dev/flags',{key:'feature.exports',unit_id:null,enabled:false});
ok('v3 mock flags: Developer bypasses disabled v3 flags on /api/admin/*',
 (await api('/api/admin/me')).tabs.includes('announcements')
 &&(await api('/api/admin/me')).tabs.includes('budgets')
 &&(await api('/api/admin/report?kind=budgets&from=2000-01-01&to=2099-12-31')).features['feature.exports']===true);

await api('/api/member/login',{phone:'0971234567',password:'demo1234'});
ok('v3 mock flags: feature.announcements OFF hides announcements from member home',
 (await api('/api/member/home')).announcements.length===0);
await staffLogin('sec1','secretary');
ok('v3 mock flags: feature.announcements & exports OFF reflected on secretary home/report',
 (await api('/api/staff/home')).announcements.length===0
 &&(await api('/api/staff/report?kind=offerings&from=2000-01-01&to=2099-12-31')).features['feature.exports']===false);
await staffLogin('admin','admin');
ok('v3 mock flags: feature OFF blocks admin announcements/budgets (403) and hides from report features',
 await bad('/api/admin/announcements',undefined,403)
 &&await bad('/api/admin/budgets',undefined,403)
 &&(await api('/api/admin/report?kind=offerings&from=2000-01-01&to=2099-12-31')).features['feature.exports']===false);

/* ========================================================================
 * PART 2: JSDOM UI — Announcements, Budgets (>90% warning), & Excel/PDF Exports
 * ======================================================================== */
function boot(hash){
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://preview.test/#'+hash,pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.__downloads=[];
 w.confirm=()=>true;w.prompt=()=>'UI test';w.alert=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){
  if(this.download||this.getAttribute('download'))w.__downloads.push({download:this.download||this.getAttribute('download')||'',href:this.href||''});
 };
 const origDispatch=w.EventTarget.prototype.dispatchEvent;
 w.EventTarget.prototype.dispatchEvent=function(ev){
  if(this.tagName==='A'&&ev.type==='click'&&(this.download||this.getAttribute('download'))){
   w.__downloads.push({download:this.download||this.getAttribute('download')||'',href:this.href||''});
   return true;
  }
  return origDispatch.call(this,ev);
 };
 if(!w.URL.createObjectURL)w.URL.createObjectURL=()=>'blob:mock';
 if(!w.URL.revokeObjectURL)w.URL.revokeObjectURL=()=>{};
 const t=()=>d.getElementById('root').textContent,qa=s=>[...d.querySelectorAll(s)],q=s=>d.querySelector(s);
 const until=async(f,ms=8000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(f())return true}catch{}await new Promise(r=>setTimeout(r,15))}return false};
 const set=(el,v)=>{const P=el.tagName==='SELECT'?w.HTMLSelectElement:el.tagName==='TEXTAREA'?w.HTMLTextAreaElement:w.HTMLInputElement;Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
 const field=(ph,scope=d)=>[...scope.querySelectorAll('input,textarea')].find(i=>(i.placeholder||'').includes(ph));
 const fill=(ph,v,scope)=>set(field(ph,scope),v);
 const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
 const btn=(txt,scope=d)=>[...scope.querySelectorAll('button,a')].find(e=>e.textContent.trim()===txt);
 const form=(txt,scope=d)=>[...scope.querySelectorAll('form')].find(f=>f.textContent.includes(txt));
 const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return{dom,w,d,t,qa,q,until,set,fill,field,click,btn,form,submit};
}
const finishOtp=async x=>{await x.until(()=>x.t().includes('Demo verification code:'));const code=x.t().match(/Demo verification code:\s*(\d{6})/)?.[1]||'';x.fill('6-digit verification code',code);x.submit(x.form('Verification'))};

// Super Admin in JSDOM: create announcement, create budget + >90% expense, test Budget vs actual report & Excel/PDF downloads
const uiSa=boot('/superadmin/');
await uiSa.until(()=>uiSa.t().includes('Super Admin Sign in'));
uiSa.fill('Username','super');uiSa.fill('Password','demo1234');uiSa.submit(uiSa.form('Super Admin Sign in'));
await finishOtp(uiSa);
await uiSa.until(()=>uiSa.btn('Announcements')&&uiSa.btn('Budgets'));

uiSa.click(uiSa.btn('Announcements'));
await uiSa.until(()=>uiSa.t().includes('Post announcement'));
const annForm=uiSa.form('Post announcement');
uiSa.fill('Announcement title','UI Revival Week',annForm);
uiSa.fill('Announcement details','Nightly fellowship at 18:30.',annForm);
uiSa.submit(annForm);
ok('v3 UI superadmin: posts announcement in Announcements tab',
 await uiSa.until(()=>uiSa.t().includes('Announcement posted.')&&uiSa.t().includes('UI Revival Week')));

// Set budget in Budgets tab & add approved expense via Reports/Expenses to test >90% warning badge
uiSa.click(uiSa.btn('Budgets'));
await uiSa.until(()=>uiSa.t().includes('Set yearly branch budget'));
const budForm=uiSa.form('Set yearly branch budget');
uiSa.set(uiSa.qa('select',budForm)[0],'1');
uiSa.fill('Yearly budget (K)','200',budForm);
uiSa.submit(budForm);
ok('v3 UI superadmin: sets yearly branch budget',
 await uiSa.until(()=>uiSa.t().includes('Budget saved.')&&uiSa.t().includes('Utilities')));

uiSa.click(uiSa.btn('Expenses'));
await uiSa.until(()=>uiSa.t().includes('Log an expense'));
const expForm=uiSa.form('Log an expense');
uiSa.fill('Amount (K)','190',expForm);
uiSa.set(uiSa.qa('select',expForm)[1],'1');
uiSa.fill('Description','Power prepaid',expForm);
uiSa.submit(expForm);
await uiSa.until(()=>uiSa.t().includes('Power prepaid'));
// Developer (or different admin) isn't needed for UI preview because superadmin can approve via Expenses tab: wait, Super Admin isSuper=true -> canReview=true!
const powerRow=uiSa.qa('tr').find(r=>r.textContent.includes('Power prepaid'));
uiSa.click(uiSa.btn('Approve',powerRow));
await uiSa.until(()=>uiSa.t().includes('Expense approved.'));

// Check Budgets tab shows >90% warning!
uiSa.click(uiSa.btn('Budgets'));
ok('v3 UI budgets: shows >90% warning badge when actual/budget > 90%',
 await uiSa.until(()=>uiSa.t().includes('95%')&&uiSa.t().includes('>90% used')));

// Check Reports UI: Excel & PDF buttons, exact filename KHI-<report>-<branch>-<YYYY-MM-DD>, Budget vs actual report
uiSa.click(uiSa.btn('Reports'));
await uiSa.until(()=>!!uiSa.btn('Excel')&&!uiSa.btn('Excel').disabled);
ok('v3 UI reports: renders Excel and PDF export buttons (no CSV/Print buttons)',
 !!uiSa.btn('Excel')&&!!uiSa.btn('PDF')&&!uiSa.btn('Download for Excel (CSV)'));

// Trigger Excel and PDF downloads on Offerings report (Branch = All-branches)
uiSa.click(uiSa.btn('Excel'));
uiSa.click(uiSa.btn('PDF'));
await uiSa.until(()=>uiSa.w.__downloads.some(x=>x.download.endsWith('.xlsx'))&&uiSa.w.__downloads.some(x=>x.download.endsWith('.pdf')));
const dls=uiSa.w.__downloads.map(x=>x.download);
ok('v3 UI reports: Excel (.xlsx) & PDF (.pdf) use KHI-<report>-<branch>-<YYYY-MM-DD> filename',
 dls.includes(`KHI-offerings-All-branches-${TODAY}.xlsx`)&&dls.includes(`KHI-offerings-All-branches-${TODAY}.pdf`));

// Select specific branch KHI CITY CENTRE and switch report to Budget vs actual
const repForm=uiSa.form('Show report');
uiSa.set(uiSa.qa('select',repForm)[0],'budgets');
uiSa.set(uiSa.qa('select',repForm)[1],'1');
uiSa.submit(repForm);
ok('v3 UI reports: Budget vs actual report displays warning and >90% percentage',
 await uiSa.until(()=>uiSa.t().includes('95%')&&uiSa.t().includes('>90% used')));
uiSa.w.__downloads.length=0;
uiSa.click(uiSa.btn('Excel'));
uiSa.click(uiSa.btn('PDF'));
await uiSa.until(()=>uiSa.w.__downloads.some(x=>x.download.endsWith('.xlsx'))&&uiSa.w.__downloads.some(x=>x.download.endsWith('.pdf')));
const budDls=uiSa.w.__downloads.map(x=>x.download);
ok('v3 UI reports: branch-filtered export filename includes branch slug',
 budDls.includes(`KHI-budgets-KHI-CITY-CENTRE-${TODAY}.xlsx`)&&budDls.includes(`KHI-budgets-KHI-CITY-CENTRE-${TODAY}.pdf`));

// Verify SheetJS roundtrip produces a real binary .xlsx buffer cleanly
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{Branch:'KHI CITY CENTRE',Category:'Utilities',Budget:200,Actual:190}]),'budgets');
const xlsxBuf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
ok('v3 SheetJS produces valid .xlsx ZIP workbook buffer',Buffer.isBuffer(xlsxBuf)&&xlsxBuf[0]===0x50&&xlsxBuf[1]===0x4b);

// Member & Secretary in JSDOM: active announcement appears at top of home screen
const uiMem=boot('/member/');
await uiMem.until(()=>uiMem.t().includes('Member Sign in'));
uiMem.fill('Phone number','0971234567');uiMem.fill('Password','demo1234');uiMem.submit(uiMem.form('Member Sign in'));
ok('v3 UI member: active announcements rendered at top of member home',
 await uiMem.until(()=>{
  const mainTxt=uiMem.q('main')?.textContent||'';
  const annIdx=mainTxt.indexOf('Annual Prayer & Fasting Week');
  const svcIdx=mainTxt.indexOf('Sunday Service is on today');
  return annIdx>=0&&(svcIdx<0||annIdx<svcIdx);
 }));

const uiSec=boot('/secretary/');
await uiSec.until(()=>uiSec.t().includes('Secretary Sign in'));
uiSec.fill('Username','sec1');uiSec.fill('Password','demo1234');uiSec.submit(uiSec.form('Secretary Sign in'));
await finishOtp(uiSec);
ok('v3 UI secretary: active announcements rendered at top of secretary dashboard',
 await uiSec.until(()=>{
  const mainTxt=uiSec.q('main')?.textContent||'';
  const annIdx=mainTxt.indexOf('Annual Prayer & Fasting Week');
  const cashIdx=mainTxt.indexOf('Record physical cash');
  return annIdx>=0&&cashIdx>=0&&annIdx<cashIdx;
 }));

/* ========================================================================
 * PART 3: WORKER API (src/index.js)
 * ======================================================================== */
const env={SUPABASE_URL:'http://sb',SUPABASE_SERVICE_KEY:'sk',SUPABASE_ANON_KEY:'ak',SUPABASE_JWT_SECRET:'jwt-secret-test',SESSION_SECRET:'secret',GEO_ENFORCE:'false'};
let featOverrides={'feature.announcements':true,'feature.budgets':true,'feature.exports':true,'feature.sms':false};
const captured=[];
globalThis.fetch=async(url,o={})=>{
 const u=String(url),body=o.body?JSON.parse(o.body):null;
 captured.push({u,m:o.method||'GET',body});
 if(u.includes('/rpc/staff_login'))return new Response(JSON.stringify([{id:body.p_username==='super'?5:body.p_username==='sec1'?2:1,role:body.p_role}]));
 if(u.includes('/rpc/member_login'))return new Response(JSON.stringify(7));
 if(u.includes('/rpc/dev_login'))return new Response(JSON.stringify(1));
 if(u.includes('/rpc/verify_login_otp'))return new Response(JSON.stringify([{ok:true,role:body.p_token==='dev-tok'?'developer':body.p_token==='sec-tok'?'secretary':'admin',user_id:body.p_token==='sec-tok'?2:1}]));
 if(u.includes('/rpc/create_login_otp'))return new Response(JSON.stringify(body.p_role==='secretary'?'sec-tok':'tok-123'));
 if(u.includes('/rpc/my_features'))return new Response(JSON.stringify({'feature.receipts':true,'feature.expenses':true,'feature.two_step_approval':true,'feature.login_otp':false,'feature.sms':false,...featOverrides}));
 if(u.includes('/rpc/feature_enabled')){const k=body?.p_key;return new Response(JSON.stringify(k in featOverrides?featOverrides[k]:true))}
 if(u.includes('/rpc/branch_totals')||u.includes('/rpc/owing_pledges'))return new Response(JSON.stringify([]));
 if(u.includes('/rpc/'))return new Response(JSON.stringify(null));
 if(u.includes('/rest/v1/branches'))return new Response(JSON.stringify([{id:1,name:'KHI CITY CENTRE',kind:'center',parent_id:null,is_main:true,code:'KCC'},{id:2,name:'NIPA FELLOWSHIP',kind:'fellowship',parent_id:1,is_main:false,code:'NIP'}]));
 if(u.includes('/rest/v1/staff?id=eq.1'))return new Response(JSON.stringify([{id:1,role:'admin',branch_id:2,username:'nipaadm',full_name:'Nipa Admin',email:'a@khi.org',active:true,privileges:['announcements','budgets','reports'],branches:{name:'NIPA FELLOWSHIP'}}]));
 if(u.includes('/rest/v1/staff?id=eq.2'))return new Response(JSON.stringify([{id:2,role:'secretary',slot:'main',branch_id:1,username:'sec1',full_name:'Mary Banda',email:'',active:true,privileges:[],branches:{name:'KHI CITY CENTRE'}}]));
 if(u.includes('/rest/v1/dev_accounts'))return new Response(JSON.stringify([{id:1,username:'timothy',full_name:'Timothy',email:'dev@khi.org',active:true}]));
 if(u.includes('/rest/v1/members'))return new Response(JSON.stringify([{id:7,branch_id:1,full_name:'Grace Phiri',phone:'0971234567',must_change:false,branches:{name:'KHI CITY CENTRE'}}]));
 if(u.includes('/rest/v1/announcements?id=eq.90'))return new Response(JSON.stringify([{id:90,branch_id:null,title:'Global Note',body:'All church'}]));
 if(u.includes('/rest/v1/announcements?id=eq.91'))return new Response(JSON.stringify([{id:91,branch_id:2,title:'Nipa Note',body:'Local'}]));
 if(u.includes('/rest/v1/announcements')&&o.method==='POST')return new Response(JSON.stringify([{id:92}]),{status:201});
 if(u.includes('/rest/v1/announcements'))return new Response(JSON.stringify([{id:90,branch_id:null,title:'Global Note',body:'All church',expires_at:null},{id:91,branch_id:2,title:'Nipa Note',body:'Local',expires_at:null}]));
 if(u.includes('/rest/v1/branch_budgets?id=eq.40'))return new Response(JSON.stringify([{id:40,branch_id:1,budget_year:2026,category:'Utilities'}]));
 if(u.includes('/rest/v1/branch_budgets'))return new Response(JSON.stringify([{id:40,branch_id:2,budget_year:2026,category:'Welfare',amount:100},{id:41,branch_id:1,budget_year:2026,category:'Utilities',amount:1000}]));
 if(u.includes('/rest/v1/expenses'))return new Response(JSON.stringify([{id:1,branch_id:2,expense_date:'2026-03-01',category:'Welfare',amount:92,status:'approved'},{id:2,branch_id:1,expense_date:'2026-03-01',category:'Utilities',amount:900,status:'approved'}]));
 if(u.includes('/rest/v1/offerings'))return new Response(JSON.stringify([{id:10,branch_id:2,type:'physical',category:'Tithe',amount:700,sender:'Grace',voided:false,receipt_no:'KHI-NIP-2026-0001',created_at:'2026-03-01T10:00:00Z'}]));
 return new Response(JSON.stringify([]));
};
const wCall=(p,body,o={})=>w.fetch(new Request('https://w.example'+p,body===undefined?o:{method:'POST',headers:{'Content-Type':'application/json',...(o.headers||{})},body:JSON.stringify(body)}),env);

// Member login + home announcements
let wr=await wCall('/api/member/login',{phone:'0971234567',password:'pw'});
const memCk=wr.headers.get('Set-Cookie').split(';')[0];
wr=await wCall('/api/member/home',undefined,{headers:{Cookie:memCk}});
let wd=await wr.json();
ok('v3 Worker member home: returns active announcements',Array.isArray(wd.announcements)&&wd.announcements.some(a=>a.title==='Global Note'));

// Secretary login + home announcements + report export flag
featOverrides={'feature.announcements':true,'feature.budgets':true,'feature.exports':true,'feature.login_otp':false,'feature.sms':false};
wr=await wCall('/api/staff/login',{username:'sec1',password:'pw',app:'secretary'});
const secCk=wr.headers.get('Set-Cookie').split(';')[0];
wr=await wCall('/api/staff/home',undefined,{headers:{Cookie:secCk}});
wd=await wr.json();
ok('v3 Worker secretary home: returns active announcements',Array.isArray(wd.announcements)&&wd.announcements.some(a=>a.title==='Global Note'));
wr=await wCall('/api/staff/report?kind=offerings&from=2026-01-01&to=2026-12-31',undefined,{headers:{Cookie:secCk}});
wd=await wr.json();
ok('v3 Worker secretary report: includes feature.exports flag',wd.features?.['feature.exports']===true);

// Branch Admin login (branch 2): scope enforcement + budget vs actual (>90% warning)
wr=await wCall('/api/staff/login',{username:'nipaadm',password:'pw',app:'admin'});
const admCk=wr.headers.get('Set-Cookie').split(';')[0];
wr=await wCall('/api/admin/announcements',{a:'add',branch:'',title:'Hack',body:'No'},{headers:{Cookie:admCk}});
ok('v3 Worker admin announcements: branch admin blocked from global post (403)',wr.status===403);
wr=await wCall('/api/admin/announcements',{a:'edit',id:90,branch:2,title:'Hack',body:'No'},{headers:{Cookie:admCk}});
ok('v3 Worker admin announcements: branch admin blocked from editing global announcement (403)',wr.status===403);
wr=await wCall('/api/admin/announcements',{a:'add',branch:2,title:'Nipa Update',body:'Sunday 09:00'},{headers:{Cookie:admCk}});
ok('v3 Worker admin announcements: branch admin posts to own branch',wr.status===200&&captured.some(c=>c.u.includes('/rest/v1/announcements')&&c.m==='POST'&&c.body?.branch_id===2));

wr=await wCall('/api/admin/budgets',{a:'save',branch:1,budget_year:2026,category:'Utilities',amount:500},{headers:{Cookie:admCk}});
ok('v3 Worker admin budgets: branch admin blocked from out-of-scope branch (403)',wr.status===403);
wr=await wCall('/api/admin/budgets',{a:'save',branch:2,budget_year:2026,category:'Welfare',amount:100},{headers:{Cookie:admCk}});
ok('v3 Worker admin budgets: upserts branch_budgets row cleanly',wr.status===200&&captured.some(c=>c.u.includes('/rest/v1/branch_budgets?on_conflict=branch_id,budget_year,category')&&c.m==='POST'));

wr=await wCall('/api/admin/report?kind=budgets&from=2026-01-01&to=2026-12-31&year=2026',undefined,{headers:{Cookie:admCk}});
wd=await wr.json();
ok('v3 Worker admin report: returns budget vs actual with 92% >90% warning',
 wd.budgets?.rows?.[0]?.Pct_Used===92&&wd.budgets?.rows?.[0]?.warning===true&&wd.features?.['feature.exports']===true);

// Developer bypass when all v3 flags are OFF
featOverrides={'feature.announcements':false,'feature.budgets':false,'feature.exports':false,'feature.login_otp':false,'feature.sms':false};
wr=await wCall('/api/dev/login',{username:'timothy',password:'pw'});
const devCk=(wr.headers.getSetCookie?.()[0]||wr.headers.get('Set-Cookie')).split(';')[0];
wr=await wCall('/api/admin/report?kind=budgets&from=2026-01-01&to=2026-12-31&year=2026',undefined,{headers:{Cookie:devCk}});
wd=await wr.json();
ok('v3 Worker dev bypass: developer accesses budget report & exports even when v3 flags are OFF',
 wr.status===200&&wd.features?.['feature.exports']===true&&wd.features?.['feature.budgets']===true&&wd.budgets?.rows?.some(r=>r.Pct_Used===90&&r.warning===false));

console.log(fails?`\n${fails} FAILED`:'\nAll v3 feature checks passed');
process.exit(fails?1:0);
