// Click-through of all three React apps (on the demo backend) in a simulated browser. Usage: npm test
import {JSDOM} from 'jsdom';import {execFileSync} from 'child_process';import fs from 'fs';
execFileSync('node',['scripts/build-preview.mjs','test/.out/preview.html'],{stdio:'ignore'});const html=fs.readFileSync('test/.out/preview.html','utf8');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const errors=[];
async function open(hash){const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://preview.test/#'+hash,pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.confirm=()=>true;w.prompt=()=>'test reason';w.alert=()=>{};w.addEventListener('error',e=>errors.push(e.message));
 const t=()=>d.getElementById('root').textContent,qa=s=>[...d.querySelectorAll(s)],q=s=>d.querySelector(s);
 const until=async(f,ms=8000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(f())return true}catch{}await new Promise(r=>setTimeout(r,15))}return false};
 const set=(el,v)=>{const P=el.tagName==='SELECT'?w.HTMLSelectElement:el.tagName==='TEXTAREA'?w.HTMLTextAreaElement:w.HTMLInputElement;Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
 const field=(ph,scope=d)=>[...scope.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));
 const fill=(ph,v,scope)=>set(field(ph,scope),v);
 const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
 const btn=txt=>qa('button,a').find(e=>e.textContent.trim()===txt);
 const form=txt=>qa('form').find(f=>f.textContent.includes(txt));
 const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return{w,t,qa,q,until,set,fill,field,click,btn,form,submit}}

/* ---------- MEMBER ---------- */
let a=await open('/member/');
ok('member: launcher bar + login screen',await a.until(()=>a.t().includes('Member Sign in')));
a.fill('Phone number','0971234567');a.fill('Password','demo1234');a.submit(a.form('Member Sign in'));
ok('member: home with events, TODAY badge, check-in card',await a.until(()=>a.t().includes('Sunday Revival Service')&&a.t().includes('TODAY')&&a.t().includes('check me in')));
a.click(a.btn('I am here — check me in'));ok('member: self check-in',await a.until(()=>a.t().includes('You are checked in')));
a.click(a.btn('Pledges'));ok('member: pledges tab shows balance',await a.until(()=>a.t().includes('Make a pledge')&&a.t().includes('Balance K 300.00')));
a.set(a.q('select'),'1');a.fill('Pledge amount','50');a.submit(a.form('Make a pledge'));
ok('member: second pledge tops up (K 550)',await a.until(()=>a.t().includes('is now K 550.00')));
a.click([...a.qa('a')].find(e=>e.textContent.startsWith('Alerts')));ok('member: alerts tab',await a.until(()=>a.t().includes('Payment of K 200.00 received')));
a.click(a.btn('Account'));ok('member: account tab',await a.until(()=>a.t().includes('Change password')));
a.click(a.btn('About us'));ok('member: About us shows vision, mission, since 2015, email',await a.until(()=>['To reach all nations for Christ','Raising true Christians','since 2015','kingdomheralds.info@gmail.com'].every(x=>a.t().includes(x))));

/* ---------- MEMBER REGISTRATION ---------- */
a=await open('/member/');await a.until(()=>a.t().includes('Member Sign in'));a.click(a.btn('Create an account'));
ok('register: form has date of birth + married toggle',await a.until(()=>a.t().includes('Date of birth')&&a.t().includes('I am married')));
a.fill('Full name','New Member');a.fill('Phone number','0955000111');a.fill('Home address','Plot 1, Lusaka');
a.set(a.q('input[type=date]'),'1992-03-04');a.set(a.q('select'),'2');ok('register: member + 8 department choices',['Ushering department','Intercessory department','Sanctuary Keeping department','Praise Team department'].every(x=>a.t().includes(x)));a.set(a.qa('select')[1],'Media');a.fill('Password (6+','secret12');a.fill('Confirm password','secret12');
a.click(a.qa('input[type=checkbox]')[0]);ok('register: marriage date appears when married',await a.until(()=>a.t().includes('Date of marriage')));
a.set(a.qa('input[type=date]')[1],'2020-06-06');a.click(a.qa('input[type=checkbox]')[1]);a.submit(a.form('Create account'));
ok('register: success -> back to sign in',await a.until(()=>a.t().includes('Registration successful')));

/* ---------- SECRETARY ---------- */
let b=await open('/secretary/');ok('secretary: login screen',await b.until(()=>b.t().includes('Secretary Sign in')));
b.fill('Username','sec1');b.fill('Password','demo1234');b.submit(b.form('Secretary Sign in'));
ok('secretary: dashboard',await b.until(()=>b.t().includes('Record physical cash')&&b.t().includes('Record pledge payment')&&b.t().includes('Main Secretary')));
b.fill('Amount (K)','75.50');b.submit(b.form('Record physical cash'));ok('secretary: record cash',await b.until(()=>b.t().includes('Recorded K 75.50.')));
const ms=b.qa('select').find(s=>s.textContent.includes('1. Choose member'));b.set(ms,'1');
ok('secretary: pledge auto-selected, balance shown',await b.until(()=>b.t().includes('owes K 300.00')));
b.fill('3. Amount paid',100);b.submit(b.form('Record pledge payment'));ok('secretary: pledge payment',await b.until(()=>b.t().includes('Pledge payment of K 100.00 recorded.')));
b.click(b.btn('Void'));ok('secretary: void entry (Main only)',await b.until(()=>b.t().includes('Entry voided.')));
b.click(b.btn('Attendance'));ok('secretary: attendance page',await b.until(()=>b.t().includes('Start or open a service')));
b.submit(b.form('Start or open a service'));ok('secretary: service register opens',await b.until(()=>b.t().includes('Find someone')&&b.t().includes('Peter Mwansa')));
b.fill('Full names','Test Visitor',b.form('Add a new person'));b.fill('Home address','Chilenje',b.form('Add a new person'));b.submit(b.form('Add a new person'));
ok('secretary: add visitor with no phone + present',await b.until(()=>b.t().includes('Test Visitor added. Marked present.')));
b.fill('Full names','Test Visitor',b.form('Add a new person'));b.fill('Home address','Chilenje',b.form('Add a new person'));b.submit(b.form('Add a new person'));
ok('secretary: duplicate refused',await b.until(()=>b.t().includes('already on the list')));
b.click(b.qa('button').find(x=>x.textContent==='Make member'));ok('secretary: visitor -> member',await b.until(()=>b.t().includes('is now a member.')));
b.click(b.btn('Reports'));ok('secretary: reports (Main only)',await b.until(()=>b.t().includes('Show report')&&b.t().includes('Total received')));

/* ---------- ADMIN OF ONE CHURCH (limited privileges) ---------- */
let n=await open('/admin/');ok('admin: login screen',await n.until(()=>n.t().includes('Admin Sign in')));
n.fill('Username','nipaadmin');n.fill('Password','demo1234');n.submit(n.form('Admin Sign in'));
ok('limited admin: only own church + only allowed tabs',await n.until(()=>n.t().includes('Churches · live')&&n.t().includes('NIPA FELLOWSHIP')&&!n.t().includes('Matero')&&n.btn('Events')&&n.btn('Attendance')&&n.btn('Reports')&&!n.btn('Units')&&!n.btn('Admins')&&!n.btn('Leaders')&&!n.btn('Accounts')&&!n.btn('Members')&&!n.btn('Audit log')&&!n.btn('Church profile')&&!n.btn('Assets')));
n.click(n.btn('Events'));await n.until(()=>n.t().includes('Add event'));n.fill('Event title','Nipa Youth Night',n.form('Add event'));n.set(n.q('input[type=date]'),'2030-01-01');n.fill('Venue','Nipa hall',n.form('Add event'));n.submit(n.form('Add event'));
ok('limited admin: must choose a church (cannot publish to everyone)',await n.until(()=>n.t().includes('Choose the church this is for.')));
let k=await open('/admin/');await k.until(()=>k.t().includes('Admin Sign in'));k.fill('Username','admin');k.fill('Password','demo1234');k.submit(k.form('Admin Sign in'));
ok('city centre admin: own area (Matero, Nipa) + Accounts/Members/Programs/Audit, no Super Admin tabs',await k.until(()=>k.t().includes('Matero Branch')&&k.t().includes('NIPA FELLOWSHIP')&&k.btn('Accounts')&&k.btn('Members')&&k.btn('Programs')&&k.btn('Audit log')&&!k.btn('Units')&&!k.btn('Admins')&&!k.btn('Leaders')&&!k.btn('Church profile')&&!k.btn('Assets')));

/* ---------- SUPER ADMIN (everything) ---------- */
let c=await open('/superadmin/');ok('super: login screen',await c.until(()=>c.t().includes('Super Admin Sign in')));
c.fill('Username','super');c.fill('Password','demo1234');c.submit(c.form('Super Admin Sign in'));
ok('super: overview of all churches with labels + every tab',await c.until(()=>c.t().includes('Churches · live')&&c.t().includes('Matero Branch')&&['Units','Admins','Leaders','Accounts','Members','Events','Programs','Attendance','Reports','Audit log','Church profile'].every(x=>c.btn(x))));
c.click(c.btn('Units'));await c.until(()=>c.t().includes('Add a centre, branch or fellowship'));c.fill('Name, e.g. Lusaka','Lusaka',c.form('Add a centre'));
ok('super: live label preview ("Lusaka Centre")',await c.until(()=>c.t().includes('It will appear as: Lusaka Centre')));c.submit(c.form('Add a centre'));ok('super: add centre',await c.until(()=>c.t().includes('Lusaka Centre added.')));
c.click(c.btn('Admins'));ok('super: admins page lists blocked privileges as reserved',await c.until(()=>c.t().includes('Create an admin')&&c.t().includes('Reserved for the Super Admin')&&c.t().includes('Promote or demote Leaders')));
const af=c.form('Create an admin');c.fill('Full name','Matero Admin',af);c.fill('Username','materoadmin',af);c.fill('Password (8+','Password1',af);c.set(af.querySelector('select'),'3');c.submit(af);ok('super: create admin with privileges',await c.until(()=>c.t().includes('Admin created.')));
c.click(c.btn('Leaders'));ok('super: leaders page',await c.until(()=>c.t().includes('Only the Super Admin can make someone a Leader')));
c.fill('Search anyone','Grace');c.submit(c.form('Search anyone')||c.qa('form')[0]);await c.until(()=>c.t().includes('Grace Phiri')&&c.btn('Make Leader'));c.click(c.btn('Make Leader'));
ok('super: promote member to Leader',await c.until(()=>c.t().includes('Grace Phiri is now a Leader.')&&c.btn('Remove Leader')));
c.click(c.btn('Church profile'));ok('super: profile + features page',await c.until(()=>c.t().includes('Features')&&c.t().includes('Church assets register — OFF')));
ok('super: Assets tab hidden while feature is off',!c.btn('Assets'));c.click(c.qa('input[type=checkbox]')[0]);
ok('super: switch assets ON -> tab appears',await c.until(()=>c.t().includes('Assets feature switched ON.')&&c.btn('Assets')));
c.click(c.btn('Assets'));await c.until(()=>c.t().includes('Add an asset'));const sf=c.form('Add an asset');c.fill('Item name','Microphone',sf);c.set(sf.querySelector('select'),'1');c.fill('Quantity','2',sf);c.fill('Value of each','500',sf);c.submit(sf);
ok('super: add asset, total value updates',await c.until(()=>c.t().includes('Asset added.')&&c.t().includes('K 13,000.00')));
c.click(c.btn('Accounts'));ok('super: accounts (2 secretary slots per church)',await c.until(()=>c.t().includes('Main Secretary')&&c.t().includes('Assistant Secretary')&&c.t().includes('@sec1')));
const cf=c.qa('form').filter(f=>f.textContent.includes('Create account'))[0];c.fill('Full name','New Asst',cf);c.fill('Username','nipa2',cf);c.fill('Password (8+','Password1',cf);c.submit(cf);ok('super: create secretary account',await c.until(()=>c.t().includes('Account created.')));
c.click(c.btn('Members'));ok('super: members',await c.until(()=>c.t().includes('Grace Phiri')&&c.t().includes('Reset password')));
c.click(c.btn('Reset password'));ok('super: member temporary password',await c.until(()=>c.t().includes('Temporary password for this member')));
c.click(c.btn('Events'));await c.until(()=>c.t().includes('Add event'));const ef=c.form('Add event');c.fill('Event title','Youth Night',ef);c.set(c.q('input[type=date]'),'2030-01-01');c.fill('Venue','Main hall',ef);c.fill('Latitude','-15.4167',ef);c.fill('Longitude','28.2833',ef);c.submit(ef);
ok('super: publish event with pin',await c.until(()=>c.t().includes('Event published to members.')));
c.fill('Latitude','51.5',c.form('Add event'));c.fill('Longitude','-0.12',c.form('Add event'));c.fill('Event title','Abroad',c.form('Add event'));c.set(c.q('input[type=date]'),'2030-01-01');c.fill('Venue','X',c.form('Add event'));c.submit(c.form('Add event'));
ok('super: pin outside Zambia refused',await c.until(()=>c.t().includes('inside Zambia')));
c.click(c.btn('Programs'));await c.until(()=>c.t().includes('Add pledge program'));c.fill('Church Building','Choir Robes',c.form('Add pledge program'));c.submit(c.form('Add pledge program'));ok('super: add program',await c.until(()=>c.t().includes('Program added.')));
c.click(c.btn('Attendance'));ok('super: rolled-up attendance (all churches, incl. new Lusaka Centre)',await c.until(()=>c.t().includes('Fellowship summary')&&c.t().includes('People directory')&&c.t().includes('Lusaka Centre')));
c.click(c.btn('Reports'));ok('super: reports',await c.until(()=>c.t().includes('Show report')&&c.t().includes('Total received')));
c.click(c.btn('Audit log'));ok('super: audit log shows leader + admin + unit actions',await c.until(()=>['make_leader','admin_create_admin','admin_add_unit','feature_assets'].every(x=>c.t().includes(x))));
ok('no browser errors during the whole run',errors.length===0);if(errors.length)console.log(errors.slice(0,3));
console.log(fails?`\n${fails} FAILED`:'\nAll click-through checks passed');process.exit(fails?1:0);
