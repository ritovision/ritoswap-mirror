// app/lib/notifications/index.ts
'use client';

import { showToast, dismissToast } from './channels/toast';
import { showLocalNotification } from './channels/localNotification';
import { NOTIFICATION_EVENTS } from './events';

export type NotificationSource = 'user' | 'watcher' | 'system';

export type NotificationChannel = 'toast' | 'local' | 'both';

export interface NotificationOptions {
  title: string;
  body?: string;
  type?: 'success' | 'error' | 'info' | 'loading';
  source?: NotificationSource;
  channels?: NotificationChannel;
  duration?: number;
  tag?: string;
}

export interface NotificationMetadata {
  source: NotificationSource;
  timestamp: number;
  event?: string;
}

class NotificationManager {
  private defaultChannels: NotificationChannel = 'both';
  private notificationHistory: Array<NotificationOptions & NotificationMetadata> = [];

  /**
   * Send a predefined notification event
   */
  async sendEvent(
    eventName: keyof typeof NOTIFICATION_EVENTS,
    options?: Partial<NotificationOptions>
  ): Promise<void> {
    const event = NOTIFICATION_EVENTS[eventName];
    if (!event) {
      console.error(`Unknown notification event: ${eventName}`);
      return;
    }

    const mergedOptions: NotificationOptions = {
      ...event,
      ...options,
      source: options?.source || event.source || 'system',
      channels: options?.channels || event.channels || this.defaultChannels,
    };

    await this.send(mergedOptions);
    this.logNotification(mergedOptions, eventName);
  }

  /**
   * Send an ad-hoc notification
   */
  async send(options: NotificationOptions): Promise<void> {
    const {
      title,
      body,
      type = 'info',
      channels = this.defaultChannels,
      duration,
      tag,
    } = options;

    const shouldShowToast = channels === 'toast' || channels === 'both';
    const shouldShowLocal = channels === 'local' || channels === 'both';

    if (shouldShowToast) {
      showToast({
        message: title,
        type,
        duration,
      });
    }

    if (shouldShowLocal && type !== 'loading') {
      await showLocalNotification({
        title,
        body,
        tag,
      });
    }

    this.logNotification(options);
  }

  /**
   * Send a success notification
   */
  async success(title: string, body?: string, options?: Partial<NotificationOptions>): Promise<void> {
    await this.send({
      title,
      body,
      type: 'success',
      ...options,
    });
  }

  /**
   * Send an error notification
   */
  async error(title: string, body?: string, options?: Partial<NotificationOptions>): Promise<void> {
    await this.send({
      title,
      body,
      type: 'error',
      ...options,
    });
  }

  /**
   * Send an info notification
   */
  async info(title: string, body?: string, options?: Partial<NotificationOptions>): Promise<void> {
    await this.send({
      title,
      body,
      type: 'info',
      ...options,
    });
  }

  /**
   * Send a loading notification (toast only)
   */
  loading(title: string, options?: Partial<NotificationOptions>): string {
    const toastId = showToast({
      message: title,
      type: 'loading',
      duration: options?.duration,
    });

    this.logNotification({
      title,
      type: 'loading',
      channels: 'toast',
      ...options,
    });

    return toastId;
  }

  /**
   * Dismiss a loading notification
   */
  dismiss(toastId?: string): void {
    if (toastId) {
      dismissToast(toastId);
    }
  }

  /**
   * Set default channels for all notifications
   */
  setDefaultChannels(channels: NotificationChannel): void {
    this.defaultChannels = channels;
  }

  /**
   * Get notification history
   */
  getHistory(): Array<NotificationOptions & NotificationMetadata> {
    return [...this.notificationHistory];
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    this.notificationHistory = [];
  }

  private logNotification(options: NotificationOptions, eventName?: string): void {
    this.notificationHistory.push({
      ...options,
      source: options.source || 'system',
      timestamp: Date.now(),
      event: eventName,
    });

    // Keep only last 100 notifications
    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(-100);
    }
  }
}

// Export singleton instance
export const notifications = new NotificationManager();

// Export convenience functions
export const sendNotification = notifications.send.bind(notifications);
export const sendNotificationEvent = notifications.sendEvent.bind(notifications);
export const sendSuccessNotification = notifications.success.bind(notifications);
export const sendErrorNotification = notifications.error.bind(notifications);
export const sendInfoNotification = notifications.info.bind(notifications);
export const sendLoadingNotification = notifications.loading.bind(notifications);
export const dismissLoadingNotification = notifications.dismiss.bind(notifications);

// Re-export types
export type { NotificationEvent } from './events';