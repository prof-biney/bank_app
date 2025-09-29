/**
 * Enhanced Biometric Authentication Hook
 * 
 * This hook provides a comprehensive interface for biometric authentication
 * with enhanced state management and UI integration for the enhanced components.
 */

import { useState, useCallback, useRef } from 'react';
import { checkBiometricAvailability, BiometricAvailability } from '@/lib/biometric/biometric.service';
import { useBiometricMessages } from '@/context/BiometricToastContext';
import { logger } from '@/lib/logger';
import useAuthStore from '@/store/auth.store';

export type BiometricStage = 
  | 'idle' 
  | 'checking' 
  | 'authenticating' 
  | 'processing' 
  | 'success' 
  | 'error';

export type ButtonState = 
  | 'idle' 
  | 'loading' 
  | 'authenticating' 
  | 'success' 
  | 'error';

export interface BiometricAuthState {
  stage: BiometricStage;
  buttonState: ButtonState;
  isLoading: boolean;
  hasError: boolean;
  availability: BiometricAvailability | null;
  progress: number;
  message?: string;
}

export interface UseBiometricAuthResult {
  state: BiometricAuthState;
  authenticate: () => Promise<void>;
  setup: () => Promise<boolean>;
  disable: () => Promise<boolean>;
  checkAvailability: () => Promise<void>;
  reset: () => void;
}

export const useBiometricAuth = (): UseBiometricAuthResult => {
  const biometricMessages = useBiometricMessages();
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const {
    biometricEnabled,
    biometricType,
    authenticateWithBiometric,
    setupBiometric,
    disableBiometric,
    loadBiometricState,
  } = useAuthStore();

  const [state, setState] = useState<BiometricAuthState>({
    stage: 'idle',
    buttonState: 'idle',
    isLoading: false,
    hasError: false,
    availability: null,
    progress: 0,
  });

  // Clear timeout on unmount
  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  // Reset state to idle
  const reset = useCallback(() => {
    clearTimeout();
    setState({
      stage: 'idle',
      buttonState: 'idle',
      isLoading: false,
      hasError: false,
      availability: null,
      progress: 0,
    });
  }, [clearTimeout]);

  // Set stage with automatic timeout
  const setStage = useCallback((
    stage: BiometricStage,
    options?: {
      buttonState?: ButtonState;
      message?: string;
      progress?: number;
      timeout?: number;
      nextStage?: BiometricStage;
    }
  ) => {
    clearTimeout();
    
    setState(prev => ({
      ...prev,
      stage,
      buttonState: options?.buttonState || (stage === 'error' ? 'error' : stage === 'success' ? 'success' : 'idle'),
      isLoading: ['checking', 'authenticating', 'processing'].includes(stage),
      hasError: stage === 'error',
      message: options?.message,
      progress: options?.progress || 0,
    }));

    // Auto transition to next stage after timeout
    if (options?.timeout && options?.nextStage) {
      timeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          stage: options.nextStage!,
          buttonState: 'idle',
          isLoading: false,
          hasError: false,
          message: undefined,
          progress: 0,
        }));
      }, options.timeout);
    }
  }, [clearTimeout]);

  // Check biometric availability
  const checkAvailability = useCallback(async () => {
    try {
      setStage('checking', { message: 'Checking biometric availability...' });

      await loadBiometricState();
      const availability = await checkBiometricAvailability();

      setState(prev => ({ ...prev, availability }));

      if (!availability.isAvailable) {
        if (availability.reason === 'hardware_not_available') {
          biometricMessages.hardwareNotAvailable();
        } else if (availability.reason === 'no_biometrics_enrolled') {
          biometricMessages.noBiometricsEnrolled();
        }
        
        setStage('error', { 
          message: availability.error,
          timeout: 2000,
          nextStage: 'idle'
        });
      } else {
        setStage('idle');
      }
    } catch (error) {
      logger.error('BIOMETRIC', 'Error checking availability:', error);
      biometricMessages.genericError('check biometric availability');
      setStage('error', { 
        message: 'Failed to check biometric availability',
        timeout: 2000,
        nextStage: 'idle'
      });
    }
  }, [loadBiometricState, biometricMessages, setStage]);

  // Authenticate with biometrics
  const authenticate = useCallback(async () => {
    try {
      setStage('authenticating', { 
        message: `Authenticate with ${biometricType === 'faceId' ? 'Face ID' : biometricType === 'touchId' ? 'Touch ID' : 'fingerprint'}`,
        buttonState: 'authenticating'
      });

      const result = await authenticateWithBiometric();

      if (result.success) {
        setStage('success', { 
          buttonState: 'success',
          message: 'Authentication successful!',
          timeout: 1500,
          nextStage: 'idle'
        });
        
        biometricMessages.authSuccess(biometricType);
        return;
      } else {
        setStage('error', { 
          buttonState: 'error',
          message: 'Authentication failed',
          timeout: 2000,
          nextStage: 'idle'
        });

        if (result.requiresPasswordLogin) {
          biometricMessages.fallbackToPassword(result.error);
        } else {
          biometricMessages.authFailed(biometricType, result.error);
        }
      }
    } catch (error) {
      logger.error('BIOMETRIC', 'Authentication error:', error);
      
      setStage('error', { 
        buttonState: 'error',
        message: 'Authentication error',
        timeout: 2000,
        nextStage: 'idle'
      });
      
      biometricMessages.genericError('authenticate with biometrics');
    }
  }, [authenticateWithBiometric, biometricType, biometricMessages, setStage]);

  // Setup biometric authentication
  const setup = useCallback(async (): Promise<boolean> => {
    try {
      setStage('processing', { 
        message: 'Setting up biometric authentication...',
        buttonState: 'loading'
      });

      const result = await setupBiometric();

      if (result.success) {
        setStage('success', { 
          buttonState: 'success',
          message: 'Setup complete!',
          timeout: 1500,
          nextStage: 'idle'
        });
        
        biometricMessages.setupSuccess(result.biometricType);
        return true;
      } else {
        setStage('error', { 
          buttonState: 'error',
          message: 'Setup failed',
          timeout: 2000,
          nextStage: 'idle'
        });
        
        biometricMessages.setupFailed(result.error);
        return false;
      }
    } catch (error) {
      logger.error('BIOMETRIC', 'Setup error:', error);
      
      setStage('error', { 
        buttonState: 'error',
        message: 'Setup error',
        timeout: 2000,
        nextStage: 'idle'
      });
      
      biometricMessages.setupFailed('An unexpected error occurred during setup');
      return false;
    }
  }, [setupBiometric, biometricMessages, setStage]);

  // Disable biometric authentication
  const disable = useCallback(async (): Promise<boolean> => {
    try {
      setStage('processing', { 
        message: 'Disabling biometric authentication...',
        buttonState: 'loading'
      });

      await disableBiometric();

      setStage('success', { 
        buttonState: 'success',
        message: 'Biometric authentication disabled',
        timeout: 1500,
        nextStage: 'idle'
      });
      
      biometricMessages.authDisabled();
      return true;
    } catch (error) {
      logger.error('BIOMETRIC', 'Disable error:', error);
      
      setStage('error', { 
        buttonState: 'error',
        message: 'Failed to disable',
        timeout: 2000,
        nextStage: 'idle'
      });
      
      biometricMessages.genericError('disable biometric authentication');
      return false;
    }
  }, [disableBiometric, biometricMessages, setStage]);

  return {
    state,
    authenticate,
    setup,
    disable,
    checkAvailability,
    reset,
  };
};