// Centralized API base helper for Fly.io-hosted mock server
// Reads from EXPO_PUBLIC_FLY_API_URL or EXPO_PUBLIC_API_BASE_URL.
// No localhost fallback. Throws if not configured.

export function getApiBase(): string {
  const env: any = process.env || {};
  const base =
    env.EXPO_PUBLIC_AWS_ENDPOINT_URL_S3 ||
    env.AWS_ENDPOINT_URL_S3 ||
    env.EXPO_PUBLIC_FLY_API_URL ||
    env.EXPO_PUBLIC_API_BASE_URL;
  if (!base || typeof base !== 'string' || base.trim().length === 0) {
    throw new Error(
      'Missing AWS_ENDPOINT_URL_S3 (or EXPO_PUBLIC_AWS_ENDPOINT_URL_S3 / EXPO_PUBLIC_FLY_API_URL / EXPO_PUBLIC_API_BASE_URL). Set it to your Fly.io API URL, e.g., https://your-app.fly.dev'
    );
  }
  return base.replace(/\/$/, '');
}

