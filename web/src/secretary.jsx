import {useCallback,useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {api} from './api.js';
import {BrandLogo,ReceiptCard,Scroll} from './ui.jsx';

const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const when=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Lusaka',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const useLoginBody=()=>useEffect(()=>{document.body.classList.add('login');return()=>document.body.classList.remove('login')},[]);
const Install=({text})=><a href="#" id="install" hidden onClick={e=>{e.preventDefault();window.khInstall&&window.khInstall()}}>{text}</a>;
const CATS=['Offering','Tithe','Seed','Thanksgiving','Building Fund'];
const small={padding:'.2rem .6rem',width:'auto'};

export function StaffLogin({app,title}){useLoginBody();const nav=useNavigate(),[e,setE]=useState(''),[otp,setOtp]=useState(null),[code,setCode]=useState('');
 const submit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);setE('');
  try{const r=await api('/api/staff/login',{username:f.get('username'),password:f.get('password'),app});
   if(r?.otp_required){setOtp({challenge:r.challenge,sent_to:r.sent_to,demo_code:r.demo_code});setCode('');return}
   nav('/home')}catch(x){setE(x.message)}};
 const verify=async ev=>{ev.preventDefault();setE('');
  try{await api('/api/staff/otp',{challenge:otp.challenge,code});nav('/home')}catch(x){setE(x.message)}};
 const hdr=app==='superadmin'?<BrandLogo center title="KINGDOM HERALDS INTERNATIONAL CHURCH"/>:<BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/>;
 if(otp)return <form onSubmit={verify} className="card login-box">{hdr}<h2>{title} — Verification</h2>
  <p className="muted">Enter the 6-digit one-time code sent to {otp.sent_to||'your email'}.</p>
  {otp.demo_code&&<p className="ok">Demo verification code: <b>{otp.demo_code}</b></p>}
  {e&&<p className="err">{e}</p>}
  <input name="code" placeholder="6-digit verification code" inputMode="numeric" maxLength={6} value={code} onChange={ev=>setCode(ev.target.value)} required autoFocus/>
  <button>Verify code</button>
  <button type="button" className="ghost" onClick={()=>{setOtp(null);setCode('');setE('')}}>Back</button></form>;
 return <form onSubmit={submit} className="card login-box">{hdr}<h2>{title}</h2>{e&&<p className="err">{e}</p>}
  <input name="username" placeholder="Username" required autoFocus/><input name="password" type="password" placeholder="Password" required/><button>Sign in</button>
  <p><Install text="⬇ Install this app"/></p><p className="muted">Forgot password? Contact the Super Admin.</p></form>}

function CashForm({act}){
 return <form className="card noprint" onSubmit={async e=>{e.preventDefault();const f=e.currentTarget,x=new FormData(f),r=await act('/api/staff/cash',Object.fromEntries(x));if(r)f.reset()}}>
  <h3>Record physical cash</h3><div className="grid"><input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (K)" required/>
  <select name="category">{CATS.map(c=><option key={c}>{c}</option>)}</select><input name="sender" placeholder="Given by (optional)"/><input name="note" placeholder="Note (optional)"/></div><button>Save offering</button></form>}

function PledgePay({owing,act}){
 const [q,setQ]=useState(''),[mid,setMid]=useState(''),[pid,setPid]=useState(''),[amt,setAmt]=useState('');
 if(!owing.length)return <div className="card noprint"><h3>Record pledge payment</h3><p className="muted">No member in this fellowship currently owes a pledge.</p></div>;
 const members=[...new Map(owing.map(o=>[o.member_id,o])).values()].filter(o=>!q||(o.member+' '+o.phone).toLowerCase().includes(q.toLowerCase()));
 const mine=owing.filter(o=>String(o.member_id)===mid),cur=owing.find(o=>String(o.id)===pid);
 return <form className="card noprint" onSubmit={async e=>{e.preventDefault();const r=await act('/api/staff/pledge-payment',{pledge:pid,amount:amt});if(r){setMid('');setPid('');setAmt('');setQ('')}}}>
  <h3>Record pledge payment</h3><input placeholder="Search member by name or phone…" value={q} onChange={e=>setQ(e.target.value)}/>
  <select value={mid} onChange={e=>{setMid(e.target.value);const m=owing.filter(o=>String(o.member_id)===e.target.value);setPid(m.length===1?String(m[0].id):'')}} required><option value="">1. Choose member…</option>{members.map(o=><option key={o.member_id} value={o.member_id}>{o.member} · {o.phone}</option>)}</select>
  <select value={pid} onChange={e=>setPid(e.target.value)} disabled={!mid} required><option value="">2. Choose pledge…</option>{mine.map(o=><option key={o.id} value={o.id}>{o.program} — owes {money(o.balance)}</option>)}</select>
  <input type="number" step="0.01" min="0.01" max={cur?cur.balance:undefined} placeholder={cur?`3. Amount paid (max ${money(cur.balance)})`:'3. Amount paid (K)'} value={amt} onChange={e=>setAmt(e.target.value)} disabled={!cur} required/>
  <button type="button" className="ghost" disabled={!cur} onClick={()=>setAmt(String(cur.balance))}>Fill full balance</button><button disabled={!cur}>Record payment</button></form>}

export function SecView({d,msg,act,receipt,onReprint,onCloseReceipt,onLogout}){
 const [editing,setEditing]=useState(null);
 const fOn=k=>d.features?.[k]!==false;
 const voidIt=id=>{const reason=window.prompt('Reason for voiding this entry? (required)');if(reason)act('/api/staff/void',{id,reason})};
 const saveEdit=async e=>{e.preventDefault();const r=await act('/api/staff/offering-edit',{id:editing.id,amount:editing.amount,category:editing.category,sender:editing.sender,note:editing.note,reason:editing.reason});if(r)setEditing(null)};
 const hasAct=fOn('feature.receipts')||d.me.canVoid;
 return <><header><div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub={d.me.brand||d.me.branch}/> <span className="muted">· {d.me.name} ({d.me.slot==='main'?'Main Secretary':'Assistant'})</span></div>
  <nav>{fOn('secretary.menu.attendance')&&<Link to="/attendance">Attendance</Link>}{d.me.canVoid&&fOn('secretary.menu.reports')&&<Link to="/reports">Reports</Link>}<Install text="⬇ Install app"/><a href="#" onClick={e=>{e.preventDefault();onLogout()}}>Log out</a></nav></header>
 <main>{msg&&<p className={msg.startsWith('Error')?'err noprint':'ok noprint'}>{msg}</p>}
  {receipt&&<ReceiptCard r={receipt.receipt} church={receipt.church} onClose={onCloseReceipt}/>}
  {editing&&<form className="card noprint" onSubmit={saveEdit}><h3>Edit entry #{editing.id} ({editing.receipt_no})</h3>
   <div className="grid">
    <input type="number" step="0.01" min="0.01" placeholder="Amount (K)" value={editing.amount} onChange={e=>setEditing({...editing,amount:e.target.value})} required/>
    <input placeholder="Category" value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})} required/>
    <input placeholder="Given by" value={editing.sender||''} onChange={e=>setEditing({...editing,sender:e.target.value})}/>
    <input placeholder="Note" value={editing.note||''} onChange={e=>setEditing({...editing,note:e.target.value})}/>
   </div>
   <input placeholder="Reason for edit (required)" value={editing.reason} onChange={e=>setEditing({...editing,reason:e.target.value})} required/>
   <div style={{display:'flex',gap:'.5rem'}}><button style={{width:'auto'}}>Save edit</button><button type="button" className="ghost" style={{width:'auto'}} onClick={()=>setEditing(null)}>Cancel</button></div></form>}
  <div className={receipt?'noprint':''}>
   {fOn('feature.announcements')&&(d.announcements||[]).length>0&&<div className="card noprint" style={{borderLeft:'4px solid var(--gold, #b8860b)'}}><h3>Announcements</h3>
    {d.announcements.map(a=><div key={a.id} style={{padding:'.45rem 0',borderTop:'1px solid var(--line, #eee)'}}>
     <b>{a.title}</b> <span className="tag digital">{a.branch_label||'All branches'}</span>
     <p style={{margin:'.25rem 0'}}>{a.body}</p>
     {a.expires_at&&<div className="muted">Expires: {a.expires_at}</div>}
    </div>)}
   </div>}
   <CashForm act={act}/><PledgePay owing={d.owing} act={act}/>
   {d.me.canVoid&&fOn('feature.two_step_approval')&&(d.approvals||[]).length>0&&<div className="card"><h3>Pending two-step approvals (≥ {money(d.threshold??500)})</h3>
    <Scroll><table><thead><tr><th>Action</th><th>Entry</th><th className="r">Amount</th><th>Requested by</th><th>Reason</th><th/></tr></thead><tbody>
     {d.approvals.map(r=><tr key={r.id}><td><span className="tag physical">{r.action}</span></td><td>#{r.offering_id}</td><td className="r">{money(r.amount)}</td>
      <td>{r.requested_by}</td><td>{r.reason}{r.action==='edit'&&r.payload?.amount!=null&&<div className="muted">New amount: {money(r.payload.amount)}</div>}</td>
      <td style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>{r.isMine?<span className="muted">Awaiting another approver</span>:<>
       <button type="button" style={small} onClick={()=>act('/api/staff/approval',{id:r.id,action:'approve'})}>Approve</button>
       <button type="button" className="danger" style={small} onClick={()=>act('/api/staff/approval',{id:r.id,action:'reject'})}>Reject</button>
      </>}</td></tr>)}
    </tbody></table></Scroll></div>}
   <h3>Live records <span className="muted">· digital payments appear automatically</span></h3>
   <div className="stats">{[['Today · Physical',d.totals.pToday],['Today · Digital',d.totals.dToday],['Today · Total',d.totals.pToday+d.totals.dToday],['This month',d.totals.month]].map(([l,v])=><div className="stat" key={l}><span>{l}</span><b>{money(v)}</b></div>)}</div>
   <div style={{overflowX:'auto'}}><table><thead><tr><th>Receipt</th><th>Time</th><th>Type</th><th>Category</th><th>From</th><th className="r">Amount</th>{hasAct&&<th/>}</tr></thead><tbody>
    {d.recent.map(r=><tr key={r.id} style={r.voided?{opacity:.45,textDecoration:'line-through'}:undefined} title={r.voided?'Voided: '+r.void_reason:undefined}>
     <td style={{fontFamily:'monospace',fontSize:'.8rem'}}>{r.receipt_no||'—'}</td><td>{when(r.created_at)}</td><td><span className={'tag '+r.type}>{r.type}</span></td><td>{r.category}</td><td>{r.sender||'—'}</td><td className="r">{money(r.amount)}</td>
     {hasAct&&<td style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
      {fOn('feature.receipts')&&onReprint&&<button type="button" className="ghost" style={small} onClick={()=>onReprint(r.id)}>Receipt</button>}
      {d.me.canVoid&&!r.voided&&<><button type="button" className="ghost" style={small} onClick={()=>setEditing({id:r.id,receipt_no:r.receipt_no,amount:r.amount,category:r.category,sender:r.sender||'',note:r.note||'',reason:''})}>Edit</button><button className="ghost" style={small} onClick={()=>voidIt(r.id)}>Void</button></>}
     </td>}</tr>)}
   </tbody></table></div>
  </div></main></>}

export function SecHome(){const nav=useNavigate(),[d,setD]=useState(null),[msg,setMsg]=useState(''),[receipt,setReceipt]=useState(null);
 const load=useCallback(async()=>{try{setD(await api('/api/staff/home'))}catch(x){x.status===401?nav('/'):setMsg('Error: '+x.message)}},[nav]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{const t=setInterval(()=>api('/api/staff/feed').then(f=>setD(v=>v&&{...v,...f})).catch(()=>{}),10000);return()=>clearInterval(t)},[]);
 const act=async(path,body)=>{try{const r=await api(path,body);setMsg(r.message||'');await load();return r}catch(x){setMsg('Error: '+x.message)}};
 const onReprint=async id=>{try{setReceipt(await api('/api/staff/receipt?id='+id))}catch(x){setMsg('Error: '+x.message)}};
 if(!d)return <p className="muted" style={{padding:'2rem'}}>{msg||'Loading…'}</p>;
 return <SecView d={d} msg={msg} act={act} receipt={receipt} onReprint={onReprint} onCloseReceipt={()=>setReceipt(null)} onLogout={async()=>{await api('/api/staff/logout',{}).catch(()=>{});nav('/')}}/>}
