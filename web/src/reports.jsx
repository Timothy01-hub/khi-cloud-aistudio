import {useEffect,useState} from 'react';
import {api} from './api.js';
import {Msg,Scroll,money,today} from './ui.jsx';
const MONEY=['Amount','Pledged','Paid','Balance'],KINDS=[['offerings','Offerings & payments'],['pledges','Pledges'],['people','People directory'],['attendance','Attendance register']];

export function Reports({base,admin}){
 const [f,setF]=useState({kind:'offerings',branch:'0',from:today().slice(0,8)+'01',to:today(),type:''}),[d,setD]=useState(null),[msg,setMsg]=useState('');
 const run=async()=>{try{setD(await api(`${base}/report?`+new URLSearchParams(f)));setMsg('')}catch(x){setMsg('Error: '+x.message)}};
 useEffect(()=>{run()},[]);
 const set=k=>e=>setF({...f,[k]:e.target.value}),rows=d?d.rows:[],cols=rows[0]?Object.keys(rows[0]):[],hd=c=>c.replace(/_/g,' ');
 const total=f.kind==='pledges'?rows.reduce((a,r)=>a+r.Pledged,0):rows.filter(r=>r.Status==='').reduce((a,r)=>a+r.Amount,0);
 const csv=()=>{const q=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const t='\uFEFF'+[cols.map(hd),...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(q).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=`kh-${f.kind}-${today()}.csv`;a.click()};
 return <><form className="card noprint" onSubmit={e=>{e.preventDefault();run()}}><h3>Reports</h3><div className="grid">
  <select value={f.kind} onChange={set('kind')}>{KINDS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
  {admin&&<select value={f.branch} onChange={set('branch')}><option value="0">All fellowships</option>{(d?.fellowships||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>}
  <input type="date" value={f.from} onChange={set('from')}/><input type="date" value={f.to} onChange={set('to')}/>
  <select value={f.type} onChange={set('type')}><option value="">Physical + digital</option><option value="physical">Physical only</option><option value="digital">Digital only</option></select></div>
  <button>Show report</button><button type="button" className="ghost" onClick={csv} disabled={!rows.length}>Download for Excel (CSV)</button><button type="button" className="ghost" onClick={()=>window.print()}>Print / Save as PDF</button></form>
  <Msg m={msg}/>{!rows.length?<p className="muted">No records for this selection.</p>:<><Scroll><table><thead><tr>{cols.map(c=><th key={c}>{hd(c)}</th>)}</tr></thead><tbody>
   {rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c} className={MONEY.includes(c)?'r':undefined}>{MONEY.includes(c)?money(r[c]):String(r[c]??'')}</td>)}</tr>)}</tbody></table></Scroll>
   <p><b>{['people','attendance'].includes(f.kind)?`${rows.length} record(s)`:(f.kind==='pledges'?'Total pledged: ':'Total received (voided entries excluded): ')+money(total)}</b></p></>}</>}
