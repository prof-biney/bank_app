#!/usr/bin/env node

/**
 * Biometric Token Creation Test
 * 
 * This script simulates the biometric token creation process to verify
 * that tokens are properly stored in the database.
 */

require('dotenv').config();
const { Client, Databases, ID } = require('node-appwrite');

console.log('🧪 Testing Biometric Token Creation');
console.log('===================================\n');

// Configuration
const client = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY); // We need an API key for server-side operations

const databases = new Databases(client);
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;

// Test data
const testUserId = 'test_user_' + Math.random().toString(36).substring(7);
const testDeviceId = 'device_' + Math.random().toString(36).substring(7);
const testToken = 'bio_' + testUserId + '_' + Date.now() + '_' + Math.random().toString(36).substring(7);

console.log('📋 Test Configuration:');
console.log(`Database ID: ${DATABASE_ID}`);
console.log(`Test User ID: ${testUserId}`);
console.log(`Test Device ID: ${testDeviceId}`);
console.log(`Test Token: ${testToken}`);
console.log();

async function testTokenCreation() {
  try {
    console.log('1️⃣ Creating biometric token...');
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    const tokenData = {
      token: testToken,
      userId: testUserId,
      deviceId: testDeviceId,
      biometricType: 'fingerprint',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    };
    
    console.log('📄 Token data to create:', JSON.stringify(tokenData, null, 2));
    
    const createdToken = await databases.createDocument(
      DATABASE_ID,
      'biometric_tokens',
      ID.unique(),
      tokenData
    );
    
    console.log('✅ Token created successfully!');
    console.log('📋 Created document ID:', createdToken.$id);
    console.log('📄 Created token data:', JSON.stringify(createdToken, null, 2));
    
    // Test querying the token
    console.log('\n2️⃣ Testing token query...');
    
    const tokens = await databases.listDocuments(
      DATABASE_ID,
      'biometric_tokens',
      [
        `token = "${testToken}"`,
        `deviceId = "${testDeviceId}"`,
        'isActive = true'
      ]
    );
    
    console.log(`✅ Query successful! Found ${tokens.documents.length} token(s)`);
    
    if (tokens.documents.length > 0) {
      console.log('📄 Queried token:', JSON.stringify(tokens.documents[0], null, 2));
    }
    
    // Test audit logging
    console.log('\n3️⃣ Testing audit log creation...');
    
    const auditData = {
      userId: testUserId,
      action: 'setup',
      biometricType: 'fingerprint',
      deviceId: testDeviceId,
      success: true,
      errorMessage: null,
      timestamp: new Date().toISOString(),
      userAgent: 'Test Script',
    };
    
    const auditEntry = await databases.createDocument(
      DATABASE_ID,
      'biometric_audit',
      ID.unique(),
      auditData
    );
    
    console.log('✅ Audit log created successfully!');
    console.log('📋 Audit document ID:', auditEntry.$id);
    console.log('📄 Audit data:', JSON.stringify(auditEntry, null, 2));
    
    // Clean up test data
    console.log('\n4️⃣ Cleaning up test data...');
    
    await databases.deleteDocument(DATABASE_ID, 'biometric_tokens', createdToken.$id);
    await databases.deleteDocument(DATABASE_ID, 'biometric_audit', auditEntry.$id);
    
    console.log('✅ Test data cleaned up successfully!');
    
    console.log('\n🎉 All tests passed!');
    console.log('✅ Biometric token creation works correctly');
    console.log('✅ Database queries work correctly');
    console.log('✅ Audit logging works correctly');
    console.log('\n💡 The biometric system is functioning properly.');
    console.log('   If tokens are not appearing in the app, the issue might be:');
    console.log('   - User permissions or authentication issues');
    console.log('   - Error handling masking the real problems');
    console.log('   - The setup flow not being triggered properly');
    console.log('   - Local secure storage issues');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.code === 401) {
      console.log('\n💡 Error Analysis:');
      console.log('   This is likely an authentication issue.');
      console.log('   - Check if APPWRITE_API_KEY is set in .env');
      console.log('   - Verify the API key has proper permissions');
      console.log('   - Ensure the project ID and database ID are correct');
    } else if (error.code === 404) {
      console.log('\n💡 Error Analysis:');
      console.log('   Collection or database not found.');
      console.log('   - Verify the collection IDs are correct');
      console.log('   - Check if collections exist in Appwrite Console');
    } else if (error.code === 400) {
      console.log('\n💡 Error Analysis:');
      console.log('   Invalid data or missing attributes.');
      console.log('   - Check if all required attributes exist in the collection');
      console.log('   - Verify attribute types match the data being sent');
    }
    
    console.log('\n📋 Full error details:', JSON.stringify(error, null, 2));
  }
}

// Check if we have the required API key
if (!process.env.APPWRITE_API_KEY) {
  console.log('⚠️ Missing APPWRITE_API_KEY environment variable');
  console.log('   This test requires an API key to perform server-side operations.');
  console.log('   You can generate one in the Appwrite Console under API Keys.');
  console.log('   Add it to your .env file as: APPWRITE_API_KEY=your_key_here');
  process.exit(1);
}

// Run the test
testTokenCreation().catch(console.error);