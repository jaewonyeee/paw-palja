import { api } from '../api'

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Request notification permission from the user.
 * Returns the permission state: 'granted', 'denied', or 'default'.
 */
export async function requestPermission() {
  if (!isPushSupported()) return 'denied'
  return Notification.requestPermission()
}

/**
 * Get the current notification permission state.
 */
export function getPermissionState() {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

/**
 * Subscribe the user to push notifications.
 * Registers with the service worker and sends the subscription to the backend.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Push not supported')

  const permission = await requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const registration = await navigator.serviceWorker.ready

  // Fetch the VAPID public key from backend
  const { vapid_public_key } = await api.getVapidPublicKey()

  // Convert VAPID key from base64url to Uint8Array
  const applicationServerKey = urlBase64ToUint8Array(vapid_public_key)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })

  // Send subscription to backend
  const subJson = subscription.toJSON()
  await api.pushSubscribe({
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth_key: subJson.keys.auth,
  })

  return subscription
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    await subscription.unsubscribe()
    await api.pushUnsubscribe()
  }
}

/**
 * Check if currently subscribed to push notifications.
 */
export async function isSubscribed() {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription !== null
}

/**
 * Convert a base64url-encoded string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
