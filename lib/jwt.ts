declare const global: any;

export async function ensureAppwriteJWT(getJwt: (() => Promise<string>) | null) {
  try {
    if (global.__APPWRITE_JWT__) return global.__APPWRITE_JWT__ as string;
    if (!getJwt) return undefined;
    const token = await getJwt();
    global.__APPWRITE_JWT__ = token;
    return token;
  } catch {
    return undefined;
  }
}

