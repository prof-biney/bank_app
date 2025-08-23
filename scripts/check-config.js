#!/usr/bin/env node

/**
 * Configuration checker for BankApp
 * Checks environment variables and API connectivity
 */

require('dotenv').config();

function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...\n');
  
  // Appwrite Configuration
  console.log('📱 Appwrite Configuration:');
  const appwriteVars = [
    'EXPO_PUBLIC_APPWRITE_ENDPOINT',
    'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
    'EXPO_PUBLIC_APPWRITE_PLATFORM', 
    'EXPO_PUBLIC_APPWRITE_DATABASE_ID',
    'EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID'
  ];
  
  appwriteVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Missing'} ${value ? `(${value})` : ''}`);
  });
  
  // API Configuration
  console.log('\n🌐 API Configuration:');
  const apiVars = [
    'EXPO_PUBLIC_AWS_ENDPOINT_URL_S3',
    'AWS_ENDPOINT_URL_S3', 
    'EXPO_PUBLIC_FLY_API_URL',
    'EXPO_PUBLIC_API_BASE_URL'
  ];
  
  let apiUrlFound = false;
  apiVars.forEach(varName => {
    const value = process.env[varName];
    if (value) apiUrlFound = true;
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Missing'} ${value ? `(${value})` : ''}`);
  });
  
  console.log(`\n🎯 API URL Resolution: ${apiUrlFound ? '✅ At least one API URL is configured' : '❌ No API URLs configured'}`);
  
  // Try to resolve the API base
  console.log('\n🔧 API Base Resolution:');
  try {
    const { getApiBase } = require('../lib/api');
    const apiBase = getApiBase();
    console.log(`  ✅ Resolved API Base: ${apiBase}`);
    console.log(`  📍 Cards endpoint would be: ${apiBase}/v1/cards`);
  } catch (error) {
    console.log(`  ❌ Failed to resolve API base: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Recommendations
  console.log('💡 Configuration Recommendations:\n');
  
  if (!apiUrlFound) {
    console.log('🚨 CRITICAL: No API URL configured!');
    console.log('   Please set one of these environment variables:');
    console.log('   - EXPO_PUBLIC_FLY_API_URL=https://your-app.fly.dev');
    console.log('   - EXPO_PUBLIC_API_BASE_URL=https://your-api-server.com');
    console.log('   - AWS_ENDPOINT_URL_S3=https://your-app.fly.dev');
  }
  
  const missingAppwrite = appwriteVars.filter(varName => !process.env[varName]);
  if (missingAppwrite.length > 0) {
    console.log('⚠️  Missing Appwrite configuration:');
    missingAppwrite.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('   These are needed for authentication and database operations.');
  }
  
  if (apiUrlFound && missingAppwrite.length === 0) {
    console.log('🎉 All configuration looks good!');
  }
}

async function testAPIConnectivity() {
  console.log('\n🌐 Testing API Connectivity...\n');
  
  try {
    const { getApiBase } = require('../lib/api');
    const apiBase = getApiBase();
    const healthUrl = `${apiBase}/healthz`;
    
    console.log(`📡 Testing: ${healthUrl}`);
    
    const fetch = require('node-fetch');
    const response = await fetch(healthUrl, {
      method: 'GET',
      timeout: 5000
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`📝 Response: ${text}`);
      console.log('✅ API server is reachable');
    } else {
      console.log('❌ API server returned an error');
    }
    
  } catch (error) {
    console.log(`❌ API connectivity test failed: ${error.message}`);
    console.log('   This could mean:');
    console.log('   - The server is not running');
    console.log('   - The URL is incorrect');
    console.log('   - Network connectivity issues');
  }
}

async function main() {
  console.log('🧪 BankApp Configuration Checker\n');
  
  checkEnvironmentVariables();
  await testAPIConnectivity();
  
  console.log('\n✨ Configuration check completed!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkEnvironmentVariables, testAPIConnectivity };
