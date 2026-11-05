/* ═══════════════════════════════════════════════════════════════════
   skills/delegate/xlsm-template.js — fill Lew's Checklist template (.xlsm)
   ───────────────────────────────────────────────────────────────────
   templates/checklist-template.xlsm is Lew's own workbook (Lists ·
   Checklist generator · Gantt) with its macros and buttons.
   fill(JSZip, templateBuffer, plan) puts the tasks into it by editing the
   sheet XML directly, so the macros (vbaProject.bin) and the buttons stay
   exactly as they are. Excel would drop them if the file were rebuilt.

   Checklist generator (header row 9):
     A ID (task rows only, like the ADD TASK macro) · B item · C group ·
     D assignee · E priority · F target date · G status · H progress ·
     I notes · J "Website ID" (hidden; links each row back to the website)
     Item status words follow the template's list (Lists!E2:E4):
     DONE / No / In Progress.
   Gantt: one row per task with a date. Press EXECUTE GANTT to draw it.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CHK = 'xl/worksheets/sheet2.xml', GANTT = 'xl/worksheets/sheet3.xml';

  function x(s) {             // text that is safe inside XML (and has no characters Excel refuses)
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ' ').slice(0, 32000)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function str(ref, s, text) { return text === '' || text == null ? '<c r="' + ref + '" s="' + s + '"/>' : '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + x(text) + '</t></is></c>'; }
  function num(ref, s, n) { return '<c r="' + ref + '" s="' + s + '"><v>' + n + '</v></c>'; }
  function serial(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5) : null; }
  // the template's status words for items (Lists!E2:E4) and for task rows (as the ADD TASK macro writes them)
  function itemWord(s) { return s === 'Completed' ? 'DONE' : s === 'In progress' ? 'In Progress' : 'No'; }
  function taskWord(s) { return s === 'Completed' ? 'DONE' : s === 'In progress' ? 'In Progress' : 'Not Started'; }
  function setCell(xml, ref, newCell) {        // replace one existing cell (e.g. a title) with new content
    var re = new RegExp('<c r="' + ref + '"(?:[^>]*?/>|[^>]*>[\\s\\S]*?</c>)');
    return re.test(xml) ? xml.replace(re, newCell) : xml;
  }
  function styleOf(xml, ref, dflt) { var m = new RegExp('<c r="' + ref + '"[^>]*? s="(\\d+)"').exec(xml); return m ? m[1] : dflt; }

  function checklist(xml, plan) {
    var S = { task: styleOf(xml, 'A10', '37'), pct: styleOf(xml, 'H10', '38'), subA: styleOf(xml, 'A11', '41'), subB: styleOf(xml, 'B11', '42'), subA2: styleOf(xml, 'A12', '39'), subB2: styleOf(xml, 'B12', '40'), head: styleOf(xml, 'A9', '18') };
    xml = setCell(xml, 'A1', str('A1', styleOf(xml, 'A1', '0'), 'CHECKLIST GENERATOR   |   ' + plan.project));
    xml = setCell(xml, 'C8', str('C8', styleOf(xml, 'C8', '0'), plan.title));
    // header: add the hidden "Website ID" column
    xml = xml.replace(/(<row r="9"[^>]*?)spans="[^"]*"/, '$1spans="1:11"').replace(/(<row r="9"[\s\S]*?)<\/row>/, function (m, a) { return a + str('J9', S.head, 'Website ID') + str('K9', S.head, 'Tower · Typology · Model') + '</row>'; });
    if (!/<col min="10"/.test(xml)) xml = xml.replace('</cols>', '<col min="10" max="10" width="12" hidden="1" customWidth="1"/></cols>');
    if (!/<col min="11"/.test(xml)) xml = xml.replace('</cols>', '<col min="11" max="11" width="40" customWidth="1"/></cols>');   // drawing info from the MIDP Checker
    var rows = [], dv = [], r = 10, alt = 0;
    (plan.tasks || []).forEach(function (t) {
      var subs = t.subs || [], first = r + 1, last = r + subs.length;
      rows.push('<row r="' + r + '" spans="1:11">' + str('A' + r, S.task, t.code) + str('B' + r, S.task, t.title) + str('C' + r, S.task, t.group) + str('D' + r, S.task, t.assignees) +
        str('E' + r, S.task, t.priority || 'Medium') + str('F' + r, S.task, t.due || '') + str('G' + r, S.task, subs.length ? taskWord(t.statusNow || t.status) : taskWord(t.status)) +
        (subs.length ? '<c r="H' + r + '" s="' + S.pct + '"><f>COUNTIF(G' + first + ':G' + last + ',"Done")/' + subs.length + '</f></c>' : '<c r="H' + r + '" s="' + S.pct + '"/>') +
        str('I' + r, S.task, t.notes) + str('J' + r, '0', t.code) + '</row>');
      r++;
      subs.forEach(function (s) {
        var a = alt++ % 2 ? S.subA2 : S.subA, b = alt % 2 ? S.subB : S.subB2;
        rows.push('<row r="' + r + '" spans="1:11" outlineLevel="1">' + str('A' + r, a, '') + str('B' + r, b, s.title) + str('C' + r, a, '') + str('D' + r, a, s.assignees) + str('E' + r, a, '') +
          str('F' + r, a, s.due || '') + str('G' + r, a, itemWord(s.status)) + str('H' + r, a, '') + str('I' + r, a, s.notes) + str('J' + r, '0', s.code) + (s.info ? str('K' + r, a, s.info) : '') + '</row>');
        dv.push('G' + r); r++;
      });
    });
    var lastRow = Math.max(r - 1, 10);
    xml = xml.replace(/<row r="10"[\s\S]*<\/sheetData>/, rows.join('') + '</sheetData>');
    if (!/<row r="10"/.test(xml) && rows.length) xml = xml.replace('</sheetData>', rows.join('') + '</sheetData>');
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:J' + lastRow + '"/>');
    xml = xml.replace(/<xm:sqref>[^<]*<\/xm:sqref>/, '<xm:sqref>' + (dv.length ? dv.join(' ') : 'G' + (lastRow + 1)) + '</xm:sqref>');
    return xml;
  }

  function gantt(xml, plan) {
    var sA = styleOf(xml, 'A4', '3'), sB = styleOf(xml, 'B4', '5'), sD = styleOf(xml, 'C4', '4');
    // row 3: keep the headers (A–K), drop the old calendar cells — EXECUTE GANTT draws them again
    xml = xml.replace(/(<row r="3"[^>]*>)([\s\S]*?)(<\/row>)/, function (m, a, cells, c) {
      return a + (cells.match(/<c r="([A-K])3"(?:[^>]*?\/>|[^>]*>[\s\S]*?<\/c>)/g) || []).join('') + c;
    });
    var start = plan.issued || '', rows = [], r = 4, n = 1;
    (plan.tasks || []).forEach(function (t) {
      var end = serial(t.due); if (end == null) return;
      var st = serial(start); if (st == null || st > end) st = end;
      rows.push('<row r="' + r + '">' + num('A' + r, sA, n++) + str('B' + r, sB, t.code + ' ' + t.title) + num('C' + r, sD, st) + num('D' + r, sD, end) + '<c r="E' + r + '" s="' + sA + '"/></row>');
      r++;
    });
    xml = xml.replace(/<row r="4"[\s\S]*<\/sheetData>/, rows.join('') + '</sheetData>');
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:K' + Math.max(r - 1, 3) + '"/>');
    return xml;
  }

  /* plan = { project, title, issued (YYYY-MM-DD), tasks:[{code, group, title, assignees, due, status, notes, subs:[{code, title, assignees, due, status, notes}]}] } */
  function fill(JSZip, templateBuffer, plan) {
    return JSZip.loadAsync(templateBuffer).then(function (zip) {
      return Promise.all([zip.file(CHK).async('string'), zip.file(GANTT).async('string'), zip.file('xl/workbook.xml').async('string')]).then(function (p) {
        zip.file(CHK, checklist(p[0], plan));
        zip.file(GANTT, gantt(p[1], plan));
        // formulas were written without results → let Excel work them out when the file opens
        zip.file('xl/workbook.xml', p[2].replace(/<calcPr([^>]*?)\/>/, function (m, a) { return /fullCalcOnLoad/.test(a) ? m : '<calcPr' + a + ' fullCalcOnLoad="1"/>'; }));
        zip.remove('xl/calcChain.xml');
        return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      });
    });
  }

  var api = { fill: fill };
  root.LTXlsmTemplate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
