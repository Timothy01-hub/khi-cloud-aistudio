// Renders every React screen on the server to catch coding mistakes. Usage: npm test
import {build} from 'esbuild';import {createElement as h} from 'react';import {renderToString as R} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server.js';
await build({entryPoints:['web/src/App.jsx'],bundle:true,format:'esm',platform:'node',outfile:'test/.out/app.mjs',external:['react','react-dom','react-router-dom'],jsx:'automatic',logLevel:'silent'});
const A=await import('./.out/app.mjs');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const page=c=>R(h(StaticRouter,{location:'/'},c));
ok('login screen',page(h(A.Login)).includes('Member Sign in'));
ok('register screen',['Create account','Privacy Notice','Date of birth','I am married'].every(x=>page(h(A.Register)).includes(x)));
ok('privacy screen',page(h(A.Privacy)).includes('What we keep'));
ok('blocked screen',page(h(A.Blocked)).includes('Access blocked'));
const d={me:{name:'Grace Phiri',branch:'KHI CITY CENTRE',mustChange:false},today:'2099-01-01',unread:2,
 events:[{id:1,title:'Revival Night',event_date:'2099-01-01',location:'Main hall',description:'Join us',banner:'https://x/y.jpg',lat:-15.4,lng:28.2}],
 programs:[{id:2,title:'Building Project',description:'Roof',deadline:'2099-02-01',location:'Plot 5',banner:null,lat:null,lng:null}],
 pledges:[{id:5,title:'Building Project',amount:500,paid:200}],services:[{id:3,type:'Sunday Service',here:false}]};
const hv=(tab,x={})=>page(h(A.HomeView,{d,tab,msg:'',alerts:[{id:1,message:'Payment received',is_read:false,created_at:'2026-11-02T10:00:00Z'}],act:()=>{},go:()=>{},onLogout:()=>{},...x}));
let t=hv('events');ok('events tab',t.includes('Revival Night')&&t.includes('TODAY')&&t.includes('Get directions')&&t.includes('check me in'));
t=hv('pledges');ok('pledges tab',t.includes('Make a pledge')&&t.includes('Balance K 300.00')&&t.includes('Plot 5'));
t=hv('alerts');ok('alerts tab',t.includes('Payment received'));
t=hv('account',{d:{...d,me:{...d.me,mustChange:true}}});ok('account tab + forced change',t.includes('Change password')&&t.includes('set a new password'));
const givingData={receipts:[{id:1,receipt_no:'KHI-KCC-2026-0001',date:'2026-01-05',branch:'KHI CITY CENTRE',brand:'KHI CITY CENTRE',type:'physical',category:'Tithe',amount:250,sender:'Grace Phiri',voided:false}],
 statement:{year:2026,years:[2026],rows:[{id:1,receipt_no:'KHI-KCC-2026-0001',date:'2026-01-05',branch:'KHI CITY CENTRE',type:'physical',category:'Tithe',amount:250}],byType:{Tithe:250},byMethod:{physical:250,digital:0},total:250,member:{full_name:'Grace Phiri',phone:'0971234567',branch:'KHI CITY CENTRE'},profile:{email:'a@b.c'}}};
t=hv('giving',{giving:givingData,stmtYear:2026,openReceipt:givingData.receipts[0]});
ok('giving tab + receipt + statement',t.includes('KHI-KCC-2026-0001')&&t.includes('ANNUAL GIVING STATEMENT (2026)')&&t.includes('Download yearly statement'));
ok('message banner',hv('events',{msg:'Error: nope'}).includes('class="err"'));
console.log(fails?`\n${fails} FAILED`:'\nAll screens render');process.exit(fails?1:0);
