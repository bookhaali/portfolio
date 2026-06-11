/* Shared ambient starfield for the content pages (research / studio / notes).
   Subtle twinkle + slow drift so they feel continuous with the 3D journey.
   Uses an existing <canvas id="stars">. Respects prefers-reduced-motion;
   pauses when the tab is hidden. */
(function () {
  const cv = document.getElementById('stars');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLS = ['255,255,255', '188,212,245', '245,225,194', '158,192,238', '224,162,74', '111,200,163'];
  let stars = [], W = 0, H = 0, dpr = 1, raf = 0;

  function build() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.width = Math.floor(innerWidth * dpr);
    H = cv.height = Math.floor(innerHeight * dpr);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const n = Math.max(70, Math.min(240, Math.round(innerWidth * innerHeight / 8500)));
    stars = [];
    for (let i = 0; i < n; i++) {
      const warm = Math.random() > 0.82;
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: (0.4 + Math.random() * 1.25) * dpr,
        base: 0.12 + Math.random() * 0.5,
        sp: 0.5 + Math.random() * 1.3, ph: Math.random() * 6.283,
        vx: (Math.random() - 0.5) * 0.05 * dpr,
        vy: (-0.02 - Math.random() * 0.05) * dpr,
        col: warm ? COLS[2 + (Math.random() * 4 | 0)] : (Math.random() > 0.5 ? COLS[1] : COLS[0])
      });
    }
  }

  function paint(tw) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = tw == null ? s.base : s.base * (0.5 + 0.5 * Math.sin(tw * s.sp + s.ph));
      ctx.fillStyle = 'rgba(' + s.col + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
  }

  function frame(t) {
    const tw = t * 0.001;
    for (const s of stars) {
      s.x += s.vx; s.y += s.vy;
      if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
      else if (s.y > H + 2) s.y = -2;
      if (s.x < -2) s.x = W + 2; else if (s.x > W + 2) s.x = -2;
    }
    paint(tw);
    raf = requestAnimationFrame(frame);
  }

  build();
  addEventListener('resize', () => { build(); if (reduce) paint(null); });
  if (reduce) paint(null);
  else raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!reduce && !raf) raf = requestAnimationFrame(frame);
  });
})();
