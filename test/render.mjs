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
ok('message banner',hv('events',{msg:'Error: nope'}).includes('class="err"'));
console.log(fails?`\n${fails} FAILED`:'\nAll screens render');process.exit(fails?1:0);
