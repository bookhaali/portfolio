/* Mobile: collapse the top nav into a hamburger dropdown so the header
   never clutters or clips. Shared across the content pages. Desktop is
   untouched (the toggle is display:none above 640px). */
(function () {
  const header = document.querySelector('header.site');
  const nav = header && header.querySelector('nav.top');
  if (!header || !nav) return;

  const css = document.createElement('style');
  css.textContent =
    '.nav-toggle{display:none}' +
    '@media(max-width:640px){' +
    '  .nav-toggle{display:inline-flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;' +
    '    width:40px;height:34px;flex:0 0 auto;background:none;border:1px solid var(--border,#2A2924);border-radius:6px;cursor:pointer}' +
    '  .nav-toggle span{display:block;height:2px;width:18px;border-radius:2px;background:var(--text,#ECEBE4);transition:transform .2s ease,opacity .2s ease}' +
    '  .nav-toggle.open span:nth-child(1){transform:translateY(6px) rotate(45deg)}' +
    '  .nav-toggle.open span:nth-child(2){opacity:0}' +
    '  .nav-toggle.open span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}' +
    '  header.site nav.top{position:absolute;top:calc(100% + 6px);right:.7rem;left:auto;min-width:190px;' +
    '    flex-direction:column;align-items:stretch;gap:2px;background:rgba(15,15,13,.98);backdrop-filter:blur(16px) saturate(1.2);' +
    '    border:1px solid var(--glass-bd,rgba(236,235,228,.12));border-radius:10px;padding:.45rem;' +
    '    opacity:0;pointer-events:none;transform:translateY(-8px);transition:opacity .18s ease,transform .18s ease;' +
    '    box-shadow:0 18px 44px rgba(0,0,0,.55);max-height:none}' +
    '  header.site nav.top.open{opacity:1;pointer-events:auto;transform:none}' +
    '  header.site nav.top a{display:block;width:100%;padding:12px 14px;font-size:.78rem;letter-spacing:.02em;border-radius:6px;text-align:left;white-space:nowrap}' +
    '  header.site nav.top a.home{display:block}' +
    '  header.site nav.top a.primary{margin-top:3px;text-align:center}' +
    '}';
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.className = 'nav-toggle'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span><span></span>';
  header.appendChild(btn);

  function setOpen(o) {
    nav.classList.toggle('open', o);
    btn.classList.toggle('open', o);
    btn.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!nav.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target) && e.target !== btn && !btn.contains(e.target)) setOpen(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  addEventListener('resize', function () { if (innerWidth > 640) setOpen(false); });
})();
