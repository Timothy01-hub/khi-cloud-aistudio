import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import {MemberRoutes,SecretaryRoutes,AdminRoutes,DevRoutes} from './routes.jsx';
// Preview build: runs on the in-browser demo backend (see mockapi.js). Address looks like  #/member/  #/secretary/  #/admin/
const seg=location.hash.split('/')[1],app=['member','secretary','admin','superadmin','dev'].includes(seg)?seg:'';
const go=a=>{location.hash='/'+a+'/';location.reload()};
const CRED={member:'Phone 0971234567 · password demo1234',secretary:'Username sec1 (Main) or sec2 (Assistant) · password demo1234',admin:'Username admin (City Centre, all privileges) or nipaadmin (Nipa only, limited) · password demo1234',superadmin:'Username super · password demo1234'};
const Launcher=()=><div className="login"><div className="card login-box" style={{maxWidth:460}}><img src="/shared/logo.jpg" className="logo" alt=""/><h2>Kingdom Heralds · App preview</h2>
 <p className="muted">Click through all three apps. This preview uses sample data that lives only in your browser, and resets when you reload.</p>
 {[['member','Member app'],['secretary','Secretary app'],['admin','Admin app (one church)'],['superadmin','Super Admin app (everything)']].map(([a,t])=><div key={a}><button onClick={()=>go(a)}>{t}</button><p className="muted">{CRED[a]}</p></div>)}</div></div>;
const Bar=()=><div style={{background:'#2b2090',padding:'.4rem 1rem',fontSize:'.8rem',display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}><span>Preview · sample data · {CRED[app]||''}</span><a href="#" onClick={e=>{e.preventDefault();location.hash='';location.reload()}}>Switch app</a></div>;
createRoot(document.getElementById('root')).render(app?<>{app!=='dev'&&<Bar/>}<HashRouter basename={'/'+app}>{app==='dev'?<DevRoutes/>:app==='member'?<MemberRoutes/>:app==='secretary'?<SecretaryRoutes/>:<AdminRoutes app={app}/>}</HashRouter></>:<Launcher/>);
