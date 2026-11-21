import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {BrandLogo,Msg,Stats,Scroll,People,Loading,ReceiptCard,useData,useAct,useLogout,money,when,day,today,readImage,Pin} from './ui.jsx';
import {Reports} from './reports.jsx';
const small={padding:'.2rem .6rem',width:'auto'};
const uPath=(p,u)=>!u?p:p+(p.includes('?')?'&':'?')+'unit_id='+encodeURIComponent(u);
const useUAct=(setMsg,reload,u)=>{const a=useAct(setMsg,reload);return(p,b)=>a(uPath(p,u),b)};

function Overview({unitId=''}){const [d,load,err]=useData(uPath('/api/admin/overview',unitId)),[msg,setMsg]=useState(''),[receipt,setReceipt]=useState(null),[editing,setEditing]=useState(null),act=useUAct(setMsg,load,unitId);
 useEffect(()=>{const t=setInterval(load,10000);return()=>clearInterval(t)},[load]);
 if(!d)return <Loading err={err}/>;
 const voidIt=id=>{const r=window.prompt('Reason for voiding this entry? (required)');if(r)act('/api/admin/void',{id,reason:r})};
 const saveEdit=async e=>{e.preventDefault();const r=await act('/api/admin/offering-edit',{id:editing.id,amount:editing.amount,category:editing.category,sender:editing.sender,note:editing.note,reason:editing.reason});if(r)setEditing(null)};
 const showReceipt=async id=>{try{setReceipt(await apiGet(uPath('/api/admin/receipt?id='+id,unitId)))}catch(x){setMsg('Error: '+x.message)}};
 return <><Msg m={msg}/>
  {receipt&&<ReceiptCard r={receipt.receipt} church={receipt.church} onClose={()=>setReceipt(null)}/>}
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
   <h3>Churches · live</h3><Scroll><table><thead><tr><th>Church</th><th className="r">Today</th><th className="r">This month</th></tr></thead><tbody>
    {d.rows.map(r=><tr key={r.id}><td>{r.name}{r.is_main&&<> <span className="tag digital">MAIN</span></>}</td><td className="r">{money(r.today)}</td><td className="r">{money(r.month)}</td></tr>)}</tbody></table></Scroll>
   <Stats items={[['Today · Physical',money(d.totals.pToday)],['Today · Digital',money(d.totals.dToday)],['Today · Total',money(d.totals.pToday+d.totals.dToday)],['This month',money(d.totals.month)]]}/>
   <Scroll><table><thead><tr><th>Receipt</th><th>Time</th><th>Church</th><th>Type</th><th>Category</th><th>From</th><th className="r">Amount</th><th/></tr></thead><tbody>
    {d.recent.map(r=><tr key={r.id} style={r.voided?{opacity:.45,textDecoration:'line-through'}:undefined}><td style={{fontFamily:'monospace',fontSize:'.8rem'}}>{r.receipt_no||'—'}</td><td>{when(r.created_at)}</td><td>{r.bn}</td><td><span className={'tag '+r.type}>{r.type}</span></td><td>{r.category}</td><td>{r.sender||'—'}</td><td className="r">{money(r.amount)}</td>
     <td style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
      <button type="button" className="ghost" style={small} onClick={()=>showReceipt(r.id)}>Receipt</button>
      {d.canVoid!==false&&!r.voided&&<><button type="button" className="ghost" style={small} onClick={()=>setEditing({id:r.id,receipt_no:r.receipt_no,amount:r.amount,category:r.category,sender:r.sender||'',note:r.note||'',reason:''})}>Edit</button><button type="button" className="ghost" style={small} onClick={()=>voidIt(r.id)}>Void</button></>}
     </td></tr>)}</tbody></table></Scroll>
  </div></>}

async function apiGet(path){const {api}=await import('./api.js');return api(path)}

function Slot({f,slot,label,s,act}){const [pw,setPw]=useState('');
 if(!s)return <div className="slot"><b>{label}</b><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,r=await act('/api/admin/account',{a:'create',branch:f.id,slot,...Object.fromEntries(new FormData(form))});if(r)form.reset()}}>
  <input name="name" placeholder="Full name" required/><input name="username" placeholder="Username" required/><input name="password" placeholder="Password (8+)" required/><button>Create account</button></form></div>;
 return <div className="slot"><b>{label}</b><p>{s.full_name} · <span className="muted">@{s.username}</span> · {s.active?'Active':<span style={{color:'#e57'}}>Disabled</span>}{s.locked&&<> · <span className="badge">LOCKED</span></>}</p>
  <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/account',{a:'password',id:s.id,password:pw});if(r)setPw('')}}><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (8+)" required/><button className="ghost">Change password</button></form>
  {s.locked&&<button type="button" style={{marginBottom:'.3rem'}} onClick={()=>act('/api/admin/unlock',{ident:'s:'+s.username.toLowerCase()})}>Unlock account</button>}
  <button className="ghost" onClick={()=>act('/api/admin/account',{a:'toggle',id:s.id})}>{s.active?'Disable':'Enable'}</button>
  <button className="danger" onClick={()=>window.confirm('Delete this account?')&&act('/api/admin/account',{a:'delete',id:s.id})}>Delete</button></div>}
function Accounts({unitId=''}){const [d,load,err]=useData(uPath('/api/admin/accounts',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><div className="grid">{d.fellowships.map(f=><div className="card" key={f.id}><h3>{f.label||f.name}</h3>{[['main','Main Secretary'],['assistant','Assistant Secretary']].map(([slot,label])=><Slot key={slot} f={f} slot={slot} label={label} s={f.slots[slot]} act={act}/>)}</div>)}</div>
  <form className="card" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,r=await act('/api/admin/account',{a:'own',password:new FormData(form).get('password')});if(r)form.reset()}}><h3>My (Super Admin) password</h3><input name="password" type="password" minLength={8} required/><button className="ghost">Change</button></form></>}

function Members({unitId=''}){const [d,load,err]=useData(uPath('/api/admin/members',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><Scroll><table><thead><tr><th>Member</th><th>Phone</th><th>Fellowship (change if wrong)</th><th className="r">Pledged</th><th className="r">Paid</th><th/></tr></thead><tbody>
  {d.rows.map(m=><tr key={m.id}><td>{m.full_name}{m.locked&&<> <span className="badge">LOCKED</span></>}</td><td>{m.phone}</td><td><select value={m.branch_id} onChange={e=>act('/api/admin/member',{a:'move',id:m.id,branch:e.target.value})}>{d.fellowships.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select></td>
   <td className="r">{money(m.pledged)}</td><td className="r">{money(m.paid)}</td><td style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
    <button className="ghost" onClick={()=>window.confirm('Reset password?')&&act('/api/admin/member',{a:'reset',id:m.id})}>Reset password</button>
    {m.locked&&<button style={small} onClick={()=>act('/api/admin/unlock',{ident:m.phone})}>Unlock</button>}
   </td></tr>)}</tbody></table></Scroll></>}

const EXP_CATS=['Utilities','Welfare','Maintenance','Transport','Supplies','Ministry Event','Equipment','Other'];
function Expenses({unitId=''}){
 const [d,load,err]=useData(uPath('/api/admin/expenses',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);
 const E0={expense_date:today(),category:'Utilities',amount:'',description:'',branch:'',receipt_photo:''},[v,setV]=useState(E0),set=k=>e=>setV({...v,[k]:e.target.value});
 if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/>
  <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/expenses',{a:'add',...v});if(r)setV(E0)}}>
   <h3>Log an expense</h3>
   <div className="grid">
    <input type="date" value={v.expense_date} onChange={set('expense_date')} required/>
    <select value={v.category} onChange={set('category')}>{EXP_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
    <input type="number" step="0.01" min="0.01" placeholder="Amount (K)" value={v.amount} onChange={set('amount')} required/>
    <select value={v.branch} onChange={set('branch')} required><option value="">Choose branch…</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
   </div>
   <input placeholder="Description / purpose of expense" value={v.description} onChange={set('description')} required/>
   <label className="muted">Receipt photo (optional, JPG/PNG/WEBP max 3MB)</label>
   <input type="file" accept="image/*" key={v.receipt_photo?'ep1':'ep0'} onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const img=await readImage(f);setV(x=>({...x,receipt_photo:img}))}catch(x){setMsg('Error: '+x.message)}}}/>
   {v.receipt_photo&&<img src={v.receipt_photo} alt="Receipt" style={{maxHeight:180,borderRadius:8,margin:'.4rem 0'}}/>}
   <button>Log expense</button>
  </form>
  <Stats items={[['Pending',money(d.totals.pending)],['Approved',money(d.totals.approved)],['Rejected',money(d.totals.rejected)]]}/>
  <Scroll><table><thead><tr><th>Date</th><th>Church</th><th>Category</th><th>Description</th><th>Receipt</th><th className="r">Amount</th><th>Logged by</th><th>Status</th><th/></tr></thead><tbody>
   {!d.expenses.length?<tr><td colSpan={9} className="muted">No expenses logged yet.</td></tr>:d.expenses.map(r=><tr key={r.id}>
    <td>{r.expense_date}</td><td>{r.bn}</td><td>{r.category}</td><td>{r.description}{r.review_note&&<div className="muted">Note: {r.review_note}</div>}</td>
    <td>{r.receipt_photo?<a href={r.receipt_photo} target="_blank" rel="noreferrer">View photo</a>:'—'}</td>
    <td className="r">{money(r.amount)}</td><td>{r.logged_by}</td>
    <td><span className={'tag '+(r.status==='approved'?'digital':r.status==='rejected'?'leader':'physical')}>{r.status}</span>{r.reviewed_by&&<div className="muted">by {r.reviewed_by}</div>}</td>
    <td style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
     {r.status==='pending'&&(r.canReview?<>
      <button type="button" style={small} onClick={()=>act('/api/admin/expenses',{a:'approve',id:r.id})}>Approve</button>
      <button type="button" className="danger" style={small} onClick={()=>{const note=window.prompt('Rejection note (optional):')||'';act('/api/admin/expenses',{a:'reject',id:r.id,note})}}>Reject</button>
     </>:<span className="muted">Needs another admin</span>)}
    </td>
   </tr>)}</tbody></table></Scroll></>;
}

function Approvals({unitId=''}){
 const [d,load,err]=useData(uPath('/api/admin/approvals',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);
 const [thr,setThr]=useState('');
 useEffect(()=>{if(d)setThr(String(d.threshold??500))},[d]);
 if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/>
  <div className="card">
   <h3>Two-step approval threshold: {money(d.threshold)}</h3>
   <p className="muted">Voiding or editing an offering/pledge payment at or above this amount requires a second, different authorised approver (Main Secretary of that branch, Admin, or Super Admin).</p>
   {d.canEditThreshold&&<form onSubmit={e=>{e.preventDefault();act('/api/admin/profile',{threshold:thr})}} style={{display:'flex',gap:'.5rem',alignItems:'center',flexWrap:'wrap',marginTop:'.5rem'}}>
    <input type="number" step="0.01" min="0" value={thr} onChange={e=>setThr(e.target.value)} style={{width:180}} required/>
    <button style={{width:'auto'}}>Save threshold</button>
   </form>}
  </div>
  <Scroll><table><thead><tr><th>Time</th><th>Church</th><th>Action</th><th>Entry</th><th className="r">Amount</th><th>Reason / Change</th><th>Requested by</th><th>Status</th><th/></tr></thead><tbody>
   {!d.requests.length?<tr><td colSpan={9} className="muted">No approval requests yet.</td></tr>:d.requests.map(r=><tr key={r.id}>
    <td>{when(r.created_at)}</td><td>{r.bn}</td><td><span className="tag physical">{r.action}</span></td><td>#{r.offering_id}</td><td className="r">{money(r.amount)}</td>
    <td>{r.reason}{r.action==='edit'&&r.payload?.amount!=null&&<div className="muted">Edit to {money(r.payload.amount)} ({r.payload.category})</div>}</td>
    <td>{r.requested_by}</td>
    <td><span className={'tag '+(r.status==='approved'?'digital':r.status==='rejected'?'leader':'physical')}>{r.status}</span>{r.reviewed_by&&<div className="muted">by {r.reviewed_by}</div>}</td>
    <td style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
     {r.status==='pending'&&(r.isMine?<span className="muted">Awaiting another approver</span>:<>
      <button type="button" style={small} onClick={()=>act('/api/admin/approval',{id:r.id,action:'approve'})}>Approve</button>
      <button type="button" className="danger" style={small} onClick={()=>act('/api/admin/approval',{id:r.id,action:'reject'})}>Reject</button>
     </>)}
    </td>
   </tr>)}</tbody></table></Scroll></>;
}

const EMPTY={title:'',date:'',deadline:'',location:'',description:'',branch:'',lat:'',lng:'',banner:''};
function Form({ev,fellowships,act,setMsg,canAll}){const [v,setV]=useState(EMPTY),set=k=>e=>setV({...v,[k]:e.target.value});
 return <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act(ev?'/api/admin/event':'/api/admin/program',{a:'add',...v});if(r)setV(EMPTY)}}>
  <h3>{ev?'Add event':'Add pledge program'}</h3><input placeholder={ev?'Event title':'e.g. Church Building Project'} value={v.title} onChange={set('title')} required/>
  {ev?<input type="date" value={v.date} onChange={set('date')} required/>:<><label className="muted">Pledge deadline (optional)</label><input type="date" value={v.deadline} onChange={set('deadline')}/></>}
  <input placeholder={ev?'Venue name / address':'Where is it held / located? (optional)'} value={v.location} onChange={set('location')} required={ev}/><input placeholder="Short description" value={v.description} onChange={set('description')}/>
  <select value={v.branch} onChange={set('branch')} required={!canAll}><option value="">{canAll?'All churches':'Choose the church…'}</option>{fellowships.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select>
  <label className="muted">Pin the venue on the map (Zambia only) — click the map or type coordinates</label><Pin lat={v.lat} lng={v.lng} onPick={(lat,lng)=>setV(x=>({...x,lat,lng}))}/>
  <div className="grid"><input placeholder="Latitude e.g. -15.4167" value={v.lat} onChange={set('lat')}/><input placeholder="Longitude e.g. 28.2833" value={v.lng} onChange={set('lng')}/></div>
  <label className="muted">Banner image (JPG/PNG/WEBP, max 3MB — shown in full to members)</label>
  <input type="file" accept="image/*" key={v.banner?'f1':'f0'} onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const b=await readImage(f);setV(x=>({...x,banner:b}))}catch(x){setMsg('Error: '+x.message)}}}/>
  {v.banner&&<img src={v.banner} alt="" style={{width:'100%',borderRadius:10}}/>}<button>{ev?'Publish event':'Add program'}</button></form>}
function Content({which,unitId=''}){const [d,load,err]=useData(uPath('/api/admin/content',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);if(!d)return <Loading err={err}/>;const ev=which==='events';
 return <><Msg m={msg}/><Form ev={ev} fellowships={d.fellowships} act={act} setMsg={setMsg} canAll={d.canAll}/>
  {ev?<Scroll><table><thead><tr><th>Date</th><th>Event</th><th>Venue</th><th>Pin</th><th/></tr></thead><tbody>{d.events.map(r=><tr key={r.id}><td>{day(r.event_date)}</td><td>{r.title}</td><td>{r.location}</td><td>{r.lat!=null?'✔':'—'}</td><td><button className="danger" style={small} onClick={()=>window.confirm('Delete?')&&act('/api/admin/event',{a:'delete',id:r.id})}>×</button></td></tr>)}</tbody></table></Scroll>
  :<Scroll><table><thead><tr><th>Program</th><th className="r">Pledged</th><th className="r">Paid</th><th>Pin</th><th/></tr></thead><tbody>{d.programs.map(r=><tr key={r.id}><td>{r.title}{!r.active&&<span className="muted"> (closed)</span>}</td><td className="r">{money(r.pledged)}</td><td className="r">{money(r.paid)}</td><td>{r.lat!=null?'✔':'—'}</td><td><button className="ghost" style={small} onClick={()=>act('/api/admin/program',{a:'toggle',id:r.id})}>{r.active?'Close':'Open'}</button></td></tr>)}</tbody></table></Scroll>}</>}

function AdminAtt({unitId=''}){const [sp,setSp]=useSearchParams(),g=k=>sp.get(k)||'',[qq,setQq]=useState(g('q'));
 const [d,,err]=useData(uPath(`/api/admin/attendance?branch=${g('branch')}&k=${g('k')}&q=${encodeURIComponent(g('q'))}&svc=${g('svc')}`,unitId));
 const set=(o)=>{const n=new URLSearchParams(sp);Object.entries(o).forEach(([k,v])=>v?n.set(k,v):n.delete(k));setSp(n)};if(!d)return <Loading err={err}/>;
 return <><form className="card noprint" onSubmit={e=>{e.preventDefault();set({q:qq})}}><div className="grid"><select value={g('branch')} onChange={e=>set({branch:e.target.value})}><option value="">All fellowships</option>{d.fellowships.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select>
  <select value={g('k')} onChange={e=>set({k:e.target.value})}><option value="">Members &amp; visitors</option><option value="member">Members only</option><option value="visitor">Visitors only</option></select><input value={qq} onChange={e=>setQq(e.target.value)} placeholder="Search name or phone"/></div><button>Filter</button></form>
  <h3>Fellowship summary</h3><Scroll><table><thead><tr><th>Church</th><th className="r">Members</th><th className="r">Visitors</th><th className="r">Latest service (date · present)</th></tr></thead><tbody>{d.summary.map(r=><tr key={r.id}><td>{r.name}</td><td className="r">{r.members}</td><td className="r">{r.visitors}</td><td className="r">{r.latest||'—'}</td></tr>)}</tbody></table></Scroll>
  <h3>Services</h3><Scroll><table><thead><tr><th>Date</th><th>Service</th><th>Church</th><th className="r">Present</th><th/></tr></thead><tbody>{d.services.map(r=><tr key={r.id}><td>{r.service_date}</td><td>{r.service_type}</td><td>{r.bn}</td><td className="r">{r.count}</td><td><a href="#" onClick={e=>{e.preventDefault();set({svc:r.id})}}>View list</a></td></tr>)}</tbody></table></Scroll>
  {g('svc')&&<><h3>Present at the selected service</h3><People rows={d.present} branch/></>}<h3>People directory</h3><People rows={d.people} branch/></>}

function Audit({unitId=''}){const [d,,err]=useData(uPath('/api/admin/audit',unitId));if(!d)return <Loading err={err}/>;
 return <Scroll><table><thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody>{d.rows.map(r=><tr key={r.id}><td>{when(r.created_at)}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.detail}</td><td>{r.ip}</td></tr>)}</tbody></table></Scroll>}

const KWORD={center:'Centre',branch:'Branch',fellowship:'Fellowship'};
const preview=(n,k)=>{const t=n.trim(),u=t.toUpperCase(),w=KWORD[k].toUpperCase();return u.endsWith(w)||(k==='center'&&u.endsWith('CENTER'))?t:t+' '+KWORD[k]};
const COND=['New','Good','Fair','Poor','Needs repair'];

function UnitEdit({u,all,act}){const [v,setV]=useState({name:u.name,kind:u.kind,parent:u.parent_id||'',momo:u.momo_number||''}),set=k=>e=>setV({...v,[k]:e.target.value});
 return <form className="card" onSubmit={e=>{e.preventDefault();act('/api/admin/fellowships',{a:'save',id:u.id,...v})}}><b>{preview(v.name||u.name,v.kind)}</b>
  <input value={v.name} onChange={set('name')} required/><select value={v.kind} onChange={set('kind')}><option value="center">Centre</option><option value="branch">Branch</option><option value="fellowship">Fellowship</option></select>
  <select value={v.parent} onChange={set('parent')}><option value="">Stands on its own (no parent)</option>{all.filter(x=>x.id!==u.id).map(x=><option key={x.id} value={x.id}>Sits under {x.label}</option>)}</select>
  <input value={v.momo} onChange={set('momo')} placeholder="Mobile-money number"/><button className="ghost">Save changes</button></form>}
function Units({unitId='',onChange}){const [d,load,err]=useData(uPath('/api/admin/fellowships',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,async()=>{await load();onChange?.()},unitId),E0={name:'',kind:'center',parent:'',momo:''},[v,setV]=useState(E0);if(!d)return <Loading err={err}/>;
 const set=k=>e=>setV({...v,[k]:e.target.value});
 return <><Msg m={msg}/><form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/fellowships',{a:'add',...v});if(r)setV(E0)}}><h3>Add a centre, branch or fellowship</h3>
  <input placeholder="Name, e.g. Lusaka" value={v.name} onChange={set('name')} required/><select value={v.kind} onChange={set('kind')}><option value="center">Centre</option><option value="branch">Branch</option><option value="fellowship">Fellowship</option></select>
  <select value={v.parent} onChange={set('parent')}><option value="">Stands on its own (no parent)</option>{d.map(u=><option key={u.id} value={u.id}>Sits under {u.label}</option>)}</select>
  <input placeholder="Mobile-money number (optional)" value={v.momo} onChange={set('momo')}/><p className="muted">It will appear as: <b>{v.name.trim()?preview(v.name,v.kind):'…'}</b></p><button>Add</button></form>
  {d.map(u=><UnitEdit key={[u.id,u.name,u.kind,u.parent_id].join('|')} u={u} all={d} act={act}/>)}</>}

function Privs({d,value,onChange}){return <div><p className="muted">Privileges this admin may use:</p>
 {d.grantable.map(([k,l])=><label key={k} className="muted" style={{display:'flex',gap:'.5rem',textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} checked={value.includes(k)} onChange={e=>onChange(e.target.checked?[...value,k]:value.filter(x=>x!==k))}/> {l}</label>)}
 <p className="muted" style={{marginTop:'.6rem'}}>🔒 Reserved for the Super Admin (can never be given to an admin):</p>
 {d.blocked.map(([k,l])=><label key={k} className="muted" style={{display:'flex',gap:'.5rem',opacity:.55,textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} disabled/> {l}</label>)}</div>}
function AdminCard({a,d,act}){const [p,setP]=useState(a.privileges),[pw,setPw]=useState('');
 return <div className="card"><h3>{a.full_name} <span className="muted">@{a.username}</span></h3><p>{a.unit} · {a.active?'Active':<span style={{color:'#e57'}}>Disabled</span>}{a.locked&&<> · <span className="badge">LOCKED</span></>}</p><Privs d={d} value={p} onChange={setP}/>
  {a.locked&&<button type="button" style={{marginBottom:'.4rem'}} onClick={()=>act('/api/admin/unlock',{ident:'s:'+a.username.toLowerCase()})}>Unlock account</button>}
  <button className="ghost" onClick={()=>act('/api/admin/admin',{a:'privileges',id:a.id,privileges:p})}>Save privileges</button>
  <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/admin',{a:'password',id:a.id,password:pw});if(r)setPw('')}}><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (8+)" required/><button className="ghost">Change password</button></form>
  <button className="ghost" onClick={()=>act('/api/admin/admin',{a:'toggle',id:a.id})}>{a.active?'Disable':'Enable'}</button>
  <button className="danger" onClick={()=>window.confirm('Delete this admin?')&&act('/api/admin/admin',{a:'delete',id:a.id})}>Delete</button></div>}
function Admins({unitId=''}){const [d,load,err]=useData(uPath('/api/admin/admins',unitId)),[lkData,loadLk]=useData(uPath('/api/admin/locks',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,async()=>{await load();await loadLk()},unitId),E0={name:'',username:'',password:'',branch:'',privileges:['attendance','reports']},[v,setV]=useState(E0),set=k=>e=>setV({...v,[k]:e.target.value});if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/>
  {(lkData?.locks||[]).length>0&&<div className="card"><h3>Locked accounts (15-min password lock)</h3>
   <Scroll><table><thead><tr><th>Account</th><th>Type</th><th>Church</th><th/></tr></thead><tbody>
    {lkData.locks.map(l=><tr key={l.ident}><td>{l.label}</td><td>{l.kind}</td><td>{l.unit||'—'}</td>
     <td><button type="button" style={small} onClick={()=>act('/api/admin/unlock',{ident:l.ident})}>Unlock</button></td></tr>)}
   </tbody></table></Scroll></div>}
  <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/admin',{a:'create',...v});if(r)setV(E0)}}><h3>Create an admin</h3>
   <input placeholder="Full name" value={v.name} onChange={set('name')} required/><input placeholder="Username" value={v.username} onChange={set('username')} required/><input placeholder="Password (8+)" value={v.password} onChange={set('password')} required/>
   <select value={v.branch} onChange={set('branch')} required><option value="">Which centre, branch or fellowship will they run?</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
   <Privs d={d} value={v.privileges} onChange={p=>setV({...v,privileges:p})}/><button>Create admin</button></form>
  <div className="grid">{d.admins.map(a=><AdminCard key={a.id+a.privileges.join()+String(!!a.locked)} a={a} d={d} act={act}/>)}</div></>}

function Leaders({unitId=''}){const [sp,setSp]=useSearchParams(),q=sp.get('q')||'',[qq,setQq]=useState(q),[d,load,err]=useData(uPath('/api/admin/leaders?q='+encodeURIComponent(q),unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><p className="muted">Only the Super Admin can make someone a Leader or remove that status. Nobody else can, and the database refuses any other route.</p>
  <form className="card" onSubmit={e=>{e.preventDefault();const n=new URLSearchParams(sp);qq?n.set('q',qq):n.delete('q');setSp(n)}}><input value={qq} onChange={e=>setQq(e.target.value)} placeholder="Search anyone by name or phone"/><button>Search</button></form>
  <People rows={d.people} branch act={r=>r.kind==='leader'?<button className="ghost" style={small} onClick={()=>window.confirm('Remove Leader status?')&&act('/api/admin/leaders',{id:r.id,make:false})}>Remove Leader</button>:<button style={small} onClick={()=>window.confirm('Make '+r.full_name+' a Leader?')&&act('/api/admin/leaders',{id:r.id,make:true})}>Make Leader</button>}/></>}

function Assets({unitId=''}){const [d,load,err]=useData(uPath('/api/admin/assets',unitId)),[msg,setMsg]=useState(''),act=useUAct(setMsg,load,unitId),E0={branch:'',name:'',category:'',quantity:'1',value:'',condition:'Good',acquired_on:'',notes:''},[v,setV]=useState(E0),set=k=>e=>setV({...v,[k]:e.target.value});if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/assets',{a:'add',...v});if(r)setV(E0)}}><h3>Add an asset</h3>
  <input placeholder="Item name, e.g. Sound desk" value={v.name} onChange={set('name')} required/><input placeholder="Category (optional)" value={v.category} onChange={set('category')}/>
  <select value={v.branch} onChange={set('branch')} required><option value="">Which church holds it?</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
  <div className="grid"><input type="number" min="1" placeholder="Quantity" value={v.quantity} onChange={set('quantity')} required/><input type="number" min="0" step="0.01" placeholder="Value of each (K)" value={v.value} onChange={set('value')}/></div>
  <select value={v.condition} onChange={set('condition')}>{COND.map(c=><option key={c}>{c}</option>)}</select><label className="muted">Date acquired (optional)</label><input type="date" value={v.acquired_on} onChange={set('acquired_on')}/><input placeholder="Notes (optional)" value={v.notes} onChange={set('notes')}/><button>Add asset</button></form>
  <Stats items={[['Items',d.rows.reduce((a,r)=>a+r.quantity,0)],['Total value',money(d.rows.reduce((a,r)=>a+(r.value||0)*r.quantity,0))]]}/>
  <Scroll><table><thead><tr><th>Item</th><th>Category</th><th>Church</th><th className="r">Qty</th><th className="r">Value each</th><th>Condition</th><th>Acquired</th><th/></tr></thead><tbody>
   {d.rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.category||'—'}</td><td>{r.bn}</td><td className="r">{r.quantity}</td><td className="r">{r.value==null?'—':money(r.value)}</td><td>{r.condition}</td><td>{r.acquired_on||'—'}</td><td><button className="danger" style={small} onClick={()=>window.confirm('Remove this asset?')&&act('/api/admin/assets',{a:'delete',id:r.id})}>×</button></td></tr>)}</tbody></table></Scroll></>}

function ProfileForm({p,act}){const [v,setV]=useState(p),set=k=>e=>setV({...v,[k]:e.target.value});
 return <form className="card" onSubmit={e=>{e.preventDefault();act('/api/admin/profile',{profile:v})}}><h3>Church profile</h3><label className="muted">Vision</label><input value={v.vision} onChange={set('vision')}/><label className="muted">Mission</label><input value={v.mission} onChange={set('mission')}/>
  <label className="muted">Year founded</label><input value={v.founded} onChange={set('founded')}/><label className="muted">Contact email</label><input value={v.email} onChange={set('email')}/><button>Save profile</button></form>}
function Profile({onChange,unitId=''}){const [d,load,err]=useData(uPath('/api/admin/profile',unitId)),[lkData,loadLk]=useData(uPath('/api/admin/locks',unitId)),[msg,setMsg]=useState(''),[thr,setThr]=useState('500'),act=useUAct(setMsg,async()=>{await load();await loadLk()},unitId);
 useEffect(()=>{if(d&&d.threshold!=null)setThr(String(d.threshold))},[d]);
 if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><ProfileForm key={JSON.stringify(d.profile)} p={d.profile} act={act}/>
  <form className="card" onSubmit={e=>{e.preventDefault();act('/api/admin/profile',{threshold:thr})}}><h3>Two-step approval threshold</h3>
   <label className="muted">Void or edit amount requiring a second approver (ZMW)</label>
   <input type="number" step="0.01" min="0" value={thr} onChange={e=>setThr(e.target.value)} required/>
   <button>Save threshold</button></form>
  <div className="card"><h3>Features</h3>
   <label className="muted" style={{display:'flex',gap:'.6rem',textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} checked={!!d.features.assets} onChange={async e=>{await act('/api/admin/profile',{feature:'assets',on:e.target.checked});onChange?.()}}/> Church assets register — {d.features.assets?'ON':'OFF'}</label>
   <p className="muted">When off, the Assets tab disappears for everyone.</p></div>
  <div className="card"><h3>Locked accounts</h3>
   {!(lkData?.locks||[]).length?<p className="muted">No accounts are currently locked.</p>:<Scroll><table><thead><tr><th>Account</th><th>Type</th><th>Church</th><th/></tr></thead><tbody>
    {lkData.locks.map(l=><tr key={l.ident}><td>{l.label}</td><td>{l.kind}</td><td>{l.unit||'—'}</td><td><button type="button" style={small} onClick={()=>act('/api/admin/unlock',{ident:l.ident})}>Unlock</button></td></tr>)}
   </tbody></table></Scroll>}</div></>}

export const ADMIN_LABEL={overview:'Overview',units:'Units',admins:'Admins',leaders:'Leaders',accounts:'Accounts',members:'Members',events:'Events',programs:'Programs',expenses:'Expenses',approvals:'Approvals',attendance:'Attendance',reports:'Reports',assets:'Assets',audit:'Audit log',profile:'Church profile'};
export function AdminTabBody({tab,unitId='',onChange}){
 const C={overview:<Overview unitId={unitId}/>,units:<Units unitId={unitId} onChange={onChange}/>,admins:<Admins unitId={unitId}/>,leaders:<Leaders unitId={unitId}/>,accounts:<Accounts unitId={unitId}/>,members:<Members unitId={unitId}/>,events:<Content which="events" unitId={unitId}/>,programs:<Content which="programs" unitId={unitId}/>,expenses:<Expenses unitId={unitId}/>,approvals:<Approvals unitId={unitId}/>,attendance:<AdminAtt unitId={unitId}/>,reports:<Reports base="/api/admin" admin unitId={unitId}/>,assets:<Assets unitId={unitId}/>,audit:<Audit unitId={unitId}/>,profile:<Profile unitId={unitId} onChange={onChange}/>};
 return C[tab]||null}
export function AdminHome(){const [sp,setSp]=useSearchParams(),logout=useLogout(),[me,reloadMe,err]=useData('/api/admin/me');
 if(!me)return <Loading err={err}/>;
 const tab=me.tabs.includes(sp.get('p'))?sp.get('p'):(me.tabs[0]||'overview');
 return <><header>{me.role==='superadmin'?<BrandLogo title="KINGDOM HERALDS INTERNATIONAL CHURCH"/>:<div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub={me.brand||me.unit}/> <span className="muted">· {me.name}</span></div>}
  <nav>{me.tabs.map(k=><a key={k} href="#" className={tab===k?'on':''} onClick={e=>{e.preventDefault();setSp({p:k})}}>{ADMIN_LABEL[k]}</a>)}<a href="#" onClick={e=>{e.preventDefault();logout()}}>Log out</a></nav></header>
 <main key={tab}><AdminTabBody tab={tab} onChange={reloadMe}/></main></>}
