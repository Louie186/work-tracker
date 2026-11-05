/* ═══════════════════════════════════════════════════════════════════
   skills/delegate/planner-excel.js — the Excel "task plan" file
   ───────────────────────────────────────────────────────────────────
   Same look as Lew's Checklist generator: purple title bar, light-blue
   task rows, pale sub-rows (grouped with + / −), YELLOW = fill in.
   Plain values and simple formulas only — no locked sheet, no macros,
   no array formulas — so every Excel version opens it cleanly.
   build(ExcelJS, plan) → workbook:  Tasks · Guide · _lt (hidden: source)
   read(ExcelJS, buffer) → { meta, rows:[{id, status, notes, derived}] }
   Works in the browser and in Node (same code).
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var STATUSES = ['Not started', 'In progress', 'Completed'];
  var C = { title: 'FF3D2B56', sub: 'FF5B3E7E', head: 'FFD9E1F2', row: 'FFFBFBFD', line: 'FFD0D7E2', fillIn: 'FFFFF2CC', ink: 'FF1F2430', muted: 'FF6B7280',
    white: 'FFFFFFFF', red: 'FFC0392B', ok: 'FF2E8B57', okFill: 'FFE2F0D9', progFill: 'FFFFF4D6' };
  var FONT = 'Calibri';
  var thin = { style: 'thin', color: { argb: C.line } };
  var box = { top: thin, left: thin, bottom: thin, right: thin };
  var H = 5;            // header row on the Tasks sheet
  // A ID · B Task / checklist item · C Group · D Assignee · E Target date · F Status · G Progress · H Notes
  var COLS = [['ID', 8], ['Task / Checklist item', 46], ['Group', 18], ['Assignee', 18], ['Target date', 13], ['Status', 14], ['Progress', 10], ['Notes', 44], ['Tower · Typology · Model', 42]];

  function fill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function toDate(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s), d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    return d && !isNaN(d) ? d : null;
  }
  // Excel refuses the whole sheet if a cell holds characters XML can't carry (pasted tabs/bells/odd symbols)
  function clean(v) {
    if (v == null) return '';
    return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ' ')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1').slice(0, 32000);
  }
  function okStatus(v) { return STATUSES.indexOf(v) > -1 ? v : 'Not started'; }

  /* plan = { project, issuedBy, issuedAt (Date), scope, exportId, projectId, defaultGroup, spareTasks (3), spareSubs (5),
              tasks:[{code, group, title, assignees, due, status, notes, subs:[{code, title, assignees, due, status, notes}]}] } */
  function build(ExcelJS, plan) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "Lew's Tracker"; wb.created = plan.issuedAt || new Date();
    // the workbook "window" — without it some Excel versions open the file as a blank grey screen
    wb.views = [{ x: 0, y: 0, width: 28800, height: 15000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
    var issued = plan.issuedAt || new Date();
    var ws = wb.addWorksheet('Tasks', { properties: { tabColor: { argb: C.sub }, outlineLevelRow: 1, outlineProperties: { summaryBelow: false } },
      views: [{ state: 'frozen', ySplit: H, xSplit: 0, showGridLines: false }],
      pageSetup: { orientation: 'landscape' } });   // no fitToPage: with row grouping, ExcelJS writes them in an order Excel rejects (blank sheet)
    COLS.forEach(function (c, i) { ws.getColumn(i + 1).width = c[1]; });

    // title bar (row 1) + info line (row 2) + how-to line (row 3)
    ws.mergeCells('A1:I1');
    var t1 = ws.getCell('A1');
    t1.value = clean('TASK PLAN   |   ' + (plan.project || ''));
    t1.font = { name: FONT, bold: true, size: 14, color: { argb: C.white } }; t1.fill = fill(C.title); t1.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 26;
    ws.getCell('A2').value = clean('Issued by: ' + (plan.issuedBy || '—') + '     Issued: ' + issued.toDateString().slice(4) + (plan.scope ? '     For: ' + plan.scope : ''));
    ws.getCell('A2').font = { name: FONT, size: 10, color: { argb: C.muted } };
    ws.getCell('A3').value = 'Update the YELLOW boxes (Status, Notes).  To ADD: insert a row in a group (ID empty) = new item;  use a NEW block at the bottom = new task.  Then ⬆ Import update.';
    ws.getCell('A3').font = { name: FONT, size: 10, italic: true, color: { argb: C.sub } };

    COLS.forEach(function (c, i) {
      var h = ws.getCell(H, i + 1); h.value = c[0];
      h.font = { name: FONT, bold: true, color: { argb: C.white } }; h.fill = fill(C.sub); h.border = box;
      h.alignment = { vertical: 'middle', horizontal: i === 0 || i >= 4 && i <= 6 ? 'center' : 'left' };
    });
    ws.getRow(H).height = 22;

    var r = H + 1, statusCells = [];
    var pct = function (row) { return 'IF(F' + row + '="Completed",1,IF(F' + row + '="In progress",0.5,0))'; };
    function styleRow(row, isTask) {
      for (var c = 1; c <= COLS.length; c++) {
        var cell = ws.getCell(row, c);
        cell.border = box; cell.fill = fill(isTask ? C.head : C.row);
        cell.font = { name: FONT, size: 10, bold: isTask && c <= 2, color: { argb: C.ink } };
        cell.alignment = { vertical: 'top', wrapText: c === 2 || c === 8, horizontal: c === 1 || c >= 5 && c <= 7 ? 'center' : 'left', indent: !isTask && c === 2 ? 2 : 0 };
      }
      ws.getCell(row, 5).numFmt = 'dd mmm yyyy';
      ws.getCell(row, 7).numFmt = '0%';
    }
    function fillIn(row) {           // the two cells the team may change
      [6, 8].forEach(function (c) { ws.getCell(row, c).fill = fill(C.fillIn); });
      statusCells.push('F' + row);
    }

    (plan.tasks || []).forEach(function (t) {
      var subs = t.subs || [], tr = r;
      styleRow(tr, true);
      ws.getCell(tr, 1).value = clean(t.code);
      ws.getCell(tr, 2).value = clean(t.title);
      ws.getCell(tr, 3).value = clean(t.group);
      ws.getCell(tr, 4).value = clean(t.assignees);
      var due = toDate(t.due); if (due) ws.getCell(tr, 5).value = due;
      ws.getCell(tr, 8).value = clean(t.notes);
      if (subs.length) {
        var a = tr + 1, b = tr + subs.length, rng = 'F' + a + ':F' + b;
        ws.getCell(tr, 7).value = { formula: 'IFERROR((COUNTIF(' + rng + ',"Completed")+COUNTIF(' + rng + ',"In progress")/2)/' + subs.length + ',0)' };
        ws.getCell(tr, 6).value = { formula: 'IF(COUNTIF(' + rng + ',"Completed")=' + subs.length + ',"Completed",IF(COUNTIF(' + rng + ',"Not started")=' + subs.length + ',"Not started","In progress"))' };
        ws.getCell(tr, 6).font = { name: FONT, size: 10, italic: true, color: { argb: C.muted } };
        ws.getCell(tr, 8).fill = fill(C.fillIn);
      } else {
        ws.getCell(tr, 6).value = okStatus(t.status);
        ws.getCell(tr, 7).value = { formula: pct(tr) };
        fillIn(tr);
      }
      r++;
      subs.forEach(function (s) {
        styleRow(r, false);
        ws.getCell(r, 1).value = clean(s.code);
        ws.getCell(r, 2).value = clean(s.title);
        ws.getCell(r, 4).value = clean(s.assignees);
        var sd = toDate(s.due) || due; if (sd) ws.getCell(r, 5).value = sd;
        ws.getCell(r, 6).value = okStatus(s.status);
        ws.getCell(r, 7).value = { formula: pct(r) };
        ws.getCell(r, 8).value = clean(s.notes);
        if (s.info) ws.getCell(r, 9).value = clean(s.info);
        fillIn(r);
        ws.getRow(r).outlineLevel = 1;
        Object.defineProperty(ws.getRow(r), 'collapsed', { value: false });   // shown rows must not be marked "collapsed"
        r++;
      });
    });
    // ready-made empty task blocks (already grouped with + / −) for adding new work in Excel
    var SPARE = plan.spareTasks == null ? 3 : plan.spareTasks, SPARE_SUBS = plan.spareSubs || 5;
    if (SPARE > 0) {
      ws.getCell(r, 1).value = 'ADD NEW TASKS BELOW — type a task name next to NEW, its items in the rows under it. Empty blocks are ignored on import.';
      ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: C.sub } };
      r++;
    }
    for (var k = 0; k < SPARE; k++) {
      styleRow(r, true);
      ws.getCell(r, 1).value = 'NEW';
      if (plan.defaultGroup) ws.getCell(r, 3).value = clean(plan.defaultGroup);
      [2, 3, 4, 5, 6, 8].forEach(function (c) { ws.getCell(r, c).fill = fill(C.fillIn); });
      statusCells.push('F' + r);
      r++;
      for (var j = 0; j < SPARE_SUBS; j++) {
        styleRow(r, false);
        [2, 4, 5, 6, 8].forEach(function (c) { ws.getCell(r, c).fill = fill(C.fillIn); });
        statusCells.push('F' + r);
        ws.getRow(r).outlineLevel = 1;
        Object.defineProperty(ws.getRow(r), 'collapsed', { value: false });
        r++;
      }
    }
    var LAST = Math.max(r - 1, H + 1);

    statusCells.forEach(function (a) {
      ws.getCell(a).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + STATUSES.join(',') + '"'], showErrorMessage: true, errorTitle: 'Status', error: 'Pick Not started, In progress or Completed' };
    });
    ws.autoFilter = { from: { row: H, column: 1 }, to: { row: LAST, column: COLS.length } };
    var body = 'A' + (H + 1) + ':H' + LAST;
    ws.addConditionalFormatting({ ref: body, rules: [
      { type: 'expression', priority: 1, formulae: ['AND($E' + (H + 1) + '<>"",$E' + (H + 1) + '<TODAY(),$F' + (H + 1) + '<>"Completed")'], style: { font: { color: { argb: C.red }, bold: true } } },
      { type: 'expression', priority: 2, formulae: ['$F' + (H + 1) + '="Completed"'], style: { font: { color: { argb: C.ok } } } }
    ] });
    ws.addConditionalFormatting({ ref: 'G' + (H + 1) + ':G' + LAST, rules: [
      { type: 'expression', priority: 3, formulae: ['AND(ISNUMBER(G' + (H + 1) + '),G' + (H + 1) + '>=1)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.okFill } } } },
      { type: 'expression', priority: 4, formulae: ['AND(ISNUMBER(G' + (H + 1) + '),G' + (H + 1) + '>0,G' + (H + 1) + '<1)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.progFill } } } }
    ] });

    // small summary, top right (row 2-3)
    var F = 'F' + (H + 1) + ':F' + LAST, E = 'E' + (H + 1) + ':E' + LAST;
    [['F2', 'Done', 'G2', 'COUNTIF(' + F + ',"Completed")&" / "&COUNTA(' + F + ')'],
     ['F3', 'Overdue', 'G3', 'COUNTIFS(' + E + ',"<"&TODAY(),' + F + ',"<>Completed")'],
     ['H2', null, null, null]].forEach(function (x) {
      if (!x[1]) return;
      ws.getCell(x[0]).value = x[1]; ws.getCell(x[0]).font = { name: FONT, bold: true, size: 9, color: { argb: C.muted } }; ws.getCell(x[0]).alignment = { horizontal: 'right' };
      ws.getCell(x[2]).value = { formula: x[3] }; ws.getCell(x[2]).font = { name: FONT, bold: true, size: 11, color: { argb: x[1] === 'Overdue' ? C.red : C.ink } };
      ws.getCell(x[2]).alignment = { horizontal: 'center' };
    });

    /* ---------- Guide ---------- */
    var g = wb.addWorksheet('Guide', { views: [{ showGridLines: false }] });
    g.getColumn(1).width = 96;
    g.getCell('A1').value = 'HOW TO USE THIS FILE'; g.getCell('A1').font = { name: FONT, bold: true, size: 14, color: { argb: C.white } }; g.getCell('A1').fill = fill(C.title);
    ['', '1.  Go to the Tasks sheet and find your name under Assignee.',
      '2.  Change Status with the drop-down: Not started / In progress / Completed.',
      '3.  Write your updates in Notes.',
      '4.  Only the YELLOW boxes are for you. Progress and the main task status fill in by themselves.',
      '5.  Use + / − on the left to open or close sub-rows.',
      '6.  Save and send the file back. Please keep the IDs and the file name as they are.',
      '',
      'ADDING MORE IN THE SAME FILE',
      '•  New sub-item:  right-click a row inside the task\'s group → Insert.  Leave ID EMPTY.  Type the item name (Assignee, Target date, Status optional).',
      '•  New task:  use an empty NEW block at the bottom (already grouped with + / −).  Type the task name next to NEW and its items in the rows under it.',
      '   Need more?  Copy a whole NEW block (task row + its rows) and paste it below.  Or type NEW in the ID of any new row.',
      '•  The website gives them proper IDs when you press ⬆ Import update.  Importing the same file again will not add them twice.',
      '', 'Red text = overdue.   Green text = completed.',
      '', 'Made with Lew\'s Tracker — Delegation.'].forEach(function (t, i) {
      var c = g.getCell(i + 2, 1); c.value = t; c.font = { name: FONT, size: 11 };
    });

    /* ---------- hidden: where this file came from ---------- */
    var meta = wb.addWorksheet('_lt', { state: 'veryHidden' });
    meta.getCell('A1').value = 'lt-planner'; meta.getCell('B1').value = 2;
    meta.getCell('A2').value = clean(plan.projectId); meta.getCell('A3').value = clean(plan.exportId); meta.getCell('A4').value = issued.toISOString();
    meta.getCell('A5').value = clean(plan.project);
    return wb;
  }

  /* ---------- read a returned file ---------- */
  function text(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (x) { return x.text; }).join('');
      if (v.result !== undefined) return text(v.result);
      if (v.text !== undefined) return String(v.text);
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return '';
    }
    return String(v);
  }
  // "Done" / "Yes" (checklist style) → Completed, "No" → Not started
  function normStatus(v) {
    var t = String(v || '').trim().toLowerCase();
    if (t === 'done' || t === 'yes' || t === 'complete' || t === 'completed') return 'Completed';
    if (t === 'in progress' || t === 'wip' || t === 'started') return 'In progress';
    if (t === 'no' || t === 'not started' || t === 'not yet') return 'Not started';
    return String(v || '').trim();
  }
  function read(ExcelJS, buffer) {
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buffer).then(function () {
      var meta = {};
      var m = wb.getWorksheet('_lt');
      if (m) meta = { projectId: text(m.getCell('A2').value), exportId: text(m.getCell('A3').value), exportedAt: text(m.getCell('A4').value), project: text(m.getCell('A5').value) };
      var ws = wb.getWorksheet('Tasks') || wb.getWorksheet('Checklist generator');
      if (!ws) throw new Error('No "Tasks" or "Checklist generator" sheet in this file — is it a file from Delegation?');
      var head = 0, col = {};
      for (var r = 1; r <= Math.min(20, ws.rowCount); r++) {
        var row = ws.getRow(r), found = {};
        row.eachCell(function (c, i) {
          var t = text(c.value).trim().toLowerCase(); if (!t) return;
          if (t === 'website id') found.wid = found.wid || i;
          else if (t === 'id' || t === 'task id') found.id = found.id || i;
          else if (/^status/.test(t)) found.status = found.status || i;
          else if (/^notes?$/.test(t)) found.notes = found.notes || i;
          else if (/^(subtask|item)/.test(t)) found.sub = found.sub || i;
          else if (/^task/.test(t)) found.title = found.title || i;
          else if (/^group/.test(t)) found.group = found.group || i;
          else if (/^(assignee|assigned)/.test(t)) found.who = found.who || i;
          else if (/^(target date|due)/.test(t)) found.due = found.due || i;
        });
        if (found.id && found.status) { head = r; col = found; break; }
      }
      if (!head) throw new Error('Could not find the header row (ID … Status … Notes) on the Tasks sheet.');
      var rows = [];
      var cellText = function (row, c) { return c ? text(row.getCell(c).value).trim() : ''; };
      for (var i = head + 1; i <= ws.rowCount; i++) {
        var R = ws.getRow(i), id = cellText(R, col.id);
        // Checklist template: the hidden Website ID is the real link. A row with an ID but no Website ID was
        // made by the ADD TASK macro → a new task; a row with neither → a new item under the task above.
        if (col.wid) { var w = cellText(R, col.wid); id = w || (id ? 'NEW' : ''); }
        // the old layout had separate Task / Subtask columns ("↳ name")
        var title = (cellText(R, col.sub).replace(/^↳\s*/, '') || cellText(R, col.title)).replace(/^↳\s*/, '');
        if (!id && !title) continue;                       // empty row
        if (/^ADD NEW TASKS/i.test(id)) continue;         // the note above the empty NEW blocks
        var stCell = R.getCell(col.status), dueV = col.due ? R.getCell(col.due).value : null;
        if (dueV && typeof dueV === 'object' && dueV.result !== undefined) dueV = dueV.result;
        rows.push({
          id: id, title: title,
          group: cellText(R, col.group), assignees: cellText(R, col.who),
          due: dueV instanceof Date ? dueV.toISOString().slice(0, 10) : (/^\d{4}-\d{2}-\d{2}/.exec(String(dueV || '')) || [''])[0],
          status: normStatus(text(stCell.value)),
          derived: !!(stCell.value && typeof stCell.value === 'object' && stCell.value.formula),
          notes: col.notes ? text(R.getCell(col.notes).value) : null
        });
      }
      return { meta: meta, rows: rows };
    });
  }

  /* ExcelJS writes <font> parts in an order Microsoft's checker flags (e.g. colour before size).
     Put them in the official order so the file passes with 0 errors. Needs JSZip; skipped without it. */
  var FONT_ORDER = ['b', 'i', 'strike', 'condense', 'extend', 'outline', 'shadow', 'u', 'vertAlign', 'sz', 'color', 'name', 'family', 'charset', 'scheme'];
  function tidyFonts(xml) {
    return xml.replace(/<font>([\s\S]*?)<\/font>/g, function (all, inner) {
      var parts = inner.match(/<(\w+)(?:\s[^>]*)?\/>|<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\2>/g) || [];
      var tag = function (x) { return /^<(\w+)/.exec(x)[1]; };
      parts.sort(function (a, b) { return FONT_ORDER.indexOf(tag(a)) - FONT_ORDER.indexOf(tag(b)); });
      return '<font>' + parts.join('') + '</font>';
    });
  }
  function toBuffer(wb, JSZip) {
    return wb.xlsx.writeBuffer().then(function (buf) {
      if (!JSZip) return buf;
      return JSZip.loadAsync(buf).then(function (zip) {
        var f = zip.file('xl/styles.xml'); if (!f) return buf;
        return f.async('string').then(function (xml) {
          zip.file('xl/styles.xml', tidyFonts(xml));
          return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        });
      });
    });
  }

  var api = { build: build, read: read, toBuffer: toBuffer, STATUSES: STATUSES };
  root.LTPlannerExcel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
