#!/usr/bin/env node

import { Client, Account, Users, Databases } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  userCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
};

console.log('🧪 Testing User Activation Fix');
console.log('===============================');

async function activateUser() {
  console.log('\n1️⃣  Activating user via server API...');
  
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const users = new Users(serverClient);
  
  try {
    const userList = await users.list();
    const targetUser = userList.users.find(u => u.email === 'jdoe@gmail.com');
    
    if (!targetUser) {
      console.log('❌ User not found');
      return false;
    }
    
    console.log(`✅ Found user: ${targetUser.email}`);
    console.log(`   Status: ${targetUser.status}`);
    console.log(`   Email Verified: ${targetUser.emailVerification}`);
    
    // Update user status and labels
    await users.updateStatus(targetUser.$id, true);
    await users.updateLabels(targetUser.$id, ['user', 'authenticated', 'active']);
    await users.updatePrefs(targetUser.$id, {
      isActive: true,
      role: 'user',
      activatedAt: new Date().toISOString()
    });
    
    console.log('✅ User activated successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Activation failed:', error.message);
    return false;
  }
}

async function testAuth() {
  console.log('\n2️⃣  Testing authentication...');
  
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  
  try {
    const session = await account.createEmailPasswordSession('jdoe@gmail.com', 'Windows8TheBest@1234!!');
    console.log('✅ Session created');
    
    try {
      const user = await account.get();
      console.log('🎉 SUCCESS! Account access working!');
      console.log(`   User: ${user.name} (${user.email})`);
      
      await account.deleteSession('current');
      return true;
      
    } catch (accountError) {
      console.error('❌ Account access failed:', accountError.message);
      await account.deleteSession('current');
      return false;
    }
    
  } catch (loginError) {
    console.error('❌ Login failed:', loginError.message);
    return false;
  }
}

async function main() {
  const activated = await activateUser();
  
  if (activated) {
    console.log('\n⏳ Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const authWorked = await testAuth();
    
    if (authWorked) {
      console.log('\n🎉 SUCCESS: User activation fixed the issue!');
    } else {
      console.log('\n❌ Activation did not resolve the scope issue');
    }
  }
}

main().catch(console.error);