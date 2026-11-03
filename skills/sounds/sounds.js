/* ═══ SKILL (add-on): 8-bit sounds & XP ════════════════════════════
   Only on the 8-bit skins (Game Boy / Arcade):
   • tiny chiptune blip on buttons, a jingle when a task is finished
     (here or in Delegation), a fanfare on level-up
   • XP level in the sidebar: 10 XP per finished task, 5 per finished
     team item, 5 per streak day.  Sounds can be muted in Settings → Theme.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ctx = null;
  function on() { var e = window.LTTheme && LTTheme.get(); return !!(e && (e.pixel || e.retro) && e.sound); }
  function ac() { if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  // notes: [frequency Hz, start s, length s]
  function play(notes, vol) {
    if (!on()) return; var a = ac(); if (!a) return;
    var t0 = a.currentTime + 0.01;
    notes.forEach(function (n) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(n[0], t0 + n[1]);
      g.gain.setValueAtTime(vol || 0.04, t0 + n[1]); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
      o.connect(g); g.connect(a.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.02);
    });
  }
  var SFX = {
    blip: function () { play([[880, 0, 0.05]], 0.025); },
    done: function () { play([[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.08], [1047, 0.24, 0.16]]); },
    level: function () { play([[392, 0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.1], [784, 0.3, 0.1], [1047, 0.4, 0.12], [784, 0.52, 0.08], [1047, 0.6, 0.3]], 0.05); }
  };
  LT.sfx = SFX;

  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.btn,.icon,nav button,.template,.lt-skill-pick,.pulse-tile')) SFX.blip();
  }, true);
  window.addEventListener('message', function (ev) {
    if (ev.origin === location.origin && ev.data && ev.data.lt === 'sfx' && SFX[ev.data.kind]) { SFX[ev.data.kind](); setTimeout(paint, 400); }
  });

  /* ---------- XP ---------- */
  function xp() {
    var tasks = ((LT.data() && LT.data().tasks) || []).filter(function (t) { return t.status === 'done'; }).length;
    var team = 0, D = LT.readJSON('lt_delegate_v1', null);
    ((D && D.tasks) || []).forEach(function (t) { (t.subs && t.subs.length ? t.subs : [t]).forEach(function (s) { if (s.status === 'Completed') team++; }); });
    var streak = 0;
    try { var s = JSON.parse(localStorage.getItem('lt_streak_' + (LT.user() || 'guest')) || '{}'); streak = s.count || 0; } catch (e) {}
    return tasks * 10 + team * 5 + streak * 5;
  }
  function levelOf(x) { return Math.floor(Math.sqrt(x / 40)) + 1; }
  function paint() {
    var box = document.querySelector('.sidebox'); if (!box || !LT.data()) return;
    var chip = document.getElementById('xpChip');
    var e = window.LTTheme && LTTheme.get();
    if (!e || !e.pixel) { if (chip) chip.style.display = 'none'; return; }
    if (!chip) { chip = document.createElement('div'); chip.id = 'xpChip'; box.insertBefore(chip, box.firstChild); }
    chip.style.display = '';
    var x = xp(), lv = levelOf(x), lo = Math.pow(lv - 1, 2) * 40, hi = Math.pow(lv, 2) * 40, pct = Math.round((x - lo) / (hi - lo) * 100);
    var blocks = ''; for (var i = 0; i < 10; i++) blocks += i < Math.round(pct / 10) ? '▮' : '▯';
    chip.innerHTML = '<b>LV ' + lv + '</b> <span>' + blocks + '</span><small>' + x + ' XP · ' + (hi - x) + ' to next</small>';
    var k = 'lt_xp_level_' + (LT.user() || 'guest'), prev = +localStorage.getItem(k) || 0;
    if (prev && lv > prev) { SFX.level(); LT.toast('⭐ LEVEL UP — LV ' + lv + '!'); }
    localStorage.setItem(k, String(lv));
  }
  var css = document.createElement('style');
  css.textContent = '#xpChip{font-family:var(--px-font,monospace);margin-bottom:8px;line-height:1.3}#xpChip b{color:var(--accent)}#xpChip span{letter-spacing:-1px;color:var(--accent)}#xpChip small{display:block;color:var(--muted);font-size:.62rem}';
  document.head.appendChild(css);
  // jingle + XP refresh when a task is ticked off
  function wrapDone() {
    if (typeof window.toggleDone !== 'function' || window.toggleDone.__sfx) return;
    var orig = window.toggleDone;
    window.toggleDone = function (id) {
      var t = LT.data() && LT.data().tasks.filter(function (x) { return x.id === id; })[0], was = t && t.status === 'done';
      var r = orig.apply(this, arguments);
      if (t && !was && t.status === 'done') SFX.done();
      setTimeout(paint, 300);
      return r;
    };
    window.toggleDone.__sfx = true;
  }
  wrapDone();
  if (window.LTTheme) LTTheme.onChange(function () { setTimeout(paint, 0); });
  window.addEventListener('storage', function (e) { if (e.key === 'lt_delegate_v1') paint(); });
  var tm = setInterval(function () { if (LT.data()) { clearInterval(tm); paint(); } }, 1000);
})();
