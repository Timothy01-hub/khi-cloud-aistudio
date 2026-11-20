// In-browser DEMO backend with sample data. Same endpoints as the real Worker API. Used only by the preview build.
const tz='Africa/Lusaka',ymd=d=>d.toLocaleDateString('en-CA',{timeZone:tz}),D0=()=>ymd(new Date());
const plus=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)},mins=m=>new Date(Date.now()-m*6e4).toISOString();
let seq=100;const nid=()=>++seq;const PW='demo1234',S={m:null,s:null,d:null},fails={};
const inZambia=(a,b)=>a>=-18.08&&a<=-8.22&&b>=21.99&&b<=33.71;
const phoneN=s=>{let d=String(s||'').replace(/\D/g,'');if(d.length===12&&d.startsWith('260'))d='0'+d.slice(3);else if(d.length===9)d='0'+d;return d};
const DEPTS=['Ushering','Intercessory','Media','Protocol','Hospitality','Praise Team','Evangelism','Sanctuary Keeping'];
const E=(m,s=400)=>Object.assign(new Error(m),{status:s});
const o=(id,branch_id,type,category,amount,sender,note,by,age,extra={})=>({id,branch_id,type,category,amount,sender,note,recorded_by:by,voided:false,void_reason:null,created_at:mins(age),...extra});
const CATALOG=[
 {key:'app.member',label:'Member app',kind:'app',default_enabled:true,note:null},
 {key:'app.secretary',label:'Secretary app',kind:'app',default_enabled:true,note:null},
 {key:'app.admin',label:'Admin app',kind:'app',default_enabled:true,note:null},
 {key:'app.superadmin',label:'Super Admin app',kind:'app',default_enabled:true,note:null},
 {key:'member.menu.events',label:'Member menu: Events',kind:'menu',default_enabled:true,note:null},
 {key:'member.menu.pledges',label:'Member menu: Pledges',kind:'menu',default_enabled:true,note:null},
 {key:'member.menu.alerts',label:'Member menu: Alerts',kind:'menu',default_enabled:true,note:null},
 {key:'member.menu.account',label:'Member menu: Account',kind:'menu',default_enabled:true,note:null},
 {key:'member.menu.about',label:'Member menu: About us',kind:'menu',default_enabled:true,note:null},
 {key:'secretary.menu.attendance',label:'Secretary menu: Attendance',kind:'menu',default_enabled:true,note:null},
 {key:'secretary.menu.reports',label:'Secretary menu: Reports',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.accounts',label:'Admin menu: Accounts',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.members',label:'Admin menu: Members',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.events',label:'Admin menu: Events',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.programs',label:'Admin menu: Programs',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.attendance',label:'Admin menu: Attendance',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.reports',label:'Admin menu: Reports',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.assets',label:'Admin menu: Assets',kind:'menu',default_enabled:true,note:null},
 {key:'admin.menu.audit',label:'Admin menu: Audit log',kind:'menu',default_enabled:true,note:null},
 {key:'feature.self_checkin',label:'Member self check-in',kind:'feature',default_enabled:true,note:null},
 {key:'feature.departments',label:'Department choice at registration',kind:'feature',default_enabled:true,note:null},
 {key:'stub.sms',label:'SMS notifications',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.mobile_money',label:'Mobile-money payments',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.backups_export',label:'Backups and data export',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.multi_language',label:'Multi-language',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.audit_log_advanced',label:'Audit log (advanced)',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.api_keys',label:'API keys',kind:'stub',default_enabled:false,note:'Not built yet'},
 {key:'stub.payments_reports',label:'Payments reports',kind:'stub',default_enabled:false,note:'Not built yet'}
];
const db={
 branches:[{id:1,name:'KHI CITY CENTRE',kind:'center',parent_id:null,is_main:true,momo_number:'0971000001'},{id:2,name:'NIPA FELLOWSHIP',kind:'fellowship',parent_id:1,is_main:false,momo_number:null},{id:3,name:'Matero',kind:'branch',parent_id:1,is_main:false,momo_number:null}],
 staff:[{id:1,role:'admin',branch_id:1,privileges:['accounts','members','events','programs','attendance','reports','void','audit','assets'],username:'admin',full_name:'City Centre Admin',active:true},{id:5,role:'superadmin',branch_id:null,slot:null,privileges:[],username:'super',full_name:'Apostle Felix Mwamba',active:true},{id:6,role:'admin',branch_id:2,privileges:['events','attendance','reports'],username:'nipaadmin',full_name:'Nipa Admin',active:true},{id:2,role:'secretary',branch_id:1,slot:'main',username:'sec1',full_name:'Mary Banda',active:true},{id:3,role:'secretary',branch_id:1,slot:'assistant',username:'sec2',full_name:'Joe Zulu',active:true},{id:4,role:'secretary',branch_id:2,slot:'main',username:'nipa1',full_name:'Ruth Mumba',active:true}],
 dev_accounts:[{id:1,username:'timothy',full_name:'Timothy',active:true}],
 dev_audit:[],
 feature_flags:[],
 extra_settings:{},
 members:[{id:1,branch_id:1,full_name:'Grace Phiri',phone:'0971234567',must_change:false},{id:2,branch_id:1,full_name:'Peter Mwansa',phone:'0961234567',must_change:false},{id:3,branch_id:2,full_name:'Mary Tembo',phone:'0951234567',must_change:false}],
 people:[{id:1,branch_id:1,full_name:'Grace Phiri',address:'Plot 12, Kabulonga',phone:'0971234567',kind:'member',member_id:1,notes:''},{id:2,branch_id:1,full_name:'Peter Mwansa',address:'House 4, Roma',phone:'0961234567',kind:'member',member_id:2,notes:''},{id:3,branch_id:2,full_name:'Mary Tembo',address:'Nipa, Lusaka',phone:'0951234567',kind:'member',member_id:3,notes:''},{id:4,branch_id:1,full_name:'John Banda',address:'Chilenje, Lusaka',phone:null,kind:'visitor',member_id:null,notes:''},{id:5,branch_id:1,full_name:'Ruth Chanda',address:'Woodlands, Lusaka',phone:'0977000111',kind:'visitor',member_id:null,notes:''}],
 programs:[{id:1,branch_id:null,title:'Church Building Project',description:'Help us complete the new auditorium roof.',deadline:plus(60),location:'KHI City Centre, Lusaka',banner:null,lat:-15.4167,lng:28.2833,active:true},{id:2,branch_id:1,title:'Youth Camp 2026',description:'Annual youth camp for ages 13-25.',deadline:plus(30),location:null,banner:null,lat:null,lng:null,active:true}],
 pledges:[{id:1,member_id:1,program_id:1,amount:500},{id:2,member_id:2,program_id:1,amount:1000},{id:3,member_id:3,program_id:1,amount:300}],
 payments:[{id:1,pledge_id:1,amount:200,offering_id:3}],
 offerings:[o(1,1,'physical','Offering',850,null,null,'sec1',300),o(2,1,'digital','Offering',120,'0971234567',null,'webhook',200,{reference:'TXN1'}),o(3,1,'physical','Church Building Project',200,'Grace Phiri','Pledge #1','sec1',100),o(4,2,'physical','Tithe',400,'Mary Tembo',null,'nipa1',150)],
 events:[{id:1,branch_id:null,title:'Sunday Revival Service',event_date:plus(3),location:'KHI City Centre, Lusaka',description:'Come expecting a move of God.',banner:null,lat:-15.4167,lng:28.2833},{id:2,branch_id:1,title:'Prayer Night',event_date:D0(),location:'Main hall',description:'All welcome.',banner:null,lat:null,lng:null}],
 services:[{id:1,branch_id:1,service_date:D0(),service_type:'Sunday Service',is_open:true}],
 attendance:[{service_id:1,person_id:2,via:'secretary'}],
 notifications:[{id:1,member_id:1,message:'Payment of K 200.00 received for Church Building Project. Balance remaining: K 300.00',is_read:false,created_at:mins(90)}],
 audit:[{id:1,actor:'secretary:sec1',action:'record_physical',detail:'K 850.00 Offering',ip:'demo',created_at:mins(300)},{id:2,actor:'admin:admin',action:'login',detail:'',ip:'demo',created_at:mins(400)}],pw:{},features:{assets:false},profile:{vision:'To reach all nations for Christ',mission:"Raising true Christians who will impact nations with God's kingdom.",founded:2015,email:'kingdomheralds.info@gmail.com'},assets:[{id:1,branch_id:1,name:'Sound desk (32 channel)',category:'Media',quantity:1,value:12000,condition:'Good',acquired_on:'2023-03-01',notes:'',created_by:'admin'}]};
const KW={center:'Centre',branch:'Branch',fellowship:'Fellowship'};
const labelOf=b=>{if(!b)return'';const n=b.name.toUpperCase(),w=KW[b.kind].toUpperCase();return n.endsWith(w)||(b.kind==='center'&&n.endsWith('CENTER'))?b.name:b.name+' '+KW[b.kind]};
const bn=id=>labelOf(db.branches.find(b=>b.id===id)),U=b=>({...b,label:labelOf(b)});
const unitBrand=id=>{const u=db.branches.find(b=>b.id===id);if(!u)return{branch:'',centre:null};const branch=labelOf(u);let cur=u.parent_id,centre=null;const seen=new Set([u.id]);while(cur&&!seen.has(cur)){seen.add(cur);const p=db.branches.find(b=>b.id===cur);if(!p)break;if(p.kind==='center'){centre=labelOf(p);break}cur=p.parent_id}return{branch,centre}};
const brandText=id=>{const b=unitBrand(id);return b.centre?`${b.branch} · ${b.centre}`:b.branch};
const featureEnabled=(key,unitId=null)=>{let cur=unitId;const seen=new Set();while(cur!=null&&!seen.has(cur)){seen.add(cur);const fl=db.feature_flags.find(f=>f.key===key&&f.unit_id===cur);if(fl)return fl.enabled;const u=db.branches.find(b=>b.id===cur);cur=u?u.parent_id:null}const gl=db.feature_flags.find(f=>f.key===key&&f.unit_id===null);if(gl)return gl.enabled;const cat=CATALOG.find(c=>c.key===key);return cat?cat.default_enabled:false};
const myFeatures=(unitId=null)=>Object.fromEntries(CATALOG.filter(c=>c.kind!=='stub').map(c=>[c.key,featureEnabled(c.key,unitId)]));
const kids=id=>{const out=[id];db.branches.filter(b=>b.parent_id===id).forEach(c=>out.push(...kids(c.id)));return out};
const inSc=(S,id)=>!S||(Array.isArray(S)?S.includes(id):S===id);
const GRANT=[['accounts','Manage secretary accounts'],['members','Manage members (move, reset passwords)'],['events','Post events'],['programs','Manage pledge programs'],['attendance','View attendance'],['reports','View reports and downloads'],['void','Void entries'],['audit','View the audit log'],['assets','Manage church assets (when the feature is on)']];
const BLOCK=[['units','Add or edit centres, branches and fellowships'],['admins','Create admins or change their privileges'],['leaders','Promote or demote Leaders'],['features','Switch features on or off'],['profile','Edit the vision, mission and church profile']];
const paidOf=p=>db.payments.filter(x=>x.pledge_id===p.id).reduce((a,x)=>a+x.amount,0),balOf=p=>p.amount-paidOf(p);
const log=(actor,action,detail='')=>db.audit.unshift({id:nid(),actor,action,detail,ip:'demo',created_at:new Date().toISOString()});
const devLog=(devId,action,detail='')=>db.dev_audit.unshift({id:nid(),dev_id:devId,action,detail,ip:'demo',created_at:new Date().toISOString()});
const notify=(mid,message)=>db.notifications.unshift({id:nid(),member_id:mid,message,is_read:false,created_at:new Date().toISOString()});
const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pwOk=(k,p)=>(db.pw[k]||PW)===p;
const staffMe=role=>{const s=db.staff.find(x=>x.id===S.s&&x.active);if(!s||(role&&s.role!==role))throw E('Please sign in.',401);return s};
const memberMe=()=>{const m=db.members.find(x=>x.id===S.m);if(!m)throw E('Please sign in.',401);return m};
const devMe=()=>{const d=db.dev_accounts.find(x=>x.id===S.d&&x.active);if(!d)throw E('Not found',404);return d};
function pay(pl,amt,by,type){const m=db.members.find(x=>x.id===pl.member_id),pr=db.programs.find(x=>x.id===pl.program_id),a=Math.min(amt,balOf(pl));if(a<=0)return 0;
 const off=o(nid(),m.branch_id,type,pr.title,a,m.full_name,'Pledge #'+pl.id,by,0);db.offerings.unshift(off);db.payments.push({id:nid(),pledge_id:pl.id,amount:a,offering_id:off.id});
 const left=balOf(pl);notify(m.id,`Payment of ${money(a)} received for ${pr.title}. `+(left>0?'Balance remaining: '+money(left):'Your pledge is fully paid. God bless you!'));log(by,'pledge_payment',money(a)+' pledge #'+pl.id);return a}
function voidIt(id,reason,by,B){const f=db.offerings.find(x=>x.id===id&&!x.voided);if(!f||!inSc(B,f.branch_id)||!String(reason||'').trim())throw E('Cannot void this entry.');
 f.voided=true;f.void_reason=reason;db.payments=db.payments.filter(p=>{if(p.offering_id!==f.id)return true;const pl=db.pledges.find(x=>x.id===p.pledge_id);notify(pl.member_id,`A payment of ${money(p.amount)} was reversed by the church office. Your balance has been restored.`);return false});
 log(by,'void_offering','#'+id+' - '+reason);return{ok:true,message:'Entry voided.'}}
function totals(B){const live=db.offerings.filter(x=>!x.voided&&inSc(B,x.branch_id)),t=D0(),mo=t.slice(0,7),sum=(ty,f)=>live.filter(x=>x.type===ty&&f(ymd(new Date(x.created_at)))).reduce((a,x)=>a+x.amount,0);
 return{pToday:sum('physical',d=>d===t),dToday:sum('digital',d=>d===t),month:sum('physical',d=>d.startsWith(mo))+sum('digital',d=>d.startsWith(mo))}}
const feed=B=>({totals:totals(B),recent:db.offerings.filter(x=>inSc(B,x.branch_id)).slice(0,40).map(x=>({...x,bn:bn(x.branch_id)}))});
const owing=B=>db.pledges.filter(p=>balOf(p)>0&&db.members.find(m=>m.id===p.member_id).branch_id===B).map(p=>{const m=db.members.find(x=>x.id===p.member_id);return{id:p.id,member_id:m.id,member:m.full_name,phone:m.phone,program:db.programs.find(g=>g.id===p.program_id).title,balance:balOf(p)}});
const cnt=sid=>{const pe=db.attendance.filter(a=>a.service_id===sid).map(a=>db.people.find(p=>p.id===a.person_id));return{total:pe.length,members:pe.filter(p=>p.kind==='member').length,visitors:pe.filter(p=>p.kind==='visitor').length}};
const present=sid=>db.attendance.filter(a=>a.service_id===sid).map(a=>({...db.people.find(p=>p.id===a.person_id),bn:'',via:a.via}));
function attView(B,q){const sv=db.services.filter(s=>inSc(B,s.branch_id)).sort((a,b)=>b.service_date.localeCompare(a.service_date)||b.id-a.id),cur=sv.find(s=>String(s.id)===String(q.s||q.svc));
 const here=cur?new Set(db.attendance.filter(a=>a.service_id===cur.id).map(a=>a.person_id)):new Set(),ql=(q.q||'').toLowerCase(),dq=(q.dq||'').toLowerCase();
 const inB=p=>inSc(B,p.branch_id)&&(!q.branch||q.branch==='0'||String(p.branch_id)===q.branch),dir=db.people.filter(p=>inB(p)&&(!(q.dk||q.k)||p.kind===(q.dk||q.k))&&(!dq&&!ql||(dq?[p.full_name,p.phone,p.address].join(' ').toLowerCase().includes(dq):true)&&(ql&&!B?[p.full_name,p.phone].join(' ').toLowerCase().includes(ql):true))).map(p=>({...p,bn:bn(p.branch_id)}));
 return{services:sv.map(s=>({...s,count:cnt(s.id).total,bn:bn(s.branch_id)})),current:cur?{...cur,...cnt(cur.id)}:null,present:cur?present(cur.id).map(p=>({...p,bn:bn(p.branch_id)})):[],
  results:cur&&ql&&B?db.people.filter(p=>p.branch_id===B&&!here.has(p.id)&&[p.full_name,p.phone].join(' ').toLowerCase().includes(ql)).slice(0,10):[],directory:dir.slice(0,300),types:['Sunday Service','Midweek Service','Prayer Meeting','Youth Service','Other']}}
function report(f,Bfix){const fb=+f.branch||0,inB=id=>inSc(Bfix,id)&&(!fb||id===fb),k=f.kind;
 if(k==='people')return db.people.filter(p=>inB(p.branch_id)).map(p=>({Fellowship:bn(p.branch_id),Name:p.full_name,Type:p.kind,Phone:p.phone||'',Address:p.address}));
 if(k==='attendance')return db.attendance.map(a=>({a,s:db.services.find(x=>x.id===a.service_id),p:db.people.find(x=>x.id===a.person_id)})).filter(x=>inB(x.s.branch_id)&&x.s.service_date>=f.from&&x.s.service_date<=f.to).map(({a,s,p})=>({Date:s.service_date,Service:s.service_type,Fellowship:bn(s.branch_id),Name:p.full_name,Type:p.kind,Phone:p.phone||'',Address:p.address,Checked_in_by:a.via}));
 if(k==='pledges')return db.pledges.map(p=>({p,m:db.members.find(x=>x.id===p.member_id)})).filter(x=>inB(x.m.branch_id)).map(({p,m})=>({Member:m.full_name,Phone:m.phone,Fellowship:bn(m.branch_id),Program:db.programs.find(g=>g.id===p.program_id).title,Pledged:p.amount,Paid:paidOf(p),Balance:balOf(p)}));
 return db.offerings.filter(x=>inB(x.branch_id)&&ymd(new Date(x.created_at))>=f.from&&ymd(new Date(x.created_at))<=f.to&&(!f.type||x.type===f.type)).map(x=>({Date:x.created_at.slice(0,16).replace('T',' '),Fellowship:bn(x.branch_id),Type:x.type,Category:x.category,Given_by:x.sender||'',Reference:x.reference||'',Amount:x.amount,Status:x.voided?'VOIDED':''}))}
const dupe=(B,name,addr,phone,except=0)=>db.people.find(p=>p.branch_id===B&&p.id!==except&&((phone&&p.phone===phone)||(p.full_name.toLowerCase()===name.toLowerCase()&&p.address.toLowerCase()===addr.toLowerCase())));
function att(B,by,b){const sv=id=>db.services.find(s=>s.id===+id&&s.branch_id===B),pe=id=>db.people.find(p=>p.id===+id&&p.branch_id===B);
 if(b.a==='start'){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))throw E('Choose a valid date.');let s=db.services.find(x=>x.branch_id===B&&x.service_date===b.date&&x.service_type===b.type);if(!s){s={id:nid(),branch_id:B,service_date:b.date,service_type:b.type,is_open:true};db.services.push(s);log(by,'service_start',b.type+' '+b.date)}return{ok:true,id:s.id}}
 if(b.a==='toggle'){const s=sv(b.s);if(!s)throw E('Invalid service.');s.is_open=!s.is_open;return{ok:true}}
 if(b.a==='checkin'){const s=sv(b.s),p=pe(b.pid);if(!s||!p)throw E('Choose a service and a person.');if(!db.attendance.some(a=>a.service_id===s.id&&a.person_id===p.id))db.attendance.push({service_id:s.id,person_id:p.id,via:'secretary'});return{ok:true,message:p.full_name+' marked present.'}}
 if(b.a==='uncheck'){const s=sv(b.s);if(!s)throw E('Invalid service.');db.attendance=db.attendance.filter(a=>!(a.service_id===s.id&&a.person_id===+b.pid));log(by,'attendance_removed','service #'+s.id);return{ok:true,message:'Removed from this service.'}}
 if(b.a==='add'){const name=String(b.name||'').trim(),addr=String(b.address||'').trim(),ph=phoneN(b.phone)||null;if(!name||!addr)throw E('Full names and address are required.');if(ph&&ph.length<10)throw E('That phone number looks too short. Leave it blank if the person has no phone.');
  const d=dupe(B,name,addr,ph);if(d)throw E(d.full_name+' is already on the list. Search for them instead of adding again.');const p={id:nid(),branch_id:B,full_name:name,address:addr,phone:ph,kind:b.kind==='member'?'member':'visitor',member_id:null,notes:b.notes||''};db.people.push(p);log(by,'person_added',name);
  let m=name+' added.';const s=sv(b.s);if(b.present&&s){db.attendance.push({service_id:s.id,person_id:p.id,via:'secretary'});m+=' Marked present.'}return{ok:true,message:m}}
 if(b.a==='edit'){const p=pe(b.id);if(!p)throw E('Person not found.');const ph=p.member_id?p.phone:phoneN(b.phone)||null,n=String(b.name||'').trim(),ad=String(b.address||'').trim();if(!n||!ad)throw E('Full names and address are required.');if(dupe(B,n,ad,ph,p.id))throw E('Another person already has these details.');Object.assign(p,{full_name:n,address:ad,phone:ph,notes:b.notes||''});return{ok:true,message:'Details updated.'}}
 if(b.a==='convert'){const p=pe(b.id);if(p&&p.kind==='visitor'){p.kind='member';log(by,'visitor_to_member',p.full_name);return{ok:true,message:p.full_name+' is now a member.'}}throw E('Only a visitor can be made a member.')}
 throw E('Not found',404)}
const okDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s).toISOString().slice(0,10)===s;

export async function api(path,body){
 const [p,qs]=path.split('?'),q=Object.fromEntries(new URLSearchParams(qs||'')),post=body!==undefined,b=body||{};await Promise.resolve();
 return JSON.parse(JSON.stringify(route(p,q,b,post)||{ok:true}))}

function route(p,q,b,post){
 if(p==='/api/branches')return[...db.branches].sort((x,y)=>y.is_main-x.is_main||x.name.localeCompare(y.name)).map(U);
 if(p==='/api/mode')return{demo:true};
 if(p==='/api/about')return db.profile;
 if(p==='/api/features')return myFeatures(q.unit?+q.unit:null);
 /* ---------- member ---------- */
 if(p==='/api/departments')return featureEnabled('feature.departments',q.unit?+q.unit:null)?DEPTS:[];
 if(p==='/api/member/login'){const ph=phoneN(b.phone);if((fails[ph]||0)>=5)throw E('Too many failed attempts. Please wait 15 minutes and try again.',429);const m=db.members.find(x=>x.phone===ph);
  if(!m||!pwOk('m'+m.id,b.password)){fails[ph]=(fails[ph]||0)+1;throw E('Wrong phone number or password.',401)}
  if(!featureEnabled('app.member',m.branch_id))throw E('This app is currently disabled.',403);
  fails[ph]=0;S.m=m.id;return{ok:true}}
 if(p==='/api/member/logout'){S.m=null;return{ok:true}}
 if(p==='/api/member/register'){
  const br=+b.branch;
  if(!featureEnabled('app.member',br||null))throw E('This app is currently disabled.',403);
  const deptOn=featureEnabled('feature.departments',br||null);
  const dept=deptOn?String(b.department||''):'';
  const v={name:String(b.name||'').trim(),phone:phoneN(b.phone),address:String(b.address||'').trim(),branch:br,birth:String(b.birth||''),marriage:String(b.marriage||'')};
  const err=!v.name?'Please enter your full name.':v.phone.length<10?'Enter a valid phone number, e.g. 0971234567.':!v.address?'Please enter your home address.':!db.branches.some(x=>x.id===v.branch)?'Please choose your fellowship.':dept&&!DEPTS.includes(dept)?'Please choose a valid department.':String(b.password||'').length<6?'Password must be at least 6 characters.':b.password!==b.password2?'The two passwords do not match.':!okDate(v.birth)||v.birth>D0()||v.birth<'1900-01-01'?'Please enter a valid date of birth.':v.marriage&&(!okDate(v.marriage)||v.marriage>D0()||v.marriage<=v.birth)?'Please enter a valid date of marriage (after your date of birth, not in the future).':!b.agree?'Please accept the Privacy Notice to register.':'';
  if(err)throw E(err);if(db.members.some(x=>x.phone===v.phone))throw E(`This number (${v.phone}) is already registered. Try signing in instead.`);
  const m={id:nid(),branch_id:v.branch,full_name:v.name,phone:v.phone,must_change:false,birth_date:v.birth,marriage_date:v.marriage||null,department:dept||null};db.members.push(m);db.pw['m'+m.id]=b.password;
  const pe=db.people.find(x=>x.branch_id===v.branch&&x.phone===v.phone&&!x.member_id);if(pe)Object.assign(pe,{kind:'member',member_id:m.id,full_name:v.name,address:v.address,department:dept||null});else db.people.push({id:nid(),branch_id:v.branch,full_name:v.name,address:v.address,phone:v.phone,kind:'member',member_id:m.id,notes:'',department:dept||null});return{ok:true}}
 if(p.startsWith('/api/member/')){const me=memberMe(),B=me.branch_id,D=D0(),pe=db.people.find(x=>x.member_id===me.id);
  if(!featureEnabled('app.member',B))throw E('This app is currently disabled.',403);
  const feats=myFeatures(B);
  const progs=()=>db.programs.filter(g=>g.active&&(g.branch_id===null||g.branch_id===B)&&(!g.deadline||g.deadline>=D)),unread=()=>feats['member.menu.alerts']?db.notifications.filter(n=>n.member_id===me.id&&!n.is_read).length:0;
  if(p==='/api/member/count')return{unread:unread()};
  if(p==='/api/member/home')return{me:{name:me.full_name,branch:bn(B),brand:brandText(B),mustChange:me.must_change},today:D,unread:unread(),features:feats,
   programs:feats['member.menu.pledges']?progs():[],
   events:feats['member.menu.events']?db.events.filter(e=>e.event_date>=D&&(e.branch_id===null||e.branch_id===B)).sort((x,y)=>x.event_date.localeCompare(y.event_date)):[],
   pledges:feats['member.menu.pledges']?db.pledges.filter(x=>x.member_id===me.id).map(x=>({id:x.id,title:db.programs.find(g=>g.id===x.program_id).title,amount:x.amount,paid:paidOf(x)})):[],
   services:feats['feature.self_checkin']?db.services.filter(s=>s.branch_id===B&&s.service_date===D&&s.is_open).map(s=>({id:s.id,type:s.service_type,here:!!pe&&db.attendance.some(a=>a.service_id===s.id&&a.person_id===pe.id)})):[]};
  if(p==='/api/member/alerts'){if(!feats['member.menu.alerts'])throw E('Alerts are currently disabled.',403);const items=db.notifications.filter(n=>n.member_id===me.id).slice(0,50).map(n=>({...n}));db.notifications.forEach(n=>{if(n.member_id===me.id)n.is_read=true});return{items}}
  if(p==='/api/member/checkin'){if(!feats['feature.self_checkin'])throw E('Self check-in is currently disabled.',403);const s=db.services.find(x=>x.id===+b.id&&x.branch_id===B&&x.service_date===D&&x.is_open);if(!s||!pe)throw E('This service is not open for check-in.');if(!db.attendance.some(a=>a.service_id===s.id&&a.person_id===pe.id))db.attendance.push({service_id:s.id,person_id:pe.id,via:'self'});return{ok:true,message:'You are checked in. God bless you!'}}
  if(p==='/api/member/pledge'){if(!feats['member.menu.pledges'])throw E('Pledges are currently disabled.',403);const a=Math.round(parseFloat(b.amount)*100)/100,g=progs().find(x=>x.id===+b.program);if(!g||!(a>=1&&a<1e7))throw E('Choose a program and enter a valid amount.');
   let pl=db.pledges.find(x=>x.member_id===me.id&&x.program_id===g.id);if(pl)pl.amount+=a;else db.pledges.push(pl={id:nid(),member_id:me.id,program_id:g.id,amount:a});return{ok:true,message:`Thank you! Your pledge to ${g.title} is now ${money(pl.amount)}.`}}
  if(p==='/api/member/password'){if(!feats['member.menu.account'])throw E('Account settings are currently disabled.',403);const n=String(b.new||'');if(n.length<6||n!==b.new2)throw E('New passwords must match and be 6+ characters.');if(!pwOk('m'+me.id,b.old))throw E('Current password is wrong.');db.pw['m'+me.id]=n;me.must_change=false;return{ok:true,message:'Password changed.'}}}
 /* ---------- staff ---------- */
 if(p==='/api/staff/login'){const role=b.app==='superadmin'?'superadmin':b.app==='admin'?'admin':'secretary',s=db.staff.find(x=>x.username===String(b.username||'').trim()&&x.role===role&&x.active),k='s:'+(b.username||'');
  if((fails[k]||0)>=5)throw E('Too many failed attempts. Please wait 15 minutes and try again.',429);if(!s||!pwOk('s'+s.id,b.password)){fails[k]=(fails[k]||0)+1;throw E('Invalid login or account disabled.',401)}
  if(!featureEnabled('app.'+role,s.branch_id||null))throw E('This app is currently disabled.',403);
  fails[k]=0;S.s=s.id;log(role+':'+s.username,'login');return{ok:true}}
 if(p==='/api/staff/logout'){S.s=null;return{ok:true}}
 if(p.startsWith('/api/staff/')){const me=staffMe('secretary'),B=me.branch_id,by=me.username;
  if(!featureEnabled('app.secretary',B))throw E('This app is currently disabled.',403);
  const feats=myFeatures(B);
  if(p==='/api/staff/feed')return feed(B);
  if(p==='/api/staff/home')return{me:{name:me.full_name,branch:bn(B),brand:brandText(B),slot:me.slot,canVoid:me.slot==='main'},features:feats,...feed(B),owing:owing(B)};
  if(p==='/api/staff/cash'){const a=Math.round(parseFloat(b.amount)*100)/100;if(!(a>0&&a<1e7))throw E('Enter a valid amount.');const cat=['Offering','Tithe','Seed','Thanksgiving','Building Fund'].includes(b.category)?b.category:'Offering';
   db.offerings.unshift(o(nid(),B,'physical',cat,a,String(b.sender||'').trim()||null,String(b.note||'').trim()||null,by,0));log('secretary:'+by,'record_physical',money(a)+' '+cat);return{ok:true,message:'Recorded '+money(a)+'.'}}
  if(p==='/api/staff/pledge-payment'){const pl=db.pledges.find(x=>x.id===+b.pledge),a=Math.round(parseFloat(b.amount)*100)/100;if(!pl||db.members.find(m=>m.id===pl.member_id).branch_id!==B)throw E('Choose a pledge from your fellowship.');if(!(a>0))throw E('Enter a valid amount.');
   const d=pay(pl,a,by,'physical');if(!d)throw E('Nothing to record: that pledge is already fully paid.');return{ok:true,message:'Pledge payment of '+money(d)+' recorded.'}}
  if(p==='/api/staff/void'){if(me.slot!=='main')throw E('Only the Main Secretary can void entries.',403);return voidIt(+b.id,b.reason,by,B)}
  if(p==='/api/staff/attendance'){if(!feats['secretary.menu.attendance'])throw E('Attendance is currently disabled.',403);return{...attView(B,q),me:{branch:bn(B),brand:brandText(B),slot:me.slot},features:feats}}
  if(p==='/api/staff/att'){if(!feats['secretary.menu.attendance'])throw E('Attendance is currently disabled.',403);return att(B,by,b)}
  if(p==='/api/staff/report'){if(me.slot!=='main')throw E('Only the Main Secretary can open reports.',403);if(!feats['secretary.menu.reports'])throw E('Reports are currently disabled.',403);return{rows:report(q,B),me:{branch:bn(B),brand:brandText(B)}}}
  throw E('Not found',404)}
 /* ---------- admin (one church + everything beneath it, chosen privileges) and Super Admin (everything) ---------- */
 if(p.startsWith('/api/admin/')){const me=staffMe(),isSuper=me.role==='superadmin';if(!isSuper&&me.role!=='admin')throw E('Please sign in.',401);
  const unitScope=isSuper?null:me.branch_id;
  if(!featureEnabled(isSuper?'app.superadmin':'app.admin',unitScope))throw E('This app is currently disabled.',403);
  const flagOn=k=>featureEnabled('admin.menu.'+k,unitScope);
  const scope=isSuper?null:kids(me.branch_id),can=pr=>isSuper||(me.privileges||[]).includes(pr),need=pr=>{if(!can(pr))throw E('You do not have permission for that.',403)},sup=()=>{if(!isSuper)throw E('Only the Super Admin can do that.',403)};
  const needFlag=k=>{if(!flagOn(k))throw E('This feature is currently disabled.',403)};
  const by=me.username,tag=me.role+':'+by,units=()=>db.branches.filter(x=>inSc(scope,x.id)).map(U),sum=(arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  const latest=id=>{const s=db.services.filter(v=>v.branch_id===id).sort((a,c)=>c.service_date.localeCompare(a.service_date))[0];return s?s.service_date+' · '+cnt(s.id).total:null};
  if(p==='/api/admin/me'){const tabs=['overview',...(isSuper?['units','admins','leaders']:[]),...(can('accounts')&&flagOn('accounts')?['accounts']:[]),...(can('members')&&flagOn('members')?['members']:[]),...(can('events')&&flagOn('events')?['events']:[]),...(can('programs')&&flagOn('programs')?['programs']:[]),...(can('attendance')&&flagOn('attendance')?['attendance']:[]),...(can('reports')&&flagOn('reports')?['reports']:[]),...(db.features.assets&&can('assets')&&flagOn('assets')?['assets']:[]),...(can('audit')&&flagOn('audit')?['audit']:[]),...(isSuper?['profile']:[])];
   return{role:me.role,name:me.full_name,tabs,unit:isSuper?'KINGDOM HERALDS INTERNATIONAL CHURCH':bn(me.branch_id),brand:isSuper?'KINGDOM HERALDS INTERNATIONAL CHURCH':brandText(me.branch_id),privileges:me.privileges||[],features:myFeatures(unitScope)}}
  if(p==='/api/admin/overview')return{rows:units().map(x=>({id:x.id,name:x.label,is_main:x.is_main,kind:x.kind,...(t=>({today:t.pToday+t.dToday,month:t.month}))(totals(x.id))})),...feed(scope)};
  /* units: only the Super Admin */
  if(p==='/api/admin/fellowships'){sup();if(!post)return db.branches.map(U);
   const par=b.parent?+b.parent:null,kind=['center','branch','fellowship'].includes(b.kind)?b.kind:'fellowship';
   if(b.a==='add'){const n=String(b.name||'').trim();if(!n)throw E('Enter a name.');if(db.branches.some(x=>x.name.toUpperCase()===n.toUpperCase()&&x.kind===kind))throw E('That church already exists.');if(par&&!db.branches.some(x=>x.id===par))throw E('Choose a valid parent.');
    const u={id:nid(),name:n,kind,parent_id:par,is_main:false,momo_number:b.momo||null};db.branches.push(u);log(tag,'admin_add_unit',labelOf(u));return{ok:true,message:labelOf(u)+' added.'}}
   const f=db.branches.find(x=>x.id===+b.id);if(!f)throw E('Not found',404);if(par&&kids(f.id).includes(par))throw E('A unit cannot sit under itself or under one of its own fellowships.');
   f.name=String(b.name||'').trim()||f.name;if(b.kind)f.kind=kind;f.parent_id=par;f.momo_number=b.momo||null;log(tag,'admin_edit_unit',labelOf(f));return{ok:true,message:'Saved.'}}
  /* admins and their privileges: only the Super Admin; blocked privileges can never be granted */
  if(p==='/api/admin/admins'){sup();return{admins:db.staff.filter(s=>s.role==='admin').map(s=>({id:s.id,username:s.username,full_name:s.full_name,branch_id:s.branch_id,unit:bn(s.branch_id),privileges:s.privileges,active:s.active})),units:db.branches.map(U),grantable:GRANT,blocked:BLOCK}}
  if(p==='/api/admin/admin'){sup();const chk=a=>{const bad=(a||[]).find(x=>!GRANT.some(g=>g[0]===x));if(bad)throw E(`"${bad}" is reserved for the Super Admin and cannot be given to an admin.`);return a||[]};
   if(b.a==='create'){if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');if(!db.branches.some(x=>x.id===+b.branch))throw E('Choose the church this admin will run.');if(db.staff.some(s=>s.username===String(b.username).trim()))throw E('That username is already taken.');
    const s={id:nid(),role:'admin',branch_id:+b.branch,privileges:chk(b.privileges),username:String(b.username).trim(),full_name:String(b.name).trim(),active:true};db.staff.push(s);db.pw['s'+s.id]=b.password;log(tag,'admin_create_admin',s.username);return{ok:true,message:'Admin created.'}}
   const s=db.staff.find(x=>x.id===+b.id&&x.role==='admin');if(!s)throw E('Not found',404);
   if(b.a==='privileges'){s.privileges=chk(b.privileges);log(tag,'admin_set_privileges',s.username);return{ok:true,message:'Privileges saved.'}}
   if(b.a==='password'){if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');db.pw['s'+s.id]=b.password;log(tag,'admin_reset',s.username);return{ok:true,message:'Password changed.'}}
   if(b.a==='toggle'){s.active=!s.active;return{ok:true,message:s.active?'Admin enabled.':'Admin disabled.'}}
   if(b.a==='delete'){db.staff=db.staff.filter(x=>x!==s);log(tag,'admin_delete_admin',s.username);return{ok:true,message:'Admin deleted.'}}}
  /* leaders: only the Super Admin */
  if(p==='/api/admin/leaders'){sup();
   if(!post){const ql=(q.q||'').toLowerCase();return{people:db.people.filter(x=>!ql||[x.full_name,x.phone||''].join(' ').toLowerCase().includes(ql)).sort((a,c)=>(c.kind==='leader')-(a.kind==='leader')||a.full_name.localeCompare(c.full_name)).slice(0,60).map(x=>({...x,bn:bn(x.branch_id)}))}}
   const x=db.people.find(y=>y.id===+b.id);if(!x)throw E('Person not found.');if(b.make){x.kind='leader';x.leader_since=D0()}else{x.kind='member';x.leader_since=null}
   log(tag,b.make?'make_leader':'remove_leader',x.full_name);return{ok:true,message:x.full_name+(b.make?' is now a Leader.':' is no longer a Leader.')}}
  /* profile + features: only the Super Admin */
  if(p==='/api/admin/profile'){sup();if(!post)return{profile:db.profile,features:db.features};
   if(b.feature==='assets'){db.features.assets=!!b.on;log(tag,'feature_assets',b.on?'on':'off');return{ok:true,message:'Assets feature switched '+(b.on?'ON':'OFF')+'.'}}
   const pr=b.profile||{};if(!String(pr.vision||'').trim()||!String(pr.mission||'').trim())throw E('Vision and mission cannot be empty.');
   db.profile={vision:pr.vision.trim(),mission:pr.mission.trim(),founded:+pr.founded||db.profile.founded,email:String(pr.email||'').trim()};log(tag,'profile_edit');return{ok:true,message:'Profile saved.'}}
  /* secretary accounts (privilege: accounts) */
  if(p==='/api/admin/accounts'){need('accounts');needFlag('accounts');return{fellowships:units().sort((x,y)=>y.is_main-x.is_main).map(x=>({id:x.id,name:x.name,label:x.label,is_main:x.is_main,slots:{main:db.staff.find(s=>s.role==='secretary'&&s.branch_id===x.id&&s.slot==='main')||null,assistant:db.staff.find(s=>s.role==='secretary'&&s.branch_id===x.id&&s.slot==='assistant')||null}})),me:{username:by}}}
  if(p==='/api/admin/account'){need('accounts');if(b.a!=='own')needFlag('accounts');
   if(b.a==='create'){if(!inSc(scope,+b.branch))throw E('That church is outside your area.',403);if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');if(db.staff.some(s=>s.username===String(b.username).trim()))throw E('That username is already taken.');if(db.staff.some(s=>s.role==='secretary'&&s.branch_id===+b.branch&&s.slot===b.slot))throw E('That slot already has an account.');
    const s={id:nid(),role:'secretary',branch_id:+b.branch,slot:b.slot,username:String(b.username).trim(),full_name:String(b.name).trim(),active:true,privileges:[]};db.staff.push(s);db.pw['s'+s.id]=b.password;log(tag,'admin_create',s.username);return{ok:true,message:'Account created.'}}
   if(b.a==='own'){if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');db.pw['s'+me.id]=b.password;return{ok:true,message:'Your password changed.'}}
   const s=db.staff.find(x=>x.id===+b.id&&x.role==='secretary'&&inSc(scope,x.branch_id));if(!s)throw E('Not found',404);
   if(b.a==='password'){if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');db.pw['s'+s.id]=b.password;log(tag,'admin_reset',s.username);return{ok:true,message:'Password changed.'}}
   if(b.a==='toggle'){s.active=!s.active;log(tag,'admin_toggle',s.username);return{ok:true,message:s.active?'Account enabled.':'Account disabled.'}}
   if(b.a==='delete'){db.staff=db.staff.filter(x=>x!==s);log(tag,'admin_delete',s.username);return{ok:true,message:'Account deleted.'}}}
  /* members (privilege: members) */
  if(p==='/api/admin/members'){need('members');needFlag('members');return{fellowships:units(),rows:db.members.filter(m=>inSc(scope,m.branch_id)).map(m=>({...m,pledged:sum(db.pledges.filter(x=>x.member_id===m.id),x=>x.amount),paid:sum(db.pledges.filter(x=>x.member_id===m.id),paidOf)}))}}
  if(p==='/api/admin/member'){need('members');needFlag('members');const m=db.members.find(x=>x.id===+b.id&&inSc(scope,x.branch_id));if(!m)throw E('Not found',404);
   if(b.a==='move'){if(!inSc(scope,+b.branch))throw E('You can only move members within your own area.',403);m.branch_id=+b.branch;db.people.forEach(x=>{if(x.member_id===m.id)x.branch_id=m.branch_id});log(tag,'admin_move_member','#'+m.id);return{ok:true,message:'Member moved.'}}
   if(b.a==='reset'){const t=Math.random().toString(36).slice(2,10);db.pw['m'+m.id]=t;m.must_change=true;log(tag,'admin_reset_member','#'+m.id);return{ok:true,message:`Temporary password for this member: ${t} (shown once; they must change it at next login).`}}}
  /* events + programs (privileges: events, programs) */
  if(p==='/api/admin/content'){if(!can('events')&&!can('programs'))throw E('You do not have permission for that.',403);const vis=id=>isSuper||(id!==null&&scope.includes(id));
   return{canAll:isSuper,events:flagOn('events')?db.events.filter(e=>vis(e.branch_id)).sort((x,y)=>y.event_date.localeCompare(x.event_date)):[],fellowships:units(),programs:flagOn('programs')?db.programs.filter(g=>vis(g.branch_id)).reverse().map(g=>({...g,pledged:sum(db.pledges.filter(x=>x.program_id===g.id),x=>x.amount),paid:sum(db.pledges.filter(x=>x.program_id===g.id),paidOf)})):[]}}
  if(p==='/api/admin/event'||p==='/api/admin/program'){const ev=p.endsWith('event');need(ev?'events':'programs');needFlag(ev?'events':'programs');const owns=x=>x&&(isSuper||(x.branch_id!==null&&scope.includes(x.branch_id)));
   if(b.a==='delete'){const e=db.events.find(x=>x.id===+b.id);if(!owns(e))throw E('Not found',404);db.events=db.events.filter(x=>x!==e);log(tag,'admin_delete_event',e.title);return{ok:true,message:'Event deleted.'}}
   if(b.a==='toggle'){const g=db.programs.find(x=>x.id===+b.id);if(!owns(g))throw E('Not found',404);g.active=!g.active;return{ok:true}}
   const br=b.branch===''||b.branch==null?null:+b.branch;if(br===null&&!isSuper)throw E('Choose the church this is for.');if(br!==null&&!inSc(scope,br))throw E('That church is outside your area.',403);
   const lat=b.lat===''||b.lat==null?null:+b.lat,lng=b.lng===''||b.lng==null?null:+b.lng;if((lat===null)!==(lng===null)||(lat!==null&&!inZambia(lat,lng)))throw E('The location must be a valid point inside Zambia.');
   if(!String(b.title||'').trim())throw E('Enter a title.');
   if(ev){if(!b.date||!String(b.location||'').trim())throw E('Enter the date and the venue.');db.events.push({id:nid(),branch_id:br,title:b.title.trim(),event_date:b.date,location:b.location.trim(),description:b.description||'',banner:b.banner||null,lat,lng});log(tag,'admin_add_event',b.title);return{ok:true,message:'Event published to members.'}}
   db.programs.push({id:nid(),branch_id:br,title:b.title.trim(),description:b.description||'',deadline:b.deadline||null,location:b.location||null,banner:b.banner||null,lat,lng,active:true});log(tag,'admin_add_program',b.title);return{ok:true,message:'Program added.'}}
  /* assets (privilege: assets, and the feature must be switched on) */
  if(p==='/api/admin/assets'){if(!db.features.assets||!flagOn('assets'))throw E('The assets feature is switched off.',403);need('assets');
   if(!post)return{rows:db.assets.filter(a=>inSc(scope,a.branch_id)).map(a=>({...a,bn:bn(a.branch_id)})),units:units()};
   if(b.a==='delete'){const a=db.assets.find(x=>x.id===+b.id&&inSc(scope,x.branch_id));if(!a)throw E('Not found',404);db.assets=db.assets.filter(x=>x!==a);log(tag,'asset_deleted',a.name);return{ok:true,message:'Asset removed.'}}
   const br=+b.branch,qty=parseInt(b.quantity||1,10),val=b.value===''||b.value==null?null:+b.value;
   if(!db.branches.some(x=>x.id===br)||!inSc(scope,br))throw E('Choose a church in your area.');if(!String(b.name||'').trim())throw E('Enter the item name.');if(!(qty>0))throw E('Quantity must be at least 1.');if(val!==null&&!(val>=0))throw E('Enter a valid value.');if(!['New','Good','Fair','Poor','Needs repair'].includes(b.condition))throw E('Choose a condition.');
   db.assets.push({id:nid(),branch_id:br,name:b.name.trim(),category:b.category||'',quantity:qty,value:val,condition:b.condition,acquired_on:b.acquired_on||null,notes:b.notes||'',created_by:by});log(tag,'asset_added',b.name);return{ok:true,message:'Asset added.'}}
  /* attendance, reports, audit, void */
  if(p==='/api/admin/attendance'){need('attendance');needFlag('attendance');const v=attView(scope,q),us=units();return{summary:us.map(x=>({id:x.id,name:x.label,members:db.people.filter(y=>y.branch_id===x.id&&y.kind!=='visitor').length,visitors:db.people.filter(y=>y.branch_id===x.id&&y.kind==='visitor').length,latest:latest(x.id)})),services:v.services.filter(s=>!+q.branch||String(s.branch_id)===q.branch),present:v.present,people:v.directory,fellowships:us}}
  if(p==='/api/admin/report'){need('reports');needFlag('reports');return{rows:report(q,scope),fellowships:units()}}
  if(p==='/api/admin/audit'){need('audit');needFlag('audit');const mine=r=>{const u=(r.actor||'').split(':')[1],s=db.staff.find(x=>x.username===u);return !!s&&s.branch_id!=null&&scope.includes(s.branch_id)};return{rows:db.audit.filter(r=>isSuper||mine(r)).slice(0,300)}}
  if(p==='/api/admin/void'){need('void');return voidIt(+b.id,b.reason,by,scope)}
  throw E('Not found',404)}
 /* ---------- developer (hidden /dev/, invisible to every other role) ---------- */
 if(p==='/api/dev/gate'){if(S.d&&db.dev_accounts.some(x=>x.id===S.d&&x.active))return{ok:true};if(S.m||S.s)throw E('Not found',404);return{login:true}}
 if(p==='/api/dev/logout'){S.d=null;return{ok:true}}
 if(p==='/api/dev/login'){const un=String(b.username||'').trim(),k='d:'+un.toLowerCase();
  if((fails[k]||0)>=5)throw E('Too many failed attempts. Please wait 15 minutes and try again.',429);
  const d=db.dev_accounts.find(x=>x.username===un&&x.active);
  if(!d||!pwOk('d'+d.id,b.password)){fails[k]=(fails[k]||0)+1;throw E('Invalid login or account disabled.',401)}
  fails[k]=0;S.d=d.id;devLog(d.id,'login',d.username);return{ok:true}}
 if(p.startsWith('/api/dev/')){const me=devMe();
  if(p==='/api/dev/me')return{dev:{id:me.id,username:me.username,full_name:me.full_name},units:db.branches.map(U),catalog:CATALOG,flags:db.feature_flags};
  if(p==='/api/dev/password'){const pw=String(b.password||'');if(pw.length<10)throw E('Developer password must be 10+ characters.');db.pw['d'+me.id]=pw;devLog(me.id,'change_password');return{ok:true,message:'Developer password updated.'}}
  if(p==='/api/dev/flags'){
   if(!post){const uid=q.unit?+q.unit:null;return{catalog:CATALOG,flags:db.feature_flags,units:db.branches.map(U),effective:Object.fromEntries(CATALOG.map(c=>[c.key,featureEnabled(c.key,uid)]))}}
   const key=String(b.key||'');if(!CATALOG.some(c=>c.key===key))throw E('Unknown feature flag.');
   const uid=b.unit_id===''||b.unit_id==null?null:+b.unit_id;
   if(uid!==null&&!db.branches.some(x=>x.id===uid))throw E('Unknown unit.');
   if(b.enabled===null||b.enabled==='default'){db.feature_flags=db.feature_flags.filter(f=>!(f.key===key&&f.unit_id===uid));devLog(me.id,'flag_clear',`${key}@${uid??'global'}`);return{ok:true,message:'Flag reset to inherited/default.'}}
   const on=!!b.enabled;const ex=db.feature_flags.find(f=>f.key===key&&f.unit_id===uid);
   if(ex)ex.enabled=on;else db.feature_flags.push({id:nid(),key,unit_id:uid,enabled:on});
   devLog(me.id,'flag_set',`${key}@${uid??'global'}=${on}`);return{ok:true,message:`${key} set to ${on?'ON':'OFF'} (${uid?bn(uid):'Global'}).`}}
  if(p==='/api/dev/users'){
   if(!post)return{staff:db.staff.map(s=>({...s,unit:s.branch_id?bn(s.branch_id):'All'})),members:db.members.map(m=>({...m,unit:bn(m.branch_id)})),people:db.people.map(x=>({...x,unit:bn(x.branch_id)})),devAccounts:db.dev_accounts,units:db.branches.map(U),grantable:GRANT};
   const t=b.target;
   if(t==='staff'){
    const chkPrivs=(role,privs)=>{if(role!=='admin')return[];const bad=(privs||[]).find(x=>!GRANT.some(g=>g[0]===x));if(bad)throw E(`"${bad}" is reserved for the Super Admin.`);return privs||[]};
    if(b.a==='create'){const role=['superadmin','admin','secretary'].includes(b.role)?b.role:'secretary',br=role==='superadmin'?null:+b.branch,slot=role==='secretary'?(b.slot==='assistant'?'assistant':'main'):null;
     if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');
     if(role!=='superadmin'&&!db.branches.some(x=>x.id===br))throw E('Choose a church unit.');
     if(db.staff.some(s=>s.username===String(b.username||'').trim()))throw E('Username already taken.');
     if(role==='secretary'&&db.staff.some(s=>s.role==='secretary'&&s.branch_id===br&&s.slot===slot))throw E('That slot already has a secretary.');
     const s={id:nid(),role,branch_id:br,slot,privileges:chkPrivs(role,b.privileges),username:String(b.username||'').trim(),full_name:String(b.name||'').trim(),active:true};
     db.staff.push(s);db.pw['s'+s.id]=b.password;devLog(me.id,'dev_create_staff',`${role}:${s.username}`);return{ok:true,message:'Staff account created.'}}
    const s=db.staff.find(x=>x.id===+b.id);if(!s)throw E('Not found',404);
    if(b.a==='update'){const role=['superadmin','admin','secretary'].includes(b.role)?b.role:s.role,br=role==='superadmin'?null:+b.branch_id,slot=role==='secretary'?(b.slot==='assistant'?'assistant':'main'):null;
     if(role!=='superadmin'&&!db.branches.some(x=>x.id===br))throw E('Choose a church unit.');
     Object.assign(s,{role,branch_id:br,slot,full_name:String(b.full_name||s.full_name).trim(),username:String(b.username||s.username).trim(),privileges:chkPrivs(role,b.privileges),active:b.active!==undefined?!!b.active:s.active});
     devLog(me.id,'dev_update_staff',s.username);return{ok:true,message:'Staff updated.'}}
    if(b.a==='password'){if(String(b.password||'').length<8)throw E('Password must be 8+ characters.');db.pw['s'+s.id]=b.password;devLog(me.id,'dev_set_staff_password',s.username);return{ok:true,message:'Staff password updated.'}}
    if(b.a==='delete'){db.staff=db.staff.filter(x=>x!==s);devLog(me.id,'dev_delete_staff',s.username);return{ok:true,message:'Staff deleted.'}}}
   if(t==='member'){
    if(b.a==='create'){const ph=phoneN(b.phone),br=+b.branch_id;if(!String(b.full_name||'').trim()||ph.length<10||!db.branches.some(x=>x.id===br)||String(b.password||'').length<6)throw E('Enter name, valid phone, unit and 6+ password.');
     if(db.members.some(x=>x.phone===ph))throw E('Phone already registered.');
     const m={id:nid(),branch_id:br,full_name:b.full_name.trim(),phone:ph,must_change:!!b.must_change,birth_date:b.birth_date||'1990-01-01',marriage_date:b.marriage_date||null,department:b.department||null};
     db.members.push(m);db.pw['m'+m.id]=b.password;db.people.push({id:nid(),branch_id:br,full_name:m.full_name,address:b.address||'Lusaka',phone:ph,kind:'member',member_id:m.id,notes:''});
     devLog(me.id,'dev_create_member',m.full_name);return{ok:true,message:'Member created.'}}
    const m=db.members.find(x=>x.id===+b.id);if(!m)throw E('Not found',404);
    if(b.a==='update'){const br=+b.branch_id||m.branch_id;if(!db.branches.some(x=>x.id===br))throw E('Invalid unit.');
     Object.assign(m,{full_name:String(b.full_name||m.full_name).trim(),phone:phoneN(b.phone||m.phone),branch_id:br,must_change:!!b.must_change});
     db.people.forEach(x=>{if(x.member_id===m.id)Object.assign(x,{full_name:m.full_name,phone:m.phone,branch_id:m.branch_id})});
     devLog(me.id,'dev_update_member','#'+m.id);return{ok:true,message:'Member updated.'}}
    if(b.a==='reset'){const tmp=Math.random().toString(36).slice(2,10);db.pw['m'+m.id]=tmp;m.must_change=true;devLog(me.id,'dev_reset_member_password','#'+m.id);return{ok:true,message:`Temporary password: ${tmp}`}}
    if(b.a==='delete'){db.members=db.members.filter(x=>x!==m);db.people.forEach(x=>{if(x.member_id===m.id)x.member_id=null});devLog(me.id,'dev_delete_member','#'+m.id);return{ok:true,message:'Member deleted.'}}}
   if(t==='person'){
    if(b.a==='create'){const br=+b.branch_id,kind=['member','visitor','leader'].includes(b.kind)?b.kind:'visitor';if(!String(b.full_name||'').trim()||!db.branches.some(x=>x.id===br))throw E('Enter name and church unit.');
     const pe={id:nid(),branch_id:br,full_name:b.full_name.trim(),address:String(b.address||'').trim(),phone:phoneN(b.phone)||null,kind,member_id:null,notes:b.notes||'',leader_since:kind==='leader'?D0():null};
     db.people.push(pe);devLog(me.id,'dev_create_person',`${pe.full_name} (${kind})`);return{ok:true,message:'Person added.'}}
    const pe=db.people.find(x=>x.id===+b.id);if(!pe)throw E('Not found',404);
    if(b.a==='update'){const kind=['member','visitor','leader'].includes(b.kind)?b.kind:pe.kind,br=+b.branch_id||pe.branch_id;
     Object.assign(pe,{full_name:String(b.full_name||pe.full_name).trim(),address:String(b.address??pe.address).trim(),phone:b.phone===undefined?pe.phone:(phoneN(b.phone)||null),branch_id:br,kind,leader_since:kind==='leader'?(pe.leader_since||D0()):null,notes:b.notes??pe.notes});
     devLog(me.id,'dev_update_person',`${pe.full_name} (${kind})`);return{ok:true,message:'Person updated.'}}
    if(b.a==='delete'){db.people=db.people.filter(x=>x!==pe);devLog(me.id,'dev_delete_person','#'+pe.id);return{ok:true,message:'Person deleted.'}}}
   if(t==='dev'){const d=db.dev_accounts.find(x=>x.id===+b.id);if(!d)throw E('Not found',404);if(b.a==='toggle'){if(d.id===me.id)throw E('Cannot disable your own active account.');d.active=!d.active;devLog(me.id,'dev_toggle',d.username);return{ok:true,message:'Updated.'}}}
   throw E('Bad request')}
  if(p==='/api/dev/impersonate'){
   if(b.kind==='member'){const m=db.members.find(x=>x.id===+b.id);if(!m)throw E('Member not found.',404);S.m=m.id;devLog(me.id,'impersonate',`member:${m.phone}`);return{ok:true,redirect:'/member/home',as:`Member: ${m.full_name}`}}
   if(b.kind==='staff'){const s=db.staff.find(x=>x.id===+b.id&&x.active);if(!s)throw E('Staff account not found or disabled.',404);S.s=s.id;devLog(me.id,'impersonate',`${s.role}:${s.username}`);
    const redir=s.role==='superadmin'?'/superadmin/home':s.role==='admin'?'/admin/home':'/secretary/home';
    return{ok:true,redirect:redir,as:`${s.role}: ${s.full_name}`}}
   throw E('Invalid impersonation target.')}
  if(p==='/api/dev/settings'){
   if(!post)return{settings:[{key:'profile',value:db.profile},{key:'features',value:db.features},...Object.entries(db.extra_settings).map(([key,value])=>({key,value}))],branches:db.branches.map(U)};
   if(b.target==='setting'){const k=String(b.key||'').trim();if(!k)throw E('Key required.');
    if(b.a==='delete'){if(k==='profile'||k==='features')throw E('Cannot delete core setting.');delete db.extra_settings[k];devLog(me.id,'delete_setting',k);return{ok:true,message:'Setting deleted.'}}
    const val=typeof b.value==='string'?JSON.parse(b.value):b.value;
    if(k==='profile')db.profile=val;else if(k==='features')db.features=val;else db.extra_settings[k]=val;
    devLog(me.id,'save_setting',k);return{ok:true,message:'Setting saved.'}}
   if(b.target==='branch'){
    if(b.a==='create'){const n=String(b.name||'').trim(),kind=['center','branch','fellowship'].includes(b.kind)?b.kind:'fellowship',par=b.parent_id?+b.parent_id:null;
     if(!n)throw E('Name required.');const u={id:nid(),name:n,kind,parent_id:par,is_main:!!b.is_main,momo_number:b.momo_number||null};db.branches.push(u);devLog(me.id,'create_unit',labelOf(u));return{ok:true,message:'Unit added.'}}
    const u=db.branches.find(x=>x.id===+b.id);if(!u)throw E('Not found',404);
    if(b.a==='update'){const par=b.parent_id?+b.parent_id:null;if(par&&kids(u.id).includes(par))throw E('A unit cannot sit under itself or under one of its own fellowships.');
     u.name=String(b.name||u.name).trim();if(b.kind)u.kind=b.kind;u.parent_id=par;u.momo_number=b.momo_number||null;devLog(me.id,'update_unit',labelOf(u));return{ok:true,message:'Unit saved.'}}
    if(b.a==='delete'){db.branches=db.branches.filter(x=>x!==u);devLog(me.id,'delete_unit',u.name);return{ok:true,message:'Unit deleted.'}}}
   throw E('Bad request')}
  if(p==='/api/dev/data'){const TABLES={offerings:()=>db.offerings,pledges:()=>db.pledges,pledge_payments:()=>db.payments,events:()=>db.events,programs:()=>db.programs,services:()=>db.services,attendance:()=>db.attendance,notifications:()=>db.notifications,assets:()=>db.assets,audit_log:()=>db.audit,dev_audit:()=>db.dev_audit};
   const tbl=String(q.table||b.table||'offerings');if(!TABLES[tbl])throw E('Unknown table.');
   if(!post)return{table:tbl,tables:Object.keys(TABLES),rows:TABLES[tbl]().slice(0,200)};
   const arr=TABLES[tbl]();
   if(b.a==='create'){const row=typeof b.row==='string'?JSON.parse(b.row):b.row;const item={id:nid(),created_at:new Date().toISOString(),...row};arr.unshift(item);devLog(me.id,'data_create',tbl);return{ok:true,message:'Row created.'}}
   if(b.a==='update'){const row=typeof b.row==='string'?JSON.parse(b.row):b.row;const ex=arr.find(x=>x.id===+b.id);if(!ex)throw E('Row not found.',404);Object.assign(ex,row);devLog(me.id,'data_update',`${tbl}#${b.id}`);return{ok:true,message:'Row updated.'}}
   if(b.a==='delete'){const idx=arr.findIndex(x=>x.id===+b.id);if(idx<0)throw E('Row not found.',404);arr.splice(idx,1);devLog(me.id,'data_delete',`${tbl}#${b.id}`);return{ok:true,message:'Row deleted.'}}
   throw E('Bad request')}
  throw E('Not found',404)}
 throw E('Not found',404)}
