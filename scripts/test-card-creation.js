#!/usr/bin/env node

/**
 * Test Card Creation Debug Script
 * 
 * This script tests the card creation flow to identify the exact issue
 */

require('dotenv').config();

const { Client, Databases, Query, ID, Account } = require('appwrite');

// Configuration
const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  cardsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID,
  usersCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
};

console.log('🔧 Configuration:', {
  endpoint: config.endpoint,
  projectId: config.projectId,
  databaseId: config.databaseId,
  cardsCollectionId: config.cardsCollectionId,
  usersCollectionId: config.usersCollectionId,
});

// Validate configuration
for (const [key, value] of Object.entries(config)) {
  if (!value) {
    console.error(`❌ Missing ${key}`);
    process.exit(1);
  }
}

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId);

const databases = new Databases(client);
const account = new Account(client);

async function testCollectionAccess() {
  console.log('\n📋 Testing collection access...');
  
  try {
    // Test cards collection
    const cardsResponse = await databases.listDocuments(
      config.databaseId,
      config.cardsCollectionId,
      [Query.limit(1)]
    );
    console.log(`✅ Cards collection accessible (${cardsResponse.total} documents)`);
    
  } catch (error) {
    console.error('❌ Cards collection error:', error.message);
    return false;
  }
  
  try {
    // Test users collection
    const usersResponse = await databases.listDocuments(
      config.databaseId,
      config.usersCollectionId,
      [Query.limit(1)]
    );
    console.log(`✅ Users collection accessible (${usersResponse.total} documents)`);
    
  } catch (error) {
    console.error('❌ Users collection error:', error.message);
    return false;
  }
  
  return true;
}

async function testCardCreation() {
  console.log('\n🧪 Testing card creation...');
  
  try {
    // Create a test card document
    const testCard = {
      userId: 'test_user_123',
      cardNumber: '4111111111111111',
      last4: '1111',
      holder: 'John Test',
      brand: 'visa',
      exp_month: 12,
      exp_year: 2025,
      color: '#1e40af',
      currency: 'GHS',
      token: 'test_token_123',
      status: 'active',
      type: 'debit',
      balance: 40000,
      startingBalance: 40000
    };
    
    console.log('📝 Attempting to create test card...');
    const document = await databases.createDocument(
      config.databaseId,
      config.cardsCollectionId,
      ID.unique(),
      testCard
    );
    
    console.log('✅ Test card created successfully:', document.$id);
    
    // Clean up - delete the test card
    await databases.deleteDocument(
      config.databaseId,
      config.cardsCollectionId,
      document.$id
    );
    console.log('🧹 Test card cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Card creation failed:', {
      message: error.message,
      code: error.code,
      type: error.type,
    });
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Appwrite Card Creation');
  console.log('================================');
  
  try {
    // Test collection access
    const accessOk = await testCollectionAccess();
    if (!accessOk) {
      console.error('\n❌ Collection access failed. Cannot proceed with card creation test.');
      process.exit(1);
    }
    
    // Test card creation
    const creationOk = await testCardCreation();
    if (!creationOk) {
      console.error('\n❌ Card creation failed.');
      process.exit(1);
    }
    
    console.log('\n🎉 All tests passed! Card creation should work properly.');
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);