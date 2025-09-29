/**
 * BiometricToastContext
 * 
 * Global context provider for managing biometric toast notifications
 * throughout the application with queue management and auto-dismissal.
 */

import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import { Platform } from 'react-native';
import BiometricToast, { ToastType, ToastPosition } from '@/components/common/BiometricToast';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  position?: ToastPosition;
  duration?: number;
  hapticFeedback?: boolean;
}

interface BiometricToastContextType {
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  showSuccess: (title: string, message?: string, options?: Partial<ToastData>) => void;
  showError: (title: string, message?: string, options?: Partial<ToastData>) => void;
  showWarning: (title: string, message?: string, options?: Partial<ToastData>) => void;
  showInfo: (title: string, message?: string, options?: Partial<ToastData>) => void;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const BiometricToastContext = createContext<BiometricToastContextType | undefined>(undefined);

interface BiometricToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}

export const BiometricToastProvider: React.FC<BiometricToastProviderProps> = ({
  children,
  maxToasts = 3,
  defaultPosition = Platform.OS === 'ios' ? 'top' : 'top',
  defaultDuration = 4000,
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdCounter = useRef(0);

  const generateId = useCallback(() => {
    toastIdCounter.current += 1;
    return `toast_${toastIdCounter.current}_${Date.now()}`;
  }, []);

  const showToast = useCallback((toastData: Omit<ToastData, 'id'>) => {
    const id = generateId();
    const newToast: ToastData = {
      id,
      position: defaultPosition,
      duration: defaultDuration,
      hapticFeedback: true,
      ...toastData,
    };

    setToasts(prevToasts => {
      const updatedToasts = [...prevToasts, newToast];
      
      // If we exceed max toasts, remove the oldest ones
      if (updatedToasts.length > maxToasts) {
        return updatedToasts.slice(updatedToasts.length - maxToasts);
      }
      
      return updatedToasts;
    });
  }, [defaultPosition, defaultDuration, maxToasts, generateId]);

  const showSuccess = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastData>
  ) => {
    showToast({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const showError = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastData>
  ) => {
    showToast({
      type: 'error',
      title,
      message,
      duration: 5000, // Longer duration for errors
      ...options,
    });
  }, [showToast]);

  const showWarning = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastData>
  ) => {
    showToast({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const showInfo = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastData>
  ) => {
    showToast({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: BiometricToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    dismissAll,
  };

  return (
    <BiometricToastContext.Provider value={contextValue}>
      {children}
      
      {/* Render all active toasts */}
      {toasts.map((toast, index) => (
        <BiometricToast
          key={toast.id}
          visible={true}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          position={toast.position}
          duration={toast.duration}
          hapticFeedback={toast.hapticFeedback}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </BiometricToastContext.Provider>
  );
};

export const useBiometricToast = (): BiometricToastContextType => {
  const context = useContext(BiometricToastContext);
  if (context === undefined) {
    throw new Error('useBiometricToast must be used within a BiometricToastProvider');
  }
  return context;
};

// Convenience hook for common biometric toast messages
export const useBiometricMessages = () => {
  const toast = useBiometricToast();

  return {
    // Authentication success messages
    authSuccess: (biometricType?: string) => {
      const type = biometricType === 'faceId' ? 'Face ID' : 
                   biometricType === 'touchId' ? 'Touch ID' : 
                   'Biometric';
      toast.showSuccess(
        'Authentication Successful',
        `${type} authentication completed successfully`
      );
    },

    // Authentication failure messages
    authFailed: (biometricType?: string, reason?: string) => {
      const type = biometricType === 'faceId' ? 'Face ID' : 
                   biometricType === 'touchId' ? 'Touch ID' : 
                   'Biometric';
      toast.showError(
        'Authentication Failed',
        reason || `${type} authentication was unsuccessful. Please try again.`
      );
    },

    // Setup success messages
    setupSuccess: (biometricType?: string) => {
      const type = biometricType === 'faceId' ? 'Face ID' : 
                   biometricType === 'touchId' ? 'Touch ID' : 
                   'Biometric';
      toast.showSuccess(
        'Setup Complete',
        `${type} authentication has been enabled for your account`
      );
    },

    // Setup failure messages
    setupFailed: (reason?: string) => {
      toast.showError(
        'Setup Failed',
        reason || 'Unable to enable biometric authentication. Please try again.'
      );
    },

    // Disabled messages
    authDisabled: () => {
      toast.showInfo(
        'Biometric Authentication Disabled',
        'You can re-enable it anytime in Settings'
      );
    },

    // Hardware not available messages
    hardwareNotAvailable: () => {
      toast.showWarning(
        'Biometric Hardware Not Available',
        'Your device does not support biometric authentication'
      );
    },

    // No biometrics enrolled messages
    noBiometricsEnrolled: () => {
      toast.showWarning(
        'No Biometrics Enrolled',
        'Please set up biometric authentication in your device settings first'
      );
    },

    // Security warnings
    securityWarning: (message: string) => {
      toast.showWarning(
        'Security Notice',
        message,
        { duration: 6000 }
      );
    },

    // Fallback to password messages
    fallbackToPassword: (reason?: string) => {
      toast.showInfo(
        'Using Password Authentication',
        reason || 'Biometric authentication is not available'
      );
    },

    // Token refresh messages
    tokenRefreshed: () => {
      toast.showSuccess(
        'Security Updated',
        'Your biometric authentication has been refreshed',
        { duration: 3000 }
      );
    },

    // Rate limit messages
    rateLimited: (retryAfter?: number) => {
      const message = retryAfter 
        ? `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
        : 'Too many authentication attempts. Please try again later.';
      
      toast.showError(
        'Rate Limited',
        message,
        { duration: 6000 }
      );
    },

    // Generic error with retry
    genericError: (action: string) => {
      toast.showError(
        'Something went wrong',
        `Unable to ${action}. Please check your connection and try again.`
      );
    },
  };
};

export default BiometricToastProvider;