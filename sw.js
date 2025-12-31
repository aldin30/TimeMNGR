// Service Worker deactivated to prevent cross-origin registration errors in sandbox environments.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
