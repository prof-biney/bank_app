#!/usr/bin/env node

import { Client, Account } from 'node-appwrite';
import 'dotenv/config';

console.log('🌐 Testing Appwrite Connectivity');
console.log('=================================');

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
};

console.log(`Endpoint: ${config.endpoint}`);
console.log(`Project: ${config.projectId}`);

async function testConnectivity() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  
  console.log('\n🔍 Testing basic connectivity...');
  
  try {
    // This should fail with 401 (unauthorized) but confirm connectivity
    await account.get();
    console.log('✅ Unexpected success - user is already logged in');
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('✅ Connectivity OK - Got expected 401 unauthorized');
      console.log('   This means Appwrite server is reachable');
      return true;
    } else if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
      console.log('❌ Network connectivity issue');
      console.log(`   Error: ${error.message}`);
      return false;
    } else {
      console.log('⚠️  Unexpected error:', error.message);
      return false;
    }
  }
}

async function testWithCurl() {
  console.log('\n🔧 Testing with curl equivalent...');
  
  try {
    const response = await fetch(config.endpoint + '/health');
    if (response.ok) {
      console.log('✅ Health endpoint reachable');
      const data = await response.text();
      console.log(`   Response: ${data}`);
    } else {
      console.log(`⚠️  Health endpoint returned: ${response.status}`);
    }
  } catch (fetchError) {
    console.log('❌ Fetch failed:', fetchError.message);
  }
}

async function main() {
  const connectivityOk = await testConnectivity();
  await testWithCurl();
  
  if (connectivityOk) {
    console.log('\n✅ Appwrite is reachable - the earlier "fetch failed" was likely temporary');
    console.log('   You can try the account creation test again');
  } else {
    console.log('\n❌ Connectivity issues detected');
    console.log('   - Check your internet connection');
    console.log('   - Verify the Appwrite endpoint URL');
    console.log('   - Check if Appwrite Cloud is experiencing issues');
  }
}

main().catch(console.error);