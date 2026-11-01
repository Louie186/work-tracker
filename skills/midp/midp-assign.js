/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-assign.js — keep your Tower / Typology / Model
   assignments safe (MIDP Checker)
   ───────────────────────────────────────────────────────────────────
   • Drawing ID = the drawing number WITHOUT its revision
     (5013-KEO-T1-ZZ-PLN-INT-10100 for -T0, -T1, -00 …). It does not change,
     so it is the key in the assignments file.
   • ⬇ Export assignments: one Excel with every assignment — keep it on your
     PC / SharePoint. ⬆ Import assignments: puts them back (new site, new PC,
     after "Start over"…). You see every change before it is applied.
   • After a new MIDP is loaded: a check — carried over · renumbered (same
     title, new number → confirm) · no longer in the MIDP.
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_ASSIGN = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var FIELDS = ['Tower', 'Typology', 'Model Number'];
  var KEY = 'tidp-checker:assign';
  var M = Object.assign({ file: '', check: null }, A.readJSON(KEY, {}));
  var PREVIEW = null, MOVES = null;
  function save() { A.writeJSON(KEY, M); }
  function U(s) { return String(s == null ? '' : s).toUpperCase().trim(); }
  function idOf(num) { var b = T.baseOf(num); return U(b || num).replace(/-$/, ''); }
  function has(v) { return FIELDS.some(function (f) { return T.txt(v && v[f]); }); }
  function rows() { return S.built ? S.built.rows : []; }

  /* ---------- ⬇ export ---------- */
  function exportFile() {
    var out = [['Drawing ID', 'Drawing number (now)', 'Title', 'Tower', 'Typology', 'Model number', 'Model name', 'In this MIDP']], n = 0, seen = {};
    rows().concat(S.built ? S.built.removed : []).forEach(function (r) {
      if (!has(r.v) || !r.num) return;
      var id = idOf(r.num); if (seen[id]) return; seen[id] = 1;
      var m = T.findModel(S.mix, r.v['Model Number']);
      out.push([id, r.num, r.title, T.txt(r.v.Tower), T.txt(r.v.Typology), T.txt(r.v['Model Number']), m ? m.name : '', r.removed ? 'No (removed)' : 'Yes']);
      n++;
    });
    if (!n) { A.toast('No assignments yet — nothing to export'); return; }
    var ws = XLSX.utils.aoa_to_sheet(out);
    ws['!cols'] = [{ wch: 34 }, { wch: 36 }, { wch: 60 }, { wch: 10 }, { wch: 36 }, { wch: 34 }, { wch: 30 }, { wch: 14 }];
    ws['!autofilter'] = { ref: 'A1:H' + out.length };
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    var info = XLSX.utils.aoa_to_sheet([['Model assignments — MIDP Checker'], ['Project', S.latest && S.latest.project ? [S.latest.project.number, S.latest.project.title].filter(Boolean).join(' · ') : ''],
      ['MIDP file', S.latest ? S.latest.file : ''], ['Exported', new Date().toLocaleString()], ['Assignments', n], [],
      ['Keep this file. ⬆ Import assignments in the MIDP Checker puts them back (Models tab or Files).'],
      ['Drawing ID = the drawing number without its revision, so it still matches after T0 → T1 → 00.'],
      ['You can edit Tower / Typology / Model number here and import it again — you see the changes first.']]);
    info['!cols'] = [{ wch: 22 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, info, 'Read me');
    XLSX.writeFile(wb, 'MIDP_Model_assignments_' + T.todayIso() + '.xlsx');
    A.toast('⬇ ' + A.plural(n, 'assignment') + ' exported');
  }

  /* ---------- ⬆ import (preview first) ---------- */
  function readFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
        var name = wb.SheetNames.filter(function (n) { return /ASSIGN/i.test(n); })[0] || wb.SheetNames[0];
        preview(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }), file.name);
      } catch (e) { A.toast('Could not read ' + file.name + ': ' + e.message); }
    };
    fr.readAsArrayBuffer(file);
  }
  function preview(grid, fileName) {
    var h = -1, col = {};
    for (var i = 0; i < Math.min(grid.length, 15); i++) {
      var hd = grid[i].map(U);
      if (hd.some(function (c) { return /^DRAWING (ID|NUMBER|NO)/.test(c) || c === 'DOCUMENT NUMBER'; })) { h = i; break; }
    }
    if (h < 0) { A.toast('No “Drawing ID” or “Drawing number” column found'); return; }
    grid[h].map(U).forEach(function (c, k) {
      if (c === 'DRAWING ID') col.id = k;
      else if (/^(DRAWING (NUMBER|NO)|DOCUMENT NUMBER)/.test(c) && col.num === undefined) col.num = k;
      else if (c === 'TITLE' || c === 'DESCRIPTION') col.title = k;
      else if (c === 'TOWER' || c === 'BUILDING') col.tower = k;
      else if (c === 'TYPOLOGY') col.typ = k;
      else if (/^MODEL (NUMBER|NO)/.test(c)) col.model = k;
    });
    var byId = new Map(), byTitle = new Map();
    rows().forEach(function (r) {
      if (!r.num) return;
      if (!byId.has(idOf(r.num))) byId.set(idOf(r.num), r);
      var t = T.compact(r.title); if (t) { if (!byTitle.has(t)) byTitle.set(t, []); byTitle.get(t).push(r); }
    });
    var ch = [], same = 0, notFound = [];
    for (var j = h + 1; j < grid.length; j++) {
      var g = grid[j], raw = T.txt(g[col.id !== undefined ? col.id : col.num]); if (!raw) continue;
      var r = byId.get(idOf(raw)), how = 'id';
      if (!r && col.title !== undefined) { var tl = byTitle.get(T.compact(g[col.title])) || []; if (tl.length === 1) { r = tl[0]; how = 'title'; } }
      if (!r) { notFound.push(raw); continue; }
      var want = { Tower: col.tower !== undefined ? T.txt(g[col.tower]) : null, Typology: col.typ !== undefined ? T.txt(g[col.typ]) : null, 'Model Number': col.model !== undefined ? T.txt(g[col.model]) : null };
      var diffs = FIELDS.filter(function (f) { return want[f] !== null && want[f] !== '' && want[f] !== T.txt(r.v[f]); });
      if (!diffs.length) { same++; continue; }
      ch.push({ r: r, how: how, from: raw, want: want, diffs: diffs });
    }
    PREVIEW = ch;
    A.openDialog('<h2 id="dlgH">⬆ Import assignments</h2><p class="hint" style="margin-top:0">' + esc(fileName) + ' · ' + ch.length + ' to change · ' + same + ' already the same · ' + notFound.length + ' not in this MIDP</p>' +
      (ch.length ? '<div class="toolbar" style="margin:0"><label class="hint"><input type="checkbox" id="asAll" checked> Tick all</label></div><div class="as-list">' + ch.map(function (c, k) {
        return '<label class="as-row"><input type="checkbox" data-asi="' + k + '" checked><span><span class="mono">' + esc(c.r.num) + '</span>' +
          (c.how === 'title' ? ' <span class="tag c-warn" title="The number changed — found by its title">found by title (was ' + esc(c.from) + ')</span>' : '') + '<br>' +
          c.diffs.map(function (f) { return '<b>' + esc(f === 'Model Number' ? 'Model' : f) + ':</b> <s class="muted">' + esc(T.txt(c.r.v[f]) || '—') + '</s> → ' + esc(c.want[f]); }).join(' · ') + '</span></label>';
      }).join('') + '</div>' : '<div class="box empty">Nothing to change — this MIDP already has these assignments.</div>') +
      (notFound.length ? '<details style="margin-top:8px"><summary class="hint">' + notFound.length + ' not in this MIDP</summary><div class="hint mono">' + notFound.slice(0, 200).map(esc).join('<br>') + '</div></details>' : '') +
      '<div class="acts"><button class="btn" type="button" data-act="dlgclose">Cancel</button>' + (ch.length ? '<button class="btn primary" type="button" data-act="asapply">Apply ticked</button>' : '') + '</div>');
  }
  function apply() {
    var n = 0;
    (PREVIEW || []).forEach(function (c, k) {
      var b = document.querySelector('[data-asi="' + k + '"]'); if (!b || !b.checked) return;
      c.diffs.forEach(function (f) {
        if (f === 'Model Number') { var m = T.findModel(S.mix, c.want[f]); A.setVal(c.r.key, f, m ? m.num : c.want[f], true); }
        else A.setVal(c.r.key, f, c.want[f], true);
      });
      n++;
    });
    PREVIEW = null; A.saveStore(); A.compute(); A.closeDialog(); A.render();
    A.toast('⬆ ' + A.plural(n, 'drawing') + ' updated from the file — in the history too');
  }

  /* ---------- the check after a new MIDP ---------- */
  function check() {
    if (!S.built || !S.latest) return;
    var removed = (S.built.removed || []).filter(function (r) { return has(r.v); });
    var byTitle = new Map();
    rows().forEach(function (r) { var t = T.compact(r.title); if (t && !has(r.v)) { if (!byTitle.has(t)) byTitle.set(t, []); byTitle.get(t).push(r); } });
    var moves = [], lost = [];
    removed.forEach(function (o) {
      var c = byTitle.get(T.compact(o.title)) || [];
      if (c.length === 1) moves.push({ from: o, to: c[0] }); else lost.push(o);
    });
    var kept = rows().filter(function (r) { return has(r.v); }).length;
    MOVES = moves;
    var sig = S.latest.file + '|' + S.latest.items.length;
    if (M.check && M.check.sig === sig) { M.check.kept = kept; M.check.moves = moves.length; M.check.lost = lost.length; return; }
    var first = !M.check;
    M.check = { sig: sig, at: Date.now(), file: S.latest.file, kept: kept, moves: moves.length, lost: lost.length, seen: first };
    save();
    if (!first && (kept || moves.length || lost.length)) A.toast('New MIDP: ' + kept + ' assignments kept' + (moves.length ? ' · ' + moves.length + ' renumbered — confirm in Models' : '') + (lost.length ? ' · ' + lost.length + ' no longer in the MIDP' : ''));
  }
  function movesDialog() {
    if (!MOVES || !MOVES.length) { A.toast('Nothing to confirm'); return; }
    A.openDialog('<h2 id="dlgH">Renumbered drawings</h2><p class="hint" style="margin-top:0">These drawings are no longer in the MIDP under their old number, but a drawing with exactly the same title is. Tick the ones to move your entries (Tower, Typology, Model, notes) to the new number.</p>' +
      '<div class="as-list">' + MOVES.map(function (m, k) {
        return '<label class="as-row"><input type="checkbox" data-asm="' + k + '" checked><span><span class="mono"><s class="muted">' + esc(m.from.num) + '</s> → ' + esc(m.to.num) + '</span><br>' + esc(m.to.title) +
          '<br><span class="hint">' + FIELDS.filter(function (f) { return T.txt(m.from.v[f]); }).map(function (f) { return (f === 'Model Number' ? 'Model' : f) + ': ' + esc(m.from.v[f]); }).join(' · ') + '</span></span></label>';
      }).join('') + '</div><div class="acts"><button class="btn" type="button" data-act="dlgclose">Later</button><button class="btn primary" type="button" data-act="asmove">Move ticked</button></div>');
  }
  function doMoves() {
    var n = 0;
    MOVES.forEach(function (m, k) {
      var b = document.querySelector('[data-asm="' + k + '"]'); if (!b || !b.checked) return;
      var old = S.store.rows[m.from.key]; if (!old) return;
      Object.keys(old.v || {}).forEach(function (f) { if (!T.txt(m.to.v[f])) A.setVal(m.to.key, f, old.v[f], true); });
      delete S.store.rows[m.from.key]; n++;
    });
    A.saveStore(); A.compute(); A.closeDialog(); A.render(); A.toast('Moved the entries of ' + A.plural(n, 'drawing'));
  }

  /* ---------- the box (Models tab and Files tab) ---------- */
  function box(where) {
    var c = M.check, kept = rows().filter(function (r) { return has(r.v); }).length;
    return '<div class="box as-box"><div class="toolbar" style="margin:0"><b>💾 Assignments</b><span class="hint">' + kept + ' drawings have a Tower / Typology / Model' +
      (c && c.lost ? ' · <span style="color:var(--bad)">' + c.lost + ' no longer in this MIDP</span>' : '') + '</span>' +
      (MOVES && MOVES.length ? '<button class="btn small primary" type="button" data-act="asmoves">Confirm ' + A.plural(MOVES.length, 'renumbered drawing') + '</button>' : '') +
      '<span class="grow"></span><button class="btn small" type="button" data-act="asexport" title="One Excel with every assignment — keep it safe">⬇ Export assignments</button>' +
      '<label class="btn small" title="Put assignments back from that Excel — you see the changes first">⬆ Import assignments<input type="file" id="asFile" accept=".xlsx,.xlsm,.xls,.csv" hidden></label></div>' +
      (where === 'models' ? '<p class="hint" style="margin:4px 0 0">Saved in this browser only. Export the file after a batch of changes, and keep it with the project — it brings everything back on another PC, another site address or after “Start over”.</p>' : '') + '</div>';
  }
  var vm = A.VIEWS.models, vf = A.VIEWS.files;
  A.VIEWS.models = function () { return (S.latest ? box('models') : '') + vm.apply(this, arguments); };
  A.VIEWS.files = function () { return vf.apply(this, arguments) + (S.latest ? box('files') : ''); };

  Object.assign(A.ACTIONS, { asexport: exportFile, asapply: apply, asmoves: movesDialog, asmove: doMoves });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'asFile') { if (el.files[0]) readFile(el.files[0]); el.value = ''; }
    if (el.id === 'asAll') document.querySelectorAll('[data-asi]').forEach(function (b) { b.checked = el.checked; });
  });
  var ext = window.MIDP_EXT || (window.MIDP_EXT = {}), prev = ext.afterCompute;
  ext.afterCompute = function () { if (prev) prev(); try { check(); } catch (e) { console.error(e); } };

  var css = document.createElement('style');
  css.textContent = '.as-box{padding:8px 12px;margin-bottom:10px}.as-list{max-height:52vh;overflow:auto;border:1px solid var(--edge)}' +
    '.as-row{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-bottom:1px solid var(--edge);font-size:13px;line-height:1.4}.as-row input{margin-top:3px}';
  document.head.appendChild(css);
};
