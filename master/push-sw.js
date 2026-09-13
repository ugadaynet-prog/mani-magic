// Service worker кабинета мастера — ТОЛЬКО уведомления, ничего не кэширует.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'MANI Magic';
  const body = data.body || 'Новый выбор клиента';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, { body, tag: 'pick', renotify: true });
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ type: 'pick', data }));
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('/master/');
  })());
});
