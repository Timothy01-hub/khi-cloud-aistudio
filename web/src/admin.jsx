import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {BrandLogo,Msg,Stats,Scroll,People,Loading,useData,useAct,useLogout,money,when,day,readImage,Pin} from './ui.jsx';
import {Reports} from './reports.jsx';
const small={padding:'.2rem .6rem',width:'auto'};

function Overview(){const [d,load,err]=useData('/api/admin/overview'),[msg,setMsg]=useState(''),act=useAct(setMsg,load);
 useEffect(()=>{const t=setInterval(load,10000);return()=>clearInterval(t)},[load]);
 if(!d)return <Loading err={err}/>;
 const voidIt=id=>{const r=window.prompt('Reason for voiding this entry? (required)');if(r)act('/api/admin/void',{id,reason:r})};
 return <><Msg m={msg}/><h3>Churches · live</h3><Scroll><table><thead><tr><th>Church</th><th className="r">Today</th><th className="r">This month</th></tr></thead><tbody>
  {d.rows.map(r=><tr key={r.id}><td>{r.name}{r.is_main&&<> <span className="tag digital">MAIN</span></>}</td><td className="r">{money(r.today)}</td><td className="r">{money(r.month)}</td></tr>)}</tbody></table></Scroll>
  <Stats items={[['Today · Physical',money(d.totals.pToday)],['Today · Digital',money(d.totals.dToday)],['Today · Total',money(d.totals.pToday+d.totals.dToday)],['This month',money(d.totals.month)]]}/>
  <Scroll><table><thead><tr><th>Time</th><th>Church</th><th>Type</th><th>Category</th><th>From</th><th className="r">Amount</th><th/></tr></thead><tbody>
  {d.recent.map(r=><tr key={r.id} style={r.voided?{opacity:.45,textDecoration:'line-through'}:undefined}><td>{when(r.created_at)}</td><td>{r.bn}</td><td><span className={'tag '+r.type}>{r.type}</span></td><td>{r.category}</td><td>{r.sender||'—'}</td><td className="r">{money(r.amount)}</td>
   <td>{!r.voided&&<button className="ghost" style={small} onClick={()=>voidIt(r.id)}>Void</button>}</td></tr>)}</tbody></table></Scroll></>}

function Slot({f,slot,label,s,act}){const [pw,setPw]=useState('');
 if(!s)return <div className="slot"><b>{label}</b><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,r=await act('/api/admin/account',{a:'create',branch:f.id,slot,...Object.fromEntries(new FormData(form))});if(r)form.reset()}}>
  <input name="name" placeholder="Full name" required/><input name="username" placeholder="Username" required/><input name="password" placeholder="Password (8+)" required/><button>Create account</button></form></div>;
 return <div className="slot"><b>{label}</b><p>{s.full_name} · <span className="muted">@{s.username}</span> · {s.active?'Active':<span style={{color:'#e57'}}>Disabled</span>}</p>
  <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/account',{a:'password',id:s.id,password:pw});if(r)setPw('')}}><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (8+)" required/><button className="ghost">Change password</button></form>
  <button className="ghost" onClick={()=>act('/api/admin/account',{a:'toggle',id:s.id})}>{s.active?'Disable':'Enable'}</button>
  <button className="danger" onClick={()=>window.confirm('Delete this account?')&&act('/api/admin/account',{a:'delete',id:s.id})}>Delete</button></div>}
function Accounts(){const [d,load,err]=useData('/api/admin/accounts'),[msg,setMsg]=useState(''),act=useAct(setMsg,load);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><div className="grid">{d.fellowships.map(f=><div className="card" key={f.id}><h3>{f.label||f.name}</h3>{[['main','Main Secretary'],['assistant','Assistant Secretary']].map(([slot,label])=><Slot key={slot} f={f} slot={slot} label={label} s={f.slots[slot]} act={act}/>)}</div>)}</div>
  <form className="card" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,r=await act('/api/admin/account',{a:'own',password:new FormData(form).get('password')});if(r)form.reset()}}><h3>My (Super Admin) password</h3><input name="password" type="password" minLength={8} required/><button className="ghost">Change</button></form></>}

function Members(){const [d,load,err]=useData('/api/admin/members'),[msg,setMsg]=useState(''),act=useAct(setMsg,load);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><Scroll><table><thead><tr><th>Member</th><th>Phone</th><th>Fellowship (change if wrong)</th><th className="r">Pledged</th><th className="r">Paid</th><th/></tr></thead><tbody>
  {d.rows.map(m=><tr key={m.id}><td>{m.full_name}</td><td>{m.phone}</td><td><select value={m.branch_id} onChange={e=>act('/api/admin/member',{a:'move',id:m.id,branch:e.target.value})}>{d.fellowships.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select></td>
   <td className="r">{money(m.pledged)}</td><td className="r">{money(m.paid)}</td><td><button className="ghost" onClick={()=>window.confirm('Reset password?')&&act('/api/admin/member',{a:'reset',id:m.id})}>Reset password</button></td></tr>)}</tbody></table></Scroll></>}

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
function Content({which}){const [d,load,err]=useData('/api/admin/content'),[msg,setMsg]=useState(''),act=useAct(setMsg,load);if(!d)return <Loading err={err}/>;const ev=which==='events';
 return <><Msg m={msg}/><Form ev={ev} fellowships={d.fellowships} act={act} setMsg={setMsg} canAll={d.canAll}/>
  {ev?<Scroll><table><thead><tr><th>Date</th><th>Event</th><th>Venue</th><th>Pin</th><th/></tr></thead><tbody>{d.events.map(r=><tr key={r.id}><td>{day(r.event_date)}</td><td>{r.title}</td><td>{r.location}</td><td>{r.lat!=null?'✔':'—'}</td><td><button className="danger" style={small} onClick={()=>window.confirm('Delete?')&&act('/api/admin/event',{a:'delete',id:r.id})}>×</button></td></tr>)}</tbody></table></Scroll>
  :<Scroll><table><thead><tr><th>Program</th><th className="r">Pledged</th><th className="r">Paid</th><th>Pin</th><th/></tr></thead><tbody>{d.programs.map(r=><tr key={r.id}><td>{r.title}{!r.active&&<span className="muted"> (closed)</span>}</td><td className="r">{money(r.pledged)}</td><td className="r">{money(r.paid)}</td><td>{r.lat!=null?'✔':'—'}</td><td><button className="ghost" style={small} onClick={()=>act('/api/admin/program',{a:'toggle',id:r.id})}>{r.active?'Close':'Open'}</button></td></tr>)}</tbody></table></Scroll>}</>}

function AdminAtt(){const [sp,setSp]=useSearchParams(),g=k=>sp.get(k)||'',[qq,setQq]=useState(g('q'));
 const [d,,err]=useData(`/api/admin/attendance?branch=${g('branch')}&k=${g('k')}&q=${encodeURIComponent(g('q'))}&svc=${g('svc')}`);
 const set=(o)=>{const n=new URLSearchParams(sp);Object.entries(o).forEach(([k,v])=>v?n.set(k,v):n.delete(k));setSp(n)};if(!d)return <Loading err={err}/>;
 return <><form className="card noprint" onSubmit={e=>{e.preventDefault();set({q:qq})}}><div className="grid"><select value={g('branch')} onChange={e=>set({branch:e.target.value})}><option value="">All fellowships</option>{d.fellowships.map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select>
  <select value={g('k')} onChange={e=>set({k:e.target.value})}><option value="">Members &amp; visitors</option><option value="member">Members only</option><option value="visitor">Visitors only</option></select><input value={qq} onChange={e=>setQq(e.target.value)} placeholder="Search name or phone"/></div><button>Filter</button></form>
  <h3>Fellowship summary</h3><Scroll><table><thead><tr><th>Church</th><th className="r">Members</th><th className="r">Visitors</th><th className="r">Latest service (date · present)</th></tr></thead><tbody>{d.summary.map(r=><tr key={r.id}><td>{r.name}</td><td className="r">{r.members}</td><td className="r">{r.visitors}</td><td className="r">{r.latest||'—'}</td></tr>)}</tbody></table></Scroll>
  <h3>Services</h3><Scroll><table><thead><tr><th>Date</th><th>Service</th><th>Church</th><th className="r">Present</th><th/></tr></thead><tbody>{d.services.map(r=><tr key={r.id}><td>{r.service_date}</td><td>{r.service_type}</td><td>{r.bn}</td><td className="r">{r.count}</td><td><a href="#" onClick={e=>{e.preventDefault();set({svc:r.id})}}>View list</a></td></tr>)}</tbody></table></Scroll>
  {g('svc')&&<><h3>Present at the selected service</h3><People rows={d.present} branch/></>}<h3>People directory</h3><People rows={d.people} branch/></>}

function Audit(){const [d,,err]=useData('/api/admin/audit');if(!d)return <Loading err={err}/>;
 return <Scroll><table><thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody>{d.rows.map(r=><tr key={r.id}><td>{when(r.created_at)}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.detail}</td><td>{r.ip}</td></tr>)}</tbody></table></Scroll>}

const KWORD={center:'Centre',branch:'Branch',fellowship:'Fellowship'};
const preview=(n,k)=>{const t=n.trim(),u=t.toUpperCase(),w=KWORD[k].toUpperCase();return u.endsWith(w)||(k==='center'&&u.endsWith('CENTER'))?t:t+' '+KWORD[k]};
const COND=['New','Good','Fair','Poor','Needs repair'];

function UnitEdit({u,all,act}){const [v,setV]=useState({name:u.name,kind:u.kind,parent:u.parent_id||'',momo:u.momo_number||''}),set=k=>e=>setV({...v,[k]:e.target.value});
 return <form className="card" onSubmit={e=>{e.preventDefault();act('/api/admin/fellowships',{a:'save',id:u.id,...v})}}><b>{preview(v.name||u.name,v.kind)}</b>
  <input value={v.name} onChange={set('name')} required/><select value={v.kind} onChange={set('kind')}><option value="center">Centre</option><option value="branch">Branch</option><option value="fellowship">Fellowship</option></select>
  <select value={v.parent} onChange={set('parent')}><option value="">Stands on its own (no parent)</option>{all.filter(x=>x.id!==u.id).map(x=><option key={x.id} value={x.id}>Sits under {x.label}</option>)}</select>
  <input value={v.momo} onChange={set('momo')} placeholder="Mobile-money number"/><button className="ghost">Save changes</button></form>}
function Units(){const [d,load,err]=useData('/api/admin/fellowships'),[msg,setMsg]=useState(''),act=useAct(setMsg,load),E0={name:'',kind:'center',parent:'',momo:''},[v,setV]=useState(E0);if(!d)return <Loading err={err}/>;
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
 return <div className="card"><h3>{a.full_name} <span className="muted">@{a.username}</span></h3><p>{a.unit} · {a.active?'Active':<span style={{color:'#e57'}}>Disabled</span>}</p><Privs d={d} value={p} onChange={setP}/>
  <button className="ghost" onClick={()=>act('/api/admin/admin',{a:'privileges',id:a.id,privileges:p})}>Save privileges</button>
  <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/admin',{a:'password',id:a.id,password:pw});if(r)setPw('')}}><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (8+)" required/><button className="ghost">Change password</button></form>
  <button className="ghost" onClick={()=>act('/api/admin/admin',{a:'toggle',id:a.id})}>{a.active?'Disable':'Enable'}</button>
  <button className="danger" onClick={()=>window.confirm('Delete this admin?')&&act('/api/admin/admin',{a:'delete',id:a.id})}>Delete</button></div>}
function Admins(){const [d,load,err]=useData('/api/admin/admins'),[msg,setMsg]=useState(''),act=useAct(setMsg,load),E0={name:'',username:'',password:'',branch:'',privileges:['attendance','reports']},[v,setV]=useState(E0),set=k=>e=>setV({...v,[k]:e.target.value});if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/admin/admin',{a:'create',...v});if(r)setV(E0)}}><h3>Create an admin</h3>
  <input placeholder="Full name" value={v.name} onChange={set('name')} required/><input placeholder="Username" value={v.username} onChange={set('username')} required/><input placeholder="Password (8+)" value={v.password} onChange={set('password')} required/>
  <select value={v.branch} onChange={set('branch')} required><option value="">Which centre, branch or fellowship will they run?</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
  <Privs d={d} value={v.privileges} onChange={p=>setV({...v,privileges:p})}/><button>Create admin</button></form>
  <div className="grid">{d.admins.map(a=><AdminCard key={a.id+a.privileges.join()} a={a} d={d} act={act}/>)}</div></>}

function Leaders(){const [sp,setSp]=useSearchParams(),q=sp.get('q')||'',[qq,setQq]=useState(q),[d,load,err]=useData('/api/admin/leaders?q='+encodeURIComponent(q)),[msg,setMsg]=useState(''),act=useAct(setMsg,load);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><p className="muted">Only the Super Admin can make someone a Leader or remove that status. Nobody else can, and the database refuses any other route.</p>
  <form className="card" onSubmit={e=>{e.preventDefault();const n=new URLSearchParams(sp);qq?n.set('q',qq):n.delete('q');setSp(n)}}><input value={qq} onChange={e=>setQq(e.target.value)} placeholder="Search anyone by name or phone"/><button>Search</button></form>
  <People rows={d.people} branch act={r=>r.kind==='leader'?<button className="ghost" style={small} onClick={()=>window.confirm('Remove Leader status?')&&act('/api/admin/leaders',{id:r.id,make:false})}>Remove Leader</button>:<button style={small} onClick={()=>window.confirm('Make '+r.full_name+' a Leader?')&&act('/api/admin/leaders',{id:r.id,make:true})}>Make Leader</button>}/></>}

function Assets(){const [d,load,err]=useData('/api/admin/assets'),[msg,setMsg]=useState(''),act=useAct(setMsg,load),E0={branch:'',name:'',category:'',quantity:'1',value:'',condition:'Good',acquired_on:'',notes:''},[v,setV]=useState(E0),set=k=>e=>setV({...v,[k]:e.target.value});if(!d)return <Loading err={err}/>;
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
function Profile({onChange}){const [d,load,err]=useData('/api/admin/profile'),[msg,setMsg]=useState(''),act=useAct(setMsg,load);if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/><ProfileForm key={JSON.stringify(d.profile)} p={d.profile} act={act}/><div className="card"><h3>Features</h3>
  <label className="muted" style={{display:'flex',gap:'.6rem',textAlign:'left'}}><input type="checkbox" style={{width:'auto'}} checked={!!d.features.assets} onChange={async e=>{await act('/api/admin/profile',{feature:'assets',on:e.target.checked});onChange()}}/> Church assets register — {d.features.assets?'ON':'OFF'}</label>
  <p className="muted">When off, the Assets tab disappears for everyone.</p></div></>}

const LABEL={overview:'Overview',units:'Units',admins:'Admins',leaders:'Leaders',accounts:'Accounts',members:'Members',events:'Events',programs:'Programs',attendance:'Attendance',reports:'Reports',assets:'Assets',audit:'Audit log',profile:'Church profile'};
export function AdminHome(){const [sp,setSp]=useSearchParams(),logout=useLogout(),[me,reloadMe,err]=useData('/api/admin/me');
 if(!me)return <Loading err={err}/>;
 const tab=me.tabs.includes(sp.get('p'))?sp.get('p'):(me.tabs[0]||'overview');
 const C={overview:<Overview/>,units:<Units/>,admins:<Admins/>,leaders:<Leaders/>,accounts:<Accounts/>,members:<Members/>,events:<Content which="events"/>,programs:<Content which="programs"/>,attendance:<AdminAtt/>,reports:<Reports base="/api/admin" admin/>,assets:<Assets/>,audit:<Audit/>,profile:<Profile onChange={reloadMe}/>};
 return <><header>{me.role==='superadmin'?<BrandLogo title="KINGDOM HERALDS INTERNATIONAL CHURCH"/>:<div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub={me.brand||me.unit}/> <span className="muted">· {me.name}</span></div>}
  <nav>{me.tabs.map(k=><a key={k} href="#" className={tab===k?'on':''} onClick={e=>{e.preventDefault();setSp({p:k})}}>{LABEL[k]}</a>)}<a href="#" onClick={e=>{e.preventDefault();logout()}}>Log out</a></nav></header>
 <main key={tab}>{C[tab]}</main></>}
