/**
 * Biometric Authentication Service
 * 
 * This module provides comprehensive biometric authentication functionality
 * including availability checks, authentication, token management, and secure storage.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';
import {
  createBiometricToken as createServerBiometricToken,
  validateBiometricToken as validateServerBiometricToken,
  refreshBiometricToken as refreshServerBiometricToken,
  revokeBiometricTokens as revokeServerBiometricTokens,
  logBiometricAudit,
} from '@/lib/appwrite/auth';
import {
  assessThreat,
  checkRateLimit,
  recordAttempt,
  detectDeviceChanges,
  generateDeviceFingerprint,
  logSecurityEvent,
  clearSecurityData,
} from './security.service';

// Constants for secure storage keys
const BIOMETRIC_TOKEN_KEY = 'biometric_token';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_TYPE_KEY = 'biometric_type';
const LAST_PASSWORD_LOGIN_KEY = 'last_password_login';
const BIOMETRIC_ATTEMPTS_KEY = 'biometric_attempts';
const DEVICE_ID_KEY = 'device_id';

// Token expiration time (7 days in milliseconds)
const TOKEN_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000;

// Max failed attempts before requiring password
const MAX_BIOMETRIC_ATTEMPTS = 3;

// Password requirement interval (30 days in milliseconds)
const PASSWORD_REQUIREMENT_INTERVAL = 30 * 24 * 60 * 60 * 1000;

export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | null;

export interface BiometricAvailability {
  isAvailable: boolean;
  biometricType: BiometricType;
  error?: string;
  reason?: 'hardware_not_available' | 'no_biometrics_enrolled' | 'not_supported' | 'unknown';
  enrolledBiometrics: boolean;
}

export interface BiometricToken {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
  deviceId: string;
}

export interface BiometricAuthResult {
  success: boolean;
  token?: BiometricToken;
  biometricType?: BiometricType;
  error?: string;
  requiresPasswordLogin?: boolean;
}

/**
 * Generates a unique device identifier
 */
async function generateDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Maps Expo LocalAuthentication types to our BiometricType
 */
function mapBiometricType(authTypes: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (Platform.OS === 'ios') {
    if (authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'faceId';
    }
    if (authTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'touchId';
    }
  } else {
    // Android
    if (authTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ||
        authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'fingerprint';
    }
  }
  return null;
}

/**
 * Gets the appropriate prompt message based on biometric type
 */
function getBiometricPrompt(biometricType: BiometricType): string {
  switch (biometricType) {
    case 'faceId':
      return 'Authenticate with Face ID';
    case 'touchId':
      return 'Authenticate with Touch ID';
    case 'fingerprint':
      return 'Authenticate with fingerprint';
    default:
      return 'Authenticate with biometrics';
  }
}

/**
 * Gets the appropriate setup subtitle based on biometric type
 */
function getSetupSubtitle(biometricType: BiometricType): string {
  switch (biometricType) {
    case 'faceId':
      return 'Make sure you\'re in good lighting and look directly at the camera';
    case 'touchId':
      return 'Place your finger on the Touch ID sensor when prompted';
    case 'fingerprint':
      return 'Place your finger on the fingerprint sensor when prompted';
    default:
      return 'Follow the on-screen instructions';
  }
}

/**
 * Checks if biometric authentication is available on the device
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        isAvailable: false,
        biometricType: null,
        error: 'Biometric hardware not available',
        reason: 'hardware_not_available',
        enrolledBiometrics: false,
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return {
        isAvailable: false,
        biometricType: null,
        error: 'No biometrics enrolled on device',
        reason: 'no_biometrics_enrolled',
        enrolledBiometrics: false,
      };
    }

    const authTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const biometricType = mapBiometricType(authTypes);

    if (!biometricType) {
      return {
        isAvailable: false,
        biometricType: null,
        error: 'Supported biometric type not recognized',
        reason: 'not_supported',
        enrolledBiometrics: true,
      };
    }

    return {
      isAvailable: true,
      biometricType,
      enrolledBiometrics: true,
    };
  } catch (error) {
    logger.error('BIOMETRIC', 'Error checking biometric availability:', error);
    return {
      isAvailable: false,
      biometricType: null,
      error: 'Error checking biometric availability',
      reason: 'unknown',
      enrolledBiometrics: false,
    };
  }
}

/**
 * Generates a secure biometric token
 */
async function generateBiometricToken(userId: string): Promise<BiometricToken> {
  const deviceId = await generateDeviceId();
  const now = Date.now();
  
  const token: BiometricToken = {
    token: `bio_${userId}_${now}_${Math.random().toString(36).substr(2, 16)}`,
    userId,
    expiresAt: now + TOKEN_EXPIRATION_TIME,
    createdAt: now,
    deviceId,
  };

  return token;
}

/**
 * Stores biometric token securely
 */
async function storeBiometricToken(token: BiometricToken): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, JSON.stringify(token));
}

/**
 * Retrieves stored biometric token
 */
async function getBiometricToken(): Promise<BiometricToken | null> {
  try {
    const tokenData = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
    if (!tokenData) return null;

    const token: BiometricToken = JSON.parse(tokenData);
    
    // Check if token is expired
    if (Date.now() > token.expiresAt) {
      await clearBiometricToken();
      return null;
    }

    // Check if device ID matches (security against token transfer)
    const currentDeviceId = await generateDeviceId();
    if (token.deviceId !== currentDeviceId) {
      await clearBiometricToken();
      return null;
    }

    return token;
  } catch (error) {
    logger.error('BIOMETRIC', 'Error retrieving biometric token:', error);
    return null;
  }
}

/**
 * Clears stored biometric token
 */
async function clearBiometricToken(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
}

/**
 * Gets current biometric attempt count
 */
async function getBiometricAttempts(): Promise<number> {
  try {
    const attempts = await SecureStore.getItemAsync(BIOMETRIC_ATTEMPTS_KEY);
    return attempts ? parseInt(attempts, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increments biometric attempt count
 */
async function incrementBiometricAttempts(): Promise<number> {
  const attempts = await getBiometricAttempts();
  const newAttempts = attempts + 1;
  await SecureStore.setItemAsync(BIOMETRIC_ATTEMPTS_KEY, newAttempts.toString());
  return newAttempts;
}

/**
 * Resets biometric attempt count
 */
async function resetBiometricAttempts(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ATTEMPTS_KEY);
}

/**
 * Checks if password login is required based on time elapsed
 */
export async function isPasswordLoginRequired(): Promise<boolean> {
  try {
    const lastPasswordLogin = await SecureStore.getItemAsync(LAST_PASSWORD_LOGIN_KEY);
    if (!lastPasswordLogin) return true;

    const lastLogin = parseInt(lastPasswordLogin, 10);
    const now = Date.now();
    
    return (now - lastLogin) > PASSWORD_REQUIREMENT_INTERVAL;
  } catch {
    return true;
  }
}

/**
 * Updates the last password login timestamp
 */
export async function updateLastPasswordLogin(): Promise<void> {
  await SecureStore.setItemAsync(LAST_PASSWORD_LOGIN_KEY, Date.now().toString());
}

/**
 * Performs biometric authentication
 */
export async function authenticateWithBiometrics(): Promise<BiometricAuthResult> {
  try {
    // Comprehensive security assessment
    const threatAssessment = await assessThreat();
    
    if (!threatAssessment.allowedActions.includes('biometric_auth')) {
      return {
        success: false,
        error: `Biometric authentication blocked due to security concerns: ${threatAssessment.factors.join(', ')}`,
        requiresPasswordLogin: true,
      };
    }
    
    // Rate limiting check
    const rateLimit = await checkRateLimit('auth');
    if (!rateLimit.allowed) {
      const resetTime = new Date(rateLimit.resetTime).toLocaleTimeString();
      return {
        success: false,
        error: `Too many authentication attempts. Try again after ${resetTime}.`,
        requiresPasswordLogin: true,
      };
    }
    
    // Check device changes
    const deviceChanges = await detectDeviceChanges();
    if (deviceChanges.hasChanged && deviceChanges.threatScore > 50) {
      await logSecurityEvent('device_change', deviceChanges, deviceChanges.threatScore);
      return {
        success: false,
        error: 'Significant device changes detected. Please re-enroll biometric authentication for security.',
        requiresPasswordLogin: true,
      };
    }
    
    // Check if too many failed attempts (legacy check)
    const attempts = await getBiometricAttempts();
    if (attempts >= MAX_BIOMETRIC_ATTEMPTS) {
      return {
        success: false,
        error: 'Too many failed attempts. Please use password.',
        requiresPasswordLogin: true,
      };
    }

    // Check if password login is required
    if (await isPasswordLoginRequired()) {
      return {
        success: false,
        error: 'Password login required for security.',
        requiresPasswordLogin: true,
      };
    }

    // Check biometric availability
    const availability = await checkBiometricAvailability();
    if (!availability.isAvailable) {
      return {
        success: false,
        error: availability.error || 'Biometric authentication not available',
      };
    }

    // Get stored token to verify it exists and is valid
    const storedToken = await getBiometricToken();
    if (!storedToken) {
      return {
        success: false,
        error: 'No biometric token found. Please set up biometric authentication.',
      };
    }

  // Perform biometric authentication with enhanced options
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: getBiometricPrompt(availability.biometricType),
    subtitle: availability.biometricType === 'faceId' ? 
      'Position your face clearly in front of the camera' : 
      availability.biometricType === 'touchId' ? 
      'Place your finger on the Touch ID sensor' : 
      'Place your finger on the fingerprint sensor',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use Password',
    disableDeviceFallback: true, // We handle fallback ourselves
    requireConfirmation: false, // Faster authentication
  });

    if (result.success) {
      // Reset failed attempts on success
      await resetBiometricAttempts();
      
      // Record successful authentication
      await recordAttempt('auth', true);
      
      try {
        // Validate token on server side
        const deviceId = await generateDeviceId();
        const serverValidation = await validateServerBiometricToken(
          storedToken.token,
          deviceId
        );
        
        if (!serverValidation.valid) {
          logger.warn('BIOMETRIC', 'Server validation failed for biometric token');
          await logBiometricAudit(
            'login',
            availability.biometricType,
            deviceId,
            false,
            'Server token validation failed'
          );
          
          return {
            success: false,
            error: 'Biometric token validation failed. Please set up biometric authentication again.',
          };
        }
        
        // Check if token should be refreshed
        if (serverValidation.shouldRefresh) {
          try {
            const newLocalToken = await generateBiometricToken(storedToken.userId);
            await refreshServerBiometricToken(
              storedToken.token,
              newLocalToken.token,
              deviceId
            );
            
            // Update local token
            await storeBiometricToken(newLocalToken);
            
            logger.info('BIOMETRIC', 'Biometric token refreshed successfully');
          } catch (refreshError) {
            logger.warn('BIOMETRIC', 'Token refresh failed, continuing with current token', refreshError);
          }
        }
        
        await logBiometricAudit(
          'login',
          availability.biometricType,
          deviceId,
          true
        );
        
      } catch (serverError) {
        logger.warn('BIOMETRIC', 'Server validation failed, continuing with local validation', serverError);
        // Continue with local validation - don't fail authentication if server is down
      }
      
      return {
        success: true,
        token: storedToken,
        biometricType: availability.biometricType,
      };
    } else {
      // Increment failed attempts
      const newAttempts = await incrementBiometricAttempts();
      
      let error = 'Biometric authentication failed';
      let requiresPasswordLogin = false;

      if (result.error === 'authentication_canceled' || result.error === 'user_cancel') {
        error = 'Authentication was cancelled';
      } else if (result.error === 'authentication_failed') {
        error = `Authentication failed (${newAttempts}/${MAX_BIOMETRIC_ATTEMPTS} attempts)`;
        if (newAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
          requiresPasswordLogin = true;
          error = 'Too many failed attempts. Please use password.';
        }
      } else if (result.error === 'lockout') {
        error = 'Biometric authentication is temporarily locked. Please use password.';
        requiresPasswordLogin = true;
      }
      
      // Record failed authentication attempt
      await recordAttempt('auth', false);
      
      // Log failed authentication attempt
      try {
        const deviceId = await generateDeviceId();
        await logBiometricAudit(
          'failure',
          availability.biometricType,
          deviceId,
          false,
          error
        );
        
        await logSecurityEvent('auth_failure', {
          biometricType: availability.biometricType,
          error,
          attempts: newAttempts,
        }, 15);
      } catch (auditError) {
        logger.warn('BIOMETRIC', 'Failed to log audit for failed attempt', auditError);
      }

      return {
        success: false,
        biometricType: availability.biometricType,
        error,
        requiresPasswordLogin,
      };
    }
  } catch (error) {
    logger.error('BIOMETRIC', 'Biometric authentication error:', error);
    return {
      success: false,
      error: 'An error occurred during biometric authentication',
    };
  }
}

/**
 * Sets up biometric authentication for a user
 */
export async function setupBiometricAuthentication(userId: string): Promise<BiometricAuthResult> {
  try {
    // Security assessment for enrollment
    const threatAssessment = await assessThreat();
    
    if (!threatAssessment.allowedActions.includes('biometric_enrollment')) {
      return {
        success: false,
        error: `Biometric enrollment blocked due to security concerns: ${threatAssessment.factors.join(', ')}`,
      };
    }
    
    // Rate limiting for enrollment
    const rateLimit = await checkRateLimit('enrollment');
    if (!rateLimit.allowed) {
      const resetTime = new Date(rateLimit.resetTime).toLocaleTimeString();
      return {
        success: false,
        error: `Too many enrollment attempts. Try again after ${resetTime}.`,
      };
    }
    
    // Generate device fingerprint for security
    await generateDeviceFingerprint();
    
    // Check biometric availability
    const availability = await checkBiometricAvailability();
    if (!availability.isAvailable) {
      await recordAttempt('enrollment', false);
      return {
        success: false,
        error: availability.error || 'Biometric authentication not available',
      };
    }

  // Perform initial biometric authentication to confirm setup with enhanced prompts
  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: `Set up ${getBiometricPrompt(availability.biometricType).toLowerCase()}`,
    subtitle: getSetupSubtitle(availability.biometricType),
    cancelLabel: 'Cancel',
    fallbackLabel: 'Cancel',
    disableDeviceFallback: true,
    requireConfirmation: false,
  });

    if (!authResult.success) {
      let error = 'Biometric setup cancelled';
      if (authResult.error === 'authentication_failed') {
        error = 'Biometric authentication failed during setup';
      }
      
      // Record failed enrollment attempt
      await recordAttempt('enrollment', false);
      
      return {
        success: false,
        error,
      };
    }
    
    // Record successful enrollment
    await recordAttempt('enrollment', true);

    // Generate local biometric token
    const localToken = await generateBiometricToken(userId);
    await storeBiometricToken(localToken);
    
    try {
      // Store token on server with audit logging
      const deviceId = await generateDeviceId();
      await createServerBiometricToken(
        availability.biometricType,
        deviceId,
        localToken.token
      );
      
      await logBiometricAudit(
        'setup',
        availability.biometricType,
        deviceId,
        true
      );
    } catch (serverError) {
      logger.warn('BIOMETRIC', 'Server token creation failed, continuing with local-only', serverError);
      // Continue with local-only setup - don't fail the entire setup
    }

    // Store biometric preferences
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    await SecureStore.setItemAsync(BIOMETRIC_TYPE_KEY, availability.biometricType);

    // Reset any failed attempts
    await resetBiometricAttempts();

    logger.info('BIOMETRIC', 'Biometric authentication set up successfully', {
      userId,
      biometricType: availability.biometricType,
    });

    return {
      success: true,
      token: localToken,
      biometricType: availability.biometricType,
    };
  } catch (error) {
    logger.error('BIOMETRIC', 'Biometric setup error:', error);
    return {
      success: false,
      error: 'An error occurred during biometric setup',
    };
  }
}

/**
 * Disables biometric authentication
 */
export async function disableBiometricAuthentication(): Promise<void> {
  try {
    // Revoke server-side tokens first
    try {
      const deviceId = await generateDeviceId();
      await revokeServerBiometricTokens(undefined, deviceId);
      
      await logBiometricAudit(
        'revoke',
        'all',
        deviceId,
        true
      );
    } catch (serverError) {
      logger.warn('BIOMETRIC', 'Server token revocation failed, continuing with local cleanup', serverError);
    }
    
    await Promise.all([
      clearBiometricToken(),
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_TYPE_KEY),
      resetBiometricAttempts(),
    ]);

    logger.info('BIOMETRIC', 'Biometric authentication disabled');
  } catch (error) {
    logger.error('BIOMETRIC', 'Error disabling biometric authentication:', error);
    throw error;
  }
}

/**
 * Checks if biometric authentication is enabled for the user
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

/**
 * Gets the stored biometric type
 */
export async function getStoredBiometricType(): Promise<BiometricType> {
  try {
    const type = await SecureStore.getItemAsync(BIOMETRIC_TYPE_KEY);
    return (type as BiometricType) || null;
  } catch {
    return null;
  }
}

/**
 * Validates if current biometric setup is still valid
 */
export async function validateBiometricSetup(): Promise<boolean> {
  try {
    if (!(await isBiometricEnabled())) {
      return false;
    }

    const availability = await checkBiometricAvailability();
    if (!availability.isAvailable) {
      return false;
    }

    const storedToken = await getBiometricToken();
    if (!storedToken) {
      return false;
    }

    const storedType = await getStoredBiometricType();
    if (storedType !== availability.biometricType) {
      // Biometric type changed, need to re-setup
      await disableBiometricAuthentication();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all biometric data (called on logout)
 */
export async function clearAllBiometricData(): Promise<void> {
  try {
    // Revoke all server-side tokens for the user
    try {
      await revokeServerBiometricTokens(); // Revoke all tokens for the user
    } catch (serverError) {
      logger.warn('BIOMETRIC', 'Server token cleanup failed, continuing with local cleanup', serverError);
    }
    
    await Promise.all([
      clearBiometricToken(),
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_TYPE_KEY),
      SecureStore.deleteItemAsync(LAST_PASSWORD_LOGIN_KEY),
      resetBiometricAttempts(),
      clearSecurityData(), // Clear all security-related data
    ]);

    logger.info('BIOMETRIC', 'All biometric data cleared');
  } catch (error) {
    logger.error('BIOMETRIC', 'Error clearing biometric data:', error);
  }
}
