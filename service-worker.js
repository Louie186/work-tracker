/* service-worker.js — lets the tracker open without internet.
   Network first: you always get the newest files when online (no stale
   versions after an update); the saved copy is only used when offline. */
const CACHE = 'lews-tracker-v10.28';
const CORE = [
  './', 'index.html', 'manifest.json',
  'core/app.css', 'core/theme.css', 'core/lt.css',
  'core/theme.js', 'core/boot.js', 'core/lt.js', 'core/projects.js', 'core/app.js', 'core/clock.js', 'core/extras.js', 'core/offline.js', 'core/links.js', 'core/todo-link.js', 'core/sync.js',
  'skills/delegate/delegate.html', 'skills/delegate/planner-excel.js', 'skills/delegate/taskpack.js', 'skills/delegate/xlsm-template.js', 'skills/delegate/templates/checklist-template.xlsm', 'skills/level-filter/level-filter.js', 'skills/weekly-report/weekly-report.js', 'skills/game/tower-stack.js', 'skills/qaqc/qaqc.html', 'skills/midp/midp.html', 'skills/midp/midp-plus.js', 'skills/midp/midp-issues.js', 'skills/midp/midp-folder.js',
  'skills/pulse/pulse.js', 'skills/alerts/alerts.js', 'skills/sounds/sounds.js',
  'skills/pet/pet.css', 'skills/pet/pet.js', 'skills/pet/pet-live2d.js',
  'icons/icon-192.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
