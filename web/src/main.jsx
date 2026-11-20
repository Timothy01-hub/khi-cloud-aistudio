import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {MemberRoutes,SecretaryRoutes,AdminRoutes,DevRoutes} from './routes.jsx';
import {api} from './api.js';
import {BrandLogo} from './ui.jsx';

// One bundle, four apps + hidden /dev/ route; '/' renders the app picker.
const seg=location.pathname.split('/')[1],app=['member','secretary','admin','superadmin','dev'].includes(seg)?seg:'';
if(app&&app!=='dev')document.querySelector('link[rel=manifest]').href=`/${app}/manifest.webmanifest`;
const CRED={member:'Phone 0971234567 (or 0951234567) · password demo1234',secretary:'Username sec1 (Main), sec2 (Assistant), or nipa1 · password demo1234',admin:'Username admin (City Centre) or nipaadmin (Nipa) · password demo1234',superadmin:'Username super (Apostle Felix Mwamba) · password demo1234',dev:'Username timothy · password demo1234'};
const APPS=[['member','Member app'],['secretary','Secretary app'],['admin','Admin app (one church)'],['superadmin','Super Admin app (everything)'],['dev','Developer console (demo)']];

function Launcher(){
 const [demo,setDemo]=useState(false);
 useEffect(()=>{document.body.classList.add('login');api('/api/mode').then(r=>setDemo(!!r.demo)).catch(()=>{});return()=>document.body.classList.remove('login')},[]);
 const open=async a=>{
  if(a==='dev')await Promise.allSettled([api('/api/member/logout',{}),api('/api/staff/logout',{})]);
  location.href='/'+a+'/';
 };
 return <div className="login"><div className="card login-box" style={{maxWidth:460}}><BrandLogo center sub="Raising True Christians who Impact Nations with God's Kingdom"/>
  <p className="muted">Choose which app to open.{demo?' Demo accounts use password demo1234.':''}</p>
  {APPS.map(([a,t])=><div key={a}><button onClick={()=>open(a)}>{t}</button>{demo&&<p className="muted">{CRED[a]}</p>}</div>)}</div></div>;
}

function Bar(){
 const [demo,setDemo]=useState(false);
 useEffect(()=>{api('/api/mode').then(r=>setDemo(!!r.demo)).catch(()=>{})},[]);
 return <div style={{background:'#2b2090',padding:'.4rem 1rem',fontSize:'.8rem',display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}><span>{demo?`Demo · ${CRED[app]||''}`:`Kingdom Heralds · ${app}`}</span><a href="/">Switch app</a></div>;
}

createRoot(document.getElementById('root')).render(app?<><Bar/><BrowserRouter basename={'/'+app}>{app==='dev'?<DevRoutes/>:app==='member'?<MemberRoutes/>:app==='secretary'?<SecretaryRoutes/>:<AdminRoutes app={app}/>}</BrowserRouter></>:<Launcher/>);
