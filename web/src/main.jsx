import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {MemberRoutes,SecretaryRoutes,AdminRoutes,DevRoutes} from './routes.jsx';
// One bundle, four apps + hidden /dev/ route
const seg=location.pathname.split('/')[1],app=['secretary','admin','superadmin','dev'].includes(seg)?seg:'member';
if(app!=='dev')document.querySelector('link[rel=manifest]').href=`/${app}/manifest.webmanifest`;
createRoot(document.getElementById('root')).render(<BrowserRouter basename={'/'+app}>{app==='dev'?<DevRoutes/>:app==='secretary'?<SecretaryRoutes/>:app==='admin'||app==='superadmin'?<AdminRoutes app={app}/>:<MemberRoutes/>}</BrowserRouter>);
