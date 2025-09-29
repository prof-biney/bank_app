#!/usr/bin/env node

/**
 * Appwrite Configuration Test Script
 * Run this to diagnose and fix common Appwrite configuration issues
 */

import { Client, Account, Databases, ID } from 'node-appwrite';
import 'dotenv/config';

// Configuration from environment variables
const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  userCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
  cardsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID,
  transactionsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID,
  notificationsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
};

console.log('🔧 Appwrite Configuration Test');
console.log('================================');

// Validate configuration
function validateConfig() {
  console.log('\n1️⃣  Validating Configuration...');
  
  const requiredFields = [
    'endpoint',
    'projectId', 
    'databaseId',
    'userCollectionId',
    'cardsCollectionId', 
    'transactionsCollectionId',
    'notificationsCollectionId'
  ];
  
  const missing = requiredFields.filter(field => !config[field]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required configuration:');
    missing.forEach(field => console.error(`   - ${field.toUpperCase()}`));
    return false;
  }
  
  console.log('✅ All required configuration present');
  
  // Display current config
  console.log('\nCurrent Configuration:');
  Object.entries(config).forEach(([key, value]) => {
    if (key === 'apiKey') {
      console.log(`   ${key}: ${value ? `***${value.slice(-4)}` : 'Not set'}`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  });
  
  return true;
}

// Test client connection
async function testConnection() {
  console.log('\n2️⃣  Testing Server Connection...');
  
  try {
    const client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);

    // If we have API key, use it for server-side operations
    if (config.apiKey) {
      client.setKey(config.apiKey);
    }

    const account = new Account(client);
    
    // Try to get account info (this will fail with proper error if misconfigured)
    try {
      const result = await account.get();
      console.log('✅ Server connection successful');
      console.log(`   Authenticated as: ${result.email || result.name || result.$id}`);
      return { client, account, authenticated: true };
    } catch (error) {
      if (error.code === 401) {
        console.log('⚠️  Connection successful but not authenticated (expected for client-side)');
        return { client, account, authenticated: false };
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Server connection failed:');
    console.error(`   ${error.message}`);
    return null;
  }
}

// Test database permissions
async function testDatabasePermissions(client) {
  console.log('\n3️⃣  Testing Database Access...');
  
  try {
    const databases = new Databases(client);
    
    // Try to list documents from users collection (should work with API key)
    const collections = [
      { name: 'Users', id: config.userCollectionId },
      { name: 'Cards', id: config.cardsCollectionId },
      { name: 'Transactions', id: config.transactionsCollectionId },
      { name: 'Notifications', id: config.notificationsCollectionId }
    ];
    
    for (const collection of collections) {
      try {
        const result = await databases.listDocuments(config.databaseId, collection.id);
        console.log(`✅ ${collection.name} collection accessible (${result.documents.length} documents)`);
      } catch (error) {
        console.error(`❌ ${collection.name} collection access failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database test failed:');
    console.error(`   ${error.message}`);
  }
}

// Test user authentication flow
async function testUserAuth() {
  console.log('\n4️⃣  Testing User Authentication Flow...');
  
  // Create a client without API key (simulates app client)
  const userClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

  const account = new Account(userClient);
  
  try {
    // Check if there's an existing session
    try {
      const session = await account.get();
      console.log('✅ Existing session found');
      console.log(`   User: ${session.email || session.name || session.$id}`);
      
      // Test database access with user session
      await testUserDatabaseAccess(userClient);
      
    } catch (sessionError) {
      console.log('ℹ️  No existing session (this is normal)');
      
      // Try to create a test session
      console.log('\n   Creating test session...');
      console.log('   📝 To test authentication, manually log in via your app first,');
      console.log('      then run this script again.');
    }
    
  } catch (error) {
    console.error('❌ User authentication test failed:');
    console.error(`   ${error.message}`);
  }
}

// Test database access with user credentials
async function testUserDatabaseAccess(client) {
  console.log('\n   Testing user database access...');
  
  const databases = new Databases(client);
  
  try {
    // Try to read user's own data
    const result = await databases.listDocuments(config.databaseId, config.userCollectionId);
    console.log(`✅ User can access database (${result.documents.length} documents visible)`);
    
  } catch (error) {
    if (error.message.includes('missing scopes')) {
      console.error('❌ PERMISSION ERROR: User missing required scopes');
      console.error('   This is the main issue causing authentication problems!');
      console.error('   Fix: Configure collection permissions to allow "users" role');
    } else {
      console.error(`❌ Database access failed: ${error.message}`);
    }
  }
}

// Provide recommendations
function printRecommendations() {
  console.log('\n🔍 Configuration Recommendations');
  console.log('=================================');
  
  console.log('\n1. In Appwrite Console → Auth → Settings:');
  console.log('   - Enable Email/Password authentication');
  console.log('   - Enable User Registration');
  console.log('   - Set appropriate session length');
  
  console.log('\n2. In Appwrite Console → Databases → [Your Database] → [Each Collection]:');
  console.log('   - Add Permission: Role "users" with Create, Read, Update, Delete');
  console.log('   - Consider document-level permissions: Role "user:[USER_ID]"');
  
  console.log('\n3. Test the fix:');
  console.log('   - Create a test user via your app');
  console.log('   - Log in with that user'); 
  console.log('   - Run this script again to verify permissions');
  
  console.log('\n4. If issues persist:');
  console.log('   - Check server logs in Appwrite Console');
  console.log('   - Verify environment variables match Appwrite project settings');
  console.log('   - Ensure Appwrite SDK version compatibility');
}

// Main execution
async function main() {
  try {
    // Step 1: Validate configuration
    if (!validateConfig()) {
      console.log('\n❌ Configuration validation failed. Please fix and try again.');
      return;
    }
    
    // Step 2: Test connection
    const connectionResult = await testConnection();
    if (!connectionResult) {
      console.log('\n❌ Connection test failed. Please check your Appwrite endpoint and project ID.');
      return;
    }
    
    // Step 3: Test database permissions (if we have API key)
    if (config.apiKey && connectionResult.authenticated) {
      await testDatabasePermissions(connectionResult.client);
    } else {
      console.log('\n⚠️  Skipping admin database tests (no API key or not authenticated)');
    }
    
    // Step 4: Test user authentication
    await testUserAuth();
    
    // Step 5: Provide recommendations
    printRecommendations();
    
    console.log('\n✨ Test completed! Check the results above.');
    
  } catch (error) {
    console.error('\n💥 Unexpected error during testing:');
    console.error(error);
  }
}

// Run the test
main().catch(console.error);