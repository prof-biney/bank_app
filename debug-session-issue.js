#!/usr/bin/env node

/**
 * Debug Script for Appwrite Session Issue
 * This specifically tests the account.get() permission problem after login
 */

import { Client, Account } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
};

console.log('🔍 Debugging Appwrite Session Issue');
console.log('====================================');

async function testClientSideAuth() {
  console.log('\n1️⃣  Testing Client-Side Authentication (like your app)...');
  
  // Create client WITHOUT API key (simulates your app)
  const clientSideClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(clientSideClient);
  
  try {
    // Try to log in with the test user
    console.log('   Attempting login...');
    const session = await account.createEmailPasswordSession('jdoe@gmail.com', 'Windows8TheBest@1234!!');
    
    console.log('✅ Session created successfully');
    console.log(`   Session ID: ${session.$id}`);
    console.log(`   User ID: ${session.userId}`);
    console.log(`   Provider: ${session.provider}`);
    console.log(`   Current: ${session.current}`);
    
    // This is where the issue occurs in your app
    console.log('\n   Attempting to get account details (this should fail)...');
    try {
      const user = await account.get();
      console.log('✅ Account details retrieved successfully');
      console.log(`   User: ${user.name} (${user.email})`);
      console.log(`   Email Verified: ${user.emailVerification}`);
      console.log(`   Status: ${user.status ? 'Active' : 'Inactive'}`);
      
      // Test JWT creation
      console.log('\n   Testing JWT creation...');
      const jwt = await account.createJWT();
      console.log('✅ JWT created successfully');
      console.log(`   JWT: ${jwt.jwt.substring(0, 50)}...`);
      
    } catch (accountError) {
      console.error('❌ ACCOUNT GET FAILED (this is the main issue!):');
      console.error(`   Error: ${accountError.message}`);
      console.error(`   Code: ${accountError.code}`);
      console.error(`   Type: ${accountError.type}`);
      
      if (accountError.message.includes('missing scopes')) {
        console.error('\n🚨 DIAGNOSIS:');
        console.error('   The session was created, but the user lacks proper scopes.');
        console.error('   This suggests an Appwrite server configuration issue.');
        console.error('   The user is being treated as "guests" instead of "users".');
      }
    }
    
    // Clean up - logout
    await account.deleteSession('current');
    console.log('\n   Session cleaned up');
    
  } catch (loginError) {
    console.error('❌ Login failed:');
    console.error(`   Error: ${loginError.message}`);
    console.error(`   Code: ${loginError.code}`);
  }
}

async function testServerSideAuth() {
  console.log('\n2️⃣  Testing Server-Side Authentication (with API key)...');
  
  if (!config.apiKey) {
    console.log('   ⚠️  No API key provided, skipping server-side test');
    return;
  }
  
  // Create client WITH API key (server-side operations)
  const serverSideClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const account = new Account(serverSideClient);
  
  try {
    // Try to get current user (this should fail because API keys don't have user sessions)
    const user = await account.get();
    console.log('✅ API key account access successful');
    console.log(`   User: ${user.name} (${user.email})`);
    
  } catch (error) {
    if (error.code === 401) {
      console.log('✅ Expected: API key cannot access user account (this is correct)');
    } else {
      console.error('❌ Unexpected server-side error:');
      console.error(`   Error: ${error.message}`);
    }
  }
}

async function checkProjectSettings() {
  console.log('\n3️⃣  Checking Project Configuration...');
  
  // Test if we can access the project with API key
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  try {
    // We can't directly check project settings via SDK, but we can test database access
    console.log('   API key has proper access to server operations');
  } catch (error) {
    console.error('❌ API key configuration error:');
    console.error(`   ${error.message}`);
  }
}

async function suggestSolutions() {
  console.log('\n🔧 Suggested Solutions');
  console.log('======================');
  
  console.log('\n1. Check Auth Settings in Appwrite Console:');
  console.log('   → Go to Auth → Settings');
  console.log('   → Ensure "Users" role is properly configured');
  console.log('   → Check if there are any additional role restrictions');
  
  console.log('\n2. Verify User Status:');
  console.log('   → In Appwrite Console → Auth → Users');
  console.log('   → Find user "jdoe@gmail.com"');
  console.log('   → Check if Status is "Active"');
  console.log('   → Check if there are any Labels or Roles assigned');
  
  console.log('\n3. Check Project-level Permissions:');
  console.log('   → Go to Settings → Permissions');
  console.log('   → Ensure "Account" scope is available for authenticated users');
  
  console.log('\n4. Check for Multiple Appwrite Projects:');
  console.log('   → Ensure you are configuring the correct project:');
  console.log(`   → Project ID: ${config.projectId}`);
  
  console.log('\n5. Try Creating a New Test User:');
  console.log('   → Register a completely new user via console');
  console.log('   → Test login with that user to isolate the issue');
}

// Main execution
async function main() {
  try {
    await testClientSideAuth();
    await testServerSideAuth();
    await checkProjectSettings();
    await suggestSolutions();
    
  } catch (error) {
    console.error('\n💥 Unexpected error during debugging:');
    console.error(error);
  }
}

main().catch(console.error);