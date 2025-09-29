#!/usr/bin/env node

/**
 * Test Script - Create New User and Test Authentication
 * This will help determine if the issue is user-specific or system-wide
 */

import { Client, Account, ID } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
};

console.log('🧪 Testing with Fresh User');
console.log('==========================');

// Generate a unique test user
const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';

async function testNewUser() {
  console.log(`\n1️⃣  Creating new test user: ${testEmail}`);
  
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  
  try {
    // Step 1: Create new user
    console.log('   Creating account...');
    const user = await account.create(ID.unique(), testEmail, testPassword, testName);
    
    console.log('✅ User created successfully');
    console.log(`   User ID: ${user.$id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Status: ${user.status ? 'Active' : 'Inactive'}`);
    console.log(`   Email Verified: ${user.emailVerification}`);
    
    // Step 2: Create session (login)
    console.log('\n2️⃣  Testing login with new user...');
    const session = await account.createEmailPasswordSession(testEmail, testPassword);
    
    console.log('✅ Session created successfully');
    console.log(`   Session ID: ${session.$id}`);
    console.log(`   User ID: ${session.userId}`);
    console.log(`   Provider: ${session.provider}`);
    
    // Step 3: Test account.get() - This is where the issue should occur
    console.log('\n3️⃣  Testing account access...');
    try {
      const accountDetails = await account.get();
      console.log('✅ SUCCESS! Account details retrieved (issue is resolved!)');
      console.log(`   User: ${accountDetails.name} (${accountDetails.email})`);
      console.log(`   Email Verified: ${accountDetails.emailVerification}`);
      console.log(`   Status: ${accountDetails.status ? 'Active' : 'Inactive'}`);
      
      // Test JWT creation
      console.log('\n4️⃣  Testing JWT creation...');
      const jwt = await account.createJWT();
      console.log('✅ JWT created successfully');
      console.log(`   JWT: ${jwt.jwt.substring(0, 50)}...`);
      
      return true; // Success!
      
    } catch (accountError) {
      console.error('❌ SAME ISSUE with new user:');
      console.error(`   Error: ${accountError.message}`);
      console.error(`   Code: ${accountError.code}`);
      console.error(`   Type: ${accountError.type}`);
      
      if (accountError.message.includes('missing scopes')) {
        console.error('\n🚨 CONFIRMED: This is a system-wide configuration issue');
        console.error('   The issue affects ALL users, not just jdoe@gmail.com');
        console.error('   The Appwrite project has a fundamental permission misconfiguration');
      }
      
      return false;
    }
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  User already exists, trying with existing user');
      // Try to login with existing user
      try {
        const session = await account.createEmailPasswordSession(testEmail, testPassword);
        const accountDetails = await account.get();
        console.log('✅ Existing user works fine');
        return true;
      } catch (loginError) {
        console.error('❌ Issue persists with existing user:', loginError.message);
        return false;
      }
    } else {
      console.error('❌ Failed to create user:', error.message);
      return false;
    }
  }
}

async function provideSolution(issueExists) {
  if (issueExists) {
    console.log('\n❌ Issue persists with fresh user');
    console.log('\n🔧 ACTION REQUIRED:');
    console.log('   1. This is a project-level configuration issue');
    console.log('   2. Check your Appwrite version - this might be a version-specific bug');
    console.log('   3. Contact Appwrite support or check their GitHub issues');
    console.log('   4. Consider using Appwrite CLI to debug permissions');
  } else {
    console.log('\n✅ Issue resolved with fresh user');
    console.log('\n💡 SOLUTION:');
    console.log('   The problem is specific to existing users');
    console.log('   Consider migrating users or resetting their permissions');
  }
}

// Main execution
async function main() {
  try {
    const issueExists = !(await testNewUser());
    await provideSolution(issueExists);
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
  }
}

main().catch(console.error);