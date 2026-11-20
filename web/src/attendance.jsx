import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {api} from './api.js';
import {Msg,Stats,People,Top,Loading,Kind,Scroll,useData,useAct,useLogout,today} from './ui.jsx';
import {Reports} from './reports.jsx';

export function SecAttendance(){
 const [sp,setSp]=useSearchParams(),g=k=>sp.get(k)||'',[msg,setMsg]=useState(''),[qq,setQq]=useState(g('q')),logout=useLogout();
 const [d,load,err]=useData(`/api/staff/attendance?s=${g('s')}&q=${encodeURIComponent(g('q'))}&dq=${encodeURIComponent(g('dq'))}&dk=${g('dk')}`);
 const act=useAct(setMsg,load),set=(k,v)=>{const n=new URLSearchParams(sp);v?n.set(k,v):n.delete(k);setSp(n)};
 if(!d)return <Loading err={err}/>;
 const c=d.current,s=g('s'),vals=e=>{e.preventDefault();return Object.fromEntries(new FormData(e.currentTarget))},edit=d.directory.concat(d.present).find(p=>String(p.id)===g('edit'));
 const small={padding:'.2rem .6rem',width:'auto'};
 return <><Top sub={d.me.brand||d.me.branch} links={[['/home','Dashboard'],...(d.features?.['secretary.menu.attendance']!==false?[['/attendance','Attendance']]:[]),...(d.me.slot==='main'&&d.features?.['secretary.menu.reports']!==false?[['/reports','Reports']]:[])]} onLogout={logout}/>
 <main><Msg m={msg||(err&&'Error: '+err)}/>
  <form className="card" onSubmit={async e=>{const x=vals(e),r=await act('/api/staff/att',{a:'start',...x});if(r?.id)set('s',r.id)}}><h3>Start or open a service</h3>
   <div className="grid"><input type="date" name="date" defaultValue={today()} required/><select name="type">{d.types.map(t=><option key={t}>{t}</option>)}</select></div><button>Start / open service</button></form>
  {d.services.length>0&&<><h3>Recent services</h3><Scroll><table><thead><tr><th>Date</th><th>Service</th><th className="r">Present</th><th>Status</th><th/></tr></thead><tbody>
   {d.services.slice(0,15).map(r=><tr key={r.id}><td>{r.service_date}</td><td>{r.service_type}</td><td className="r">{r.count}</td><td>{r.is_open?'Open':'Closed'}</td><td><a href="#" onClick={e=>{e.preventDefault();set('s',r.id)}}>Open register</a></td></tr>)}</tbody></table></Scroll></>}
  {c&&<>
   <h3 style={{marginTop:'1.5rem'}}>{c.service_type} · {c.service_date} <span className="badge">{c.is_open?'OPEN':'CLOSED'}</span></h3>
   <Stats items={[['Present',c.total],['Members',c.members],['Visitors',c.visitors]]}/>
   <button className="ghost" onClick={()=>act('/api/staff/att',{a:'toggle',s})}>{c.is_open?'Close service (stops member self check-in)':'Re-open service'}</button>
   <form className="card" onSubmit={e=>{e.preventDefault();set('q',qq)}}><h3>Find someone &amp; mark present</h3><input value={qq} onChange={e=>setQq(e.target.value)} placeholder="Type a name or phone number"/><button>Search</button></form>
   {g('q')&&(d.results.length?d.results.map(r=><div className="card" key={r.id} style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'center'}}><div><b>{r.full_name}</b> <span className="muted"><Kind k={r.kind}/> · {r.phone||'no phone'}<br/>{r.address}</span></div><button style={{width:'auto'}} onClick={()=>act('/api/staff/att',{a:'checkin',s,pid:r.id})}>Present</button></div>):<p className="muted">No one found (or already present) — add them below.</p>)}
   <form className="card" onSubmit={async e=>{const f=e.currentTarget,x=vals(e),r=await act('/api/staff/att',{a:'add',s,...x,present:!!x.present});if(r)f.reset()}}><h3>Add a new person</h3>
    <input name="name" placeholder="Full names" required/><input name="address" placeholder="Home address" required/><input name="phone" placeholder="Phone number (leave blank if the person has none)" inputMode="tel"/>
    <select name="kind"><option value="visitor">One-time visitor</option><option value="member">Member (is staying)</option></select><input name="notes" placeholder="Notes (optional)"/>
    <label className="muted"><input type="checkbox" name="present" defaultChecked style={{width:'auto'}}/> Mark present for this service</label><p className="muted">Tell visitors their details are kept for welcome and follow-up (see Privacy Notice).</p><button>Save person</button></form>
   <h3>Present at this service</h3><People rows={d.present} act={r=><button className="ghost" style={small} onClick={()=>act('/api/staff/att',{a:'uncheck',s,pid:r.id})}>Remove</button>}/></>}
  {edit&&<form className="card" key={edit.id} onSubmit={async e=>{const x=vals(e),r=await act('/api/staff/att',{a:'edit',id:edit.id,...x});if(r)set('edit','')}}><h3>Edit details — {edit.full_name}</h3>
   <input name="name" defaultValue={edit.full_name} required/><input name="address" defaultValue={edit.address} required/><input name="phone" defaultValue={edit.phone||''} placeholder="Phone (blank if none)" readOnly={!!edit.member_id}/><input name="notes" defaultValue={edit.notes||''} placeholder="Notes"/><button>Save changes</button></form>}
  <h3 style={{marginTop:'1.5rem'}}>Everyone in this fellowship</h3>
  <form className="card" onSubmit={e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget));set('dq',x.dq);set('dk',x.dk)}}><div className="grid"><input name="dq" defaultValue={g('dq')} placeholder="Search name, phone or address"/>
   <select name="dk" defaultValue={g('dk')}><option value="">Members &amp; visitors</option><option value="member">Members</option><option value="visitor">Visitors</option></select></div><button className="ghost">Filter</button></form>
  <People rows={d.directory} act={r=><><a href="#" onClick={e=>{e.preventDefault();set('edit',r.id)}}>Edit</a>{r.kind==='visitor'&&<button className="ghost" style={{...small,marginLeft:'.5rem'}} onClick={()=>window.confirm('Make this person a member?')&&act('/api/staff/att',{a:'convert',id:r.id})}>Make member</button>}</>}/>
 </main></>}

export function SecReports(){const logout=useLogout(),[info,setInfo]=useState(null);
 useEffect(()=>{api('/api/staff/home').then(setInfo).catch(()=>{})},[]);
 const brand=info?.me?.brand||info?.me?.branch,attOn=info?.features?.['secretary.menu.attendance']!==false;
 return <><Top sub={brand} links={[['/home','Dashboard'],...(attOn?[['/attendance','Attendance']]:[])]} onLogout={logout}/><main><Reports base="/api/staff"/></main></>}
