/* ═══════════════════════════════════════════════════════════════════
   core/slate.js — two small upgrades borrowed from the "Project
   Management Dashboard" look (works with every theme):
   • Rail menu: the ▯ button (or the [ key) folds the side menu down to
     icons only, with a smooth slide. Remembered on this device.
   • "This week" chart: tasks finished each day, Mon–Sun. Today is the
     solid bar; the other days are striped.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'lt_rail_v1';
  function app() { return document.querySelector('.app'); }

  // keep the sliding highlight on the right menu item, and give icons a tooltip
  function fixNav() {
    var a = app(), rail = a && a.classList.contains('is-rail');
    document.querySelectorAll('#nav button[data-view]').forEach(function (b) {
      var t = b.querySelector('span:not(.navicon)');
      if (rail && t) b.title = t.textContent; else b.removeAttribute('title');
    });
    var on = document.querySelector('#nav button.active'), ind = document.getElementById('navIndicator');
    if (on && ind) { ind.style.top = on.offsetTop + 'px'; ind.style.height = on.offsetHeight + 'px'; }
  }
  function setRail(rail, save) {
    var a = app(); if (!a) return;
    a.classList.toggle('is-rail', rail);
    var btn = document.getElementById('railBtn');
    if (btn) btn.title = rail ? 'Expand the menu ( [ )' : 'Collapse the menu ( [ )';
    if (save) { try { localStorage.setItem(KEY, rail ? '1' : ''); } catch (e) {} }
    fixNav();
    setTimeout(fixNav, 650); // after the slide finishes
  }
  function toggleRail() { var a = app(); if (a) setRail(!a.classList.contains('is-rail'), true); }

  document.addEventListener('keydown', function (e) {
    if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
    var el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    if (document.querySelector('.modal.show') || document.querySelector('.login-screen.show')) return;
    toggleRail();
  });

  // the menu is rebuilt after login, so re-apply tooltips when it changes
  var nav = document.getElementById('nav');
  if (nav && window.MutationObserver) new MutationObserver(function () { setTimeout(fixNav, 0); }).observe(nav, { childList: true });

  try { if (localStorage.getItem(KEY)) setRail(true, false); } catch (e) {}

  /* ---------- This week ---------- */
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function renderWeek() {
    var wrap = document.getElementById('weekBars'), tot = document.getElementById('weekTotal');
    /* global data */
    var D = (window.LT && LT.data && LT.data()) || (typeof data !== 'undefined' ? data : null);
    if (!wrap || !D) return;
    var counts = {};
    (D.tasks || []).forEach(function (t) { if (t.completedAt) counts[t.completedAt] = (counts[t.completedAt] || 0) + 1; });
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    var days = [], max = 1, sum = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      var c = counts[key(d)] || 0; max = Math.max(max, c); sum += c;
      days.push({ c: c, today: d.getTime() === now.getTime(), future: d > now, lbl: 'MTWTFSS'.charAt(i), name: d.toLocaleDateString('en-GB', { weekday: 'long' }) });
    }
    wrap.innerHTML = days.map(function (d, i) {
      var h = d.c ? Math.max(14, Math.round(d.c / max * 100)) : 8;
      return '<div class="wk' + (d.today ? ' today' : '') + (d.future ? ' future' : '') + '" title="' + d.name + ': ' + d.c + ' done">' +
        '<em>' + d.c + '</em><i style="height:' + h + '%;animation-delay:' + (i * 60) + 'ms"></i><span>' + d.lbl + '</span></div>';
    }).join('');
    if (tot) tot.textContent = sum + (sum === 1 ? ' task' : ' tasks') + ' done';
  }

  window.LTSlate = { toggleRail: toggleRail, setRail: setRail, renderWeek: renderWeek };
  renderWeek();
})();
