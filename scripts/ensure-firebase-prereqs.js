#!/usr/bin/env node
const env = (keys, def) => {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return def;
};

const needed = {
  apiKey: env(['EXPO_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY']),
  authDomain: env(['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN']),
  projectId: env(['EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID']),
  storageBucket: env(['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET']),
  messagingSenderId: env(['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID']),
  appId: env(['EXPO_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID']),
};

const missing = Object.entries(needed).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Missing Firebase environment variables:', missing.join(', '));
  console.log('\nWhere to find them:');
  console.log('1) Go to Firebase Console (https://console.firebase.google.com/)');
  console.log('2) Select your project -> Project settings (gear) -> General');
  console.log('3) Under "Your apps" select the app (or register a new one) to view the SDK config values: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId');
  console.log('\nCopy those values into your .env as EXPO_PUBLIC_FIREBASE_* or FIREBASE_* variables.');
  process.exit(2);
}

console.log('All required Firebase env vars are set.');
process.exit(0);
