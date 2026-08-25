// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the viewer tab is closed/backgrounded.

importScripts('firebase-app-compat.js');
importScripts('firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAx1dWh8cc_1wohB-3Be94GgbyELiOxuY0",
    authDomain: "deer-dash.firebaseapp.com",
    projectId: "deer-dash",
    storageBucket: "deer-dash.firebasestorage.app",
    messagingSenderId: "834190963152",
    appId: "1:834190963152:web:9d0cfa99a65c81f25889d5"
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
        // Per-type tag: a shared tag would let a later motion push REPLACE a
        // threat notification the user hasn't acted on yet.
        tag: (payload.data && payload.data.type === 'threat_alert') ? 'threat-alert'
           : (payload.data && payload.data.type === 'temp_alert') ? 'temp-alert'
           : 'motion-alert',
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
