import {useEffect,useState} from 'react';
import {api} from './api.js';
import {Msg,Scroll,money,today} from './ui.jsx';
const MONEY=['Amount','Pledged','Paid','Balance','Income','Approved_Expenses','Budget','Actual','Remaining'],KINDS=[['offerings','Offerings & payments'],['pledges','Pledges'],['people','People directory'],['attendance','Attendance register']];

export function Reports({base,admin,unitId=''}){
 const [f,setF]=useState({kind:'offerings',branch:'0',from:today().slice(0,8)+'01',to:today(),type:''}),[d,setD]=useState(null),[msg,setMsg]=useState('');
 const budgetOn=d?.features?.['feature.budgets']!==false;
 const exportOn=d?.features?.['feature.exports']!==false;
 const kinds=admin?[...KINDS,['financial','Income, expenses & balance'],...(budgetOn?[['budgets','Budget vs actual']]:[])]:KINDS;
 const run=async()=>{try{const qs=new URLSearchParams(f);if(unitId)qs.set('unit_id',unitId);setD(await api(`${base}/report?`+qs));setMsg('')}catch(x){setMsg('Error: '+x.message)}};
 useEffect(()=>{run()},[unitId]);
 const set=k=>e=>setF({...f,[k]:e.target.value}),rows=d?d.rows:[],cols=rows[0]?Object.keys(rows[0]):[],hd=c=>c.replace(/_/g,' ');
 const total=f.kind==='pledges'?rows.reduce((a,r)=>a+r.Pledged,0):f.kind==='financial'?(rows.find(r=>r.Branch==='CHURCH-WIDE TOTAL')?.Balance||0):f.kind==='budgets'?rows.reduce((a,r)=>a+(+r.Actual||0),0):rows.filter(r=>r.Status==='').reduce((a,r)=>a+r.Amount,0);
 const rawBranch=f.branch!=='0'?((d?.fellowships||[]).find(b=>String(b.id)===String(f.branch))?.label||(d?.fellowships||[]).find(b=>String(b.id)===String(f.branch))?.name||'branch'):(d?.me?.branch||(admin&&unitId&&d?.fellowships?.length===1?(d.fellowships[0].label||d.fellowships[0].name):'All-branches'));
 const branchSlug=String(rawBranch||'All-branches').trim().replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'All-branches';
 const fileBase=`KHI-${f.kind}-${branchSlug}-${today()}`;
 const cellText=(c,v)=>MONEY.includes(c)?money(v):c==='Pct_Used'?`${v}%`:String(v??'');
 const exportExcel=async()=>{
  const m=await import('xlsx'),XLSX=m.utils?m:m.default;
  const data=rows.map(r=>Object.fromEntries(cols.map(c=>[hd(c),r[c]])));
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,f.kind.slice(0,31));
  XLSX.writeFile(wb,`${fileBase}.xlsx`);
 };
 const exportPdf=async()=>{
  const [mJ,mA]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const jsPDF=mJ.jsPDF||mJ.default?.jsPDF||mJ.default,autoTable=mA.default||mA.autoTable;
  const doc=new jsPDF({orientation:cols.length>6?'landscape':'portrait',unit:'pt',format:'a4'});
  doc.setFontSize(13);
  doc.text(`Kingdom Heralds International — ${kinds.find(x=>x[0]===f.kind)?.[1]||f.kind}`,40,40);
  doc.setFontSize(9);
  doc.text(`Scope: ${rawBranch} | Generated: ${today()}`,40,56);
  autoTable(doc,{startY:70,head:[cols.map(hd)],body:rows.map(r=>cols.map(c=>cellText(c,r[c]))),styles:{fontSize:8}});
  doc.save(`${fileBase}.pdf`);
 };
 return <><form className="card noprint" onSubmit={e=>{e.preventDefault();run()}}><h3>Reports</h3><div className="grid">
  <select value={f.kind} onChange={set('kind')}>{kinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
  {admin&&<select value={f.branch} onChange={set('branch')}><option value="0">All fellowships</option>{(d?.fellowships||[]).map(b=><option key={b.id} value={b.id}>{b.label||b.name}</option>)}</select>}
  <input type="date" value={f.from} onChange={set('from')}/><input type="date" value={f.to} onChange={set('to')}/>
  <select value={f.type} onChange={set('type')}><option value="">Physical + digital</option><option value="physical">Physical only</option><option value="digital">Digital only</option></select></div>
  <button>Show report</button>
  {exportOn&&<><button type="button" className="ghost" onClick={exportExcel} disabled={!rows.length}>Excel</button><button type="button" className="ghost" onClick={exportPdf} disabled={!rows.length}>PDF</button></>}
 </form>
  <Msg m={msg}/>{!rows.length?<p className="muted">No records for this selection.</p>:<><Scroll><table><thead><tr>{cols.map(c=><th key={c}>{hd(c)}</th>)}</tr></thead><tbody>
   {rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c} className={MONEY.includes(c)||c==='Pct_Used'?'r':undefined}>{c==='Status'&&f.kind==='budgets'&&+r.Pct_Used>90?<span className="badge" style={{background:'#c62828',color:'#fff'}}>⚠ &gt;90% used</span>:cellText(c,r[c])}</td>)}</tr>)}</tbody></table></Scroll>
   <p><b>{['people','attendance'].includes(f.kind)?`${rows.length} record(s)`:(f.kind==='pledges'?'Total pledged: ':f.kind==='financial'?'Church-wide net balance: ':f.kind==='budgets'?'Total actual spent: ':'Total received (voided entries excluded): ')+money(total)}</b></p></>}
  {admin&&d?.financial&&f.kind!=='financial'&&<div className="card"><h3>Income, approved expenses &amp; balance</h3>
   <Scroll><table><thead><tr><th>Branch</th><th className="r">Income</th><th className="r">Approved expenses</th><th className="r">Balance</th></tr></thead><tbody>
    {(d.financial.branches||[]).map((r,i)=><tr key={i}><td>{r.Branch}</td><td className="r">{money(r.Income)}</td><td className="r">{money(r.Approved_Expenses)}</td><td className="r"><b>{money(r.Balance)}</b></td></tr>)}
    {d.financial.churchWide&&<tr style={{borderTop:'2px solid var(--line)'}}><td><b>{d.financial.churchWide.Branch}</b></td><td className="r"><b>{money(d.financial.churchWide.Income)}</b></td><td className="r"><b>{money(d.financial.churchWide.Approved_Expenses)}</b></td><td className="r"><b>{money(d.financial.churchWide.Balance)}</b></td></tr>}
   </tbody></table></Scroll></div>}
  {admin&&budgetOn&&d?.budgets&&f.kind!=='budgets'&&<div className="card"><h3>Branch budget vs actual ({d.budgets.year})</h3>
   {!d.budgets.rows?.length?<p className="muted">No budgets configured for {d.budgets.year}.</p>:<Scroll><table><thead><tr><th>Branch</th><th>Category</th><th className="r">Budget</th><th className="r">Actual spent</th><th className="r">Remaining</th><th className="r">% used</th><th>Status</th></tr></thead><tbody>
    {d.budgets.rows.map((r,i)=><tr key={i}><td>{r.Branch}</td><td>{r.Category}</td><td className="r">{money(r.Budget)}</td><td className="r">{money(r.Actual)}</td><td className="r">{money(r.Remaining)}</td><td className="r"><b>{r.Pct_Used}%</b></td>
     <td>{r.Pct_Used>90||r.warning?<span className="badge" style={{background:'#c62828',color:'#fff'}}>⚠ &gt;90% used</span>:<span className="tag digital">OK</span>}</td></tr>)}
   </tbody></table></Scroll>}</div>}
 </>;
}
