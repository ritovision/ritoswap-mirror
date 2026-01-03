// app/lib/notifications/channels/localNotification.ts
'use client';

import { publicConfig } from '@config/public.env';

export interface LocalNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: unknown;
}

const DEFAULT_ICON = '/images/SEO/favicon.png';
const DEFAULT_BADGE = '/images/SEO/favicon.png';
const AUTO_CLOSE_DURATION = 5000;

/**
 * Check if local notifications are enabled and supported
 */
export function isLocalNotificationSupported(): boolean {
  // Check env configuration
  if (!publicConfig.features.localNotifications) {
    return false;
  }

  // Check browser support
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  return true;
}

/**
 * Request permission for local notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isLocalNotificationSupported()) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

/**
 * Show a local/native notification
 */
export async function showLocalNotification(
  options: LocalNotificationOptions
): Promise<Notification | void> {
  // Skip if not supported or disabled
  if (!isLocalNotificationSupported()) {
    console.log('Local notifications are not supported or disabled');
    return;
  }

  const {
    title,
    body,
    icon = DEFAULT_ICON,
    badge = DEFAULT_BADGE,
    tag,
    requireInteraction = false,
    silent = false,
    data,
  } = options;

  // Check/request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.log('Notification permission not granted:', permission);
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon,
      badge,
      tag,
      requireInteraction,
      silent,
      data,
    });

    // Auto-close after specified duration
    if (!requireInteraction) {
      setTimeout(() => notification.close(), AUTO_CLOSE_DURATION);
    }

    // Add click handler to focus window
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/**
 * Check current permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isLocalNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Close all notifications with a specific tag
 */
export async function closeNotificationsByTag(tag: string): Promise<void> {
  if (!isLocalNotificationSupported() || !('getNotifications' in ServiceWorkerRegistration.prototype)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      const notifications = await registration.getNotifications({ tag });
      notifications.forEach(n => n.close());
    }
  } catch (error) {
    console.error('Failed to close notifications:', error);
  }
}