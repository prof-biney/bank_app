import { logger } from '@/utils/logger';
/**
 * Connection Service
 * 
 * This service monitors Appwrite realtime connection status and provides
 * user-friendly notifications instead of console errors.
 */

import { pushSystemNotification } from './notificationService';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  lastConnectedAt?: Date;
  reconnectAttempts: number;
  showAlert?: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

class ConnectionMonitor {
  private state: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0,
  };
  
  private reconnectTimer?: NodeJS.Timeout;
  private hasShownDisconnectedAlert = false;

  /**
   * Initialize the connection monitor with alert function
   */
  init(showAlert: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void) {
    this.state.showAlert = showAlert;
    logger.info('CONNECTION', '[ConnectionMonitor] Initialized with alert system');
  }

  /**
   * Handle connection established
   */
  onConnected() {
    const wasDisconnected = this.state.status === 'disconnected' || this.state.status === 'reconnecting';
    
    this.state = {
      ...this.state,
      status: 'connected',
      lastConnectedAt: new Date(),
      reconnectAttempts: 0,
    };

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Show success alert if we were previously disconnected
    if (wasDisconnected && this.hasShownDisconnectedAlert) {
      this.showConnectionAlert('success', 'Connection restored', 'Successfully reconnected to real-time services');
      this.hasShownDisconnectedAlert = false;
      
      // Push system notification
      pushSystemNotification(
        'Connection Restored',
        'Real-time services are now active. Your data will sync automatically.'
      );
    }

    logger.info('CONNECTION', '[ConnectionMonitor] Connected to real-time services');
  }

  /**
   * Handle connection lost
   */
  onDisconnected(reason?: string) {
    this.state = {
      ...this.state,
      status: 'disconnected',
    };

    // Only show alert once per disconnection cycle
    if (!this.hasShownDisconnectedAlert) {
      this.showConnectionAlert(
        'warning',
        'Connection lost',
        'Real-time features temporarily unavailable. Your data is safe and will sync when connection is restored.'
      );
      this.hasShownDisconnectedAlert = true;

      // Push system notification
      pushSystemNotification(
        'Connection Lost',
        'Real-time services temporarily unavailable. The app will continue to work in offline mode.'
      );
    }

    logger.warn('CONNECTION', '[ConnectionMonitor] Disconnected from real-time services:', reason);
  }

  /**
   * Handle reconnection attempt
   */
  onReconnecting(attempt: number, delaySeconds: number) {
    this.state = {
      ...this.state,
      status: 'reconnecting',
      reconnectAttempts: attempt,
    };

    logger.info('CONNECTION', `[ConnectionMonitor] Reconnecting... (attempt ${attempt}, delay ${delaySeconds}s)`);
  }

  /**
   * Handle connection error
   */
  onError(error: any) {
    logger.warn('CONNECTION', '[ConnectionMonitor] Connection error:', error);
    
    // Don't spam error alerts, just log
    if (this.state.reconnectAttempts === 0) {
      this.showConnectionAlert(
        'warning',
        'Connection issue',
        'Experiencing connectivity issues. Attempting to reconnect...'
      );
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.state.status;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state.status === 'connected';
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      status: this.state.status,
      lastConnectedAt: this.state.lastConnectedAt,
      reconnectAttempts: this.state.reconnectAttempts,
    };
  }

  /**
   * Show connection-related alert
   */
  private showConnectionAlert(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) {
    if (this.state.showAlert) {
      this.state.showAlert(type, message, title);
    } else {
      logger.info('CONNECTION', `[ConnectionMonitor] Alert: ${title} - ${message}`);
    }
  }

  /**
   * Override console methods to suppress specific Appwrite errors
   */
  suppressRealtimeErrors() {
    const originalError = console.error;
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Suppress specific Appwrite realtime error messages and handle them
      if (message.includes('Realtime got disconnected')) {
        // Extract reconnect info if available
        const matches = message.match(/Reconnect will be attempted in (\d+) seconds/);
        const delaySeconds = matches ? parseInt(matches[1], 10) : 1;
        this.onReconnecting(this.state.reconnectAttempts + 1, delaySeconds);
        logger.debug('CONNECTION', `[Realtime] Connection lost, attempting reconnect in ${delaySeconds} seconds`);
        return;
      }
      
      if (message.includes('Reconnect will be attempted') ||
          message.includes('WebSocket connection')) {
        logger.debug('CONNECTION', `[Realtime] ${args.join(' ')}`);
        return;
      }
      
      // Let other errors through
      originalError.apply(console, args);
    };

    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      // Detect connection events from logs
      if (message.includes('Realtime connection established')) {
        this.onConnected();
        logger.debug('CONNECTION', '[Realtime] Connected to real-time services');
        return;
      }
      
      if (message.includes('Realtime connection closed')) {
        this.onDisconnected('Connection closed');
        logger.debug('CONNECTION', '[Realtime] Connection closed');
        return;
      }
      
      // Suppress verbose realtime logs
      if (message.includes('[realtime]') ||
          message.includes('WebSocket')) {
        logger.debug('CONNECTION', `[Realtime] ${args.join(' ')}`);
        return;
      }
      
      // Let other logs through
      originalLog.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      
      // Handle WebSocket warnings
      if (message.includes('WebSocket') || message.includes('realtime')) {
        logger.debug('CONNECTION', `[Realtime] ${args.join(' ')}`);
        return;
      }
      
      // Let other warnings through
      originalWarn.apply(console, args);
    };

    logger.info('CONNECTION', '[ConnectionMonitor] Console error suppression enabled for realtime messages');
  }

  /**
   * Force reconnection attempt (if supported by client)
   */
  forceReconnect() {
    logger.info('CONNECTION', '[ConnectionMonitor] Forcing reconnection attempt...');
    this.state.reconnectAttempts = 0;
    this.onReconnecting(1, 0);
  }
}

// Singleton instance
export const connectionMonitor = new ConnectionMonitor();

/**
 * Enhanced client wrapper that integrates connection monitoring
 */
export function enhanceClientWithConnectionMonitoring(client: any) {
  // Suppress console errors for realtime
  connectionMonitor.suppressRealtimeErrors();

  const originalSubscribe = client.subscribe;
  
  client.subscribe = function(channels: string[], callback: (message: any) => void) {
    logger.info('CONNECTION', '[ConnectionMonitor] Setting up subscription with connection monitoring');
    
    const enhancedCallback = (message: any) => {
      // Handle connection events
      if (message.events) {
        const events = Array.isArray(message.events) ? message.events : [message.events];
        
        events.forEach(event => {
          if (event.includes('connection.open') || event.includes('websocket.connected')) {
            connectionMonitor.onConnected();
          } else if (event.includes('connection.close') || event.includes('websocket.disconnected')) {
            connectionMonitor.onDisconnected();
          } else if (event.includes('connection.error') || event.includes('websocket.error')) {
            connectionMonitor.onError(message.payload || event);
          }
        });
      }
      
      // Call original callback
      callback(message);
    };

    // Call original subscribe with enhanced callback
    const unsubscribe = originalSubscribe.call(this, channels, enhancedCallback);
    
    // Return enhanced unsubscribe that also cleans up monitoring
    return () => {
      try {
        unsubscribe();
        logger.info('CONNECTION', '[ConnectionMonitor] Unsubscribed from channels');
      } catch (error) {
        logger.warn('CONNECTION', '[ConnectionMonitor] Error during unsubscribe:', error);
      }
    };
  };

  return client;
}

/**
 * Initialize connection monitoring with alert system
 */
export function initConnectionMonitoring(
  showAlert: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void
) {
  connectionMonitor.init(showAlert);
  logger.info('CONNECTION', '[ConnectionMonitor] Monitoring initialized');
}

/**
 * Get connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  return connectionMonitor.getStatus();
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
  return connectionMonitor.isConnected();
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  return connectionMonitor.getStats();
}
