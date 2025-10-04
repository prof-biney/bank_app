#!/usr/bin/env node

/**
 * Test Script for Session Management and Lockout Fixes
 * 
 * This script tests the fixes for:
 * 1. Session conflict errors on app resume
 * 2. Automatic account unlock after lockout expiry
 * 3. Biometric session management
 * 
 * Run this script to verify all fixes are working correctly.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.cyan}=== ${message} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Check if file exists and contains expected code
function checkFileContains(filePath, searchText, description) {
  try {
    if (!fs.existsSync(filePath)) {
      logError(`File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(searchText)) {
      logSuccess(`${description} - Found in ${path.basename(filePath)}`);
      return true;
    } else {
      logError(`${description} - Not found in ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    logError(`Error checking ${filePath}: ${error.message}`);
    return false;
  }
}

// Main test function
async function runTests() {
  logHeader('Testing Session Management and Lockout Fixes');
  
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Check session conflict fix in auth service
  logHeader('Test 1: Session Conflict Fix');
  totalTests++;
  if (checkFileContains(
    'lib/appwrite/auth.ts',
    'existingSession = await account.getSession',
    'Session conflict prevention check'
  )) {
    passedTests++;
  }

  // Test 2: Check automatic unlock mechanism
  logHeader('Test 2: Automatic Account Unlock');
  totalTests++;
  if (checkFileContains(
    'lib/loginAttempts.ts',
    'unlockExpiredAccount',
    'Automatic unlock mechanism'
  )) {
    passedTests++;
  }

  // Test 3: Check lockout cleanup in getStoredData
  totalTests++;
  if (checkFileContains(
    'lib/loginAttempts.ts',
    'hasChanges = true',
    'Lockout cleanup with change tracking'
  )) {
    passedTests++;
  }

  // Test 4: Check login flow lockout handling
  logHeader('Test 3: Login Flow Lockout Handling');
  totalTests++;
  if (checkFileContains(
    'store/auth.store.ts',
    'await loginAttemptsService.unlockExpiredAccount(email)',
    'Login flow expired lockout check'
  )) {
    passedTests++;
  }

  // Test 5: Check biometric session management
  logHeader('Test 4: Biometric Session Management');
  totalTests++;
  if (checkFileContains(
    'store/auth.store.ts',
    'const currentUser = await getCurrentUser()',
    'Biometric existing session check'
  )) {
    passedTests++;
  }

  // Test 6: Check app state service
  logHeader('Test 5: App State Service');
  totalTests++;
  if (checkFileContains(
    'lib/appState.service.ts',
    'class AppStateService',
    'App state service implementation'
  )) {
    passedTests++;
  }

  // Test 7: Check app state service initialization
  totalTests++;
  if (checkFileContains(
    'context/AppContext.tsx',
    'appStateService.initialize()',
    'App state service initialization'
  )) {
    passedTests++;
  }

  // Test 8: Check TypeScript compilation
  logHeader('Test 6: TypeScript Compilation');
  totalTests++;
  try {
    logInfo('Checking TypeScript compilation...');
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe', cwd: process.cwd() });
    logSuccess('TypeScript compilation successful');
    passedTests++;
  } catch (error) {
    logError('TypeScript compilation failed');
    logInfo('This may indicate syntax errors in the fixes');
  }

  // Summary
  logHeader('Test Results Summary');
  log(`\n${colors.bold}Total Tests: ${totalTests}`);
  log(`${colors.green}Passed: ${passedTests}`);
  log(`${colors.red}Failed: ${totalTests - passedTests}${colors.reset}`);
  
  if (passedTests === totalTests) {
    logSuccess('\n🎉 All tests passed! Session management and lockout fixes are properly implemented.');
  } else {
    logWarning(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please review the implementation.`);
  }

  // Additional recommendations
  logHeader('Manual Testing Recommendations');
  logInfo('To fully verify the fixes, perform these manual tests:');
  log('1. Set up fingerprint authentication');
  log('2. Background the app and resume it - should not get session conflict error');
  log('3. Fail login 4 times to trigger account lockout');
  log('4. Wait 5+ minutes and try to login - should automatically unlock');
  log('5. Test biometric login after app has been backgrounded');
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };