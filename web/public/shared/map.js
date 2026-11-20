const ZB=[[-18.1,21.9],[-8.1,33.8]],inZ=(a,b)=>a>=-18.08&&a<=-8.22&&b>=21.99&&b<=33.71;
function khMap(id){const m=L.map(id,{maxBounds:ZB,maxBoundsViscosity:1,minZoom:6}).fitBounds(ZB);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap',referrerPolicy:'origin'}).addTo(m);return m}
function khPicker(id,latI,lngI){const m=khMap(id),la=document.getElementById(latI),ln=document.getElementById(lngI);let pin;
 const put=(a,b)=>{if(!inZ(a,b)){alert('Please pick a place inside Zambia.');return}pin?pin.setLatLng([a,b]):pin=L.marker([a,b]).addTo(m);la.value=a.toFixed(6);ln.value=b.toFixed(6)};
 m.on('click',e=>put(e.latlng.lat,e.latlng.lng));
 [la,ln].forEach(i=>i.onchange=()=>{const a=parseFloat(la.value),b=parseFloat(ln.value);if(!isNaN(a)&&!isNaN(b)){put(a,b);m.setView([a,b],14)}})}
function khRoute(btn){const k=btn.dataset.k,box=document.getElementById('map-'+k),info=document.getElementById('info-'+k);
 if(!box.hidden){box.hidden=true;if(btn._w)navigator.geolocation.clearWatch(btn._w);return}
 box.hidden=false;const T=[+btn.dataset.lat,+btn.dataset.lng];
 if(!box._m){box._m=khMap('map-'+k);L.marker(T).addTo(box._m).bindPopup(btn.dataset.name)}
 const m=box._m;setTimeout(()=>{m.invalidateSize();m.setView(T,13)},60);
 if(!navigator.geolocation){info.textContent='Location is not supported on this device.';return}
 info.textContent='Getting your live location…';let last=null,me,line;
 btn._w=navigator.geolocation.watchPosition(async p=>{const a=p.coords.latitude,b=p.coords.longitude;
  if(!inZ(a,b)){info.textContent='Your location is outside Zambia. Directions only work within Zambia.';return}
  me?me.setLatLng([a,b]):me=L.circleMarker([a,b],{radius:8,color:'#fff',fillColor:'#2a7de1',fillOpacity:1}).addTo(m);
  if(last&&m.distance(last,[a,b])<300)return;last=[a,b];
  const gm='https://www.google.com/maps/dir/?api=1&origin='+a+','+b+'&destination='+T[0]+','+T[1]+'&travelmode=driving';
  try{const r=await(await fetch('https://router.project-osrm.org/route/v1/driving/'+b+','+a+';'+T[1]+','+T[0]+'?overview=full&geometries=geojson')).json(),x=r.routes[0];
   if(line)line.remove();line=L.geoJSON(x.geometry,{style:{color:'#1c1362',weight:5}}).addTo(m);m.fitBounds(line.getBounds(),{padding:[20,20]});
   info.innerHTML='🚗 '+(x.distance/1000).toFixed(1)+' km · about '+Math.round(x.duration/60)+' min · <a target="_blank" href="'+gm+'">Open turn-by-turn in Google Maps</a>'}
  catch(e){info.innerHTML='Could not draw the route. <a target="_blank" href="'+gm+'">Open in Google Maps</a>'}
 },()=>info.textContent='Please allow location access to get directions.',{enableHighAccuracy:true,maximumAge:10000})}
