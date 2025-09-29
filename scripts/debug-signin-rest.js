#!/usr/bin/env node
/*
 Node-only debug script to test Appwrite auth endpoints without importing react-native.
 Usage:
  APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1 \
  APPWRITE_PROJECT_ID=... \
  APPWRITE_DATABASE_ID=... \
  APPWRITE_USER_COLLECTION_ID=... \
  SIGNIN_EMAIL=john@example.com SIGNIN_PASSWORD=secret \
  node ./scripts/debug-signin-rest.js
*/

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const userCollectionId = process.env.APPWRITE_USER_COLLECTION_ID || process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID;
const email = process.env.SIGNIN_EMAIL;
const password = process.env.SIGNIN_PASSWORD;

if (!endpoint || !projectId || !email || !password) {
  console.error('Missing required environment values. Provide APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, SIGNIN_EMAIL, SIGNIN_PASSWORD');
  process.exit(2);
}

const json = (r) => r.text().then(t => {
  try { return JSON.parse(t); } catch { return t; }
});

const headersBase = {
  'X-Appwrite-Project': projectId,
  'Content-Type': 'application/json'
};

async function run() {
  try {
    console.log('Endpoint:', endpoint);

    // 1) Create session
    console.log('\n==> Creating session (POST /account/sessions)');
    const sessionRes = await fetch(`${endpoint.replace(/\/$/, '')}/account/sessions`, {
      method: 'POST',
      headers: headersBase,
      body: JSON.stringify({ email, password })
    });
    const sessionBody = await json(sessionRes);
    console.log('Status:', sessionRes.status);
    console.log('Body:', sessionBody);

    if (!sessionRes.ok) {
      console.error('Session creation failed — check credentials and CORS/project settings');
      process.exit(3);
    }

    // 2) Create JWT
    console.log('\n==> Creating JWT (POST /account/jwt)');
    const jwtRes = await fetch(`${endpoint.replace(/\/$/, '')}/account/jwt`, {
      method: 'POST',
      headers: headersBase,
    });
    const jwtBody = await json(jwtRes);
    console.log('Status:', jwtRes.status);
    console.log('Body:', jwtBody);

    const jwt = jwtBody?.jwt;
    if (!jwt) {
      console.error('JWT not returned; cannot continue');
      process.exit(4);
    }

    // 3) Attempt to fetch account info via /account
    console.log('\n==> Fetching account (GET /account) with JWT');
    const accountRes = await fetch(`${endpoint.replace(/\/$/, '')}/account`, {
      method: 'GET',
      headers: { ...headersBase, 'X-Appwrite-JWT': jwt }
    });
    console.log('Status:', accountRes.status);
    console.log('Body:', await json(accountRes));

    // 4) If database & collection provided attempt to fetch document by account $id
    if (databaseId && userCollectionId && sessionBody?.userId) {
      const userId = sessionBody.userId;
      console.log(`\n==> Fetching user document by id ${userId}`);
      const docRes = await fetch(`${endpoint.replace(/\/$/, '')}/databases/${databaseId}/collections/${userCollectionId}/documents/${userId}`, {
        method: 'GET',
        headers: { ...headersBase, 'X-Appwrite-JWT': jwt }
      });
      console.log('Status:', docRes.status);
      console.log('Body:', await json(docRes));
    } else {
      console.log('\nSkipping document fetch: missing DB/collection or userId');
    }

    console.log('\nDone');
  } catch (err) {
    console.error('Debug script failed:', err && (err.stack || err));
    process.exit(10);
  }
}

run();
