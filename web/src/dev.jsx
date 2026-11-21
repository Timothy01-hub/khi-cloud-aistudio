import {useCallback,useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {api} from './api.js';
import {BrandLogo,Msg,Scroll,Loading,useAct} from './ui.jsx';
import {ADMIN_LABEL,AdminTabBody} from './admin.jsx';

const small={padding:'.2rem .6rem',width:'auto'};
const taStyle={width:'100%',minHeight:84,padding:'.7rem',margin:'.3rem 0',borderRadius:8,border:'1px solid var(--line)',background:'#0f0b3f',color:'var(--tx)',font:'inherit',fontFamily:'monospace',fontSize:'.85rem'};

export function NotFound(){
 return <div className="login"><div className="card login-box"><h2>404</h2><p className="muted">Not found.</p></div></div>;
}

export function DevGate(){
 const nav=useNavigate(),[mode,setMode]=useState('loading'),[e,setE]=useState(''),[otp,setOtp]=useState(null),[code,setCode]=useState('');
 useEffect(()=>{document.body.classList.add('login');return()=>document.body.classList.remove('login')},[]);
 useEffect(()=>{api('/api/dev/gate').then(r=>{if(r.ok)nav('/home',{replace:true});else setMode('login')}).catch(()=>setMode('404'))},[nav]);
 if(mode==='loading')return <p className="muted" style={{padding:'2rem'}}>Loading…</p>;
 if(mode==='404')return <NotFound/>;
 const submit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);setE('');
  try{const r=await api('/api/dev/login',{username:f.get('username'),password:f.get('password')});
   if(r?.otp_required){setOtp({challenge:r.challenge,sent_to:r.sent_to,demo_code:r.demo_code});setCode('');return}
   nav('/home')}catch(x){setE(x.message)}};
 const verify=async ev=>{ev.preventDefault();setE('');
  try{await api('/api/dev/otp',{challenge:otp.challenge,code});nav('/home')}catch(x){setE(x.message)}};
 if(otp)return <form onSubmit={verify} className="card login-box"><BrandLogo center sub="Developer"/><h2>Developer Sign in — Verification</h2>
  <p className="muted">Enter the 6-digit one-time code sent to {otp.sent_to||'your email'}.</p>
  {otp.demo_code&&<p className="ok">Demo verification code: <b>{otp.demo_code}</b></p>}
  {e&&<p className="err">{e}</p>}
  <input name="code" placeholder="6-digit verification code" inputMode="numeric" maxLength={6} value={code} onChange={ev=>setCode(ev.target.value)} required autoFocus/>
  <button>Verify code</button>
  <button type="button" className="ghost" onClick={()=>{setOtp(null);setCode('');setE('')}}>Back</button></form>;
 return <form onSubmit={submit} className="card login-box"><BrandLogo center sub="Developer"/><h2>Developer Sign in</h2>{e&&<p className="err">{e}</p>}
  <input name="username" placeholder="Username" required autoFocus/><input name="password" type="password" placeholder="Password" required/><button>Sign in</button></form>;
}

function FlagsTab({units}){
 const [unit,setUnit]=useState(''),[d,setD]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{setD(await api('/api/dev/flags'+(unit?'?unit='+unit:'')));setErr('')}catch(x){setErr(x.message)}},[unit]);
 useEffect(()=>{load()},[load]);
 const act=useAct(setMsg,load);
 if(!d)return <Loading err={err}/>;
 const scopeId=unit?+unit:null;
 const curFlag=key=>d.flags.find(f=>f.key===key&&f.unit_id===scopeId);
 const setFlag=(key,val)=>act('/api/dev/flags',{key,unit_id:scopeId,enabled:val});
 const renderGroup=(title,items)=><div className="card"><h3>{title}</h3><Scroll><table><thead><tr><th>Feature</th><th>Key</th><th>Effective</th><th>Scope override</th><th/></tr></thead><tbody>
  {items.map(c=>{const ov=curFlag(c.key),eff=d.effective[c.key];
   return <tr key={c.key}><td>{c.label}{c.note&&<div className="muted">{c.note}</div>}</td><td className="muted">{c.key}</td>
    <td><span className={'tag '+(eff?'digital':'physical')}>{eff?'ON':'OFF'}</span></td>
    <td>{ov?(ov.enabled?'Explicit ON':'Explicit OFF'):<span className="muted">Inherited / Default</span>}</td>
    <td style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
     <button style={small} onClick={()=>setFlag(c.key,true)}>ON</button>
     <button className="danger" style={small} onClick={()=>setFlag(c.key,false)}>OFF</button>
     {ov&&<button className="ghost" style={small} onClick={()=>setFlag(c.key,null)}>Reset</button>}
    </td></tr>})}</tbody></table></Scroll></div>;
 const main=d.catalog.filter(c=>c.kind!=='stub'),stubs=d.catalog.filter(c=>c.kind==='stub');
 return <><Msg m={msg}/>
  <div className="card"><h3>Feature flags scope</h3>
   <select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Global (all churches unless overridden)</option>
    {units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
   <p className="muted">Changes take effect immediately across Member, Secretary, Admin, and Super Admin apps.</p></div>
  {renderGroup('Apps, menus & features',main)}
  {renderGroup('Future feature stubs (developer-only, disabled by default)',stubs)}</>;
}

function UsersTab(){
 const [d,setD]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const [sf,setSf]=useState({role:'admin',branch:'',slot:'main',name:'',username:'',password:'',privileges:['events','reports']});
 const [mf,setMf]=useState({branch_id:'',full_name:'',phone:'',address:'Lusaka',password:'',birth_date:'1995-01-01'});
 const [pf,setPf]=useState({branch_id:'',full_name:'',address:'',phone:'',kind:'leader',notes:''});
 const [devPw,setDevPw]=useState('');
 const load=useCallback(async()=>{try{setD(await api('/api/dev/users'));setErr('')}catch(x){setErr(x.message)}},[]);
 useEffect(()=>{load()},[load]);
 const act=useAct(setMsg,load);
 if(!d)return <Loading err={err}/>;
 const imp=async(kind,id)=>{try{const r=await api('/api/dev/impersonate',{kind,id});
  const base=location.hash.startsWith('#/')?'#':'';window.location.href=base+r.redirect}catch(x){setMsg('Error: '+x.message)}};
 return <><Msg m={msg}/>
  <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/dev/users',{target:'staff',a:'create',...sf});if(r)setSf({...sf,name:'',username:'',password:''})}}>
   <h3>Create staff (Super Admin / Admin / Secretary)</h3>
   <div className="grid">
    <select value={sf.role} onChange={e=>setSf({...sf,role:e.target.value})}><option value="superadmin">Super Admin</option><option value="admin">Admin</option><option value="secretary">Secretary</option></select>
    {sf.role!=='superadmin'&&<select value={sf.branch} onChange={e=>setSf({...sf,branch:e.target.value})} required><option value="">Choose unit…</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>}
    {sf.role==='secretary'&&<select value={sf.slot} onChange={e=>setSf({...sf,slot:e.target.value})}><option value="main">Main</option><option value="assistant">Assistant</option></select>}
    <input placeholder="Full name" value={sf.name} onChange={e=>setSf({...sf,name:e.target.value})} required/>
    <input placeholder="Username" value={sf.username} onChange={e=>setSf({...sf,username:e.target.value})} required/>
    <input placeholder="Password (8+)" value={sf.password} onChange={e=>setSf({...sf,password:e.target.value})} required/>
   </div>
   {sf.role==='admin'&&<div style={{margin:'.4rem 0'}}><p className="muted">Admin privileges:</p>
    <div style={{display:'flex',gap:'.8rem',flexWrap:'wrap'}}>{d.grantable.map(([k])=><label key={k} className="muted" style={{display:'flex',gap:'.3rem',width:'auto'}}><input type="checkbox" style={{width:'auto'}} checked={sf.privileges.includes(k)} onChange={e=>setSf({...sf,privileges:e.target.checked?[...sf.privileges,k]:sf.privileges.filter(x=>x!==k)})}/>{k}</label>)}</div></div>}
   <button>Create staff</button></form>

  <div className="card"><h3>Staff accounts</h3><Scroll><table><thead><tr><th>Name</th><th>User</th><th>Role</th><th>Unit</th><th>Status</th><th/></tr></thead><tbody>
   {d.staff.map(s=><tr key={s.id}><td>{s.full_name}</td><td>@{s.username}</td><td>{s.role}{s.slot?` (${s.slot})`:''}</td><td>{s.unit}</td><td>{s.active?'Active':'Disabled'}{s.locked&&<> · <span className="badge">LOCKED</span></>}</td>
    <td style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
     {s.active&&<button style={small} onClick={()=>imp('staff',s.id)}>Impersonate</button>}
     {s.locked&&<button style={small} onClick={()=>act('/api/dev/users',{target:'unlock',ident:'s:'+s.username.toLowerCase()})}>Unlock</button>}
     <button className="ghost" style={small} onClick={()=>act('/api/dev/users',{target:'staff',a:'update',id:s.id,role:s.role,branch_id:s.branch_id,slot:s.slot,full_name:s.full_name,username:s.username,privileges:s.privileges,active:!s.active})}>{s.active?'Disable':'Enable'}</button>
     <button className="ghost" style={small} onClick={()=>{const pw=window.prompt('New password (8+ chars)?');if(pw)act('/api/dev/users',{target:'staff',a:'password',id:s.id,password:pw})}}>Password</button>
     <button className="danger" style={small} onClick={()=>window.confirm('Delete staff account?')&&act('/api/dev/users',{target:'staff',a:'delete',id:s.id})}>Delete</button>
    </td></tr>)}</tbody></table></Scroll></div>

  <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/dev/users',{target:'member',a:'create',...mf});if(r)setMf({...mf,full_name:'',phone:'',password:''})}}>
   <h3>Create member</h3><div className="grid">
    <select value={mf.branch_id} onChange={e=>setMf({...mf,branch_id:e.target.value})} required><option value="">Choose unit…</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
    <input placeholder="Full name" value={mf.full_name} onChange={e=>setMf({...mf,full_name:e.target.value})} required/>
    <input placeholder="Phone" value={mf.phone} onChange={e=>setMf({...mf,phone:e.target.value})} required/>
    <input placeholder="Address" value={mf.address} onChange={e=>setMf({...mf,address:e.target.value})} required/>
    <input type="date" value={mf.birth_date} onChange={e=>setMf({...mf,birth_date:e.target.value})} required/>
    <input placeholder="Password (6+)" value={mf.password} onChange={e=>setMf({...mf,password:e.target.value})} required/>
   </div><button>Create member</button></form>

  <div className="card"><h3>Members</h3><Scroll><table><thead><tr><th>Name</th><th>Phone</th><th>Unit</th><th/></tr></thead><tbody>
   {d.members.map(m=><tr key={m.id}><td>{m.full_name}{m.locked&&<> <span className="badge">LOCKED</span></>}</td><td>{m.phone}</td><td>{m.unit}</td>
    <td style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
     <button style={small} onClick={()=>imp('member',m.id)}>Impersonate</button>
     {m.locked&&<button style={small} onClick={()=>act('/api/dev/users',{target:'unlock',ident:m.phone})}>Unlock</button>}
     <button className="ghost" style={small} onClick={()=>{const n=window.prompt('Full name:',m.full_name);if(n)act('/api/dev/users',{target:'member',a:'update',id:m.id,full_name:n,phone:m.phone,branch_id:m.branch_id,must_change:m.must_change})}}>Rename</button>
     <button className="ghost" style={small} onClick={()=>act('/api/dev/users',{target:'member',a:'reset',id:m.id})}>Reset PW</button>
     <button className="danger" style={small} onClick={()=>window.confirm('Delete member?')&&act('/api/dev/users',{target:'member',a:'delete',id:m.id})}>Delete</button>
    </td></tr>)}</tbody></table></Scroll></div>

  <form className="card" onSubmit={async e=>{e.preventDefault();const r=await act('/api/dev/users',{target:'person',a:'create',...pf});if(r)setPf({...pf,full_name:'',address:'',phone:''})}}>
   <h3>Add person / Leader (RLS allows direct Leader status)</h3><div className="grid">
    <select value={pf.branch_id} onChange={e=>setPf({...pf,branch_id:e.target.value})} required><option value="">Choose unit…</option>{d.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select>
    <input placeholder="Full name" value={pf.full_name} onChange={e=>setPf({...pf,full_name:e.target.value})} required/>
    <input placeholder="Address" value={pf.address} onChange={e=>setPf({...pf,address:e.target.value})} required/>
    <input placeholder="Phone (optional)" value={pf.phone} onChange={e=>setPf({...pf,phone:e.target.value})}/>
    <select value={pf.kind} onChange={e=>setPf({...pf,kind:e.target.value})}><option value="leader">Leader</option><option value="member">Member</option><option value="visitor">Visitor</option></select>
   </div><button>Add person</button></form>

  <div className="card"><h3>People &amp; Leaders</h3><Scroll><table><thead><tr><th>Name</th><th>Role</th><th>Unit</th><th>Phone</th><th/></tr></thead><tbody>
   {d.people.map(x=><tr key={x.id}><td>{x.full_name}</td><td>{x.kind}</td><td>{x.unit}</td><td>{x.phone||'—'}</td>
    <td style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
     <select style={{width:'auto',padding:'.2rem'}} value={x.kind} onChange={e=>act('/api/dev/users',{target:'person',a:'update',id:x.id,branch_id:x.branch_id,full_name:x.full_name,address:x.address,phone:x.phone,kind:e.target.value,notes:x.notes})}>
      <option value="member">member</option><option value="visitor">visitor</option><option value="leader">leader</option></select>
     <button className="danger" style={small} onClick={()=>window.confirm('Delete person?')&&act('/api/dev/users',{target:'person',a:'delete',id:x.id})}>Delete</button>
    </td></tr>)}</tbody></table></Scroll></div>

  <div className="card"><h3>Developer accounts</h3>
   <Scroll><table><thead><tr><th>Name</th><th>Username</th><th>Active</th><th/></tr></thead><tbody>
    {d.devAccounts.map(a=><tr key={a.id}><td>{a.full_name}</td><td>@{a.username}</td><td>{a.active?'Yes':'No'}{a.locked&&<> · <span className="badge">LOCKED</span></>}</td>
     <td style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
      {a.locked&&<button style={small} onClick={()=>act('/api/dev/users',{target:'unlock',ident:'d:'+a.username.toLowerCase()})}>Unlock</button>}
      <button className="ghost" style={small} onClick={()=>act('/api/dev/users',{target:'dev',a:'toggle',id:a.id})}>{a.active?'Disable':'Enable'}</button>
     </td></tr>)}</tbody></table></Scroll>
   <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/dev/password',{password:devPw});if(r)setDevPw('')}} style={{marginTop:'.8rem'}}>
    <input type="password" minLength={10} placeholder="New developer password (10+)" value={devPw} onChange={e=>setDevPw(e.target.value)} required/>
    <button className="ghost">Change my password</button></form></div></>;
}

function SettingsTab(){
 const [d,setD]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const [newKey,setNewKey]=useState(''),[newVal,setNewVal]=useState('{}');
 const [bu,setBu]=useState({name:'',kind:'branch',parent_id:'',momo_number:''});
 const load=useCallback(async()=>{try{setD(await api('/api/dev/settings'));setErr('')}catch(x){setErr(x.message)}},[]);
 useEffect(()=>{load()},[load]);
 const act=useAct(setMsg,load);
 if(!d)return <Loading err={err}/>;
 return <><Msg m={msg}/>
  <div className="card"><h3>Settings CRUD</h3>
   {d.settings.map(s=><SettingRow key={s.key+JSON.stringify(s.value)} s={s} act={act}/>)}
   <form onSubmit={async e=>{e.preventDefault();try{JSON.parse(newVal)}catch{setMsg('Error: Invalid JSON');return}
    const r=await act('/api/dev/settings',{target:'setting',a:'save',key:newKey,value:newVal});if(r){setNewKey('');setNewVal('{}')}}}>
    <h4>Add setting</h4><input placeholder="Key" value={newKey} onChange={e=>setNewKey(e.target.value)} required/>
    <textarea style={taStyle} value={newVal} onChange={e=>setNewVal(e.target.value)} required/><button>Save setting</button></form></div>
  <div className="card"><h3>Church units CRUD</h3>
   <form onSubmit={async e=>{e.preventDefault();const r=await act('/api/dev/settings',{target:'branch',a:'create',...bu});if(r)setBu({name:'',kind:'branch',parent_id:'',momo_number:''})}}>
    <div className="grid"><input placeholder="Unit name" value={bu.name} onChange={e=>setBu({...bu,name:e.target.value})} required/>
     <select value={bu.kind} onChange={e=>setBu({...bu,kind:e.target.value})}><option value="center">Centre</option><option value="branch">Branch</option><option value="fellowship">Fellowship</option></select>
     <select value={bu.parent_id} onChange={e=>setBu({...bu,parent_id:e.target.value})}><option value="">No parent</option>{d.branches.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select>
     <input placeholder="MoMo number (optional)" value={bu.momo_number} onChange={e=>setBu({...bu,momo_number:e.target.value})}/></div><button>Add unit</button></form>
   <Scroll><table><thead><tr><th>Label</th><th>Kind</th><th>Parent ID</th><th/></tr></thead><tbody>
    {d.branches.map(b=><tr key={b.id}><td>{b.label}</td><td>{b.kind}</td><td>{b.parent_id||'—'}</td>
     <td style={{display:'flex',gap:'.35rem'}}><button className="ghost" style={small} onClick={()=>{const n=window.prompt('Unit name:',b.name);if(n)act('/api/dev/settings',{target:'branch',a:'update',id:b.id,name:n,kind:b.kind,parent_id:b.parent_id,momo_number:b.momo_number})}}>Rename</button>
      {!b.is_main&&<button className="danger" style={small} onClick={()=>window.confirm('Delete unit?')&&act('/api/dev/settings',{target:'branch',a:'delete',id:b.id})}>Delete</button>}</td></tr>)}</tbody></table></Scroll></div></>;
}
function SettingRow({s,act}){const [v,setV]=useState(JSON.stringify(s.value,null,2));
 return <form onSubmit={e=>{e.preventDefault();try{JSON.parse(v)}catch{return}act('/api/dev/settings',{target:'setting',a:'save',key:s.key,value:v})}} style={{marginBottom:'1rem'}}>
  <b>{s.key}</b><textarea style={taStyle} value={v} onChange={e=>setV(e.target.value)}/>
  <div style={{display:'flex',gap:'.5rem'}}><button style={{width:'auto'}}>Save {s.key}</button>
   {s.key!=='profile'&&s.key!=='features'&&<button type="button" className="danger" style={{width:'auto'}} onClick={()=>act('/api/dev/settings',{target:'setting',a:'delete',key:s.key})}>Delete</button>}</div></form>}

function DataTab(){
 const [tbl,setTbl]=useState('offerings'),[d,setD]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const [rowJson,setRowJson]=useState('{}'),[editId,setEditId]=useState('');
 const load=useCallback(async()=>{try{setD(await api('/api/dev/data?table='+tbl));setErr('')}catch(x){setErr(x.message)}},[tbl]);
 useEffect(()=>{load()},[load]);
 const act=useAct(setMsg,load);
 if(!d)return <Loading err={err}/>;
 const save=async e=>{e.preventDefault();let parsed;try{parsed=JSON.parse(rowJson)}catch{setMsg('Error: Invalid JSON');return}
  const r=await act('/api/dev/data',editId?{table:tbl,a:'update',id:editId,row:parsed}:{table:tbl,a:'create',row:parsed});
  if(r){setEditId('');setRowJson('{}')}};
 return <><Msg m={msg}/>
  <div className="card"><h3>Data CRUD</h3>
   <select value={tbl} onChange={e=>{setTbl(e.target.value);setEditId('');setRowJson('{}')}}>{d.tables.map(t=><option key={t} value={t}>{t}</option>)}</select>
   <form onSubmit={save} style={{marginTop:'.6rem'}}><label className="muted">{editId?`Editing row #${editId}`:'Insert new row (JSON)'}</label>
    <textarea style={taStyle} value={rowJson} onChange={e=>setRowJson(e.target.value)}/>
    <div style={{display:'flex',gap:'.5rem'}}><button style={{width:'auto'}}>{editId?'Update row':'Insert row'}</button>
     {editId&&<button type="button" className="ghost" style={{width:'auto'}} onClick={()=>{setEditId('');setRowJson('{}')}}>Cancel</button>}</div></form></div>
  <div className="card"><h3>{tbl} ({d.rows.length})</h3>
   <Scroll><table><thead><tr><th>ID</th><th>JSON</th><th/></tr></thead><tbody>
    {d.rows.map((r,i)=><tr key={r.id||i}><td>{r.id??i+1}</td><td style={{fontFamily:'monospace',fontSize:'.78rem',wordBreak:'break-all'}}>{JSON.stringify(r)}</td>
     <td style={{display:'flex',gap:'.3rem'}}>
      {r.id!=null&&<button className="ghost" style={small} onClick={()=>{setEditId(String(r.id));const c={...r};delete c.id;setRowJson(JSON.stringify(c,null,2))}}>Edit</button>}
      {r.id!=null&&<button className="danger" style={small} onClick={()=>window.confirm('Delete row?')&&act('/api/dev/data',{table:tbl,a:'delete',id:r.id})}>Delete</button>}
     </td></tr>)}</tbody></table></Scroll></div></>;
}

function ChurchTab({units,onUnitsChange}){
 const [unitId,setUnitId]=useState('');
 const [sub,setSub]=useState('overview');
 const [me,setMe]=useState(null),[err,setErr]=useState('');
 const loadMe=useCallback(async()=>{try{setMe(await api('/api/admin/me'+(unitId?'?unit_id='+encodeURIComponent(unitId):'')));setErr('')}catch(x){setErr(x.message)}},[unitId]);
 useEffect(()=>{loadMe()},[loadMe]);
 const activeTab=me?.tabs?.includes(sub)?sub:(me?.tabs?.[0]||'overview');
 const refresh=()=>{loadMe();onUnitsChange?.()};
 return <>
  <div className="card">
   <h3>Church scope</h3>
   <select value={unitId} onChange={e=>{setUnitId(e.target.value);setSub('overview')}}>
    <option value="">Whole church (Super Admin)</option>
    {units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
   </select>
   <p className="muted">{unitId?`Acting as Admin of ${me?.brand||me?.unit||'this unit'} (all privileges enabled; feature flags bypassed; actions logged in dev_audit).`:'Acting as Super Admin for the whole church (all privileges enabled; feature flags bypassed; actions logged in dev_audit).'}</p>
  </div>
  {!me?<Loading err={err}/>:<>
   <nav style={{display:'flex',gap:'.8rem',flexWrap:'wrap',marginBottom:'1rem',padding:'.4rem 0',borderBottom:'1px solid var(--line)'}}>
    {me.tabs.map(k=><a key={k} href="#" className={activeTab===k?'on':''} onClick={e=>{e.preventDefault();setSub(k)}}>{ADMIN_LABEL[k]}</a>)}
   </nav>
   <div key={(unitId||'all')+':'+activeTab}><AdminTabBody tab={activeTab} unitId={unitId} onChange={refresh}/></div>
  </>}
 </>;
}

const TABS=[['flags','Flags & Stubs'],['users','Users & Roles'],['settings','Settings & Units'],['data','Data'],['church','Church']];
export function DevHome(){
 const [sp,setSp]=useSearchParams(),nav=useNavigate(),[me,setMe]=useState(null),[fail,setFail]=useState(false);
 const loadMe=useCallback(()=>{api('/api/dev/me').then(setMe).catch(()=>setFail(true))},[]);
 useEffect(()=>{loadMe()},[loadMe]);
 if(fail)return <NotFound/>;
 if(!me)return <p className="muted" style={{padding:'2rem'}}>Loading…</p>;
 const tab=TABS.some(t=>t[0]===sp.get('p'))?sp.get('p'):'flags';
 const logout=async()=>{await api('/api/dev/logout',{}).catch(()=>{});nav('/')};
 return <><header><div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}><BrandLogo sub="Developer"/> <span className="muted">· {me.dev.full_name}</span></div>
  <nav>{TABS.map(([k,l])=><a key={k} href="#" className={tab===k?'on':''} onClick={e=>{e.preventDefault();setSp({p:k})}}>{l}</a>)}<a href="#" onClick={e=>{e.preventDefault();logout()}}>Log out</a></nav></header>
  <main key={tab}>{tab==='flags'&&<FlagsTab units={me.units}/>}{tab==='users'&&<UsersTab/>}{tab==='settings'&&<SettingsTab/>}{tab==='data'&&<DataTab/>}{tab==='church'&&<ChurchTab units={me.units} onUnitsChange={loadMe}/>}</main></>;
}
