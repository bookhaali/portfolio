/* ghostsprite.js: the et al. ghost (bot-avatars engine, botavatars.js) standing in a Three.js scene.
   The engine draws the ghost in 2D with its own plastic shading; we paint that onto a
   camera-facing sprite each frame, so the 3D room gets the exact same character.
   Same interface as ghost3d.js: { group, update(dt,t), lookAt(vec|null), poke(), wave(), setNight(bool) } */
export function createGhost(THREE, opts = {}) {
  const B = window.BotAvatars, cam = opts.camera, canvasEl = opts.canvas;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PX = 400, O = B.OVERSCAN, RISE = B.RISE;
  const preset = B.botAvatarPresets.ghost;
  let night = false;
  const cfgFor = () => {
    const body = night ? preset.color : '#faf6f0';
    return { path: new Path2D(B.SHAPE_PATHS.ghost), face: preset.face, faceX: preset.faceX, faceY: preset.faceY,
      faceScale: preset.faceScale, color: body, ink: B.autoInk(body), shading: 'plastic',
      shadow: night ? .35 : .44, highlight: 1.3, depth: .65, light: 265, rim: night ? .5 : .62, spread: 1.55, typeKey: 'ghost', still: false,
      whirl: { strength: 0, size: 1, width: 1, length: 1, tilt: 1 },
      parts: B.SHAPE_PARTS.ghost ? new Path2D(B.SHAPE_PARTS.ghost) : undefined, dpr: 1 };
  };
  let cfg = cfgFor();
  try { B.warmPlastic('ghost', new Path2D(B.SHAPE_PATHS.ghost), PX, .65); } catch (e) {}
  const sim = new B.Sim(Math.random(), 'default'); sim.setTurn(1);

  const c = document.createElement('canvas'); c.width = c.height = Math.round(PX * O);
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, toneMapped: false, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);

  // sizes in world units: the ghost's body is about .78 of the engine size wide
  const u = (opts.width || .95) / .78, hover = .32;
  sprite.scale.set(O * u, O * u, 1);
  sprite.position.y = hover + .38 * u + RISE * u;   // puts the skirt's lowest point at `hover`
  const group = new THREE.Group(), bob = new THREE.Group(); group.add(bob); bob.add(sprite);

  // a sprite cannot cast a shadow, so an invisible ghost-shaped body casts it for the sprite
  const R = .44 * (opts.width || .95) / .95, top = hover + .89 * (opts.width || .95) / .95, prof = [new THREE.Vector2(0, hover), new THREE.Vector2(R * 1.04, hover)];
  for (let i = 0; i <= 16; i++) { const a = (16 - i) / 16 * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * R, top - R + Math.cos(a) * R)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  body.castShadow = true; bob.add(body);

  // soft contact shadow, as in ghost3d.js
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const g = sx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = g; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .045;   // above the rug group.add(shadow);

  // where to look: a 3D target, or the pointer, both measured on screen like the et al. pages do
  let target = null;
  const ptr = { x: NaN, y: NaN };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const toScreen = p => { w.copy(p).project(cam); const r = canvasEl.getBoundingClientRect(); return [r.left + (w.x + 1) / 2 * r.width, r.top + (1 - w.y) / 2 * r.height]; };
  function aim() {
    if (!cam || !canvasEl) return sim.setPointer(0, 0, 0);
    sprite.getWorldPosition(v); v.y -= RISE * u * group.scale.y;          // the engine's draw point
    const [cx, cy] = toScreen(v);
    v.x += u * group.scale.x; const [ex] = toScreen(v); const box = Math.max(20, Math.abs(ex - cx));
    let tx, ty;
    if (target) [tx, ty] = toScreen(target);
    else { if (isNaN(ptr.x)) return sim.setPointer(0, 0, 0); tx = ptr.x; ty = ptr.y; }
    const dx = (tx - cx) / box, dy = (ty - cy) / box, d = Math.hypot(dx, dy), REACH = 7;
    const st = target ? 1 : d < 1 ? 1 : d > REACH ? 0 : 1 - (d - 1) / (REACH - 1);
    sim.setPointer(dx / Math.max(1, d), dy / Math.max(1, d), st);
  }

  function paint() {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    B.draw(x, PX, sim.pose, cfg);
    tex.needsUpdate = true;
  }
  paint();

  function update(dt, t) {
    aim();
    if (!reduce) { sim.update(Math.min(dt, .05)); bob.position.y = Math.sin(t * 1.5) * .04; shadow.scale.setScalar(1 - Math.sin(t * 1.5) * .06); }
    paint();
  }
  return {
    group, update, sprite,
    lookAt(p) { target = p ? p.clone() : null; },
    poke() { if (!reduce) sim.poke(); },
    wave() { if (!reduce) sim.poke(); },
    setNight(n) { night = !!n; cfg = cfgFor(); mat.color.set(night ? 0xD4D8E6 : 0xffffff); paint(); }
  };
}
