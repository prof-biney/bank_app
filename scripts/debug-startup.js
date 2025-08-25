#!/usr/bin/env node

/**
 * Debug Startup Script
 * 
 * This script helps diagnose common startup issues with the React Native app.
 * Run: npm run debug-startup or node ./scripts/debug-startup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Bank App Startup Debug Tool\n');

// Check if required files exist
const requiredFiles = [
  'app/_layout.tsx',
  'app/(auth)/_layout.tsx',
  'app/(tabs)/_layout.tsx',
  '.env',
  'package.json',
  'app.json'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. This may cause startup issues.');
} else {
  console.log('\n✅ All required files are present.');
}

// Check environment variables
console.log('\n🌍 Checking environment variables...');

const requiredEnvVars = [
  'EXPO_PUBLIC_APPWRITE_ENDPOINT',
  'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
  'EXPO_PUBLIC_APPWRITE_PLATFORM',
  'EXPO_PUBLIC_APPWRITE_DATABASE_ID',
  'EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID'
];

let allEnvVarsSet = true;

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const isSet = value && value.trim().length > 0;
  console.log(`  ${isSet ? '✅' : '❌'} ${envVar}${isSet ? ` = ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}` : ' (not set)'}`);
  if (!isSet) allEnvVarsSet = false;
});

if (!allEnvVarsSet) {
  console.log('\n❌ Some required environment variables are missing.');
  console.log('💡 Make sure your .env file has all the required EXPO_PUBLIC_APPWRITE_* variables.');
} else {
  console.log('\n✅ All required environment variables are set.');
}

// Check auth layout exports
console.log('\n📋 Checking auth layout export...');
const authLayoutPath = path.join(process.cwd(), 'app/(auth)/_layout.tsx');

try {
  const authLayoutContent = fs.readFileSync(authLayoutPath, 'utf8');
  
  if (authLayoutContent.includes('export default function')) {
    console.log('  ✅ Auth layout has default export');
  } else if (authLayoutContent.includes('export default')) {
    console.log('  ✅ Auth layout has default export (arrow function)');
  } else {
    console.log('  ❌ Auth layout is missing default export');
    console.log('  💡 Make sure your auth/_layout.tsx file exports a default React component');
  }
} catch (error) {
  console.log('  ❌ Could not read auth layout file:', error.message);
}

// Check for common issues
console.log('\n🔧 Checking for common issues...');

// Check if node_modules exists
const nodeModulesExists = fs.existsSync(path.join(process.cwd(), 'node_modules'));
console.log(`  ${nodeModulesExists ? '✅' : '❌'} node_modules directory exists`);

if (!nodeModulesExists) {
  console.log('  💡 Run: npm install or yarn install');
}

// Check if metro cache might be stale
const metroCacheExists = fs.existsSync(path.join(process.cwd(), 'node_modules/.cache'));
if (metroCacheExists) {
  console.log('  ⚠️  Metro cache found - if you\'re having issues, try clearing it');
  console.log('  💡 Run: npx expo start --clear');
}

// Check for TypeScript config
const tsConfigExists = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
console.log(`  ${tsConfigExists ? '✅' : '⚠️'} TypeScript config exists`);

console.log('\n🎯 Quick fixes for common startup errors:');
console.log('');
console.log('1. "useTheme must be used within ThemeProvider"');
console.log('   💡 Fixed by using useSafeTheme hook instead of useTheme');
console.log('');
console.log('2. "authenticatedClient.setKey is not a function"');
console.log('   💡 Fixed - setKey is not available in React Native Appwrite SDK');
console.log('');
console.log('3. "Route missing default export"');
console.log('   💡 Check that all _layout.tsx files export a default React component');
console.log('');
console.log('4. Environment variables not loaded');
console.log('   💡 Make sure .env file exists and has correct EXPO_PUBLIC_ prefixes');
console.log('');
console.log('5. Metro bundler cache issues');
console.log('   💡 Run: npx expo start --clear');

console.log('\n🚀 To start the app with clean cache:');
console.log('   npx expo start --clear');
