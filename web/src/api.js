export async function api(path,body){
 const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
 const j=await r.json().catch(()=>({}));
 if(r.status===403&&j.blocked){location.replace('/member/blocked');throw Object.assign(new Error('blocked'),{status:403})}
 if(!r.ok)throw Object.assign(new Error(j.error||'Something went wrong'),{status:r.status});
 return j}
