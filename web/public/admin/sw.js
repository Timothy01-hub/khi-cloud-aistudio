/* Caches only public files (styles, logo, scripts, banners). Private pages and data are never stored on the device. */
const V='khi-v1',STATIC=['../shared/style.css','../shared/logo.jpg','../shared/logo-mark.jpg','../shared/map.js','offline.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('offline.html')));return}
 if(/\.(css|js|jpg|png|webp|svg)$/.test(u.pathname))e.respondWith(fetch(r).then(x=>{const y=x.clone();caches.open(V).then(c=>c.put(r,y));return x}).catch(()=>caches.match(r)))});
