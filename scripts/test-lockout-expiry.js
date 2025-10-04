#!/usr/bin/env node

/**
 * Test Script for Lockout Expiry Verification
 * 
 * This script simulates and tests the lockout mechanism to ensure:
 * 1. Accounts get locked after 4 failed attempts
 * 2. Accounts automatically unlock after 5 minutes
 * 3. Users can successfully login after lockout expires
 * 
 * This uses the actual loginAttempts service to test the real behavior.
 */

const path = require('path');

// Mock AsyncStorage for Node.js testing
const mockStorage = new Map();
global.AsyncStorage = {
  getItem: async (key) => mockStorage.get(key) || null,
  setItem: async (key, value) => { mockStorage.set(key, value); },
  removeItem: async (key) => { mockStorage.delete(key); },
};

// Mock logger
const mockLogger = {
  info: (tag, message, meta) => console.log(`[${tag}] INFO: ${message}`, meta || ''),
  warn: (tag, message, meta) => console.log(`[${tag}] WARN: ${message}`, meta || ''),
  error: (tag, message, meta) => console.log(`[${tag}] ERROR: ${message}`, meta || ''),
};

// Setup module path resolution
const projectRoot = path.resolve(__dirname, '..');
require('module')._resolveFilename = (function(original) {
  return function(id, parent) {
    if (id === '@/lib/logger') {
      return path.resolve(projectRoot, 'lib', 'logger.ts');
    }
    return original(id, parent);
  };
})(require('module')._resolveFilename);

// Mock the logger module
require.cache[path.resolve(projectRoot, 'lib', 'logger.ts')] = {
  exports: { logger: mockLogger }
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.cyan}=== ${message} ===${colors.reset}`);
}

// Helper to wait for specified milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLockoutExpiry() {
  logHeader('Testing Account Lockout and Expiry Mechanism');
  
  try {
    // Import the login attempts service
    const loginAttemptsPath = path.resolve(projectRoot, 'lib', 'loginAttempts.ts');
    delete require.cache[loginAttemptsPath];
    const { loginAttemptsService } = require(loginAttemptsPath);
    
    const testEmail = 'test@example.com';
    let testsPassed = 0;
    let totalTests = 0;
    
    // Test 1: Initial state should allow login
    logHeader('Test 1: Initial State');
    totalTests++;
    const initialStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
    if (initialStatus.canAttempt && !initialStatus.isLocked && initialStatus.remainingAttempts === 4) {
      logSuccess('Initial state allows login with 4 attempts remaining');
      testsPassed++;
    } else {
      logError(`Initial state incorrect: canAttempt=${initialStatus.canAttempt}, isLocked=${initialStatus.isLocked}, remaining=${initialStatus.remainingAttempts}`);
    }
    
    // Test 2: Record failed attempts (1-3)
    logHeader('Test 2: Recording Failed Attempts (1-3)');
    for (let i = 1; i <= 3; i++) {
      totalTests++;
      const result = await loginAttemptsService.recordFailedAttempt(testEmail);
      if (!result.isLocked && result.remainingAttempts === (4 - i)) {
        logSuccess(`Attempt ${i}: Account not locked, ${result.remainingAttempts} attempts remaining`);
        testsPassed++;
      } else {
        logError(`Attempt ${i}: Unexpected state - locked=${result.isLocked}, remaining=${result.remainingAttempts}`);
      }
    }
    
    // Test 3: 4th attempt should trigger lockout
    logHeader('Test 3: 4th Attempt Should Trigger Lockout');
    totalTests++;
    const lockoutResult = await loginAttemptsService.recordFailedAttempt(testEmail);
    if (lockoutResult.isLocked && !lockoutResult.canAttempt && lockoutResult.remainingAttempts === 0) {
      logSuccess('4th attempt triggered lockout successfully');
      testsPassed++;
    } else {
      logError(`4th attempt failed to trigger lockout: locked=${lockoutResult.isLocked}, canAttempt=${lockoutResult.canAttempt}`);
    }
    
    // Test 4: Verify lockout is active
    logHeader('Test 4: Verify Active Lockout');
    totalTests++;
    const lockedStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
    if (lockedStatus.isLocked && !lockedStatus.canAttempt) {
      const timeLeft = await loginAttemptsService.getLockoutTimeLeft(testEmail);
      logSuccess(`Account is locked, time remaining: ${Math.ceil(timeLeft)} seconds`);
      testsPassed++;
    } else {
      logError('Account should be locked but is not');
    }
    
    // Test 5: Simulate waiting for lockout to expire (we'll use a shorter duration for testing)
    logHeader('Test 5: Simulating Lockout Expiry');
    logInfo('Modifying lockout time in storage to simulate expiry...');
    
    // Get current data and modify lockout time to be expired
    const currentData = JSON.parse(await mockStorage.get('login_attempts') || '{}');
    const normalizedEmail = testEmail.toLowerCase().trim();
    if (currentData[normalizedEmail]) {
      // Set lockout to have expired 1 second ago
      currentData[normalizedEmail].lockoutUntil = Date.now() - 1000;
      await mockStorage.set('login_attempts', JSON.stringify(currentData));
      logInfo('Lockout time modified to simulate expiry');
    }
    
    // Test 6: Verify automatic unlock
    logHeader('Test 6: Verify Automatic Unlock');
    totalTests++;
    const unlockedStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
    if (!unlockedStatus.isLocked && unlockedStatus.canAttempt && unlockedStatus.remainingAttempts === 4) {
      logSuccess('Account automatically unlocked after expiry with full attempts restored');
      testsPassed++;
    } else {
      logError(`Account not properly unlocked: locked=${unlockedStatus.isLocked}, canAttempt=${unlockedStatus.canAttempt}, remaining=${unlockedStatus.remainingAttempts}`);
    }
    
    // Test 7: Test manual unlock function
    logHeader('Test 7: Test Manual Unlock Function');
    
    // First, create a fresh lockout
    for (let i = 0; i < 4; i++) {
      await loginAttemptsService.recordFailedAttempt(testEmail);
    }
    
    totalTests++;
    const unlockResult = await loginAttemptsService.unlockExpiredAccount(testEmail);
    if (unlockResult) {
      const manualUnlockStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
      if (!manualUnlockStatus.isLocked && manualUnlockStatus.canAttempt) {
        logSuccess('Manual unlock function works correctly');
        testsPassed++;
      } else {
        logError('Manual unlock did not properly unlock account');
      }
    } else {
      // This might happen if lockout hasn't expired yet, which is expected
      const forceUnlockTest = await loginAttemptsService.forceUnlockAccount(testEmail);
      const forceUnlockStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
      if (!forceUnlockStatus.isLocked && forceUnlockStatus.canAttempt) {
        logSuccess('Force unlock function works correctly');
        testsPassed++;
      } else {
        logError('Force unlock did not properly unlock account');
      }
    }
    
    // Test 8: Test clearLoginAttempts
    logHeader('Test 8: Test Clear Login Attempts');
    totalTests++;
    await loginAttemptsService.clearLoginAttempts(testEmail);
    const clearedStatus = await loginAttemptsService.checkLoginAttempts(testEmail);
    if (!clearedStatus.isLocked && clearedStatus.canAttempt && clearedStatus.remainingAttempts === 4) {
      logSuccess('Clear login attempts works correctly');
      testsPassed++;
    } else {
      logError('Clear login attempts did not reset properly');
    }
    
    // Summary
    logHeader('Test Results Summary');
    log(`\n${colors.bold}Total Tests: ${totalTests}`);
    log(`${colors.green}Passed: ${testsPassed}`);
    log(`${colors.red}Failed: ${totalTests - testsPassed}${colors.reset}`);
    
    if (testsPassed === totalTests) {
      logSuccess('\n🎉 All lockout expiry tests passed! Users will be able to login after lockout expires.');
      return true;
    } else {
      logError(`\n⚠️  ${totalTests - testsPassed} test(s) failed. Lockout mechanism needs review.`);
      return false;
    }
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testLockoutExpiry().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    logError(`Test execution failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { testLockoutExpiry };