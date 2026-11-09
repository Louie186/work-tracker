/* ═══════════════════════════════════════════════════════════════════
   core/theme.js — ONE theme for every page (tracker + every skill tab)
   ───────────────────────────────────────────────────────────────────
   • Saved once per device in localStorage "lt_theme_v1".
   • Change it anywhere (Settings, a skill's own ☀/🌙 button) and every
     open page and tab follows straight away — no reload.
   • Pages read it with LTTheme.get() and react with LTTheme.onChange(fn).
   • The colours live in core/theme.css (one block per skin).
   Skins:  gold (default) · pastel · rose · gb (8-bit Game Boy) · arc (8-bit Arcade)
           rc (Retro Console, dark) · pp (Pixel Paper, light) · a16 (16-bit Arcade, dark)
           slate (clean flat dashboard, dark / light)
           — rc, pp and a16 are "readable 8-bit": pixel font only on titles, main tabs
             and big numbers (class lt-retro), everything else plain.
   Modes:  dark · light   (pastel and rose are always light)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'lt_theme_v1';
  var SKINS = {
    gold:   { name: 'Gold',              swatch: ['#d8b76d', '#070807'], pixel: false, modes: true },
    pastel: { name: 'Pastel',            swatch: ['#a08050', '#f0ede6'], pixel: false, modes: false, fixed: 'light' },
    rose:   { name: 'Rose (Melliea)',    swatch: ['#c8748e', '#fdf0f3'], pixel: false, modes: false, fixed: 'light' },
    gb:     { name: '8-bit Game Boy',    swatch: ['#8fd16a', '#141a12'], pixel: true,  modes: true },
    arc:    { name: '8-bit Arcade',      swatch: ['#ff3d7f', '#0e0b1c'], pixel: true,  modes: true },
    rc:     { name: '🎮 Retro Console',   swatch: ['#e4473b', '#16171d'], pixel: false, retro: true, modes: false, fixed: 'dark' },
    pp:     { name: '📜 Pixel Paper',     swatch: ['#d9822b', '#f6f0e1'], pixel: false, retro: true, modes: false, fixed: 'light' },
    a16:    { name: '🕹 16-bit Arcade',    swatch: ['#ff4fa3', '#141228'], pixel: false, retro: true, modes: false, fixed: 'dark' },
    slate:  { name: '◧ Slate',            swatch: ['#3f86a8', '#080b0f'], pixel: false, modes: true }
  };
  var DEFAULT = { skin: 'gold', mode: 'dark', auto: false, sound: true };
  var listeners = [];
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    var t = null;
    try { t = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { t = null; }
    t = Object.assign({}, DEFAULT, t || {});
    if (!SKINS[t.skin]) t.skin = 'gold';
    if (t.mode !== 'light') t.mode = 'dark';
    return t;
  }
  function has() { try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; } }
  // The mode actually shown (auto follows the computer; fixed skins force light)
  function effective(t) {
    t = t || read();
    var s = SKINS[t.skin];
    var mode = t.mode;
    if (t.auto && mq) mode = mq.matches ? 'dark' : 'light';
    if (s.fixed) mode = s.fixed;
    return { skin: t.skin, mode: mode, pixel: !!s.pixel, retro: !!s.retro, auto: !!t.auto, sound: t.sound !== false };
  }
  function apply() {
    var e = effective();
    var h = document.documentElement;
    h.setAttribute('data-lt-skin', e.skin);
    h.setAttribute('data-lt-mode', e.mode);
    h.classList.toggle('lt-pixel', e.pixel);
    h.classList.toggle('lt-retro', e.retro);
    h.style.colorScheme = e.mode;
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (err) { console.warn('theme listener', err); } }
    return e;
  }
  function set(patch) {
    var t = Object.assign(read(), patch || {});
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
    var e = apply();
    // nudge child frames too (storage events already reach them; this is a backup)
    try { for (var i = 0; i < window.frames.length; i++) window.frames[i].postMessage({ ltTheme: 1 }, '*'); } catch (err) {}
    return e;
  }
  function toggleMode() {
    var e = effective();
    return set({ mode: e.mode === 'dark' ? 'light' : 'dark', auto: false });
  }
  function onChange(fn) { listeners.push(fn); try { fn(effective()); } catch (e) {} }

  window.addEventListener('storage', function (ev) { if (ev.key === KEY) apply(); });
  window.addEventListener('message', function (ev) { if (ev.data && ev.data.ltTheme && ev.origin === location.origin) apply(); });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (read().auto) apply(); });

  window.LTTheme = { KEY: KEY, SKINS: SKINS, get: effective, raw: read, has: has, set: set, apply: apply, toggleMode: toggleMode, onChange: onChange };
  apply();
})();
