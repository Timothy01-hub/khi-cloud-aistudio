import {useCallback,useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {api} from './api.js';

export const money=n=>'K '+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export const when=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Lusaka',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export const day=d=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'});
export const Msg=({m})=>m?<p className={m.startsWith('Error')?'err':'ok'}>{m}</p>:null;
export const Loading=({err})=><p className="muted" style={{padding:'1rem'}}>{err?'Error: '+err:'Loading…'}</p>;
export const Stats=({items})=><div className="stats">{items.map(([l,v])=><div className="stat" key={l}><span>{l}</span><b>{v}</b></div>)}</div>;
export const Scroll=({children})=><div style={{overflowX:'auto'}}>{children}</div>;
export const Kind=({k})=><span className={'tag '+(k==='leader'?'leader':k==='member'?'digital':'physical')}>{k==='leader'?'Leader':k==='member'?'Member':'Visitor'}</span>;
export const People=({rows,branch,act})=>!rows.length?<p className="muted">No records yet.</p>:<Scroll><table><thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Address</th>{branch&&<th>Church</th>}{act&&<th/>}</tr></thead><tbody>
 {rows.map(r=><tr key={r.id}><td>{r.full_name}</td><td><Kind k={r.kind}/></td><td>{r.phone||'—'}</td><td>{r.address}</td>{branch&&<td>{r.bn}</td>}{act&&<td>{act(r)}</td>}</tr>)}</tbody></table></Scroll>;
export function BrandLogo({sub,title='Kingdom Heralds International',center=false}){
 if(center)return <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:'.35rem',marginBottom:'.8rem'}}>
  <img src="/shared/logo-mark.jpg" alt={title} style={{width:64,height:64,objectFit:'contain',borderRadius:8}}/>
  <div style={{fontWeight:700,fontSize:'1.05rem',lineHeight:1.2}}>{title}</div>
  {sub&&<div className="muted" style={{fontSize:'.8rem',lineHeight:1.3}}>{sub}</div>}
 </div>;
 return <div style={{display:'inline-flex',alignItems:'center',gap:'.6rem',textAlign:'left'}}>
  <img src="/shared/logo-mark.jpg" alt={title} style={{height:46,width:'auto',objectFit:'contain',borderRadius:4,margin:0}}/>
  <div><div style={{fontWeight:700,lineHeight:1.2}}>{title}</div>{sub&&<div className="muted" style={{fontSize:'.8rem',lineHeight:1.25}}>{sub}</div>}</div>
 </div>;
}
export const Top=({sub,links=[],onLogout})=><header><BrandLogo sub={sub}/><nav>{links.map(([to,l])=><Link key={to} to={to}>{l}</Link>)}<a href="#" onClick={e=>{e.preventDefault();onLogout()}}>Log out</a></nav></header>;
export function useLogout(){const nav=useNavigate();return async()=>{await api('/api/staff/logout',{}).catch(()=>{});nav('/')}}
export function useData(path){const nav=useNavigate(),[d,setD]=useState(null),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{setD(await api(path));setErr('')}catch(x){x.status===401?nav('/'):setErr(x.message)}},[path,nav]);
 useEffect(()=>{load()},[load]);return [d,load,err]}
export const useAct=(setMsg,reload)=>async(path,body)=>{try{const r=await api(path,body);setMsg(r.message||'');await reload();return r}catch(x){setMsg('Error: '+x.message)}};
export const readImage=file=>new Promise((res,rej)=>{if(file.size>3e6)return rej(new Error('Image must be under 3MB'));const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
export function Pin({lat,lng,onPick}){
 useEffect(()=>{const L=window.L;if(!L||!window.khMap||!document.getElementById('pick'))return;
  const m=window.khMap('pick');let pin;const put=(a,b)=>{pin?pin.setLatLng([a,b]):pin=L.marker([a,b]).addTo(m)};
  if(lat&&lng)put(+lat,+lng);
  m.on('click',e=>{const a=e.latlng.lat,b=e.latlng.lng;if(typeof inZ==='function'&&!inZ(a,b)){alert('Please pick a place inside Zambia.');return}put(a,b);onPick(a.toFixed(6),b.toFixed(6))});
  return()=>m.remove()},[]);
 return window.L?<div id="pick" className="map"/>:<p className="muted">🗺️ The click-to-pin map appears on the live site (Zambia only). Type the coordinates below instead.</p>}
