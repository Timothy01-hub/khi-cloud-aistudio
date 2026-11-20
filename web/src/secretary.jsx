import {useCallback,useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {api} from './api.js';
import {BrandLogo} from './ui.jsx';

const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const when=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Lusaka',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const useLoginBody=()=>useEffect(()=>{document.body.classList.add('login');return()=>document.body.classList.remove('login')},[]);
const Install=({text})=><a href="#" id="install" hidden onClick={e=>{e.preventDefault();window.khInstall&&window.khInstall()}}>{text}</a>;
const CATS=['Offering','Tithe','Seed','Thanksgiving','Building Fund'];

export function StaffLogin({app,title}){useLoginBody();const nav=useNavigate(),[e,setE]=useState('');
 const submit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);setE('');
  try{await api('/api/staff/login',{username:f.get('username'),password:f.get('password'),app});nav('/home')}catch(x){setE(x.message)}};
 return <form onSubmit={submit} className="card login-box">{app==='superadmin'?<BrandLogo center title="KINGDOM HERALDS INTERNATIONAL CHURCH"/>:<BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/>}<h2>{title}</h2>{e&&<p className="err">{e}</p>}
  <input name="username" placeholder="Username" required autoFocus/><input name="password" type="password" placeholder="Password" required/><button>Sign in</button>
  <p><Install text="⬇ Install this app"/></p><p className="muted">Forgot password? Contact the Super Admin.</p></form>}

function CashForm({act}){
 return <form className="card" onSubmit={async e=>{e.preventDefault();const f=e.currentTarget,x=new FormData(f),r=await act('/api/staff/cash',Object.fromEntries(x));if(r)f.reset()}}>
  <h3>Record physical cash</h3><div className="grid"><input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (K)" required/>
  <select name="category">{CATS.map(c=><option key={c}>{c}</option>)}</select><input name="sender" placeholder="Given by (optional)"/><input name="note" placeholder="Note (optional)"/></div><button>Save offering</button></form>}

function PledgePay({owing,act}){
 const [q,setQ]=useState(''),[mid,setMid]=useState(''),[pid,setPid]=useState(''),[amt,setAmt]=useState('');
 if(!owing.length)return <div className="card"><h3>Record pledge payment</h3><p className="muted">No member in this fellowship currently owes a pledge.</p></div>;
 const members=[...new Map(owing.map(o=>[o.member_id,o])).values()].filter(o=>!q||(o.member+' '+o.phone).toLowerCase().includes(q.toLowerCase()));
 const mine=owing.filter(o=>String(o.member_id)===mid),cur=owing.find(o=>String(o.id)===pid);
 return <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/staff/pledge-payment',{pledge:pid,amount:amt});if(r){setMid('');setPid('');setAmt('');setQ('')}}}>
  <h3>Record pledge payment</h3><input placeholder="Search member by name or phone…" value={q} onChange={e=>setQ(e.target.value)}/>
  <select value={mid} onChange={e=>{setMid(e.target.value);const m=owing.filter(o=>String(o.member_id)===e.target.value);setPid(m.length===1?String(m[0].id):'')}} required><option value="">1. Choose member…</option>{members.map(o=><option key={o.member_id} value={o.member_id}>{o.member} · {o.phone}</option>)}</select>
  <select value={pid} onChange={e=>setPid(e.target.value)} disabled={!mid} required><option value="">2. Choose pledge…</option>{mine.map(o=><option key={o.id} value={o.id}>{o.program} — owes {money(o.balance)}</option>)}</select>
  <input type="number" step="0.01" min="0.01" max={cur?cur.balance:undefined} placeholder={cur?`3. Amount paid (max ${money(cur.balance)})`:'3. Amount paid (K)'} value={amt} onChange={e=>setAmt(e.target.value)} disabled={!cur} required/>
  <button type="button" className="ghost" disabled={!cur} onClick={()=>setAmt(String(cur.balance))}>Fill full balance</button><button disabled={!cur}>Record payment</button></form>}

export function SecView({d,msg,act,onLogout}){
 const voidIt=id=>{const reason=window.prompt('Reason for voiding this entry? (required)');if(reason)act('/api/staff/void',{id,reason})};
 return <><header><div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub={d.me.brand||d.me.branch}/> <span className="muted">· {d.me.name} ({d.me.slot==='main'?'Main Secretary':'Assistant'})</span></div>
  <nav>{d.features?.['secretary.menu.attendance']!==false&&<Link to="/attendance">Attendance</Link>}{d.me.canVoid&&d.features?.['secretary.menu.reports']!==false&&<Link to="/reports">Reports</Link>}<Install text="⬇ Install app"/><a href="#" onClick={e=>{e.preventDefault();onLogout()}}>Log out</a></nav></header>
 <main>{msg&&<p className={msg.startsWith('Error')?'err':'ok'}>{msg}</p>}
  <CashForm act={act}/><PledgePay owing={d.owing} act={act}/>
  <h3>Live records <span className="muted">· digital payments appear automatically</span></h3>
  <div className="stats">{[['Today · Physical',d.totals.pToday],['Today · Digital',d.totals.dToday],['Today · Total',d.totals.pToday+d.totals.dToday],['This month',d.totals.month]].map(([l,v])=><div className="stat" key={l}><span>{l}</span><b>{money(v)}</b></div>)}</div>
  <div style={{overflowX:'auto'}}><table><thead><tr><th>Time</th><th>Type</th><th>Category</th><th>From</th><th className="r">Amount</th>{d.me.canVoid&&<th></th>}</tr></thead><tbody>
   {d.recent.map(r=><tr key={r.id} style={r.voided?{opacity:.45,textDecoration:'line-through'}:undefined} title={r.voided?'Voided: '+r.void_reason:undefined}>
    <td>{when(r.created_at)}</td><td><span className={'tag '+r.type}>{r.type}</span></td><td>{r.category}</td><td>{r.sender||'—'}</td><td className="r">{money(r.amount)}</td>
    {d.me.canVoid&&<td>{!r.voided&&<button className="ghost" style={{padding:'.2rem .6rem',width:'auto'}} onClick={()=>voidIt(r.id)}>Void</button>}</td>}</tr>)}
  </tbody></table></div></main></>}

export function SecHome(){const nav=useNavigate(),[d,setD]=useState(null),[msg,setMsg]=useState('');
 const load=useCallback(async()=>{try{setD(await api('/api/staff/home'))}catch(x){x.status===401?nav('/'):setMsg('Error: '+x.message)}},[nav]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{const t=setInterval(()=>api('/api/staff/feed').then(f=>setD(v=>v&&{...v,...f})).catch(()=>{}),10000);return()=>clearInterval(t)},[]);
 const act=async(path,body)=>{try{const r=await api(path,body);setMsg(r.message||'');await load();return r}catch(x){setMsg('Error: '+x.message)}};
 if(!d)return <p className="muted" style={{padding:'2rem'}}>{msg||'Loading…'}</p>;
 return <SecView d={d} msg={msg} act={act} onLogout={async()=>{await api('/api/staff/logout',{}).catch(()=>{});nav('/')}}/>}
