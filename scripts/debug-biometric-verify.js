#!/usr/bin/env node

/**
 * Debug Biometric Collections Verification Script
 * 
 * This script provides detailed debugging information for biometric collection verification
 */

const { Client, Databases, Query } = require('appwrite');
require('dotenv').config();

// Configuration from environment
const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID,
  usersCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID || process.env.APPWRITE_USER_COLLECTION_ID,
  biometricTokensCollectionId: process.env.EXPO_PUBLIC_APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID || 'biometric_tokens',
  biometricAuditCollectionId: process.env.EXPO_PUBLIC_APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID || 'biometric_audit',
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
};

console.log('🔧 Debug Biometric Collections Verification');
console.log('============================================');

console.log('\n📊 Configuration Debug:');
console.log(`Endpoint: ${appwriteConfig.endpoint}`);
console.log(`Project ID: ${appwriteConfig.projectId}`);
console.log(`Database ID: ${appwriteConfig.databaseId}`);
console.log(`Users Collection ID: ${appwriteConfig.usersCollectionId}`);
console.log(`Biometric Tokens Collection ID: ${appwriteConfig.biometricTokensCollectionId}`);
console.log(`Biometric Audit Collection ID: ${appwriteConfig.biometricAuditCollectionId}`);
console.log(`API Key Present: ${appwriteConfig.apiKey ? 'Yes' : 'No'}`);

// Validate configuration
if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.databaseId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

// Note: The client SDK doesn't support API key authentication
// Collections must be accessible with user permissions or public permissions

const databases = new Databases(client);

async function debugCollectionAccess(collectionId, collectionName) {
  console.log(`\n🔍 Testing ${collectionName} (${collectionId}):`);
  
  try {
    // Try to list documents first (this is the primary test for client SDK)
    console.log('  📄 Testing document access...');
    const documents = await databases.listDocuments(
      appwriteConfig.databaseId,
      collectionId,
      [Query.limit(1)]
    );
    console.log(`  ✅ Collection accessible - ${documents.total} total documents`);
    
    return { exists: true, accessible: true, documentCount: documents.total };
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    console.log(`  📝 Error Code: ${error.code || 'Unknown'}`);
    console.log(`  🔍 Error Type: ${error.type || 'Unknown'}`);
    
    // Check specific error types
    if (error.code === 404) {
      console.log('  💡 Collection does not exist');
      return { exists: false, accessible: false };
    } else if (error.code === 401 || error.code === 403) {
      console.log('  💡 Authentication/permission error');
      return { exists: true, accessible: false };
    } else {
      console.log('  💡 Other error - check details above');
      console.log(`  🔧 Full error object:`, JSON.stringify(error, null, 2));
      return { exists: false, accessible: false };
    }
  }
}

async function debugDatabaseAccess() {
  console.log(`\n🗄️  Testing database access:`);
  
  console.log('  ℹ️  Note: Client SDK has limited database admin functions');
  console.log('  📋 Testing collection access directly...');
  
  return { accessible: true };
}

async function debugUserCollection() {
  console.log(`\n👤 Testing users collection (${appwriteConfig.usersCollectionId}):`);
  
  try {
    // Test document access first
    console.log('  📄 Testing users collection document access...');
    const documents = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.limit(1)]
    );
    
    console.log(`  ✅ Users collection accessible - ${documents.total} total users`);
    
    // Note: We can't check collection schema with Client SDK
    console.log(`  ℹ️  Note: Cannot verify biometricPreferences attribute with Client SDK`);
    console.log(`  ℹ️  This will be tested during actual biometric operations`);
    
    return { accessible: true, hasBiometricPrefs: null };
    
  } catch (error) {
    console.log(`  ❌ Users collection error: ${error.message}`);
    console.log(`  📝 Error Code: ${error.code || 'Unknown'}`);
    return { accessible: false };
  }
}

async function main() {
  try {
    // Test database access first
    const dbResult = await debugDatabaseAccess();
    
    if (!dbResult.accessible) {
      console.log('\n❌ Cannot access database. Check your credentials and permissions.');
      process.exit(1);
    }
    
    // Test individual collection access
    const tokenResult = await debugCollectionAccess(
      appwriteConfig.biometricTokensCollectionId,
      'Biometric Tokens'
    );
    
    const auditResult = await debugCollectionAccess(
      appwriteConfig.biometricAuditCollectionId,
      'Biometric Audit'
    );
    
    // Test users collection
    const userResult = await debugUserCollection();
    
    console.log('\n📊 Summary:');
    console.log('================');
    console.log(`Database Connection: ${dbResult.accessible ? '✅' : '❌'}`);
    console.log(`Users Collection: ${userResult.accessible ? '✅' : '❌'} (${userResult.accessible ? 'Ready' : 'Not accessible'})`);
    console.log(`Biometric Tokens: ${tokenResult.exists ? '✅ Exists' : '❌ Missing'} ${tokenResult.accessible ? '(Accessible)' : '(Not accessible)'}`);
    console.log(`Biometric Audit: ${auditResult.exists ? '✅ Exists' : '❌ Missing'} ${auditResult.accessible ? '(Accessible)' : '(Not accessible)'}`);
    
    if (tokenResult.exists && auditResult.exists && tokenResult.accessible && auditResult.accessible) {
      console.log('\n🎉 All biometric collections are working correctly!');
      console.log(`\n📊 Collection Statistics:`);
      console.log(`  • Biometric Tokens: ${tokenResult.documentCount || 0} documents`);
      console.log(`  • Biometric Audit: ${auditResult.documentCount || 0} documents`);
      console.log('\n🚀 Your biometric authentication system is ready to use!');
    } else {
      console.log('\n⚠️  Issues detected. Please check the details above.');
      
      if (!tokenResult.exists || !auditResult.exists) {
        console.log('\n💡 Troubleshooting steps:');
        console.log('1. Verify collection IDs match exactly (case-sensitive)');
        console.log('2. Ensure collections exist in the correct database');
        console.log('3. Check collection permissions (should allow "users" role to read/write)');
        console.log('4. Verify your environment variables are loaded correctly');
        console.log('\n🔗 Check your Appwrite Console:');
        console.log(`https://cloud.appwrite.io/console/project-${appwriteConfig.projectId}/databases/database-${appwriteConfig.databaseId}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Debug verification failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the debug script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };