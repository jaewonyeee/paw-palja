import { Capacitor } from '@capacitor/core'
import { api } from '../api'

const isNative = Capacitor.isNativePlatform()

// ---------------------------------------------------------------------------
// Web Push helpers (kept for browser / PWA usage)
// ---------------------------------------------------------------------------

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

function isWebPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// ---------------------------------------------------------------------------
// Public API — auto-detects native vs web
// ---------------------------------------------------------------------------

/**
 * Check if push notifications are supported on this platform.
 */
export function isPushSupported() {
  if (isNative) return true
  return isWebPushSupported()
}

/**
 * Request notification permission from the user.
 * Returns the permission state: 'granted', 'denied', or 'default'.
 */
export async function requestPermission() {
  if (isNative) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.requestPermissions()
    // Capacitor returns { receive: 'granted' | 'denied' | 'prompt' ... }
    return result.receive === 'granted' ? 'granted' : 'denied'
  }

  if (!isWebPushSupported()) return 'denied'
  return Notification.requestPermission()
}

/**
 * Get the current notification permission state.
 */
export async function getPermissionState() {
  if (isNative) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.checkPermissions()
    return result.receive === 'granted' ? 'granted' : 'denied'
  }

  if (!isWebPushSupported()) return 'denied'
  return Notification.permission
}

/**
 * Subscribe the user to push notifications.
 * For native: registers with APNs/FCM via Capacitor and sends the device token
 *   to the backend.
 * For web: uses the Web Push API + service worker as before.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Push not supported')

  if (isNative) {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') {
      throw new Error('Notification permission denied')
    }

    // Register returns a token via the 'registration' event
    return new Promise((resolve, reject) => {
      PushNotifications.addListener('registration', async (token) => {
        try {
          await api.pushSubscribe({
            endpoint: `native://${Capacitor.getPlatform()}`,
            p256dh: token.value,
            auth_key: Capacitor.getPlatform(),
          })
          resolve(token)
        } catch (err) {
          reject(err)
        }
      })

      PushNotifications.addListener('registrationError', (err) => {
        reject(new Error(err.error || 'Native push registration failed'))
      })

      PushNotifications.register()
    })
  }

  // --- Web Push path ---
  const permission = await requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const registration = await navigator.serviceWorker.ready
  const { vapid_public_key } = await api.getVapidPublicKey()
  const applicationServerKey = urlBase64ToUint8Array(vapid_public_key)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })

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
  if (isNative) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.removeAllListeners()
    await api.pushUnsubscribe()
    return
  }

  if (!isWebPushSupported()) return

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
  if (isNative) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const perms = await PushNotifications.checkPermissions()
    return perms.receive === 'granted'
  }

  if (!isWebPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription !== null
}
