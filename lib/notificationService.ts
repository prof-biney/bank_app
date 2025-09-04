import type { Notification } from "@/types";

/**
 * Notification Service
 * 
 * This service handles pushing alerts to both the alert system (for immediate display)
 * and the notification system (for persistence in the notification drawer).
 */

interface NotificationPayload {
  type: 'success' | 'error' | 'warning' | 'info' | 'payment' | 'transaction' | 'statement' | 'system';
  title: string;
  message: string;
  userId?: string;
}

/**
 * Pushes a notification to the backend notification system
 */
async function pushToNotificationSystem(payload: NotificationPayload): Promise<void> {
  try {
    const { getApiBase } = require('./api');
    const { getValidJWT, refreshAppwriteJWT } = require('./jwt');
    
    const apiBase = getApiBase();
    if (!apiBase || apiBase.includes('undefined') || apiBase === 'undefined') {
      console.log('[pushToNotificationSystem] API base URL not configured, skipping server notification');
      return;
    }
    
    const url = `${apiBase}/v1/notifications`;
    
    let jwt = await getValidJWT();
    if (!jwt) {
      console.log('[pushToNotificationSystem] No JWT available, skipping server notification');
      return;
    }
    
    const requestBody = {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      unread: true
    };
    
    const makeRequest = async (token: string | undefined) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
    };
    
    let response = await makeRequest(jwt);
    
    // Handle token refresh if needed
    if (response.status === 401 && jwt) {
      console.log('[pushToNotificationSystem] Got 401, refreshing JWT and retrying...');
      jwt = await refreshAppwriteJWT();
      if (jwt) {
        response = await makeRequest(jwt);
      }
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('[pushToNotificationSystem] Notification endpoint not found (404), server may not support notifications yet');
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[pushToNotificationSystem] Failed to push notification:', response.status, errorText);
      }
    } else {
      console.log('[pushToNotificationSystem] Notification pushed successfully');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('[pushToNotificationSystem] Network error, server may be unavailable');
    } else {
      console.error('[pushToNotificationSystem] Error pushing notification:', error);
    }
    // Don't throw - we don't want notification failures to break the main flow
  }
}

/**
 * Pushes a notification to the local AppContext notification system
 */
function pushToLocalNotificationSystem(payload: NotificationPayload): void {
  try {
    // Get the AppContext to add the notification locally
    const notification: Notification = {
      id: Date.now().toString(),
      userId: payload.userId || '',
      title: payload.title,
      message: payload.message,
      type: payload.type,
      unread: true,
      createdAt: new Date().toISOString(),
    };

    // We'll need to access the AppContext's setNotifications function
    // This will be handled by passing the context functions to this service
    if ((global as any).__APP_CONTEXT__ && (global as any).__APP_CONTEXT__.setNotifications) {
      console.log('[pushToLocalNotificationSystem] Pushing notification:', payload.title);
      const { setNotifications } = (global as any).__APP_CONTEXT__;
      setNotifications((prev: Notification[]) => [notification, ...prev]);
    } else {
      console.warn('[pushToLocalNotificationSystem] AppContext not available, notification not persisted to drawer');
    }
  } catch (error) {
    console.error('[pushToLocalNotificationSystem] Error pushing local notification:', error);
  }
}

/**
 * Enhanced alert function that shows an alert and pushes it to notifications
 */
export function showAlertWithNotification(
  showAlert: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void,
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  title?: string
) {
  // Show the immediate alert
  showAlert(type, message, title);
  
  // Map alert types to notification types
  const notificationType = type === 'success' ? 'system' :
                           type === 'error' ? 'system' :
                           type === 'warning' ? 'system' :
                           'system';
  
  // Push to notification system (fire and forget)
  const payload: NotificationPayload = {
    type: notificationType,
    title: title || 'Alert',
    message,
  };
  
  // Try server-based notifications first, then local fallback (fire and forget)
  pushToNotificationSystem(payload).catch((error) => {
    console.log('[showAlertWithNotification] Server notification failed, using local only:', error?.message || error);
  });
  
  // Always push to local notifications
  pushToLocalNotificationSystem(payload);
}

/**
 * Pushes a transaction-related notification
 */
export function pushTransactionNotification(
  type: 'success' | 'failed',
  title: string,
  message: string,
  amount?: number
) {
  const payload: NotificationPayload = {
    type: 'transaction',
    title,
    message: amount ? `${message} - Amount: GHS ${Math.abs(amount).toFixed(2)}` : message,
  };
  
  // pushToNotificationSystem(payload); // Disabled - server not available
  pushToLocalNotificationSystem(payload);
}

/**
 * Pushes a payment-related notification
 */
export function pushPaymentNotification(
  type: 'success' | 'failed',
  title: string,
  message: string,
  amount?: number
) {
  const payload: NotificationPayload = {
    type: 'payment',
    title,
    message: amount ? `${message} - Amount: GHS ${Math.abs(amount).toFixed(2)}` : message,
  };
  
  // pushToNotificationSystem(payload); // Disabled - server not available
  pushToLocalNotificationSystem(payload);
}

/**
 * Pushes a transfer-related notification
 */
export function pushTransferNotification(
  type: 'sent' | 'received',
  amount: number,
  counterpartyName: string,
  newBalance?: number
) {
  const title = type === 'sent' ? 'Money Sent' : 'Money Received';
  let message = `${type === 'sent' ? 'You sent' : 'You received'} GHS ${amount.toFixed(2)}`;
  message += ` ${type === 'sent' ? 'to' : 'from'} ${counterpartyName}.`;
  if (typeof newBalance === 'number') {
    message += ` Your new balance is GHS ${newBalance.toFixed(2)}.`;
  }
  
  const payload: NotificationPayload = {
    type: 'transaction',
    title,
    message,
  };
  
  // Try server-based notifications first, then local fallback
  pushToNotificationSystem(payload).catch((error) => {
    console.log('[pushTransferNotification] Server notification failed, using local only:', error?.message || error);
  });
  
  // Always push to local notifications
  pushToLocalNotificationSystem(payload);
}

/**
 * Pushes a system notification
 */
export function pushSystemNotification(
  title: string,
  message: string
) {
  const payload: NotificationPayload = {
    type: 'system',
    title,
    message,
  };
  
  // pushToNotificationSystem(payload); // Disabled - server not available
  pushToLocalNotificationSystem(payload);
}

/**
 * Initialize the notification service with AppContext functions
 */
export function initNotificationService(appContextFunctions: any) {
  (global as any).__APP_CONTEXT__ = appContextFunctions;
}
