/**
 * Biometric Security Service
 * 
 * Advanced security features for biometric authentication including
 * rate limiting, device fingerprinting, telemetry, and threat detection.
 */

import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';

// Security storage keys
const RATE_LIMIT_KEY = 'biometric_rate_limit';
const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';
const SECURITY_EVENTS_KEY = 'security_events';
const THREAT_SCORE_KEY = 'threat_score';
const ENROLLMENT_ATTEMPTS_KEY = 'enrollment_attempts';

// Security constants
const MAX_ATTEMPTS_PER_HOUR = 10;
const MAX_ENROLLMENT_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour
const THREAT_THRESHOLD = 75; // Out of 100
const DEVICE_CHANGE_DETECTION_FIELDS = ['deviceName', 'modelName', 'osName', 'osVersion'];

export interface SecurityEvent {
  id: string;
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'setup_attempt' | 'device_change' | 'threat_detected';
  timestamp: number;
  deviceId: string;
  details?: any;
  threatScore: number;
}

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  modelName: string;
  osName: string;
  osVersion: string;
  manufacturer: string;
  isEmulator: boolean;
  totalMemory?: number;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  createdAt: number;
}

export interface RateLimitInfo {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

export interface ThreatAssessment {
  score: number;
  factors: string[];
  risk: 'low' | 'medium' | 'high' | 'critical';
  allowedActions: string[];
  requiresAdditionalAuth: boolean;
}

/**
 * Generate comprehensive device fingerprint
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  try {
    const { width, height } = require('react-native').Dimensions.get('screen');
    
    const fingerprint: DeviceFingerprint = {
      deviceId: Device.osBuildId || `${Device.osName}_${Date.now()}`,
      deviceName: Device.deviceName || 'Unknown Device',
      modelName: Device.modelName || 'Unknown Model',
      osName: Device.osName || Platform.OS,
      osVersion: Device.osVersion || 'Unknown',
      manufacturer: Device.manufacturer || 'Unknown',
      isEmulator: !Device.isDevice,
      totalMemory: Device.totalMemory,
      screenWidth: width,
      screenHeight: height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: Date.now(),
    };

    // Store fingerprint for future comparison
    await SecureStore.setItemAsync(DEVICE_FINGERPRINT_KEY, JSON.stringify(fingerprint));
    
    logger.info('SECURITY', 'Device fingerprint generated', {
      deviceId: fingerprint.deviceId,
      model: fingerprint.modelName,
      isEmulator: fingerprint.isEmulator,
    });

    return fingerprint;
  } catch (error) {
    logger.error('SECURITY', 'Failed to generate device fingerprint', error);
    throw new Error('Device fingerprint generation failed');
  }
}

/**
 * Detect device changes that might indicate security risks
 */
export async function detectDeviceChanges(): Promise<{
  hasChanged: boolean;
  changes: string[];
  threatScore: number;
}> {
  try {
    const storedFingerprint = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
    if (!storedFingerprint) {
      // First time setup
      await generateDeviceFingerprint();
      return { hasChanged: false, changes: [], threatScore: 0 };
    }

    const oldFingerprint: DeviceFingerprint = JSON.parse(storedFingerprint);
    const newFingerprint = await generateDeviceFingerprint();

    const changes: string[] = [];
    let threatScore = 0;

    // Check critical device fields
    for (const field of DEVICE_CHANGE_DETECTION_FIELDS) {
      if (oldFingerprint[field as keyof DeviceFingerprint] !== newFingerprint[field as keyof DeviceFingerprint]) {
        changes.push(field);
        threatScore += field === 'deviceName' ? 30 : 15;
      }
    }

    // Check for emulator changes (high risk)
    if (oldFingerprint.isEmulator !== newFingerprint.isEmulator) {
      changes.push('emulator_status');
      threatScore += 40;
    }

    // Screen resolution changes (medium risk)
    if (oldFingerprint.screenWidth !== newFingerprint.screenWidth || 
        oldFingerprint.screenHeight !== newFingerprint.screenHeight) {
      changes.push('screen_resolution');
      threatScore += 10;
    }

    if (changes.length > 0) {
      await logSecurityEvent('device_change', {
        changes,
        oldFingerprint: {
          deviceName: oldFingerprint.deviceName,
          modelName: oldFingerprint.modelName,
          osVersion: oldFingerprint.osVersion,
        },
        newFingerprint: {
          deviceName: newFingerprint.deviceName,
          modelName: newFingerprint.modelName,
          osVersion: newFingerprint.osVersion,
        },
      }, threatScore);
    }

    logger.info('SECURITY', 'Device change detection completed', {
      hasChanged: changes.length > 0,
      changes,
      threatScore,
    });

    return {
      hasChanged: changes.length > 0,
      changes,
      threatScore,
    };
  } catch (error) {
    logger.error('SECURITY', 'Device change detection failed', error);
    return { hasChanged: false, changes: [], threatScore: 0 };
  }
}

/**
 * Rate limiting for biometric authentication attempts
 */
export async function checkRateLimit(action: 'auth' | 'enrollment'): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  lockoutUntil?: number;
}> {
  try {
    const key = `${RATE_LIMIT_KEY}_${action}`;
    const stored = await SecureStore.getItemAsync(key);
    const now = Date.now();
    
    let rateLimitInfo: RateLimitInfo = stored ? JSON.parse(stored) : {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
    };

    // Check if we're in lockout period
    if (rateLimitInfo.lockoutUntil && now < rateLimitInfo.lockoutUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimitInfo.lockoutUntil,
        lockoutUntil: rateLimitInfo.lockoutUntil,
      };
    }

    // Reset counter if more than an hour has passed
    const hourAgo = now - (60 * 60 * 1000);
    if (rateLimitInfo.firstAttempt < hourAgo) {
      rateLimitInfo = {
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now,
      };
    }

    const maxAttempts = action === 'enrollment' ? MAX_ENROLLMENT_ATTEMPTS : MAX_ATTEMPTS_PER_HOUR;
    const allowed = rateLimitInfo.attempts < maxAttempts;
    const remaining = Math.max(0, maxAttempts - rateLimitInfo.attempts);

    if (!allowed) {
      // Trigger lockout
      rateLimitInfo.lockoutUntil = now + LOCKOUT_DURATION;
      
      await logSecurityEvent('threat_detected', {
        reason: 'rate_limit_exceeded',
        action,
        attempts: rateLimitInfo.attempts,
      }, 60);
    }

    // Update rate limit info
    await SecureStore.setItemAsync(key, JSON.stringify(rateLimitInfo));

    return {
      allowed,
      remaining,
      resetTime: rateLimitInfo.lockoutUntil || (rateLimitInfo.firstAttempt + (60 * 60 * 1000)),
      lockoutUntil: rateLimitInfo.lockoutUntil,
    };
  } catch (error) {
    logger.error('SECURITY', 'Rate limit check failed', error);
    // Fail secure - allow the attempt but log the error
    return {
      allowed: true,
      remaining: 0,
      resetTime: Date.now() + (60 * 60 * 1000),
    };
  }
}

/**
 * Record a rate-limited attempt
 */
export async function recordAttempt(action: 'auth' | 'enrollment', success: boolean): Promise<void> {
  try {
    const key = `${RATE_LIMIT_KEY}_${action}`;
    const stored = await SecureStore.getItemAsync(key);
    const now = Date.now();
    
    let rateLimitInfo: RateLimitInfo = stored ? JSON.parse(stored) : {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
    };

    rateLimitInfo.attempts += 1;
    rateLimitInfo.lastAttempt = now;

    await SecureStore.setItemAsync(key, JSON.stringify(rateLimitInfo));

    // Log security event
    await logSecurityEvent(
      success ? 'auth_success' : 'auth_failure',
      { action, attempt: rateLimitInfo.attempts },
      success ? 0 : 15
    );
  } catch (error) {
    logger.error('SECURITY', 'Failed to record attempt', error);
  }
}

/**
 * Comprehensive threat assessment
 */
export async function assessThreat(): Promise<ThreatAssessment> {
  try {
    let totalScore = 0;
    const factors: string[] = [];

    // Check device changes
    const deviceCheck = await detectDeviceChanges();
    if (deviceCheck.hasChanged) {
      totalScore += deviceCheck.threatScore;
      factors.push(`Device changes detected: ${deviceCheck.changes.join(', ')}`);
    }

    // Check rate limiting status
    const authRateLimit = await checkRateLimit('auth');
    if (!authRateLimit.allowed) {
      totalScore += 30;
      factors.push('Rate limit exceeded for authentication');
    }

    const enrollmentRateLimit = await checkRateLimit('enrollment');
    if (!enrollmentRateLimit.allowed) {
      totalScore += 25;
      factors.push('Rate limit exceeded for enrollment');
    }

    // Check network security
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (networkState.type === Network.NetworkStateType.CELLULAR) {
        totalScore += 5;
        factors.push('Using cellular network');
      }
      if (!networkState.isConnected) {
        totalScore += 10;
        factors.push('No network connectivity');
      }
    } catch (networkError) {
      logger.warn('SECURITY', 'Network check failed', networkError);
    }

    // Check for emulator
    if (!Device.isDevice) {
      totalScore += 40;
      factors.push('Running on emulator/simulator');
    }

    // Check recent security events
    const recentEvents = await getRecentSecurityEvents();
    const failureCount = recentEvents.filter(e => e.type === 'auth_failure').length;
    if (failureCount > 3) {
      totalScore += failureCount * 5;
      factors.push(`${failureCount} recent authentication failures`);
    }

    // Determine risk level and allowed actions
    let risk: 'low' | 'medium' | 'high' | 'critical';
    let allowedActions: string[];
    let requiresAdditionalAuth: boolean;

    if (totalScore < 25) {
      risk = 'low';
      allowedActions = ['biometric_auth', 'biometric_enrollment', 'password_auth'];
      requiresAdditionalAuth = false;
    } else if (totalScore < 50) {
      risk = 'medium';
      allowedActions = ['biometric_auth', 'password_auth'];
      requiresAdditionalAuth = false;
    } else if (totalScore < THREAT_THRESHOLD) {
      risk = 'high';
      allowedActions = ['password_auth'];
      requiresAdditionalAuth = true;
    } else {
      risk = 'critical';
      allowedActions = [];
      requiresAdditionalAuth = true;
    }

    // Store threat score for tracking
    await SecureStore.setItemAsync(THREAT_SCORE_KEY, JSON.stringify({
      score: totalScore,
      timestamp: Date.now(),
      risk,
    }));

    const assessment: ThreatAssessment = {
      score: Math.min(100, totalScore),
      factors,
      risk,
      allowedActions,
      requiresAdditionalAuth,
    };

    logger.info('SECURITY', 'Threat assessment completed', {
      score: assessment.score,
      risk: assessment.risk,
      factorCount: factors.length,
    });

    return assessment;
  } catch (error) {
    logger.error('SECURITY', 'Threat assessment failed', error);
    // Fail secure with high restrictions
    return {
      score: 100,
      factors: ['Assessment failed - security error'],
      risk: 'critical',
      allowedActions: [],
      requiresAdditionalAuth: true,
    };
  }
}

/**
 * Log security events for analysis
 */
export async function logSecurityEvent(
  type: SecurityEvent['type'],
  details: any,
  threatScore: number
): Promise<void> {
  try {
    const deviceFingerprint = await getDeviceFingerprint();
    
    const event: SecurityEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      deviceId: deviceFingerprint?.deviceId || 'unknown',
      details,
      threatScore,
    };

    // Get existing events
    const stored = await SecureStore.getItemAsync(SECURITY_EVENTS_KEY);
    const events: SecurityEvent[] = stored ? JSON.parse(stored) : [];

    // Add new event and keep only last 100 events
    events.push(event);
    const recentEvents = events.slice(-100);

    await SecureStore.setItemAsync(SECURITY_EVENTS_KEY, JSON.stringify(recentEvents));

    logger.info('SECURITY', 'Security event logged', {
      type: event.type,
      threatScore: event.threatScore,
      eventId: event.id,
    });
  } catch (error) {
    logger.error('SECURITY', 'Failed to log security event', error);
  }
}

/**
 * Get recent security events for analysis
 */
export async function getRecentSecurityEvents(hours: number = 24): Promise<SecurityEvent[]> {
  try {
    const stored = await SecureStore.getItemAsync(SECURITY_EVENTS_KEY);
    if (!stored) return [];

    const events: SecurityEvent[] = JSON.parse(stored);
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);

    return events.filter(event => event.timestamp > cutoff);
  } catch (error) {
    logger.error('SECURITY', 'Failed to get recent security events', error);
    return [];
  }
}

/**
 * Get stored device fingerprint
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint | null> {
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    logger.error('SECURITY', 'Failed to get device fingerprint', error);
    return null;
  }
}

/**
 * Generate security telemetry report
 */
export async function generateSecurityReport(): Promise<{
  deviceInfo: DeviceFingerprint | null;
  threatAssessment: ThreatAssessment;
  recentEvents: SecurityEvent[];
  rateLimits: {
    auth: { allowed: boolean; remaining: number; resetTime: number };
    enrollment: { allowed: boolean; remaining: number; resetTime: number };
  };
}> {
  try {
    const [deviceInfo, threatAssessment, recentEvents, authRateLimit, enrollmentRateLimit] = await Promise.all([
      getDeviceFingerprint(),
      assessThreat(),
      getRecentSecurityEvents(),
      checkRateLimit('auth'),
      checkRateLimit('enrollment'),
    ]);

    return {
      deviceInfo,
      threatAssessment,
      recentEvents,
      rateLimits: {
        auth: authRateLimit,
        enrollment: enrollmentRateLimit,
      },
    };
  } catch (error) {
    logger.error('SECURITY', 'Failed to generate security report', error);
    throw error;
  }
}

/**
 * Clear all security data (for logout/reset)
 */
export async function clearSecurityData(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(DEVICE_FINGERPRINT_KEY),
      SecureStore.deleteItemAsync(SECURITY_EVENTS_KEY),
      SecureStore.deleteItemAsync(THREAT_SCORE_KEY),
      SecureStore.deleteItemAsync(`${RATE_LIMIT_KEY}_auth`),
      SecureStore.deleteItemAsync(`${RATE_LIMIT_KEY}_enrollment`),
      SecureStore.deleteItemAsync(ENROLLMENT_ATTEMPTS_KEY),
    ]);

    logger.info('SECURITY', 'Security data cleared');
  } catch (error) {
    logger.error('SECURITY', 'Failed to clear security data', error);
  }
}