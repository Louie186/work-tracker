/* ═══════════════════════════════════════════════════════════════════
   core/expenses.js — 🧾 Shared expenses (Finance page)
   ───────────────────────────────────────────────────────────────────
   A quick list of what you bought and what it cost — total worked out,
   a budget warning, and (if you say who paid) who owes whom. Then:
     📤 Share  → the phone's share menu (Messenger, WhatsApp…)
     📋 Copy   → paste in any chat
     ⬇ Excel  → a CSV file that opens in Excel (PC)
   Quick add: "Rice 50" · "50 rice" · "Milk - 12.5 QAR"; or paste a whole
   list from a chat (one item per line). Saved with your To Do / Finance
   data (data.expenses) — so the data folder / backup keep it too.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CURR = ['QAR', 'PHP', 'USD', 'EUR', 'AED', 'SAR', 'GBP'];
  function E() {
    data.expenses = data.expenses || { lists: [], cur: '', people: 'Me, Wife', currency: 'QAR' };
    return data.expenses;
  }
  function cur() { var X = E(); return X.lists.filter(function (l) { return l.id === X.cur; })[0] || X.lists[0] || null; }
  function people(l) { return String((l && l.people) || E().people || '').split(/\s*,\s*/).filter(Boolean); }
  function n2(n) { n = Math.round((+n || 0) * 100) / 100; return n % 1 ? n.toFixed(2) : String(n); }
  function money(n, c) { return n2(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ' + (c || 'QAR'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nice(s) { var d = new Date((s || today()) + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  function persist() { save(); render(); }

  // "Rice 50" · "50 rice" · "Milk - 12.50 QAR" · "• Eggs: 18" · "2x Bread 6" → name + amount
  function parse(line) {
    var s = String(line || '').replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim();
    if (!s || /^(total|subtotal|sum)\b/i.test(s)) return null;
    var m = /^(.*?)[\s:=–—-]*(-?\d[\d,]*(?:\.\d+)?)\s*(?:qar|qr|riyals?|php|usd|aed|sar|eur|gbp|\$|₱)?\s*$/i.exec(s);
    if (m && m[1].trim()) return { name: m[1].trim().replace(/[\s:=–—-]+$/, ''), amount: +m[2].replace(/,/g, '') };
    m = /^(-?\d[\d,]*(?:\.\d+)?)\s*(?:qar|qr|riyals?|php|usd|aed|sar|eur|gbp)?\s+(.+)$/i.exec(s);
    if (m) return { name: m[2].trim(), amount: +m[1].replace(/,/g, '') };
    return { name: s, amount: 0 };
  }

  // who paid what, everyone's share (equal split), and who pays whom
  function sums(l) {
    var ppl = people(l), total = 0, paid = {}, nobody = 0;
    ppl.forEach(function (p) { paid[p] = 0; });
    l.items.forEach(function (it) { var a = +it.amount || 0; total += a; if (it.by && paid[it.by] !== undefined) paid[it.by] += a; else nobody += a; });
    var anyPayer = l.items.some(function (it) { return it.by && paid[it.by] !== undefined; });
    var moves = [];
    if (anyPayer && ppl.length > 1) {
      var share = (total - nobody) / ppl.length, bal = ppl.map(function (p) { return { p: p, v: Math.round((paid[p] - share) * 100) / 100 }; });
      var give = bal.filter(function (b) { return b.v < -0.004; }), get = bal.filter(function (b) { return b.v > 0.004; });
      give.forEach(function (g) {
        get.forEach(function (r) {
          var x = Math.min(-g.v, r.v); if (x > 0.004) { moves.push({ from: g.p, to: r.p, amount: x }); g.v += x; r.v -= x; }
        });
      });
      return { total: total, paid: paid, nobody: nobody, share: share, moves: moves, split: true };
    }
    return { total: total, paid: paid, nobody: nobody, moves: [], split: false };
  }

  function text(l) {
    var c = l.currency || 'QAR', S = sums(l), out = ['🧾 ' + l.name + ' · ' + nice(l.date)];
    l.items.forEach(function (it, i) { out.push((i + 1) + '. ' + it.name + ' — ' + money(it.amount, c) + (it.by && S.split ? ' (' + it.by + ')' : '')); });
    out.push('──────────', 'Total: ' + money(S.total, c) + ' (' + l.items.length + ' item' + (l.items.length === 1 ? '' : 's') + ')');
    if (+l.budget) out.push(S.total > +l.budget ? '⚠️ Over budget by ' + money(S.total - l.budget, c) + ' (budget ' + money(l.budget, c) + ')' : '✅ Within budget — ' + money(l.budget - S.total, c) + ' left (budget ' + money(l.budget, c) + ')');
    if (S.split) {
      out.push('Paid: ' + Object.keys(S.paid).map(function (p) { return p + ' ' + money(S.paid[p], c); }).join(' · '));
      out.push(S.moves.length ? S.moves.map(function (m) { return '➡️ ' + m.from + ' pays ' + m.to + ' ' + money(m.amount, c); }).join('\n') + ' (each ' + money(S.share, c) + ')' : '✅ All even (each ' + money(S.share, c) + ')');
    }
    return out.join('\n');
  }

  /* ---------- the card ---------- */
  function host() {
    var sec = document.getElementById('finance'); if (!sec) return null;
    var el = document.getElementById('expCard');
    if (!el) { el = document.createElement('div'); el.id = 'expCard'; el.className = 'card exp-card'; sec.insertBefore(el, sec.firstChild); }
    return el;
  }
  function render() {
    var el = host(); if (!el || typeof data === 'undefined' || !data) return;
    if (typeof isFinanceLocked === 'function' && isFinanceLocked()) { el.innerHTML = '<h3>🧾 Shared expenses</h3><p class="small">Finance is locked.</p>'; return; }
    var X = E(), l = cur();
    var tabs = X.lists.map(function (x) { return '<button class="exp-tab' + (l && x.id === l.id ? ' on' : '') + (x.settled ? ' done' : '') + '" onclick="EXP.open(\'' + x.id + '\')">' + esc(x.name) + '</button>'; }).join('');
    var h = '<div class="exp-h"><h3>🧾 Shared expenses</h3><span class="small">Items + cost → total, who owes whom, share to chat</span></div>' +
      '<div class="exp-tabs">' + tabs + '<button class="exp-tab add" onclick="EXP.newList()">＋ New list</button></div>';
    if (!l) { el.innerHTML = h + '<p class="small">Make a list (e.g. “Groceries 6 Nov”), type each item with its cost, and share it to your chat.</p>'; return; }
    var c = l.currency || 'QAR', S = sums(l), ppl = people(l), over = +l.budget && S.total > +l.budget;
    var pct = +l.budget ? Math.min(100, 100 * S.total / l.budget) : 0;
    h += '<div class="exp-meta"><input class="exp-name" value="' + esc(l.name) + '" onchange="EXP.set(\'name\',this.value)" aria-label="List name">' +
      '<input type="date" value="' + esc(l.date || today()) + '" onchange="EXP.set(\'date\',this.value)" aria-label="Date">' +
      '<select onchange="EXP.set(\'currency\',this.value)" aria-label="Currency">' + CURR.concat(CURR.indexOf(c) < 0 ? [c] : []).map(function (x) { return '<option' + (x === c ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
      '<label class="exp-b">Budget <input type="number" inputmode="decimal" min="0" step="any" value="' + (l.budget || '') + '" placeholder="optional" onchange="EXP.set(\'budget\',this.value)"></label>' +
      '<label class="exp-b">People <input value="' + esc(l.people || X.people || '') + '" placeholder="Me, Wife" onchange="EXP.set(\'people\',this.value)" title="Names, comma between — for “who paid”"></label></div>';
    h += '<div class="exp-add"><input id="expQ" placeholder="Item and cost, e.g. Rice 50" enterkeyhint="done" onkeydown="if(event.key===\'Enter\'){event.preventDefault();EXP.quick()}"><button class="btn primary" onclick="EXP.quick()">Add</button><button class="btn" onclick="EXP.pasteBox()" title="Paste a list from a chat — one item per line">📋 Paste list</button></div>' +
      '<div id="expPaste" hidden class="exp-paste"><textarea id="expPT" rows="5" placeholder="Rice 50&#10;Milk - 12.5&#10;• Eggs: 18"></textarea><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn" onclick="EXP.pasteBox()">Cancel</button><button class="btn primary" onclick="EXP.pasteAdd()">Add all</button></div></div>';
    h += '<div class="exp-items">' + (l.items.length ? l.items.map(function (it, i) {
      return '<div class="exp-row"><span class="exp-n">' + (i + 1) + '</span><input class="exp-in" value="' + esc(it.name) + '" onchange="EXP.item(' + i + ',\'name\',this.value)" aria-label="Item">' +
        '<input class="exp-amt" type="number" inputmode="decimal" step="any" value="' + n2(it.amount) + '" onchange="EXP.item(' + i + ',\'amount\',this.value)" aria-label="Cost">' +
        (ppl.length > 1 ? '<select class="exp-by" onchange="EXP.item(' + i + ',\'by\',this.value)" aria-label="Paid by"><option value="">paid by…</option>' + ppl.map(function (p) { return '<option' + (it.by === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' : '') +
        '<button class="exp-x" onclick="EXP.del(' + i + ')" aria-label="Remove">×</button></div>';
    }).join('') : '<p class="small" style="margin:6px 0">No items yet — type “Rice 50” above and press Enter.</p>') + '</div>';
    h += '<div class="exp-sum' + (over ? ' over' : '') + '"><div class="exp-total"><span>Total</span><b>' + money(S.total, c) + '</b><span class="small">' + l.items.length + ' item' + (l.items.length === 1 ? '' : 's') + '</span></div>' +
      (+l.budget ? '<div class="exp-bar"><i style="width:' + pct + '%"></i></div><div class="small">' + (over ? '⚠️ Over budget by <b>' + money(S.total - l.budget, c) + '</b>' : '✅ ' + money(l.budget - S.total, c) + ' left of ' + money(l.budget, c)) + '</div>' : '') +
      (S.split ? '<div class="small exp-split">Paid: ' + Object.keys(S.paid).map(function (p) { return esc(p) + ' <b>' + money(S.paid[p], c) + '</b>'; }).join(' · ') + '<br>' +
        (S.moves.length ? S.moves.map(function (m) { return '➡️ <b>' + esc(m.from) + '</b> pays <b>' + esc(m.to) + '</b> ' + money(m.amount, c); }).join('<br>') : '✅ All even') + ' <span class="small">(each ' + money(S.share, c) + ')</span>' +
        (S.nobody ? '<br><span class="small">' + money(S.nobody, c) + ' without “paid by” — not split</span>' : '') + '</div>' : '') + '</div>';
    h += '<div class="exp-acts"><button class="btn primary" onclick="EXP.share()">📤 Share</button><button class="btn" onclick="EXP.copy()">📋 Copy</button><button class="btn" onclick="EXP.csv()">⬇ Excel</button>' +
      '<span class="grow"></span><button class="btn" onclick="EXP.settle()">' + (l.settled ? '↩ Reopen' : '✓ Settled') + '</button><button class="btn" onclick="EXP.dup()" title="Same items for next time">⧉ Copy list</button><button class="btn danger" onclick="EXP.delList()">Delete list</button></div>' +
      '<details class="exp-prev"><summary class="small">Preview of the text</summary><pre>' + esc(text(l)) + '</pre></details>';
    el.innerHTML = h;
  }

  /* ---------- actions ---------- */
  window.EXP = {
    open: function (id) { E().cur = id; persist(); },
    newList: function () {
      var X = E(), d = today(), name = prompt('Name of the list', 'Groceries ' + nice(d).replace(/,? \d{4}$/, '')); if (name === null) return;
      var l = { id: 'x' + uid(), name: name.trim() || 'Expenses', date: d, currency: X.currency || 'QAR', budget: '', people: X.people || 'Me, Wife', items: [], settled: false, created: new Date().toISOString() };
      X.lists.unshift(l); X.cur = l.id; persist(); setTimeout(function () { var q = document.getElementById('expQ'); if (q) q.focus(); }, 50);
    },
    set: function (k, v) {
      var l = cur(); if (!l) return;
      if (k === 'budget') v = v === '' ? '' : +v;
      l[k] = v; if (k === 'currency') E().currency = v; if (k === 'people') E().people = v; persist();
    },
    quick: function () {
      var q = document.getElementById('expQ'), l = cur(); if (!q || !l) return;
      var it = parse(q.value); if (!it) return;
      if (!it.amount) { var a = prompt('Cost of “' + it.name + '”?'); if (a === null) return; it.amount = +String(a).replace(/[^\d.-]/g, '') || 0; }
      l.items.push({ name: it.name, amount: it.amount, by: '' }); persist();
      setTimeout(function () { var q2 = document.getElementById('expQ'); if (q2) q2.focus(); }, 30);
    },
    pasteBox: function () { var b = document.getElementById('expPaste'); if (!b) return; b.hidden = !b.hidden; if (!b.hidden) document.getElementById('expPT').focus(); },
    pasteAdd: function () {
      var l = cur(), t = document.getElementById('expPT'); if (!l || !t) return;
      var n = 0; t.value.split(/\r?\n/).forEach(function (line) { var it = parse(line); if (it && it.name) { l.items.push({ name: it.name, amount: it.amount, by: '' }); n++; } });
      persist(); if (typeof toastMsg === 'function') toastMsg('🧾 ' + n + ' item' + (n === 1 ? '' : 's') + ' added');
    },
    item: function (i, k, v) { var l = cur(); if (!l || !l.items[i]) return; l.items[i][k] = k === 'amount' ? +v || 0 : v; persist(); },
    del: function (i) { var l = cur(); if (!l) return; l.items.splice(i, 1); persist(); },
    delList: function () { var X = E(), l = cur(); if (!l || !confirm('Delete the list “' + l.name + '”?')) return; X.lists = X.lists.filter(function (x) { return x !== l; }); X.cur = X.lists[0] ? X.lists[0].id : ''; persist(); },
    settle: function () { var l = cur(); if (!l) return; l.settled = !l.settled; persist(); },
    dup: function () {
      var X = E(), l = cur(); if (!l) return;
      var c = JSON.parse(JSON.stringify(l)); c.id = 'x' + uid(); c.name = l.name + ' (copy)'; c.date = today(); c.settled = false; c.items.forEach(function (it) { it.by = ''; });
      X.lists.unshift(c); X.cur = c.id; persist();
    },
    copy: function () {
      var l = cur(); if (!l) return; var t = text(l);
      var ok = function () { if (typeof toastMsg === 'function') toastMsg('📋 Copied — paste it in your chat'); };
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(ok, function () {
        var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { alert(t); } ta.remove();
      });
    },
    share: function () {
      var l = cur(); if (!l) return; var t = text(l);
      if (navigator.share) navigator.share({ title: l.name, text: t }).catch(function (e) { if (e && e.name !== 'AbortError') EXP.copy(); });
      else EXP.copy();
    },
    csv: function () {
      var l = cur(); if (!l) return; var c = l.currency || 'QAR', S = sums(l);
      var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var rows = [['#', 'Item', 'Cost (' + c + ')', 'Paid by']].concat(l.items.map(function (it, i) { return [i + 1, it.name, n2(it.amount), it.by || '']; }));
      rows.push([], ['', 'Total', n2(S.total), '']); if (+l.budget) rows.push(['', 'Budget', n2(l.budget), ''], ['', S.total > l.budget ? 'Over budget' : 'Left', n2(Math.abs(l.budget - S.total)), '']);
      S.moves.forEach(function (m) { rows.push(['', m.from + ' pays ' + m.to, n2(m.amount), '']); });
      var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      var d = new Date(); a.download = (l.name.replace(/[^A-Za-z0-9]+/g, '_') || 'Expenses') + '_' + today() + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    _parse: parse, _text: text, _sums: sums
  };

  // draw it with the Finance page
  var orig = window.renderBudgets;
  if (typeof orig === 'function') window.renderBudgets = function () { var r = orig.apply(this, arguments); try { render(); } catch (e) { console.error(e); } return r; };
  window.renderExpenses = render;

  var css = document.createElement('style');
  css.textContent = '.exp-card{margin-bottom:14px;display:grid;gap:10px}.exp-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.exp-h h3{margin:0}' +
    '.exp-tabs{display:flex;gap:6px;flex-wrap:wrap}.exp-tab{border:1px solid var(--line,#ccc);background:var(--panel2,transparent);color:var(--ink);border-radius:99px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}' +
    '.exp-tab.on{background:var(--accent);color:var(--accent-ink,#111);border-color:var(--accent);font-weight:700}.exp-tab.done{opacity:.6;text-decoration:line-through}.exp-tab.add{border-style:dashed}' +
    '.exp-meta{display:grid;grid-template-columns:2fr 1fr 90px 1fr 1.4fr;gap:6px;align-items:end}.exp-meta input,.exp-meta select{width:100%;min-width:0}.exp-name{font-weight:700}.exp-b{display:grid;gap:2px;font-size:11px;color:var(--muted)}' +
    '.exp-add{display:flex;gap:6px}.exp-add input{flex:1;min-width:0;font-size:15px}.exp-paste{display:grid;gap:6px}.exp-paste[hidden]{display:none}.exp-paste textarea{width:100%;font-size:14px}' +
    '.exp-items{display:grid;gap:4px}.exp-row{display:grid;grid-template-columns:22px minmax(0,1fr) 96px auto 30px;gap:6px;align-items:center}.exp-row:not(:has(.exp-by)){grid-template-columns:22px minmax(0,1fr) 96px 30px}' +
    '.exp-n{font-size:11px;color:var(--muted);text-align:right}.exp-in,.exp-amt,.exp-by{width:100%;min-width:0;padding:6px 8px}.exp-amt{text-align:right;font-variant-numeric:tabular-nums}.exp-by{max-width:130px}' +
    '.exp-x{border:0;background:none;color:var(--red,#c62828);font-size:20px;cursor:pointer;line-height:1}' +
    '.exp-sum{border-radius:14px;padding:10px 12px;background:color-mix(in srgb,var(--accent) 12%,transparent);display:grid;gap:6px}.exp-sum.over{background:color-mix(in srgb,var(--red,#c62828) 14%,transparent)}' +
    '.exp-total{display:flex;align-items:baseline;gap:10px}.exp-total b{font-size:24px;font-variant-numeric:tabular-nums}.exp-bar{height:8px;border-radius:99px;background:color-mix(in srgb,var(--muted) 25%,transparent);overflow:hidden}.exp-bar i{display:block;height:100%;background:var(--green,#2e7d32)}.exp-sum.over .exp-bar i{background:var(--red,#c62828)}' +
    '.exp-split{line-height:1.6}.exp-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.exp-acts .grow{flex:1}.exp-prev pre{white-space:pre-wrap;font-size:12.5px;margin:6px 0 0;padding:8px;border-radius:10px;background:var(--panel2,rgba(0,0,0,.05))}' +
    '@media(max-width:700px){.exp-meta{grid-template-columns:1fr 1fr}.exp-meta .exp-name{grid-column:1/-1}.exp-row{grid-template-columns:18px minmax(0,1fr) 78px 30px}.exp-row .exp-by{grid-column:2/4;max-width:none}.exp-acts .btn{flex:1}.exp-acts .grow{display:none}}';
  document.head.appendChild(css);
  try { if (typeof data !== 'undefined' && data) render(); } catch (e) {}
})();
