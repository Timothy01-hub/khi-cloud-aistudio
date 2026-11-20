// KHI Offering System · Cloudflare Worker · JSON API for the React apps (Supabase + RLS)
const enc=new TextEncoder();
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'});
const phoneN=s=>{let d=String(s||'').replace(/\D/g,'');if(d.length===12&&d.startsWith('260'))d='0'+d.slice(3);else if(d.length===9)d='0'+d;return d};
const okDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const CLEAR='khm=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
const CLEAR_S=CLEAR.replace('khm','khs');
const CLEAR_D=CLEAR.replace('khm','khd');
const json=(o,status=200,cookie)=>{const h={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(cookie)h['Set-Cookie']=cookie;return new Response(JSON.stringify(o),{status,headers:h})};
const bad=(error,status=400)=>json({error},status);
const DEPTS=['Ushering','Intercessory','Media','Protocol','Hospitality','Praise Team','Evangelism','Sanctuary Keeping'];
const KW={center:'Centre',branch:'Branch',fellowship:'Fellowship'};
const unitLabel=b=>{if(!b)return'';const k=KW[b.kind]||'Fellowship',n=String(b.name||''),u=n.toUpperCase(),w=k.toUpperCase();return!b.kind||u.endsWith(w)||(b.kind==='center'&&u.endsWith('CENTER'))?n:n+' '+k};
const inZambia=(a,b)=>a>=-18.08&&a<=-8.22&&b>=21.99&&b<=33.71;
const GRANT=[['accounts','Manage secretary accounts'],['members','Manage members (move, reset passwords)'],['events','Post events'],['programs','Manage pledge programs'],['attendance','View attendance'],['reports','View reports and downloads'],['void','Void entries'],['audit','View the audit log'],['assets','Manage church assets (when the feature is on)']];
const BLOCK=[['units','Add or edit centres, branches and fellowships'],['admins','Create admins or change their privileges'],['leaders','Promote or demote Leaders'],['features','Switch features on or off'],['profile','Edit the vision, mission and church profile']];
const kidsOf=(all,id)=>{const out=[id];for(const b of all)if(b.parent_id===id)out.push(...kidsOf(all,b.id));return out};

/* ---- Supabase (server-side service_role for normal routes; authenticated JWT for developer RLS) ---- */
async function sb(env,path,o={}){
 const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{method:o.m||'GET',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json',...(o.prefer?{Prefer:o.prefer}:{})},body:o.b?JSON.stringify(o.b):undefined});
 const t=await r.text(),j=t?JSON.parse(t):null;
 if(!r.ok)throw Object.assign(new Error(j?.message||r.statusText),{code:j?.code,status:r.status});
 return j}
const rpc=(env,fn,b)=>sb(env,'rpc/'+fn,{m:'POST',b});

async function devSb(env,jwt,path,o={}){
 const key=env.SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_KEY;
 const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{method:o.m||'GET',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',...(o.prefer?{Prefer:o.prefer}:{})},body:o.b?JSON.stringify(o.b):undefined});
 const t=await r.text(),j=t?JSON.parse(t):null;
 if(!r.ok)throw Object.assign(new Error(j?.message||r.statusText),{code:j?.code,status:r.status});
 return j}
const devRpc=(env,jwt,fn,b)=>devSb(env,jwt,'rpc/'+fn,{m:'POST',b});

/* ---- signed session cookie + Supabase RLS JWT ---- */
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64s=s=>b64(enc.encode(s));
async function sign(env,v){const k=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',k,enc.encode(v)))}
const eq=(a,b)=>{let d=a.length^b.length;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return d===0};
async function mkCookie(env,id,n='khm'){const v=id+'.'+(Date.now()+7*864e5);return `${n}=${v}.${await sign(env,v)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`}
async function who(env,req,n='khm'){const m=(req.headers.get('Cookie')||'').match(new RegExp('(?:^|; )'+n+'=(\\d+)\\.(\\d+)\\.([\\w-]+)'));
 if(!m||+m[2]<Date.now()||!eq(m[3],await sign(env,m[1]+'.'+m[2])))return null;return +m[1]}
const sameOrigin=req=>{const o=req.headers.get('Origin');return !o||new URL(o).host===new URL(req.url).host};
async function mkDevJwt(env,devId){
 if(!env.SUPABASE_JWT_SECRET)throw Object.assign(new Error('Not found'),{status:404});
 const now=Math.floor(Date.now()/1000),hdr=b64s(JSON.stringify({alg:'HS256',typ:'JWT'})),pay=b64s(JSON.stringify({role:'authenticated',aud:'authenticated',khi_role:'developer',sub:String(devId),iat:now,exp:now+300}));
 const k=await crypto.subtle.importKey('raw',enc.encode(env.SUPABASE_JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=b64(await crypto.subtle.sign('HMAC',k,enc.encode(hdr+'.'+pay)));
 return hdr+'.'+pay+'.'+sig}

/* ---- branding & feature-flag helpers (safe fallbacks if dev.sql / mocks return null) ---- */
async function brandOf(env,unitId,fallback=''){
 if(!unitId)return{branch:fallback,centre:null,brand:fallback};
 try{const b=await rpc(env,'unit_brand',{p_unit:unitId});if(b&&b.branch)return{branch:b.branch,centre:b.centre||null,brand:b.centre?`${b.branch} · ${b.centre}`:b.branch}}catch{}
 return{branch:fallback,centre:null,brand:fallback}}
async function featOn(env,key,unitId=null){
 try{return(await rpc(env,'feature_enabled',{p_key:key,p_unit:unitId}))!==false}catch{return true}}
async function myFeats(env,unitId=null){
 try{return(await rpc(env,'my_features',{p_unit:unitId}))||{}}catch{return{}}}

/* ---- Zambia-only + VPN/proxy block ---- */
async function geoOK(env,req){
 if(env.GEO_ENFORCE!=='true')return true;
 const ip=req.headers.get('CF-Connecting-IP')||'';if(!ip||ip==='127.0.0.1'||ip==='::1')return true;
 if(req.headers.get('CF-IPCountry')!=='ZM')return false;
 const key=new Request('https://geo.cache/'+ip);let c=await caches.default.match(key),isBad;
 if(c)isBad=(await c.text())==='1';
 else{try{const j=await(await fetch(`https://proxycheck.io/v2/${ip}?vpn=1`+(env.PROXYCHECK_KEY?`&key=${env.PROXYCHECK_KEY}`:''))).json();
   if(!j[ip])throw 0;isBad=j[ip].proxy==='yes';await caches.default.put(key,new Response(isBad?'1':'0',{headers:{'Cache-Control':'max-age=86400'}}))}
  catch{return env.GEO_FAIL_OPEN==='true'}}
 return !isBad}

const wherePrograms=(B,D)=>`active=eq.true&and=(or(branch_id.is.null,branch_id.eq.${B}),or(deadline.is.null,deadline.gte.${D}))`;

async function route(req,env,p,q){
 const post=req.method==='POST',b=post?await req.json().catch(()=>({})):{},ip=req.headers.get('CF-Connecting-IP')||'local';
 if(post&&!(req.headers.get('Content-Type')||'').includes('application/json'))return bad('Bad request');
 if(p.startsWith('/api/dev/'))return devRoute(req,env,p,q,b,ip);
 if(p.startsWith('/api/staff/'))return staffRoute(req,env,p,q,b,ip);
 if(p.startsWith('/api/admin/'))return adminRoute(req,env,p,q,b,ip);
 if(p==='/api/branches'){const bs=await sb(env,'branches?select=*&order=is_main.desc,name.asc');return json((bs||[]).map(x=>({...x,label:unitLabel(x)})))}
 if(p==='/api/mode')return json({demo:false});
 if(p==='/api/features')return json(await myFeats(env,q.unit?+q.unit:null));
 if(p==='/api/about'){const s=(await sb(env,"settings?key=eq.profile&select=value").catch(()=>[]))[0];return json(s?.value||{vision:'To reach all nations for Christ',mission:"Raising true Christians who will impact nations with God's kingdom.",founded:2015,email:'kingdomheralds.info@gmail.com'})}
 if(p==='/api/departments')return json(await featOn(env,'feature.departments',q.unit?+q.unit:null)?DEPTS:[]);
 if(p==='/api/member/logout')return json({ok:true},200,CLEAR);
 if(p==='/api/member/login'&&post){
  const ph=phoneN(b.phone);
  if(await rpc(env,'login_locked',{p_ident:ph,p_ip:ip}))return bad('Too many failed attempts. Please wait 15 minutes and try again.',429);
  const id=await rpc(env,'member_login',{p_phone:ph,p_password:String(b.password||'')});
  if(!id){await rpc(env,'login_fail',{p_ident:ph,p_ip:ip});return bad('Wrong phone number or password.',401)}
  const mem=(await sb(env,`members?id=eq.${id}&select=branch_id`))[0];
  if(mem&&!await featOn(env,'app.member',mem.branch_id))return bad('This app is currently disabled.',403);
  await rpc(env,'login_clear',{p_ident:ph});return json({ok:true},200,await mkCookie(env,id))}
 if(p==='/api/member/register'&&post){
  const bs=await sb(env,'branches?select=id');
  if(!await featOn(env,'app.member',+b.branch||null))return bad('This app is currently disabled.',403);
  const deptOn=await featOn(env,'feature.departments',+b.branch||null);
  const dept=deptOn?String(b.department||''):'';
  const v={name:String(b.name||'').trim(),phone:phoneN(b.phone),address:String(b.address||'').trim(),branch:String(b.branch||''),pw:String(b.password||''),pw2:String(b.password2||''),birth:String(b.birth||''),marriage:String(b.marriage||''),dept};
  const err=!v.name?'Please enter your full name.':v.phone.length<10?'Enter a valid phone number, e.g. 0971234567.':!v.address?'Please enter your home address.':!bs.some(x=>String(x.id)===v.branch)?'Please choose your fellowship.':v.dept&&!DEPTS.includes(v.dept)?'Please choose a valid department.':v.pw.length<6?'Password must be at least 6 characters.':v.pw!==v.pw2?'The two passwords do not match.':!okDate(v.birth)||v.birth>today()||v.birth<'1900-01-01'?'Please enter a valid date of birth.':v.marriage&&(!okDate(v.marriage)||v.marriage>today()||v.marriage<=v.birth)?'Please enter a valid date of marriage (after your date of birth, not in the future).':!b.agree?'Please accept the Privacy Notice to register.':'';
  if(err)return bad(err);
  try{await rpc(env,'member_register',{p_branch:+v.branch,p_name:v.name,p_phone:v.phone,p_password:v.pw,p_address:v.address,p_birth:v.birth,p_marriage:v.marriage||null,p_department:v.dept||null})}
  catch(e){return bad(e.code==='23505'?`This number (${v.phone}) is already registered. Try signing in instead.`:'Could not register. Please try again or contact the church office.')}
  return json({ok:true})}

 /* ---- signed-in member endpoints ---- */
 const mid=await who(env,req);if(!mid)return bad('Please sign in.',401);
 const me=(await sb(env,`members?id=eq.${mid}&select=*,branches(name)`))[0];if(!me)return json({error:'Please sign in.'},401,CLEAR);
 const B=me.branch_id,D=today();
 if(!await featOn(env,'app.member',B))return bad('This app is currently disabled.',403);
 const feats=await myFeats(env,B);
 const fOn=k=>feats[k]!==false;
 if(p==='/api/member/count')return json({unread:fOn('member.menu.alerts')?(await sb(env,`notifications?member_id=eq.${mid}&is_read=eq.false&select=id`)).length:0});
 if(p==='/api/member/home'&&!post){
  const [events,programs,pl,pe,un,br]=await Promise.all([
   fOn('member.menu.events')?sb(env,`events?event_date=gte.${D}&or=(branch_id.is.null,branch_id.eq.${B})&order=event_date.asc`):Promise.resolve([]),
   fOn('member.menu.pledges')?sb(env,`programs?${wherePrograms(B,D)}&order=id.desc`):Promise.resolve([]),
   fOn('member.menu.pledges')?sb(env,`pledges?member_id=eq.${mid}&select=id,amount,programs(title),pledge_payments(amount)&order=id.desc`):Promise.resolve([]),
   sb(env,`people?member_id=eq.${mid}&select=id`),
   fOn('member.menu.alerts')?sb(env,`notifications?member_id=eq.${mid}&is_read=eq.false&select=id`):Promise.resolve([]),
   brandOf(env,B,me.branches.name)]);
  let services=[];
  if(pe[0]&&fOn('feature.self_checkin')){const sv=await sb(env,`services?branch_id=eq.${B}&service_date=eq.${D}&is_open=eq.true`);
   if(sv.length){const at=await sb(env,`attendance?person_id=eq.${pe[0].id}&service_id=in.(${sv.map(s=>s.id).join(',')})&select=service_id`),h=new Set(at.map(a=>a.service_id));services=sv.map(s=>({id:s.id,type:s.service_type,here:h.has(s.id)}))}}
  return json({me:{name:me.full_name,branch:br.branch,centre:br.centre,brand:br.brand,mustChange:me.must_change},today:D,events,programs,services,unread:un.length,features:feats,
   pledges:pl.map(x=>({id:x.id,title:x.programs.title,amount:+x.amount,paid:x.pledge_payments.reduce((a,y)=>a+Number(y.amount),0)}))})}
 if(p==='/api/member/alerts'&&!post){
  if(!fOn('member.menu.alerts'))return bad('Alerts are currently disabled.',403);
  const items=await sb(env,`notifications?member_id=eq.${mid}&order=id.desc&limit=50`);
  await sb(env,`notifications?member_id=eq.${mid}&is_read=eq.false`,{m:'PATCH',b:{is_read:true},prefer:'return=minimal'});return json({items})}
 if(post&&p==='/api/member/checkin'){
  if(!fOn('feature.self_checkin'))return bad('Self check-in is currently disabled.',403);
  const sv=(await sb(env,`services?id=eq.${+b.id||0}&branch_id=eq.${B}&service_date=eq.${D}&is_open=eq.true`))[0],pe=(await sb(env,`people?member_id=eq.${mid}&select=id`))[0];
  if(!sv||!pe)return bad('This service is not open for check-in.');
  await sb(env,'attendance?on_conflict=service_id,person_id',{m:'POST',b:{service_id:sv.id,person_id:pe.id,via:'self'},prefer:'resolution=ignore-duplicates'});
  return json({ok:true,message:'You are checked in. God bless you!'})}
 if(post&&p==='/api/member/pledge'){
  if(!fOn('member.menu.pledges'))return bad('Pledges are currently disabled.',403);
  const amt=Math.round(parseFloat(b.amount)*100)/100,pr=(await sb(env,`programs?id=eq.${+b.program||0}&${wherePrograms(B,D)}`))[0];
  if(!pr||!(amt>=1&&amt<1e7))return bad('Choose a program and enter a valid amount.');
  const t=await rpc(env,'make_pledge',{p_member:mid,p_program:pr.id,p_amount:amt});
  return json({ok:true,message:`Thank you! Your pledge to ${pr.title} is now ${money(t)}.`})}
 if(post&&p==='/api/member/password'){
  if(!fOn('member.menu.account'))return bad('Account settings are currently disabled.',403);
  const n=String(b.new||'');
  if(n.length<6||n!==b.new2)return bad('New passwords must match and be 6+ characters.');
  if(!await rpc(env,'member_set_password',{p_id:mid,p_old:String(b.old||''),p_new:n}))return bad('Current password is wrong.');
  return json({ok:true,message:'Password changed.'})}
 return bad('Not found',404)}

/* ---- staff: secretary dashboard ---- */
async function staffRoute(req,env,p,q,b,ip){
 const post=req.method==='POST';
 if(p==='/api/staff/logout')return json({ok:true},200,CLEAR_S);
 if(p==='/api/staff/login'&&post){
  const un=String(b.username||'').trim(),id='s:'+un.toLowerCase(),role=b.app==='superadmin'?'superadmin':b.app==='admin'?'admin':'secretary';
  if(await rpc(env,'login_locked',{p_ident:id,p_ip:ip}))return bad('Too many failed attempts. Please wait 15 minutes and try again.',429);
  const r=(await rpc(env,'staff_login',{p_username:un,p_password:String(b.password||''),p_role:role}))[0];
  if(!r){await rpc(env,'login_fail',{p_ident:id,p_ip:ip});return bad('Invalid login or account disabled.',401)}
  const st=(await sb(env,`staff?id=eq.${r.id}&select=branch_id`))[0];
  if(!await featOn(env,'app.'+role,st?.branch_id||null))return bad('This app is currently disabled.',403);
  await rpc(env,'login_clear',{p_ident:id});
  await sb(env,'audit_log',{m:'POST',b:{actor:role+':'+un,action:'login',ip},prefer:'return=minimal'});
  return json({ok:true},200,await mkCookie(env,r.id,'khs'))}
 const sid=await who(env,req,'khs');if(!sid)return bad('Please sign in.',401);
 const me=(await sb(env,`staff?id=eq.${sid}&active=eq.true&select=*,branches(name)`))[0];
 if(!me||me.role!=='secretary')return json({error:'Please sign in.'},401,CLEAR_S);
 const B=me.branch_id,by=me.username;
 if(!await featOn(env,'app.secretary',B))return bad('This app is currently disabled.',403);
 const feats=await myFeats(env,B),fOn=k=>feats[k]!==false;
 const feed=async()=>{const [totals,recent]=await Promise.all([rpc(env,'branch_totals',{p_branch:B}),sb(env,`offerings?branch_id=eq.${B}&order=id.desc&limit=40`)]);
  const t=k=>totals.find(x=>x.type===k)||{today:0,month:0};
  return{totals:{pToday:+t('physical').today,dToday:+t('digital').today,month:+t('physical').month+ +t('digital').month},recent}};
 if(p==='/api/staff/feed')return json(await feed());
 if(p==='/api/staff/home'&&!post){const [fd,ow,br]=await Promise.all([feed(),rpc(env,'owing_pledges',{p_branch:B}),brandOf(env,B,me.branches.name)]);
  return json({me:{name:me.full_name,branch:br.branch,centre:br.centre,brand:br.brand,slot:me.slot,canVoid:me.slot==='main'},features:feats,...fd,owing:ow})}
 if(post&&p==='/api/staff/cash'){
  const a=Math.round(parseFloat(b.amount)*100)/100,cat=['Offering','Tithe','Seed','Thanksgiving','Building Fund'].includes(b.category)?b.category:'Offering';
  if(!(a>0&&a<1e7))return bad('Enter a valid amount.');
  await sb(env,'offerings',{m:'POST',b:{branch_id:B,type:'physical',category:cat,amount:a,sender:String(b.sender||'').trim().slice(0,120)||null,note:String(b.note||'').trim().slice(0,255)||null,recorded_by:by},prefer:'return=minimal'});
  await sb(env,'audit_log',{m:'POST',b:{actor:'secretary:'+by,action:'record_physical',detail:money(a)+' '+cat,ip},prefer:'return=minimal'});
  return json({ok:true,message:'Recorded '+money(a)+'.'})}
 if(post&&p==='/api/staff/pledge-payment'){
  const a=Math.round(parseFloat(b.amount)*100)/100,pl=(await sb(env,`pledges?id=eq.${+b.pledge||0}&select=id,members(branch_id)`))[0];
  if(!pl||pl.members.branch_id!==B)return bad('Choose a pledge from your fellowship.');
  if(!(a>0))return bad('Enter a valid amount.');
  const done=+await rpc(env,'record_pledge_payment',{p_pledge:pl.id,p_amount:a,p_by:by,p_type:'physical'});
  return done>0?json({ok:true,message:'Pledge payment of '+money(done)+' recorded.'}):bad('Nothing to record: that pledge is already fully paid.')}
 if(post&&p==='/api/staff/void'){
  if(me.slot!=='main')return bad('Only the Main Secretary can void entries.',403);
  const m=await rpc(env,'void_offering',{p_id:+b.id||0,p_reason:String(b.reason||''),p_by:by,p_branch:B});
  return m==='Entry voided.'?json({ok:true,message:m}):bad(m)}
 if(p==='/api/staff/attendance'){
  if(!fOn('secretary.menu.attendance'))return bad('Attendance is currently disabled.',403);
  const br=await brandOf(env,B,me.branches.name);
  return json({...(await sbAttView(env,[B],B,q)),me:{branch:br.branch,brand:br.brand,slot:me.slot},features:feats})}
 if(p==='/api/staff/att'){
  if(!fOn('secretary.menu.attendance'))return bad('Attendance is currently disabled.',403);
  return json(await sbAttAct(env,B,by,b))}
 if(p==='/api/staff/report'){
  if(me.slot!=='main')return bad('Only the Main Secretary can open reports.',403);
  if(!fOn('secretary.menu.reports'))return bad('Reports are currently disabled.',403);
  const br=await brandOf(env,B,me.branches.name);
  return json({rows:await sbReport(env,q,[B]),me:{branch:br.branch,brand:br.brand}})}
 return bad('Not found',404)}

/* ---- shared Supabase attendance + report helpers ---- */
async function sbAttView(env,scopeIds,B,q){
 const inS=scopeIds?`branch_id=in.(${scopeIds.join(',')})`:'';
 const [svs,peo,atts,brs]=await Promise.all([
  sb(env,`services?${inS?inS+'&':''}order=service_date.desc,id.desc&limit=100`),
  sb(env,`people?${inS?inS+'&':''}order=full_name.asc&limit=500`),
  sb(env,'attendance?select=service_id,person_id,via'),
  sb(env,'branches?select=id,name,kind')]);
 const bnMap=Object.fromEntries((brs||[]).map(x=>[x.id,unitLabel(x)]));
 const peMap=Object.fromEntries((peo||[]).map(x=>[x.id,x]));
 const cnt=sid=>{const ps=(atts||[]).filter(a=>a.service_id===sid).map(a=>peMap[a.person_id]).filter(Boolean);return{total:ps.length,members:ps.filter(p=>p.kind!=='visitor').length,visitors:ps.filter(p=>p.kind==='visitor').length}};
 const cur=(svs||[]).find(s=>String(s.id)===String(q.s||q.svc));
 const here=new Set(cur?(atts||[]).filter(a=>a.service_id===cur.id).map(a=>a.person_id):[]);
 const ql=(q.q||'').toLowerCase(),dq=(q.dq||'').toLowerCase(),fk=q.dk||q.k||'';
 const dir=(peo||[]).filter(p=>(!q.branch||q.branch==='0'||String(p.branch_id)===q.branch)&&(!fk||p.kind===fk)&&(!dq||[p.full_name,p.phone,p.address].join(' ').toLowerCase().includes(dq))).map(p=>({...p,bn:bnMap[p.branch_id]||''}));
 const present=cur?(atts||[]).filter(a=>a.service_id===cur.id).map(a=>peMap[a.person_id]?({...peMap[a.person_id],bn:bnMap[peMap[a.person_id].branch_id]||'',via:a.via}):null).filter(Boolean):[];
 return{services:(svs||[]).map(s=>({...s,count:cnt(s.id).total,bn:bnMap[s.branch_id]||''})),current:cur?{...cur,...cnt(cur.id)}:null,present,
  results:cur&&ql&&B?(peo||[]).filter(p=>p.branch_id===B&&!here.has(p.id)&&[p.full_name,p.phone].join(' ').toLowerCase().includes(ql)).slice(0,10):[],
  directory:dir.slice(0,300),types:['Sunday Service','Midweek Service','Prayer Meeting','Youth Service','Other']}}

async function sbAttAct(env,B,by,b){
 if(b.a==='start'){if(!okDate(b.date||''))throw Object.assign(new Error('Choose a valid date.'),{status:400});
  let s=(await sb(env,`services?branch_id=eq.${B}&service_date=eq.${b.date}&service_type=eq.${encodeURIComponent(b.type)}`))?.[0];
  if(!s){s=(await sb(env,'services',{m:'POST',b:{branch_id:B,service_date:b.date,service_type:b.type,is_open:true,created_by:by},prefer:'return=representation'}))[0];
   await sb(env,'audit_log',{m:'POST',b:{actor:by,action:'service_start',detail:b.type+' '+b.date},prefer:'return=minimal'})}
  return{ok:true,id:s.id}}
 if(b.a==='toggle'){const s=(await sb(env,`services?id=eq.${+b.s||0}&branch_id=eq.${B}`))[0];if(!s)throw Object.assign(new Error('Invalid service.'),{status:400});
  await sb(env,`services?id=eq.${s.id}`,{m:'PATCH',b:{is_open:!s.is_open},prefer:'return=minimal'});return{ok:true}}
 if(b.a==='checkin'){const s=(await sb(env,`services?id=eq.${+b.s||0}&branch_id=eq.${B}`))[0],p=(await sb(env,`people?id=eq.${+b.pid||0}&branch_id=eq.${B}`))[0];
  if(!s||!p)throw Object.assign(new Error('Choose a service and a person.'),{status:400});
  await sb(env,'attendance?on_conflict=service_id,person_id',{m:'POST',b:{service_id:s.id,person_id:p.id,via:'secretary'},prefer:'resolution=ignore-duplicates'});
  return{ok:true,message:p.full_name+' marked present.'}}
 if(b.a==='uncheck'){const s=(await sb(env,`services?id=eq.${+b.s||0}&branch_id=eq.${B}`))[0];if(!s)throw Object.assign(new Error('Invalid service.'),{status:400});
  await sb(env,`attendance?service_id=eq.${s.id}&person_id=eq.${+b.pid||0}`,{m:'DELETE',prefer:'return=minimal'});return{ok:true,message:'Removed from this service.'}}
 if(b.a==='add'){const name=String(b.name||'').trim(),addr=String(b.address||'').trim(),ph=phoneN(b.phone)||null;
  if(!name||!addr)throw Object.assign(new Error('Full names and address are required.'),{status:400});
  if(ph&&ph.length<10)throw Object.assign(new Error('That phone number looks too short. Leave it blank if the person has no phone.'),{status:400});
  const kind=b.kind==='member'?'member':'visitor';
  const p=(await sb(env,'people',{m:'POST',b:{branch_id:B,full_name:name,address:addr,phone:ph,kind,notes:b.notes||'',created_by:by},prefer:'return=representation'}))[0];
  let m=name+' added.';if(b.present&&+b.s){await sb(env,'attendance?on_conflict=service_id,person_id',{m:'POST',b:{service_id:+b.s,person_id:p.id,via:'secretary'},prefer:'resolution=ignore-duplicates'});m+=' Marked present.'}
  return{ok:true,message:m}}
 if(b.a==='edit'){const p=(await sb(env,`people?id=eq.${+b.id||0}&branch_id=eq.${B}`))[0];if(!p)throw Object.assign(new Error('Person not found.'),{status:400});
  const ph=p.member_id?p.phone:(phoneN(b.phone)||null),n=String(b.name||'').trim(),ad=String(b.address||'').trim();
  if(!n||!ad)throw Object.assign(new Error('Full names and address are required.'),{status:400});
  await sb(env,`people?id=eq.${p.id}`,{m:'PATCH',b:{full_name:n,address:ad,phone:ph,notes:b.notes||''},prefer:'return=minimal'});return{ok:true,message:'Details updated.'}}
 if(b.a==='convert'){const p=(await sb(env,`people?id=eq.${+b.id||0}&branch_id=eq.${B}`))[0];if(!p||p.kind!=='visitor')throw Object.assign(new Error('Only a visitor can be made a member.'),{status:400});
  await sb(env,`people?id=eq.${p.id}`,{m:'PATCH',b:{kind:'member'},prefer:'return=minimal'});return{ok:true,message:p.full_name+' is now a member.'}}
 throw Object.assign(new Error('Not found'),{status:404})}

async function sbReport(env,f,scopeIds){
 const fb=+f.branch||0,inB=id=>(!scopeIds||scopeIds.includes(id))&&(!fb||id===fb),brs=await sb(env,'branches?select=id,name,kind');
 const bn=Object.fromEntries((brs||[]).map(x=>[x.id,unitLabel(x)])),k=f.kind;
 if(k==='people'){const ps=await sb(env,'people?order=full_name.asc');return ps.filter(p=>inB(p.branch_id)).map(p=>({Fellowship:bn[p.branch_id]||'',Name:p.full_name,Type:p.kind,Phone:p.phone||'',Address:p.address}))}
 if(k==='attendance'){const at=await sb(env,'attendance?select=via,services(branch_id,service_date,service_type),people(full_name,kind,phone,address)');
  return at.filter(x=>x.services&&inB(x.services.branch_id)&&x.services.service_date>=f.from&&x.services.service_date<=f.to).map(x=>({Date:x.services.service_date,Service:x.services.service_type,Fellowship:bn[x.services.branch_id]||'',Name:x.people?.full_name||'',Type:x.people?.kind||'',Phone:x.people?.phone||'',Address:x.people?.address||'',Checked_in_by:x.via}))}
 if(k==='pledges'){const pl=await sb(env,'pledges?select=amount,members(full_name,phone,branch_id),programs(title),pledge_payments(amount)');
  return pl.filter(x=>x.members&&inB(x.members.branch_id)).map(x=>{const paid=(x.pledge_payments||[]).reduce((a,y)=>a+Number(y.amount),0);return{Member:x.members.full_name,Phone:x.members.phone,Fellowship:bn[x.members.branch_id]||'',Program:x.programs?.title||'',Pledged:+x.amount,Paid:paid,Balance:+x.amount-paid}})}
 const off=await sb(env,'offerings?order=id.desc');
 return off.filter(x=>inB(x.branch_id)&&x.created_at.slice(0,10)>=f.from&&x.created_at.slice(0,10)<=f.to&&(!f.type||x.type===f.type)).map(x=>({Date:x.created_at.slice(0,16).replace('T',' '),Fellowship:bn[x.branch_id]||'',Type:x.type,Category:x.category,Given_by:x.sender||'',Reference:x.reference||'',Amount:+x.amount,Status:x.voided?'VOIDED':''}))}

/* ---- admin & Super Admin ---- */
async function adminRoute(req,env,p,q,b,ip){
 const sid=await who(env,req,'khs');if(!sid)return bad('Please sign in.',401);
 const me=(await sb(env,`staff?id=eq.${sid}&active=eq.true&select=*,branches(name)`))[0];
 const isSuper=me?.role==='superadmin';if(!me||(!isSuper&&me.role!=='admin'))return json({error:'Please sign in.'},401,CLEAR_S);
 const unitScope=isSuper?null:me.branch_id;
 if(!await featOn(env,isSuper?'app.superadmin':'app.admin',unitScope))return bad('This app is currently disabled.',403);
 const feats=await myFeats(env,unitScope),flagOn=k=>feats['admin.menu.'+k]!==false;
 const allB=await sb(env,'branches?select=*&order=is_main.desc,name.asc');
 const scope=isSuper?null:kidsOf(allB,me.branch_id);
 const can=pr=>isSuper||(me.privileges||[]).includes(pr),by=me.username,tag=me.role+':'+by,post=req.method==='POST';
 const units=()=>allB.filter(x=>!scope||scope.includes(x.id)).map(x=>({...x,label:unitLabel(x)}));
 const featSet=async()=>((await sb(env,"settings?key=eq.features&select=value"))[0]?.value)||{assets:false};
 if(p==='/api/admin/me'){
  const fs=await featSet();
  const tabs=['overview',...(isSuper?['units','admins','leaders']:[]),...(can('accounts')&&flagOn('accounts')?['accounts']:[]),...(can('members')&&flagOn('members')?['members']:[]),...(can('events')&&flagOn('events')?['events']:[]),...(can('programs')&&flagOn('programs')?['programs']:[]),...(can('attendance')&&flagOn('attendance')?['attendance']:[]),...(can('reports')&&flagOn('reports')?['reports']:[]),...(fs.assets&&can('assets')&&flagOn('assets')?['assets']:[]),...(can('audit')&&flagOn('audit')?['audit']:[]),...(isSuper?['profile']:[])];
  const br=isSuper?{brand:'KINGDOM HERALDS INTERNATIONAL CHURCH'}:await brandOf(env,me.branch_id,me.branches?.name||'');
  return json({role:me.role,name:me.full_name,tabs,unit:isSuper?'KINGDOM HERALDS INTERNATIONAL CHURCH':br.branch,brand:br.brand,privileges:me.privileges||[],features:feats})}
 if(p==='/api/admin/overview'){
  const us=units(),inS=scope?`branch_id=in.(${scope.join(',')})&`:'';
  const [recent,ts]=await Promise.all([sb(env,`offerings?${inS}order=id.desc&limit=40`),Promise.all(us.map(x=>rpc(env,'branch_totals',{p_branch:x.id})))]);
  const bnMap=Object.fromEntries(allB.map(x=>[x.id,unitLabel(x)]));
  const rows=us.map((x,i)=>{const a=ts[i]||[],pT=+(a.find(y=>y.type==='physical')?.today||0),dT=+(a.find(y=>y.type==='digital')?.today||0),m=+(a.find(y=>y.type==='physical')?.month||0)+ +(a.find(y=>y.type==='digital')?.month||0);return{id:x.id,name:x.label,is_main:x.is_main,kind:x.kind,today:pT+dT,month:m}});
  const tot=rows.reduce((a,r)=>({today:a.today+r.today,month:a.month+r.month}),{today:0,month:0});
  return json({rows,totals:{pToday:tot.today,dToday:0,month:tot.month},recent:(recent||[]).map(x=>({...x,bn:bnMap[x.branch_id]||''}))})}
 if(p==='/api/admin/fellowships'){if(!isSuper)return bad('Only the Super Admin can do that.',403);if(!post)return json(allB.map(x=>({...x,label:unitLabel(x)})));
  const par=b.parent?+b.parent:null,kind=['center','branch','fellowship'].includes(b.kind)?b.kind:'fellowship';
  if(b.a==='add'){const u=(await sb(env,'branches',{m:'POST',b:{name:String(b.name||'').trim(),kind,parent_id:par,is_main:false,momo_number:b.momo||null},prefer:'return=representation'}))[0];
   return json({ok:true,message:unitLabel(u)+' added.'})}
  await sb(env,`branches?id=eq.${+b.id||0}`,{m:'PATCH',b:{name:String(b.name||'').trim(),kind,parent_id:par,momo_number:b.momo||null},prefer:'return=minimal'});return json({ok:true,message:'Saved.'})}
 if(p==='/api/admin/admins'){if(!isSuper)return bad('Only the Super Admin can do that.',403);
  const st=await sb(env,"staff?role=eq.admin&select=id,username,full_name,branch_id,privileges,active"),bnMap=Object.fromEntries(allB.map(x=>[x.id,unitLabel(x)]));
  return json({admins:(st||[]).map(s=>({...s,unit:bnMap[s.branch_id]||''})),units:allB.map(x=>({...x,label:unitLabel(x)})),grantable:GRANT,blocked:BLOCK})}
 if(p==='/api/admin/admin'){if(!isSuper)return bad('Only the Super Admin can do that.',403);
  if(b.a==='create'){await rpc(env,'create_staff',{p_role:'admin',p_branch:+b.branch,p_slot:null,p_name:String(b.name||''),p_username:String(b.username||''),p_password:String(b.password||''),p_privileges:b.privileges||[]});return json({ok:true,message:'Admin created.'})}
  if(b.a==='privileges'){await sb(env,`staff?id=eq.${+b.id}&role=eq.admin`,{m:'PATCH',b:{privileges:b.privileges||[]},prefer:'return=minimal'});return json({ok:true,message:'Privileges saved.'})}
  if(b.a==='password'){await rpc(env,'staff_set_password',{p_id:+b.id,p_password:String(b.password||'')});return json({ok:true,message:'Password changed.'})}
  if(b.a==='toggle'){const s=(await sb(env,`staff?id=eq.${+b.id}&role=eq.admin`))[0];if(!s)return bad('Not found',404);await sb(env,`staff?id=eq.${s.id}`,{m:'PATCH',b:{active:!s.active},prefer:'return=minimal'});return json({ok:true,message:!s.active?'Admin enabled.':'Admin disabled.'})}
  if(b.a==='delete'){await sb(env,`staff?id=eq.${+b.id}&role=eq.admin`,{m:'DELETE',prefer:'return=minimal'});return json({ok:true,message:'Admin deleted.'})}}
 if(p==='/api/admin/leaders'){if(!isSuper)return bad('Only the Super Admin can do that.',403);
  if(!post){const ps=await sb(env,'people?order=full_name.asc&limit=200'),bnMap=Object.fromEntries(allB.map(x=>[x.id,unitLabel(x)])),ql=(q.q||'').toLowerCase();
   return json({people:(ps||[]).filter(x=>!ql||[x.full_name,x.phone||''].join(' ').toLowerCase().includes(ql)).slice(0,60).map(x=>({...x,bn:bnMap[x.branch_id]||''}))})}
  return json({ok:true,message:await rpc(env,'set_leader',{p_person:+b.id,p_make:!!b.make,p_by:tag})})}
 if(p==='/api/admin/profile'){if(!isSuper)return bad('Only the Super Admin can do that.',403);
  if(!post){const [pr,fs]=await Promise.all([sb(env,"settings?key=eq.profile&select=value"),featSet()]);return json({profile:pr?.[0]?.value||{},features:fs})}
  if(b.feature==='assets'){await sb(env,"settings?key=eq.features",{m:'PATCH',b:{value:{assets:!!b.on}},prefer:'return=minimal'});return json({ok:true,message:'Assets feature switched '+(b.on?'ON':'OFF')+'.'})}
  await sb(env,"settings?key=eq.profile",{m:'PATCH',b:{value:b.profile},prefer:'return=minimal'});return json({ok:true,message:'Profile saved.'})}
 if(p==='/api/admin/accounts'){if(!can('accounts')||!flagOn('accounts'))return bad('You do not have permission for that.',403);
  const st=await sb(env,"staff?role=eq.secretary&select=id,branch_id,slot,username,full_name,active");
  return json({fellowships:units().map(x=>({id:x.id,name:x.name,label:x.label,is_main:x.is_main,slots:{main:(st||[]).find(s=>s.branch_id===x.id&&s.slot==='main')||null,assistant:(st||[]).find(s=>s.branch_id===x.id&&s.slot==='assistant')||null}})),me:{username:by}})}
 if(p==='/api/admin/account'){if(!can('accounts'))return bad('You do not have permission for that.',403);
  if(b.a==='own'){await rpc(env,'staff_set_password',{p_id:me.id,p_password:String(b.password||'')});return json({ok:true,message:'Your password changed.'})}
  if(!flagOn('accounts'))return bad('This feature is currently disabled.',403);
  if(b.a==='create'){if(scope&&!scope.includes(+b.branch))return bad('That church is outside your area.',403);
   await rpc(env,'create_staff',{p_role:'secretary',p_branch:+b.branch,p_slot:b.slot,p_name:String(b.name||''),p_username:String(b.username||''),p_password:String(b.password||''),p_privileges:[]});return json({ok:true,message:'Account created.'})}
  const s=(await sb(env,`staff?id=eq.${+b.id}&role=eq.secretary`))[0];if(!s||(scope&&!scope.includes(s.branch_id)))return bad('Not found',404);
  if(b.a==='password'){await rpc(env,'staff_set_password',{p_id:s.id,p_password:String(b.password||'')});return json({ok:true,message:'Password changed.'})}
  if(b.a==='toggle'){await sb(env,`staff?id=eq.${s.id}`,{m:'PATCH',b:{active:!s.active},prefer:'return=minimal'});return json({ok:true,message:!s.active?'Account enabled.':'Account disabled.'})}
  if(b.a==='delete'){await sb(env,`staff?id=eq.${s.id}`,{m:'DELETE',prefer:'return=minimal'});return json({ok:true,message:'Account deleted.'})}}
 if(p==='/api/admin/members'){if(!can('members')||!flagOn('members'))return bad('You do not have permission for that.',403);
  const ms=await sb(env,`members?${scope?`branch_id=in.(${scope.join(',')})&`:''}select=id,branch_id,full_name,phone,pledges(amount,pledge_payments(amount))`);
  return json({fellowships:units(),rows:(ms||[]).map(m=>({id:m.id,branch_id:m.branch_id,full_name:m.full_name,phone:m.phone,pledged:(m.pledges||[]).reduce((a,x)=>a+ +x.amount,0),paid:(m.pledges||[]).reduce((a,x)=>a+(x.pledge_payments||[]).reduce((s,y)=>s+ +y.amount,0),0)}))})}
 if(p==='/api/admin/member'){if(!can('members')||!flagOn('members'))return bad('You do not have permission for that.',403);
  const m=(await sb(env,`members?id=eq.${+b.id||0}`))[0];if(!m||(scope&&!scope.includes(m.branch_id)))return bad('Not found',404);
  if(b.a==='move'){if(scope&&!scope.includes(+b.branch))return bad('You can only move members within your own area.',403);
   await sb(env,`members?id=eq.${m.id}`,{m:'PATCH',b:{branch_id:+b.branch},prefer:'return=minimal'});
   await sb(env,`people?member_id=eq.${m.id}`,{m:'PATCH',b:{branch_id:+b.branch},prefer:'return=minimal'});return json({ok:true,message:'Member moved.'})}
  if(b.a==='reset'){const t=await rpc(env,'member_reset_password',{p_id:m.id});return json({ok:true,message:`Temporary password for this member: ${t} (shown once; they must change it at next login).`})}}
 if(p==='/api/admin/content'){if(!can('events')&&!can('programs'))return bad('You do not have permission for that.',403);
  const [ev,pr]=await Promise.all([flagOn('events')?sb(env,'events?order=event_date.desc'):Promise.resolve([]),flagOn('programs')?sb(env,'programs?select=*,pledges(amount,pledge_payments(amount))&order=id.desc'):Promise.resolve([])]);
  const vis=id=>isSuper||(id!==null&&scope.includes(id));
  return json({canAll:isSuper,fellowships:units(),events:(ev||[]).filter(e=>vis(e.branch_id)),programs:(pr||[]).filter(g=>vis(g.branch_id)).map(g=>({...g,pledged:(g.pledges||[]).reduce((a,x)=>a+ +x.amount,0),paid:(g.pledges||[]).reduce((a,x)=>a+(x.pledge_payments||[]).reduce((s,y)=>s+ +y.amount,0),0)}))})}
 if(p==='/api/admin/event'||p==='/api/admin/program'){const ev=p.endsWith('event');if(!can(ev?'events':'programs')||!flagOn(ev?'events':'programs'))return bad('You do not have permission for that.',403);
  if(b.a==='delete'){await sb(env,`events?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});return json({ok:true,message:'Event deleted.'})}
  if(b.a==='toggle'){const g=(await sb(env,`programs?id=eq.${+b.id}`))[0];if(!g)return bad('Not found',404);await sb(env,`programs?id=eq.${g.id}`,{m:'PATCH',b:{active:!g.active},prefer:'return=minimal'});return json({ok:true})}
  const br=b.branch===''||b.branch==null?null:+b.branch;if(br===null&&!isSuper)return bad('Choose the church this is for.');if(br!==null&&scope&&!scope.includes(br))return bad('That church is outside your area.',403);
  const lat=b.lat===''||b.lat==null?null:+b.lat,lng=b.lng===''||b.lng==null?null:+b.lng;if((lat===null)!==(lng===null)||(lat!==null&&!inZambia(lat,lng)))return bad('The location must be a valid point inside Zambia.');
  if(ev){await sb(env,'events',{m:'POST',b:{branch_id:br,title:b.title.trim(),event_date:b.date,location:b.location.trim(),description:b.description||'',banner:b.banner||null,lat,lng},prefer:'return=minimal'});return json({ok:true,message:'Event published to members.'})}
  await sb(env,'programs',{m:'POST',b:{branch_id:br,title:b.title.trim(),description:b.description||'',deadline:b.deadline||null,location:b.location||null,banner:b.banner||null,lat,lng,active:true},prefer:'return=minimal'});return json({ok:true,message:'Program added.'})}
 if(p==='/api/admin/assets'){const fs=await featSet();if(!fs.assets||!flagOn('assets'))return bad('The assets feature is switched off.',403);if(!can('assets'))return bad('You do not have permission for that.',403);
  const bnMap=Object.fromEntries(allB.map(x=>[x.id,unitLabel(x)]));
  if(!post){const rows=await sb(env,`assets?${scope?`branch_id=in.(${scope.join(',')})&`:''}order=id.desc`);return json({rows:(rows||[]).map(a=>({...a,bn:bnMap[a.branch_id]||''})),units:units()})}
  if(b.a==='delete'){await sb(env,`assets?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});return json({ok:true,message:'Asset removed.'})}
  await sb(env,'assets',{m:'POST',b:{branch_id:+b.branch,name:b.name.trim(),category:b.category||'',quantity:parseInt(b.quantity||1,10),value:b.value===''||b.value==null?null:+b.value,condition:b.condition,acquired_on:b.acquired_on||null,notes:b.notes||'',created_by:by},prefer:'return=minimal'});
  return json({ok:true,message:'Asset added.'})}
 if(p==='/api/admin/attendance'){if(!can('attendance')||!flagOn('attendance'))return bad('You do not have permission for that.',403);
  const v=await sbAttView(env,scope,null,q),us=units();
  return json({summary:us.map(x=>({id:x.id,name:x.label,members:v.directory.filter(y=>y.branch_id===x.id&&y.kind!=='visitor').length,visitors:v.directory.filter(y=>y.branch_id===x.id&&y.kind==='visitor').length,latest:null})),services:v.services.filter(s=>!+q.branch||String(s.branch_id)===q.branch),present:v.present,people:v.directory,fellowships:us})}
 if(p==='/api/admin/report'){if(!can('reports')||!flagOn('reports'))return bad('You do not have permission for that.',403);return json({rows:await sbReport(env,q,scope),fellowships:units()})}
 if(p==='/api/admin/audit'){if(!can('audit')||!flagOn('audit'))return bad('You do not have permission for that.',403);return json({rows:await sb(env,'audit_log?order=id.desc&limit=300')})}
 if(post&&p==='/api/admin/void'){if(!can('void'))return bad('You do not have permission for that.',403);const m=await rpc(env,'void_offering',{p_id:+b.id||0,p_reason:String(b.reason||''),p_by:tag,p_branch:isSuper?null:me.branch_id});return m==='Entry voided.'?json({ok:true,message:m}):bad(m)}
 return bad('Not found',404)}

/* ---- hidden Developer app (/dev/): RLS-enforced via authenticated JWT with khi_role='developer' ---- */
async function devRoute(req,env,p,q,b,ip){
 const post=req.method==='POST';
 if(p==='/api/dev/logout')return json({ok:true},200,CLEAR_D);
 if(p==='/api/dev/gate'){
  const did=await who(env,req,'khd');if(did)return json({ok:true});
  if(await who(env,req,'khm')||await who(env,req,'khs'))return bad('Not found',404);
  return json({login:true})}
 if(p==='/api/dev/login'&&post){
  const un=String(b.username||'').trim(),id='d:'+un.toLowerCase();
  if(await rpc(env,'login_locked',{p_ident:id,p_ip:ip}))return bad('Too many failed attempts. Please wait 15 minutes and try again.',429);
  const devId=await rpc(env,'dev_login',{p_username:un,p_password:String(b.password||'')});
  if(!devId){await rpc(env,'login_fail',{p_ident:id,p_ip:ip});return bad('Invalid login or account disabled.',401)}
  await rpc(env,'login_clear',{p_ident:id});
  const jwt=await mkDevJwt(env,devId);
  await devSb(env,jwt,'dev_audit',{m:'POST',b:{dev_id:devId,action:'login',detail:un,ip},prefer:'return=minimal'}).catch(()=>{});
  return json({ok:true},200,await mkCookie(env,devId,'khd'))}

 const did=await who(env,req,'khd');if(!did)return bad('Not found',404);
 const jwt=await mkDevJwt(env,did);
 const dev=(await devSb(env,jwt,`dev_accounts?id=eq.${did}&active=eq.true&select=id,username,full_name,active`))[0];
 if(!dev)return json({error:'Not found'},404,CLEAR_D);
 const audit=(action,detail='')=>devSb(env,jwt,'dev_audit',{m:'POST',b:{dev_id:dev.id,action,detail:String(detail||''),ip},prefer:'return=minimal'});

 if(p==='/api/dev/me'){
  const [brs,cat,fl]=await Promise.all([devSb(env,jwt,'branches?select=*&order=is_main.desc,name.asc'),devSb(env,jwt,'feature_catalog?order=kind.asc,key.asc'),devSb(env,jwt,'feature_flags?order=id.asc')]);
  return json({dev,units:(brs||[]).map(x=>({...x,label:unitLabel(x)})),catalog:cat||[],flags:fl||[]})}
 if(p==='/api/dev/password'&&post){
  await devRpc(env,jwt,'dev_change_password',{p_id:dev.id,p_password:String(b.password||'')});
  await audit('change_password','');return json({ok:true,message:'Developer password updated.'})}
 if(p==='/api/dev/flags'){
  if(!post){const [cat,fl,brs]=await Promise.all([devSb(env,jwt,'feature_catalog?order=kind.asc,key.asc'),devSb(env,jwt,'feature_flags?order=id.asc'),devSb(env,jwt,'branches?select=*&order=is_main.desc,name.asc')]);
   const uid=q.unit?+q.unit:null;
   const eff=Object.fromEntries(await Promise.all((cat||[]).map(async c=>[c.key,await featOn(env,c.key,uid)])));
   return json({catalog:cat||[],flags:fl||[],units:(brs||[]).map(x=>({...x,label:unitLabel(x)})),effective:eff})}
  const key=String(b.key||''),uid=b.unit_id===''||b.unit_id==null?null:+b.unit_id;
  if(b.enabled===null||b.enabled==='default'){
   await devSb(env,jwt,`feature_flags?key=eq.${encodeURIComponent(key)}&${uid===null?'unit_id=is.null':`unit_id=eq.${uid}`}`,{m:'DELETE',prefer:'return=minimal'});
   await audit('flag_clear',`${key}@${uid??'global'}`);return json({ok:true,message:'Flag reset to inherited/default.'})}
  const on=!!b.enabled;
  const ex=(await devSb(env,jwt,`feature_flags?key=eq.${encodeURIComponent(key)}&${uid===null?'unit_id=is.null':`unit_id=eq.${uid}`}`))[0];
  if(ex)await devSb(env,jwt,`feature_flags?id=eq.${ex.id}`,{m:'PATCH',b:{enabled:on},prefer:'return=minimal'});
  else await devSb(env,jwt,'feature_flags',{m:'POST',b:{key,unit_id:uid,enabled:on},prefer:'return=minimal'});
  await audit('flag_set',`${key}@${uid??'global'}=${on}`);return json({ok:true,message:`${key} set to ${on?'ON':'OFF'}.`})}
 if(p==='/api/dev/users'){
  if(!post){const [st,ms,ps,ds,brs]=await Promise.all([devSb(env,jwt,'staff?select=id,role,branch_id,slot,full_name,username,active,privileges&order=id.asc'),devSb(env,jwt,'members?select=id,branch_id,full_name,phone,must_change,birth_date,marriage_date,department&order=id.asc'),devSb(env,jwt,'people?order=id.asc&limit=300'),devSb(env,jwt,'dev_accounts?select=id,username,full_name,active,created_at&order=id.asc'),devSb(env,jwt,'branches?select=*&order=is_main.desc,name.asc')]);
   const bn=Object.fromEntries((brs||[]).map(x=>[x.id,unitLabel(x)]));
   return json({staff:(st||[]).map(s=>({...s,unit:s.branch_id?bn[s.branch_id]:'All'})),members:(ms||[]).map(m=>({...m,unit:bn[m.branch_id]||''})),people:(ps||[]).map(x=>({...x,unit:bn[x.branch_id]||''})),devAccounts:ds||[],units:(brs||[]).map(x=>({...x,label:unitLabel(x)})),grantable:GRANT})}
  const t=b.target;
  if(t==='staff'){
   if(b.a==='create'){await devRpc(env,jwt,'dev_create_staff',{p_role:b.role||'secretary',p_branch:b.role==='superadmin'?null:+b.branch,p_slot:b.role==='secretary'?(b.slot||'main'):null,p_name:String(b.name||''),p_username:String(b.username||''),p_password:String(b.password||''),p_privileges:b.role==='admin'?(b.privileges||[]):[]});
    await audit('dev_create_staff',`${b.role}:${b.username}`);return json({ok:true,message:'Staff account created.'})}
   if(b.a==='update'){const patch={role:b.role,branch_id:b.role==='superadmin'?null:+b.branch_id,slot:b.role==='secretary'?(b.slot||'main'):null,full_name:b.full_name,username:b.username,privileges:b.role==='admin'?(b.privileges||[]):[],active:b.active!==undefined?!!b.active:true};
    await devSb(env,jwt,`staff?id=eq.${+b.id}`,{m:'PATCH',b:patch,prefer:'return=minimal'});await audit('dev_update_staff',b.username);return json({ok:true,message:'Staff updated.'})}
   if(b.a==='password'){await devRpc(env,jwt,'dev_set_staff_password',{p_id:+b.id,p_password:String(b.password||'')});await audit('dev_set_staff_password','#'+b.id);return json({ok:true,message:'Staff password updated.'})}
   if(b.a==='delete'){await devSb(env,jwt,`staff?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});await audit('dev_delete_staff','#'+b.id);return json({ok:true,message:'Staff deleted.'})}}
  if(t==='member'){
   if(b.a==='create'){await devRpc(env,jwt,'dev_create_member',{p_branch:+b.branch_id,p_name:String(b.full_name||''),p_phone:phoneN(b.phone),p_password:String(b.password||''),p_address:String(b.address||'Lusaka'),p_birth:b.birth_date||'1990-01-01',p_marriage:b.marriage_date||null,p_department:b.department||null});
    await audit('dev_create_member',b.full_name);return json({ok:true,message:'Member created.'})}
   if(b.a==='update'){await devSb(env,jwt,`members?id=eq.${+b.id}`,{m:'PATCH',b:{full_name:b.full_name,phone:phoneN(b.phone),branch_id:+b.branch_id,must_change:!!b.must_change},prefer:'return=minimal'});await audit('dev_update_member','#'+b.id);return json({ok:true,message:'Member updated.'})}
   if(b.a==='reset'){const tmp=await devRpc(env,jwt,'dev_reset_member_password',{p_id:+b.id});await audit('dev_reset_member_password','#'+b.id);return json({ok:true,message:`Temporary password: ${tmp}`})}
   if(b.a==='delete'){await devSb(env,jwt,`members?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});await audit('dev_delete_member','#'+b.id);return json({ok:true,message:'Member deleted.'})}}
  if(t==='person'){
   if(b.a==='create'){await devSb(env,jwt,'people',{m:'POST',b:{branch_id:+b.branch_id,full_name:b.full_name,address:b.address||'',phone:phoneN(b.phone)||null,kind:b.kind||'visitor',notes:b.notes||'',leader_since:b.kind==='leader'?today():null},prefer:'return=minimal'});await audit('dev_create_person',b.full_name);return json({ok:true,message:'Person added.'})}
   if(b.a==='update'){await devSb(env,jwt,`people?id=eq.${+b.id}`,{m:'PATCH',b:{branch_id:+b.branch_id,full_name:b.full_name,address:b.address||'',phone:phoneN(b.phone)||null,kind:b.kind,notes:b.notes||'',leader_since:b.kind==='leader'?today():null},prefer:'return=minimal'});await audit('dev_update_person','#'+b.id);return json({ok:true,message:'Person updated.'})}
   if(b.a==='delete'){await devSb(env,jwt,`people?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});await audit('dev_delete_person','#'+b.id);return json({ok:true,message:'Person deleted.'})}}
  if(t==='dev'&&b.a==='toggle'){const d=(await devSb(env,jwt,`dev_accounts?id=eq.${+b.id}`))[0];if(!d||d.id===dev.id)return bad('Cannot update this account.');
   await devSb(env,jwt,`dev_accounts?id=eq.${d.id}`,{m:'PATCH',b:{active:!d.active},prefer:'return=minimal'});await audit('dev_toggle',d.username);return json({ok:true,message:'Updated.'})}}
 if(p==='/api/dev/impersonate'&&post){
  if(b.kind==='member'){const m=(await devSb(env,jwt,`members?id=eq.${+b.id||0}`))[0];if(!m)return bad('Member not found.',404);
   await audit('impersonate',`member:${m.phone}`);return json({ok:true,redirect:'/member/home',as:`Member: ${m.full_name}`},200,await mkCookie(env,m.id,'khm'))}
  if(b.kind==='staff'){const s=(await devSb(env,jwt,`staff?id=eq.${+b.id||0}&active=eq.true`))[0];if(!s)return bad('Staff account not found.',404);
   await audit('impersonate',`${s.role}:${s.username}`);const redir=s.role==='superadmin'?'/superadmin/home':s.role==='admin'?'/admin/home':'/secretary/home';
   return json({ok:true,redirect:redir,as:`${s.role}: ${s.full_name}`},200,await mkCookie(env,s.id,'khs'))}
  return bad('Invalid impersonation target.')}
 if(p==='/api/dev/settings'){
  if(!post){const [st,brs]=await Promise.all([devSb(env,jwt,'settings?order=key.asc'),devSb(env,jwt,'branches?select=*&order=is_main.desc,name.asc')]);
   return json({settings:st||[],branches:(brs||[]).map(x=>({...x,label:unitLabel(x)}))})}
  if(b.target==='setting'){const k=String(b.key||'').trim();
   if(b.a==='delete'){await devSb(env,jwt,`settings?key=eq.${encodeURIComponent(k)}`,{m:'DELETE',prefer:'return=minimal'});await audit('delete_setting',k);return json({ok:true,message:'Setting deleted.'})}
   const val=typeof b.value==='string'?JSON.parse(b.value):b.value;
   await devSb(env,jwt,'settings?on_conflict=key',{m:'POST',b:{key:k,value:val},prefer:'resolution=merge-duplicates,return=minimal'});await audit('save_setting',k);return json({ok:true,message:'Setting saved.'})}
  if(b.target==='branch'){
   if(b.a==='create'){await devSb(env,jwt,'branches',{m:'POST',b:{name:String(b.name||'').trim(),kind:b.kind||'fellowship',parent_id:b.parent_id?+b.parent_id:null,is_main:!!b.is_main,momo_number:b.momo_number||null},prefer:'return=minimal'});await audit('create_unit',b.name);return json({ok:true,message:'Unit added.'})}
   if(b.a==='update'){await devSb(env,jwt,`branches?id=eq.${+b.id}`,{m:'PATCH',b:{name:String(b.name||'').trim(),kind:b.kind,parent_id:b.parent_id?+b.parent_id:null,momo_number:b.momo_number||null},prefer:'return=minimal'});await audit('update_unit',b.name);return json({ok:true,message:'Unit saved.'})}
   if(b.a==='delete'){await devSb(env,jwt,`branches?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});await audit('delete_unit','#'+b.id);return json({ok:true,message:'Unit deleted.'})}}}
 if(p==='/api/dev/data'){const ALLOWED=['offerings','pledges','pledge_payments','events','programs','services','attendance','notifications','assets','audit_log','dev_audit'];
  const tbl=String(q.table||b.table||'offerings');if(!ALLOWED.includes(tbl))return bad('Unknown table.');
  if(!post)return json({table:tbl,tables:ALLOWED,rows:await devSb(env,jwt,`${tbl}?order=id.desc&limit=200`)});
  const row=typeof b.row==='string'?JSON.parse(b.row):b.row;
  if(b.a==='create'){await devSb(env,jwt,tbl,{m:'POST',b:row,prefer:'return=minimal'});await audit('data_create',tbl);return json({ok:true,message:'Row created.'})}
  if(b.a==='update'){await devSb(env,jwt,`${tbl}?id=eq.${+b.id}`,{m:'PATCH',b:row,prefer:'return=minimal'});await audit('data_update',`${tbl}#${b.id}`);return json({ok:true,message:'Row updated.'})}
  if(b.a==='delete'){await devSb(env,jwt,`${tbl}?id=eq.${+b.id}`,{m:'DELETE',prefer:'return=minimal'});await audit('data_delete',`${tbl}#${b.id}`);return json({ok:true,message:'Row deleted.'})}}
 return bad('Not found',404)}

export default{
 async fetch(req,env){
  const u=new URL(req.url);
  if(!u.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
  if(!await geoOK(env,req))return json({error:'Access blocked',blocked:true},403);
  if(req.method==='POST'&&!sameOrigin(req))return bad('Bad origin',403);
  try{return await route(req,env,u.pathname.replace(/\/$/,''),Object.fromEntries(u.searchParams))}
  catch(e){console.error(e);return bad(e.status&&e.status<500?e.message:'Something went wrong. Please try again, or contact the church office.',e.status||500)}},
 async scheduled(_e,env,ctx){ctx.waitUntil(rpc(env,'notify_run',{}))}};
