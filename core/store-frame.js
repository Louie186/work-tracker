/* core/store-frame.js — first script of every feature page.
   Inside Lew's Tracker, this page's feature data is read from / written to the
   tracker's data store (a folder you chose, or the browser's big storage) — see core/store.js.
   Opened on its own (offline copy, or the page alone) it does nothing. */
(function () {
  try { var host = window.parent !== window && window.parent.LTStore; if (host && host.patch) host.patch(window); } catch (e) { /* not inside the tracker */ }
})();
