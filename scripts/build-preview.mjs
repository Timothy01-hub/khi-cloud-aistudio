// Builds ONE self-contained HTML file with all three React apps running on the demo backend.  Usage: node scripts/build-preview.mjs [out.html]
import {build} from 'esbuild';import fs from 'fs';import path from 'path';
const root=path.resolve(import.meta.dirname,'..'),out=process.argv[2]||'dist-preview/index.html';
const useMock={name:'mock-api',setup(b){b.onResolve({filter:/\/api\.js$/},()=>({path:path.join(root,'web/src/mockapi.js')}))}};
const r=await build({entryPoints:[root+'/web/src/preview.jsx'],bundle:true,minify:true,format:'iife',jsx:'automatic',write:false,plugins:[useMock],define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
const uri=f=>'data:image/jpeg;base64,'+fs.readFileSync(root+'/web/public/shared/'+f).toString('base64');
let js=r.outputFiles[0].text.replaceAll('"/shared/logo.jpg"',JSON.stringify(uri('logo.jpg'))).replaceAll('"/shared/logo-mark.jpg"',JSON.stringify(uri('logo-mark.jpg'))).replace(/<\/script/gi,'<\\/script');
const css=fs.readFileSync(root+'/web/public/shared/style.css','utf8');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Kingdom Heralds · App preview</title><style>${css}\nhtml{color-scheme:dark}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);console.log('preview built:',out,Math.round(html.length/1024)+' KB');
