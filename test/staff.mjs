// Secretary app: API checks (against a stand-in for Supabase) + screen render checks. Usage: npm test
import w from '../src/index.js';
import {build} from 'esbuild';import {createElement as h} from 'react';import {renderToString as R} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server.js';
const env={SUPABASE_URL:'http://sb',SUPABASE_SERVICE_KEY:'k',SESSION_SECRET:'secret',GEO_ENFORCE:'false'};
const J=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
const posts=[];
globalThis.fetch=async(url,o={})=>{const u=String(url),body=o.body?JSON.parse(o.body):null;
 if(u.includes('/rpc/staff_login'))return J(body.p_password==='bad'?[]:[{id:body.p_username==='asst'?4:3,role:body.p_role}]);
 if(u.includes('/rpc/login_locked'))return J(false);
 if(u.includes('/rpc/branch_totals'))return J([{type:'physical',today:'150.00',month:'300.00'},{type:'digital',today:'50',month:'50'}]);
 if(u.includes('/rpc/owing_pledges'))return J([{id:5,member_id:7,member:'Grace Phiri',phone:'0971234567',program:'Building Project',balance:300}]);
 if(u.includes('/rpc/record_pledge_payment')){posts.push(['pp',body]);return J(Math.min(body.p_amount,300))}
 if(u.includes('/rpc/void_offering')){posts.push(['void',body]);return J('Entry voided.')}
 if(u.includes('/rpc/'))return J(null);
 if(u.includes('/rest/v1/staff?id=eq.3'))return J([{id:3,role:'secretary',slot:'main',username:'sec1',full_name:'Mary Banda',branch_id:1,branches:{name:'KHI CITY CENTRE'}}]);
 if(u.includes('/rest/v1/staff?id=eq.4'))return J([{id:4,role:'secretary',slot:'assistant',username:'asst',full_name:'Joe Zulu',branch_id:1,branches:{name:'KHI CITY CENTRE'}}]);
 if(u.includes('/rest/v1/pledges'))return J(u.includes('eq.99')?[{id:99,members:{branch_id:2}}]:[{id:5,members:{branch_id:1}}]);
 if(u.includes('/rest/v1/offerings')&&o.method==='POST'){posts.push(['cash',body]);return new Response(null,{status:201})}
 if(u.includes('/rest/v1/offerings'))return J([{id:11,type:'physical',category:'Tithe',sender:'Grace',amount:'150.00',voided:false,created_at:'2026-11-02T10:00:00Z'},{id:10,type:'digital',category:'Offering',sender:null,amount:'50.00',voided:true,void_reason:'duplicate',created_at:'2026-11-02T09:00:00Z'}]);
 if(u.includes('/rest/v1/audit_log'))return new Response(null,{status:201});
 return J([])};
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const H='https://t.example',call=(p,body,o={})=>w.fetch(new Request(H+p,body===undefined?o:{method:'POST',headers:{'Content-Type':'application/json',...(o.headers||{})},body:JSON.stringify(body)}),env);
let r=await call('/api/staff/login',{username:'sec1',password:'bad',app:'secretary'});ok('wrong password -> 401',r.status===401);
r=await call('/api/staff/login',{username:'sec1',password:'good',app:'secretary'});ok('login sets staff cookie',r.status===200&&r.headers.get('Set-Cookie').startsWith('khs='));
const ck=r.headers.get('Set-Cookie').split(';')[0],h1={headers:{Cookie:ck}};
r=await call('/api/staff/login',{username:'asst',password:'good',app:'secretary'});const ck2=r.headers.get('Set-Cookie').split(';')[0];
r=await call('/api/staff/home');ok('home without login -> 401',r.status===401);
r=await call('/api/staff/home',undefined,{headers:{Cookie:'khs=3.99999999999999.forged'}});ok('forged staff cookie rejected',r.status===401);
r=await call('/api/staff/home',undefined,{headers:{Cookie:'khm=3.99999999999999.x'}});ok('member cookie is not a staff session',r.status===401);
let d=await(await call('/api/staff/home',undefined,h1)).json();ok('home data',d.me.canVoid===true&&d.totals.pToday===150&&d.totals.month===350&&d.recent.length===2&&d.owing[0].member==='Grace Phiri');
d=await(await call('/api/staff/feed',undefined,h1)).json();ok('feed (lightweight)',d.totals.dToday===50&&!d.owing);
r=await call('/api/staff/cash',{amount:'0'},h1);ok('cash rejects zero',r.status===400);
d=await(await call('/api/staff/cash',{amount:'75.5',category:'Tithe',sender:'Peter',note:''},h1)).json();ok('cash recorded',d.message==='Recorded K 75.50.'&&posts.at(-1)[1].branch_id===1&&posts.at(-1)[1].type==='physical'&&posts.at(-1)[1].recorded_by==='sec1');
r=await call('/api/staff/pledge-payment',{pledge:'99',amount:'10'},h1);ok('other fellowship pledge refused',r.status===400);
d=await(await call('/api/staff/pledge-payment',{pledge:'5',amount:'100'},h1)).json();ok('pledge payment recorded',d.message.includes('K 100.00')&&posts.at(-1)[1].p_by==='sec1');
d=await(await call('/api/staff/pledge-payment',{pledge:'5',amount:'900'},h1)).json();ok('overpayment capped at balance',d.message.includes('K 300.00'));
d=await(await call('/api/staff/void',{id:11,reason:'typo'},h1)).json();ok('main secretary can void',d.message==='Entry voided.'&&posts.at(-1)[1].p_branch===1);
r=await call('/api/staff/void',{id:11,reason:'typo'},{headers:{Cookie:ck2}});ok('assistant cannot void',r.status===403);
r=await call('/api/staff/cash',{amount:'5'},{headers:{Cookie:ck,Origin:'https://evil.example'}});ok('cross-site POST blocked',r.status===403);
r=await call('/api/staff/logout',{});ok('logout clears staff cookie',r.headers.get('Set-Cookie').startsWith('khs=;')&&r.headers.get('Set-Cookie').includes('Max-Age=0'));

await build({entryPoints:['web/src/secretary.jsx'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/secretary.mjs',external:['react','react-dom','react-router-dom'],jsx:'automatic',logLevel:'silent'});
const S=await import('./.out/secretary.mjs');const page=c=>R(h(StaticRouter,{location:'/'},c));
ok('staff login screen',page(h(S.StaffLogin,{app:'secretary',title:'Secretary Sign in'})).includes('Secretary Sign in'));
const dd={me:{name:'Mary Banda',branch:'KHI CITY CENTRE',slot:'main',canVoid:true},totals:{pToday:150,dToday:50,month:350},
 recent:[{id:11,type:'physical',category:'Tithe',sender:'Grace',amount:'150.00',voided:false,created_at:'2026-11-02T10:00:00Z'},{id:10,type:'digital',category:'Offering',sender:null,amount:'50.00',voided:true,void_reason:'duplicate',created_at:'2026-11-02T09:00:00Z'}],
 owing:[{id:5,member_id:7,member:'Grace Phiri',phone:'0971234567',program:'Building Project',balance:300}]};
const sv=(x={})=>page(h(S.SecView,{d:dd,msg:'',act:()=>{},onLogout:()=>{},...x}));
let t=sv();ok('dashboard: cash form, 3-step pledge picker, live totals',['Record physical cash','Record pledge payment','1. Choose member','2. Choose pledge','Fill full balance','K 350.00','Main Secretary'].every(x=>t.includes(x)));
ok('main secretary sees Void; voided row struck through',t.includes('>Void<')&&t.includes('line-through'));
t=sv({d:{...dd,me:{...dd.me,slot:'assistant',canVoid:false}}});ok('assistant sees no Void',!t.includes('>Void<')&&t.includes('Assistant'));
t=sv({d:{...dd,owing:[]}});ok('empty pledge list message',t.includes('currently owes a pledge'));
console.log(fails?`\n${fails} FAILED`:'\nAll secretary checks passed');process.exit(fails?1:0);
