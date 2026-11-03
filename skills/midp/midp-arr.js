/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-arr.js — Model arrangement (MIDP Checker, Phase 1)
   ───────────────────────────────────────────────────────────────────
   Which unit types are on which levels, per building.
   • Two ways in, one format:
       1. the standard form (sheets Levels · Units · Placement · Lists)
       2. an architect's stacking file (one sheet per tower, a row per
          level, a unit per cell, South → North façade) + "Unit Data".
          It is converted to the standard form on import.
   • Preview before saving · ⬇ Save as the standard form (to fix in Excel)
   • Check against the latest MIDP: each unit type is matched to a MIDP
     typology, per building. Sure matches are applied, unclear ones are
     listed for you to pick once (remembered), and "stacking only" /
     "MIDP only" are shown.
   • Re-import: what changed since the last file.
   Saved in this browser: tidp-checker:arr (project data).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_ARR = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var KEY = 'tidp-checker:arr';
  var D = A.readJSON(KEY, null);                 // the saved arrangement (or null)
  var PEND = null;                               // a file read, waiting in the preview
  var UI = { b: '', f: 'all', c: '', cmp: {} };
  var CLASSES = ['Residential', 'Serviced Apartment', 'Hotel Apartment', 'Hotel Room', 'Amenity', 'Retail', 'Office', 'Other'];
  var FTYPES = ['Typical', 'Ground', 'Podium', 'Amenities', 'Technical', 'Roof', 'Basement', 'Mezzanine', 'Other'];

  function save() { A.writeJSON(KEY, D); try { if (window.parent !== window && window.parent.__trackerEmbedSaved) window.parent.__trackerEmbedSaved('midp'); } catch (e) {} }
  function U(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase(); }
  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function N(s) { return U(s).replace(/[^A-Z0-9]/g, ''); }

  /* ---------- small rules ---------- */
  // "6-BR- A" = "6BR-A" = "UNIT TYPE 6 BR - Type A" · "TWINS.RM A" = "TWIN SUITE - Type A"
  function sig(name) {
    var s = U(name).replace(/\([^)]*\)/g, ' ');
    s = s.replace(/S\s*\.\s*RM\b/g, ' SUITE ').replace(/\bRM\b|\bROOM\b/g, ' SUITE ');
    s = s.replace(/\b(\d+)\s*-?\s*(BR|BED(ROOM)?S?)\b/g, ' $1BR ');
    s = s.replace(/\b(SV|UNIT|TYPE)\b/g, ' ');
    return s.replace(/[^A-Z0-9]/g, '');
  }
  function towerOfTag(name) { var m = /\(\s*[A-Z][A-Z. ]*?(\d{1,2})\s*\)/.exec(U(name)); return m ? +m[1] : 0; }
  function clean(name) {                         // a tidy display name: "6-BR- A" → "6BR-A"
    return U(name).replace(/\s*-\s*/g, '-').replace(/\b(\d+)-BR\b/g, '$1BR');
  }
  function bedrooms(name) { var m = /(\d+)\s*-?\s*BR\b/.exec(U(name)); if (m) return +m[1]; return /STUDIO/.test(U(name)) ? 0 : ''; }
  function clsOf(v) {
    var s = U(v); if (!s || s === 'NA' || s === 'N/A' || s === '-') return '';
    if (/SERVIC/.test(s)) return 'Serviced Apartment';
    if (/HOTEL\s*APART/.test(s)) return 'Hotel Apartment';
    if (/HOTEL|GUEST/.test(s)) return 'Hotel Room';
    if (/AMENIT/.test(s)) return 'Amenity';
    if (/RESID/.test(s)) return 'Residential';
    if (/RETAIL|SHOP/.test(s)) return 'Retail';
    if (/OFFICE/.test(s)) return 'Office';
    return CLASSES.filter(function (c) { return U(c) === s; })[0] || 'Other';
  }
  function bldCode(s) {
    var u = U(s), m = /(TOWER|TOW|RES(IDENCE)?|BLDG|BUILDING|BLOCK|T)\s*\.?\s*(\d{1,2})\b/.exec(u);
    if (m) return 'T' + (+m[3]);
    if (/PODIUM/.test(u)) return 'PD';
    return u.replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }
  // level codes as in the drawing numbers: 4 → 04, "16-F" → 16, "5B" → 05, "40_ TECH ROOF" → 40, GF, RF, B1
  function lvlCode(v) {
    if (typeof v === 'number') return v >= 0 && v < 10 ? '0' + Math.round(v) : String(Math.round(v));
    var s = U(v); if (!s) return '';
    var m = /^(B|P|M)\s*(\d{1,2})\b/.exec(s); if (m) return m[1] + (+m[2]);
    if (/^(GF|GR|G|GROUND)\b/.test(s)) return 'GF';
    if (/^(RF|ROOF)$/.test(s)) return 'RF';
    m = /^(\d{1,3})/.exec(s); if (m) return +m[1] < 10 ? '0' + (+m[1]) : String(+m[1]);
    return /^[A-Z0-9]{1,4}$/.test(s) ? s : '';
  }
  function lvlNum(c) { var m = /^(\d+)$/.exec(c); if (m) return +m[1]; if (c === 'GF') return 0; m = /^B(\d+)$/.exec(c); if (m) return -(+m[1]); if (c === 'RF') return 999; return null; }
  // "05-09, 10, 13" → ['05','06','07','08','09','10','13'] (and the bad bits)
  function expandLevels(s) {
    var out = [], bad = [];
    String(s == null ? '' : s).split(/[,;/]+/).forEach(function (p) {
      p = U(p); if (!p) return;
      var m = /^([A-Z]*)\s*(\d{1,3})\s*(?:-|–|TO)\s*([A-Z]*)\s*(\d{1,3})$/.exec(p);
      if (m && m[1] === m[3]) {
        var a = +m[2], b = +m[4], w = m[2].length, pre = m[1];
        if (b < a) { var t = a; a = b; b = t; }
        if (b - a > 300) { bad.push(p); return; }
        for (var i = a; i <= b; i++) out.push(pre ? pre + i : (String(i).length < w ? ('000' + i).slice(-w) : String(i)));
        return;
      }
      var c = lvlCode(p); if (c) out.push(c); else bad.push(p);
    });
    return { list: out, bad: bad };
  }
  // ['04','05','06','09'] → "04-06, 09" (in the building's level order)
  function compress(codes) {
    var nums = codes.map(function (c) { return { c: c, n: /^\d+$/.test(c) ? +c : null }; });
    nums.sort(function (a, b) { var x = lvlNum(a.c), y = lvlNum(b.c); return (x == null ? 1e4 : x) - (y == null ? 1e4 : y); });
    var out = [], i = 0;
    while (i < nums.length) {
      var j = i;
      if (nums[i].n != null) while (j + 1 < nums.length && nums[j + 1].n === nums[j].n + 1) j++;
      out.push(j - i >= 2 ? nums[i].c + '-' + nums[j].c : j > i ? nums[i].c + ', ' + nums[j].c : nums[i].c);
      i = j + 1;
    }
    return out.join(', ');
  }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

  /* ---------- reading a file ---------- */
  function readFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
        var r = parse(wb, file.name);
        if (!r && wb.SheetNames.some(function (n) { return /^placement$/i.test(n.trim()); })) { A.toast(file.name + ' has only the grey example rows — fill in your own rows, then import it'); return; }
        if (!r) { A.toast('No arrangement found in ' + file.name + ' — use the standard form (⬇ Template) or a stacking file with a sheet per tower'); return; }
        PEND = r; preview();
      } catch (e) { console.error(e); A.toast('Could not read ' + file.name + ': ' + e.message); }
    };
    fr.readAsArrayBuffer(file);
  }
  function gridOf(ws) {
    if (!ws || !ws['!ref']) return [];
    var g = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    // a merged cell spanning several levels: the same value on each row it covers
    (ws['!merges'] || []).forEach(function (m) {
      var v = g[m.s.r] && g[m.s.r][m.s.c]; if (v === '' || v == null || m.e.r === m.s.r) return;
      for (var r = m.s.r + 1; r <= m.e.r; r++) { g[r] = g[r] || []; if (g[r][m.s.c] === '' || g[r][m.s.c] == null) g[r][m.s.c] = { span: v }; }
    });
    return g;
  }
  function parse(wb, fileName) {
    var names = wb.SheetNames, find = function (re) { return names.filter(function (n) { return re.test(n.trim()); })[0]; };
    var lv = find(/^levels$/i), un = find(/^units$/i), pl = find(/^placement$/i);
    if (lv && pl) return parseForm(wb, lv, un, pl, fileName);
    return parseStacking(wb, fileName);
  }

  /* 1. the standard form */
  function table(ws, need) {
    var g = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }), h = -1;
    for (var i = 0; i < Math.min(g.length, 10); i++) if (g[i].some(function (c) { return U(c).replace(/\s*\*$/, '') === need; })) { h = i; break; }
    if (h < 0) return [];
    var hd = g[h].map(function (c) { return U(c).replace(/\s*\*$/, '').replace(/\s*\(AUTO\)$/, ''); });
    var out = [];
    for (var r = h + 1; r < g.length; r++) {
      var o = {}, any = false;
      hd.forEach(function (k, j) { if (k) { o[k] = txt(g[r][j]); if (o[k]) any = true; } });
      if (!any || /EXAMPLE/i.test(o.NOTES || '')) continue;
      o._row = r + 1; out.push(o);
    }
    return out;
  }
  function parseForm(wb, lvName, unName, plName, fileName) {
    var R = blank(fileName, 'form');
    var rm = wb.Sheets[names(wb, /^read me$/i)];
    if (rm) XLSX.utils.sheet_to_json(rm, { header: 1, defval: '' }).forEach(function (row) {
      var k = U(row[1]), v = txt(row[2]);
      if (k === 'PROJECT NAME') R.info.project = v; else if (k === 'PROJECT CODE' && !/^E\.G\./i.test(v)) R.info.code = v;
      else if (/STACKING/.test(k) && !/^E\.G\./i.test(v)) R.info.rev = v; else if (k === 'ARCHITECT') R.info.architect = v;
    });
    table(wb.Sheets[lvName], 'BUILDING').forEach(function (o) {
      var b = U(o.BUILDING), c = lvlCode(o['LEVEL CODE']);
      if (!b || !c) { R.warn.push('Levels row ' + o._row + ': building or level code missing'); return; }
      R.levels.push({ b: b, code: c, name: o['LEVEL NAME'] || '', type: o['FLOOR TYPE'] || '', tier: o['TIER / ZONE'] || '', fm: o['FLOOR MODEL NUMBER'] || '', fmName: o['FLOOR MODEL NAME'] || '', h: o['FLOOR-TO-FLOOR (M)'] || '' });
    });
    if (unName) table(wb.Sheets[unName], 'BUILDING').forEach(function (o) {
      var b = U(o.BUILDING), n = o['UNIT TYPE'];
      if (!b || !n) { R.warn.push('Units row ' + o._row + ': building or unit type missing'); return; }
      R.units.push({ b: b, name: clean(n), cls: clsOf(o.CLASSIFICATION), br: o.BEDROOMS !== '' ? +o.BEDROOMS : bedrooms(n), model: o['TYPOLOGY MODEL NUMBER'] || '', midp: o['MIDP NAME'] || '', alias: o['OTHER NAMES USED'] || '', note: o.NOTES || '' });
    });
    table(wb.Sheets[plName], 'BUILDING').forEach(function (o) {
      var b = U(o.BUILDING), n = o['UNIT TYPE'], ex = expandLevels(o.LEVELS);
      if (!b || !n || !ex.list.length) { R.warn.push('Placement row ' + o._row + ': building, unit type or levels missing'); return; }
      if (ex.bad.length) R.warn.push('Placement row ' + o._row + ': could not read level “' + ex.bad.join(', ') + '”');
      R.place.push({ b: b, unit: clean(n), lv: ex.list, per: +o['UNITS PER FLOOR'] || 1, cls: clsOf(o.CLASSIFICATION), pos: o['POSITION / FAÇADE'] || o['POSITION / FACADE'] || '' });
    });
    return finish(R);
  }
  function names(wb, re) { return wb.SheetNames.filter(function (n) { return re.test(n.trim()); })[0]; }
  function blank(fileName, src) { return { file: fileName, src: src, at: new Date().toISOString(), info: {}, levels: [], units: [], place: [], warn: [], ignored: [] }; }

  /* 2. an architect's stacking file */
  var UNITISH = /\b(\d\s*-?\s*BR|BR\b|STUDIO|SUITE|RM\b|ROOM|PENTHOUSE|VILLA|DUPLEX|TOWNHOUSE|KING|TWIN|APT|APARTMENT|UNIT|SHOP|RETAIL|OFFICE)/;
  var NOTUNIT = /^(AMENIT\w*|MEP|BMU|PLANT|LOBBY|CORE|VOID|LIFT|STAIR\w*|-|TBC|N\/?A)\b/;
  function parseStacking(wb, fileName) {
    var R = blank(fileName, 'stacking'), any = false;
    wb.SheetNames.forEach(function (sn) {
      var g = gridOf(wb.Sheets[sn]); if (!g.length) return;
      var h = -1, fac = [];
      for (var i = 0; i < Math.min(g.length, 12) && h < 0; i++) {
        var f = []; (g[i] || []).forEach(function (c, j) { if (/FA[CÇ]ADE/.test(U(c))) f.push(j); });
        if (f.length && (g[i] || []).some(function (c) { return /LEVEL|FLOOR|SUITES|STOREY/.test(U(c)); })) { h = i; fac = f; }
      }
      if (h < 0) return;
      any = true;
      var hd = function (j) { return U(g[h][j]) + ' ' + U((g[h + 1] || [])[j]); }, width = Math.max.apply(null, g.slice(h, h + 2).map(function (r) { return r.length; }));
      var col = { lvl: -1, div: -1, hgt: -1, cls: -1, fm: -1, fmName: -1, end: width };
      for (var j = 0; j < width; j++) {
        var t = hd(j);
        if (col.lvl < 0 && /\b(LEVELS?|FLOORS?|SUITES|STOREY)\b/.test(t) && j < fac[0]) col.lvl = j;
        else if (col.div < 0 && /DIVISION|ZONE|TIER/.test(t) && j < fac[0]) col.div = j;
        else if (col.hgt < 0 && /HEIGHT|FFL/.test(t)) col.hgt = j;
        else if (col.cls < 0 && /CLASSIF|USE/.test(t) && j < fac[0]) col.cls = j;
        if (j > fac[0] && col.end === width && /SHARE|MODEL|WORKSET|DESCRIPTION|HOST|REMARK|NOTE/.test(t)) col.end = j;
        if (col.fm < 0 && /MODEL\s*(NUMBER|NO)/.test(t)) col.fm = j;
        if (col.fmName < 0 && /DESCRIPTION/.test(t)) col.fmName = j;
      }
      if (col.lvl < 0) return;
      var b = bldCode(sn) || bldCode(U(g[0] && g[0].join(' '))), south = fac[0], north = fac[1] || 1e9;
      var title = (g.slice(0, h).map(function (r) { return r.filter(Boolean).join(' '); }).filter(Boolean)[0]) || sn;
      var rows = [], curCls = '';
      var val = function (r, j) { var v = r[j]; return v && typeof v === 'object' ? v.span : v; };
      for (var r = h + 1; r < g.length; r++) {
        var row = g[r] || [];
        if (row.slice(0, south).some(function (c) { return /FA[CÇ]ADE/.test(U(c)); })) break;
        var lraw = val(row, col.lvl), code = lvlCode(lraw); if (!code) continue;
        var dv = col.div >= 0 ? U(typeof row[col.div] === 'object' ? '' : row[col.div]) : '';
        var cv = col.cls >= 0 ? val(row, col.cls) : ''; if (txt(cv)) curCls = clsOf(cv);
        var units = [];
        for (var j2 = south; j2 < col.end; j2++) {
          var v = row[j2]; if (v == null || v === '' || typeof v === 'object') continue;   // a merged cell counts once
          var s = txt(v), us = U(s);
          if (clsOf(s) && !UNITISH.test(us)) { if (/SERVIC|HOTEL|RESID/.test(us)) curCls = clsOf(s); continue; }   // a classification typed in the grid
          if (NOTUNIT.test(us) || !UNITISH.test(us)) { R.ignored.push(b + ' L' + code + ' ' + colName(j2) + ': “' + s + '”'); continue; }
          units.push({ name: clean(s), pos: j2 >= north ? 'N' + (j2 - north + 1) : 'S' + (j2 - south + 1) });
        }
        var fm = col.fm >= 0 ? txt(val(row, col.fm)) : '', fmName = col.fmName >= 0 ? txt(val(row, col.fmName)) : '';
        if (fm === '-') fm = ''; if (fmName === '-') fmName = '';
        var lt = U(lraw), type = 'Typical';
        if (/TECH/.test(dv + ' ' + lt) && !units.length) type = 'Technical';
        else if (!units.length && /AMENIT/.test(U(row.join(' ')))) type = 'Amenities';
        else if (/ROOF/.test(dv + ' ' + lt) && !units.length) type = 'Roof';
        else if (!units.length) type = 'Other';
        var tier = '', m = /TIER\s*(\d+)/.exec(U(fmName)) || /-T\d+-T(\d)-/.exec(U(fm));
        if (m) tier = 'Tier ' + m[1];
        var name = /ROOF/.test(dv) ? txt(dv).replace(/\b\w/g, function (x) { return x; }) : type === 'Technical' ? 'Tech floor' : 'Level ' + (+code || code);
        rows.push({ code: code, name: name, type: type, tier: tier, div: /TIER\s*\d/.test(dv) ? dv : '', fm: fm, fmName: fmName, h: col.hgt >= 0 ? val(row, col.hgt) : '', cls: units.length ? (curCls || 'Residential') : type === 'Amenities' ? 'Amenity' : '', units: units });
      }
      // a level without a tier in its floor model: the tier of the nearest level that has one (not for technical floors)
      rows.forEach(function (x, k) {
        if (x.tier || x.type === 'Technical') return;
        for (var d = 1; d < rows.length; d++) {
          var a = rows[k - d], c = rows[k + d];
          if (a && a.tier && a.type !== 'Technical') { x.tier = a.tier; break; }
          if (c && c.tier && c.type !== 'Technical') { x.tier = c.tier; break; }
        }
      });
      rows.slice().reverse().forEach(function (x) {      // bottom to top, as in the form
        R.levels.push({ b: b, code: x.code, name: x.name, type: x.type, tier: x.tier, fm: x.fm, fmName: x.fmName, h: x.h === '' ? '' : x.h });
      });
      // placement: one row per unit type + units per floor + classification
      var per = {};
      rows.forEach(function (x) {
        var cnt = {};
        x.units.forEach(function (u) { var k = N(u.name); (cnt[k] = cnt[k] || { name: u.name, n: 0, pos: [] }).n++; cnt[k].pos.push(u.pos); });
        Object.keys(cnt).forEach(function (k) {
          var c = cnt[k], key = k + '|' + c.n + '|' + x.cls;
          (per[key] = per[key] || { b: b, unit: c.name, lv: [], per: c.n, cls: x.cls, pos: {} }).lv.push(x.code);
          c.pos.forEach(function (p) { per[key].pos[p] = 1; });
        });
      });
      Object.keys(per).forEach(function (k) { var p = per[k]; p.pos = Object.keys(p.pos).join(', '); R.place.push(p); });
      R.info.sheets = (R.info.sheets || []).concat([sn + ' → ' + b]);
      if (!R.info.project) R.info.project = txt(title).replace(/\b(TOWER|TOW)\s*\d+.*$/i, '').trim();
    });
    if (!any) return null;
    // the unit list sheet ("Unit Data"): type · building · classification · model number
    names2(wb).forEach(function (sn) {
      var g = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false }), h = -1, col = {};
      for (var i = 0; i < Math.min(g.length, 8) && h < 0; i++) {
        var hd = g[i].map(U);
        if (hd.some(function (c) { return /(APARTMENT|UNIT)\s*TYPE|TYPOLOGY/.test(c); }) && hd.some(function (c) { return /MODEL/.test(c); })) {
          h = i;
          hd.forEach(function (c, j) {
            if (col.t === undefined && /(APARTMENT|UNIT)\s*TYPE|TYPOLOGY/.test(c)) col.t = j;
            else if (col.b === undefined && /BUILDING|TOWER/.test(c)) col.b = j;
            else if (col.c === undefined && /CLASSIF/.test(c)) col.c = j;
            else if (col.m === undefined && /MODEL\s*(MODEL\s*)?(NUMBER|NO)/.test(c)) col.m = j;
            else if (col.d === undefined && /DESCRIPTION/.test(c)) col.d = j;
          });
        }
      }
      if (h < 0 || col.t === undefined) return;
      var blds = {}; R.levels.forEach(function (l) { blds[l.b] = 1; });
      var variants = [];
      for (var r = h + 1; r < g.length; r++) {
        var row = g[r], name = txt(row[col.t]), cls = clsOf(row[col.c]); if (!name) continue;
        if (!cls) continue;                                              // models (floors, tiers, sheets) — not a unit type
        var bs = String(col.b !== undefined ? row[col.b] : '').match(/\d+/g) || [];
        var codes = bs.map(function (d) { return 'T' + (+d); }).filter(function (c) { return blds[c]; });
        if (!codes.length) codes = Object.keys(blds);
        var model = col.m !== undefined ? txt(row[col.m]) : '';
        if (/\(.*\)/.test(name)) { variants.push({ codes: codes, base: clean(name.replace(/\(.*\)/, '')), note: txt(name) + ': ' + model }); continue; }
        codes.forEach(function (b) { R.units.push({ b: b, name: clean(name), cls: cls, br: bedrooms(name), model: model, midp: '', alias: txt(name) !== clean(name) ? txt(name) : '', note: '' }); });
      }
      variants.forEach(function (v) { v.codes.forEach(function (b) { var u = R.units.filter(function (x) { return x.b === b && N(x.name) === N(v.base); })[0]; if (u) u.note = (u.note ? u.note + ' · ' : '') + 'Variant ' + v.note; }); });
      R.info.unitSheet = sn;
    });
    return finish(R);
  }
  function names2(wb) { return wb.SheetNames.filter(function (n) { return /UNIT|TYPOLOG|APARTMENT/i.test(n); }); }

  /* 3. after either reader: one unit per building + name, counts, checks */
  function finish(R) {
    var have = {};
    R.units.forEach(function (u) { var k = u.b + ':' + N(u.name); if (have[k]) return; have[k] = u; });
    R.units = Object.keys(have).map(function (k) { return have[k]; });
    // a unit spelled differently in the stacking ("2-BR- C") and the unit list ("2BR- C") is still the same unit
    R.place.forEach(function (p) {
      var u = have[p.b + ':' + N(p.unit)];
      if (!u) { u = have[p.b + ':' + N(p.unit)] = { b: p.b, name: p.unit, cls: p.cls, br: bedrooms(p.unit), model: '', midp: '', alias: '', note: '', fromPlace: true }; R.units.push(u); }
      p.unit = u.name;
    });
    // checks: levels in the Levels sheet, ranges across technical / amenities floors, units without placement
    var lv = {}; R.levels.forEach(function (l) { lv[l.b + ':' + l.code] = l; });
    R.place.forEach(function (p) {
      var miss = p.lv.filter(function (c) { return !lv[p.b + ':' + c]; });
      if (miss.length && R.levels.length) R.warn.push(p.b + ' ' + p.unit + ': level ' + miss.join(', ') + ' is not in the Levels sheet');
      var odd = p.lv.filter(function (c) { var l = lv[p.b + ':' + c]; return l && /TECHNICAL|AMENIT/i.test(l.type); });
      if (odd.length) R.warn.push(p.b + ' ' + p.unit + ': on ' + odd.map(function (c) { return 'L' + c + ' (' + lv[p.b + ':' + c].type + ')'; }).join(', ') + ' — check the range');
    });
    var placed = {}; R.place.forEach(function (p) { placed[p.b + ':' + N(p.unit)] = 1; });
    R.units.forEach(function (u) { if (!placed[u.b + ':' + N(u.name)]) u.unplaced = true; });
    R.units.sort(function (a, b) { return a.b.localeCompare(b.b) || a.name.localeCompare(b.name, undefined, { numeric: true }); });
    return R.levels.length || R.place.length ? R : null;
  }

  /* ---------- summary numbers ---------- */
  function bldList(R) { var o = {}; R.levels.concat(R.place).forEach(function (x) { o[x.b] = 1; }); return Object.keys(o).sort(); }
  function unitRows(R) {                       // unit type → levels, floors, units, classes, positions
    var m = {};
    R.place.forEach(function (p) {
      var k = p.b + ':' + N(p.unit), x = m[k] = m[k] || { b: p.b, name: p.unit, lv: {}, units: 0, cls: {}, pos: {} };
      p.lv.forEach(function (c) { x.lv[c] = (x.lv[c] || 0) + p.per; }); x.units += p.lv.length * p.per;
      if (p.cls) x.cls[p.cls] = 1; String(p.pos || '').split(/\s*,\s*/).forEach(function (s) { if (s) x.pos[s] = 1; });
    });
    R.units.forEach(function (u) { var k = u.b + ':' + N(u.name); if (!m[k]) m[k] = { b: u.b, name: u.name, lv: {}, units: 0, cls: {}, pos: {} }; m[k].u = u; if (u.cls && !Object.keys(m[k].cls).length) m[k].cls[u.cls] = 1; });
    return Object.keys(m).map(function (k) { var x = m[k]; x.key = k; x.levels = Object.keys(x.lv); x.floors = x.levels.length; return x; })
      .sort(function (a, b) { return a.b.localeCompare(b.b) || a.name.localeCompare(b.name, undefined, { numeric: true }); });
  }
  function bldSummary(R, b) {
    var lv = R.levels.filter(function (l) { return l.b === b; }), us = unitRows(R).filter(function (x) { return x.b === b; });
    var tiers = {}, fms = {}, nums = [];
    lv.forEach(function (l) { if (l.tier) tiers[l.tier] = 1; if (l.fm || l.fmName) fms[(l.fm || '') + '|' + (l.fmName || '')] = 1; var n = lvlNum(l.code); if (n != null && n !== 999) nums.push(n); });
    var withUnits = {}; us.forEach(function (x) { x.levels.forEach(function (c) { withUnits[c] = 1; }); });
    var sv = us.filter(function (x) { return x.cls['Serviced Apartment']; }).length;
    return { b: b, levels: lv.length, from: nums.length ? Math.min.apply(null, nums) : '', to: nums.length ? Math.max.apply(null, nums) : '', tiers: Object.keys(tiers).sort(), fms: Object.keys(fms).length,
      types: us.length, units: us.reduce(function (s, x) { return s + x.units; }, 0), floors: Object.keys(withUnits).length, sv: sv,
      tech: lv.filter(function (l) { return /TECHNICAL/i.test(l.type); }).map(function (l) { return 'L' + l.code; }) };
  }
  function L(n) { return n === '' ? '' : 'L' + (n < 10 && n >= 0 ? '0' + n : n); }

  /* ---------- check against the latest MIDP ---------- */
  function midpTypos() {
    var list = window.MIDP_EXT && MIDP_EXT.typos ? MIDP_EXT.typos() : [];
    return list.map(function (t) {
      var best = '', n = 0; Object.keys(t.blds).forEach(function (b) { if (t.blds[b] > n) { n = t.blds[b]; best = b; } });
      var tag = towerOfTag(t.name);
      return { name: t.name, b: best, tagB: tag ? 'T' + tag : '', sig: sig(t.name), sv: /^SV\b|SERVICED/.test(U(t.name)), n: t.n, models: t.models };
    });
  }
  function dist(a, b) {                      // edit distance (short strings)
    if (Math.abs(a.length - b.length) > 2) return 9;
    var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; } for (var j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  var CK = null, ARU = null;
  function ensure() { if (!CK) check(); return CK; }
  function check() {
    ARU = null;
    CK = null;
    if (!D || !S.latest) return;
    var ty = midpTypos(); if (!ty.length) { CK = { none: true, rows: [], midpOnly: [], ty: [] }; return; }
    var picks = D.picks || {}, used = {};
    var rows = unitRows(D).map(function (x) {
      var u = x.u || {}, s = sig(x.name), out = { x: x, state: 'none', t: null, cands: [], flags: [] };
      var pk = picks[x.key];
      if (pk === '-') out.state = 'notmidp';
      else if (pk) { out.t = ty.filter(function (t) { return t.name === pk; })[0] || null; out.state = out.t ? 'picked' : 'none'; }
      if (!out.t && out.state !== 'notmidp' && u.midp) { out.t = ty.filter(function (t) { return N(t.name) === N(u.midp); })[0] || null; if (out.t) out.state = 'form'; }
      var aliases = [x.name].concat(String(u.alias || '').split(/\s*,\s*/)).filter(Boolean).map(sig);
      if (!out.t && out.state !== 'notmidp') {
        var exact = ty.filter(function (t) { return (t.b === x.b || t.tagB === x.b) && aliases.indexOf(t.sig) > -1; });
        if (exact.length === 1) { out.t = exact[0]; out.state = 'sure'; }
        else {
          out.cands = ty.filter(function (t) { return aliases.indexOf(t.sig) > -1 || ((t.b === x.b || t.tagB === x.b) && s.length >= 6 && dist(t.sig, s) <= 1 && t.sig.slice(-2) === s.slice(-2)); }).slice(0, 6);
          out.state = out.cands.length ? 'unclear' : 'none';
        }
      }
      if (out.t) {
        used[out.t.name] = 1;
        var isSv = !!x.cls['Serviced Apartment'];
        if (isSv !== out.t.sv && (isSv || out.t.sv)) out.flags.push(isSv ? 'Serviced in the stacking, not “SV” in the MIDP' : '“SV” (serviced) in the MIDP, not serviced in the stacking');
        if (out.t.b && out.t.b !== x.b) out.flags.push('MIDP drawings are on ' + out.t.b);
      }
      return out;
    });
    var blds = {}; rows.forEach(function (r) { blds[r.x.b] = 1; });
    var midpOnly = ty.filter(function (t) { return !used[t.name] && (blds[t.b] || blds[t.tagB]); });
    CK = { rows: rows, midpOnly: midpOnly, ty: ty,
      sure: rows.filter(function (r) { return r.t; }).length, unclear: rows.filter(function (r) { return r.state === 'unclear'; }).length,
      none: rows.filter(function (r) { return r.state === 'none' || r.state === 'notmidp'; }).length, flags: rows.filter(function (r) { return r.flags.length; }).length };
  }

  /* ---------- what changed since the last file ---------- */
  function diff(a, b) {
    if (!a || !b) return null;
    var ua = {}, ub = {}; unitRows(a).forEach(function (x) { ua[x.key] = x; }); unitRows(b).forEach(function (x) { ub[x.key] = x; });
    var out = { added: [], removed: [], moved: [], fm: [] };
    Object.keys(ub).forEach(function (k) {
      if (!ua[k]) { out.added.push(ub[k].b + ' ' + ub[k].name); return; }
      var x = ua[k].levels.slice().sort().join(','), y = ub[k].levels.slice().sort().join(',');
      if (x !== y) {
        var add = ub[k].levels.filter(function (c) { return ua[k].levels.indexOf(c) < 0; }), rem = ua[k].levels.filter(function (c) { return ub[k].levels.indexOf(c) < 0; });
        out.moved.push(ub[k].b + ' ' + ub[k].name + ': ' + (add.length ? '+ ' + compress(add) : '') + (add.length && rem.length ? ' · ' : '') + (rem.length ? '− ' + compress(rem) : ''));
      }
    });
    Object.keys(ua).forEach(function (k) { if (!ub[k]) out.removed.push(ua[k].b + ' ' + ua[k].name); });
    var la = {}; a.levels.forEach(function (l) { la[l.b + ':' + l.code] = l; });
    b.levels.forEach(function (l) { var o = la[l.b + ':' + l.code]; if (o && N(o.fm + o.fmName) !== N(l.fm + l.fmName)) out.fm.push(l.b + ' L' + l.code + ': ' + (o.fmName || o.fm || '—') + ' → ' + (l.fmName || l.fm || '—')); });
    out.n = out.added.length + out.removed.length + out.moved.length + out.fm.length;
    return out;
  }

  /* ---------- the preview (before saving) ---------- */
  function preview() {
    var R = PEND, bl = bldList(R), ch = D ? diff(D, R) : null;
    var h = '<h2 id="dlgH">🏢 Model arrangement — check before saving</h2><p class="hint" style="margin-top:0">' + esc(R.file) + ' · ' +
      (R.src === 'form' ? 'Standard form' : 'Stacking file — converted to the standard form') + (R.info.rev ? ' · rev ' + esc(R.info.rev) : '') + '</p>';
    h += '<div class="ar-sum">' + bl.map(function (b) {
      var s = bldSummary(R, b);
      return '<div class="box ar-b"><b>' + esc(b) + '</b><span>' + (s.from !== '' ? L(s.from) + '–' + L(s.to) + ' · ' : '') + A.plural(s.levels, 'level') + (s.tiers.length ? ' · ' + A.plural(s.tiers.length, 'tier') : '') + '</span>' +
        '<span>' + A.plural(s.types, 'unit type') + ' · ' + A.plural(s.units, 'unit') + (s.sv ? ' · ' + s.sv + ' serviced types' : '') + '</span>' +
        '<span class="hint">' + (s.fms ? A.plural(s.fms, 'floor model') : 'no floor models') + (s.tech.length ? ' · technical: ' + esc(s.tech.join(', ')) : '') + '</span></div>';
    }).join('') + '</div>';
    if (ch && ch.n) h += '<div class="banner info"><span>Compared with the saved arrangement: ' + [ch.added.length && ch.added.length + ' new unit types', ch.removed.length && ch.removed.length + ' gone', ch.moved.length && ch.moved.length + ' on other levels', ch.fm.length && ch.fm.length + ' floor model changes'].filter(Boolean).join(' · ') + '</span></div>';
    else if (ch) h += '<div class="banner info"><span>Same as the saved arrangement — no changes.</span></div>';
    if (R.warn.length) h += '<details open><summary><b>⚠ ' + A.plural(R.warn.length, 'thing') + ' to check</b></summary><div class="ar-w">' + R.warn.slice(0, 200).map(esc).join('<br>') + '</div></details>';
    if (R.ignored.length) h += '<details><summary class="hint">' + A.plural(R.ignored.length, 'cell') + ' skipped (not a unit name)</summary><div class="ar-w hint">' + R.ignored.slice(0, 200).map(esc).join('<br>') + '</div></details>';
    h += '<details><summary class="hint">Unit types read (' + unitRows(R).length + ')</summary><div class="ar-w">' + unitRows(R).map(function (x) {
      return '<span class="mono">' + esc(x.b) + '</span> ' + esc(x.name) + ' — ' + (x.floors ? esc(compress(x.levels)) + ' · ' + A.plural(x.units, 'unit') : '<i>not placed</i>');
    }).join('<br>') + '</div></details>';
    h += '<div class="acts"><button class="btn" type="button" data-act="dlgclose">Cancel</button><button class="btn" type="button" data-act="arxpend" title="The converted data as the standard form — fix it in Excel, then import that file">⬇ Save as the standard form</button>' +
      '<button class="btn primary" type="button" data-act="arsave">Save arrangement</button></div>';
    A.openDialog(h);
  }
  function commit() {
    if (!PEND) return;
    var ch = D ? diff(D, PEND) : null;
    PEND.picks = (D && D.picks) || {};
    PEND.changes = ch && ch.n ? Object.assign({ from: D.file, at: PEND.at }, ch) : (D && D.changes) || null;
    D = PEND; PEND = null; save(); check(); A.closeDialog(); A.go('arr');
    A.toast('🏢 Arrangement saved — ' + A.plural(unitRows(D).length, 'unit type'));
  }

  /* ---------- ⬇ the standard form (blank, or filled with the data) ---------- */
  var HEAD = {
    levels: ['Building *', 'Level code *', 'Level name', 'Floor type *', 'Tier / zone', 'Floor model number', 'Floor model name', 'Floor-to-floor (m)', 'Notes'],
    units: ['Building *', 'Unit type *', 'Classification *', 'Bedrooms', 'Typology model number', 'MIDP name', 'Other names used', 'Notes'],
    place: ['Building *', 'Unit type *', 'Levels *', 'Floors (auto)', 'Units per floor *', 'Total units (auto)', 'Classification *', 'Position / façade', 'Notes']
  };
  function writeForm(R) {
    var wb = XLSX.utils.book_new(), info = R ? R.info : {};
    var rm = [[], ['', 'MODEL ARRANGEMENT – standard form'], ['', 'Which unit types are on which levels, per building. Load it in the MIDP Checker → Files → Arrangement.'], [],
      ['', 'Project information'], ['', 'Project name', info.project || ''], ['', 'Project code', info.code || ''], ['', 'Architect', info.architect || ''], ['', 'Stacking / unit mix revision', info.rev || ''],
      ['', 'Date received', ''], ['', 'Prepared by', ''], ['', 'Checked by', ''], [],
      ['', 'How to fill it'],
      ['', '1. Lists', 'Check the building codes (T1, T2, PD…) and the drop-down words.'],
      ['', '2. Levels', 'One row per floor of each building, bottom to top. Same level codes as the drawing numbers (04, GF, RF, B1…).'],
      ['', '3. Units', 'One row per unit type per building. Copy the MIDP title into “MIDP name” — this makes matching exact.'],
      ['', '4. Placement', 'One row per unit type per building. Levels: commas between, dash for a range — 05-09, 10, 13. A floor with a different count gets its own row.'],
      ['', '5. Check', 'Do not rename the sheets or the column titles.']];
    if (R) rm.push([], ['', 'Converted from', R.file + ' (' + (R.src === 'form' ? 'standard form' : 'stacking file') + ') on ' + new Date().toLocaleString()]);
    var ws = XLSX.utils.aoa_to_sheet(rm); ws['!cols'] = [{ wch: 3 }, { wch: 30 }, { wch: 90 }]; XLSX.utils.book_append_sheet(wb, ws, 'Read me');
    function sheet(name, help, head, rows, widths) {
      var s = XLSX.utils.aoa_to_sheet([[help]].concat([head]).concat(rows));
      s['!cols'] = widths.map(function (w) { return { wch: w }; });
      // level codes stay text (04 stays 04)
      rows.forEach(function (r, i) { r.forEach(function (v, j) { var a = XLSX.utils.encode_cell({ r: i + 2, c: j }); if (s[a] && typeof v === 'string') { s[a].t = 's'; s[a].z = '@'; } }); });
      XLSX.utils.book_append_sheet(wb, s, name);
    }
    var lv = R ? R.levels.map(function (l) { return [l.b, l.code, l.name || '', l.type || '', l.tier || '', l.fm || '', l.fmName || '', l.h === '' || l.h == null ? '' : +l.h || l.h, ''];
    }) : [];
    sheet('Levels', 'One row per floor of each building, bottom to top. Same level codes as the drawing numbers.', HEAD.levels, lv, [11, 12, 18, 14, 12, 32, 24, 11, 26]);
    var un = R ? R.units.map(function (u) { return [u.b, u.name, u.cls || '', u.br === '' || u.br == null ? '' : u.br, u.model || '', u.midp || pickedName(u) || '', u.alias || '', [u.note, u.fromPlace ? 'Only in the stacking (no unit list row)' : '', u.unplaced ? 'Not placed on any level' : ''].filter(Boolean).join(' · ')]; }) : [];
    sheet('Units', 'One row per unit type per building. “MIDP name” = the title text used in the MIDP, so matching is exact.', HEAD.units, un, [11, 14, 18, 10, 32, 44, 26, 30]);
    var pl = R ? R.place.slice().sort(function (a, b) { return a.b.localeCompare(b.b) || a.unit.localeCompare(b.unit, undefined, { numeric: true }); })
      .map(function (p) { return [p.b, p.unit, compress(p.lv), p.lv.length, p.per, p.lv.length * p.per, p.cls || '', p.pos || '', '']; }) : [];
    sheet('Placement', 'Which unit types are on which floors. Levels: commas between, dash for a range — 05-09, 10, 13, 16, 30.', HEAD.place, pl, [11, 14, 26, 9, 10, 10, 18, 16, 26]);
    var bl = R ? bldList(R) : ['T1', 'T2', 'PD'], n = Math.max(bl.length, CLASSES.length, FTYPES.length), li = [['Buildings', 'Building name', '', 'Classification', '', 'Floor type']];
    for (var i = 0; i < n; i++) li.push([bl[i] || '', bl[i] ? (/^T\d+$/.test(bl[i]) ? 'Tower ' + bl[i].slice(1) : bl[i] === 'PD' ? 'Podium' : '') : '', '', CLASSES[i] || '', '', FTYPES[i] || '']);
    var ls = XLSX.utils.aoa_to_sheet(li); ls['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 3 }, { wch: 22 }, { wch: 3 }, { wch: 16 }]; XLSX.utils.book_append_sheet(wb, ls, 'Lists');
    return wb;
  }
  function pickedName(u) {
    if (!CK) return '';
    var r = CK.rows.filter(function (r) { return r.x.b === u.b && N(r.x.name) === N(u.name); })[0];
    return r && r.t ? r.t.name : '';
  }
  function downloadBlank() {
    // the full template (drop-downs, colours, help) — or a plain one when offline
    fetch('templates/Model_Arrangement_Template.xlsx').then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'Model_Arrangement_Template.xlsx'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      A.toast('⬇ Template downloaded');
    }).catch(function () { XLSX.writeFile(writeForm(null), 'Model_Arrangement_Template.xlsx'); A.toast('⬇ Template downloaded (simple version — no drop-downs offline)'); });
  }
  function downloadFilled(R) {
    if (!R) return;
    var nm = (R.info.project || 'Project').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project';
    XLSX.writeFile(writeForm(R), 'Model_Arrangement_' + nm + '_' + T.todayIso() + '.xlsx');
    A.toast('⬇ Saved as the standard form');
  }

  /* ---------- the Arrangement tab ---------- */
  var STATE = {
    sure: ['Matched', 'c-ok', 'Same name in the MIDP, same building'], form: ['From the form', 'c-ok', 'The “MIDP name” in your form'],
    picked: ['Your pick', 'c-info', 'You picked this match'], unclear: ['To confirm', 'c-warn', 'More than one possible match — pick one below'],
    none: ['Stacking only', 'c-bad', 'No typology with this name in the MIDP'], notmidp: ['Not in MIDP', 'c-mute', 'You said this unit has no drawings in the MIDP']
  };
  function card(icon, title, v, s, c, act) {
    return '<button class="box hm-card" type="button"' + (act ? ' data-act="arf" data-v="' + act + '"' : '') + ' style="--c:' + c + '"><span class="hm-ic">' + icon + '</span><span class="hm-t">' + esc(title) + '</span><span class="hm-v">' + v + '</span><span class="hm-s">' + s + '</span></button>';
  }
  function toolbar() {
    return '<div class="toolbar ar-tb"><label class="btn primary">⬆ ' + (D ? 'Import a newer file' : 'Import arrangement') + '<input type="file" id="arFile" accept=".xlsx,.xlsm,.xls" hidden></label>' +
      '<button class="btn" type="button" data-act="arblank" title="The empty standard form with drop-downs and help">⬇ Blank template</button>' +
      (D ? '<button class="btn" type="button" data-act="arxsaved" title="This arrangement as the standard form (with your MIDP matches)">⬇ Save as the standard form</button><span class="grow"></span>' +
        '<button class="btn small ' + (UI.del ? 'danger' : '') + '" type="button" data-act="ardel">' + (UI.del ? 'Click again to remove' : '🗑 Remove') + '</button>' : '') + '</div>';
  }
  function view() {
    var h = '<div class="box hm-box"><div class="sec-h"><h2>🏢 Model arrangement</h2><span class="hint">' + (D ? esc(D.file) + ' · ' + (D.src === 'form' ? 'standard form' : 'stacking file') + (D.info.rev ? ' · rev ' + esc(D.info.rev) : '') + ' · ' + esc(new Date(D.at).toLocaleDateString()) : 'Which unit types are on which levels, per building') + '</span></div>' + toolbar();
    if (!D) {
      return h + '<div class="ar-how"><p><b>Two ways to start:</b></p><ol><li><b>Fill in the standard form</b> — ⬇ Blank template, one row per level / unit type / placement, then ⬆ Import.</li>' +
        '<li><b>Drop the architect’s stacking file</b> (a sheet per tower, one row per level, a unit in each cell + a “Unit Data” sheet) — it is converted for you. You see it before saving, and can ⬇ save it as the standard form to fix anything in Excel.</li></ol>' +
        '<p class="hint">The latest MIDP decides the tower, typology and model. The arrangement adds the levels, tiers, units per floor and serviced / hotel floors. Anything that does not match is listed — nothing is guessed silently.</p></div></div>';
    }
    h += '</div>';
    ensure();
    var ur = unitRows(D), bl = bldList(D);
    if (!UI.b || bl.indexOf(UI.b) < 0) UI.b = '';
    // cards
    h += '<div class="hm-grid">' + bl.map(function (b) {
      var s = bldSummary(D, b);
      return card('🏢', b === 'PD' ? 'Podium' : /^T\d+$/.test(b) ? 'Tower ' + b.slice(1) : b, s.types + ' <small>unit types</small>', (s.from !== '' ? L(s.from) + '–' + L(s.to) + ' · ' : '') + A.plural(s.units, 'unit') + (s.tiers.length ? ' · ' + esc(s.tiers.join(', ')) : '') + (s.sv ? ' · ' + s.sv + ' serviced' : ''), 'var(--info)', 'b:' + b);
    }).join('');
    if (!S.latest) h += card('📄', 'MIDP check', '—', 'Load the latest MIDP in Files to check the arrangement against it', 'var(--muted)');
    else if (CK && CK.none === true && !CK.rows.length) h += card('📄', 'MIDP check', '—', 'No typologies found in this MIDP', 'var(--muted)');
    else if (CK) {
      h += card('✅', 'Matched to the MIDP', CK.sure + ' <small>of ' + CK.rows.length + '</small>', 'unit types with a MIDP typology', 'var(--ok)', 'ok');
      if (CK.unclear) h += card('❓', 'To confirm', CK.unclear, 'more than one possible match — pick once', 'var(--warn)', 'unclear');
      h += card('🧱', 'Stacking only', CK.none, 'unit types with no MIDP typology', CK.none ? 'var(--bad)' : 'var(--ok)', 'none');
      h += card('📄', 'MIDP only', CK.midpOnly.length, 'MIDP typologies not in the arrangement', CK.midpOnly.length ? 'var(--bad)' : 'var(--ok)', 'midp');
      if (CK.flags) h += card('⚠', 'Check', CK.flags, 'serviced / building differs from the MIDP', 'var(--warn)', 'flags');
    }
    h += '</div>';
    // to confirm
    if (CK && CK.unclear) {
      h += '<div class="box hm-box"><div class="sec-h"><h2>❓ Pick the MIDP typology</h2><span class="hint">Your picks are remembered — also after a new file</span></div><div class="ar-picks">' +
        CK.rows.filter(function (r) { return r.state === 'unclear'; }).map(function (r) {
          var opts = r.cands.concat(CK.ty.filter(function (t) { return (t.b === r.x.b || t.tagB === r.x.b) && r.cands.indexOf(t) < 0; }));
          return '<label class="ar-pick"><span><span class="mono">' + esc(r.x.b) + '</span> <b>' + esc(r.x.name) + '</b></span><select data-arpick="' + esc(r.x.key) + '"><option value="">Choose…</option>' +
            opts.map(function (t, i) { return '<option value="' + esc(t.name) + '"' + (i === 0 && r.cands.length === 1 ? '' : '') + '>' + (i < r.cands.length ? '★ ' : '') + esc(t.name) + '</option>'; }).join('') +
            '<option value="-">Not in the MIDP</option></select></label>';
        }).join('') + '</div><div class="toolbar"><span class="hint">★ = likely match</span><span class="grow"></span><button class="btn primary small" type="button" data-act="arpicks">Save picks</button></div></div>';
    }
    // what changed since the last file
    if (D.changes && D.changes.n) {
      var c = D.changes, li = function (t, a) { return a.length ? '<div><b>' + t + ' (' + a.length + ')</b><br>' + a.slice(0, 60).map(esc).join('<br>') + (a.length > 60 ? '<br>…' : '') + '</div>' : ''; };
      h += '<details class="box hm-box"><summary><b>🔄 Changed since ' + esc(c.from) + '</b> <span class="hint">' + c.n + ' changes</span></summary><div class="ar-ch">' +
        li('New unit types', c.added) + li('Gone', c.removed) + li('On other levels', c.moved) + li('Floor model changed', c.fm) + '</div></details>';
    }
    // the unit table
    var f = UI.f, rows = CK && CK.rows.length ? CK.rows : ur.map(function (x) { return { x: x, state: '', t: null, flags: [], cands: [] }; });
    rows = rows.filter(function (r) {
      if (UI.b && r.x.b !== UI.b) return false;
      if (UI.c && !Object.keys(r.x.cls).some(function (c) { return UI.c === 'Hotel' ? /HOTEL/i.test(c) : c === UI.c; })) return false;
      if (f === 'ok') return !!r.t; if (f === 'unclear') return r.state === 'unclear'; if (f === 'none') return r.state === 'none' || r.state === 'notmidp'; if (f === 'flags') return r.flags.length;
      return f !== 'midp';
    });
    var chips = '<div class="toolbar ar-f">' + [['all', 'All'], ['ok', 'Matched'], ['unclear', 'To confirm'], ['none', 'Stacking only'], ['midp', 'MIDP only'], ['flags', 'Check']].map(function (x) {
      return '<button class="btn small' + (f === x[0] ? ' primary' : '') + '" type="button" data-act="arf" data-v="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '<span class="grow"></span><select id="arC"><option value="">All classes</option>' + ['Residential', 'Serviced Apartment', 'Hotel', 'Amenity', 'Retail', 'Office'].map(function (c) { return '<option' + (UI.c === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select><select id="arB"><option value="">All buildings</option>' + bl.map(function (b) { return '<option' + (UI.b === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select></div>';
    if (f === 'midp') {
      var mo = (CK ? CK.midpOnly : []).filter(function (t) { return !UI.b || t.b === UI.b || t.tagB === UI.b; });
      h += '<div class="box hm-box">' + chips + (mo.length ? '<div class="tw free"><table class="plain"><thead><tr><th>MIDP typology</th><th>Building</th><th class="num">Drawings</th><th></th></tr></thead><tbody>' + mo.map(function (t) {
        return '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.b || t.tagB) + '</td><td class="num">' + t.n + '</td><td><button class="btn small" type="button" data-act="arlook" data-v="' + esc(t.name) + '">🔍 Drawings</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Every MIDP typology is in the arrangement.</div>') + '</div>';
      return h;
    }
    UI.shown = rows;
    var nc = Object.keys(UI.cmp).length;
    chips += '<div class="toolbar ar-f"><span class="hint">' + A.plural(rows.length, 'unit type') + ' · ' + A.plural(rows.reduce(function (s, r) { return s + r.x.units; }, 0), 'unit') + '</span><span class="grow"></span>' +
      '<button class="btn small' + (nc >= 2 ? ' primary' : '') + '" type="button" data-act="arcmp"' + (nc >= 2 ? '' : ' disabled') + ' title="Tick 2–4 unit types">⚖ Compare' + (nc ? ' (' + nc + ')' : '') + '</button>' +
      (nc ? '<button class="btn small" type="button" data-act="arcmpclr">Clear ticks</button>' : '') + '<button class="btn small" type="button" data-act="arxl">⬇ Excel</button></div>';
    h += '<div class="box hm-box">' + chips + (rows.length ? '<div class="tw free"><table class="plain ar-t"><thead><tr><th></th><th>Bldg</th><th>Unit type</th><th>Class</th><th>Levels</th><th class="num">Floors</th><th class="num">Units</th><th>MIDP typology</th></tr></thead><tbody>' + rows.map(function (r) {
      var x = r.x, st = STATE[r.state], cls = Object.keys(x.cls).join(', ');
      return '<tr><td><input type="checkbox" data-arcmp="' + esc(x.key) + '"' + (UI.cmp[x.key] ? ' checked' : '') + ' aria-label="Tick to compare"></td><td class="mono">' + esc(x.b) + '</td><td><b>' + esc(x.name) + '</b>' + (x.u && x.u.model ? '<br><span class="hint mono">' + esc(x.u.model) + '</span>' : '') + '</td>' +
        '<td>' + (cls ? A.tag(cls.replace('Apartment', 'Apt'), /SERVIC/i.test(cls) ? 'c-info' : /HOTEL/i.test(cls) ? 'c-odd' : 'c-mute') : '') + '</td>' +
        '<td class="ar-lv">' + (x.floors ? esc(compress(x.levels)) : '<span class="hint">not placed</span>') + '</td><td class="num">' + (x.floors || '') + '</td><td class="num">' + (x.units || '') + '</td>' +
        '<td>' + (r.t ? '<a href="#" data-act="arlook" data-v="' + esc(r.t.name) + '">' + esc(r.t.name) + '</a> <span class="hint">' + r.t.n + ' dwg</span> ' : '') + (st ? A.tag(st[0], st[1], false, st[2]) : '') +
        (r.flags.length ? '<br>' + r.flags.map(function (m) { return '<span class="ar-flag">⚠ ' + esc(m) + '</span>'; }).join('<br>') : '') +
        (r.state === 'picked' || r.state === 'notmidp' ? ' <a href="#" class="hint" data-act="arunpick" data-v="' + esc(x.key) + '">undo</a>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">Nothing here.</div>') + '</div>';
    // levels per building
    h += '<details class="box hm-box"><summary><b>Levels</b> <span class="hint">' + A.plural(D.levels.length, 'level') + ' — floor type, tier and floor model</span></summary><div class="tw free" style="max-height:420px"><table class="plain"><thead><tr><th>Bldg</th><th>Level</th><th>Type</th><th>Tier</th><th>Floor model</th><th class="num">Unit types</th></tr></thead><tbody>' +
      D.levels.filter(function (l) { return !UI.b || l.b === UI.b; }).slice().reverse().map(function (l) {
        var n = ur.filter(function (x) { return x.b === l.b && x.lv[l.code]; }).length;
        return '<tr><td class="mono">' + esc(l.b) + '</td><td>L' + esc(l.code) + (l.name && !/^Level \d+$/.test(l.name) ? ' <span class="hint">' + esc(l.name) + '</span>' : '') + '</td><td>' + esc(l.type) + '</td><td>' + esc(l.tier) + '</td><td>' + esc(l.fmName || '') + (l.fm ? ' <span class="hint mono">' + esc(l.fm) + '</span>' : '') + '</td><td class="num">' + (n || '') + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
    return h;
  }
  A.VIEWS.arr = view;

  /* ---------- for the Lookup: each unit type with its levels, tiers and floor models ---------- */
  function arrUnits() {
    if (!D) return null;
    if (ARU && CK) return ARU;
    ensure();
    var lvIx = {}; D.levels.forEach(function (l) { lvIx[l.b + ':' + l.code] = l; });
    var byKey = {}, byTypo = {}, list = [];
    var rows = CK && CK.rows.length ? CK.rows : unitRows(D).map(function (x) { return { x: x, t: null }; });
    rows.forEach(function (r) {
      var x = r.x, tiers = {}, fms = {}, per = {};
      x.levels.forEach(function (c) {
        var l = lvIx[x.b + ':' + c] || {};
        if (l.tier) tiers[l.tier] = 1;
        var fk = l.fmName || l.fm; if (fk) (fms[fk] = fms[fk] || { name: l.fmName || '', num: l.fm || '', levels: [] }).levels.push(c);
        per[x.lv[c]] = 1;
      });
      var u = { key: x.key, b: x.b, name: x.name, typ: r.t ? r.t.name : '', state: r.state || '', cls: Object.keys(x.cls), lv: x.lv, levels: x.levels.slice().sort(function (a, b) { return (lvlNum(a) || 0) - (lvlNum(b) || 0); }),
        levelsText: compress(x.levels), floors: x.floors, units: x.units, per: Object.keys(per).map(Number).sort(), tiers: Object.keys(tiers).sort(), model: x.u ? x.u.model : '',
        fms: Object.keys(fms).map(function (k) { var f = fms[k]; f.text = compress(f.levels); return f; }).sort(function (a, b) { return (lvlNum(a.levels[0]) || 0) - (lvlNum(b.levels[0]) || 0); }) };
      list.push(u); byKey[u.key] = u; if (u.typ) byTypo[u.typ] = u;
    });
    ARU = { units: list, byKey: byKey, byTypo: byTypo, levels: D.levels, lvIx: lvIx, compress: compress, file: D.file };
    return ARU;
  }

  /* ---------- ⚖ compare unit types side by side ---------- */
  function compare(keys) {
    var a = arrUnits(); if (!a) return;
    var us = keys.map(function (k) { return a.byKey[k]; }).filter(Boolean);
    if (us.length < 2) { A.toast('Tick 2–4 unit types to compare'); return; }
    var st = {}; (window.MIDP_EXT && MIDP_EXT.typos ? MIDP_EXT.typos() : []).forEach(function (t) { st[t.name] = t; });
    var rows = [
      ['Building', function (u) { return esc(u.b); }],
      ['Class', function (u) { return esc(u.cls.join(', ') || '—'); }],
      ['Tier', function (u) { return esc(u.tiers.join(', ') || '—'); }],
      ['Levels', function (u) { return esc(u.levelsText || 'not placed'); }],
      ['Floors', function (u) { return u.floors || 0; }],
      ['Units', function (u) { return u.units || 0; }],
      ['Units per floor', function (u) { return esc(u.per.join(' / ') || '—'); }],
      ['Floor models', function (u) { return u.fms.map(function (f) { return esc(f.name || f.num) + ' <span class="hint">' + esc(f.text) + '</span>'; }).join('<br>') || '—'; }],
      ['Typology model', function (u) { return '<span class="mono">' + esc(u.model || '—') + '</span>'; }],
      ['MIDP typology', function (u) { return u.typ ? esc(u.typ) : '<span class="tag c-bad">not in the MIDP</span>'; }],
      ['Drawings', function (u) { var t = st[u.typ]; return t ? t.n : '—'; }],
      ['Sent', function (u) { var t = st[u.typ]; return t ? t.sent + ' of ' + t.n : '—'; }],
      ['Late', function (u) { var t = st[u.typ]; return t ? (t.late ? '<b style="color:var(--bad)">' + t.late + '</b>' : '0') : '—'; }]
    ];
    var same = function (f) { var v = us.map(f); return v.every(function (x) { return x === v[0]; }); };
    A.openDialog('<h2 id="dlgH">⚖ Compare unit types</h2><p class="hint" style="margin-top:0">Rows that differ are highlighted.</p><div class="tw free ar-cmp"><table class="plain"><thead><tr><th></th>' +
      us.map(function (u) { return '<th>' + esc(u.b) + ' · ' + esc(u.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (same(r[1]) ? '' : ' class="ar-diff"') + '><th>' + r[0] + '</th>' + us.map(function (u) { return '<td>' + r[1](u) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div class="acts"><button class="btn" type="button" data-act="dlgclose">Close</button></div>');
  }
  function exportRows(rows) {
    if (!rows.length) { A.toast('Nothing to export'); return; }
    var a = arrUnits() || { byKey: {} };
    var out = rows.map(function (r) {
      var u = a.byKey[r.x.key] || {};
      return { Building: r.x.b, 'Unit type': r.x.name, Class: Object.keys(r.x.cls).join(', '), Tier: (u.tiers || []).join(', '), Levels: compress(r.x.levels), Floors: r.x.floors, Units: r.x.units,
        'Floor models': (u.fms || []).map(function (f) { return (f.name || f.num) + ' (' + f.text + ')'; }).join('; '), 'Typology model': u.model || '', 'MIDP typology': r.t ? r.t.name : '', Match: STATE[r.state] ? STATE[r.state][0] : '' };
    });
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(out); ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!cols'] = [{ wch: 9 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 7 }, { wch: 7 }, { wch: 50 }, { wch: 32 }, { wch: 40 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Unit types');
    XLSX.writeFile(wb, 'Arrangement_' + [UI.b, UI.c].filter(Boolean).join('_').replace(/[^A-Za-z0-9]+/g, '_') + (UI.b || UI.c ? '_' : '') + T.todayIso() + '.xlsx');
    A.toast('⬇ ' + A.plural(out.length, 'unit type') + ' exported');
  }

  // a small box in Files
  var vf = A.VIEWS.files;
  A.VIEWS.files = function () {
    var s = D ? bldList(D).map(function (b) { var x = bldSummary(D, b); return b + ': ' + x.types + ' types'; }).join(' · ') : '';
    return vf.apply(this, arguments) + '<div class="box as-box"><div class="toolbar" style="margin:0"><b>🏢 Model arrangement</b><span class="hint">' + (D ? esc(D.file) + ' · ' + esc(s) : 'Which unit types are on which levels — standard form or the architect’s stacking file') + '</span><span class="grow"></span>' +
      '<button class="btn small" type="button" data-act="arblank">⬇ Blank template</button><label class="btn small">⬆ Import<input type="file" id="arFile" accept=".xlsx,.xlsm,.xls" hidden></label>' +
      '<button class="btn small primary" type="button" data-go="arr">Open →</button></div></div>';
  };

  Object.assign(A.ACTIONS, {
    arsave: commit,
    arxpend: function () { downloadFilled(PEND); },
    arxsaved: function () { check(); downloadFilled(D); },
    arblank: downloadBlank,
    arf: function (el) {
      var v = el.getAttribute('data-v') || 'all';
      if (v.indexOf('b:') === 0) { UI.b = UI.b === v.slice(2) ? '' : v.slice(2); UI.f = 'all'; } else UI.f = v;
      A.render();
    },
    ardel: function () {
      if (!UI.del) { UI.del = true; A.render(); setTimeout(function () { UI.del = false; }, 4000); return; }
      UI.del = false; D = null; CK = null; ARU = null; try { localStorage.removeItem(KEY); } catch (e) {} A.render(); A.toast('Arrangement removed');
    },
    arpicks: function () {
      var n = 0; D.picks = D.picks || {};
      document.querySelectorAll('[data-arpick]').forEach(function (s) { if (s.value) { D.picks[s.getAttribute('data-arpick')] = s.value; n++; } });
      save(); CK = null; A.render(); A.toast(n ? A.plural(n, 'pick') + ' saved' : 'Nothing picked');
    },
    arunpick: function (el) { if (D && D.picks) { delete D.picks[el.getAttribute('data-v')]; save(); CK = null; A.render(); } },
    arcmp: function () { compare(Object.keys(UI.cmp)); },
    arcmpclr: function () { UI.cmp = {}; A.render(); },
    arxl: function () { exportRows(UI.shown || []); },
    arlook: function (el) { var v = el.getAttribute('data-v'); if (window.MIDP_EXT && MIDP_EXT.lookFor) MIDP_EXT.lookFor(v); else A.go('lookup'); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'arFile') { if (el.files[0]) readFile(el.files[0]); el.value = ''; }
    if (el.id === 'arB') { UI.b = el.value; A.render(); }
    if (el.id === 'arC') { UI.c = el.value; A.render(); }
    if (el.hasAttribute && el.hasAttribute('data-arcmp')) {
      var k = el.getAttribute('data-arcmp');
      if (el.checked) { if (Object.keys(UI.cmp).length >= 4) { el.checked = false; A.toast('Up to 4 unit types'); return; } UI.cmp[k] = 1; } else delete UI.cmp[k];
      A.render();
    }
  });
  var ext = window.MIDP_EXT || (window.MIDP_EXT = {}), prev = ext.afterCompute;
  ext.afterCompute = function () { if (prev) prev(); CK = null; };
  ext.arrangement = function () { return D; };            // for later phases (Lookup, stacking view)
  ext.arrUnits = arrUnits;                                 // the Lookup: levels, tier, class of each MIDP typology
  ext.arrCompare = compare;

  // for the tests
  window.MIDP_ARR_API = { parse: parse, expandLevels: expandLevels, compress: compress, sig: sig, unitRows: unitRows, check: function () { check(); return CK; }, get: function () { return D; } };

  var css = document.createElement('style');
  css.textContent = 'body.retro .hm-v small{font-family:Inter,system-ui,sans-serif;letter-spacing:0}.ar-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:8px 0}.ar-b{display:grid;gap:2px;padding:10px;font-size:13px}.ar-b b{font-size:15px}' +
    '.ar-w{max-height:30vh;overflow:auto;font-size:12.5px;line-height:1.5;padding:6px 8px;border:1px solid var(--edge);margin-top:4px;word-break:break-word}' +
    '.ar-tb{flex-wrap:wrap;margin:8px 0 0}.ar-f{flex-wrap:wrap;margin:0 0 8px}.ar-how{font-size:14px;line-height:1.55}.ar-how ol{padding-left:20px}' +
    '.ar-t td{vertical-align:top}.ar-lv{min-width:120px;word-break:break-word}.ar-flag{color:var(--warn);font-size:12px}' +
    '.ar-picks{display:grid;gap:6px}.ar-pick{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:8px;align-items:center}.ar-pick select{min-width:0;max-width:100%}' +
    '.ar-ch{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;font-size:12.5px;margin-top:8px;word-break:break-word}' +
    '.ar-cmp th{text-align:left;white-space:nowrap}.ar-cmp td{vertical-align:top;min-width:140px}.ar-diff{background:color-mix(in srgb,var(--warn) 12%,transparent)}' +
    '@media(max-width:560px){.ar-pick{grid-template-columns:1fr}.ar-t th:nth-child(4),.ar-t td:nth-child(4){display:none}}';
  document.head.appendChild(css);
};
