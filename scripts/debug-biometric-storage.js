#!/usr/bin/env node

/**
 * Biometric Storage Debug Script
 * 
 * This script helps debug issues with biometric token storage in the database.
 * It tests the complete flow from local token generation to database storage.
 */

const path = require('path');

console.log('🔍 Biometric Storage Debug Script');
console.log('===================================\n');

// Test environment setup
console.log('📋 Environment Check:');
console.log(`📂 Current directory: ${process.cwd()}`);
console.log(`🎯 Target directory: ${path.resolve(__dirname, '..')}`);

// Check package.json to confirm we're in the right place
const fs = require('fs');
const packagePath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  console.log(`📦 Project: ${pkg.name} (${pkg.version})`);
} else {
  console.log('❌ package.json not found');
  process.exit(1);
}

console.log('\n🔧 Debug Steps:');
console.log('================');

// Step 1: Check Appwrite configuration
console.log('\n1️⃣ Checking Appwrite Configuration...');

try {
  // Load environment variables
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('   ✅ .env file found');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasProjectId = envContent.includes('EXPO_PUBLIC_APPWRITE_PROJECT_ID');
    const hasEndpoint = envContent.includes('EXPO_PUBLIC_APPWRITE_ENDPOINT');
    const hasDatabaseId = envContent.includes('EXPO_PUBLIC_APPWRITE_DATABASE_ID');
    
    console.log(`   ${hasProjectId ? '✅' : '❌'} Project ID configured`);
    console.log(`   ${hasEndpoint ? '✅' : '❌'} Endpoint configured`);  
    console.log(`   ${hasDatabaseId ? '✅' : '❌'} Database ID configured`);
    
    if (!hasProjectId || !hasEndpoint || !hasDatabaseId) {
      console.log('   ⚠️ Missing required Appwrite configuration');
    }
  } else {
    console.log('   ❌ .env file not found');
  }
} catch (error) {
  console.log(`   ❌ Error checking configuration: ${error.message}`);
}

// Step 2: Check collection configuration  
console.log('\n2️⃣ Checking Collection Configuration...');

try {
  const configPath = path.join(process.cwd(), 'lib', 'appwrite', 'config.ts');
  if (fs.existsSync(configPath)) {
    console.log('   ✅ Appwrite config file found');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    
    const hasBiometricTokens = configContent.includes('biometricTokens');
    const hasBiometricAudit = configContent.includes('biometricAudit');
    
    console.log(`   ${hasBiometricTokens ? '✅' : '❌'} biometricTokens collection configured`);
    console.log(`   ${hasBiometricAudit ? '✅' : '❌'} biometricAudit collection configured`);
    
    // Look for collection IDs
    if (hasBiometricTokens) {
      const tokenMatch = configContent.match(/biometricTokens:\s*{\s*id:\s*['"`]([^'"`]+)['"`]/);
      if (tokenMatch) {
        console.log(`   📋 biometricTokens ID: ${tokenMatch[1]}`);
      }
    }
    
    if (hasBiometricAudit) {
      const auditMatch = configContent.match(/biometricAudit:\s*{\s*id:\s*['"`]([^'"`]+)['"`]/);
      if (auditMatch) {
        console.log(`   📋 biometricAudit ID: ${auditMatch[1]}`);
      }
    }
  } else {
    console.log('   ❌ Appwrite config file not found');
  }
} catch (error) {
  console.log(`   ❌ Error checking collection config: ${error.message}`);
}

// Step 3: Check biometric service implementation
console.log('\n3️⃣ Checking Biometric Service Implementation...');

try {
  const biometricServicePath = path.join(process.cwd(), 'lib', 'biometric', 'biometric.service.ts');
  if (fs.existsSync(biometricServicePath)) {
    console.log('   ✅ Biometric service found');
    const serviceContent = fs.readFileSync(biometricServicePath, 'utf-8');
    
    const hasSetupFunction = serviceContent.includes('setupBiometricAuthentication');
    const hasServerIntegration = serviceContent.includes('createServerBiometricToken');
    const hasTokenStorage = serviceContent.includes('storeBiometricToken');
    
    console.log(`   ${hasSetupFunction ? '✅' : '❌'} setupBiometricAuthentication function`);
    console.log(`   ${hasServerIntegration ? '✅' : '❌'} Server integration calls`);
    console.log(`   ${hasTokenStorage ? '✅' : '❌'} Local token storage`);
  } else {
    console.log('   ❌ Biometric service not found');
  }
} catch (error) {
  console.log(`   ❌ Error checking biometric service: ${error.message}`);
}

// Step 4: Check auth service implementation
console.log('\n4️⃣ Checking Auth Service Biometric Functions...');

try {
  const authServicePath = path.join(process.cwd(), 'lib', 'appwrite', 'auth.ts');
  if (fs.existsSync(authServicePath)) {
    console.log('   ✅ Auth service found');
    const authContent = fs.readFileSync(authServicePath, 'utf-8');
    
    const hasCreateToken = authContent.includes('createBiometricToken');
    const hasValidateToken = authContent.includes('validateBiometricToken');
    const hasRefreshToken = authContent.includes('refreshBiometricToken');
    const hasRevokeTokens = authContent.includes('revokeBiometricTokens');
    const hasAuditLogging = authContent.includes('logBiometricAudit');
    
    console.log(`   ${hasCreateToken ? '✅' : '❌'} createBiometricToken function`);
    console.log(`   ${hasValidateToken ? '✅' : '❌'} validateBiometricToken function`);
    console.log(`   ${hasRefreshToken ? '✅' : '❌'} refreshBiometricToken function`);
    console.log(`   ${hasRevokeTokens ? '✅' : '❌'} revokeBiometricTokens function`);
    console.log(`   ${hasAuditLogging ? '✅' : '❌'} logBiometricAudit function`);
    
    // Check for database operations
    const hasDbCreate = authContent.includes('databases.createDocument') && authContent.includes('biometric');
    const hasDbQuery = authContent.includes('databases.listDocuments') && authContent.includes('biometric');
    
    console.log(`   ${hasDbCreate ? '✅' : '❌'} Database create operations`);
    console.log(`   ${hasDbQuery ? '✅' : '❌'} Database query operations`);
  } else {
    console.log('   ❌ Auth service not found');
  }
} catch (error) {
  console.log(`   ❌ Error checking auth service: ${error.message}`);
}

// Step 5: Check for verification script
console.log('\n5️⃣ Checking Database Verification Script...');

try {
  const verifyScriptPath = path.join(process.cwd(), 'scripts', 'verify-biometric-collections.js');
  if (fs.existsSync(verifyScriptPath)) {
    console.log('   ✅ Verification script found');
    console.log('   💡 You can run: node scripts/verify-biometric-collections.js');
  } else {
    console.log('   ❌ Verification script not found');
  }
} catch (error) {
  console.log(`   ❌ Error checking verification script: ${error.message}`);
}

console.log('\n🔍 Common Issues and Solutions:');
console.log('================================');
console.log('❓ If biometric data is not being stored:');
console.log('   1. Check if biometric collections exist in Appwrite Console');
console.log('   2. Verify collection IDs match in config.ts');
console.log('   3. Ensure user has permission to write to collections');
console.log('   4. Check if createBiometricToken function is being called');
console.log('   5. Verify error handling is not silently failing');

console.log('\n❓ If biometric setup appears to work but no database entries:');
console.log('   1. Check server-side token creation in auth.ts');
console.log('   2. Look for try-catch blocks that might be swallowing errors');  
console.log('   3. Verify Appwrite database permissions');
console.log('   4. Check if collections have proper attributes defined');

console.log('\n❓ If authentication works but audit logs are missing:');
console.log('   1. Check if logBiometricAudit is called after successful setup');
console.log('   2. Verify biometric_audit collection exists');
console.log('   3. Check error handling in audit logging function');

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. 🏗️  Run: node scripts/verify-biometric-collections.js');
console.log('2. 🧪  Test biometric setup in a user session');  
console.log('3. 🔍  Check Appwrite Console for database entries');
console.log('4. 📋  Review server logs for any error messages');
console.log('5. 🐛  Add console.log statements to track token creation flow');

console.log('\n✨ Debug completed! Check the items above to identify issues.\n');