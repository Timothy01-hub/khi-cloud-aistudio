import {useCallback,useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {api} from './api.js';
import {BrandLogo} from './ui.jsx';

const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=d=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const useLoginBody=()=>useEffect(()=>{document.body.classList.add('login');return()=>document.body.classList.remove('login')},[]);
const Install=({text})=><a href="#" id="install" hidden onClick={e=>{e.preventDefault();window.khInstall&&window.khInstall()}}>{text}</a>;

export function Login(){useLoginBody();const nav=useNavigate(),[sp]=useSearchParams(),[e,setE]=useState('');
 const submit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);setE('');
  try{await api('/api/member/login',{phone:f.get('phone'),password:f.get('password')});nav('/home')}catch(x){setE(x.message)}};
 return <form onSubmit={submit} className="card login-box"><BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/><h2>Member Sign in</h2>
  {sp.get('registered')&&!e&&<p className="ok">Registration successful! Please sign in.</p>}{e&&<p className="err">{e}</p>}
  <input name="phone" placeholder="Phone number" inputMode="tel" required autoFocus/><input name="password" type="password" placeholder="Password" required/><button>Sign in</button>
  <p><Install text="⬇ Install this app"/></p><p className="muted">New member? <Link to="/register">Create an account</Link></p></form>}

export function Register(){useLoginBody();const nav=useNavigate(),[bs,setBs]=useState([]),[ds,setDs]=useState([]),[deptOn,setDeptOn]=useState(true),[e,setE]=useState(''),
 [v,setV]=useState({name:'',phone:'',address:'',branch:'',password:'',password2:'',birth:'',married:false,marriage:'',department:'',agree:false}),set=k=>ev=>setV({...v,[k]:ev.target.type==='checkbox'?ev.target.checked:ev.target.value});
 useEffect(()=>{api('/api/branches').then(setBs).catch(()=>{})},[]);
 useEffect(()=>{const q=v.branch?'?unit='+v.branch:'';api('/api/departments'+q).then(x=>{setDs(x);setDeptOn(x.length>0)}).catch(()=>{});api('/api/features'+q).then(f=>{if(f&&f['feature.departments']===false)setDeptOn(false)}).catch(()=>{})},[v.branch]);
 const submit=async ev=>{ev.preventDefault();setE('');try{await api('/api/member/register',{...v,marriage:v.married?v.marriage:''});nav('/?registered=1')}catch(x){setE(x.message)}};
 return <form onSubmit={submit} className="card login-box"><BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/><h2>Create account</h2>{e&&<p className="err">{e}</p>}
  <input placeholder="Full name" value={v.name} onChange={set('name')} required/><input placeholder="Phone number (0971234567)" inputMode="tel" value={v.phone} onChange={set('phone')} required/>
  <input placeholder="Home address" value={v.address} onChange={set('address')} required/>
  <label className="muted" style={{textAlign:'left'}}>Date of birth<input type="date" value={v.birth} onChange={set('birth')} max={new Date().toISOString().slice(0,10)} required/></label>
  <label className="muted" style={{display:'flex',gap:'.5rem',textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} checked={v.married} onChange={set('married')}/> <span>I am married</span></label>
  {v.married&&<label className="muted" style={{textAlign:'left'}}>Date of marriage<input type="date" value={v.marriage} onChange={set('marriage')} max={new Date().toISOString().slice(0,10)} required/></label>}
  <select value={v.branch} onChange={set('branch')} required><option value="">Choose your fellowship…</option>{bs.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select>
  {deptOn&&<label className="muted" style={{textAlign:'left'}}>I am registering as<select value={v.department} onChange={set('department')}><option value="">Member</option>{ds.map(x=><option key={x} value={x}>{x} department</option>)}</select></label>}
  <input type="password" placeholder="Password (6+ characters)" value={v.password} onChange={set('password')} required/><input type="password" placeholder="Confirm password" value={v.password2} onChange={set('password2')} required/>
  <label className="muted" style={{display:'flex',gap:'.5rem',textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} checked={v.agree} onChange={set('agree')} required/> <span>I have read and agree to the <Link to="/privacy" target="_blank">Privacy Notice</Link>.</span></label>
  <button>Register</button><p className="muted">Already registered? <Link to="/">Sign in</Link></p></form>}

export function Privacy(){useLoginBody();return <div className="card login-box" style={{textAlign:'left',maxWidth:640}}><BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/><h2>Privacy Notice — Kingdom Heralds International</h2>
 <p><b>What we keep:</b> your name, phone number, home address, fellowship, attendance, pledges and the payments recorded against them. Your phone's location is used only while you press "Get directions", on your device, and is never stored by us.</p>
 <p><b>Why:</b> to run church programs, record pledges and payments, remind you of pledges, and tell you about events.</p>
 <p><b>Who can see it:</b> the secretaries of your fellowship and the church's system administrator. We do not sell or share your information.</p>
 <p><b>Your rights:</b> you may ask the church office to show you, correct or delete your information, and withdraw your consent at any time (some financial records may have to be kept). Contact: kingdomheralds.info@gmail.com.</p>
 <p className="muted">Draft: please have it reviewed against Zambia's Data Protection Act, 2021 before going live.</p><Link to="/register">← Back</Link></div>}

export function Blocked(){useLoginBody();return <div className="card login-box"><h2>Access blocked</h2><p>Switch off any VPN or proxy, make sure you are in Zambia, then refresh. If you think this is a mistake, contact the church office.</p></div>}

const Geo=({r,k})=>r.lat==null?null:<><button type="button" className="ghost" data-k={k} data-lat={r.lat} data-lng={r.lng} data-name={r.title} onClick={e=>window.khRoute(e.currentTarget)}>📍 Get directions from my location</button><div className="map" id={'map-'+k} hidden/><p className="muted" id={'info-'+k}/></>;

export function About({brand}){const [p,setP]=useState({vision:'To reach all nations for Christ',mission:"Raising true Christians who will impact nations with God's kingdom.",founded:2015,email:'kingdomheralds.info@gmail.com'});
 useEffect(()=>{api('/api/about').then(setP).catch(()=>{})},[]);
 return <div className="card"><div style={{marginBottom:'.6rem'}}><BrandLogo sub={brand}/></div><p className="muted">Serving since {p.founded}</p>
  <p><b>Our vision</b><br/>{p.vision}.</p><p><b>Our mission</b><br/>{p.mission}</p>
  <p><b>Contact us</b><br/><a href={'mailto:'+p.email}>{p.email}</a></p></div>}

export function HomeView({d,tab,msg,alerts,act,go,onLogout}){
 const f=d.features||{},show=k=>f[k]!==false;
 const nv=(k,l)=>show('member.menu.'+k)?<a href="#" key={k} className={tab===k?'on':''} onClick={e=>{e.preventDefault();go(k)}}>{l}</a>:null;
 const pledge=async e=>{e.preventDefault();const f=e.currentTarget,x=new FormData(f),r=await act('/api/member/pledge',{program:x.get('program'),amount:x.get('amount')});if(r)f.reset()};
 const pw=async e=>{e.preventDefault();const f=e.currentTarget,x=new FormData(f),r=await act('/api/member/password',{old:x.get('old'),new:x.get('new'),new2:x.get('new2')});if(r)f.reset()};
 return <><header><div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub={d.me.brand||d.me.branch}/> <span className="muted">· {d.me.name}</span></div>
  <nav>{nv('events','Events')}{nv('pledges','Pledges')}{nv('alerts',<>Alerts <span className="badge" id="bc">{d.unread}</span></>)}{nv('account','Account')}{nv('about','About us')}<Install text="⬇ Install app"/><a href="#" onClick={e=>{e.preventDefault();onLogout()}}>Log out</a></nav></header>
 <main>{msg&&<p className={msg.startsWith('Error')?'err':'ok'}>{msg}</p>}
  {show('feature.self_checkin')&&d.services.map(s=><div className="card" key={s.id}><b>⛪ {s.type} is on today</b>{s.here?<p>✔ You are checked in. God bless you!</p>:<button onClick={()=>act('/api/member/checkin',{id:s.id})}>I am here — check me in</button>}</div>)}
  {tab==='events'&&show('member.menu.events')&&<><h3>Upcoming events</h3>{d.events.length?d.events.map(e=><div className="card ev" key={e.id}>{e.banner&&<img src={e.banner} alt=""/>}<div><h3>{e.title}{e.event_date===d.today&&<> <span className="badge">TODAY</span></>}</h3><p>📅 {fmt(e.event_date)}<br/>📍 {e.location}</p><p className="muted">{e.description}</p><Geo r={e} k={'e'+e.id}/></div></div>):<p className="muted">No upcoming events yet.</p>}</>}
  {tab==='pledges'&&show('member.menu.pledges')&&<>{d.programs.map(r=><div className="card ev" key={r.id}>{r.banner&&<img src={r.banner} alt=""/>}<div><h3>{r.title}</h3><p className="muted">{r.description}</p>{r.location&&<p>📍 {r.location}</p>}{r.deadline&&<p className="muted">Deadline: {fmt(r.deadline)}</p>}<Geo r={r} k={'g'+r.id}/></div></div>)}
   <form className="card" onSubmit={pledge}><h3>Make a pledge</h3><select name="program" required><option value="">Choose a program…</option>{d.programs.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>{!d.programs.length&&<p className="muted">No pledge programs are open right now.</p>}<input name="amount" type="number" min="1" step="0.01" placeholder="Pledge amount (K)" required/><button>Pledge</button></form>
   <h3>My pledges</h3>{d.pledges.length?d.pledges.map(r=>{const bal=r.amount-r.paid;return <div className="card" key={r.id}><b>{r.title}</b><div className="bar"><i style={{width:Math.min(100,Math.round(r.paid/r.amount*100))+'%'}}/></div><p>Pledged {money(r.amount)} · Paid {money(r.paid)} · <b>{bal>0?'Balance '+money(bal):'Fully paid ✔'}</b></p></div>}):<p className="muted">You have no pledges yet.</p>}</>}
  {tab==='alerts'&&show('member.menu.alerts')&&<><h3>Notifications</h3>{alerts===null?<p className="muted">Loading…</p>:alerts.length?alerts.map(n=><div className={'card '+(n.is_read?'':'new')} key={n.id}>{n.message}<div className="muted">{new Date(n.created_at).toLocaleString('en-GB',{timeZone:'Africa/Lusaka',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>):<p className="muted">Nothing yet.</p>}</>}
  {tab==='about'&&show('member.menu.about')&&<About brand={d.me.brand||d.me.branch}/>}
  {tab==='account'&&show('member.menu.account')&&<>{d.me.mustChange&&<p className="err">Please set a new password to continue.</p>}<form className="card" onSubmit={pw}><h3>Change password</h3><input name="old" type="password" placeholder="Current password" required/><input name="new" type="password" placeholder="New password (6+)" required/><input name="new2" type="password" placeholder="Confirm new password" required/><button>Change password</button></form></>}
 </main></>}

export function Home(){const nav=useNavigate(),[sp,setSp]=useSearchParams(),tab=sp.get('p')||'events',[d,setD]=useState(null),[msg,setMsg]=useState(''),[alerts,setAlerts]=useState(null);
 const load=useCallback(async()=>{try{setD(await api('/api/member/home'))}catch(x){x.status===401?nav('/'):setMsg('Error: '+x.message)}},[nav]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{if(!d)return;if(d.me.mustChange&&tab!=='account'&&d.features?.['member.menu.account']!==false){setSp({p:'account'},{replace:true});return}
  if(d.features&&d.features['member.menu.'+tab]===false){const next=['events','pledges','alerts','account','about'].find(k=>d.features['member.menu.'+k]!==false);if(next&&next!==tab)setSp({p:next},{replace:true})}},[d,tab,setSp]);
 useEffect(()=>{if(tab==='alerts'&&d?.features?.['member.menu.alerts']!==false)api('/api/member/alerts').then(x=>{setAlerts(x.items);setD(v=>v&&{...v,unread:0})}).catch(()=>{})},[tab,d?.features]);
 useEffect(()=>{const t=setInterval(()=>api('/api/member/count').then(x=>setD(v=>v&&{...v,unread:x.unread})).catch(()=>{}),30000);return()=>clearInterval(t)},[]);
 const act=async(path,body)=>{try{const r=await api(path,body);setMsg(r.message||'');await load();return r}catch(x){setMsg('Error: '+x.message)}};
 if(!d)return <p className="muted" style={{padding:'2rem'}}>{msg||'Loading…'}</p>;
 return <HomeView d={d} tab={tab} msg={msg} alerts={alerts} act={act} go={k=>{setMsg('');setSp({p:k})}} onLogout={async()=>{await api('/api/member/logout',{}).catch(()=>{});nav('/')}}/>}
