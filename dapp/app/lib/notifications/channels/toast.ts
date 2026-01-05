// app/lib/notifications/channels/toast.ts
'use client';

import toast from 'react-hot-toast';

export interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  duration?: number;
}

const DEFAULT_DURATION = 5000;
const DEFAULT_POSITION = 'bottom-right' as const;

/**
 * Announce message to screen readers via ARIA live region
 */
function announceToScreenReader(message: string, type: ToastOptions['type']) {
  if (typeof document === 'undefined') return;
  
  // Determine priority based on notification type
  const priority = type === 'error' ? 'assertive' : 'polite';
  
  // Create or get live region container
  let container = document.getElementById('notification-announcer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-announcer';
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
  }
  
  // Create announcement element
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('role', type === 'error' ? 'alert' : 'status');
  
  // Add prefix for context
  const prefix = type === 'error' ? 'Error: ' : 
                 type === 'success' ? 'Success: ' : 
                 type === 'loading' ? 'Loading: ' : '';
  
  announcement.textContent = prefix + message;
  
  // Clear previous announcements and add new one
  container.innerHTML = '';
  container.appendChild(announcement);
  
  // Remove after a delay to prevent accumulation
  setTimeout(() => {
    if (announcement.parentNode) {
      announcement.remove();
    }
  }, 1000);
}

const getToastStyles = (type: ToastOptions['type']) => {
  switch (type) {
    case 'success':
      return {
        background: 'var(--primary-color)',
        color: 'white',
        border: '2px solid var(--utility-green)',
      };
    case 'error':
      return {
        background: 'black',
        color: 'white',
        border: '2px solid var(--accent-color)',
      };
    case 'loading':
      return {
        background: 'var(--primary-color)',
        color: 'white',
        border: 'var(--default-border)',
      };
    case 'info':
    default:
      return {
        background: 'var(--primary-color)',
        color: 'white',
        border: 'var(--default-border)',
      };
  }
};

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): string {
  const { message, type, duration = DEFAULT_DURATION } = options;
  const styles = getToastStyles(type);
  
  // Announce to screen readers
  announceToScreenReader(message, type);

  switch (type) {
    case 'success':
      return toast.success(message, {
        duration,
        position: DEFAULT_POSITION,
        style: styles,
      });
    case 'error':
      return toast.error(message, {
        duration,
        position: DEFAULT_POSITION,
        style: styles,
      });
    case 'loading':
      return toast.loading(message, {
        position: DEFAULT_POSITION,
        style: styles,
      });
    case 'info':
    default:
      return toast(message, {
        duration,
        position: DEFAULT_POSITION,
        style: styles,
      });
  }
}

/**
 * Dismiss a toast notification
 */
export function dismissToast(toastId?: string): void {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
}

/**
 * Remove all toasts
 */
export function removeAllToasts(): void {
  toast.remove();
}