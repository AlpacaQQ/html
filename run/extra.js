// Pace — extra features: sports, heart rate, segments, routes, feed, clubs, challenges,
// fitness & freshness, insights, strength workouts, beacon, GPX, backup.
// Loaded before the main script; only definitions at top level.

// ---------------- sports ----------------
const SPORTS = {
  run:      { icon:'🏃', name:'Run',      max:12, speed:false },
  ride:     { icon:'🚴', name:'Ride',     max:25, speed:true },
  walk:     { icon:'🚶', name:'Walk',     max:4,  speed:false, met:3.5 },
  hike:     { icon:'🥾', name:'Hike',     max:5,  speed:false, met:6 },
  strength: { icon:'🏋️', name:'Strength', max:0,  speed:false, met:5 },
};
let curSport = 'run';
const sportDef = () => SPORTS[curSport];
function kcalFor(m, t, sp){
  sp = sp || 'run'; const kg = settings.weight;
  if (sp === 'run') return Math.round(kg * m/1000 * 1.036);
  const h = (t || 0)/3600; let met = (SPORTS[sp] && SPORTS[sp].met) || 5;
  if (sp === 'ride'){ const kmh = h > 0 ? (m/1000)/h : 0; met = kmh < 16 ? 4 : kmh < 20 ? 6.8 : kmh < 25 ? 8 : 10; }
  return Math.round(met * kg * h);
}
function fmtRate(spk, sp){ sp = sp || curSport; if (SPORTS[sp] && SPORTS[sp].speed) return (!isFinite(spk) || spk <= 0) ? '--' : (3600/spk).toFixed(1); return fmtPace(spk); }
const rateUnit = sp => (SPORTS[sp || curSport] || {}).speed ? 'km/h' : '/km';
function autoTitle(start, sp){ const h = new Date(start).getHours();
  const tod = h < 5 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : h < 22 ? 'Evening' : 'Night';
  return sp === 'strength' ? `${tod} Workout` : `${tod} ${SPORTS[sp || 'run'].name}`; }
const sportIcon = r => (SPORTS[r.sport || 'run'] || SPORTS.run).icon;
function setSport(sp){
  curSport = sp; store.set('sport', sp);
  document.querySelectorAll('#runView .stat .lbl')[2].textContent = sportDef().speed ? 'Avg speed' : 'Avg pace';
  document.querySelectorAll('#runView .stat .lbl')[3].textContent = sportDef().speed ? 'Speed' : 'Now';
  renderChips(); render();
}

// ---------------- generic sheet ----------------
let sheetMap = null;
function openSheet(html){
  if (sheetMap){ sheetMap.remove(); sheetMap = null; }
  $('sheetBody').innerHTML = html; openModal('sheetModal');
  $('sheetBody').querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
}
const sheetHead = t => `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">${t}</h2><button class="icon-btn" data-close="sheetModal">✕</button></div>`;
function sheetLeaflet(id){ setTimeout(() => {}, 0); sheetMap = L.map(id, { zoomControl:false, attributionControl:false }); tiles(sheetMap); setTimeout(() => sheetMap && sheetMap.invalidateSize(), 80); return sheetMap; }

// ---------------- helpers ----------------
function seeded(seed){ let s = 2166136261; for (const ch of String(seed)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s/4294967296; }; }
const near = (p, ll, r) => hav(p, { lat:ll[0], lng:ll[1] }) <= r;
function distToSeg(p, a, b){ const k = 111320, cl = Math.cos(p.lat*Math.PI/180);
  const ax = (a[1]-p.lng)*k*cl, ay = (a[0]-p.lat)*k, bx = (b[1]-p.lng)*k*cl, by = (b[0]-p.lat)*k;
  const dx = bx-ax, dy = by-ay, L2 = dx*dx + dy*dy; let t = L2 ? -(ax*dx + ay*dy)/L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t*dx, ay + t*dy); }
function lineLen(line){ let s = 0; for (let i = 1; i < line.length; i++) s += hav({lat:line[i-1][0],lng:line[i-1][1]}, {lat:line[i][0],lng:line[i][1]}); return s; }
function svgRoute(pts, w = 340, h = 130, color = '#ff6b3d'){
  const P = pts.filter(p => p && p[0] != null); if (P.length < 2) return '';
  const lat0 = P[0][0]*Math.PI/180, xs = P.map(p => p[1]*Math.cos(lat0)), ys = P.map(p => -p[0]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys), pad = 12;
  const sc = Math.min((w-2*pad)/((mxx-mnx)||1e-9), (h-2*pad)/((mxy-mny)||1e-9)), ox = (w - (mxx-mnx)*sc)/2, oy = (h - (mxy-mny)*sc)/2;
  const d = P.map((p, i) => `${i ? 'L' : 'M'}${(ox + (xs[i]-mnx)*sc).toFixed(1)},${(oy + (ys[i]-mny)*sc).toFixed(1)}`).join('');
  return `<svg class="mini" viewBox="0 0 ${w} ${h}" width="100%"><path d="${d}" fill="none" stroke="${color}" stroke-width="7" stroke-opacity=".25" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function relTime(t){ const d = new Date(t), today = dayKey(new Date()), yd = dayKey(addDays(new Date(), -1));
  const hm = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  return dayKey(d) === today ? `Today at ${hm}` : dayKey(d) === yd ? `Yesterday at ${hm}` : `${d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' })} at ${hm}`; }
async function shareOrDownload(name, text, type){
  const file = new File([text], name, { type });
  try{ if (navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file] }); return; } }catch(e){ if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function pickFile(accept, cb){ const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f.name); r.readAsText(f); }; i.click(); }

// ---------------- profile & demo athletes ----------------
const profile = () => Object.assign({ name:'You', av:'🏃' }, store.get('profile', {}));
const social = () => Object.assign({ following:null, kudos:{}, comments:{} }, store.get('social', {}));
const saveSocial = s => store.set('social', s);
const DEMO = [
  { id:'ingrid', name:'Ingrid H.', av:'🦊', pace:290, freq:.55, maxKm:12, runBias:.85 },
  { id:'magnus', name:'Magnus L.', av:'🐺', pace:260, freq:.45, maxKm:18, runBias:.7 },
  { id:'sofie',  name:'Sofie B.',  av:'🦋', pace:330, freq:.5,  maxKm:8,  runBias:.8 },
  { id:'jonas',  name:'Jonas K.',  av:'🐻', pace:350, freq:.35, maxKm:22, runBias:.6 },
  { id:'emma',   name:'Emma R.',   av:'🐬', pace:305, freq:.5,  maxKm:10, runBias:.9 },
  { id:'lars',   name:'Lars P.',   av:'🦅', pace:275, freq:.3,  maxKm:15, runBias:.4 },
  { id:'nora',   name:'Nora V.',   av:'🐱', pace:315, freq:.4,  maxKm:9,  runBias:.75 },
  { id:'erik',   name:'Erik S.',   av:'🦌', pace:285, freq:.4,  maxKm:20, runBias:.5 },
];
const following = () => { const f = social().following; return f || DEMO.map(d => d.id); };
const DEMO_TITLES = { run:['Morning Run','Lunch Run','Evening Run','Easy recovery jog','Tempo Tuesday 🔥','Long run 🌲','Intervals by the fjord','Rainy run ☔','Hill repeats 😮‍💨'],
  ride:['Morning Ride','Bike commute 🚲','Coffee ride ☕'], walk:['Evening Walk','Walk with the dog 🐕'], hike:['Forest hike 🌲','Summit push ⛰️'] };
const COMMENTS = ['Strong work! 💪','Nice pace!','Beast mode 🔥','Love that route','Great consistency 👏','Legs of steel','Rest day tomorrow? 😄','Inspiring!'];
function homeCenter(){ const r = getRuns().find(r => r.pts.length); return r ? [r.pts[0][0], r.pts[0][1]] : [59.9139, 10.7522]; }
function demoRoute(rnd, c, meters){
  const R = meters/(2*Math.PI), cx = c[0] + (rnd()-.5)*.03, cy = c[1] + (rnd()-.5)*.06, n = 60, ph = rnd()*6.28, wob = .15 + rnd()*.3, pts = [];
  for (let i = 0; i <= n; i++){ const a = ph + i/n*2*Math.PI, r = R*(1 + wob*Math.sin(3*a + ph) + .08*Math.sin(9*a));
    pts.push([cx + r*Math.sin(a)/111320, cy + r*Math.cos(a)/(111320*Math.cos(cx*Math.PI/180))]); }
  return pts;
}
let demoCache = null, demoCacheKey = '';
function demoActivities(){
  const key = dayKey(new Date()) + new Date().getHours(); if (demoCache && demoCacheKey === key) return demoCache;
  const c = homeCenter(), out = [], today = new Date();
  for (const a of DEMO) for (let d = 0; d < 14; d++){
    const day = addDays(today, -d), rnd = seeded(a.id + dayKey(day)); if (rnd() > a.freq) continue;
    const sport = rnd() < a.runBias ? 'run' : ['ride','walk','hike'][Math.floor(rnd()*3)];
    const km = sport === 'run' ? 3 + rnd()*a.maxKm : sport === 'ride' ? 15 + rnd()*40 : sport === 'walk' ? 2 + rnd()*5 : 6 + rnd()*10;
    const spk = sport === 'run' ? a.pace*(.93 + rnd()*.18) : sport === 'ride' ? 3600/(20 + rnd()*10) : sport === 'walk' ? 720 : 900;
    const st = new Date(day); st.setHours([6,7,12,16,17,19][Math.floor(rnd()*6)], Math.floor(rnd()*60), 0, 0); if (+st > Date.now()) continue;
    const T = DEMO_TITLES[sport];
    out.push({ demo:true, id:`demo:${a.id}:${dayKey(day)}`, who:a, sport, title:T[Math.floor(rnd()*T.length)], dist:km*1000, time:km*spk, start:+st,
      elev:Math.round(rnd()*(sport === 'hike' ? 450 : 90)), kudosBase:2 + Math.floor(rnd()*30), commentsBase:Math.floor(rnd()*4), pts:demoRoute(rnd, c, km*1000) });
  }
  demoCache = out; demoCacheKey = key; return out;
}

// ---------------- heart rate (Web Bluetooth) ----------------
let hrDev = null, hrNow = null, hrAt = 0;
const liveHr = () => (hrNow && Date.now() - hrAt < 6000) ? hrNow : null;
const maxHr = () => settings.maxHr || (220 - (settings.age || 30));
const hrZone = h => { const p = h/maxHr(); return p < .6 ? 1 : p < .7 ? 2 : p < .8 ? 3 : p < .9 ? 4 : 5; };
const ZONES = ['', 'Recovery', 'Endurance', 'Tempo', 'Threshold', 'Max'];
async function connectHr(){
  if (!navigator.bluetooth) return toast('Heart-rate straps need Chrome on Android (not supported on iPhone)');
  try{
    const dev = await navigator.bluetooth.requestDevice({ filters:[{ services:['heart_rate'] }] });
    const ch = await (await (await dev.gatt.connect()).getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', e => { const v = e.target.value; hrNow = (v.getUint8(0) & 1) ? v.getUint16(1, true) : v.getUint8(1); hrAt = Date.now(); });
    await ch.startNotifications(); hrDev = dev;
    dev.addEventListener('gattserverdisconnected', () => { hrDev = null; toast('❤️ Heart-rate strap disconnected'); renderChips(); });
    toast(`❤️ Connected: ${dev.name || 'HR strap'}`); renderChips();
  }catch(e){ if (e.name !== 'NotFoundError') toast('Could not connect: ' + e.message); }
}

// ---------------- live hooks ----------------
let segActive = null, segDone = new Set(), segCache = [], followRoute = null, offCount = 0, offWarned = false, hrSamples = [];
const followLine = { layer:null };
function extraStart(){ segActive = null; segDone = new Set(); segCache = getSegs(); offCount = 0; offWarned = false; hrSamples = []; }
function extraOnPoint(pt){ if (pt.hr) hrSamples.push(pt.hr); liveSegments(pt); followCheck(pt); }
function extraStrip(){
  const p = [];
  if (segActive) p.push(`⭐ ${segActive.seg.name}: ${Math.max(0, Math.round(segActive.seg.len - (dist - segActive.c0)))} m left`);
  if (followRoute){ p.push(offWarned ? '⚠️ Off route' : `🗺️ ${(routeRemaining()/1000).toFixed(2)} km left on route`); }
  return p;
}
function extraRender(){
  const fr = (dist % 1000)/1000, arc = $('ringArc'); if (arc) arc.style.strokeDashoffset = (628.3*(1 - fr)).toFixed(1);
  const cs = $('coreSub'); if (cs) cs.textContent = state === 'idle' && !dist ? `${sportDef().name.toUpperCase()} · READY` : `KM ${Math.floor(dist/1000) + 1} · ${Math.round(fr*100)}%`;
  const h = liveHr(), lbl = document.querySelectorAll('#runView .stat .lbl')[6];
  if (h){ lbl.textContent = 'Heart rate'; $('lastKm').innerHTML = `${h}<span class="unit">Z${hrZone(h)}</span>`; }
  else if (lbl.textContent !== 'Last km'){ lbl.textContent = 'Last km'; }
  if (sportDef().speed){ const t = elapsed(); $('avg').textContent = dist > 50 ? fmtRate(t/(dist/1000)) : '--'; $('cur').textContent = state === 'running' ? fmtRate(currentPace()) : '--'; }
}

// ---------------- segments ----------------
const getSegs = () => store.get('segments', []);
function liveSegments(pt){
  if (!segCache.length) return;
  if (segActive){
    const s = segActive.seg, dd = pt.c - segActive.c0;
    if (dd >= s.len*.8 && near(pt, s.end, 30)){
      const t = pt.e - segActive.e0, best = myBestEffort(s.id), pr = !best || t < best; segDone.add(s.id); segActive = null;
      buzz([200,100,200]); say(`Segment ${s.name} complete in ${spoken(t)}.${pr ? ' New personal best!' : ''}`); toast(`⭐ ${s.name}: ${fmtTime(t)}${pr ? ' — PR! 🏆' : ''}`);
    } else if (dd > s.len*2 + 200) segActive = null;
    return;
  }
  for (const s of segCache){ if (segDone.has(s.id) || !near(pt, s.start, 25)) continue;
    segActive = { seg:s, e0:pt.e, c0:pt.c }; buzz([80]); say(`Segment start: ${s.name}. Go!`); toast(`⭐ Segment: ${s.name}`); break; }
}
function matchEfforts(pts, segs){
  const out = [];
  for (const s of segs || getSegs()){
    let best = null;
    for (let i = 0; i < pts.length; i++){
      const p = pts[i]; if (p[3] == null || !near({ lat:p[0], lng:p[1] }, s.start, 30)) continue;
      for (let j = i + 1; j < pts.length; j++){ const q = pts[j], dd = q[3] - p[3]; if (dd > s.len*2 + 200) break;
        if (dd >= s.len*.8 && near({ lat:q[0], lng:q[1] }, s.end, 30)){ const t = q[2] - p[2]; if (!best || t < best) best = t; break; } }
    }
    if (best) out.push({ seg:s.id, t:Math.round(best) });
  }
  return out;
}
function myBestEffort(id){ let b = null; for (const r of getRuns()) for (const e of (r.efforts || [])) if (e.seg === id && (!b || e.t < b)) b = e.t; return b; }
function segBoard(s){
  const my = myBestEffort(s.id), base = my || s.len/3.3, rnd = seeded(s.id);
  const rows = DEMO.map(d => ({ name:d.name, av:d.av, t:Math.round(base*(.8 + rnd()*.55)), demo:true }));
  if (my) rows.push({ name:profile().name + ' (you)', av:profile().av, t:my, me:true });
  rows.sort((a, b) => a.t - b.t); return rows;
}
function openSegment(s){
  const rows = segBoard(s), myRank = rows.findIndex(r => r.me) + 1;
  openSheet(sheetHead('⭐ ' + esc(s.name)) + `<p class="sub">${(s.len/1000).toFixed(2)} km · ${myRank ? `You're #${myRank} of ${rows.length}` : 'No effort yet — run it!'}</p>
    <div id="segMap" class="smap"></div>
    <div class="card"><h3>Leaderboard <span class="demo">DEMO RIVALS</span></h3>${rows.map((r, i) => `<div class="lb ${r.me ? 'me' : ''}"><span>${i === 0 ? '👑' : i + 1}</span><span>${r.av} ${esc(r.name)}</span><b>${fmtTime(r.t)}</b></div>`).join('')}</div>
    <div class="row-btns"><button class="main sec" id="segDel" style="color:#ff8b78">Delete segment</button></div>`);
  const m = sheetLeaflet('segMap'); const pl = L.polyline(s.pts, { color:'#8b7cff', weight:6 }).addTo(m); setTimeout(() => m.fitBounds(pl.getBounds(), { padding:[20,20] }), 100);
  $('segDel').onclick = () => { const b = $('segDel'); if (!b.dataset.sure){ b.dataset.sure = 1; b.textContent = 'Tap again to delete'; return; }
    store.set('segments', getSegs().filter(x => x.id !== s.id)); closeModal('sheetModal'); renderRoutes(); };
}
function createSegment(r){
  const P = r.pts.filter(p => p[3] != null); if (P.length < 5) return toast('This activity has no detailed track');
  const total = P[P.length-1][3];
  openSheet(sheetHead('⭐ Create segment') + `<p class="sub">Drag the sliders to pick the start and end. Every future run that passes through it gets timed and ranked — with live voice alerts.</p>
    <div id="segMap" class="smap"></div>
    <label class="f">Start: <b id="sA"></b></label><input type="range" id="segA" min="0" max="${Math.round(total)}" value="0" step="10">
    <label class="f">End: <b id="sB"></b></label><input type="range" id="segB" min="0" max="${Math.round(total)}" value="${Math.round(Math.min(total, 800))}" step="10">
    <label class="f">Name</label><input id="segName" placeholder="e.g. Riverside sprint" maxlength="40">
    <div class="row-btns" style="margin-top:12px"><button class="main" id="segSave">Create segment</button></div>`);
  const m = sheetLeaflet('segMap'); const full = L.polyline(P.map(p => [p[0], p[1]]), { color:'#666', weight:4 }).addTo(m), hl = L.polyline([], { color:'#8b7cff', weight:7 }).addTo(m);
  setTimeout(() => m.fitBounds(full.getBounds(), { padding:[20,20] }), 100);
  const sel = () => { let a = +$('segA').value, b = +$('segB').value; if (b < a) [a, b] = [b, a]; return P.filter(p => p[3] >= a && p[3] <= b); };
  const upd = () => { const s = sel(); hl.setLatLngs(s.map(p => [p[0], p[1]])); $('sA').textContent = (+$('segA').value/1000).toFixed(2) + ' km'; $('sB').textContent = (+$('segB').value/1000).toFixed(2) + ' km'; };
  $('segA').oninput = upd; $('segB').oninput = upd; upd();
  $('segSave').onclick = () => {
    const s = sel(); if (s.length < 2 || s[s.length-1][3] - s[0][3] < 100) return toast('Make the segment at least 100 m');
    const seg = { id:'seg' + Date.now(), name:$('segName').value.trim() || `Segment ${getSegs().length + 1}`, pts:s.map(p => [p[0], p[1]]), start:[s[0][0], s[0][1]], end:[s[s.length-1][0], s[s.length-1][1]], len:Math.round(s[s.length-1][3] - s[0][3]) };
    store.set('segments', [...getSegs(), seg]);
    const runs = store.get('runs', []).map(x => { const n = normRun(x); n.efforts = matchEfforts(n.pts); return n; }); store.set('runs', runs);
    closeModal('sheetModal'); toast(`⭐ Segment "${seg.name}" created`); openSegment(seg);
  };
}

// ---------------- routes ----------------
const getRoutes = () => store.get('routes', []);
let snapFailed = false;
async function snapLeg(a, b, sp){
  if (snapFailed) return [a, b];
  try{ const prof = sp === 'ride' ? 'routed-bike' : 'routed-foot';
    const r = await fetch(`https://routing.openstreetmap.de/${prof}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`);
    const j = await r.json(); if (j.code === 'Ok') return j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  }catch{ snapFailed = true; toast('Path snapping unavailable — using straight lines'); }
  return [a, b];
}
function myPos(){ try{ const ll = me.getLatLng(); if (ll.lat) return [ll.lat, ll.lng]; }catch{} return homeCenter(); }
function routeBuilder(preset){
  const wps = [], legs = [];
  openSheet(sheetHead('🗺️ Route builder') + `<p class="sub">Tap the map to add points. Lines snap to paths automatically.</p>
    <div id="rbMap" class="smap tall"></div>
    <div class="rbbar"><b id="rbDist">0.00 km</b><button class="chip" id="rbUndo">↩ Undo</button><button class="chip" id="rbLoop">⟲ Back to start</button><button class="chip" id="rbClear">Clear</button></div>
    <div class="chips" style="padding:0;margin-top:8px">${[3,5,8,10,15,21].map(k => `<button class="chip" data-gen="${k}">✨ ${k} km loop</button>`).join('')}</div>
    <label class="f">Name</label><input id="rbName" placeholder="e.g. Lunch loop" maxlength="40">
    <div class="row-btns" style="margin-top:12px"><button class="main" id="rbSave">Save route</button></div>`);
  const m = sheetLeaflet('rbMap'); m.setView(myPos(), 14);
  const line = L.polyline([], { color:'#6cb6ff', weight:5 }).addTo(m), marks = L.layerGroup().addTo(m);
  const full = () => legs.flat();
  const redraw = () => { line.setLatLngs(full()); marks.clearLayers(); wps.forEach((w, i) => L.circleMarker(w, { radius:6, color:'#fff', weight:2, fillColor:i ? '#6cb6ff' : '#2ecc71', fillOpacity:1 }).addTo(marks)); $('rbDist').textContent = (lineLen(full())/1000).toFixed(2) + ' km'; };
  const add = async ll => { wps.push(ll); if (wps.length > 1){ legs.push([ll]); redraw(); legs[legs.length-1] = await snapLeg(wps[wps.length-2], ll, curSport); } redraw(); };
  m.on('click', e => add([e.latlng.lat, e.latlng.lng]));
  $('rbUndo').onclick = () => { wps.pop(); legs.pop(); redraw(); };
  $('rbClear').onclick = () => { wps.length = 0; legs.length = 0; redraw(); };
  $('rbLoop').onclick = () => { if (wps.length > 1) add(wps[0]); };
  $('sheetBody').querySelectorAll('[data-gen]').forEach(b => b.onclick = async () => {
    const km = +b.dataset.gen, c = wps[0] || myPos(), R = km*1000/(2*Math.PI)/1.3, ph = Math.random()*6.28, rnd = Math.random;
    wps.length = 0; legs.length = 0; const pts = [c];
    for (let i = 1; i <= 3; i++){ const a = ph + i*Math.PI/2 + (rnd()-.5)*.6, r = R*(1.2 + (rnd()-.5)*.4);
      pts.push([c[0] + r*(Math.sin(a) - Math.sin(ph))/111320, c[1] + r*(Math.cos(a) - Math.cos(ph))/(111320*Math.cos(c[0]*Math.PI/180))]); }
    pts.push(c); toast('✨ Building loop…'); for (const p of pts) await add(p); m.fitBounds(line.getBounds(), { padding:[20,20] });
    $('rbName').value = $('rbName').value || `${km} km loop`;
  });
  $('rbSave').onclick = () => { const l = full(); if (l.length < 2) return toast('Add at least two points');
    const r = { id:'rt' + Date.now(), name:$('rbName').value.trim() || `Route ${getRoutes().length + 1}`, line:l.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]), len:Math.round(lineLen(l)), sport:curSport };
    store.set('routes', [r, ...getRoutes()]); closeModal('sheetModal'); renderRoutes(); toast('🗺️ Route saved'); };
  if (preset){ preset.forEach(p => wps.push(p)); legs.push(...preset.slice(1).map((p, i) => [preset[i], p])); redraw(); }
}
function routeRemaining(){
  if (!followRoute || !pts.length) return followRoute ? followRoute.len : 0;
  const p = pts[pts.length-1], L_ = followRoute.line; let bi = 0, bd = Infinity;
  for (let i = 0; i < L_.length; i++){ const d = hav(p, { lat:L_[i][0], lng:L_[i][1] }); if (d < bd){ bd = d; bi = i; } }
  return followRoute.len - followRoute.cum[bi];
}
function followCheck(pt){
  if (!followRoute) return;
  let d = Infinity; const L_ = followRoute.line; for (let i = 1; i < L_.length; i++) d = Math.min(d, distToSeg(pt, L_[i-1], L_[i]));
  if (d > 40){ if (++offCount >= 3 && !offWarned){ offWarned = true; buzz([300,100,300]); say('You are off route.'); } }
  else { offCount = 0; if (offWarned){ offWarned = false; say('Back on route.'); } }
}
function setFollow(r){
  if (followLine.layer){ followLine.layer.remove(); followLine.layer = null; }
  followRoute = null;
  if (r){ const cum = [0]; for (let i = 1; i < r.line.length; i++) cum.push(cum[i-1] + hav({lat:r.line[i-1][0],lng:r.line[i-1][1]}, {lat:r.line[i][0],lng:r.line[i][1]}));
    followRoute = { ...r, cum, len:cum[cum.length-1] };
    followLine.layer = L.polyline(r.line, { color:'#6cb6ff', weight:5, opacity:.7 }).addTo(map);
    setTimeout(() => { map.invalidateSize(); map.fitBounds(followLine.layer.getBounds(), { padding:[20,20] }); }, 80); follow = false; }
  renderChips(); render();
}
function renderRoutes(){
  const routes = getRoutes(), segs = getSegs();
  $('routesBody').innerHTML = `<div class="row-btns" style="margin-bottom:12px"><button class="main" id="rtNew">＋ New route</button><button class="main sec" id="rtImport">⬆ Import GPX</button></div>
    <h3 class="sec-h">Your routes</h3>
    ${routes.length ? routes.map((r, i) => `<div class="card rt">${svgRoute(r.line, 340, 110, '#6cb6ff')}<div class="rtrow"><div><b>${esc(r.name)}</b><small>${(r.len/1000).toFixed(2)} km</small></div>
      <button class="chip on" data-go="${i}">▶ Follow</button><button class="chip" data-gpx="${i}">⬇</button><button class="chip" data-del="${i}">✕</button></div></div>`).join('')
      : '<div class="empty" style="margin:10px 0 20px">No routes yet. Build one or tap ✨ to auto-generate a loop.</div>'}
    <h3 class="sec-h">Your segments ⭐</h3>
    ${segs.length ? segs.map((s, i) => { const b = myBestEffort(s.id), rk = segBoard(s).findIndex(r => r.me) + 1;
      return `<div class="card seg" data-seg="${i}"><div class="rtrow"><div><b>⭐ ${esc(s.name)}</b><small>${(s.len/1000).toFixed(2)} km · ${b ? `PR ${fmtTime(b)} · #${rk}` : 'not run yet'}</small></div><span>›</span></div></div>`; }).join('')
      : '<div class="empty" style="margin:10px 0">Create segments from any run: open it in You → Activities → ⭐ Segment.</div>'}`;
  $('rtNew').onclick = () => routeBuilder();
  $('rtImport').onclick = () => pickFile('.gpx,application/gpx+xml', (txt, name) => {
    const doc = new DOMParser().parseFromString(txt, 'application/xml'), pts = [...doc.querySelectorAll('trkpt,rtept,wpt')].map(n => [+n.getAttribute('lat'), +n.getAttribute('lon')]).filter(p => isFinite(p[0]));
    if (pts.length < 2) return toast('No track found in that file');
    const step = Math.max(1, Math.ceil(pts.length/1500)), line = pts.filter((p, i) => i % step === 0 || i === pts.length-1);
    store.set('routes', [{ id:'rt' + Date.now(), name:(doc.querySelector('name') || {}).textContent || name.replace(/\.gpx$/i, ''), line, len:Math.round(lineLen(line)) }, ...getRoutes()]); renderRoutes(); toast('🗺️ Route imported');
  });
  $('routesBody').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (state !== 'idle') return toast('Finish your current activity first'); setFollow(routes[+b.dataset.go]); showView('runView'); toast('🗺️ Route loaded — hit START'); });
  $('routesBody').querySelectorAll('[data-gpx]').forEach(b => b.onclick = () => { const r = routes[+b.dataset.gpx]; shareOrDownload(r.name.replace(/[^\w-]+/g, '_') + '.gpx', gpxFrom(r.name, r.line.map(p => [p[0], p[1]]), null), 'application/gpx+xml'); });
  $('routesBody').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!b.dataset.sure){ b.dataset.sure = 1; b.textContent = 'Sure?'; return; } store.set('routes', routes.filter((_, i) => i !== +b.dataset.del)); renderRoutes(); });
  $('routesBody').querySelectorAll('[data-seg]').forEach(c => c.onclick = () => openSegment(segs[+c.dataset.seg]));
}

// ---------------- GPX ----------------
function gpxFrom(name, pts, r){
  const t0 = r ? r.start : null;
  const tp = pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}">${p[4] != null ? `<ele>${p[4]}</ele>` : ''}${t0 && p[2] != null ? `<time>${new Date(t0 + p[2]*1000).toISOString()}</time>` : ''}${p[5] ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p[5]}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''}</trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Pace" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\n<trk><name>${esc(name)}</name><type>${r ? (r.sport === 'ride' ? 'cycling' : r.sport || 'running') : 'route'}</type><trkseg>\n${tp}\n</trkseg></trk></gpx>`;
}

// ---------------- fitness, effort, insights ----------------
function threshPace(){ const p = predictor(getRuns()); return p ? p['10K']/10*1.02 : (settings.target || 330); }
function runLoad(r){
  const min = r.time/60; if (!min) return 0;
  if (r.hr && r.hr.avg){ const rest = settings.restHr || 60, hrr = Math.max(0, Math.min(1, (r.hr.avg - rest)/(maxHr() - rest))); return Math.round(min*hrr*.64*Math.exp(1.92*hrr)); }
  const sp = r.sport || 'run';
  if (sp !== 'run' || !r.dist) return Math.round(min*({ ride:.6, walk:.3, hike:.55, strength:.5 }[sp] || .6));
  const IF = Math.min(1.3, threshPace()/(r.time/(r.dist/1000))); return Math.round(min/60*IF*IF*100);
}
function fitnessSeries(){
  const runs = getRuns(), byDay = {}; for (const r of runs){ const k = dayKey(r.start); byDay[k] = (byDay[k] || 0) + runLoad(r); }
  let ctl = 0, atl = 0; const out = [];
  for (let i = 150; i >= 0; i--){ const d = addDays(new Date(), -i), l = byDay[dayKey(d)] || 0; ctl += (l - ctl)/42; atl += (l - atl)/7; if (i <= 90) out.push({ d, ctl, atl, tsb:ctl - atl, l }); }
  return out;
}
function renderFitness(){
  const S = fitnessSeries(), last = S[S.length-1], W = 330, H = 140, mx = Math.max(10, ...S.map(s => Math.max(s.ctl, s.atl)));
  const path = k => S.map((s, i) => `${i ? 'L' : 'M'}${(i/(S.length-1)*W).toFixed(1)},${(H - s[k]/mx*(H-10)).toFixed(1)}`).join('');
  const bars = S.map((s, i) => s.l ? `<rect x="${(i/(S.length-1)*W - 1.5).toFixed(1)}" y="${H - Math.min(H, s.l/mx*(H-10)*.5)}" width="3" height="${Math.min(H, s.l/mx*(H-10)*.5)}" fill="#3a3f48"/>` : '').join('');
  const tsb = Math.round(last.tsb), state_ = tsb > 5 ? ['😎 Fresh', 'Well rested — great time to race or test yourself.'] : tsb >= -10 ? ['😐 Neutral', 'Maintaining. Add a harder session to build fitness.'] : tsb >= -30 ? ['💪 Productive', 'Training hard and building fitness. Keep sleep and food on point.'] : ['🥵 Overreaching', 'Fatigue is high — take an easy day or rest.'];
  const runs = getRuns().slice(0, 8);
  $('panelFitness').innerHTML = `<div class="grid3"><div class="stat"><div class="lbl">Fitness</div><div class="val" style="color:#4da3ff">${Math.round(last.ctl)}</div></div><div class="stat"><div class="lbl">Fatigue</div><div class="val" style="color:#ff6fa8">${Math.round(last.atl)}</div></div><div class="stat"><div class="lbl">Form</div><div class="val">${tsb > 0 ? '+' : ''}${tsb}</div></div></div>
    <div class="card"><h3>${state_[0]}</h3><p class="sub" style="margin:0">${state_[1]}</p></div>
    <div class="card"><h3>Fitness & fatigue <small>· last 90 days</small></h3><svg viewBox="0 0 ${W} ${H}" width="100%">${bars}<path d="${path('ctl')}" fill="none" stroke="#4da3ff" stroke-width="2.5"/><path d="${path('atl')}" fill="none" stroke="#ff6fa8" stroke-width="1.5" opacity=".8"/></svg>
      <p class="sub" style="margin:6px 0 0"><span style="color:#4da3ff">━ Fitness</span> (42-day load) · <span style="color:#ff6fa8">━ Fatigue</span> (7-day load) · bars = daily effort</p></div>
    <div class="card"><h3>Relative effort <small>· recent activities</small></h3>${runs.length ? runs.map(r => { const l = runLoad(r); return `<div class="split"><span style="width:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${sportIcon(r)} ${esc(r.title || autoTitle(r.start, r.sport))}</span><div class="bar"><i style="width:${Math.min(100, l/1.5)}%;background:${l > 120 ? '#ff6b3d' : l > 60 ? '#f5a623' : '#2ecc71'}"></i></div><b style="width:34px;text-align:right">${l}</b></div>`; }).join('') : '<p class="sub">No activities yet.</p>'}</div>
    <p class="sub">Effort uses heart rate when a strap was connected, otherwise pace vs. your threshold pace (${fmtPace(threshPace())}/km).</p>`;
}
function insights(r){
  const out = [], sp = r.sport || 'run', nm = SPORTS[sp].name.toLowerCase(), others = getRuns().filter(x => x.id !== r.id && (x.sport || 'run') === sp && x.start < r.start + 1), km = r.dist/1000;
  if (sp === 'strength') return [`🏋️ ${fmtTime(r.time)} of strength work — your running economy thanks you`];
  if (km > .5){ const longer = others.filter(x => x.dist > r.dist).length;
    if (!others.length) out.push(`🎉 Your first ${nm} in Pace!`); else if (!longer) out.push(`🏅 Your longest ${nm} yet`); else if (longer < 3 && others.length >= 4) out.push(`📏 Your #${longer + 1} longest ${nm}`); }
  const recent = others.filter(x => x.dist > 500 && x.start > r.start - 30*DAY);
  if (recent.length >= 2 && r.dist > 500){ const avg = recent.reduce((a, x) => a + x.time/(x.dist/1000), 0)/recent.length, diff = Math.round(avg - r.time/km);
    if (Math.abs(diff) >= 5) out.push(SPORTS[sp].speed ? (diff > 0 ? `⚡ Faster than your 30-day average` : `🐢 Slower than your 30-day average`) : diff > 0 ? `⚡ ${diff}s/km faster than your 30-day average` : `🐢 ${-diff}s/km slower than your 30-day average — recovery day?`); }
  if (r.splits.length >= 4 && !SPORTS[sp].speed){ const h = Math.floor(r.splits.length/2), a = r.splits.slice(0, h).reduce((x, y) => x + y, 0)/h, b = r.splits.slice(h).reduce((x, y) => x + y, 0)/(r.splits.length - h);
    if (a - b >= 5) out.push(`📈 Negative split — second half ${Math.round(a - b)}s/km faster`); else if (b - a >= 10) out.push(`📉 Faded ${Math.round(b - a)}s/km in the second half — try starting a bit slower`);
    const mean = r.splits.reduce((x, y) => x + y, 0)/r.splits.length, sd = Math.sqrt(r.splits.reduce((x, y) => x + (y - mean)**2, 0)/r.splits.length); if (sd < 4) out.push(`🎯 Metronome pacing — splits within ±${Math.max(1, Math.round(sd))}s`); }
  const prev = allPRs(others); for (const k in (r.best || {})) if (!prev[k] || r.best[k] <= prev[k].t) out.push(`🏆 ${k} personal record: ${fmtTime(r.best[k])}`);
  if (r.elev >= 30 && others.every(x => (x.elev || 0) < r.elev)) out.push(`⛰️ Most climbing of any ${nm} (${r.elev} m)`);
  if (r.efforts && r.efforts.length) out.push(`⭐ ${r.efforts.length} segment effort${r.efforts.length > 1 ? 's' : ''}`);
  if (r.hr && r.hr.zones){ const z = r.hr.zones.indexOf(Math.max(...r.hr.zones)); if (z > 0) out.push(`❤️ Mostly Zone ${z} (${ZONES[z]}) · avg ${r.hr.avg} bpm`); }
  const wk = mondayOf(new Date(r.start)), w = getRuns().filter(x => x.start >= +wk && x.start <= r.start + 1);
  if (!w.some(x => x.id === r.id)) w.push(r);
  out.push(`🗓️ Activity #${w.length} this week · ${(w.reduce((a, x) => a + x.dist, 0)/1000).toFixed(1)} km total`);
  const l = runLoad(r); out.push(`💪 Relative effort ${l} — ${l > 150 ? 'massive' : l > 100 ? 'hard' : l > 50 ? 'moderate' : 'easy'}`);
  return out;
}

// ---------------- finish / save / detail hooks ----------------
function extraFinish(p){
  p.sport = curSport; p.title = (p.label && p.type !== 'free') ? p.label : autoTitle(p.start, curSport);
  if (hrSamples.length){ const z = [0,0,0,0,0,0]; hrSamples.forEach(h => z[hrZone(h)]++);
    p.hr = { avg:Math.round(hrSamples.reduce((a, b) => a + b, 0)/hrSamples.length), max:Math.max(...hrSamples), zones:z.map(c => Math.round(c/hrSamples.length*100)) }; }
  p.kcal = kcalFor(p.dist, p.time, curSport); p.efforts = matchEfforts(p.pts); p.route = followRoute ? followRoute.name : null;
}
function extraSummaryHtml(p){ return `<div class="card"><h3>✨ Insights</h3>${insights(p).map(s => `<div class="ins">${s}</div>`).join('')}</div>`; }
function extraAfterSave(p){
  if (followRoute) setFollow(null);
  // demo friends react
  const fol = DEMO.filter(d => following().includes(d.id)); if (!fol.length || !p.dist) { challengeCheck(); return; }
  const rnd = seeded(p.id), n = 1 + Math.floor(rnd()*Math.min(4, fol.length)), who = [...fol].sort(() => rnd() - .5).slice(0, n);
  who.forEach((d, i) => setTimeout(() => {
    const runs = store.get('runs', []), x = runs.find(r => (r.id || r.date) === p.id); if (!x) return;
    x.kudos = [...(x.kudos || []), d.name]; store.set('runs', runs); toast(`${d.av} ${d.name} gave you kudos 👏`);
    if (i === 0){ setTimeout(() => { const s = social(); (s.comments[p.id] = s.comments[p.id] || []).push({ who:d.name, av:d.av, text:COMMENTS[Math.floor(rnd()*COMMENTS.length)], t:Date.now() }); saveSocial(s); toast(`${d.av} ${d.name} commented on your ${SPORTS[p.sport || 'run'].name.toLowerCase()}`); }, 6000); }
  }, 4000 + i*3500));
  challengeCheck();
}
function extraDetail(r){
  const ins = insights(r), sp = r.sport || 'run';
  let h = `<div class="card"><h3>✨ Insights</h3>${ins.map(s => `<div class="ins">${s}</div>`).join('')}</div>`;
  if (r.hr) h += `<div class="card"><h3>❤️ Heart rate <small>· avg ${r.hr.avg} · max ${r.hr.max} bpm</small></h3>${[5,4,3,2,1].map(z => `<div class="split"><span style="width:96px">Z${z} ${ZONES[z]}</span><div class="bar"><i style="width:${r.hr.zones[z]}%;background:${['','#7fb3ff','#2ecc71','#f5a623','#ff7a45','#ff3b3b'][z]}"></i></div><b style="width:40px;text-align:right">${r.hr.zones[z]}%</b></div>`).join('')}</div>`;
  const segs = getSegs(), ef = (r.efforts || []).map(e => ({ e, s:segs.find(s => s.id === e.seg) })).filter(x => x.s);
  if (ef.length) h += `<div class="card"><h3>⭐ Segments</h3>${ef.map(({ e, s }) => { const rk = segBoard(s).findIndex(x => x.me) + 1, pr = myBestEffort(s.id) === e.t;
    return `<div class="lb" data-sid="${s.id}"><span>${pr ? '🏆' : '⭐'}</span><span>${esc(s.name)}</span><b>${fmtTime(e.t)} · #${rk}</b></div>`; }).join('')}</div>`;
  const cm = (social().comments[r.id] || []);
  h += `<div class="card"><h3>👏 ${(r.kudos || []).length} kudos · 💬 ${cm.length} comments</h3>${(r.kudos || []).length ? `<p class="sub" style="margin:0 0 6px">${(r.kudos || []).map(esc).join(', ')}</p>` : ''}${cm.map(c => `<div class="cmt"><b>${c.av} ${esc(c.who)}</b> ${esc(c.text)}</div>`).join('')}</div>`;
  $('dExtra').innerHTML = h;
  $('dExtra').querySelectorAll('[data-sid]').forEach(el => el.onclick = () => openSegment(getSegs().find(s => s.id === el.dataset.sid)));
  $('dMore').innerHTML = `${sp !== 'strength' ? '<button class="main sec" id="dSeg">⭐ Segment</button>' : ''}<button class="main sec" id="dGpx">⬇ GPX</button><button class="main sec" id="dRename">✏️ Rename</button>`;
  if ($('dSeg')) $('dSeg').onclick = () => createSegment(r);
  $('dGpx').onclick = () => shareOrDownload((r.title || 'activity').replace(/[^\w-]+/g, '_') + '.gpx', gpxFrom(r.title || 'Activity', r.pts, r), 'application/gpx+xml');
  $('dRename').onclick = () => { openSheet(sheetHead('Rename') + `<input id="rnIn" value="${esc(r.title || '')}" maxlength="60"><div class="row-btns" style="margin-top:12px"><button class="main" id="rnOk">Save</button></div>`);
    $('rnOk').onclick = () => { const runs = store.get('runs', []), x = runs.find(q => (q.id || q.date) === r.id); if (x){ x.title = $('rnIn').value.trim() || x.title; store.set('runs', runs); }
      closeModal('sheetModal'); r.title = x ? x.title : r.title; $('dTitle').textContent = r.title; }; };
}

// ---------------- feed ----------------
function postCard(a){
  const mine = !a.demo, who = mine ? { name:profile().name, av:profile().av } : a.who, sp = a.sport || 'run', km = a.dist/1000, s = social();
  const cm = (s.comments[a.id] || []).length + (a.commentsBase || 0), given = !!s.kudos[a.id], kc = mine ? (a.kudos || []).length : a.kudosBase + (given ? 1 : 0);
  const stat = (l, v) => `<div><small>${l}</small>${v}</div>`;
  const stats = sp === 'strength' ? stat('Time', fmtTime(a.time)) + stat('Calories', (a.kcal || kcalFor(0, a.time, sp)) + ' kcal')
    : stat('Distance', km.toFixed(2) + ' km') + stat(SPORTS[sp].speed ? 'Speed' : 'Pace', fmtRate(a.time/km, sp) + ' ' + rateUnit(sp)) + stat('Time', fmtTime(a.time)) + (a.elev ? stat('Climb', a.elev + ' m') : '');
  return `<div class="post" data-id="${esc(a.id)}"><div class="ph"><div class="av">${who.av}</div><div><b>${esc(who.name)}</b>${a.demo ? ' <span class="demo">DEMO</span>' : ''}<small>${SPORTS[sp].icon} ${relTime(a.start)}</small></div></div>
    <h4>${esc(a.title || autoTitle(a.start, sp))}</h4><div class="pstats">${stats}</div>${a.pts && a.pts.length > 1 ? svgRoute(a.pts) : ''}
    <div class="pact"><button class="kud ${given || (mine && kc) ? 'on' : ''}" data-k="${esc(a.id)}">👏 ${kc}</button><button data-c="${esc(a.id)}">💬 ${cm}</button>${mine ? `<button data-sh="${esc(a.id)}">📸 Share</button>` : ''}</div></div>`;
}
function renderFeed(){
  const fol = following(), mine = getRuns().map(r => ({ ...r, title:r.title || autoTitle(r.start, r.sport) })), demo = demoActivities().filter(a => fol.includes(a.who.id));
  const all = [...mine, ...demo].sort((a, b) => b.start - a.start).slice(0, 40), p = profile();
  const wk = mondayOf(new Date()), wkm = mine.filter(r => r.start >= +wk).reduce((a, r) => a + r.dist, 0)/1000;
  $('feedBody').innerHTML = `<div class="card me-card"><div class="av big">${p.av}</div><div style="flex:1"><b>${esc(p.name)}</b><small>This week: ${wkm.toFixed(1)} km · ${mine.filter(r => r.start >= +wk).length} activities</small></div><button class="chip" id="fdFind">👥 Find friends</button></div>
    <div class="note">Friends, kudos and comments from others are <b>demo athletes</b> for this prototype. Real friends need accounts + a server (next step).</div>
    ${all.map(postCard).join('') || '<div class="empty">Nothing yet — record an activity!</div>'}`;
  const byId = Object.fromEntries(all.map(a => [a.id, a]));
  $('fdFind').onclick = findFriends;
  $('feedBody').querySelectorAll('[data-k]').forEach(b => b.onclick = e => { e.stopPropagation(); const a = byId[b.dataset.k]; if (!a.demo) return toast('You can’t give kudos to yourself 😄');
    const s = social(); if (s.kudos[a.id]) delete s.kudos[a.id]; else { s.kudos[a.id] = 1; buzz(30); } saveSocial(s); renderFeed(); });
  $('feedBody').querySelectorAll('[data-c]').forEach(b => b.onclick = e => { e.stopPropagation(); openComments(byId[b.dataset.c]); });
  $('feedBody').querySelectorAll('[data-sh]').forEach(b => b.onclick = e => { e.stopPropagation(); shareCard(normRun(getRuns().find(r => r.id == b.dataset.sh))); });
  $('feedBody').querySelectorAll('.post').forEach(c => c.onclick = () => { const a = byId[c.dataset.id]; if (!a.demo) openDetail(getRuns().find(r => r.id == a.id)); else openDemo(a); });
}
function openComments(a){
  const draw = () => { const list = social().comments[a.id] || [];
    openSheet(sheetHead('💬 Comments') + `${a.demo && a.commentsBase ? `<p class="sub">${a.commentsBase} earlier comment${a.commentsBase > 1 ? 's' : ''} from demo friends</p>` : ''}
      ${list.map(c => `<div class="cmt"><b>${c.av} ${esc(c.who)}</b> ${esc(c.text)}</div>`).join('') || '<p class="sub">No comments yet.</p>'}
      <div class="row-btns" style="margin-top:12px"><input id="cmIn" placeholder="Add a comment…" maxlength="200" style="flex:3"><button class="main" id="cmOk" style="flex:1">Post</button></div>`);
    $('cmOk').onclick = () => { const t = $('cmIn').value.trim(); if (!t) return; const s = social(); (s.comments[a.id] = s.comments[a.id] || []).push({ who:profile().name, av:profile().av, text:t, t:Date.now() }); saveSocial(s); draw(); renderFeed(); }; };
  draw();
}
function openDemo(a){
  const km = a.dist/1000;
  openSheet(sheetHead(`${a.who.av} ${esc(a.title)}`) + `<p class="sub">${esc(a.who.name)} <span class="demo">DEMO</span> · ${relTime(a.start)}</p><div id="dmMap" class="smap"></div>
    <div class="grid3">${[['Distance', km.toFixed(2) + ' km'], [SPORTS[a.sport].speed ? 'Speed' : 'Pace', fmtRate(a.time/km, a.sport) + ' ' + rateUnit(a.sport)], ['Time', fmtTime(a.time)]].map(([l, v]) => `<div class="stat"><div class="lbl">${l}</div><div class="val" style="font-size:18px">${v}</div></div>`).join('')}</div>
    <div class="row-btns"><button class="main sec" id="dmGhost">👻 Race this as a ghost</button></div>`);
  const m = sheetLeaflet('dmMap'), pl = L.polyline(a.pts, { color:'#ff6b3d', weight:5 }).addTo(m); setTimeout(() => m.fitBounds(pl.getBounds(), { padding:[20,20] }), 100);
  $('dmGhost').onclick = () => { if (state !== 'idle') return toast('Finish your current activity first');
    let c = 0; const P = a.pts.map((p, i) => { if (i) c += hav({lat:a.pts[i-1][0],lng:a.pts[i-1][1]}, {lat:p[0],lng:p[1]}); return [p[0], p[1], 0, c, null]; });
    P.forEach(p => p[2] = p[3]/c*a.time); closeModal('sheetModal'); showView('runView'); setGhost({ dist:c, pts:P }); toast(`👻 Racing ${a.who.name}'s pace — get to their route and hit START`); };
}
function findFriends(){
  const fol = following();
  openSheet(sheetHead('👥 Find friends') + `<div class="note">These are demo athletes so you can test the social features. Real accounts need a server — say the word and I'll set one up.</div>
    ${DEMO.map(d => `<div class="lb"><span style="font-size:22px">${d.av}</span><span>${d.name}<small style="display:block;color:var(--mut)">~${fmtPace(d.pace)}/km runner</small></span><button class="chip ${fol.includes(d.id) ? 'on' : ''}" data-f="${d.id}">${fol.includes(d.id) ? 'Following' : 'Follow'}</button></div>`).join('')}`);
  $('sheetBody').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const s = social(), f = following(); const id = b.dataset.f;
    s.following = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; saveSocial(s); findFriends(); renderFeed(); });
}

// ---------------- clubs & challenges ----------------
const CLUBS = [
  { id:'city',  name:'City Runners',          icon:'🏙️', desc:'Social runs around town, every Wednesday.', members:['ingrid','magnus','sofie','emma','lars'], base:1240 },
  { id:'long',  name:'Sunday Long Run Crew',  icon:'🌲', desc:'Slow miles, good company. Every Sunday.',   members:['jonas','nora','ingrid','erik'], base:310 },
  { id:'trail', name:'Trail Goats',           icon:'🐐', desc:'Hills, mud and views.',                      members:['erik','magnus','sofie'], base:870 },
];
const clubState = () => Object.assign({ joined:[], custom:[] }, store.get('clubs', {}));
const allClubs = () => [...CLUBS, ...clubState().custom];
const ym = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}`; };
function challenges(){ const mn = new Date().toLocaleDateString('en', { month:'long' });
  return [
    { id:'dist',  icon:'🏔️', name:`${mn} 50K`,              desc:'Run 50 km this month',                  goal:50000, unit:v => (v/1000).toFixed(1) + ' km', f:rs => rs.filter(r => (r.sport || 'run') === 'run').reduce((a, r) => a + r.dist, 0) },
    { id:'climb', icon:'⛰️', name:'Climb 500',              desc:'Climb 500 m this month (any sport)',    goal:500,   unit:v => Math.round(v) + ' m',         f:rs => rs.reduce((a, r) => a + (r.elev || 0), 0) },
    { id:'half',  icon:'🥇', name:'Half Marathon Challenge', desc:'Run 21.1 km in one go this month',      goal:21097, unit:v => (v/1000).toFixed(1) + ' km', f:rs => Math.max(0, ...rs.filter(r => (r.sport || 'run') === 'run').map(r => r.dist)) },
    { id:'count', icon:'📅', name:'12 Activities',           desc:'Log 12 activities this month',          goal:12,    unit:v => v + '',                       f:rs => rs.length },
    { id:'time',  icon:'⏱️', name:'10 Hours Moving',         desc:'10 hours of any activity this month',   goal:36000, unit:v => (v/3600).toFixed(1) + ' h',   f:rs => rs.reduce((a, r) => a + r.time, 0) },
  ]; }
const monthRuns = () => { const d = new Date(), m0 = +new Date(d.getFullYear(), d.getMonth(), 1); return getRuns().filter(r => r.start >= m0); };
const joinedCh = () => store.get('challenges', {});
function challengeCheck(){
  const j = joinedCh(), rs = monthRuns(); let ch = false;
  for (const c of challenges()){ const k = c.id + ':' + ym(); if (j[k] === 1 && c.f(rs) >= c.goal){ j[k] = 2; ch = true; setTimeout(() => { toast(`${c.icon} Challenge complete: ${c.name}!`); say(`Challenge complete: ${c.name}!`); }, 1500); } }
  if (ch) store.set('challenges', j);
}
function weekKm(memberId){ const wk = +mondayOf(new Date()); return demoActivities().filter(a => a.who.id === memberId && a.start >= wk).reduce((s, a) => s + a.dist, 0)/1000; }
function renderClubs(){
  const j = joinedCh(), rs = monthRuns(), cs = clubState();
  $('clubsBody').innerHTML = `<h3 class="sec-h">Challenges 🏁 <small>· ${new Date().toLocaleDateString('en', { month:'long' })}</small></h3>
    ${challenges().map(c => { const k = c.id + ':' + ym(), v = c.f(rs), pct = Math.min(100, v/c.goal*100), st = j[k], n = 800 + Math.floor(seeded(k)()*9000);
      return `<div class="card ch"><div class="rtrow"><div class="chi">${c.icon}</div><div style="flex:1"><b>${c.name}</b><small>${c.desc} · ${n.toLocaleString()} joined</small></div>${st ? (st === 2 || v >= c.goal ? '<span class="done">✅</span>' : '') : `<button class="chip on" data-j="${k}">Join</button>`}</div>
        ${st ? `<div class="prog"><i style="width:${pct}%"></i></div><small class="sub">${c.unit(v)} / ${c.unit(c.goal)}</small>` : ''}</div>`; }).join('')}
    <h3 class="sec-h">Clubs 👥</h3>
    ${allClubs().map(c => `<div class="card club" data-club="${c.id}"><div class="rtrow"><div class="chi">${c.icon}</div><div style="flex:1"><b>${esc(c.name)}</b><small>${(c.base + (cs.joined.includes(c.id) ? 1 : 0)).toLocaleString()} members${cs.joined.includes(c.id) ? ' · <span style="color:var(--ok)">Joined</span>' : ''}</small></div><span>›</span></div></div>`).join('')}
    <div class="row-btns"><button class="main sec" id="clNew">＋ Create a club</button></div>`;
  $('clubsBody').querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const j2 = joinedCh(); j2[b.dataset.j] = 1; store.set('challenges', j2); challengeCheck(); renderClubs(); toast('🏁 Challenge joined!'); });
  $('clubsBody').querySelectorAll('[data-club]').forEach(c => c.onclick = () => openClub(allClubs().find(x => x.id === c.dataset.club)));
  $('clNew').onclick = () => { openSheet(sheetHead('Create a club') + `<label class="f">Name</label><input id="cnName" maxlength="40" placeholder="e.g. Campus Runners"><label class="f">Icon</label><input id="cnIcon" maxlength="2" value="🏃"><label class="f">Description</label><input id="cnDesc" maxlength="80" placeholder="What's the club about?"><div class="row-btns" style="margin-top:12px"><button class="main" id="cnOk">Create</button></div>`);
    $('cnOk').onclick = () => { const n = $('cnName').value.trim(); if (!n) return toast('Give it a name'); const s = clubState(), id = 'c' + Date.now();
      s.custom.push({ id, name:n, icon:$('cnIcon').value || '🏃', desc:$('cnDesc').value, members:DEMO.slice(0, 3).map(d => d.id), base:3 }); s.joined.push(id); store.set('clubs', s); closeModal('sheetModal'); renderClubs(); toast('👥 Club created'); }; };
}
function openClub(c){
  const cs = clubState(), joined = cs.joined.includes(c.id), wk = +mondayOf(new Date());
  const meKm = getRuns().filter(r => r.start >= wk).reduce((a, r) => a + r.dist, 0)/1000;
  const rows = c.members.map(id => { const d = DEMO.find(x => x.id === id); return { av:d.av, name:d.name, km:weekKm(id), demo:true }; });
  if (joined) rows.push({ av:profile().av, name:profile().name + ' (you)', km:meKm, me:true }); rows.sort((a, b) => b.km - a.km);
  const acts = demoActivities().filter(a => c.members.includes(a.who.id)).sort((a, b) => b.start - a.start).slice(0, 5);
  openSheet(sheetHead(`${c.icon} ${esc(c.name)}`) + `<p class="sub">${esc(c.desc || '')}</p>
    <div class="row-btns" style="margin-bottom:12px"><button class="main ${joined ? 'sec' : ''}" id="clJoin">${joined ? 'Leave club' : 'Join club'}</button></div>
    <div class="card"><h3>This week's leaderboard <span class="demo">DEMO</span></h3>${rows.map((r, i) => `<div class="lb ${r.me ? 'me' : ''}"><span>${i + 1}</span><span>${r.av} ${esc(r.name)}</span><b>${r.km.toFixed(1)} km</b></div>`).join('')}</div>
    <div class="card"><h3>Recent activity</h3>${acts.map(a => `<div class="lb"><span>${a.who.av}</span><span>${esc(a.who.name)}<small style="display:block;color:var(--mut)">${esc(a.title)} · ${relTime(a.start)}</small></span><b>${(a.dist/1000).toFixed(1)} km</b></div>`).join('') || '<p class="sub">Quiet week.</p>'}</div>`);
  $('clJoin').onclick = () => { const s = clubState(); s.joined = joined ? s.joined.filter(x => x !== c.id) : [...s.joined, c.id]; store.set('clubs', s); openClub(c); renderClubs(); };
}

// ---------------- strength workouts ----------------
const ROUTINES = [
  { id:'core', name:"Runner's Core", icon:'🧱', rest:15, items:[['Plank',40,'Straight line from head to heels'],['Dead bug',40,'Slow, opposite arm and leg'],['Side plank — left',30,'Hips high'],['Side plank — right',30,'Hips high'],['Glute bridge',40,'Squeeze at the top'],['Bird dog',40,'Keep hips level'],['Hollow hold',30,'Lower back pressed to the floor']] },
  { id:'legs', name:'Leg Strength', icon:'🦵', rest:20, items:[['Bodyweight squats',45,'Sit back, chest up'],['Reverse lunges',45,'Alternate legs'],['Calf raises — left leg',30,'Slow on the way down'],['Calf raises — right leg',30,'Slow on the way down'],['Wall sit',40,'Thighs parallel to the floor'],['Step-ups',45,'Use a sturdy step or bench'],['Single-leg deadlift',45,'Alternate legs, hinge at the hips']] },
  { id:'mob',  name:'Post-run Mobility', icon:'🧘', rest:8, items:[['Hip flexor stretch — left',40,'Tuck the pelvis'],['Hip flexor stretch — right',40,'Tuck the pelvis'],['Hamstring stretch',45,'Soft knees, reach forward'],['Calf stretch against wall',40,'Heel down'],['Pigeon pose — left',40,'Breathe into the hip'],['Pigeon pose — right',40,'Breathe into the hip'],["Child's pose",45,'Relax the shoulders']] },
];
function renderStrength(){
  $('panelStrength').innerHTML = `<p class="sub">Guided sessions with a voice coach. Strength work 2× a week makes you faster and less injury-prone.</p>
    ${ROUTINES.map((r, i) => { const t = r.items.reduce((a, x) => a + x[1], 0) + r.rest*(r.items.length - 1);
      return `<div class="card"><div class="rtrow"><div class="chi">${r.icon}</div><div style="flex:1"><b>${r.name}</b><small>${r.items.length} exercises · ~${Math.round(t/60)} min</small></div><button class="chip on" data-st="${i}">▶ Start</button></div>
        <p class="sub" style="margin:8px 0 0">${r.items.map(x => x[0]).join(' · ')}</p></div>`; }).join('')}`;
  $('panelStrength').querySelectorAll('[data-st]').forEach(b => b.onclick = () => playRoutine(ROUTINES[+b.dataset.st]));
}
let stTimer = null;
function playRoutine(R){
  const steps = [{ name:'Get ready', s:5, rest:true, tip:R.items[0][0] + ' first' }];
  R.items.forEach((x, i) => { steps.push({ name:x[0], s:x[1], tip:x[2] }); if (i < R.items.length - 1) steps.push({ name:'Rest', s:R.rest, rest:true, tip:'Next: ' + R.items[i+1][0] }); });
  let i = 0, left = steps[0].s, paused = false, t0 = Date.now(), active = 0, last = Date.now();
  try{ speechSynthesis.speak(new SpeechSynthesisUtterance('')); }catch{}
  openSheet(sheetHead(`${R.icon} ${R.name}`) + `<div class="player"><div id="plName" class="pln"></div><div id="plTime" class="plt"></div><div id="plTip" class="sub"></div><div class="prog"><i id="plProg"></i></div></div>
    <div class="row-btns"><button class="main sec" id="plPause">⏸ Pause</button><button class="main sec" id="plSkip">⏭ Skip</button></div><div class="row-btns"><button class="main" id="plEnd">Finish & save</button></div>`);
  const show = () => { const st = steps[i]; $('plName').textContent = st.name; $('plName').style.color = st.rest ? 'var(--mut)' : 'var(--txt)'; $('plTime').textContent = Math.ceil(left); $('plTip').textContent = st.tip || ''; $('plProg').style.width = (i/(steps.length-1)*100) + '%'; };
  const next = () => { i++; if (i >= steps.length) return done(true); left = steps[i].s; const st = steps[i]; buzz(st.rest ? [100] : [300]); say(st.rest ? (st.tip || 'Rest') : `${st.name}. ${st.s} seconds. Go!`); show(); };
  const done = complete => { clearInterval(stTimer); stTimer = null; const time = Math.round(active);
    if (time < 20){ closeModal('sheetModal'); return; }
    const run = normRun({ id:Date.now(), date:Date.now(), start:t0, dist:0, time, kcal:kcalFor(0, time, 'strength'), elev:0, splits:[], best:{}, pts:[], type:'free', sport:'strength', title:R.name, completed:complete });
    const runs = store.get('runs', []); runs.unshift(run); store.set('runs', runs); say(complete ? 'Workout complete. Great job!' : 'Workout saved.');
    closeModal('sheetModal'); toast(`🏋️ ${R.name} saved`); renderYou(); };
  say(`${R.name}. Get ready. ${R.items[0][0]} first.`); show();
  clearInterval(stTimer);
  stTimer = setInterval(() => { const now = Date.now(), dt = (now - last)/1000; last = now; if (paused) return; if (!steps[i].rest) active += dt; left -= dt;
    if (left <= 3.05 && left > 2.55 && !steps[i].rest) buzz(50); if (left <= 0) next(); else show(); }, 250);
  $('plPause').onclick = () => { paused = !paused; $('plPause').textContent = paused ? '▶ Resume' : '⏸ Pause'; };
  $('plSkip').onclick = next; $('plEnd').onclick = () => done(i >= steps.length - 2);
  $('sheetBody').querySelector('[data-close]').onclick = () => { clearInterval(stTimer); closeModal('sheetModal'); };
}

// ---------------- beacon ----------------
function beacon(){
  const p = myPos(), url = `https://www.openstreetmap.org/?mlat=${p[0].toFixed(5)}&mlon=${p[1].toFixed(5)}#map=16/${p[0].toFixed(5)}/${p[1].toFixed(5)}`;
  const msg = `${sportDef().icon} I'm out for a ${sportDef().name.toLowerCase()} (started ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}). My location: ${url}`;
  openSheet(sheetHead('📡 Safety beacon') + `<p class="sub">Send someone your location before or during your activity.</p>
    <div class="note">Prototype: this shares your location <b>once</b>. A live-updating beacon needs a server — that comes with accounts.</div>
    <div class="card" style="font-size:13px;word-break:break-all">${esc(msg)}</div>
    <div class="row-btns"><button class="main" id="bcSend">📤 Share location</button><button class="main sec" id="bcCopy">Copy</button></div>`);
  $('bcSend').onclick = async () => { try{ if (navigator.share){ await navigator.share({ text:msg }); return; } }catch(e){ if (e.name === 'AbortError') return; } $('bcCopy').click(); };
  $('bcCopy').onclick = async () => { try{ await navigator.clipboard.writeText(msg); toast('Copied — paste it in a message'); }catch{ toast('Copy failed — long-press the text to copy'); } };
}

// ---------------- chips (sport, HR, beacon, route) ----------------
function extraChipsHtml(){
  let h = `<button class="chip" data-x="sport">${sportDef().icon} ${sportDef().name} ▾</button>`;
  if (navigator.bluetooth) h += `<button class="chip ${hrDev ? 'on' : ''}" data-x="hr">❤️ ${hrDev ? (liveHr() || '…') : 'HR strap'}</button>`;
  if (followRoute) h += `<button class="chip on" data-x="route">🗺️ ${esc(followRoute.name)} ✕</button>`;
  h += `<button class="chip" data-x="beacon">📡 Beacon</button>`;
  return h;
}
function bindExtraChips(c){
  c.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    const x = b.dataset.x;
    if (x === 'beacon') return beacon();
    if (x === 'hr') return hrDev ? toast(`❤️ ${hrDev.name || 'Strap'} connected`) : connectHr();
    if (state !== 'idle') return toast('Finish your activity to change this');
    if (x === 'route') return setFollow(null);
    if (x === 'sport') openSheet(sheetHead('Choose sport') + ['run','ride','walk','hike'].map(s => `<button class="opt" data-sp="${s}">${SPORTS[s].icon} <b>${SPORTS[s].name}</b></button>`).join('')
      + `<button class="opt" data-sp="strength">🏋️ <b>Strength workout</b><small>Guided sessions in You → Strength</small></button>`),
      $('sheetBody').querySelectorAll('[data-sp]').forEach(o => o.onclick = () => { closeModal('sheetModal'); if (o.dataset.sp === 'strength'){ showView('youView'); showPanel('panelStrength'); return; } setSport(o.dataset.sp); });
  });
}

// ---------------- You view ----------------
let youPanel = 'panelHistory';
function renderYou(){
  const p = profile(), runs = getRuns(), km = runs.reduce((a, r) => a + r.dist, 0)/1000;
  $('youHead').innerHTML = `<div class="av big">${p.av}</div><div style="flex:1"><b style="font-size:19px">${esc(p.name)}</b><small>${following().length} following · ${runs.length} activities · ${km.toFixed(0)} km</small></div><button class="chip" id="youEdit">Edit</button>`;
  $('youEdit').onclick = editProfile;
  showPanel(youPanel);
}
function showPanel(id){
  youPanel = id;
  document.querySelectorAll('.panel').forEach(p => p.style.display = p.id === id ? 'block' : 'none');
  document.querySelectorAll('#youTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === id));
  if (id === 'panelHistory') renderHistory();
  if (id === 'panelStats') renderStats();
  if (id === 'panelFitness') renderFitness();
  if (id === 'panelPlan') renderPlan();
  if (id === 'panelStrength') renderStrength();
}
function editProfile(){
  const p = profile(), avs = ['🏃','🏃‍♀️','🦊','🐺','🦋','🐻','🐬','🦅','🐱','🦌','🐯','🐼','🦄','🐸','🐙','🔥'];
  openSheet(sheetHead('Edit profile') + `<label class="f">Name</label><input id="pfName" value="${esc(p.name)}" maxlength="30"><label class="f">Avatar</label><div class="avs">${avs.map(a => `<button class="${a === p.av ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div><div class="row-btns" style="margin-top:12px"><button class="main" id="pfOk">Save</button></div>`);
  let av = p.av; $('sheetBody').querySelectorAll('[data-av]').forEach(b => b.onclick = () => { av = b.dataset.av; $('sheetBody').querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b)); });
  $('pfOk').onclick = () => { store.set('profile', { name:$('pfName').value.trim() || 'You', av }); closeModal('sheetModal'); renderYou(); };
}

// ---------------- backup ----------------
const BACKUP_KEYS = ['runs','segments','routes','settings','plan','profile','social','clubs','challenges','sport'];
function exportBackup(){ const o = { app:'pace', v:1, at:new Date().toISOString() }; BACKUP_KEYS.forEach(k => o[k] = store.get(k, null));
  shareOrDownload(`pace-backup-${dayKey(new Date())}.json`, JSON.stringify(o), 'application/json'); }
function importBackup(){ pickFile('.json,application/json', txt => { try{ const o = JSON.parse(txt); if (o.app !== 'pace') throw 0;
  BACKUP_KEYS.forEach(k => { if (o[k] != null) store.set(k, o[k]); }); toast('✅ Backup restored'); setTimeout(() => location.reload(), 800); }catch{ toast('That is not a Pace backup file'); } }); }

// ---------------- boot ----------------
function extraBoot(){
  document.body.dataset.state = 'idle';
  curSport = store.get('sport', 'run'); if (!SPORTS[curSport] || curSport === 'strength') curSport = 'run';
  setSport(curSport);
  document.querySelectorAll('#youTabs button').forEach(b => b.onclick = () => showPanel(b.dataset.p));
  $('sHr').onclick = connectHr; $('sExport').onclick = exportBackup; $('sImport').onclick = importBackup;
  if (!navigator.bluetooth) $('sHrNote').textContent = 'Heart-rate straps work in Chrome on Android. iPhone browsers don’t support Bluetooth.';
  setInterval(() => { if (hrDev) { const c = document.querySelector('[data-x=hr]'); if (c) c.textContent = `❤️ ${liveHr() || '…'}`; } }, 2000);
}
