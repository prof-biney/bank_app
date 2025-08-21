import { Context, Next } from 'hono';
import { Client, Account } from 'node-appwrite';

export type AuthedUser = {
  $id: string;
  name?: string;
  email?: string;
};

export async function appwriteAuth(c: Context, next: Next) {
  const auth = c.req.header('authorization') || c.req.header('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'missing_bearer_token' }, 401);
  }
  const token = auth.slice(7).trim();

  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) {
    return c.json({ error: 'server_misconfigured_appwrite' }, 500);
  }

  try {
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(token);
    const account = new Account(client);
    const me = await account.get();
    c.set('user', { $id: me.$id, name: me.name, email: me.email } as AuthedUser);
    await next();
  } catch (e) {
    return c.json({ error: 'invalid_token' }, 401);
  }
}

