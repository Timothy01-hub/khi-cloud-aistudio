import {useEffect,useState} from 'react';
import {api} from './api.js';
import {Msg,Scroll,money,today} from './ui.jsx';
const MONEY=['Amount','Pledged','Paid','Balance','Income','Approved_Expenses'],KINDS=[['offerings','Offerings & payments'],['pledges','Pledges'],['people','People directory'],['attendance','Attendance register']];

export function Reports({base,admin,unitId=''}){
 const kinds=admin?[...KINDS,['financial','Income, expenses & balance']]:KINDS;
 const [f,setF]=useState({kind:'offerings',branch:'0',from:today().slice(0,8)+'01',to:today(),type:''}),[d,setD]=useState(null),[msg,setMsg]=useState('');
 const run=async()=>{try{const qs=new URLSearchParams(f);if(unitId)qs.set('unit_id',unitId);setD(await api(`${base}/report?`+qs));setMsg('')}catch(x){setMsg('Error: '+x.message)}};
 useEffect(()=>{run()},[unitId]);
 const set=k=>e=>setF({...f,[k]:e.target.value}),rows=d?d.rows:[],cols=rows[0]?Object.keys(rows[0]):[],hd=c=>c.replace(/_/g,' ');
 const total=f.kind==='pledges'?rows.reduce((a,r)=>a+r.Pledged,0):f.kind==='financial'?(rows.find(r=>r.Branch==='CHURCH-WIDE TOTAL')?.Balance||0):rows.filter(r=>r.Status==='').reduce((a,r)=>a+r.Amount,0);
 const csv=()=>{const q=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const t='\uFEFF'+[cols.map(hd),...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(q).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=`kh-${f.kind}-${today()}.csv`;a.click()};
 return <><form className="card noprint" onSubmit={e=>{e.preventDefault();run()}}><h3>Reports</h3><div className="grid">
  <select value={f.kind} onChange={set('kind')}>{kinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
  {admin&&<select value={f.branch} onChange={set('branch')}><option value="0">All fellowships</option>{(d?.fellowships||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>}
  <input type="date" value={f.from} onChange={set('from')}/><input type="date" value={f.to} onChange={set('to')}/>
  <select value={f.type} onChange={set('type')}><option value="">Physical + digital</option><option value="physical">Physical only</option><option value="digital">Digital only</option></select></div>
  <button>Show report</button><button type="button" className="ghost" onClick={csv} disabled={!rows.length}>Download for Excel (CSV)</button><button type="button" className="ghost" onClick={()=>window.print()}>Print / Save as PDF</button></form>
  <Msg m={msg}/>{!rows.length?<p className="muted">No records for this selection.</p>:<><Scroll><table><thead><tr>{cols.map(c=><th key={c}>{hd(c)}</th>)}</tr></thead><tbody>
   {rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c} className={MONEY.includes(c)?'r':undefined}>{MONEY.includes(c)?money(r[c]):String(r[c]??'')}</td>)}</tr>)}</tbody></table></Scroll>
   <p><b>{['people','attendance'].includes(f.kind)?`${rows.length} record(s)`:(f.kind==='pledges'?'Total pledged: ':f.kind==='financial'?'Church-wide net balance: ':'Total received (voided entries excluded): ')+money(total)}</b></p></>}
  {admin&&d?.financial&&f.kind!=='financial'&&<div className="card"><h3>Income, approved expenses &amp; balance</h3>
   <Scroll><table><thead><tr><th>Branch</th><th className="r">Income</th><th className="r">Approved expenses</th><th className="r">Balance</th></tr></thead><tbody>
    {(d.financial.branches||[]).map((r,i)=><tr key={i}><td>{r.Branch}</td><td className="r">{money(r.Income)}</td><td className="r">{money(r.Approved_Expenses)}</td><td className="r"><b>{money(r.Balance)}</b></td></tr>)}
    {d.financial.churchWide&&<tr style={{borderTop:'2px solid var(--line)'}}><td><b>{d.financial.churchWide.Branch}</b></td><td className="r"><b>{money(d.financial.churchWide.Income)}</b></td><td className="r"><b>{money(d.financial.churchWide.Approved_Expenses)}</b></td><td className="r"><b>{money(d.financial.churchWide.Balance)}</b></td></tr>}
   </tbody></table></Scroll></div>}</>}
