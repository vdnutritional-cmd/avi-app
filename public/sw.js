// AVI — Service Worker para notificaciones push de crisis

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
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
