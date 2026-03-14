// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the viewer tab is closed/backgrounded.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBn6SRgwVvcNkP9sUoHep_iShLFC-pJSIk",
    authDomain: "deer-dash.firebaseapp.com",
    projectId: "deer-dash",
    storageBucket: "deer-dash.firebasestorage.app",
    messagingSenderId: "834190963152",
    appId: "1:834190963152:web:viewer"
});

const messaging = firebase.messaging();

// Handle background messages (when tab is closed or hidden)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const title = payload.notification?.title || 'Dashcam Police Alert';
    const body = payload.notification?.body || 'Motion detected near your vehicle.';

    const options = {
        body: body,
        icon: '../assets/icon-512.png',
        badge: '../assets/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'motion-alert',
        renotify: true,
        requireInteraction: true,
        data: payload.data || {},
        actions: [
            { action: 'view', title: 'View Live' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    // Build the viewer URL from the notification data
    const data = event.notification.data || {};
    let url = '/viewer/';
    if (data.deviceId) {
        url = `/viewer/?d=${data.deviceId}`;
    } else if (data.sessionId) {
        url = `/viewer/?s=${data.sessionId}`;
    }

    // Focus existing tab or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes('/viewer/') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
