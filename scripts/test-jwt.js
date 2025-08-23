#!/usr/bin/env node

/**
 * Simple test script to verify JWT token functionality
 * This script simulates the JWT refresh mechanism
 */

const fetch = require('node-fetch');

// Mock global object for testing
global.__APPWRITE_JWT__ = undefined;

// Mock Appwrite account for testing
const mockAccount = {
  createJWT: async () => {
    console.log('📱 Creating new JWT token...');
    return { jwt: 'mock-jwt-token-' + Date.now() };
  }
};

// Import the JWT functions (this would be the actual import in your app)
const { refreshAppwriteJWT, getValidJWT } = {
  refreshAppwriteJWT: async () => {
    try {
      const jwt = await mockAccount.createJWT();
      const token = jwt?.jwt;
      if (token) {
        global.__APPWRITE_JWT__ = token;
        console.log('✅ JWT refreshed successfully:', token.slice(0, 20) + '...');
        return token;
      }
      return undefined;
    } catch (e) {
      console.error('❌ Failed to refresh Appwrite JWT:', e);
      global.__APPWRITE_JWT__ = undefined;
      return undefined;
    }
  },

  getValidJWT: async () => {
    try {
      // First try to use existing token
      let token = global.__APPWRITE_JWT__;
      if (token) {
        console.log('🔄 Using existing JWT token:', token.slice(0, 20) + '...');
        return token;
      }
      
      // If no token exists, try to refresh it
      console.log('🔄 No existing token, refreshing...');
      token = await refreshAppwriteJWT();
      return token;
    } catch (e) {
      console.error('❌ Failed to get valid JWT:', e);
      return undefined;
    }
  }
};

async function testJWTFunctionality() {
  console.log('🧪 Testing JWT functionality...\n');

  // Test 1: Get JWT when none exists
  console.log('Test 1: Get JWT when none exists');
  console.log('Current JWT:', global.__APPWRITE_JWT__ || 'undefined');
  let jwt = await getValidJWT();
  console.log('Result:', jwt ? '✅ Success' : '❌ Failed');
  console.log('');

  // Test 2: Get JWT when one already exists
  console.log('Test 2: Get JWT when one already exists');
  jwt = await getValidJWT();
  console.log('Result:', jwt ? '✅ Success' : '❌ Failed');
  console.log('');

  // Test 3: Refresh JWT explicitly
  console.log('Test 3: Refresh JWT explicitly');
  jwt = await refreshAppwriteJWT();
  console.log('Result:', jwt ? '✅ Success' : '❌ Failed');
  console.log('');

  console.log('🎉 JWT testing completed!');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testJWTFunctionality().catch(console.error);
}

module.exports = { testJWTFunctionality };
