import * as THREE from 'three';

const OB = window.ATLAS_DATA, DIET = window.DIET_DATA, CAN = window.CANCER_DATA, CEN = window.ISO_CENTROIDS;
const DEG = Math.PI / 180, R = 1;
const ACCENT = 0x8DB0E4, HI = 0xF7F8FA, WARM = 0xD98A6E, COOL = 0x6FB1E0;
const REGION_COLORS = { 'African': 0xE0A24A, 'Americas': 0x6FB1E0, 'Eastern Mediterranean': 0xD98A6E, 'European': 0x9B8DE4, 'South-East Asia': 0x6FC8A3, 'Western Pacific': 0xE0728F };
const regionColor = r => REGION_COLORS[r] != null ? REGION_COLORS[r] : 0x9C9B91;
function llToV3(lon, lat, r = R) { const phi = (90 - lat) * DEG, theta = (lon + 180) * DEG; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const ext = (a, k) => a.reduce((o, d) => ({ min: Math.min(o.min, d[k]), max: Math.max(o.max, d[k]) }), { min: Infinity, max: -Infinity });
const remap = (v, r, a, b) => a + (v - r.min) / ((r.max - r.min) || 1) * (b - a);

// ---- renderer / scene / camera ----
const canvas = document.getElementById('space');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x0D0D0C, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0D0D0C, 0.03);   // far worlds fade into space (declutter)
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 760);
camera.position.set(0, 0.3, 3.3);
scene.add(new THREE.AmbientLight(0xffffff, 0.34));
const sun = new THREE.DirectionalLight(0xffffff, 1.45); sun.position.set(5, 2.5, 4); scene.add(sun);

(function stars() {
  const n = 5000, pos = new Float32Array(n * 3); let s = 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, t = rnd() * 6.2832, q = Math.sqrt(1 - u * u), r = 30 + rnd() * 200; pos[i * 3] = r * q * Math.cos(t); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * q * Math.sin(t); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false })));
})();

function makeLabel(text, { size = 0.3, color = '#ECEBE4' } = {}) {
  const fs = 110, pad = 16, c = document.createElement('canvas'), ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  function draw(t) {
    ctx.font = `700 ${fs}px JetBrains Mono, monospace`; c.width = Math.ceil(ctx.measureText(t).width) + pad * 2; c.height = fs + pad * 2;
    ctx.font = `700 ${fs}px JetBrains Mono, monospace`; ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(t, pad, c.height / 2);
    tex.needsUpdate = true; spr.scale.set(size * c.width / c.height, size, 1);
  }
  draw(text); spr.userData.kind = 'label'; spr.userData.set = draw; return spr;
}
const hiMat = new THREE.MeshBasicMaterial({ color: HI });

// ---- info panel ----
const panel = document.getElementById('panel'), pName = document.getElementById('p-name'), pRegion = document.getElementById('p-region'), pVal = document.getElementById('p-val');
const sparkCanvas = document.getElementById('p-spark'), sctx = sparkCanvas.getContext('2d');
function drawSpark(series, hiIdx, color) {
  const W = sparkCanvas.width, H = sparkCanvas.height, n = series.length, pad = 4;
  sctx.clearRect(0, 0, W, H); if (!series || n < 2) return;
  const mx = Math.max.apply(null, series), mn = Math.min.apply(null, series.concat(0));
  const X = i => pad + (i / (n - 1)) * (W - pad * 2), Y = v => H - pad - ((v - mn) / ((mx - mn) || 1)) * (H - pad * 2);
  sctx.strokeStyle = '#6E6D64'; sctx.lineWidth = 1; sctx.beginPath(); sctx.moveTo(X(0), Y(series[0])); sctx.lineTo(X(n - 1), Y(series[0])); sctx.stroke();
  sctx.strokeStyle = color || '#8DB0E4'; sctx.lineWidth = 1.6; sctx.beginPath();
  for (let i = 0; i < n; i++) { const x = X(i), y = Y(series[i]); i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); } sctx.stroke();
  sctx.fillStyle = '#ECEBE4'; sctx.beginPath(); sctx.arc(X(clamp(hiIdx, 0, n - 1)), Y(series[clamp(hiIdx, 0, n - 1)]), 2.6, 0, 7); sctx.fill();
}
function showInfo(o) {
  if (!o) { panel.classList.remove('show'); return; }
  pName.textContent = o.name; pRegion.textContent = o.sub || ''; pVal.innerHTML = o.valHTML || '';
  if (o.series) drawSpark(o.series, o.hiIdx == null ? o.series.length - 1 : o.hiIdx, o.color); else sctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
  panel.classList.add('show');
}

// ---- shared state ----
let tNorm = 1, pop = 'adol', csex = 'both', lag = 0;
let introActive = false, introStart = 0; const introFrom = new THREE.Vector3(0.6, 3.0, 12);
const obIdx = () => Math.round(tNorm * (OB.layers[pop].years.length - 1));
const dietIdx = () => Math.round(tNorm * (DIET.yearsF.length - 1));
const canIdx = () => Math.round(tNorm * (CAN.years.length - 1));
const prevMaxCache = {};
function obPrevMax(d) { if (prevMaxCache[d]) return prevMaxCache[d]; let m = 0; for (const k in OB.countries) { const r = OB.countries[k][d]; if (r) for (const v of r.series) if (v > m) m = v; } return prevMaxCache[d] = m; }

function countryTip(iso, idx) {
  const c = OB.countries[iso], r = c[pop];
  return { name: c.name, sub: c.region, valHTML: r ? r.series[idx].toFixed(1) + '%<small> &nbsp;' + OB.layers[pop].years[idx] + '</small>' : 'no estimate', series: r ? r.series : null, hiIdx: idx };
}

// ====================================================================
// 1. EARTH
// ====================================================================
const globePivot = new THREE.Group(); scene.add(globePivot);
const globe = new THREE.Group(); globePivot.add(globe);
const loader = document.getElementById('loader');
sun.position.set(2.6, 2, 6);   // light the camera-facing (day) side
function finishEarth() { loader.classList.add('gone'); introActive = true; introStart = performance.now(); try { scrollTo(0, 0); } catch (e) {} }
new THREE.TextureLoader().load('assets/textures/earth.jpg', dayTex => {
  dayTex.colorSpace = THREE.SRGBColorSpace; dayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), new THREE.MeshStandardMaterial({ map: dayTex, roughness: 1, metalness: 0 })));
  finishEarth();
}, ev => { if (ev.lengthComputable) { const el = document.getElementById('loader-txt'); if (el) el.textContent = 'loading earth ' + Math.round(ev.loaded / ev.total * 100) + '%'; } });
globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 64, 64), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.07, side: THREE.BackSide })));
const spikeMat = new THREE.MeshBasicMaterial({ color: ACCENT });
const spikeGeo = new THREE.CylinderGeometry(0.0032, 0.0062, 1, 5); spikeGeo.translate(0, 0.5, 0);
const spikes = []; const spikeGroup = new THREE.Group(); globe.add(spikeGroup);
for (const iso in OB.countries) {
  const c = OB.countries[iso], cen = CEN[iso]; if (!cen || (!c.adol && !c.adult)) continue;
  const base = llToV3(cen[0], cen[1], R), m = new THREE.Mesh(spikeGeo, spikeMat);
  m.position.copy(base); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.clone().normalize());
  m.scale.y = 0.02; m.userData = { iso, cur: 0.02, target: 0.02, mat0: spikeMat, tip: () => countryTip(iso, obIdx()) };
  spikeGroup.add(m); spikes.push(m);
}
// hottest-country live highlight (the leader changes as the years play)
const spikeHotMat = new THREE.MeshBasicMaterial({ color: WARM });
const hotMarker = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), new THREE.MeshBasicMaterial({ color: 0xE8743B })); hotMarker.visible = false; globe.add(hotMarker);
const hotLabel = makeLabel(' ', { size: 0.075, color: '#E8743B' }); hotLabel.visible = false; globe.add(hotLabel);
let hotSpike = null, hotIso = null;
function refreshSpikes() {
  const kH = 0.34 / obPrevMax(pop), idx = obIdx(); let maxV = -1, maxM = null, maxIso = null;
  for (const m of spikes) { const r = OB.countries[m.userData.iso][pop]; if (!r) { m.visible = false; continue; } m.visible = true; m.userData.target = Math.max(0.015, r.series[idx] * kH); if (r.series[idx] > maxV) { maxV = r.series[idx]; maxM = m; maxIso = m.userData.iso; } }
  if (maxM) { if (hotSpike && hotSpike !== maxM) hotSpike.material = spikeMat; hotSpike = maxM; hotSpike.material = spikeHotMat; hotIso = maxIso; hotMarker.visible = hotLabel.visible = true; hotLabel.userData.set('highest  ' + OB.countries[maxIso].name + ' ' + maxV.toFixed(0) + '%'); }
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 48), new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 1 })); moon.position.set(3.4, 1.9, -7); scene.add(moon);

// ====================================================================
// 2. SCATTER (burden x velocity) - stable, pin-select
// ====================================================================
const SCATTER = new THREE.Vector3(0, 0, -22);
const scatterGroup = new THREE.Group(); scatterGroup.position.copy(SCATTER); scene.add(scatterGroup);
const scatterSpin = new THREE.Group(); scatterGroup.add(scatterSpin);
const ptGeo = new THREE.SphereGeometry(0.06, 16, 16);
const regionMatCache = {}; const regionMat = r => regionMatCache[r] || (regionMatCache[r] = new THREE.MeshBasicMaterial({ color: regionColor(r) }));
let scatterPoints = [];
function buildScatter() {
  while (scatterSpin.children.length) scatterSpin.remove(scatterSpin.children[0]);
  scatterPoints = []; const recs = [];
  for (const iso in OB.countries) { const c = OB.countries[iso], r = c[pop]; if (!r || r.aapc == null) continue; recs.push({ iso, base: r.series[0], end: r.series[r.series.length - 1], aapc: r.aapc, region: c.region }); }
  const xR = ext(recs, 'base'), yR = ext(recs, 'aapc'), zR = ext(recs, 'end');
  for (const d of recs) {
    const mat = regionMat(d.region), m = new THREE.Mesh(ptGeo, mat);
    m.position.set(remap(d.base, xR, -3.4, 3.4), remap(d.aapc, yR, -2.6, 2.6), remap(d.end, zR, -3.4, 3.4));
    m.scale.setScalar(0.5 + (d.end / (zR.max || 1)) * 1.0);
    m.userData = { iso: d.iso, mat0: mat, tip: () => countryTip(d.iso, OB.layers[pop].years.length - 1) };
    scatterSpin.add(m); scatterPoints.push(m);
  }
  const ax = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.7, -3, -3.7), new THREE.Vector3(3.7, -3, -3.7), new THREE.Vector3(-3.7, -3, -3.7), new THREE.Vector3(-3.7, 3, -3.7), new THREE.Vector3(-3.7, -3, -3.7), new THREE.Vector3(-3.7, -3, 3.7)]), new THREE.LineBasicMaterial({ color: 0x2A2924 }));
  scatterSpin.add(ax);
  const lx = makeLabel('burden', { size: 0.42, color: '#6E6D64' }); lx.position.set(2.6, -3.4, -3.7); scatterSpin.add(lx);
  const ly = makeLabel('rising fast', { size: 0.42, color: '#6E6D64' }); ly.position.set(-4.4, 2.6, -3.7); scatterSpin.add(ly);
}

// ---- generic bar row ----
const barGeo = new THREE.BoxGeometry(0.46, 1, 0.46); barGeo.translate(0, 0.5, 0);
function barRow(spin, items, spacing) {
  while (spin.children.length) spin.remove(spin.children[0]);
  const out = [];
  items.forEach((it, i) => {
    const x = (i - (items.length - 1) / 2) * (spacing || 0.92);
    const mat = new THREE.MeshStandardMaterial({ color: it.color || ACCENT, roughness: 0.7 });
    const m = new THREE.Mesh(barGeo, mat); m.position.set(x, 0, 0); m.scale.y = 0.02;
    m.userData = { cur: 0.02, target: 0.02, mat0: mat, tip: it.tip }; spin.add(m); out.push(m);
    const lab = makeLabel(it.label, { size: 0.3, color: '#9C9B91' }); lab.position.set(x, -0.5, 0); spin.add(lab);
  });
  return out;
}

// ====================================================================
// 3. INCIDENCE SURFACE (age x year terrain - the early-onset shift)
// ====================================================================
const RANK = new THREE.Vector3(9, -0.5, -44);
const rankGroup = new THREE.Group(); rankGroup.position.copy(RANK); scene.add(rankGroup);
const rankSpin = new THREE.Group(); rankGroup.add(rankSpin);
function surfHeightColor(t, out) { const cCool = new THREE.Color(0x244b78), cMid = new THREE.Color(0x6FB1E0), cWarm = new THREE.Color(0xD98A6E), cHot = new THREE.Color(0xE8743B); if (t < 0.45) out.lerpColors(cCool, cMid, t / 0.45); else if (t < 0.8) out.lerpColors(cMid, cWarm, (t - 0.45) / 0.35); else out.lerpColors(cWarm, cHot, (t - 0.8) / 0.2); return out; }
function buildSurface() {
  const segX = 60, segZ = 48, W = 6.6, D = 5.4;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), heights = new Float32Array(pos.count); let maxH = 0;
  for (let i = 0; i < pos.count; i++) {
    const age = pos.getX(i) / W + 0.5, yr = pos.getZ(i) / D + 0.5;   // 0..1
    const old = 1.0 * Math.exp(-(((age - 0.74) / 0.15) ** 2));
    const young = (0.12 + 1.1 * yr * yr) * Math.exp(-(((age - 0.32) / 0.11) ** 2));   // early-onset ridge grows with year
    const h = old + young; heights[i] = h; if (h > maxH) maxH = h;
  }
  const hs = 2.1 / maxH, col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const h = heights[i] * hs; pos.setY(i, h); surfHeightColor(clamp(h / 2.1, 0, 1), col); colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
  rankSpin.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04, side: THREE.DoubleSide })));
  rankSpin.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0D0D0C, wireframe: true, transparent: true, opacity: 0.14 })));
  const la = makeLabel('age  20 → 80', { size: 0.3, color: '#9C9B91' }); la.position.set(0, 0.05, D / 2 + 0.45); rankSpin.add(la);
  const ly = makeLabel('1990 → 2024', { size: 0.3, color: '#9C9B91' }); ly.position.set(W / 2 + 0.9, 0.05, 0); rankSpin.add(ly);
  const t1 = makeLabel('later onset', { size: 0.26, color: '#D98A6E' }); t1.position.set(W * 0.24, 2.4, -D / 2 + 0.2); rankSpin.add(t1);
  const t2 = makeLabel('early onset, rising', { size: 0.26, color: '#E8743B' }); t2.position.set(-W * 0.18, 2.5, D / 2 - 0.4); rankSpin.add(t2);
}

// ====================================================================
// 4. DIET (13 risk/protective factors)
// ====================================================================
const DIETP = new THREE.Vector3(-9, 1.5, -66);
const dietGroup = new THREE.Group(); dietGroup.position.copy(DIETP); scene.add(dietGroup);
const dietSpin = new THREE.Group(); dietGroup.add(dietSpin);
const dietFactors = DIET.factors;
const dietGlobalMax = Math.max.apply(null, dietFactors.flatMap(f => f.series.filter(v => v != null)));
const DIET_SHORT = { 'Fruits': 'Fruit', 'Non-starchy vegetables': 'Veg', 'Beans and legumes': 'Beans', 'Nuts and seeds': 'Nuts', 'Refined grains': 'Refined', 'Whole grains': 'Whole', 'Processed meats': 'Proc.meat', 'Unprocessed red meats': 'Red meat', 'Seafoods': 'Fish', 'Sugar-sweetened beverages': 'Sweet drinks', 'Fruit juices': 'Juice', 'Dietary fiber': 'Fiber', 'Milk': 'Milk' };
const foodGeo = new THREE.SphereGeometry(0.32, 22, 22);
let dietFoods = [], dietScore = null;
function buildDiet() {
  while (dietSpin.children.length) dietSpin.remove(dietSpin.children[0]);
  dietFoods = [];
  const prot = dietFactors.filter(f => f.role === 'Protective'), risk = dietFactors.filter(f => f.role !== 'Protective');
  function cluster(list, cx) {
    list.forEach((f, i) => {
      const a = i / list.length * Math.PI * 2, r = 1.8, col = f.role === 'Protective' ? COOL : WARM;
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, emissive: f.role === 'Protective' ? 0x0a1016 : 0x1a0d08 });
      const m = new THREE.Mesh(foodGeo, mat);
      m.position.set(cx + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a * 1.7) * 0.5);
      m.userData = { f, cur: 0.4, target: 0.4, mat0: mat, tip: () => ({ name: f.label, sub: f.role + ' food', valHTML: (f.series[dietIdx()] || 0).toFixed(1) + '<small> g/day &nbsp;' + DIET.yearsF[dietIdx()] + '</small>', series: f.series, hiIdx: dietIdx(), color: f.role === 'Risk' ? '#D98A6E' : '#6FB1E0' }) };
      dietSpin.add(m); dietFoods.push(m);
      const lab = makeLabel(DIET_SHORT[f.label] || f.label.slice(0, 7), { size: 0.22, color: '#9C9B91' });
      lab.position.set(m.position.x, m.position.y + 0.52, m.position.z); dietSpin.add(lab);
    });
  }
  cluster(prot, -3.6); cluster(risk, 3.6);
  const pl = makeLabel('protective', { size: 0.34, color: '#6FB1E0' }); pl.position.set(-3.6, 3.1, 0); dietSpin.add(pl);
  const rl = makeLabel('risk', { size: 0.34, color: '#D98A6E' }); rl.position.set(3.6, 3.1, 0); dietSpin.add(rl);
  dietScore = makeLabel('39', { size: 1.15, color: '#ECEBE4' }); dietScore.position.set(0, 0.28, 0); dietSpin.add(dietScore);
  const ss = makeLabel('diet quality / 100', { size: 0.2, color: '#9C9B91' }); ss.position.set(0, -0.55, 0); dietSpin.add(ss);
  refreshDiet();
}
function refreshDiet() {
  const idx = dietIdx();
  for (const m of dietFoods) { const v = m.userData.f.series[idx] || 0; m.userData.target = 0.3 + Math.sqrt(v / dietGlobalMax) * 1.4; }
  if (dietScore) { const ai = Math.round(tNorm * (DIET.aheiYearly.series.length - 1)); dietScore.userData.set(DIET.aheiYearly.series[ai].toFixed(0)); }
}

// ====================================================================
// 5. CANCER (13 obesity-related cancers, sex toggle) - the disease world
// ====================================================================
const CANP = new THREE.Vector3(6, -1, -88);
const cancerGroup = new THREE.Group(); cancerGroup.position.copy(CANP); scene.add(cancerGroup);
const cancerSpin = new THREE.Group(); cancerGroup.add(cancerSpin);
const cancers = CAN.causes.filter(c => c.cause !== 'Neoplasms').slice().sort((a, b) => b.both[b.both.length - 1] - a.both[a.both.length - 1]);
const cancerMax = Math.max.apply(null, cancers.flatMap(c => c.both.concat(c.male, c.female)));
const CW = 9, CH = 4.6, cyN = CAN.years.length;
const cX = i => -CW / 2 + (i / (cyN - 1)) * CW, cY = v => -CH / 2 + (Math.sqrt(Math.max(0, v)) / Math.sqrt(cancerMax)) * CH;
const CSHORT = { 'Colon and rectum cancer': 'Colorectal', 'Liver cancer due to NASH': 'Liver (NASH)', 'Multiple myeloma': 'Myeloma', 'Gallbladder and biliary tract cancer': 'Gallbladder' };
let cancerLines = [], cancerCursor = null;
function buildCancer() {
  while (cancerSpin.children.length) cancerSpin.remove(cancerSpin.children[0]);
  cancerLines = [];
  const items = [];
  cancers.forEach(c => {
    const rising = c.both[c.both.length - 1] >= c.both[0];
    const pts = c[csex].map((v, i) => new THREE.Vector3(cX(i), cY(v), 0));
    const mat = new THREE.MeshBasicMaterial({ color: rising ? WARM : COOL });
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 6, false), mat);
    m.userData = { c, mat0: mat, tip: () => ({ name: c.cause, sub: 'incidence /100k, ' + csex, valHTML: c[csex][canIdx()].toFixed(1) + '<small> &nbsp;' + CAN.years[canIdx()] + '</small>', series: c[csex], hiIdx: canIdx(), color: rising ? '#D98A6E' : '#6FB1E0' }) };
    cancerSpin.add(m); cancerLines.push(m);
    const lab = makeLabel(CSHORT[c.cause] || c.cause.replace(/ cancer| due.*/i, ''), { size: 0.19, color: rising ? '#D98A6E' : '#6FB1E0' });
    items.push({ lab, endY: cY(c[csex][cyN - 1]), y: cY(c[csex][cyN - 1]) });
  });
  // de-collide labels vertically, then add leader lines
  items.sort((a, b) => a.y - b.y);
  const gap = 0.32;
  for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
  const over = items[items.length - 1].y - (CH / 2 + 0.3); if (over > 0) items.forEach(it => it.y -= over);
  const leaders = [];
  items.forEach(it => { it.lab.position.set(cX(cyN - 1) + 0.95, it.y, 0); cancerSpin.add(it.lab); leaders.push(new THREE.Vector3(cX(cyN - 1), it.endY, 0), new THREE.Vector3(cX(cyN - 1) + 0.8, it.y, 0)); });
  cancerSpin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(leaders), new THREE.LineBasicMaterial({ color: 0x3A3934 })));
  cancerSpin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cX(0), cY(0), 0), new THREE.Vector3(cX(cyN - 1), cY(0), 0), new THREE.Vector3(cX(0), cY(0), 0), new THREE.Vector3(cX(0), CH / 2, 0)]), new THREE.LineBasicMaterial({ color: 0x2A2924 })));
  cancerCursor = new THREE.Mesh(new THREE.PlaneGeometry(0.025, CH), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })); cancerSpin.add(cancerCursor);
  const y0 = makeLabel('1990', { size: 0.22, color: '#6E6D64' }); y0.position.set(cX(0), cY(0) - 0.45, 0); cancerSpin.add(y0);
  const y1 = makeLabel('2021', { size: 0.22, color: '#6E6D64' }); y1.position.set(cX(cyN - 1), cY(0) - 0.45, 0); cancerSpin.add(y1);
  refreshCancer();
}
function refreshCancer() { if (cancerCursor) cancerCursor.position.set(cX(canIdx()), 0, 0); }

// ====================================================================
// chart-plane helper (for lag + forecast)
// ====================================================================
function chartPlane(w, h, pos) {
  const DPR = 2.0, pxw = 1100, pxh = Math.round(pxw * h / w), cv = document.createElement('canvas'); cv.width = pxw * DPR; cv.height = pxh * DPR;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
  return { cv, ctx: cv.getContext('2d'), tex, group: g, lw: pxw, lh: pxh, dpr: DPR };
}
function panelBg(ctx, W, H) { ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(18,18,16,0.92)'; ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 2; roundRect(ctx, 4, 4, W - 8, H - 8, 18); ctx.fill(); ctx.stroke(); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const pearson = (a, b) => { const n = Math.min(a.length, b.length); let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; } const num = n * sab - sa * sb, den = Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)); return den ? num / den : 0; };

// ====================================================================
// 6. LAG (obesity -> cancer)
// ====================================================================
const LAGP = new THREE.Vector3(-8, 2.5, -108);
const lagPlane = chartPlane(6.4, 3.8, LAGP);
const cancerTotal = (CAN.causes.find(c => c.cause === 'Neoplasms') || cancers[0]);
function drawLag() {
  const ctx = lagPlane.ctx, W = lagPlane.lw, H = lagPlane.lh; ctx.setTransform(lagPlane.dpr,0,0,lagPlane.dpr,0,0); panelBg(ctx, W, H);
  const ob = OB.layers[pop].global, obYears = OB.layers[pop].years, cYears = CAN.years, cVals = cancerTotal.both;
  const m = { l: 70, r: 30, t: 90, b: 70 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 34px JetBrains Mono'; ctx.fillText('Obesity today, cancer tomorrow', m.l, 56);
  // align years 1990..2021
  const y0 = 1990, y1 = 2021; const obAt = y => ob[clamp(y - obYears[0], 0, ob.length - 1)]; const cAt = y => cVals[clamp(y - cYears[0], 0, cVals.length - 1)];
  const obS = [], cS = []; for (let y = y0; y <= y1 - lag; y++) { obS.push(obAt(y)); cS.push(cAt(y + lag)); }
  const r = pearson(obS, cS);
  const X = i => m.l + (i / (y1 - y0)) * iw;
  const drawLine = (vals, off, col, dash) => { const e = ext(vals.map((v, i) => ({ v })), 'v'); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(dash || []); ctx.beginPath(); vals.forEach((v, i) => { const x = X(i + off), yy = m.t + ih - ((v - e.min) / ((e.max - e.min) || 1)) * ih; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke(); ctx.setLineDash([]); };
  const obFull = []; for (let y = y0; y <= y1; y++) obFull.push(obAt(y));
  const cFull = []; for (let y = y0; y <= y1; y++) cFull.push(cAt(y));
  drawLine(obFull, 0, '#8DB0E4');
  drawLine(cFull, -lag, '#D98A6E', [10, 8]);
  ctx.font = '600 22px JetBrains Mono'; ctx.fillStyle = '#8DB0E4'; ctx.fillText('obesity (youth)', m.l, H - 28);
  ctx.fillStyle = '#D98A6E'; ctx.fillText('cancer incidence, shifted ' + lag + 'y', m.l + 260, H - 28);
  ctx.font = '700 30px JetBrains Mono'; ctx.fillStyle = '#ECEBE4'; ctx.textAlign = 'right'; ctx.fillText('r = ' + r.toFixed(2) + '   lag ' + lag + 'y', W - m.r, 56); ctx.textAlign = 'left';
  lagPlane.tex.needsUpdate = true;
}

// ====================================================================
// 7. FORECAST (projection to 2050)
// ====================================================================
const FCP = new THREE.Vector3(8, 1.5, -128);
const fcPlane = chartPlane(6.4, 3.8, FCP);
function drawForecast() {
  const ctx = fcPlane.ctx, W = fcPlane.lw, H = fcPlane.lh; ctx.setTransform(fcPlane.dpr,0,0,fcPlane.dpr,0,0); panelBg(ctx, W, H);
  const ob = OB.layers[pop].global, years = OB.layers[pop].years, y0 = years[0], yLast = years[years.length - 1], yEnd = 2050;
  const m = { l: 70, r: 40, t: 90, b: 64 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 34px JetBrains Mono'; ctx.fillText('Where it is heading, to 2050', m.l, 56);
  // log-linear fit on last 12 points
  const k = Math.min(12, ob.length); const xs = [], ys = []; for (let i = ob.length - k; i < ob.length; i++) { xs.push(i); ys.push(Math.log(Math.max(0.1, ob[i]))); }
  let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let i = 0; i < k; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const b1 = (k * sxy - sx * sy) / (k * sxx - sx * sx), b0 = (sy - b1 * sx) / k;
  let sse = 0; for (let i = 0; i < k; i++) { sse += (ys[i] - (b0 + b1 * xs[i])) ** 2; } const sigma = Math.sqrt(sse / Math.max(1, k - 2));
  const nFut = yEnd - yLast; const allMax = Math.max.apply(null, ob) * 1.8;
  const X = yr => m.l + ((yr - y0) / (yEnd - y0)) * iw, Y = v => m.t + ih - (v / allMax) * ih;
  // axis baseline
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  // cone
  const up = [], lo = [];
  for (let f = 0; f <= nFut; f++) { const idx = ob.length - 1 + f, yr = yLast + f, c = Math.exp(b0 + b1 * idx); up.push([X(yr), Y(Math.exp(Math.log(c) + 1.96 * sigma * Math.sqrt(f / 4 + 0.01)))]); lo.push([X(yr), Y(Math.exp(Math.log(c) - 1.96 * sigma * Math.sqrt(f / 4 + 0.01)))]); }
  ctx.fillStyle = 'rgba(141,176,228,0.16)'; ctx.beginPath(); up.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]); ctx.closePath(); ctx.fill();
  // history
  ctx.strokeStyle = '#8DB0E4'; ctx.lineWidth = 3; ctx.beginPath(); ob.forEach((v, i) => { const x = X(y0 + i), yy = Y(v); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke();
  // forecast central
  ctx.strokeStyle = '#8DB0E4'; ctx.setLineDash([10, 8]); ctx.beginPath(); for (let f = 0; f <= nFut; f++) { const idx = ob.length - 1 + f, yr = yLast + f, c = Math.exp(b0 + b1 * idx); const x = X(yr), yy = Y(c); f ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); ctx.setLineDash([]);
  const proj = Math.exp(b0 + b1 * (ob.length - 1 + nFut));
  ctx.font = '700 28px JetBrains Mono'; ctx.fillStyle = '#ECEBE4'; ctx.textAlign = 'right'; ctx.fillText('~' + proj.toFixed(0) + '% by 2050', W - m.r, 56); ctx.textAlign = 'left';
  ctx.font = '600 22px JetBrains Mono'; ctx.fillStyle = '#6E6D64'; ctx.fillText(y0 + '', m.l, m.t + ih + 36); ctx.fillText('2050', X(2050) - 40, m.t + ih + 36);
  fcPlane.tex.needsUpdate = true;
}

// ====================================================================
// 8. ABOUT
// ====================================================================
const ABP = new THREE.Vector3(0, 0, -172);
const aboutGroup = new THREE.Group(); aboutGroup.position.copy(ABP); scene.add(aboutGroup);
const aboutSpin = new THREE.Group(); aboutGroup.add(aboutSpin);
const aboutPicks = [];
aboutSpin.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5, emissive: 0x16222e })));
const aboutName = makeLabel('Abdiwahab Ali', { size: 0.5, color: '#ECEBE4' }); aboutName.position.set(0, 1.5, 0); aboutSpin.add(aboutName);
const aboutRole = makeLabel('doctoral researcher, NYCU Taipei', { size: 0.3, color: '#9C9B91' }); aboutRole.position.set(0, 1.05, 0); aboutSpin.add(aboutRole);
const aboutNodes = [
  { t: 'GBD', tip: { name: 'GBD', sub: 'dataset', valHTML: 'global burden of disease' } },
  { t: 'GLOBOCAN', tip: { name: 'GLOBOCAN', sub: 'dataset', valHTML: 'global cancer' } },
  { t: 'NCD-RisC', tip: { name: 'NCD-RisC', sub: 'dataset', valHTML: 'risk factor collaboration' } },
  { t: 'WHO', tip: { name: 'WHO', sub: 'dataset', valHTML: 'indicators' } },
  { t: 'UN WPP', tip: { name: 'UN WPP', sub: 'dataset', valHTML: 'population denominators' } },
  { t: 'Public Health 2026', url: 'https://doi.org/10.1016/j.puhe.2026.106177', tip: { name: 'Public Health, 2026', sub: 'publication', valHTML: 'Khat & oral/esophageal cancer: review &amp; meta-analysis. Click to open.' } },
  { t: 'ecancer 2026', url: 'https://doi.org/10.3332/ecancer.2026.2094', tip: { name: 'ecancermedicalscience, 2026', sub: 'publication', valHTML: 'Khat & upper-digestive cancers: case-control. Click to open.' } }
];
aboutNodes.forEach((nd, i) => {
  const a = (i / aboutNodes.length) * Math.PI * 2, r = 2.6;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), new THREE.MeshBasicMaterial({ color: nd.url ? WARM : ACCENT }));
  m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, Math.sin(a) * 0.8); m.userData = { mat0: m.material, url: nd.url, tip: () => nd.tip }; aboutSpin.add(m); aboutPicks.push(m);
  const lab = makeLabel(nd.t, { size: 0.26, color: '#9C9B91' }); lab.position.copy(m.position).add(new THREE.Vector3(0, 0.28, 0)); aboutSpin.add(lab);
});

// ====================================================================
// 8b. COLLABORATE (meta-analysis: forest + funnel)
// ====================================================================
function planeMesh(w, h) { const DPR = 2.0, pxw = 900, pxh = Math.round(pxw * h / w), cv = document.createElement('canvas'); cv.width = pxw * DPR; cv.height = pxh * DPR; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); return { cv, ctx: cv.getContext('2d'), tex, mesh, lw: pxw, lh: pxh, dpr: DPR }; }
const COLLAB = new THREE.Vector3(-8, 1, -150);
const collabGroup = new THREE.Group(); collabGroup.position.copy(COLLAB); scene.add(collabGroup);
const collabSpin = new THREE.Group(); collabGroup.add(collabSpin);
const forest = planeMesh(3.9, 3.2); forest.mesh.position.set(-2.2, 0.75, 0); collabSpin.add(forest.mesh);
const funnel = planeMesh(2.9, 2.6); funnel.mesh.position.set(2.5, 0.55, 0); collabSpin.add(funnel.mesh);
const META = [{ n: 'Cohort A 2014', e: 0.20, se: 0.10 }, { n: 'Case-ctrl 2016', e: 0.62, se: 0.13 }, { n: 'Cohort B 2017', e: 0.15, se: 0.08 }, { n: 'Registry 2018', e: 0.48, se: 0.12 }, { n: 'Cohort C 2019', e: 0.28, se: 0.11 }, { n: 'Case-ctrl 2020', e: 0.70, se: 0.16 }, { n: 'Pooled 2021', e: 0.18, se: 0.07 }, { n: 'Cohort D 2022', e: 0.40, se: 0.10 }, { n: 'Registry 2023', e: 0.25, se: 0.09 }, { n: 'Cohort E 2024', e: 0.55, se: 0.14 }];
function dlMeta(st) { const k = st.length; let sw = 0, swe = 0; for (const s of st) { const w = 1 / (s.se * s.se); sw += w; swe += w * s.e; } const fixed = swe / sw; let Q = 0, sw2 = 0; for (const s of st) { const w = 1 / (s.se * s.se); Q += w * (s.e - fixed) ** 2; sw2 += w * w; } const df = k - 1, C = sw - sw2 / sw, tau2 = Math.max(0, (Q - df) / C); let swr = 0, swre = 0; for (const s of st) { const w = 1 / (s.se * s.se + tau2); swr += w; swre += w * s.e; } let I2 = (Q - df) / Q * 100; if (!isFinite(I2) || I2 < 0) I2 = 0; return { pooled: swre / swr, sep: Math.sqrt(1 / swr), I2 }; }
function drawForest(n) {
  const st = META.slice(0, n), { ctx, tex } = forest, W = forest.lw, H = forest.lh; ctx.setTransform(forest.dpr,0,0,forest.dpr,0,0); panelBg(ctx, W, H);
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Forest plot, random effects', 40, 46);
  const m = { l: 210, r: 90, t: 78, b: 80 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const all = st.flatMap(s => [s.e - 1.96 * s.se, s.e + 1.96 * s.se]), xmin = Math.min(0, ...all) - 0.1, xmax = Math.max(...all) + 0.1, X = v => m.l + (v - xmin) / (xmax - xmin) * iw;
  ctx.strokeStyle = '#3A3934'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(0), m.t - 8); ctx.lineTo(X(0), m.t + ih + 6); ctx.stroke(); ctx.setLineDash([]);
  const rowH = ih / (n + 1);
  st.forEach((s, i) => { const y = m.t + rowH * (i + 0.5);
    ctx.strokeStyle = '#8DB0E4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(s.e - 1.96 * s.se), y); ctx.lineTo(X(s.e + 1.96 * s.se), y); ctx.stroke();
    const sz = Math.max(6, 14 - s.se * 22); ctx.fillStyle = '#8DB0E4'; ctx.fillRect(X(s.e) - sz / 2, y - sz / 2, sz, sz);
    ctx.fillStyle = '#9C9B91'; ctx.font = '400 19px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText(s.n, 28, y + 6);
    ctx.fillStyle = '#ECEBE4'; ctx.textAlign = 'right'; ctx.fillText(Math.exp(s.e).toFixed(2), W - 30, y + 6); ctx.textAlign = 'left'; });
  const meta = dlMeta(st), yD = m.t + ih + 22, lo = X(meta.pooled - 1.96 * meta.sep), hi = X(meta.pooled + 1.96 * meta.sep), mid = X(meta.pooled);
  ctx.fillStyle = '#D98A6E'; ctx.beginPath(); ctx.moveTo(lo, yD); ctx.lineTo(mid, yD - 11); ctx.lineTo(hi, yD); ctx.lineTo(mid, yD + 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 24px JetBrains Mono'; ctx.fillText('Pooled RR ' + Math.exp(meta.pooled).toFixed(2) + '   I² ' + meta.I2.toFixed(0) + '%', m.l, H - 24);
  tex.needsUpdate = true;
}
function drawFunnel(n) {
  const st = META.slice(0, n), { ctx, tex } = funnel, W = funnel.lw, H = funnel.lh; ctx.setTransform(funnel.dpr,0,0,funnel.dpr,0,0); panelBg(ctx, W, H);
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Funnel plot', 40, 46);
  const meta = dlMeta(st), m = { l: 60, r: 46, t: 78, b: 80 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const semax = Math.max(...st.map(s => s.se)) * 1.15, xc = meta.pooled, xspan = Math.max(0.6, Math.max(...st.map(s => Math.abs(s.e - xc))) * 1.5);
  const X = v => m.l + iw / 2 + (v - xc) / xspan * (iw / 2), Y = se => m.t + (se / semax) * ih;
  ctx.strokeStyle = '#3A3934'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(xc), Y(0)); ctx.lineTo(X(xc - 1.96 * semax), Y(semax)); ctx.moveTo(X(xc), Y(0)); ctx.lineTo(X(xc + 1.96 * semax), Y(semax)); ctx.stroke();
  ctx.strokeStyle = '#2A2924'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(X(xc), m.t); ctx.lineTo(X(xc), m.t + ih); ctx.stroke(); ctx.setLineDash([]);
  st.forEach(s => { ctx.fillStyle = '#8DB0E4'; ctx.beginPath(); ctx.arc(X(s.e), Y(s.se), 6, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 18px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText('effect size', W / 2, H - 28); ctx.textAlign = 'left';
  tex.needsUpdate = true;
}
// ---- tools (3D badges) ----
const hex = c => '#' + c.toString(16).padStart(6, '0');
function makeBadge(name, mono, color) {
  const w = 300, h = 124, cv = document.createElement('canvas'); cv.width = w * 3; cv.height = h * 3; const ctx = cv.getContext('2d'); ctx.scale(3, 3); ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20,20,18,0.98)'; roundRect(ctx, 4, 4, w - 8, h - 8, 20); ctx.fill();
  ctx.strokeStyle = hex(color); ctx.lineWidth = 3; roundRect(ctx, 4, 4, w - 8, h - 8, 20); ctx.stroke();
  ctx.fillStyle = hex(color); ctx.beginPath(); ctx.arc(48, h / 2, 28, 0, 7); ctx.fill();
  ctx.fillStyle = '#0D0D0C'; ctx.font = '800 30px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mono, 48, h / 2 + 1);
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 33px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText(name, 90, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 0.55, metalness: 0.1 })));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); f.position.z = 0.051; g.add(f);
  return g;
}
const TOOLS = [['R', 'R', 0x5A9FD4], ['Python', 'Py', 0x4F8FD8], ['Stata', 'St', 0xD98A6E], ['SPSS', 'SP', 0xC86B6B], ['Joinpoint', 'Jp', 0x9B8DE4]];
const toolsGroup = new THREE.Group(); collabSpin.add(toolsGroup);
TOOLS.forEach(([nm, mono, c], i) => { const b = makeBadge(nm, mono, c); b.position.set((i - (TOOLS.length - 1) / 2) * 1.42, 2.95, 0); toolsGroup.add(b); });
(function () { const l = makeLabel('tools I work with', { size: 0.24, color: '#6E6D64' }); l.position.set(0, 3.5, 0); collabSpin.add(l); })();

// ---- methods gallery (sample data) ----
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2831853 * r()); }
function drawRegression() {
  const F = forest, ctx = F.ctx, W = F.lw, H = F.lh; ctx.setTransform(F.dpr,0,0,F.dpr,0,0); panelBg(ctx, W, H);
  const r = rng(42), pts = []; for (let i = 0; i < 46; i++) { const x = r() * 10, y = 2.2 + 0.78 * x + gauss(r) * 1.7; pts.push([x, y]); }
  let sx = 0, sy = 0, sxx = 0, sxy = 0, nn = pts.length; for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const b = (nn * sxy - sx * sy) / (nn * sxx - sx * sx), a = (sy - b * sx) / nn; let sst = 0, ssr = 0; const my = sy / nn;
  for (const [x, y] of pts) { sst += (y - my) ** 2; ssr += (y - (a + b * x)) ** 2; } const r2 = 1 - ssr / sst;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Linear regression', 40, 46);
  const m = { l: 64, r: 40, t: 78, b: 70 }, iw = W - m.l - m.r, ih = H - m.t - m.b, X = x => m.l + x / 10 * iw, Y = y => m.t + ih - y / 12 * ih;
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  ctx.fillStyle = '#8DB0E4'; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#D98A6E'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0), Y(a)); ctx.lineTo(X(10), Y(a + b * 10)); ctx.stroke();
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 24px JetBrains Mono'; ctx.fillText('y = ' + a.toFixed(1) + ' + ' + b.toFixed(2) + 'x    R² = ' + r2.toFixed(2), m.l, H - 24); F.tex.needsUpdate = true;
  const G = funnel, c2 = G.ctx, W2 = G.lw, H2 = G.lh; c2.setTransform(G.dpr,0,0,G.dpr,0,0); panelBg(c2, W2, H2);
  c2.fillStyle = '#ECEBE4'; c2.font = '700 26px JetBrains Mono'; c2.textAlign = 'left'; c2.fillText('Residuals', 36, 44);
  const m2 = { l: 50, r: 36, t: 64, b: 56 }, iw2 = W2 - m2.l - m2.r, ih2 = H2 - m2.t - m2.b, midY = m2.t + ih2 / 2;
  c2.strokeStyle = '#2A2924'; c2.beginPath(); c2.moveTo(m2.l, midY); c2.lineTo(m2.l + iw2, midY); c2.stroke();
  c2.fillStyle = '#8DB0E4'; for (const [x, y] of pts) { const res = y - (a + b * x); c2.beginPath(); c2.arc(m2.l + x / 10 * iw2, midY - res / 6 * ih2, 4.5, 0, 7); c2.fill(); } G.tex.needsUpdate = true;
}
function drawSurvival() {
  const F = forest, ctx = F.ctx, W = F.lw, H = F.lh; ctx.setTransform(F.dpr,0,0,F.dpr,0,0); panelBg(ctx, W, H);
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Kaplan-Meier survival', 40, 46);
  const m = { l: 70, r: 40, t: 78, b: 72 }, iw = W - m.l - m.r, ih = H - m.t - m.b, Tmax = 60, X = t => m.l + t / Tmax * iw, Y = s => m.t + (1 - s) * ih;
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  function curve(h, color) { let s = 1; const rr = rng(Math.round(h * 1000)); ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(X(0), Y(1)); for (let t = 1; t <= Tmax; t++) { if (rr() < 0.5) { ctx.lineTo(X(t), Y(s)); s = Math.max(0, s - h * (0.5 + rr())); ctx.lineTo(X(t), Y(s)); } } ctx.lineTo(X(Tmax), Y(s)); ctx.stroke(); }
  curve(0.018, '#8DB0E4'); curve(0.034, '#D98A6E');
  const lx = m.l + iw - 200, ly = m.t + 22; ctx.lineWidth = 3; ctx.font = '600 21px JetBrains Mono'; ctx.textAlign = 'left';
  ctx.strokeStyle = '#8DB0E4'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 30, ly); ctx.stroke(); ctx.fillStyle = '#8DB0E4'; ctx.fillText('treatment', lx + 40, ly + 6);
  ctx.strokeStyle = '#D98A6E'; ctx.beginPath(); ctx.moveTo(lx, ly + 32); ctx.lineTo(lx + 30, ly + 32); ctx.stroke(); ctx.fillStyle = '#D98A6E'; ctx.fillText('control', lx + 40, ly + 38);
  ctx.fillStyle = '#9C9B91'; ctx.fillText('months', m.l + iw - 90, m.t + ih + 36); F.tex.needsUpdate = true;
  const G = funnel, c2 = G.ctx, W2 = G.lw, H2 = G.lh; c2.setTransform(G.dpr,0,0,G.dpr,0,0); panelBg(c2, W2, H2);
  c2.fillStyle = '#ECEBE4'; c2.font = '700 26px JetBrains Mono'; c2.textAlign = 'left'; c2.fillText('Cox model', 36, 42);
  c2.font = '700 44px JetBrains Mono'; c2.fillStyle = '#8DB0E4'; c2.fillText('HR 0.52', 36, H2 / 2 - 4);
  c2.font = '400 22px JetBrains Mono'; c2.fillStyle = '#9C9B91'; c2.fillText('95% CI 0.39 - 0.70', 36, H2 / 2 + 34); c2.fillText('log-rank p < 0.001', 36, H2 / 2 + 66); G.tex.needsUpdate = true;
}
function drawROC() {
  const F = forest, ctx = F.ctx, W = F.lw, H = F.lh; ctx.setTransform(F.dpr,0,0,F.dpr,0,0); panelBg(ctx, W, H);
  const r = rng(7), pos = [], neg = []; for (let i = 0; i < 130; i++) { pos.push(1 / (1 + Math.exp(-(gauss(r) + 1.1)))); neg.push(1 / (1 + Math.exp(-(gauss(r) - 1.1)))); }
  const thr = []; for (let t = 0; t <= 1.0001; t += 0.02) { thr.push([neg.filter(v => v >= t).length / neg.length, pos.filter(v => v >= t).length / pos.length]); }
  let auc = 0; for (let i = 1; i < thr.length; i++) auc += (thr[i - 1][0] - thr[i][0]) * (thr[i - 1][1] + thr[i][1]) / 2;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('ROC curve', 40, 46);
  const m = { l: 70, r: 40, t: 78, b: 72 }, iw = W - m.l - m.r, ih = H - m.t - m.b, X = v => m.l + v * iw, Y = v => m.t + ih - v * ih;
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  ctx.strokeStyle = '#3A3934'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#8DB0E4'; ctx.lineWidth = 3; ctx.beginPath(); thr.forEach((pp, i) => { const x = X(pp[0]), y = Y(pp[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 26px JetBrains Mono'; ctx.fillText('AUC = ' + auc.toFixed(2), m.l + iw - 196, m.t + ih - 26);
  ctx.fillStyle = '#9C9B91'; ctx.font = '400 18px JetBrains Mono'; ctx.fillText('false positive rate', m.l + iw / 2 - 80, m.t + ih + 36); F.tex.needsUpdate = true;
  const G = funnel, c2 = G.ctx, W2 = G.lw, H2 = G.lh; c2.setTransform(G.dpr,0,0,G.dpr,0,0); panelBg(c2, W2, H2);
  c2.fillStyle = '#ECEBE4'; c2.font = '700 26px JetBrains Mono'; c2.textAlign = 'left'; c2.fillText('Score distribution', 36, 42);
  const m2 = { l: 40, r: 30, t: 64, b: 50 }, iw2 = W2 - m2.l - m2.r, ih2 = H2 - m2.t - m2.b, bins = 18;
  function hist(arr, color) { const bb = new Array(bins).fill(0); for (const v of arr) bb[Math.min(bins - 1, Math.floor(v * bins))]++; const mx = Math.max(...bb); c2.fillStyle = color; c2.globalAlpha = 0.55; for (let i = 0; i < bins; i++) { const bh = bb[i] / mx * ih2; c2.fillRect(m2.l + i / bins * iw2, m2.t + ih2 - bh, iw2 / bins - 2, bh); } c2.globalAlpha = 1; }
  hist(neg, '#D98A6E'); hist(pos, '#8DB0E4'); G.tex.needsUpdate = true;
}
let gMethod = 'meta';
function drawCollab(n) {
  if (gMethod === 'meta') { drawForest(n); drawFunnel(n); }
  else if (gMethod === 'survival') drawSurvival();
  else if (gMethod === 'regression') drawRegression();
  else if (gMethod === 'roc') drawROC();
}

// ====================================================================
// 8c. STORYTELLER (one table, many stories)
// ====================================================================
const STORYP = new THREE.Vector3(-7, 0.4, -196);
const storyGroup = new THREE.Group(); storyGroup.position.copy(STORYP); scene.add(storyGroup);
const storySpin = new THREE.Group(); storyGroup.add(storySpin);
const SD_CATS = ['Refined grains', 'Sugary drinks', 'Red & proc. meat', 'Fruit & veg', 'Whole grains', 'Nuts & legumes'];
const SD_COL = ['#E0A24A', '#E0728F', '#D98A6E', '#6FC8A3', '#6FB1E0', '#9B8DE4'];
const SD_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];
const SD_ENDS = [[30, 33], [6, 17], [12, 15], [22, 14], [18, 12], [12, 9]];
const SD = SD_ENDS.map(([a, b], c) => SD_YEARS.map((y, j) => { const t = j / (SD_YEARS.length - 1); return Math.max(1, +(a + (b - a) * t + Math.sin(t * 5 + c * 1.7) * 0.8).toFixed(1)); }));
const storyTablePlane = planeMesh(3.3, 1.7); storyTablePlane.mesh.position.set(0, 0.5, 0); storySpin.add(storyTablePlane.mesh);
function drawStoryTable() {
  const { ctx } = storyTablePlane, W = storyTablePlane.lw, H = storyTablePlane.lh, LY = SD_YEARS.length - 1; ctx.setTransform(storyTablePlane.dpr, 0, 0, storyTablePlane.dpr, 0, 0); panelBg(ctx, W, H);
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 27px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Calories from each food (%)', 38, 50);
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 20px JetBrains Mono'; ctx.fillText('food group', 38, 108); ctx.textAlign = 'right'; ctx.fillText('1990', W * 0.72, 108); ctx.fillText('2024', W - 38, 108); ctx.textAlign = 'left';
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(38, 122); ctx.lineTo(W - 38, 122); ctx.stroke();
  SD_CATS.forEach((nm, i) => { const y = 168 + i * 50; ctx.fillStyle = SD_COL[i]; ctx.beginPath(); ctx.arc(50, y - 7, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#ECEBE4'; ctx.font = '500 22px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText(nm, 70, y); ctx.font = '400 23px JetBrains Mono'; ctx.fillStyle = '#9C9B91'; ctx.textAlign = 'right'; ctx.fillText(SD[i][0].toFixed(0), W * 0.72, y); ctx.fillStyle = '#8DB0E4'; ctx.fillText(SD[i][LY].toFixed(0), W - 38, y); ctx.textAlign = 'left'; });
  storyTablePlane.tex.needsUpdate = true;
}
const storyHint = makeLabel('tell its story', { size: 0.34, color: '#8DB0E4' }); storyHint.position.set(0, -0.78, 0); storySpin.add(storyHint);

// 9. YOUR DATA (closing)
// ====================================================================
const FINAL = new THREE.Vector3(0, 0, -218);
const finalGroup = new THREE.Group(); finalGroup.position.copy(FINAL); scene.add(finalGroup);
const finalSpin = new THREE.Group(); finalGroup.add(finalSpin); finalGroup.visible = false;
finalSpin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.42 })));
let finalPts = null;
(function () {
  const n = 300, pos = new Float32Array(n * 3), target = new Float32Array(n * 3), scatter = new Float32Array(n * 3);
  let s = 11; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, t = rnd() * 6.2832, q = Math.sqrt(1 - u * u), r = 1.45 + rnd() * 0.55;
    target[i * 3] = r * q * Math.cos(t); target[i * 3 + 1] = r * u; target[i * 3 + 2] = r * q * Math.sin(t);
    const rr = 4 + rnd() * 7, u2 = rnd() * 2 - 1, t2 = rnd() * 6.2832, q2 = Math.sqrt(1 - u2 * u2);
    scatter[i * 3] = rr * q2 * Math.cos(t2); scatter[i * 3 + 1] = rr * u2; scatter[i * 3 + 2] = rr * q2 * Math.sin(t2);
    pos[i * 3] = scatter[i * 3]; pos[i * 3 + 1] = scatter[i * 3 + 1]; pos[i * 3 + 2] = scatter[i * 3 + 2];
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  finalSpin.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ACCENT, size: 0.05, transparent: true, opacity: 0.85 })));
  finalPts = { geo: g, pos, target, scatter, n };
})();

// ====================================================================
// STATIONS
// ====================================================================
const off = (p, dx, dy, dz) => p.clone().add(new THREE.Vector3(dx, dy, dz));
const STATIONS = [
  { name: 'Earth', cap: '<b>Each spike is a country.</b><br>Height is obesity prevalence. Play runs 35 years.', spin: globe, picks: () => spikes, camPos: new THREE.Vector3(0, 0.35, 3.7), camTarget: new THREE.Vector3(0, 0, 0), pop: 1, time: 1, spinIdle: 0.0006 },
  { name: 'Burden / velocity', cap: '<b>Where it is high, and where it is rising.</b><br>Each sphere a country, by region. Click to pin.', spin: scatterSpin, picks: () => scatterPoints, camPos: off(SCATTER, 0, 1.8, 10.5), camTarget: SCATTER.clone(), pop: 1 },
  { name: 'Early-onset shift', cap: '<b>Where disease is striking earlier.</b><br>Sample incidence by age and year. The ridge moves to younger ages.', spin: rankSpin, picks: () => [], camPos: off(RANK, 0, 3.6, 9.5), camTarget: off(RANK, 0, 0.9, 0) },
  { name: 'Diet', cap: '<b>Good foods, bad foods.</b><br>The world scores 39 of 100. Bad foods keep growing.', spin: dietSpin, picks: () => dietFoods, camPos: off(DIETP, 0, 0.4, 12), camTarget: off(DIETP, 0, 0.2, 0), time: 1 },
  { name: 'Cancer', cap: '<b>Thirteen obesity-related cancers.</b><br>Each line a cancer, 1990 to 2021. Warm rising, cool falling.', spin: cancerSpin, picks: () => cancerLines, camPos: off(CANP, 0, 0.3, 10), camTarget: CANP.clone(), time: 1, csex: 1 },
  { name: 'Obesity drives cancer', cap: '<b>Obesity today, cancer tomorrow.</b><br>Drag the lag, watch the correlation move.', spin: lagPlane.group, picks: () => [], camPos: off(LAGP, 0, 0, 6.4), camTarget: LAGP.clone(), pop: 1, aux: { label: 'lag', min: 0, max: 15, on: v => { lag = v; drawLag(); document.getElementById('aux-val').textContent = v + ' yr'; } } },
  { name: 'Forecast', cap: '<b>Where it is heading.</b><br>Projection to 2050 with uncertainty.', spin: fcPlane.group, picks: () => [], camPos: off(FCP, 0, 0, 6.4), camTarget: FCP.clone(), pop: 1 },
  { name: 'Collaborate', cap: '<b>The methods I use, and the tools above.</b><br>Switch the analysis below. Open to collaboration on obesity, early-onset cancers, diet, and NCDs.', spin: collabSpin, picks: () => [], camPos: off(COLLAB, 0, 1.4, 10.8), camTarget: off(COLLAB, 0, 1.4, 0) },
  { name: 'The analyst', cap: '<b>Abdiwahab M. Ali.</b><br>Datasets and tools I work with. Click a paper.', spin: aboutSpin, picks: () => aboutPicks, camPos: off(ABP, 0, 0, 7.2), camTarget: ABP.clone(), spinIdle: 0.0015 },
  { name: 'One table, many stories', cap: '<b>Here is one small table.</b><br>Six numbers, then and now. Press the button and let me take you somewhere to show you what they really say.', spin: storySpin, picks: () => [], camPos: off(STORYP, 0, 0.5, 7), camTarget: off(STORYP, 0, 0.5, 0) }
];
const N = STATIONS.length;
const WORLD_GROUPS = [globePivot, scatterGroup, rankGroup, dietGroup, cancerGroup, lagPlane.group, fcPlane.group, collabGroup, aboutGroup, storyGroup];
const curTarget = STATIONS[0].camTarget.clone(), desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
let curStation = -1;

// dot nav
const dotnav = document.getElementById('dotnav');
function scrollToStation(i) { scrollTo({ top: i / (N - 1) * (document.body.scrollHeight - innerHeight), behavior: 'smooth' }); }
STATIONS.forEach((s, i) => { const b = document.createElement('button'); b.title = s.name; b.innerHTML = '<span class="dot-name">' + (i + 1) + '. ' + s.name + '</span>'; b.addEventListener('click', () => scrollToStation(i)); dotnav.appendChild(b); });
// demo flight (auto fly-through everything, then back to the beginning)
// demo flight: continuous cinematic camera (fly + zoom-in dwell at each world, forward through all)
let demoActive = false, demoStart = 0; const DWELL = 1600, TRAVEL = 2300;
function stopTour() { const btn = document.getElementById('tour'); if (!demoActive) { btn.classList.remove('on'); return; } demoActive = false; btn.classList.remove('on'); const cur = clamp(Math.round(curStation < 0 ? 0 : curStation), 0, N - 1); scrollTo(0, cur / (N - 1) * (document.body.scrollHeight - innerHeight)); }
function startTour() { if (demoActive) { stopTour(); return; } demoActive = true; document.getElementById('tour').classList.add('on'); demoStart = performance.now(); }
document.getElementById('tour').addEventListener('click', startTour);
addEventListener('wheel', () => { earthIntro = false; if (demoActive) stopTour(); }, { passive: true });

const elDs = document.getElementById('ds'), elSex = document.getElementById('csex'), elAux = document.getElementById('aux'), elTimeline = document.getElementById('timeline');
function onStation(i) {
  const s = STATIONS[i]; selected = null;
  document.getElementById('st-idx').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
  document.getElementById('st-name').textContent = s.name;
  const lg = document.getElementById('legend'); lg.innerHTML = s.cap; lg.style.animation = 'none'; void lg.offsetWidth; lg.style.animation = 'fadein .6s ease';
  document.getElementById('yourdata').classList.toggle('show', false);
  dotnav.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i));
  elDs.style.display = s.pop ? '' : 'none';
  elSex.style.display = s.csex ? '' : 'none';
  elTimeline.style.display = s.time ? '' : 'none';
  if (s.aux) { elAux.style.display = ''; const sl = document.getElementById('aux-slider'); sl.min = s.aux.min; sl.max = s.aux.max; if (s.aux.val == null) s.aux.val = s.aux.def != null ? s.aux.def : s.aux.min; sl.value = s.aux.val; document.getElementById('aux-label').textContent = s.aux.label; s.aux.on(s.aux.val); }
  else elAux.style.display = 'none';
  document.getElementById('methods').classList.toggle('show', s.name === 'Collaborate');
  document.getElementById('story-trigger').classList.toggle('show', s.name === 'One table, many stories');
  const isEarth = s.name === 'Earth'; document.getElementById('datahint').classList.toggle('show', isEarth); if (isEarth) updateDataHint();
  panel.classList.remove('show');
}

// ---- interaction ----
const ray = new THREE.Raycaster(); ray.params.Points.threshold = 0.1; const ndc = new THREE.Vector2();
let down = null, dragging = false, last = null, hovered = null, hoverT = 0, selected = null;
function setNdc(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
function pick(e) { setNdc(e); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(STATIONS[Math.max(0, curStation)].picks(), false); return h.length ? h[0].object : null; }
function setHover(m) { if (hovered && hovered !== m && hovered !== (selected && selected.mesh)) hovered.material = hovered.userData.mat0; if (m && m !== (selected && selected.mesh)) m.material = hiMat; hovered = m; }
canvas.addEventListener('pointerdown', e => { earthIntro = false; if (demoActive) stopTour(); down = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' }; last = { x: e.clientX, y: e.clientY }; dragging = false; });
canvas.addEventListener('pointermove', e => {
  if (down) {
    if (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4) dragging = true;
    if (storyMode === 'idle') { galGroup.rotation.y = clamp(galGroup.rotation.y + (e.clientX - last.x) * 0.004, -0.7, 0.7); galGroup.rotation.x = clamp(galGroup.rotation.x + (e.clientY - last.y) * 0.004, -0.38, 0.38); last = { x: e.clientX, y: e.clientY }; return; }
    if (down.touch) return;   // on touch, let the page scroll (travel); don't rotate
    const sp = STATIONS[Math.max(0, curStation)].spin; sp.rotation.y += (e.clientX - last.x) * 0.005; sp.rotation.x = clamp(sp.rotation.x + (e.clientY - last.y) * 0.005, -1.2, 1.2); last = { x: e.clientX, y: e.clientY }; return;
  }
  if (storyMode) { if (storyMode === 'idle') { setNdc(e); ray.setFromCamera(ndc, camera); canvas.style.cursor = ray.intersectObjects(storyPick, false).length ? 'pointer' : ''; } return; }
  const now = performance.now(); if (now - hoverT < 33) return; hoverT = now;
  const m = pick(e);
  if (m && m.userData.tip) { setHover(m); showInfo(m.userData.tip()); canvas.style.cursor = 'pointer'; }
  else { setHover(null); if (selected) showInfo(selected.tip()); else panel.classList.remove('show'); canvas.style.cursor = ''; }
});
addEventListener('pointerup', e => {
  const click = down && !dragging; down = null; if (!click) return;
  if (storyMode) { if (storyMode === 'idle') { setNdc(e); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(storyPick, false); if (h.length) { const card = h[0].object.userData.card; if (card.kind === 'final') qov.classList.add('show'); else { const w = card.focus; storyCards.forEach(c => { if (c !== card) c.focus = 0; }); card.focus = w === 0 ? 1 : w === 1 ? 2 : 0; } } else storyCards.forEach(c => c.focus = 0); storyCards.forEach(c => setCardHi(c, c.focus > 0)); } return; }
  const m = pick(e);
  if (m && m.userData.url) { open(m.userData.url, '_blank'); return; }
  if (m && m.userData.tip) { if (selected && selected.mesh) selected.mesh.material = selected.mesh.userData.mat0; selected = { mesh: m, tip: m.userData.tip }; m.material = hiMat; showInfo(m.userData.tip()); }
  else { if (selected && selected.mesh) selected.mesh.material = selected.mesh.userData.mat0; selected = null; panel.classList.remove('show'); }
});

// ---- controls ----
const scrub = document.getElementById('scrub'), yearEl = document.getElementById('year'), playBtn = document.getElementById('play');
function yearLabel() { const s = STATIONS[Math.max(0, curStation)]; if (s.spin === dietSpin) return DIET.yearsF[dietIdx()]; if (s.spin === cancerSpin) return CAN.years[canIdx()]; return OB.layers[pop].years[obIdx()]; }
function refreshAll() { refreshSpikes(); refreshDiet(); refreshCancer(); if (selected) showInfo(selected.tip()); }
function setTime(t) { tNorm = clamp(t, 0, 1); scrub.value = Math.round(tNorm * 1000); yearEl.textContent = yearLabel(); refreshAll(); updateDataHint(); }
function setPop(p) { pop = p; document.querySelectorAll('#ds button').forEach(b => b.classList.toggle('on', b.dataset.ds === p)); buildScatter(); refreshAll(); drawLag(); drawForecast(); updateDataHint(); yearEl.textContent = yearLabel(); }
function setSex(s) { csex = s; document.querySelectorAll('#csex button').forEach(b => b.classList.toggle('on', b.dataset.sex === s)); buildCancer(); if (selected) showInfo(selected.tip()); }
document.querySelectorAll('#ds button').forEach(b => b.addEventListener('click', () => { if (b.dataset.ds !== pop) setPop(b.dataset.ds); }));
document.querySelectorAll('#csex button').forEach(b => b.addEventListener('click', () => { if (b.dataset.sex !== csex) setSex(b.dataset.sex); }));
scrub.addEventListener('input', () => { earthIntro = false; stop(); setTime(+scrub.value / 1000); });
document.getElementById('aux-slider').addEventListener('input', e => { const s = STATIONS[Math.max(0, curStation)]; if (s.aux) { s.aux.val = +e.target.value; s.aux.on(s.aux.val); } });
let timer = null;
function stop() { if (timer) { clearInterval(timer); timer = null; } playBtn.innerHTML = '&#9654;'; }
function play() { earthIntro = false; if (timer) return stop(); playBtn.innerHTML = '&#10073;&#10073;'; timer = setInterval(() => { const s = STATIONS[Math.max(0, curStation)]; const K = s.spin === dietSpin ? DIET.yearsF.length : s.spin === cancerSpin ? CAN.years.length : OB.layers[pop].years.length; setTime(tNorm >= 0.999 ? 0 : Math.min(1, tNorm + 1 / (K - 1))); }, 520); }
playBtn.addEventListener('click', play);

// quote overlay
const qov = document.getElementById('quote-overlay');
document.getElementById('open-quote').addEventListener('click', () => qov.classList.add('show'));
document.getElementById('yd-cta').addEventListener('click', () => qov.classList.add('show'));
document.getElementById('collab-cta').addEventListener('click', () => { location.href = 'mailto:Bookhaali@gmail.com?subject=' + encodeURIComponent('Research collaboration') + '&body=' + encodeURIComponent('Topic (obesity / early-onset cancer / diet / NCDs / review):\n\nA bit about your project:'); });
let mStudies = 10;
document.querySelectorAll('#mchips .mchip').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#mchips .mchip').forEach(x => x.classList.toggle('on', x === b)); gMethod = b.dataset.m; document.getElementById('mstudies').style.display = gMethod === 'meta' ? '' : 'none'; drawCollab(mStudies); }));
document.getElementById('mstudies').addEventListener('input', e => { mStudies = +e.target.value; if (gMethod === 'meta') drawCollab(mStudies); });
let hintHidden = false;
addEventListener('scroll', () => { if (!hintHidden && scrollY > 40) { hintHidden = true; const h = document.querySelector('.hint'); if (h) { h.style.transition = 'opacity .6s'; h.style.opacity = '0'; } } }, { passive: true });
document.getElementById('close-quote').addEventListener('click', () => qov.classList.remove('show'));
qov.addEventListener('click', e => { if (e.target === qov) qov.classList.remove('show'); });

// ====================================================================
// STORY GALAXY (seamless 3D flight into a gallery of floating, flippable figure cards)
// ====================================================================
function wrapText(ctx, text, x, y, maxW, lh) { const words = text.split(' '); let line = '', yy = y; for (const w of words) { const t = line + w + ' '; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, yy); line = w + ' '; yy += lh; } else line = t; } ctx.fillText(line.trim(), x, yy); return yy; }
function drawBarS(ctx, W, H) {
  const m = { l: 96, r: 80, t: 150, b: 130 }, iw = W - m.l - m.r, ih = H - m.t - m.b, N = SD_CATS.length, gap = iw / N, bw = gap * 0.56, LY = SD_YEARS.length - 1, mx = Math.max.apply(null, SD.map(r => r[LY])) * 1.18;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText("Today's plate, plainly", m.l, 96);
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  for (let c = 0; c < N; c++) { const v = SD[c][LY], x = m.l + gap * c + (gap - bw) / 2, bh = v / mx * ih, y = m.t + ih - bh; ctx.fillStyle = SD_COL[c]; ctx.fillRect(x, y, bw, bh); ctx.fillStyle = '#ECEBE4'; ctx.font = '700 30px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(v.toFixed(0), x + bw / 2, y - 18); ctx.fillStyle = '#9C9B91'; ctx.font = '400 22px JetBrains Mono'; ctx.fillText(SD_CATS[c].split(' ')[0], x + bw / 2, m.t + ih + 46); }
  ctx.textAlign = 'left';
}
function drawDonut(ctx, W, H) {
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('The whole plate, 2024', 96, 96);
  const cx = W * 0.36, cy = H * 0.56, rO = Math.min(W, H) * 0.33, rI = rO * 0.56, LY = SD_YEARS.length - 1, tot = SD.reduce((a, r) => a + r[LY], 0); let an = -Math.PI / 2;
  for (let c = 0; c < SD_CATS.length; c++) { const a2 = an + SD[c][LY] / tot * 6.2832; ctx.fillStyle = SD_COL[c]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rO, an, a2); ctx.closePath(); ctx.fill(); an = a2; }
  ctx.fillStyle = '#0C0C0B'; ctx.beginPath(); ctx.arc(cx, cy, rI, 0, 7); ctx.fill();
  let ly = cy - rO + 26; const lx = W * 0.66; ctx.font = '400 24px JetBrains Mono'; ctx.textAlign = 'left';
  for (let c = 0; c < SD_CATS.length; c++) { ctx.fillStyle = SD_COL[c]; ctx.fillRect(lx, ly - 18, 22, 22); ctx.fillStyle = '#ECEBE4'; ctx.fillText(SD_CATS[c] + '  ' + Math.round(SD[c][LY] / tot * 100) + '%', lx + 32, ly); ly += 44; }
}
function drawStream(ctx, W, H) {
  const m = { l: 96, r: 230, t: 130, b: 96 }, iw = W - m.l - m.r, ih = H - m.t - m.b, T = SD_YEARS.length, N = SD_CATS.length;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('All of it, flowing at once', m.l, 96);
  const tot = SD_YEARS.map((_, j) => SD.reduce((a, row) => a + row[j], 0)), maxTot = Math.max.apply(null, tot);
  const X = j => m.l + j / (T - 1) * iw, yh = v => v / (maxTot * 1.05) * ih, base = SD_YEARS.map((_, j) => m.t + ih / 2 + yh(tot[j]) / 2);
  for (let c = 0; c < N; c++) {
    const top = [], bot = [];
    for (let j = 0; j < T; j++) { let bl = 0; for (let k = 0; k < c; k++) bl += SD[k][j]; bot.push([X(j), base[j] - yh(bl)]); top.push([X(j), base[j] - yh(bl + SD[c][j])]); }
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
    for (let j = 1; j < T; j++) { const xm = (top[j - 1][0] + top[j][0]) / 2; ctx.bezierCurveTo(xm, top[j - 1][1], xm, top[j][1], top[j][0], top[j][1]); }
    for (let j = T - 1; j > 0; j--) { const xm = (bot[j][0] + bot[j - 1][0]) / 2; ctx.bezierCurveTo(xm, bot[j][1], xm, bot[j - 1][1], bot[j - 1][0], bot[j - 1][1]); }
    ctx.closePath(); ctx.fillStyle = SD_COL[c]; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = SD_COL[c]; ctx.font = '600 20px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText(SD_CATS[c], m.l + iw + 14, (top[T - 1][1] + bot[T - 1][1]) / 2 + 6);
  }
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 21px JetBrains Mono'; ctx.textAlign = 'center';[0, T - 1].forEach(j => ctx.fillText(SD_YEARS[j], X(j), m.t + ih + 48)); ctx.textAlign = 'left';
}
function drawBump(ctx, W, H) {
  const m = { l: 116, r: 250, t: 130, b: 90 }, iw = W - m.l - m.r, ih = H - m.t - m.b, T = SD_YEARS.length, N = SD_CATS.length;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Who climbs past whom', m.l, 96);
  const rank = SD_CATS.map(() => new Array(T));
  for (let j = 0; j < T; j++) { const order = SD_CATS.map((_, c) => c).sort((p, q) => SD[q][j] - SD[p][j]); order.forEach((c, r) => rank[c][j] = r); }
  const X = j => m.l + j / (T - 1) * iw, Y = r => m.t + r / (N - 1) * ih;
  for (let c = 0; c < N; c++) {
    ctx.strokeStyle = SD_COL[c]; ctx.lineWidth = 6; ctx.beginPath();
    for (let j = 0; j < T; j++) { const x = X(j), y = Y(rank[c][j]); if (j) { const xm = (X(j - 1) + x) / 2; ctx.bezierCurveTo(xm, Y(rank[c][j - 1]), xm, y, x, y); } else ctx.moveTo(x, y); }
    ctx.stroke(); for (let j = 0; j < T; j++) { ctx.fillStyle = SD_COL[c]; ctx.beginPath(); ctx.arc(X(j), Y(rank[c][j]), 8, 0, 7); ctx.fill(); }
    ctx.fillStyle = SD_COL[c]; ctx.font = '600 20px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText(SD_CATS[c], m.l + iw + 16, Y(rank[c][T - 1]) + 6);
  }
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 20px JetBrains Mono'; ctx.textAlign = 'center';[0, T - 1].forEach(j => ctx.fillText(SD_YEARS[j], X(j), m.t + ih + 44)); ctx.textAlign = 'left';
}
function drawTraj(ctx, W, H) {
  const m = { l: 140, r: 96, t: 130, b: 116 }, iw = W - m.l - m.r, ih = H - m.t - m.b, T = SD_YEARS.length;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Healthy against unhealthy', m.l, 96);
  const xs = SD_YEARS.map((_, j) => SD[0][j] + SD[1][j] + SD[2][j]), ys = SD_YEARS.map((_, j) => SD[3][j] + SD[4][j] + SD[5][j]);
  const xmin = Math.min.apply(null, xs) - 3, xmax = Math.max.apply(null, xs) + 3, ymin = Math.min.apply(null, ys) - 3, ymax = Math.max.apply(null, ys) + 3;
  const X = v => m.l + (v - xmin) / (xmax - xmin) * iw, Y = v => m.t + ih - (v - ymin) / (ymax - ymin) * ih;
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ih); ctx.lineTo(m.l + iw, m.t + ih); ctx.stroke();
  ctx.strokeStyle = '#8DB0E4'; ctx.lineWidth = 4; ctx.beginPath(); SD_YEARS.forEach((_, j) => { const x = X(xs[j]), y = Y(ys[j]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  SD_YEARS.forEach((_, j) => { ctx.fillStyle = j === 0 ? '#6FB1E0' : j === T - 1 ? '#E8743B' : '#9C9B91'; ctx.beginPath(); ctx.arc(X(xs[j]), Y(ys[j]), j === 0 || j === T - 1 ? 12 : 7, 0, 7); ctx.fill(); });
  const j = T - 1, x1 = X(xs[j]), y1 = Y(ys[j]), an = Math.atan2(y1 - Y(ys[j - 1]), x1 - X(xs[j - 1])); ctx.fillStyle = '#E8743B'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 22 * Math.cos(an - 0.4), y1 - 22 * Math.sin(an - 0.4)); ctx.lineTo(x1 - 22 * Math.cos(an + 0.4), y1 - 22 * Math.sin(an + 0.4)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6FB1E0'; ctx.font = '600 22px JetBrains Mono'; ctx.textAlign = 'right'; ctx.fillText(SD_YEARS[0], X(xs[0]) - 16, Y(ys[0]) + 6); ctx.fillStyle = '#E8743B'; ctx.textAlign = 'left'; ctx.fillText(SD_YEARS[T - 1], X(xs[T - 1]) + 16, Y(ys[T - 1]) + 6);
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 23px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText('unhealthy share', m.l + iw / 2, m.t + ih + 60); ctx.save(); ctx.translate(m.l - 70, m.t + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('healthy share', 0, 0); ctx.restore(); ctx.textAlign = 'left';
}
function drawRose(ctx, W, H) {
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('The shift, in the round', 96, 96);
  const cx = W / 2, cy = H / 2 + 40, N = SD_CATS.length, RR = Math.min(W, H) * 0.34, LY = SD_YEARS.length - 1, mx = Math.max.apply(null, SD.flat());
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1; for (let g = 1; g <= 3; g++) { ctx.beginPath(); ctx.arc(cx, cy, RR * g / 3, 0, 7); ctx.stroke(); }
  for (let c = 0; c < N; c++) {
    const a0 = -Math.PI / 2 + c / N * 6.2832, a1 = -Math.PI / 2 + (c + 1) / N * 6.2832, mid = (a0 + a1) / 2, r24 = SD[c][LY] / mx * RR, r90 = SD[c][0] / mx * RR;
    ctx.fillStyle = SD_COL[c]; ctx.globalAlpha = 0.82; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r24, a0 + 0.02, a1 - 0.02); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ECEBE4'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(cx, cy, r90, a0 + 0.02, a1 - 0.02); ctx.stroke(); ctx.setLineDash([]);
    const lr = RR + 44; ctx.fillStyle = SD_COL[c]; ctx.font = '500 19px JetBrains Mono'; ctx.textAlign = Math.cos(mid) < -0.3 ? 'right' : Math.cos(mid) > 0.3 ? 'left' : 'center'; ctx.fillText(SD_CATS[c], cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr + 5);
  }
}
function drawSlogan(ctx, W, H) {
  ctx.textAlign = 'center'; ctx.fillStyle = '#ECEBE4'; ctx.font = '700 58px JetBrains Mono';
  ctx.fillText('Now imagine what', W / 2, H * 0.32); ctx.fillText('I could do with', W / 2, H * 0.32 + 74);
  ctx.fillStyle = '#8DB0E4'; ctx.fillText('your data.', W / 2, H * 0.32 + 152);
  ctx.fillStyle = '#9C9B91'; ctx.font = '400 32px JetBrains Mono'; ctx.fillText('tap to start your project', W / 2, H * 0.80); ctx.textAlign = 'left';
}
function drawCardBack(ctx, W, H, title, story) {
  ctx.textAlign = 'left'; ctx.fillStyle = '#8DB0E4'; ctx.font = '700 50px JetBrains Mono'; const ty = wrapText(ctx, title, 100, 170, W - 200, 62);
  ctx.fillStyle = '#C9C8C0'; ctx.font = '400 36px JetBrains Mono'; wrapText(ctx, story, 100, ty + 84, W - 200, 56);
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 28px JetBrains Mono'; ctx.fillText('click to flip back', 100, H - 76);
}
function heatColor(t) { const A = [16, 42, 67], B = [111, 177, 224], C = [232, 116, 59]; let r, g, b; if (t < 0.5) { const u = t / 0.5; r = A[0] + (B[0] - A[0]) * u; g = A[1] + (B[1] - A[1]) * u; b = A[2] + (B[2] - A[2]) * u; } else { const u = (t - 0.5) / 0.5; r = B[0] + (C[0] - B[0]) * u; g = B[1] + (C[1] - B[1]) * u; b = B[2] + (C[2] - B[2]) * u; } return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
function drawHeat(ctx, W, H) {
  const m = { l: 340, r: 90, t: 140, b: 90 }, iw = W - m.l - m.r, ih = H - m.t - m.b, T = SD_YEARS.length, N = SD_CATS.length, cw = iw / T, ch = ih / N, mx = Math.max.apply(null, SD.flat());
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('The same numbers, as heat', 96, 96);
  for (let c = 0; c < N; c++) { for (let j = 0; j < T; j++) { ctx.fillStyle = heatColor(SD[c][j] / mx); roundRect(ctx, m.l + j * cw + 3, m.t + c * ch + 3, cw - 6, ch - 6, 6); ctx.fill(); } ctx.fillStyle = SD_COL[c]; ctx.font = '500 22px JetBrains Mono'; ctx.textAlign = 'right'; ctx.fillText(SD_CATS[c], m.l - 18, m.t + c * ch + ch / 2 + 7); }
  ctx.fillStyle = '#6E6D64'; ctx.font = '400 20px JetBrains Mono'; ctx.textAlign = 'center';[0, T - 1].forEach(j => ctx.fillText(SD_YEARS[j], m.l + j * cw + cw / 2, m.t + ih + 42)); ctx.textAlign = 'left';
}
function drawRadar(ctx, W, H) {
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Every food at once', 96, 96);
  const cx = W / 2, cy = H / 2 + 40, R = Math.min(W, H) * 0.32, N = SD_CATS.length, LY = SD_YEARS.length - 1, mx = Math.max.apply(null, SD.flat());
  ctx.strokeStyle = '#2A2924'; ctx.lineWidth = 1;
  for (let g = 1; g <= 3; g++) { ctx.beginPath(); for (let c = 0; c <= N; c++) { const a = -Math.PI / 2 + c / N * 6.2832, r = R * g / 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; c ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
  for (let c = 0; c < N; c++) { const a = -Math.PI / 2 + c / N * 6.2832; ctx.strokeStyle = '#2A2924'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); const lr = R + 38; ctx.fillStyle = SD_COL[c]; ctx.font = '500 18px JetBrains Mono'; ctx.textAlign = Math.cos(a) < -0.3 ? 'right' : Math.cos(a) > 0.3 ? 'left' : 'center'; ctx.fillText(SD_CATS[c].split(' ')[0], cx + Math.cos(a) * lr, cy + Math.sin(a) * lr + 5); }
  function poly(idx, color, fill) { ctx.beginPath(); for (let c = 0; c <= N; c++) { const cc = c % N, a = -Math.PI / 2 + cc / N * 6.2832, r = SD[cc][idx] / mx * R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; c ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.stroke(); }
  poly(0, 'rgba(141,176,228,0.8)', null); poly(LY, '#E8743B', 'rgba(232,116,59,0.16)');
  ctx.fillStyle = '#8DB0E4'; ctx.font = '500 22px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('1990', 96, H - 56); ctx.fillStyle = '#E8743B'; ctx.fillText('2024', 230, H - 56);
}
function drawWaffle(ctx, W, H) {
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('A hundred plates', 96, 96);
  const LY = SD_YEARS.length - 1, tot = SD.reduce((s, r) => s + r[LY], 0), counts = SD.map(r => Math.round(r[LY] / tot * 100)), cells = []; counts.forEach((c, i) => { for (let k = 0; k < c; k++) cells.push(i); }); while (cells.length < 100) cells.push(0); cells.length = 100;
  const gx = 120, gy = 170, cell = Math.min((W - 660) / 10, (H - 260) / 10), gap = cell * 0.16;
  for (let i = 0; i < 100; i++) { const col = i % 10, row = (i / 10) | 0; ctx.fillStyle = SD_COL[cells[i]]; roundRect(ctx, gx + col * cell, gy + row * cell, cell - gap, cell - gap, 6); ctx.fill(); }
  let ly = gy + 22; const lx = gx + 10 * cell + 50; ctx.font = '400 23px JetBrains Mono'; ctx.textAlign = 'left';
  SD_CATS.forEach((nm, c) => { ctx.fillStyle = SD_COL[c]; ctx.fillRect(lx, ly - 18, 22, 22); ctx.fillStyle = '#ECEBE4'; ctx.fillText(nm + '  ' + counts[c], lx + 32, ly); ly += 46; });
}
function drawLollipop(ctx, W, H) {
  const recs = SD_CATS.map((nm, c) => ({ c: c, nm: nm, a: SD[c][0], b: SD[c][SD_YEARS.length - 1] })).sort((p, q) => q.b - p.b);
  const m = { l: 290, r: 110, t: 150, b: 80 }, iw = W - m.l - m.r, ih = H - m.t - m.b, N = recs.length, gap = ih / N, mx = Math.max.apply(null, SD.flat()) * 1.1, X = v => m.l + v / mx * iw;
  ctx.fillStyle = '#ECEBE4'; ctx.font = '700 44px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('From 1990 to now', 96, 96);
  recs.forEach((d, k) => { const y = m.t + gap * k + gap / 2; ctx.strokeStyle = '#3A3934'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X(d.a), y); ctx.lineTo(X(d.b), y); ctx.stroke(); ctx.fillStyle = '#5d6470'; ctx.beginPath(); ctx.arc(X(d.a), y, 10, 0, 7); ctx.fill(); ctx.fillStyle = SD_COL[d.c]; ctx.beginPath(); ctx.arc(X(d.b), y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#9C9B91'; ctx.font = '400 25px JetBrains Mono'; ctx.textAlign = 'right'; ctx.fillText(d.nm, m.l - 24, y + 8); });
  ctx.fillStyle = '#5d6470'; ctx.font = '500 22px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('1990', 96, H - 50); ctx.fillStyle = '#ECEBE4'; ctx.fillText('2024', 230, H - 50);
}
function cardCanvas(drawInner, ss) {
  ss = ss || 1; const cv = document.createElement('canvas'); cv.width = 1500 * ss; cv.height = 900 * ss; const ctx = cv.getContext('2d'); ctx.scale(ss, ss);
  ctx.fillStyle = 'rgba(11,11,10,0.92)'; roundRect(ctx, 8, 8, 1484, 884, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(141,176,228,0.42)'; ctx.lineWidth = 4; roundRect(ctx, 8, 8, 1484, 884, 30); ctx.stroke();
  drawInner(ctx, 1500, 900);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); return tex;
}
const CARD_GEO = new THREE.PlaneGeometry(3.0, 1.8);
const GALP = new THREE.Vector3(0, 0, -640);
const galGroup = new THREE.Group(); galGroup.position.copy(GALP); galGroup.visible = false; scene.add(galGroup);
const SMRING = innerWidth / innerHeight < 0.95; const RX = SMRING ? 4.7 : 7.4, RY = SMRING ? 5.6 : 4.3;
(function () { const n = 1100, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c1 = new THREE.Color(0xF5E1C2), c2 = new THREE.Color(0x8DB0E4); for (let i = 0; i < n; i++) { const t = Math.pow(Math.random(), 0.6), arm = Math.floor(Math.random() * 2), ang = t * 7 + arm * Math.PI + (Math.random() - 0.5) * 0.55, rad = t * 44; pos[i * 3] = Math.cos(ang) * rad; pos[i * 3 + 1] = Math.sin(ang) * rad * 0.62; pos[i * 3 + 2] = -30 + (Math.random() - 0.5) * 5; const cc = c1.clone().lerp(c2, t); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); const gs = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); galGroup.add(gs); galGroup.userData.spin = gs; })();
const storyPlanet = new THREE.Mesh(new THREE.SphereGeometry(3.0, 48, 48), new THREE.MeshStandardMaterial({ color: 0x3f7e72, roughness: 0.85, metalness: 0.1, emissive: 0x16302a, emissiveIntensity: 0.35 })); storyPlanet.position.set(-13, 6.5, -22); galGroup.add(storyPlanet);
const storyRing = new THREE.Mesh(new THREE.RingGeometry(3.7, 5.0, 64), new THREE.MeshBasicMaterial({ color: 0x9ec0ee, transparent: true, opacity: 0.16, side: THREE.DoubleSide })); storyRing.position.copy(storyPlanet.position); storyRing.rotation.set(1.15, 0.3, 0); galGroup.add(storyRing);
const storyMoon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 1 })); galGroup.add(storyMoon); let storyMoonA = 0;
const corridor = (function () { const n = 1500, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 86, y = (Math.random() - 0.5) * 60, z = -195 - Math.random() * 460, len = 2.5 + Math.random() * 6; pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z + len; } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ec0ee, transparent: true, opacity: 0 })); ls.visible = false; scene.add(ls); return ls; })();
const storyCards = [], storyPick = [];
const CARD_LO = 0.72, CARD_HI = 2.4;
function makeFigCard(frontDraw, title, story) {
  const flip = new THREE.Group(), backDraw = c => drawCardBack(c, 1500, 900, title, story);
  const fm = new THREE.Mesh(CARD_GEO, new THREE.MeshBasicMaterial({ map: cardCanvas(frontDraw, CARD_LO), transparent: true }));
  const bm = new THREE.Mesh(CARD_GEO, new THREE.MeshBasicMaterial({ map: cardCanvas(backDraw, CARD_LO), transparent: true })); bm.rotation.y = Math.PI;
  flip.add(fm, bm);
  const card = { flip: flip, focus: 0, phase: Math.random() * 6.28, home: new THREE.Vector3(), kind: 'fig', homeScale: 1, cs: 1, frontDraw: frontDraw, backDraw: backDraw, fm: fm, bm: bm, hi: false };
  fm.userData.card = card; bm.userData.card = card; storyPick.push(fm, bm); return card;
}
function setCardHi(card, on) {
  if (card.kind === 'final' || on === card.hi) return; card.hi = on;
  if (on) { card.loF = card.fm.material.map; card.loB = card.bm.material.map; card.fm.material.map = cardCanvas(card.frontDraw, CARD_HI); card.bm.material.map = cardCanvas(card.backDraw, CARD_HI); }
  else { card.fm.material.map.dispose(); card.bm.material.map.dispose(); card.fm.material.map = card.loF; card.bm.material.map = card.loB; }
  card.fm.material.needsUpdate = true; card.bm.material.needsUpdate = true;
}
const FIGS = [
  [drawBarS, 'Start simple.', 'This is just today’s plate as bars. Refined grains lead, sugary drinks have caught right up. Sometimes the clearest story is the plainest one.'],
  [drawStream, 'All of it, flowing.', 'Now every food is a flowing ribbon across 35 years. Watch the pink band of sugary drinks swell while the greens quietly thin out.'],
  [drawDonut, 'The whole plate.', 'The same year as one circle, so you can feel each food as a slice of the whole. Perfect when proportion is the point.'],
  [drawBump, 'The overtaking.', 'Here I rank them every single year. You can literally watch sugary drinks climb past whole grains and keep on rising.'],
  [drawWaffle, 'A hundred plates.', 'Picture a hundred plates of what the world eats today. Each little square is one. The sugary and refined ones now crowd the grid.'],
  [drawTraj, 'A journey.', 'I plot the healthy share against the unhealthy one, year by year. Follow the dot and you feel the world drift the wrong way.'],
  [drawLollipop, 'Then and now.', 'Each line runs from 1990 to today. Slide right and the food grew heavier on the plate, slide left and it got lighter. Quick and honest.'],
  [drawRadar, 'Every food at once.', 'The whole diet on six spokes. The blue outline is 1990, the warm shape is now. You can watch it bulge toward the heavy foods.'],
  [drawHeat, 'As heat.', 'Every square is one food in one year, and brighter means a bigger share. Your eye lands straight on the hot corner, sugary drinks, lately.'],
  [drawRose, 'In the round.', 'The same numbers as a bloom. Dashed is 1990, solid is today. You can see the balance tip as the warm wedges push outward.']
];
FIGS.forEach((d, i) => { const card = makeFigCard(d[0], d[1], d[2]); const a = -Math.PI / 2 + i / FIGS.length * 6.2832; card.home.set(Math.cos(a) * RX, Math.sin(a) * RY, (i % 2 ? 0.7 : -0.7)); card.flip.position.copy(card.home); galGroup.add(card.flip); storyCards.push(card); });
const finalCard = makeFigCard(drawSlogan, '', ''); finalCard.kind = 'final'; finalCard.homeScale = 1.3; finalCard.cs = 1.3; finalCard.home.set(0, 0, 1.2); finalCard.flip.position.copy(finalCard.home); finalCard.flip.scale.setScalar(1.3); finalCard.fm.material.map = cardCanvas(drawSlogan, 1.6); finalCard.fm.material.needsUpdate = true; galGroup.add(finalCard.flip); storyCards.push(finalCard);
// data constellation: light pulses flow from "your data" out to every story
const conCenter = new THREE.Vector3(0, 0, 1.2); let storyParts = null;
(function () {
  const figs = storyCards.filter(c => c.kind === 'fig'), lp = new Float32Array(figs.length * 6);
  figs.forEach((c, i) => { lp[i * 6] = conCenter.x; lp[i * 6 + 1] = conCenter.y; lp[i * 6 + 2] = conCenter.z; lp[i * 6 + 3] = c.home.x; lp[i * 6 + 4] = c.home.y; lp[i * 6 + 5] = c.home.z; });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  galGroup.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x6FB1E0, transparent: true, opacity: 0.13, depthWrite: false })));
  const PPL = 5, parts = []; figs.forEach(c => { for (let k = 0; k < PPL; k++) parts.push({ to: c.home, t: k / PPL }); });
  const pg = new THREE.BufferGeometry(), pp = new Float32Array(parts.length * 3); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  storyParts = { parts: parts, geo: pg, arr: pp };
  galGroup.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xBCD4F5, size: 0.18, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending })));
})();
const GALVIEW = GALP.clone().add(new THREE.Vector3(0, 0, 17));
const RETURN_DUR = 4600, RET_CP = new THREE.Vector3(50, 18, -80), STORY_ZERO = new THREE.Vector3(0, 0, 0);
let storyMode = null, storyT0 = 0; const STORY_DUR = 4400, flightStart = new THREE.Vector3(), flightStartTgt = new THREE.Vector3();
function enterStory() {
  if (storyMode) return;
  flightStart.copy(camera.position); flightStartTgt.copy(curTarget);
  storyMode = 'in'; storyT0 = performance.now(); galGroup.visible = true; corridor.visible = true; corridor.material.opacity = 0; galGroup.rotation.set(0, 0, 0);
  storyCards.forEach(c => { c.focus = 0; });
  document.body.classList.add('story-on'); document.getElementById('story-hud').classList.add('show');
}
function returnFromStory() {
  if (storyMode !== 'idle') return;
  flightStart.copy(camera.position); flightStartTgt.copy(curTarget);
  storyMode = 'out'; storyT0 = performance.now(); document.getElementById('story-hud').classList.remove('show');
}
document.getElementById('story-trigger').addEventListener('click', enterStory);
document.getElementById('sh-return').addEventListener('click', returnFromStory);
document.getElementById('sh-start').addEventListener('click', () => qov.classList.add('show'));

const BASE = { '1': [400, 900], '2': [1500, 4000], '3': [3000, 8000], '5': [12000, 40000], '6': [20000, 60000] }; // NT$, Taiwan market
const INC = { '1': 'One submission-ready figure, one revision.', '2': 'Full analysis, clean code, a results summary.', '3': 'Analysis plus every figure, two revisions.', '5': 'Cleaning through to a manuscript-ready study.', '6': 'A custom interactive dashboard like this one.' };
const qSel = { need: '1', data: '1', time: '1', cur: 'ntd' };
function quoteUpdate() {
  const b = BASE[qSel.need], mult = parseFloat(qSel.data) * parseFloat(qSel.time);
  const lo = b[0] * mult, hi = b[1] * mult; let sym, lov, hiv;
  if (qSel.cur === 'usd') { sym = 'US$'; lov = Math.round(lo / 31.5 / 5) * 5; hiv = Math.round(hi / 31.5 / 5) * 5; }
  else { sym = 'NT$'; lov = Math.round(lo / 100) * 100; hiv = Math.round(hi / 100) * 100; }
  document.getElementById('q-num').textContent = sym + lov.toLocaleString() + ' - ' + hiv.toLocaleString();
  document.getElementById('q-inc').textContent = INC[qSel.need];
  document.getElementById('q-cta').href = 'mailto:Bookhaali@gmail.com?subject=' + encodeURIComponent('Project scope inquiry') + '&body=' + encodeURIComponent('Need: ' + document.querySelector('[data-q=need] .opt.on').textContent + '\nData: ' + document.querySelector('[data-q=data] .opt.on').textContent + '\nTimeline: ' + document.querySelector('[data-q=time] .opt.on').textContent + '\n\nProject details:');
}
document.querySelectorAll('.q').forEach(q => q.querySelectorAll('.opt').forEach(o => o.addEventListener('click', () => { q.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); o.classList.add('on'); qSel[q.dataset.q] = o.dataset.v; quoteUpdate(); })));
quoteUpdate();

// ---- scroll-snap sections (stable landing on each station) ----
const ssEl = document.getElementById('scroll-space'); ssEl.style.height = 'auto';
for (let i = 0; i < N; i++) { const d = document.createElement('div'); d.className = 'snap'; ssEl.appendChild(d); }

// ---- init ----
buildScatter(); buildSurface(); buildDiet(); buildCancer(); setTime(1); drawLag(); drawForecast(); drawCollab(META.length); drawStoryTable();

// ---- loop ----
const scrollFrac = () => { const h = document.body.scrollHeight - innerHeight; return h > 0 ? clamp(scrollY / h, 0, 1) : 0; };
// Earth data intro: on arrival, the world's obesity rises 1990->2024 (spikes grow, % counts up)
let earthIntro = false, earthIntroT0 = 0;
function startEarthIntro() { earthIntro = true; earthIntroT0 = performance.now(); }
function updateDataHint() {
  const num = document.getElementById('dh-num'); if (!num) return;
  const g = OB.layers[pop].global, i = obIdx(), yrs = OB.layers[pop].years;
  num.textContent = g[i].toFixed(1) + '%';
  document.getElementById('dh-lab').textContent = "of the world's " + (pop === 'adol' ? 'youth' : 'adults') + ' live with obesity';
  document.getElementById('dh-sub').textContent = yrs[0] + '  ' + g[0].toFixed(1) + '%   →   ' + yrs[i] + '  ' + g[i].toFixed(1) + '%';
}
function animate() {
  requestAnimationFrame(animate);
  const fit = clamp(1.5 / Math.max(0.42, innerWidth / innerHeight), 1, 2.0);   // pull back on narrow/portrait screens
  if (storyMode) {
    for (const g of WORLD_GROUPS) g.visible = false;
    galGroup.visible = true; corridor.visible = true;
    const now = performance.now(), tms = now * 0.001, aspect = innerWidth / innerHeight, TAN = 0.3839, ringDist = Math.max((RX + 1.7) / (TAN * aspect), (RY + 1.1) / TAN, 15) * 1.06, focusZ = ringDist - Math.max(2.925 / (0.9 * TAN * aspect), 1.755 / (0.9 * TAN)), galView = GALVIEW.clone(); galView.z = GALP.z + ringDist;
    if (storyMode === 'in') { const e = smooth(clamp((now - storyT0) / STORY_DUR, 0, 1)), it = 1 - e, cx = (flightStart.x + galView.x) / 2 - 50, cy = (flightStart.y + galView.y) / 2 + 20, cz = (flightStart.z + galView.z) / 2; camera.position.set(it * it * flightStart.x + 2 * it * e * cx + e * e * galView.x, it * it * flightStart.y + 2 * it * e * cy + e * e * galView.y, it * it * flightStart.z + 2 * it * e * cz + e * e * galView.z); curTarget.lerpVectors(flightStartTgt, GALP, e); corridor.material.opacity = Math.sin(e * Math.PI) * 0.95; if (e >= 1) storyMode = 'idle'; }
    else if (storyMode === 'idle') { camera.position.lerp(galView, 0.05); curTarget.lerp(GALP, 0.05); corridor.material.opacity *= 0.9; }
    else { const raw = clamp((now - storyT0) / RETURN_DUR, 0, 1), t = smooth(raw), it = 1 - t, ep = STATIONS[0].camPos.clone().multiplyScalar(fit); globePivot.visible = true; camera.position.set(it * it * flightStart.x + 2 * it * t * RET_CP.x + t * t * ep.x, it * it * flightStart.y + 2 * it * t * RET_CP.y + t * t * ep.y, it * it * flightStart.z + 2 * it * t * RET_CP.z + t * t * ep.z); curTarget.lerpVectors(flightStartTgt, STORY_ZERO, smooth(clamp(raw / 0.62, 0, 1))); corridor.material.opacity = Math.max(0, Math.sin(clamp(raw / 0.6, 0, 1) * Math.PI)) * 0.9; if (raw >= 1) { storyMode = null; galGroup.visible = false; corridor.visible = false; curStation = 0; onStation(0); document.body.classList.remove('story-on'); try { scrollTo(0, 0); } catch (er) {} } }
    camera.lookAt(curTarget);
    let anyFocus = false;
    for (const c of storyCards) { const f = c.focus; if (f) anyFocus = true; const tx = f ? 0 : c.home.x, ty = f ? 0 : c.home.y + Math.sin(tms * 0.6 + c.phase) * 0.13, tz = f ? focusZ : c.home.z; c.flip.position.lerp(new THREE.Vector3(tx, ty, tz), 0.12); const ts = f ? 1.95 : c.homeScale; c.cs += (ts - c.cs) * 0.12; c.flip.scale.setScalar(c.cs); const tr = f === 2 ? Math.PI : 0; c.flip.rotation.y += (tr - c.flip.rotation.y) * 0.14; }
    if (anyFocus) { galGroup.rotation.y += -galGroup.rotation.y * 0.1; galGroup.rotation.x += -galGroup.rotation.x * 0.1; }
    storyPlanet.rotation.y += 0.0016; storyMoonA += 0.012; storyMoon.position.set(storyPlanet.position.x + Math.cos(storyMoonA) * 5.2, storyPlanet.position.y + Math.sin(storyMoonA) * 1.6, storyPlanet.position.z + Math.sin(storyMoonA) * 5.2);
    if (storyParts) { const a = storyParts.arr, ps = storyParts.parts; for (let i = 0; i < ps.length; i++) { ps[i].t += 0.0045; if (ps[i].t > 1) ps[i].t -= 1; const tt = ps[i].t, to = ps[i].to; a[i * 3] = conCenter.x + (to.x - conCenter.x) * tt; a[i * 3 + 1] = conCenter.y + (to.y - conCenter.y) * tt; a[i * 3 + 2] = conCenter.z + (to.z - conCenter.z) * tt; } storyParts.geo.attributes.position.needsUpdate = true; }
    if (galGroup.userData.spin) galGroup.userData.spin.rotation.z += 0.0003;
    renderer.render(scene, camera); return;
  }
  let focus, zoom = 1;
  if (introActive) focus = 0;
  else if (demoActive) {
    const beat = DWELL + TRAVEL, el = performance.now() - demoStart, idx = Math.floor(el / beat);
    if (idx >= N - 1) { const dw = el - (N - 1) * beat; focus = N - 1; zoom = 1 - 0.18 * Math.sin(Math.PI * clamp(dw / DWELL, 0, 1)); if (dw > DWELL + 600) stopTour(); }
    else { const ph = el - idx * beat; if (ph < DWELL) { focus = idx; zoom = 1 - 0.18 * Math.sin(Math.PI * (ph / DWELL)); } else focus = idx + smooth((ph - DWELL) / TRAVEL); }
  }
  else focus = scrollFrac() * (N - 1);
  for (let k = 0; k < WORLD_GROUPS.length; k++) WORLD_GROUPS[k].visible = Math.abs(focus - k) < 0.95;   // one world per beat (no bleed-through)
  moon.visible = focus < 1.8;
  if (introActive) {
    const t = Math.min(1, (performance.now() - introStart) / 3200), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const end = STATIONS[0].camPos.clone().multiplyScalar(fit);
    camera.position.lerpVectors(introFrom, end, e); camera.lookAt(0, 0, 0);
    if (t > 0.5) document.getElementById('intro').classList.add('gone');
    if (t >= 1 || scrollY > 12) { introActive = false; curTarget.copy(STATIONS[0].camTarget); curStation = 0; onStation(0); document.getElementById('intro').classList.add('gone'); startEarthIntro(); }
  } else {
    const i = Math.min(N - 2, Math.max(0, Math.floor(focus))), e = demoActive ? (focus - i) : smooth(focus - i);
    desiredTarget.lerpVectors(STATIONS[i].camTarget, STATIONS[i + 1].camTarget, e);
    desiredPos.lerpVectors(STATIONS[i].camPos, STATIONS[i + 1].camPos, e);
    const ff = fit * zoom; if (Math.abs(ff - 1) > 0.001) desiredPos.sub(desiredTarget).multiplyScalar(ff).add(desiredTarget);
    const lp = demoActive ? 0.07 : 0.1;
    camera.position.lerp(desiredPos, lp); curTarget.lerp(desiredTarget, lp); camera.lookAt(curTarget);
    const cs = Math.round(focus); if (cs !== curStation) { curStation = cs; onStation(cs); yearEl.textContent = yearLabel(); }
  }
  if (earthIntro) { if (curStation !== 0 || performance.now() - earthIntroT0 > 5000) { earthIntro = false; if (curStation === 0) setTime(1); } else setTime(clamp((performance.now() - earthIntroT0 - 400) / 4200, 0, 1)); }
  globe.rotation.y += 0.0006; aboutSpin.rotation.y += 0.0012; finalSpin.rotation.y += 0.0022; moon.rotation.y += 0.0008; rankSpin.rotation.y += 0.0014;
  toolsGroup.rotation.y = Math.sin(performance.now() * 0.00045) * 0.13;
  for (const m of spikes) { if (!m.visible) continue; const u = m.userData; u.cur += (u.target - u.cur) * 0.16; m.scale.y = u.cur; }
  if (hotSpike && globePivot.visible) { const b = hotSpike.position, len = Math.hypot(b.x, b.y, b.z), ux = b.x / len, uy = b.y / len, uz = b.z / len, h = hotSpike.userData.cur; hotMarker.position.set(b.x + ux * (h + 0.02), b.y + uy * (h + 0.02), b.z + uz * (h + 0.02)); hotMarker.scale.setScalar(1 + 0.4 * Math.sin(performance.now() * 0.005)); hotLabel.position.set(b.x + ux * (h + 0.14), b.y + uy * (h + 0.14), b.z + uz * (h + 0.14)); }
  for (const m of dietFoods) { const u = m.userData; u.cur += (u.target - u.cur) * 0.16; m.scale.setScalar(u.cur); }
  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
window.__dbg = { THREE, scene, camera, STATIONS };
