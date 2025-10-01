#!/usr/bin/env -S tsx
/**
 * Debug helper to reproduce sign-in / getCurrentUser issues locally.
 * Usage:
 *   SIGNIN_EMAIL=you@example.com SIGNIN_PASSWORD=secret npx tsx ./scripts/debug-signin.ts
 */
import { signIn, getCurrentUser } from '../lib/firebase';
import { logger } from '../lib/logger';

const email = process.env.SIGNIN_EMAIL || process.env.DEBUG_EMAIL;
const password = process.env.SIGNIN_PASSWORD || process.env.DEBUG_PASSWORD;

if (!email || !password) {
  console.error('Please set SIGNIN_EMAIL and SIGNIN_PASSWORD in the environment');
  process.exit(1);
}

async function run() {
  try {
    logger.info('AUTH', '[debug-signin] Starting sign-in test');
  const session = await signIn(email!, password!);
    console.log('Session:', session);

  const user = await getCurrentUser();
    console.log('User document:', user);
    logger.info('AUTH', '[debug-signin] Completed successfully');
  } catch (err: any) {
    console.error('Sign-in debug failed:', err && (err.stack || err));

    try {
      console.error('Error details:', {
        name: err?.name,
        message: err?.message,
        typeofErr: typeof err,
      });
    } catch {}

    // Print some suspects' types
    try {
      const fb = await import('../lib/firebase');
      console.error('Suspect function types:', {
        signIn: typeof (fb as any).signIn,
        getCurrentUser: typeof (fb as any).getCurrentUser,
        databases_listDocuments: typeof (fb as any).databases?.listDocuments,
        Query_equal: typeof (fb as any).Query?.equal,
      });
    } catch (inner) {
      console.error('Failed to introspect appwrite module:', inner);
    }

    process.exit(2);
  }
}

run();
