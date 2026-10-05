/* Site-wide light and dark mode.
   Load it in <head>, before any stylesheet that reads html[data-theme], so the page never
   flashes the wrong colours. The site is dark unless a visitor flips the switch to light;
   that choice is then kept on every page and tab.

   The Journey (index.html) does not load this file: it is always dark.
   Pages style light mode with html[data-theme="light"] { ...tokens... }.
   Scripts that draw their own colours (WebGL, canvas) listen with SiteTheme.onChange(fn).
   The switch mounts itself into any [data-theme-toggle] element, or else into the
   site header's nav, just before the "Hire me" button. */
(function () {
  var KEY = 'theme', root = document.documentElement;
  function stored() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  var mode = stored() || 'dark', subs = [];
  function paint() { root.setAttribute('data-theme', mode); root.style.colorScheme = mode; }
  paint();

  function set(m, save) {
    if (m !== 'light' && m !== 'dark') return;
    if (save !== false) { try { localStorage.setItem(KEY, m); } catch (e) {} }
    if (m === mode) return;
    mode = m;
    // colours ease across for a moment, then transitions go back to whatever each page defines
    root.classList.add('theme-anim'); paint();
    clearTimeout(set.t); set.t = setTimeout(function () { root.classList.remove('theme-anim'); }, 650);
    subs.forEach(function (f) { try { f(mode); } catch (e) {} });
    sync();
  }
  addEventListener('storage', function (e) { if (e.key === KEY && e.newValue) set(e.newValue, false); });

  var SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  var buttons = [];
  function sync() {
    buttons.forEach(function (b) {
      // the icon shows the mode you would switch to
      b.innerHTML = mode === 'light' ? MOON : SUN;
      b.setAttribute('aria-label', mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      b.setAttribute('title', mode === 'light' ? 'Dark mode' : 'Light mode');
    });
  }
  function button() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'theme-toggle';
    b.addEventListener('click', function () { set(mode === 'light' ? 'dark' : 'light'); });
    buttons.push(b); sync(); return b;
  }

  var css = document.createElement('style');
  css.textContent =
    '.theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;padding:0;border-radius:50%;' +
    'border:1px solid var(--border,rgba(127,127,127,.3));background:transparent;color:var(--text,currentColor);cursor:pointer;transition:border-color .2s,background .2s}' +
    '.theme-toggle:hover{border-color:var(--muted,currentColor)}' +
    '.theme-toggle:focus-visible{outline:2px solid var(--accent,#8DB0E4);outline-offset:2px}' +
    'html.theme-anim,html.theme-anim *,html.theme-anim *::before,html.theme-anim *::after{transition:background-color .5s ease,color .5s ease,border-color .5s ease,fill .5s ease,stroke .5s ease,box-shadow .5s ease!important}';
  document.head.appendChild(css);

  function mount() {
    var slots = document.querySelectorAll('[data-theme-toggle]');
    if (slots.length) { slots.forEach(function (s) { s.appendChild(button()); }); return; }
    var nav = document.querySelector('header.site nav.top');
    if (!nav) return;
    var b = button(), hire = nav.querySelector('.primary');
    nav.insertBefore(b, hire || null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  window.SiteTheme = {
    get: function () { return mode; },
    set: function (m) { set(m); },
    toggle: function () { set(mode === 'light' ? 'dark' : 'light'); },
    onChange: function (f) { subs.push(f); },
    button: button
  };
})();
