/**
 * Device Tracking Service
 * 
 * Manages trusted devices for fast biometric authentication.
 * When a device is recognized as trusted, enables 2-second auto-login with biometric prompt.
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '@/lib/logger';
import { 
  generateDeviceId, 
  BiometricAuthResult,
  authenticateWithBiometrics,
  checkBiometricAvailability,
  isBiometricEnabled
} from '@/lib/biometric/biometric.service';

// Storage keys
const TRUSTED_DEVICES_KEY = 'trusted_devices';
const DEVICE_TRUST_ENABLED_KEY = 'device_trust_enabled';
const LAST_AUTO_LOGIN_KEY = 'last_auto_login';
const DEVICE_METADATA_KEY = 'device_metadata';

// Configuration
const AUTO_LOGIN_TIMEOUT_MS = 2000; // 2 seconds
const DEVICE_TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_TIME_BETWEEN_AUTO_LOGIN_MS = 5 * 60 * 1000; // 5 minutes to prevent spam

export interface TrustedDevice {
  deviceId: string;
  userId: string;
  trustedAt: number;
  lastUsed: number;
  deviceInfo: {
    platform: string;
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
  biometricType: string;
}

export interface DeviceTrackingState {
  isDeviceTrusted: boolean;
  canAutoLogin: boolean;
  trustLevel: 'none' | 'pending' | 'trusted' | 'expired';
  lastAutoLogin?: number;
  autoLoginCountdown?: number;
}

export interface AutoLoginResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  biometricResult?: BiometricAuthResult;
  remainingTime?: number;
}

/**
 * Gets current device information for tracking
 */
async function getDeviceInfo(): Promise<TrustedDevice['deviceInfo']> {
  // In a real app, you'd use expo-device or similar to get actual device info
  // For now, we'll use basic platform detection
  const { Platform } = require('react-native');
  
  return {
    platform: Platform.OS,
    model: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
    osVersion: Platform.Version?.toString() || 'Unknown',
    appVersion: '1.0.0', // You can get this from app.json or Constants.manifest
  };
}

/**
 * Retrieves all trusted devices for current user
 */
async function getTrustedDevices(): Promise<TrustedDevice[]> {
  try {
    const devicesData = await SecureStore.getItemAsync(TRUSTED_DEVICES_KEY);
    if (!devicesData) return [];
    
    const devices: TrustedDevice[] = JSON.parse(devicesData);
    
    // Filter out expired devices
    const now = Date.now();
    const validDevices = devices.filter(device => 
      (now - device.trustedAt) < DEVICE_TRUST_DURATION_MS
    );
    
    // Save cleaned list if any devices were removed
    if (validDevices.length !== devices.length) {
      await saveTrustedDevices(validDevices);
    }
    
    return validDevices;
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to get trusted devices:', error);
    return [];
  }
}

/**
 * Saves trusted devices list
 */
async function saveTrustedDevices(devices: TrustedDevice[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(TRUSTED_DEVICES_KEY, JSON.stringify(devices));
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to save trusted devices:', error);
    throw error;
  }
}

/**
 * Checks if current device is trusted for the given user
 */
export async function isCurrentDeviceTrusted(userId: string): Promise<boolean> {
  try {
    const currentDeviceId = await generateDeviceId();
    const trustedDevices = await getTrustedDevices();
    
    const trustedDevice = trustedDevices.find(device => 
      device.deviceId === currentDeviceId && device.userId === userId
    );
    
    return !!trustedDevice;
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to check device trust status:', error);
    return false;
  }
}

/**
 * Adds current device to trusted devices list
 */
export async function addCurrentDeviceToTrusted(
  userId: string, 
  biometricType: string
): Promise<void> {
  try {
    const currentDeviceId = await generateDeviceId();
    const deviceInfo = await getDeviceInfo();
    const now = Date.now();
    
    const trustedDevices = await getTrustedDevices();
    
    // Remove any existing entry for this device and user
    const filteredDevices = trustedDevices.filter(device => 
      !(device.deviceId === currentDeviceId && device.userId === userId)
    );
    
    // Add new trusted device entry
    const newTrustedDevice: TrustedDevice = {
      deviceId: currentDeviceId,
      userId,
      trustedAt: now,
      lastUsed: now,
      deviceInfo,
      biometricType,
    };
    
    filteredDevices.push(newTrustedDevice);
    await saveTrustedDevices(filteredDevices);
    
    logger.info('DEVICE_TRACKING', 'Device added to trusted list:', {
      deviceId: currentDeviceId,
      userId,
      biometricType,
    });
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to add device to trusted list:', error);
    throw error;
  }
}

/**
 * Updates last used timestamp for current device
 */
export async function updateDeviceLastUsed(userId: string): Promise<void> {
  try {
    const currentDeviceId = await generateDeviceId();
    const trustedDevices = await getTrustedDevices();
    
    const deviceIndex = trustedDevices.findIndex(device => 
      device.deviceId === currentDeviceId && device.userId === userId
    );
    
    if (deviceIndex >= 0) {
      trustedDevices[deviceIndex].lastUsed = Date.now();
      await saveTrustedDevices(trustedDevices);
      
      logger.info('DEVICE_TRACKING', 'Updated device last used timestamp:', {
        deviceId: currentDeviceId,
        userId,
      });
    }
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to update device last used:', error);
  }
}

/**
 * Removes current device from trusted devices
 */
export async function removeCurrentDeviceFromTrusted(userId: string): Promise<void> {
  try {
    const currentDeviceId = await generateDeviceId();
    const trustedDevices = await getTrustedDevices();
    
    const filteredDevices = trustedDevices.filter(device => 
      !(device.deviceId === currentDeviceId && device.userId === userId)
    );
    
    await saveTrustedDevices(filteredDevices);
    
    logger.info('DEVICE_TRACKING', 'Device removed from trusted list:', {
      deviceId: currentDeviceId,
      userId,
    });
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to remove device from trusted list:', error);
    throw error;
  }
}

/**
 * Clears all trusted devices for a user (on logout)
 */
export async function clearTrustedDevicesForUser(userId: string): Promise<void> {
  try {
    const trustedDevices = await getTrustedDevices();
    const filteredDevices = trustedDevices.filter(device => device.userId !== userId);
    
    await saveTrustedDevices(filteredDevices);
    
    logger.info('DEVICE_TRACKING', 'Cleared trusted devices for user:', { userId });
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to clear trusted devices for user:', error);
  }
}

/**
 * Checks if device trust feature is enabled
 */
export async function isDeviceTrustEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(DEVICE_TRUST_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

/**
 * Enables or disables device trust feature
 */
export async function setDeviceTrustEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TRUST_ENABLED_KEY, enabled.toString());
  
  if (!enabled) {
    // Clear all trusted devices if feature is disabled
    await saveTrustedDevices([]);
  }
  
  logger.info('DEVICE_TRACKING', 'Device trust feature toggled:', { enabled });
}

/**
 * Gets the last auto-login timestamp
 */
async function getLastAutoLoginTime(): Promise<number> {
  try {
    const timestamp = await SecureStore.getItemAsync(LAST_AUTO_LOGIN_KEY);
    return timestamp ? parseInt(timestamp, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Updates the last auto-login timestamp
 */
async function updateLastAutoLoginTime(): Promise<void> {
  await SecureStore.setItemAsync(LAST_AUTO_LOGIN_KEY, Date.now().toString());
}

/**
 * Checks if auto-login should be attempted
 */
export async function shouldAttemptAutoLogin(userId: string): Promise<DeviceTrackingState> {
  const result: DeviceTrackingState = {
    isDeviceTrusted: false,
    canAutoLogin: false,
    trustLevel: 'none',
  };
  
  try {
    // Check if device trust is enabled
    const trustEnabled = await isDeviceTrustEnabled();
    if (!trustEnabled) {
      result.reason = 'Device trust feature disabled';
      return result;
    }
    
    // Check if biometric authentication is available and enabled
    const biometricEnabled = await isBiometricEnabled();
    if (!biometricEnabled) {
      result.reason = 'Biometric authentication not enabled';
      return result;
    }
    
    const availability = await checkBiometricAvailability();
    if (!availability.isAvailable) {
      result.reason = `Biometric not available: ${availability.error}`;
      return result;
    }
    
    // Check if current device is trusted
    const isDeviceTrusted = await isCurrentDeviceTrusted(userId);
    result.isDeviceTrusted = isDeviceTrusted;
    
    if (!isDeviceTrusted) {
      result.trustLevel = 'none';
      result.reason = 'Device not trusted';
      return result;
    }
    
    result.trustLevel = 'trusted';
    
    // Check time since last auto-login to prevent spam
    const lastAutoLogin = await getLastAutoLoginTime();
    const timeSinceLastAutoLogin = Date.now() - lastAutoLogin;
    
    if (timeSinceLastAutoLogin < MIN_TIME_BETWEEN_AUTO_LOGIN_MS) {
      result.canAutoLogin = false;
      result.lastAutoLogin = lastAutoLogin;
      result.reason = `Too soon since last auto-login (${Math.ceil((MIN_TIME_BETWEEN_AUTO_LOGIN_MS - timeSinceLastAutoLogin) / 1000)}s remaining)`;
      return result;
    }
    
    result.canAutoLogin = true;
    result.lastAutoLogin = lastAutoLogin;
    
    return result;
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Error checking auto-login eligibility:', error);
    result.reason = 'Error checking eligibility';
    return result;
  }
}

/**
 * Attempts automatic biometric login with timeout
 */
export async function attemptAutoLogin(userId: string): Promise<AutoLoginResult> {
  const startTime = Date.now();
  
  try {
    // Pre-check eligibility
    const state = await shouldAttemptAutoLogin(userId);
    if (!state.canAutoLogin) {
      return {
        success: false,
        skipped: true,
        reason: state.reason,
      };
    }
    
    logger.info('DEVICE_TRACKING', 'Starting auto-login attempt:', {
      userId,
      timeout: AUTO_LOGIN_TIMEOUT_MS,
    });
    
    // Create a promise that resolves with biometric authentication
    const biometricPromise = authenticateWithBiometrics();
    
    // Create a timeout promise
    const timeoutPromise = new Promise<BiometricAuthResult>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Auto-login timeout',
        });
      }, AUTO_LOGIN_TIMEOUT_MS);
    });
    
    // Race between biometric auth and timeout
    const result = await Promise.race([biometricPromise, timeoutPromise]);
    
    const elapsedTime = Date.now() - startTime;
    
    if (result.success) {
      // Update timestamps on successful auto-login
      await updateLastAutoLoginTime();
      await updateDeviceLastUsed(userId);
      
      logger.info('DEVICE_TRACKING', 'Auto-login successful:', {
        userId,
        elapsedTime,
        biometricType: result.biometricType,
      });
      
      return {
        success: true,
        skipped: false,
        biometricResult: result,
      };
    } else {
      logger.info('DEVICE_TRACKING', 'Auto-login failed:', {
        userId,
        elapsedTime,
        reason: result.error,
        wasTimeout: elapsedTime >= AUTO_LOGIN_TIMEOUT_MS,
      });
      
      return {
        success: false,
        skipped: false,
        reason: result.error,
        biometricResult: result,
        remainingTime: elapsedTime < AUTO_LOGIN_TIMEOUT_MS ? AUTO_LOGIN_TIMEOUT_MS - elapsedTime : 0,
      };
    }
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Auto-login error:', error);
    return {
      success: false,
      skipped: false,
      reason: 'Auto-login error occurred',
    };
  }
}

/**
 * Gets trusted devices for the current user (for UI display)
 */
export async function getTrustedDevicesForUser(userId: string): Promise<TrustedDevice[]> {
  const allDevices = await getTrustedDevices();
  return allDevices.filter(device => device.userId === userId);
}

/**
 * Removes a specific trusted device
 */
export async function removeTrustedDevice(deviceId: string, userId: string): Promise<void> {
  try {
    const trustedDevices = await getTrustedDevices();
    const filteredDevices = trustedDevices.filter(device => 
      !(device.deviceId === deviceId && device.userId === userId)
    );
    
    await saveTrustedDevices(filteredDevices);
    
    logger.info('DEVICE_TRACKING', 'Removed specific trusted device:', {
      deviceId,
      userId,
    });
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to remove trusted device:', error);
    throw error;
  }
}

/**
 * Clears all trusted devices (admin function)
 */
export async function clearAllTrustedDevices(): Promise<void> {
  try {
    await saveTrustedDevices([]);
    logger.info('DEVICE_TRACKING', 'Cleared all trusted devices');
  } catch (error) {
    logger.error('DEVICE_TRACKING', 'Failed to clear all trusted devices:', error);
    throw error;
  }
}