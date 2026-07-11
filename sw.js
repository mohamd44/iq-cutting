/* IQ Panel Service Worker — يخزّن التطبيق ليعمل دون إنترنت */
const CACHE = 'iqpanel-v3';
const ASSETS = [
  './index.html', './styles.css', './app.js',
  './firebase-config.js', './auth.js', './firestore-db.js',
  './access-control.js', './admin.js',
  './logo.jpeg', './icon-192.png', './icon-512.png',
  './manifest.json', './jspdf.umd.min.js', './html2canvas.min.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      for (const url of ASSETS) {
        try { await c.add(url); } catch(_) { /* تجاهل الملفات غير المتوفرة */ }
      }
    })
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // لا نخزن طلبات Firebase Auth/Firestore
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com/firebase')) return;
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      // لا نخزن استجابات غير ناجحة
      if (!res || res.status !== 200) return res;
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
