/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-cover.js — 🗺 Coverage map (MIDP Checker, Phase 4)
   ───────────────────────────────────────────────────────────────────
   One table: unit types down the side, buildings across the top.
   Each box: levels · units (from the Model arrangement) · drawings,
   % sent, late, model (from the MIDP). Colour by delivery or model.
   Works without the arrangement too (MIDP typologies only).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_COVER = function (A) {
  'use strict';
  var esc = A.esc, T = A.T;
  var UKEY = 'tidp-checker:coverui';
  var UI = Object.assign({ mode: 'del', cls: '', prob: false }, A.readJSON(UKEY, {}));
  function saveUI() { A.writeJSON(UKEY, { mode: UI.mode, cls: UI.cls, prob: UI.prob }); }
  function ext() { return window.MIDP_EXT || {}; }
  function N(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function bName(b) { return b === 'PD' ? 'Podium' : /^T\d+$/.test(b) ? 'Tower ' + b.slice(1) : b; }
  function pct(t) { return t && t.n ? Math.round(100 * t.sent / t.n) : 0; }
  function mainB(t) { var best = '', n = 0; Object.keys(t.blds || {}).forEach(function (b) { if (t.blds[b] > n) { n = t.blds[b]; best = b; } }); return best; }
  function clsOfTypo(name) { var s = String(name).toUpperCase(); return /^SV\b/.test(s) ? 'Serviced Apartment' : /^HT\b|SUITE|KING|TWIN|HOTEL/.test(s) ? 'Hotel' : /UNIT TYPE/.test(s) ? 'Residential' : 'Other'; }
  function clsGroup(c) { return /SERVIC/i.test(c) ? 'Serviced Apartment' : /HOTEL/i.test(c) ? 'Hotel' : /RESID/i.test(c) ? 'Residential' : c || 'Other'; }
  var ORDER = ['Residential', 'Serviced Apartment', 'Hotel', 'Amenity', 'Retail', 'Office', 'Other'];

  /* ---------- the grid data ---------- */
  function build() {
    var ty = ext().typos ? ext().typos() : [], a = ext().arrUnits ? ext().arrUnits() : null;
    var st = {}; ty.forEach(function (t) { st[t.name] = t; });
    var rows = {}, blds = {}, used = {};
    if (a) a.units.forEach(function (u) {
      var cg = clsGroup(u.cls[0] || (u.typ ? clsOfTypo(u.typ) : '')), k = 'U:' + N(u.name) + '|' + cg;
      var r = rows[k] = rows[k] || { label: u.name, cls: cg, cells: {} };
      var t = u.typ ? st[u.typ] : null; if (t) used[t.name] = 1;
      r.cells[u.b] = { u: u, t: t }; blds[u.b] = 1;
    });
    ty.forEach(function (t) {
      if (used[t.name]) return;
      var b = mainB(t) || '—', k = 'M:' + t.name;
      rows[k] = { label: t.name, cls: clsOfTypo(t.name), cells: {}, midpOnly: true }; rows[k].cells[b] = { u: null, t: t }; blds[b] = 1;
    });
    var bl = Object.keys(blds).sort();
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.key = k; return r; });
    list.sort(function (x, y) { return (ORDER.indexOf(x.cls) < 0 ? 99 : ORDER.indexOf(x.cls)) - (ORDER.indexOf(y.cls) < 0 ? 99 : ORDER.indexOf(y.cls)) || (x.midpOnly ? 1 : 0) - (y.midpOnly ? 1 : 0) || x.label.localeCompare(y.label, undefined, { numeric: true }); });
    return { rows: list, blds: bl, arr: !!a };
  }
  function problem(c) { return !c.t || c.t.late || (c.t.nomodel && c.t.nomodel >= c.t.n) || !c.u; }
  function tone(c) {
    var t = c.t;
    if (!t) return 'var(--bad)';
    if (UI.mode === 'mod') return !t.nomodel ? 'var(--ok)' : t.nomodel >= t.n ? 'var(--bad)' : 'var(--warn)';
    if (t.late) return 'var(--bad)'; if (t.n && t.sent >= t.n) return 'var(--ok)'; if (t.soon) return 'var(--warn)'; if (t.sent) return 'var(--info)'; return 'var(--muted)';
  }
  function cell(c) {
    if (!c) return '<td class="cv-x"></td>';
    var t = c.t, u = c.u, p = pct(t), bg = 'color-mix(in srgb,' + tone(c) + ' 16%, var(--panel))';
    return '<td class="cv-c" style="background:' + bg + ';--c:' + tone(c) + '"' + (t ? ' data-act="cvlook" data-v="' + esc(t.name) + '" title="' + esc(t.name) + ' — click for its drawings"' : ' title="No drawings in the MIDP"') + '>' +
      (u ? '<span class="cv-l">' + esc(u.levelsText ? 'L' + u.levelsText.replace(/, /g, ', L') : 'not placed') + '</span><span class="cv-n">' + u.units + ' units' + (u.tiers.length ? ' · ' + 'Tier ' + esc(u.tiers.join(', ').replace(/Tier /g, '')) : '') + '</span>' : '<span class="cv-l hint">not in the arrangement</span>') +
      (t ? '<span class="cv-bar"><i style="width:' + p + '%"></i></span><span class="cv-s">' + t.sent + '/' + t.n + ' sent' + (t.late ? ' · <b class="bad">' + t.late + ' late</b>' : '') + (t.soon ? ' · ' + t.soon + ' soon' : '') + '</span>' +
        '<span class="cv-m">' + (!t.nomodel ? '◫ ' + esc(t.models[0] || 'modelled') + (t.models.length > 1 ? ' +' + (t.models.length - 1) : '') : t.nomodel >= t.n ? '<b class="bad">no model</b>' : t.nomodel + ' of ' + t.n + ' without model') + '</span>'
        : '<span class="cv-s"><b class="bad">not in the MIDP</b></span>') + '</td>';
  }

  /* ---------- the view ---------- */
  A.VIEWS.cover = function () {
    var G = build();
    if (!G.rows.length) return '<div class="box empty"><b>🗺 Coverage map</b>No typologies found yet — load the latest MIDP (and the Model arrangement for levels and units).</div>';
    var rows = G.rows.filter(function (r) {
      if (UI.cls && r.cls !== UI.cls) return false;
      if (UI.prob && !G.blds.some(function (b) { return r.cells[b] && problem(r.cells[b]); })) return false;
      return true;
    });
    // totals per building
    var tot = G.blds.map(function (b) {
      var x = { b: b, types: 0, units: 0, n: 0, sent: 0, late: 0, nomodel: 0, nomidp: 0 };
      G.rows.forEach(function (r) { var c = r.cells[b]; if (!c) return; x.types++; if (c.u) x.units += c.u.units; if (c.t) { x.n += c.t.n; x.sent += c.t.sent; x.late += c.t.late; x.nomodel += c.t.nomodel; } else x.nomidp++; });
      return x;
    });
    var h = '<div class="hm-grid">' + tot.map(function (x) {
      var p = x.n ? Math.round(100 * x.sent / x.n) : 0;
      return '<div class="box hm-card" style="--c:' + (x.late ? 'var(--bad)' : p === 100 ? 'var(--ok)' : 'var(--info)') + '"><span class="hm-ic">🏢</span><span class="hm-t">' + esc(bName(x.b)) + '</span><span class="hm-v">' + p + '% <small>sent</small></span>' +
        '<span class="hm-s">' + A.plural(x.types, 'unit type') + (G.arr ? ' · ' + A.plural(x.units, 'unit') : '') + ' · ' + x.sent + '/' + x.n + ' drawings' + (x.late ? ' · <b class="bad">' + x.late + ' late</b>' : '') + (x.nomodel ? ' · ' + x.nomodel + ' without model' : '') + (x.nomidp ? ' · ' + x.nomidp + ' not in the MIDP' : '') + '</span></div>';
    }).join('') + '</div>';
    var classes = {}; G.rows.forEach(function (r) { classes[r.cls] = 1; });
    h += '<div class="box hm-box"><div class="sec-h"><h2>🗺 Coverage map</h2><span class="hint">Unit types × buildings' + (G.arr ? ' · levels and units from the Model arrangement' : ' · load the Model arrangement for levels and units') + ' · click a box for its drawings</span></div>' +
      '<div class="toolbar cv-tb"><span class="hint">Colour by</span>' + [['del', 'Delivery'], ['mod', 'Model']].map(function (m) { return '<button class="btn small' + (UI.mode === m[0] ? ' primary' : '') + '" type="button" data-act="cvmode" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('') +
      '<select id="cvCls"><option value="">All classes</option>' + ORDER.filter(function (c) { return classes[c]; }).concat(Object.keys(classes).filter(function (c) { return ORDER.indexOf(c) < 0; })).map(function (c) { return '<option' + (UI.cls === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<label class="hint cv-chk"><input type="checkbox" id="cvProb"' + (UI.prob ? ' checked' : '') + '> Only problems (late · no model · missing)</label><span class="grow"></span>' +
      '<button class="btn small" type="button" data-act="cvxl">⬇ Excel</button></div>' +
      '<div class="cv-legend">' + (UI.mode === 'mod' ? [['var(--ok)', 'Modelled'], ['var(--warn)', 'Partly'], ['var(--bad)', 'No model / not in the MIDP']] : [['var(--bad)', 'Late / not in the MIDP'], ['var(--warn)', 'Due soon'], ['var(--info)', 'Partly sent'], ['var(--ok)', 'All sent'], ['var(--muted)', 'Not sent yet']])
        .map(function (x) { return '<span><i style="background:color-mix(in srgb,' + x[0] + ' 40%, var(--panel));border-color:' + x[0] + '"></i>' + x[1] + '</span>'; }).join('') + '</div>';
    if (!rows.length) return h + '<div class="empty">Nothing to show with these filters.</div></div>';
    var grp = '';
    h += '<div class="tw free cv-w"><table class="cv-t"><thead><tr><th>Unit type</th>' + G.blds.map(function (b) { return '<th>' + esc(bName(b)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        var head = r.cls !== grp ? (grp = r.cls, '<tr class="cv-g"><td colspan="' + (G.blds.length + 1) + '">' + esc(r.cls) + '</td></tr>') : '';
        return head + '<tr><th class="cv-h">' + esc(r.label) + (r.midpOnly && G.arr ? '<small>MIDP only</small>' : '') + '</th>' + G.blds.map(function (b) { return cell(r.cells[b]); }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
    return h;
  };

  function exportXl() {
    var G = build(), out = [];
    G.rows.forEach(function (r) {
      G.blds.forEach(function (b) {
        var c = r.cells[b]; if (!c) return;
        out.push({ 'Unit type': r.label, Class: r.cls, Building: b, Levels: c.u ? c.u.levelsText : '', Units: c.u ? c.u.units : '', Tier: c.u ? c.u.tiers.join(', ') : '',
          'MIDP typology': c.t ? c.t.name : '(not in the MIDP)', Drawings: c.t ? c.t.n : '', Sent: c.t ? c.t.sent : '', '% sent': c.t ? pct(c.t) : '', Late: c.t ? c.t.late : '', 'Due soon': c.t ? c.t.soon : '',
          'Without model': c.t ? c.t.nomodel : '', Models: c.t ? c.t.models.join(', ') : '', 'In arrangement': c.u ? 'Yes' : 'No' });
      });
    });
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(out); ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 9 }, { wch: 22 }, { wch: 7 }, { wch: 14 }, { wch: 40 }, { wch: 9 }, { wch: 6 }, { wch: 7 }, { wch: 6 }, { wch: 9 }, { wch: 12 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Coverage'); XLSX.writeFile(wb, 'Coverage_map_' + T.todayIso() + '.xlsx');
    A.toast('⬇ Coverage map exported');
  }

  Object.assign(A.ACTIONS, {
    cvmode: function (el) { UI.mode = el.getAttribute('data-v'); saveUI(); A.render(); },
    cvlook: function (el) { if (ext().lookFor) ext().lookFor(el.getAttribute('data-v')); },
    cvxl: exportXl
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'cvCls') { UI.cls = e.target.value; saveUI(); A.render(); }
    if (e.target.id === 'cvProb') { UI.prob = e.target.checked; saveUI(); A.render(); }
  });

  var css = document.createElement('style');
  css.textContent = '.cv-tb{flex-wrap:wrap;margin:6px 0}.cv-chk{display:inline-flex;gap:4px;align-items:center}.cv-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;margin:2px 0 8px}.cv-legend i{display:inline-block;width:12px;height:12px;border:1px solid;margin-right:5px;vertical-align:-2px}' +
    '.cv-w{max-height:none}.cv-t{border-collapse:separate;border-spacing:3px;width:100%;min-width:520px}.cv-t thead th{text-align:left;font-size:12px;padding:4px 6px;position:sticky;top:0;background:var(--panel);z-index:1}' +
    '.cv-h{text-align:left;font-size:13px;padding:4px 6px;white-space:nowrap;vertical-align:top;width:1%}.cv-h small{display:block;font-weight:400;color:var(--bad);font-size:11px}' +
    '.cv-g td{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:10px 4px 2px}' +
    '.cv-c{vertical-align:top;padding:6px 8px;border-left:4px solid var(--c);cursor:pointer;font-size:12px;line-height:1.35;min-width:170px}.cv-c:hover{outline:2px solid var(--c)}.cv-x{background:transparent}' +
    '.cv-c span{display:block}.cv-l{font-weight:600}.cv-n,.cv-m{color:var(--muted)}.cv-m{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}.cv-c .bad,.hm-s .bad{color:var(--bad)}' +
    '.cv-bar{height:5px;background:color-mix(in srgb,var(--muted) 25%,transparent);margin:4px 0 2px}.cv-bar i{display:block;height:100%;background:var(--c)}';
  document.head.appendChild(css);
};
