let dp;const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;const b=document.getElementById('install');if(b)b.hidden=false});
addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('install');if(b&&ios)b.hidden=false});
addEventListener('appinstalled',()=>{const b=document.getElementById('install');if(b)b.hidden=true});
function khInstall(){if(dp){dp.prompt();dp=null}else alert('On iPhone: tap the Share button, then "Add to Home Screen".\nOn a PC: use the install icon in the address bar.')}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
