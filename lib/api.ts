// Centralized API base helper for the app's backend (e.g., Fly.io mock server)
// Reads from EXPO_PUBLIC_FLY_API_URL or EXPO_PUBLIC_API_BASE_URL.
// IMPORTANT: Do NOT use S3 endpoints here; those are for storage, not the app API.
// No localhost fallback to avoid accidental prod/dev cross-wiring.

export function getApiBase(): string {
  const env: any = process.env || {};
  const base =
    env.EXPO_PUBLIC_FLY_API_URL ||
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.API_BASE_URL ||
    env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || typeof base !== 'string' || base.trim().length === 0) {
    throw new Error(
      'Missing EXPO_PUBLIC_FLY_API_URL or EXPO_PUBLIC_API_BASE_URL. Set it to your API URL, e.g., https://your-app.fly.dev'
    );
  }
  return base.replace(/\/$/, '');
}

