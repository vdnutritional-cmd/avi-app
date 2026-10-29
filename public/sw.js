// AVI — Service Worker

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Requerido por Chrome para reconocer el sitio como PWA instalable
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

// Notificaciones push: avisos al paciente (mensaje o cuestionario de su terapeuta) y crisis al terapeuta

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  if (data.tipo === 'paciente') {
    // Sin contenido; un solo aviso a la vez (el nuevo reemplaza al anterior) + número en el ícono de AVI
    const badge = typeof data.badge === 'number' && self.navigator && 'setAppBadge' in self.navigator
      ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge())
      : Promise.resolve()
    event.waitUntil(Promise.all([
      self.registration.showNotification(data.title ?? 'AVI', {
        body: data.body ?? 'Tienes algo nuevo en AVI.',
        icon: '/icons/icon-192-v2.png',
        badge: '/icons/icon-192-v2.png',
        tag: 'avi-paciente',
        renotify: true,
        data: { url: data.url ?? '/patient/chat' },
      }),
      Promise.resolve(badge).catch(() => {}),
    ]))
    return
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? '⚠️ Crisis AVI', {
      body: data.body ?? 'Un paciente puede estar en crisis.',
      icon: '/avi-icon.png',
      badge: '/avi-icon.png',
      tag: 'crisis-' + (data.patientId ?? 'unknown'),
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: data.url ?? '/therapist/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/therapist/dashboard'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) return client.focus()
        }
        return clients.openWindow(url)
      })
  )
})
