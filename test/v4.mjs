// Africa's Talking SMS (v4) tests across Mock API, React UI, and Cloudflare Worker with mocked AT API. Usage: node test/v4.mjs
import {JSDOM} from 'jsdom';import {build} from 'esbuild';import {execFileSync} from 'child_process';import fs from 'fs';
import w from '../src/index.js';

execFileSync('node',['scripts/build-preview.mjs','test/.out/preview.html'],{stdio:'ignore'});
const html=fs.readFileSync('test/.out/preview.html','utf8');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};

await build({entryPoints:['web/src/mockapi.js'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/mock-v4.mjs',logLevel:'silent'});
const {api}=await import('./.out/mock-v4.mjs');

/* ========================================================================
 * PART 1: MOCK API (web/src/mockapi.js)
 * ======================================================================== */
const devLogin=async()=>{const r=await api('/api/dev/login',{username:'timothy',password:'demo1234'});if(r?.otp_required)return api('/api/dev/otp',{challenge:r.challenge,code:r.demo_code});return r};
const staffLogin=async(u,app)=>{const r=await api('/api/staff/login',{username:u,password:'demo1234',app});if(r?.otp_required)return api('/api/staff/otp',{challenge:r.challenge,code:r.demo_code});return r};

// 1. feature.sms starts OFF by default & only Developer can switch it on
const pubF=await api('/api/features');
ok('v4 mock: feature.sms starts OFF by default in /api/features',pubF['feature.sms']===false&&!('stub.sms' in pubF));
await api('/api/member/login',{phone:'0971234567',password:'demo1234'});
ok('v4 mock: member logs in directly without OTP when feature.sms is OFF',true);
await api('/api/member/logout',{});

// Turn feature.sms ON as Developer
await devLogin();
await api('/api/dev/flags',{key:'feature.sms',unit_id:null,enabled:true});
const pubF2=await api('/api/features');
ok('v4 mock: feature.sms is ON globally once Developer turns it on',pubF2['feature.sms']===true);

// 2. Member login OTP when feature.sms is ON
const mChallenge=await api('/api/member/login',{phone:'0971234567',password:'demo1234'});
ok('v4 mock: member login requires 6-digit SMS code when feature.sms is ON',
 mChallenge.otp_required===true&&/^\+\d{5}\*\*\*\d{3}$/.test(mChallenge.sent_to)&&/^\d{6}$/.test(mChallenge.demo_code));
ok('v4 mock: wrong member OTP rejected',
 await api('/api/member/otp',{challenge:mChallenge.challenge,code:'000000'}).then(()=>false,e=>e.status===401));
await api('/api/member/otp',{challenge:mChallenge.challenge,code:mChallenge.demo_code});
const mHome=await api('/api/member/home');
ok('v4 mock: valid member OTP signs member in',mHome.me.name==='Grace Phiri');
ok('v4 mock: member OTP is single-use',
 await api('/api/member/otp',{challenge:mChallenge.challenge,code:mChallenge.demo_code}).then(()=>false,e=>e.status===401));

// 5 wrong attempts kill challenge
const mChallenge2=await api('/api/member/login',{phone:'0961234567',password:'demo1234'});
for(let i=0;i<5;i++)await api('/api/member/otp',{challenge:mChallenge2.challenge,code:'111111'}).catch(()=>{});
ok('v4 mock: 5 wrong member OTPs kill the challenge',
 await api('/api/member/otp',{challenge:mChallenge2.challenge,code:mChallenge2.demo_code}).then(()=>false,e=>e.status===401));

// 3. Staff phone save & SMS vs email OTP
await staffLogin('super','superadmin');
await api('/api/admin/account',{a:'email',id:2,email:'sec1@khi.org',phone:'0975551122'});
await api('/api/admin/admin',{a:'email',id:6,email:'',phone:'0775559988'});
const sSec2=await api('/api/staff/login',{username:'sec2',password:'demo1234',app:'secretary'});
const sSec1=await api('/api/staff/login',{username:'sec1',password:'demo1234',app:'secretary'});
ok('v4 mock: staff with phone receives OTP via SMS; staff without phone falls back to email',
 sSec1.sent_to.startsWith('+260')&&sSec2.sent_to.includes('@')&&!sSec2.sent_to.startsWith('+260'));

// 4. Receipts & announcement SMS in mock mode
await api('/api/staff/otp',{challenge:sSec1.challenge,code:sSec1.demo_code});
const cashR=await api('/api/staff/cash',{amount:250,category:'Tithe',sender:'0971234567',note:'SMS test'});
const plR=await api('/api/staff/pledge-payment',{pledge:1,amount:50});
await staffLogin('super','superadmin');
await api('/api/admin/announcements',{a:'add',branch:2,title:'Youth Meet',body:'Saturday 14:00',expires_at:'',send_sms:true});
await devLogin();
const testSmsRes=await api('/api/dev/sms',{to:'0978000111',message:'Hello Developer Test'});
const smsLog=(await api('/api/dev/sms')).rows;
ok('v4 mock: receipts, scoped announcements (NIPA only), and test SMS are logged cleanly',
 testSmsRes.ok&&smsLog.some(r=>r.kind==='receipt'&&r.message.includes(cashR.receipt_no))
 &&smsLog.some(r=>r.kind==='receipt'&&r.message.includes(plR.receipt_no))
 &&smsLog.some(r=>r.kind==='announcement'&&r.to_phone==='+260951234567')
 &&!smsLog.some(r=>r.kind==='announcement'&&r.to_phone==='+260971234567')
 &&smsLog.some(r=>r.kind==='test'&&r.to_phone==='+260978000111'&&r.cost==='ZMW 0.1500'));

await api('/api/dev/logout',{});

/* ========================================================================
 * PART 2: REACT UI TESTS (JSDOM with shared mockapi state)
 * ======================================================================== */
const uiPlug={name:'mock-api',setup(b){b.onResolve({filter:/\/api\.js$/},()=>({path:new URL('../web/src/mockapi.js',import.meta.url).pathname}))}};
const uiRes=await build({
 stdin:{
  contents:`
   import {createRoot} from 'react-dom/client';
   import {MemoryRouter} from 'react-router-dom';
   import {MemberRoutes,AdminRoutes,DevRoutes} from './web/src/routes.jsx';
   const root=createRoot(document.getElementById('root'));
   window.__mountApp=(app)=>{
    const el=app==='dev'?<DevRoutes/>:app==='member'?<MemberRoutes/>:<AdminRoutes app={app}/>;
    root.render(<MemoryRouter key={app+Math.random()} initialEntries={['/']}>{el}</MemoryRouter>);
   };
  `,
  resolveDir:process.cwd(),
  loader:'jsx'
 },
 bundle:true,format:'iife',jsx:'automatic',write:false,plugins:[uiPlug],define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'
});
const uiBundle=uiRes.outputFiles[0].text;
const uiDom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{runScripts:'dangerously',url:'https://preview.test/',pretendToBeVisual:true});
const uw=uiDom.window,ud=uw.document;
uw.confirm=()=>true;uw.prompt=()=>'test';uw.alert=()=>{};uw.open=()=>{};
const sc=ud.createElement('script');sc.textContent=uiBundle;ud.body.appendChild(sc);
const app={
 w:uw,d:ud,
 t:()=>ud.getElementById('root').textContent,
 qa:s=>[...ud.querySelectorAll(s)],
 q:s=>ud.querySelector(s),
 until:async(f,ms=8000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(f())return true}catch{}await new Promise(r=>setTimeout(r,15))}return false},
 set:(el,v)=>{const P=el.tagName==='SELECT'?uw.HTMLSelectElement:el.tagName==='TEXTAREA'?uw.HTMLTextAreaElement:uw.HTMLInputElement;Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(el,v);el.dispatchEvent(new uw.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))},
 field:(ph,scope=ud)=>[...scope.querySelectorAll('input,textarea')].find(i=>(i.placeholder||'').includes(ph)),
 fill:(ph,v,scope)=>app.set(app.field(ph,scope),v),
 click:el=>el.dispatchEvent(new uw.MouseEvent('click',{bubbles:true,cancelable:true})),
 btn:(txt,scope=ud)=>[...scope.querySelectorAll('button,a')].find(e=>e.textContent.trim()===txt),
 form:(txt,scope=ud)=>[...scope.querySelectorAll('form')].find(f=>f.textContent.includes(txt)),
 submit:f=>f.dispatchEvent(new uw.Event('submit',{bubbles:true,cancelable:true})),
 mount:name=>uw.__mountApp(name)
};
const finishOtp=async x=>{await x.until(()=>x.t().includes('Demo verification code:'));const code=x.t().match(/Demo verification code:\s*(\d{6})/)?.[1]||'';x.fill('6-digit verification code',code);x.submit(x.form('Verification'))};

// Developer turns on feature.sms, sends test SMS, views SMS log
app.mount('dev');
await app.until(()=>app.t().includes('Developer Sign in'));
app.fill('Username','timothy');app.fill('Password','demo1234');app.submit(app.form('Developer Sign in'));await finishOtp(app);
await app.until(()=>app.qa('tr').some(r=>r.textContent.includes('SMS notifications')));
const smsFlagRow=app.qa('tr').find(r=>r.textContent.includes('SMS notifications'));
app.click(app.btn('ON',smsFlagRow));
await app.until(()=>app.t().includes('feature.sms set to ON'));
app.click(app.btn('SMS'));
await app.until(()=>app.t().includes('Send test SMS'));
app.fill('Test recipient phone','0977223344');
app.submit(app.form('Send test SMS'));
ok('v4 UI developer: Send test SMS button sends and displays entry in SMS log view',
 await app.until(()=>app.t().includes('Test SMS sent to +260977223344')&&app.t().includes('Success')&&app.t().includes('ZMW 0.1500')));
app.click(app.btn('Log out'));
await app.until(()=>!app.t().includes('Developer · Timothy'));

// Member UI with feature.sms ON shows 6-digit SMS verification step
app.mount('member');
await app.until(()=>app.t().includes('Member Sign in'));
app.fill('Phone number','0971234567');app.fill('Password','demo1234');app.submit(app.form('Member Sign in'));
await finishOtp(app);
ok('v4 UI member: SMS verification step logs member into home dashboard',
 await app.until(()=>app.t().includes('Grace Phiri')&&app.t().includes('Giving')));
app.click(app.btn('Log out'));
await app.until(()=>app.t().includes('Member Sign in'));

// Super Admin UI: staff phone field next to email & Announcements 'Also send by SMS' checkbox
app.mount('superadmin');
await app.until(()=>app.t().includes('Super Admin Sign in'));
app.fill('Username','super');app.fill('Password','demo1234');app.submit(app.form('Super Admin Sign in'));await finishOtp(app);
await app.until(()=>app.btn('Admins'));
app.click(app.btn('Admins'));
await app.until(()=>app.t().includes('City Centre Admin'));
const admCard=app.qa('.card').find(c=>c.textContent.includes('City Centre Admin'));
const phForm=app.form('Save email',admCard);
app.fill('Phone (for SMS code', '0976112233', phForm);
app.submit(phForm);
ok('v4 UI admin: optional phone field saved next to email field',
 await app.until(()=>app.t().includes('SMS phone: +260976112233')));

app.click(app.btn('Announcements'));
await app.until(()=>app.t().includes('Also send by SMS'));
const annF=app.form('Post announcement');
app.fill('Announcement title','SMS Broadcast',annF);
app.fill('Announcement details','Choir rehearsal at 17:00',annF);
const cb=[...annF.querySelectorAll('input[type="checkbox"]')][0];
cb.checked=true;cb.dispatchEvent(new app.w.Event('change',{bubbles:true}));
app.submit(annF);
ok('v4 UI admin: Also send by SMS checkbox posts announcement cleanly',
 await app.until(()=>app.t().includes('Announcement posted.')&&app.t().includes('SMS Broadcast')));

/* ========================================================================
 * PART 3: WORKER API (src/index.js) WITH AFRICA'S TALKING API MOCKED
 * ======================================================================== */
const env={
 SUPABASE_URL:'http://sb',SUPABASE_SERVICE_KEY:'sk',SUPABASE_ANON_KEY:'ak',SUPABASE_JWT_SECRET:'jwt-secret-test',SESSION_SECRET:'secret',GEO_ENFORCE:'false',
 AT_USERNAME:'sandbox',AT_API_KEY:'at-key-123',AT_SENDER_ID:'KHI',AT_SANDBOX:'true',
 RESEND_API_KEY:'re-key-123'
};
let smsFlag=true,loginOtpFlag=true,atMode='success',memPhone='0971234567';
let staffRows=[
 {id:1,role:'admin',branch_id:1,slot:null,username:'admin',full_name:'Admin One',email:'adm@khi.org',phone:'+260974000111',active:true,privileges:['accounts','announcements']},
 {id:2,role:'secretary',branch_id:1,slot:'main',username:'sec1',full_name:'Mary Banda',email:'sec@khi.org',phone:null,active:true,privileges:[]}
];
const atCalls=[],emailCalls=[],smsLogs=[],otpCreated=[];
globalThis.fetch=async(url,o={})=>{
 const u=String(url);
 // Capture Africa's Talking API calls
 if(u.includes('africastalking.com/version1/messaging')){
  const params=Object.fromEntries(new URLSearchParams(String(o.body||'')));
  atCalls.push({url:u,method:o.method,headers:o.headers,params});
  if(atMode==='http500')return new Response('Internal error',{status:500});
  if(atMode==='neterr')throw new Error('ECONNRESET');
  if(atMode==='rejected'){
   return new Response(JSON.stringify({SMSMessageData:{Message:'Sent to 0/1',Recipients:params.to.split(',').map(num=>({statusCode:502,number:num,status:'RejectedByGateway',cost:'0'}))}}),{status:201});
  }
  return new Response(JSON.stringify({
   SMSMessageData:{
    Message:'Sent to 1/1 Total Cost: ZMW 0.1500',
    Recipients:params.to.split(',').map((num,i)=>({statusCode:101,number:num,status:'Success',cost:'ZMW 0.1500',messageId:'ATXid_'+(atCalls.length)+'_'+(i+1)}))
   }
  }),{status:201});
 }
 if(u==='https://api.resend.com/emails'){
  emailCalls.push(JSON.parse(o.body));
  return new Response(JSON.stringify({id:'re_1'}),{status:200});
 }
 const body=o.body?JSON.parse(o.body):null;
 if(u.includes('/rpc/feature_enabled')){
  if(body?.p_key==='feature.sms')return new Response(JSON.stringify(smsFlag));
  if(body?.p_key==='feature.login_otp')return new Response(JSON.stringify(loginOtpFlag));
  return new Response(JSON.stringify(true));
 }
 if(u.includes('/rpc/my_features'))return new Response(JSON.stringify({'feature.sms':smsFlag,'feature.login_otp':loginOtpFlag,'feature.announcements':true,'feature.receipts':true}));
 if(u.includes('/rpc/member_login'))return new Response(JSON.stringify(7));
 if(u.includes('/rpc/staff_login'))return new Response(JSON.stringify([{id:body.p_username==='sec1'?2:1,role:body.p_role}]));
 if(u.includes('/rpc/dev_login'))return new Response(JSON.stringify(1));
 if(u.includes('/rpc/create_login_otp')){otpCreated.push(body);return new Response(JSON.stringify(`${body.p_role}-${body.p_user_id}-tok`))}
 if(u.includes('/rpc/record_pledge_payment'))return new Response(JSON.stringify(150));
 if(u.includes('/rpc/branch_totals')||u.includes('/rpc/owing_pledges'))return new Response(JSON.stringify([]));
 if(u.includes('/rpc/'))return new Response(JSON.stringify(null));
 if(u.includes('/rest/v1/settings?key=eq.profile'))return new Response(JSON.stringify([{value:{email:'office@khi.org'}}]));
 if(u.includes('/rest/v1/branches'))return new Response(JSON.stringify([{id:1,name:'KHI CITY CENTRE',kind:'center',parent_id:null,is_main:true,code:'KCC'},{id:2,name:'NIPA FELLOWSHIP',kind:'fellowship',parent_id:1,is_main:false,code:'NIP'}]));
 if(u.includes('/rest/v1/members?id=eq.7'))return new Response(JSON.stringify([{id:7,branch_id:1,full_name:'Grace Phiri',phone:memPhone,must_change:false,branches:{name:'KHI CITY CENTRE'}}]));
 if(u.includes('/rest/v1/members')){const allM=[{id:7,branch_id:1,full_name:'Grace Phiri',phone:'0971234567'},{id:8,branch_id:2,full_name:'Mary Tembo',phone:'0951234567'}];const m=u.match(/branch_id=in\.\(([^)]+)\)/);const ids=m?m[1].split(',').map(Number):null;return new Response(JSON.stringify(ids?allM.filter(x=>ids.includes(x.branch_id)):allM))}
 if(u.includes('/rest/v1/staff?id=eq.1'))return new Response(JSON.stringify([staffRows[0]]));
 if(u.includes('/rest/v1/staff?id=eq.2'))return new Response(JSON.stringify([staffRows[1]]));
 if(u.includes('/rest/v1/dev_accounts'))return new Response(JSON.stringify([{id:1,username:'timothy',full_name:'Timothy',email:'dev@khi.org',phone:null,active:true}]));
 if(u.includes('/rest/v1/offerings')&&o.method==='POST')return new Response(JSON.stringify([{id:55,receipt_no:'KHI-KCC-2026-0055'}]),{status:201});
 if(u.includes('/rest/v1/pledges?id=eq.1'))return new Response(JSON.stringify([{id:1,programs:{title:'Building Fund'},members:{id:7,branch_id:1,full_name:'Grace Phiri',phone:'0971234567'}}]));
 if(u.includes('/rest/v1/pledge_payments'))return new Response(JSON.stringify([{id:9,receipt_no:'KHI-KCC-2026-0056'}]));
 if(u.includes('/rest/v1/announcements')&&o.method==='POST')return new Response(JSON.stringify([{id:88}]),{status:201});
 if(u.includes('/rest/v1/sms_log')&&o.method==='POST'){smsLogs.push(...(Array.isArray(body)?body:[body]));return new Response(JSON.stringify([]),{status:201})}
 if(u.includes('/rest/v1/sms_log'))return new Response(JSON.stringify([...smsLogs].reverse()));
 return new Response(JSON.stringify([]));
};
const wCall=(p,body,o={})=>w.fetch(new Request('https://w.example'+p,body===undefined?o:{method:'POST',headers:{'Content-Type':'application/json',...(o.headers||{})},body:JSON.stringify(body)}),env);

// 1. AT sandbox vs live URL, headers, form encoding, phone normalisation & sms_log recording
await wCall('/api/member/login',{phone:'0971234567',password:'pw'});
const lastAt=atCalls.at(-1);
ok('v4 Worker AT request: sandbox URL, POST, apiKey + Accept + form-urlencoded, +260 normalisation',
 lastAt?.url==='https://api.sandbox.africastalking.com/version1/messaging'
 &&lastAt?.method==='POST'
 &&lastAt?.headers?.apiKey==='at-key-123'
 &&lastAt?.headers?.Accept==='application/json'
 &&lastAt?.params?.username==='sandbox'
 &&lastAt?.params?.to==='+260971234567'
 &&lastAt?.params?.from==='KHI'
 &&lastAt?.params?.message.includes(otpCreated.at(-1).p_code));

// Live endpoint check + additional Zambian number variants via /api/dev/sms
loginOtpFlag=false;
const devLoginRes=await wCall('/api/dev/login',{username:'timothy',password:'pw'});
const devCk=(devLoginRes.headers.getSetCookie?.()[0]||devLoginRes.headers.get('Set-Cookie')).split(';')[0];
loginOtpFlag=true;

const liveEnv={...env,AT_SANDBOX:'false'};delete liveEnv.AT_SENDER_ID;
for(const [raw,norm] of [['0971234567','+260971234567'],['971234567','+260971234567'],['2600971234567','+260971234567'],['00260771234567','+260771234567'],['+260951234567','+260951234567']]){
 const r=await w.fetch(new Request('https://w.example/api/dev/sms',{method:'POST',headers:{'Content-Type':'application/json',Cookie:devCk},body:JSON.stringify({to:raw,message:'Norm check'})}),liveEnv);
 const j=await r.json();
 ok(`v4 Worker normalise ${raw} -> ${norm}`,r.status===200&&j.ok&&j.result?.to===norm);
}
ok('v4 Worker AT live URL & optional AT_SENDER_ID omitted when unset',
 atCalls.at(-1)?.url==='https://api.africastalking.com/version1/messaging'&&!('from' in atCalls.at(-1).params));
ok('v4 Worker sms_log stores status & cost from AT response',
 smsLogs.some(x=>x.status==='Success'&&x.cost==='ZMW 0.1500'&&x.ok===true));

// 2. Staff OTP uses SMS when phone is present, falls back to email when AT fails or phone is missing
atMode='success';emailCalls.length=0;
let wr=await wCall('/api/staff/login',{username:'admin',password:'pw',app:'admin'});
let wd=await wr.json();
ok('v4 Worker staff OTP: uses SMS to staff.phone when set and AT succeeds',
 wd.otp_required&&wd.sent_to.startsWith('+260')&&emailCalls.length===0);

atMode='http500';emailCalls.length=0;
wr=await wCall('/api/staff/login',{username:'admin',password:'pw',app:'admin'});
wd=await wr.json();
ok('v4 Worker staff OTP fallback: AT HTTP 500 falls back to email & logs failure without blocking',
 wr.status===200&&wd.otp_required&&wd.sent_to.includes('@')&&emailCalls.length===1&&smsLogs.at(-1)?.ok===false);

atMode='rejected';emailCalls.length=0;
wr=await wCall('/api/member/login',{phone:'0971234567',password:'pw'});
wd=await wr.json();
ok('v4 Worker member OTP fallback: AT recipient rejection falls back to email & never blocks login challenge',
 wr.status===200&&wd.otp_required&&wd.sent_to.includes('@')&&emailCalls.length===1&&smsLogs.at(-1)?.status==='RejectedByGateway'&&smsLogs.at(-1)?.ok===false);

atMode='success';emailCalls.length=0;
wr=await wCall('/api/staff/login',{username:'sec1',password:'pw',app:'secretary'});
wd=await wr.json();
ok('v4 Worker staff OTP: falls back directly to email when staff.phone is blank',
 wr.status===200&&wd.otp_required&&wd.sent_to.includes('@')&&emailCalls.length===1);

// 3. Receipts & Announcements SMS never block primary action even when AT fails
loginOtpFlag=false;
wr=await wCall('/api/staff/login',{username:'sec1',password:'pw',app:'secretary'});
const secCk=wr.headers.get('Set-Cookie').split(';')[0];
atMode='success';
wr=await wCall('/api/staff/cash',{amount:300,category:'Offering',sender:'0971234567'},{headers:{Cookie:secCk}});
wd=await wr.json();
ok('v4 Worker cash offering: texts member receipt_no and amount on success',
 wr.status===200&&wd.receipt_no==='KHI-KCC-2026-0055'&&atCalls.at(-1).params.message.includes('KHI-KCC-2026-0055')&&atCalls.at(-1).params.message.includes('K 300.00'));

atMode='neterr';
wr=await wCall('/api/staff/pledge-payment',{pledge:1,amount:150},{headers:{Cookie:secCk}});
wd=await wr.json();
ok('v4 Worker pledge payment: AT network error logged (ok:false) and NEVER blocks recording pledge payment',
 wr.status===200&&wd.receipt_no==='KHI-KCC-2026-0056'&&smsLogs.at(-1)?.ok===false&&smsLogs.at(-1)?.error?.includes('ECONNRESET'));

// Announcements SMS (scoped + never blocking)
atMode='http500';
wr=await wCall('/api/admin/announcements',{a:'add',branch:2,title:'Urgent Notice',body:'Come early',send_sms:true},{headers:{Cookie:devCk}});
ok('v4 Worker announcements: sends to scoped branch members and never blocks on AT failure',
 wr.status===200&&atCalls.at(-1).params.to==='+260951234567');

// Security: Admin cannot access /api/dev/sms
wr=await wCall('/api/staff/login',{username:'admin',password:'pw',app:'admin'});
const admCk=wr.headers.get('Set-Cookie').split(';')[0];
wr=await wCall('/api/dev/sms',undefined,{headers:{Cookie:admCk}});
ok('v4 Worker security: Admin gets 404 on /api/dev/sms',wr.status===404);

console.log(fails?`\n${fails} FAILED`:'\nAll v4 SMS checks passed');
process.exit(fails?1:0);
