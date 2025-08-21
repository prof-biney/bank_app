module.exports = function (api) {
  api.cache(true);

  // Load Appwrite public env from server/.env if EXPO_PUBLIC_* are not set
  try {
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    const envPath = path.resolve(__dirname, 'server/.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      const map = {
        EXPO_PUBLIC_APPWRITE_ENDPOINT: 'APPWRITE_ENDPOINT',
        EXPO_PUBLIC_APPWRITE_PROJECT_ID: 'APPWRITE_PROJECT_ID',
        EXPO_PUBLIC_APPWRITE_PLATFORM: 'APPWRITE_PLATFORM',
        EXPO_PUBLIC_APPWRITE_DATABASE_ID: 'APPWRITE_DATABASE_ID',
        EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID: 'APPWRITE_USER_COLLECTION_ID',
        EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID: 'APPWRITE_TRANSACTIONS_COLLECTION_ID',
        EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID: 'APPWRITE_CARDS_COLLECTION_ID',
        EXPO_PUBLIC_APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID: 'APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID',
      };
      for (const [expoKey, serverKey] of Object.entries(map)) {
        if (!process.env[expoKey] && parsed[serverKey]) {
          process.env[expoKey] = parsed[serverKey];
        }
      }
    }
  } catch (e) {
    // Ignore any dotenv errors in dev
  }

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
