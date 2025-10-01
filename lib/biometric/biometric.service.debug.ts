/**
 * Debug Enhanced Biometric Service
 * 
 * This is a debug version of the biometric service with enhanced logging
 * to help identify issues with database storage
 */

import { logger } from '@/lib/logger';
import {
  createBiometricToken as createServerBiometricToken,
  logBiometricAudit,
} from '@/lib/appwrite/auth';

/**
 * Debug version of setupBiometricAuthentication with enhanced logging
 */
export async function debugSetupBiometricAuthentication(userId: string) {
  logger.info('BIOMETRIC_DEBUG', '🚀 Starting biometric setup debug', { userId });
  
  try {
    // Simulate local token generation (without actual biometric check)
    const localToken = {
      token: `bio_debug_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
      userId,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
      createdAt: Date.now(),
      deviceId: 'debug_device_' + Math.random().toString(36).substr(2, 9),
    };
    
    logger.info('BIOMETRIC_DEBUG', '🏷️ Generated local token', {
      tokenPrefix: localToken.token.substring(0, 20) + '...',
      deviceId: localToken.deviceId,
    });
    
    // Test server token creation with detailed logging
    logger.info('BIOMETRIC_DEBUG', '🌐 Attempting server token creation...');
    
    try {
      const serverResult = await createServerBiometricToken(
        'fingerprint', // biometricType
        localToken.deviceId, // deviceId
        localToken.token // localBiometricToken
      );
      
      logger.info('BIOMETRIC_DEBUG', '✅ Server token creation SUCCESS', {
        serverResultType: typeof serverResult,
        hasToken: !!serverResult.token,
        hasUserId: !!serverResult.userId,
      });
      
      // Test audit logging
      logger.info('BIOMETRIC_DEBUG', '📝 Attempting audit log creation...');
      
      try {
        await logBiometricAudit(
          'setup',
          'fingerprint',
          localToken.deviceId,
          true
        );
        
        logger.info('BIOMETRIC_DEBUG', '✅ Audit log creation SUCCESS');
      } catch (auditError) {
        logger.error('BIOMETRIC_DEBUG', '❌ Audit log creation FAILED', {
          error: auditError.message,
          errorCode: auditError.code,
          errorType: auditError.type,
        });
      }
      
      return {
        success: true,
        message: 'Debug setup completed successfully - check logs for database entries',
        localToken,
        serverResult,
      };
      
    } catch (serverError) {
      logger.error('BIOMETRIC_DEBUG', '❌ Server token creation FAILED', {
        error: serverError.message,
        errorCode: serverError.code,
        errorType: serverError.type,
        stack: serverError.stack,
      });
      
      // Try to identify common issues
      if (serverError.message?.includes('User not authenticated')) {
        logger.error('BIOMETRIC_DEBUG', '🔐 ISSUE IDENTIFIED: User authentication problem');
        logger.info('BIOMETRIC_DEBUG', '💡 SOLUTION: Ensure user is properly logged in before setting up biometrics');
      } else if (serverError.message?.includes('Collection not found')) {
        logger.error('BIOMETRIC_DEBUG', '📂 ISSUE IDENTIFIED: Collection access problem');
        logger.info('BIOMETRIC_DEBUG', '💡 SOLUTION: Check collection IDs and permissions');
      } else if (serverError.message?.includes('Permission')) {
        logger.error('BIOMETRIC_DEBUG', '🚫 ISSUE IDENTIFIED: Permission problem');
        logger.info('BIOMETRIC_DEBUG', '💡 SOLUTION: Check database permissions in Appwrite Console');
      } else {
        logger.error('BIOMETRIC_DEBUG', '❓ ISSUE IDENTIFIED: Unknown server error');
        logger.info('BIOMETRIC_DEBUG', '💡 SOLUTION: Check full error details above');
      }
      
      return {
        success: false,
        message: 'Server token creation failed - check logs for details',
        error: serverError.message,
        localToken,
        serverResult: null,
      };
    }
    
  } catch (error) {
    logger.error('BIOMETRIC_DEBUG', '💥 Debug setup completely failed', {
      error: error.message,
      stack: error.stack,
    });
    
    return {
      success: false,
      message: 'Debug setup failed completely',
      error: error.message,
    };
  }
}

/**
 * Utility function to test database connectivity
 */
export async function testDatabaseConnectivity() {
  logger.info('BIOMETRIC_DEBUG', '🔌 Testing database connectivity...');
  
  try {
    const { databases, appwriteConfig } = require('@/lib/appwrite/config');
    
    // Try to list documents from biometric_tokens collection
    const tokens = await databases.listDocuments(
      appwriteConfig.databaseId,
      'biometric_tokens',
      []
    );
    
    logger.info('BIOMETRIC_DEBUG', '✅ Database connectivity SUCCESS', {
      totalTokens: tokens.total,
      documentsReturned: tokens.documents.length,
    });
    
    return { success: true, tokenCount: tokens.total };
    
  } catch (error) {
    logger.error('BIOMETRIC_DEBUG', '❌ Database connectivity FAILED', {
      error: error.message,
      errorCode: error.code,
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Function to check current user authentication status
 */
export async function checkUserAuthStatus() {
  logger.info('BIOMETRIC_DEBUG', '👤 Checking user authentication status...');
  
  try {
    const { getCurrentUser } = require('@/lib/appwrite/auth');
    
    const user = await getCurrentUser();
    
    if (user) {
      logger.info('BIOMETRIC_DEBUG', '✅ User authenticated', {
        userId: user.$id,
        email: user.email,
        name: user.name,
      });
      
      return { authenticated: true, user };
    } else {
      logger.warn('BIOMETRIC_DEBUG', '❌ User not authenticated');
      return { authenticated: false, user: null };
    }
    
  } catch (error) {
    logger.error('BIOMETRIC_DEBUG', '❌ Auth check failed', {
      error: error.message,
    });
    
    return { authenticated: false, error: error.message };
  }
}

/**
 * Comprehensive debug function that tests all components
 */
export async function runComprehensiveDebug() {
  logger.info('BIOMETRIC_DEBUG', '🔍 Starting comprehensive debug...');
  
  const results = {
    userAuth: null,
    databaseConnectivity: null,
    tokenCreation: null,
    timestamp: new Date().toISOString(),
  };
  
  // 1. Check user authentication
  results.userAuth = await checkUserAuthStatus();
  
  // 2. Test database connectivity
  results.databaseConnectivity = await testDatabaseConnectivity();
  
  // 3. Test token creation (only if user is authenticated)
  if (results.userAuth.authenticated) {
    results.tokenCreation = await debugSetupBiometricAuthentication(
      results.userAuth.user.$id
    );
  } else {
    logger.warn('BIOMETRIC_DEBUG', '⚠️ Skipping token creation test - user not authenticated');
    results.tokenCreation = {
      success: false,
      message: 'Skipped - user not authenticated',
    };
  }
  
  // Summary
  logger.info('BIOMETRIC_DEBUG', '📊 Debug Summary', results);
  
  return results;
}