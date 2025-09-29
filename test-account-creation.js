#!/usr/bin/env node

import { Client, Account, Databases } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  userCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
};

console.log('🧪 Testing Account Creation Flow');
console.log('=================================');

async function testAccountCreation() {
  console.log('\n1️⃣  Testing account creation...');
  
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  const databases = new Databases(client);
  
  // Generate unique test user
  const timestamp = Date.now();
  const testUser = {
    email: `test-user-${timestamp}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${timestamp}`
  };
  
  console.log(`Creating user: ${testUser.email}`);
  
  try {
    // Step 1: Create account
    console.log('\n   Step 1: Creating Appwrite account...');
    const user = await account.create('unique()', testUser.email, testUser.password, testUser.name);
    
    console.log('✅ Appwrite account created successfully');
    console.log(`   User ID: ${user.$id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Status: ${user.status ? 'Active' : 'Inactive'}`);
    console.log(`   Email Verified: ${user.emailVerification}`);
    
    // Step 2: Create database profile (this might fail due to permissions)
    console.log('\n   Step 2: Creating database profile...');
    try {
      const profileData = {
        // ONLY the fields that exist in the schema
        name: user.name || 'User',
        email: user.email,
        accountId: user.$id,
        avatar: 'https://via.placeholder.com/150/000000/FFFFFF/?text=User', // Required URL field
        phoneNumber: '', // Required string field (empty for no phone)
        emailVerified: user.emailVerification || false,
        phoneVerified: false,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const profile = await databases.createDocument(
        config.databaseId,
        config.userCollectionId,
        user.$id,
        profileData
      );
      
      console.log('✅ Database profile created successfully');
      console.log(`   Profile ID: ${profile.$id}`);
      
    } catch (profileError) {
      console.error('❌ Database profile creation failed:', profileError.message);
      console.error('   This is likely due to collection permissions');
      
      if (profileError.message.includes('not authorized')) {
        console.error('   💡 Solution: Check collection permissions for "users" role');
      }
    }
    
    // Step 3: Test immediate login with new account
    console.log('\n   Step 3: Testing login with new account...');
    try {
      const session = await account.createEmailPasswordSession(testUser.email, testUser.password);
      
      console.log('✅ Login session created successfully');
      console.log(`   Session ID: ${session.$id}`);
      console.log(`   User ID: ${session.userId}`);
      
      // Step 4: Test account access (this will likely fail)
      console.log('\n   Step 4: Testing account access...');
      try {
        const accountDetails = await account.get();
        
        console.log('🎉 SUCCESS! Account access working with new user!');
        console.log(`   User: ${accountDetails.name} (${accountDetails.email})`);
        console.log(`   Email Verified: ${accountDetails.emailVerification}`);
        
        // Clean up
        await account.deleteSession('current');
        console.log('   Session cleaned up');
        
        return { success: true, user, message: 'New account creation and access fully working!' };
        
      } catch (accountError) {
        console.error('❌ Account access failed (expected):', accountError.message);
        
        if (accountError.message.includes('missing scopes')) {
          console.error('   🔍 Confirmed: New users also have the scope issue');
          console.error('   ✅ This means our workaround will be needed for all users');
        }
        
        // Clean up
        await account.deleteSession('current');
        console.log('   Session cleaned up');
        
        return { 
          success: false, 
          user, 
          message: 'Account created but has same scope issue - workaround needed',
          requiresWorkaround: true
        };
      }
      
    } catch (loginError) {
      console.error('❌ Login with new account failed:', loginError.message);
      
      if (loginError.message.includes('Invalid credentials')) {
        console.error('   🤔 This is unusual - account was just created');
      }
      
      return { 
        success: false, 
        user, 
        message: 'Account created but immediate login failed',
        error: loginError.message
      };
    }
    
  } catch (createError) {
    console.error('❌ Account creation failed:', createError.message);
    
    if (createError.message.includes('already exists')) {
      console.error('   ℹ️  User with this email already exists');
    } else if (createError.message.includes('Rate limit')) {
      console.error('   ⏰ Rate limit reached - try again later');
    } else if (createError.message.includes('Invalid email')) {
      console.error('   📧 Email format is invalid');
    } else if (createError.message.includes('Password')) {
      console.error('   🔐 Password requirements not met');
    }
    
    return { 
      success: false, 
      message: 'Account creation failed entirely',
      error: createError.message
    };
  }
}

async function testWithExistingUser() {
  console.log('\n2️⃣  Testing with existing user for comparison...');
  
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  
  try {
    console.log('   Testing login with jdoe@gmail.com...');
    const session = await account.createEmailPasswordSession('jdoe@gmail.com', 'Windows8TheBest@1234!!');
    
    console.log('✅ Existing user login successful');
    console.log(`   Session ID: ${session.$id}`);
    
    try {
      const user = await account.get();
      console.log('🎉 Existing user account access working!');
      await account.deleteSession('current');
      return { success: true };
    } catch (accountError) {
      console.error('❌ Existing user also has account access issue:', accountError.message);
      await account.deleteSession('current');
      return { success: false, sameIssue: true };
    }
    
  } catch (loginError) {
    console.error('❌ Existing user login failed:', loginError.message);
    return { success: false, error: loginError.message };
  }
}

async function main() {
  try {
    console.log(`Testing with project: ${config.projectId}`);
    console.log(`Database: ${config.databaseId}`);
    console.log(`User Collection: ${config.userCollectionId}`);
    
    // Test new account creation
    const newAccountResult = await testAccountCreation();
    
    // Test existing account for comparison
    const existingAccountResult = await testWithExistingUser();
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    console.log('\n🆕 New Account Creation:');
    if (newAccountResult.success) {
      console.log('   ✅ Fully functional - no workaround needed!');
    } else if (newAccountResult.requiresWorkaround) {
      console.log('   ⚠️  Account created but needs workaround for account access');
      console.log('   ✅ This confirms our workaround approach is correct');
    } else {
      console.log('   ❌ Failed entirely:', newAccountResult.message);
      if (newAccountResult.error) {
        console.log(`   Error: ${newAccountResult.error}`);
      }
    }
    
    console.log('\n👤 Existing Account:');
    if (existingAccountResult.success) {
      console.log('   ✅ Working normally');
    } else if (existingAccountResult.sameIssue) {
      console.log('   ⚠️  Has same scope issue as new accounts');
    } else {
      console.log('   ❌ Login failed');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (!newAccountResult.success && !existingAccountResult.success) {
      console.log('   1. Continue using the authentication workaround');
      console.log('   2. Both new and existing users need the workaround');
      console.log('   3. Consider contacting Appwrite support about the scope issue');
    } else if (newAccountResult.success && existingAccountResult.success) {
      console.log('   🎉 The scope issue appears to be resolved!');
      console.log('   1. You can remove the authentication workaround');
      console.log('   2. Normal Appwrite authentication should work');
    } else {
      console.log('   1. Mixed results - investigate further');
      console.log('   2. Keep the workaround for safety');
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error during testing:', error);
  }
}

main().catch(console.error);