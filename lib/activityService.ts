import { databases, appwriteConfig, AppwriteID as ID, AppwriteQuery as Query } from './appwrite/config';
import { ActivityEvent } from '@/types/activity';
import useAuthStore from '@/store/auth.store';
import { logger } from '@/lib/logger';

function getUserId() {
  const { user } = useAuthStore.getState();
  return (user as any)?.$id || (user as any)?.id;
}

export async function createAppwriteActivityEvent(evt: ActivityEvent): Promise<ActivityEvent> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !accountUpdatesCollectionId) throw new Error('Activity collection not configured');
  // Authentication is handled by Appwrite SDK
  const id = ID.unique();
  const data = { ...evt, userId: getUserId(), createdAt: new Date().toISOString() } as any;

  try {
  await databases.createDocument(databaseId, accountUpdatesCollectionId, id, data);
  // Ensure returned event uses the generated id and does not accidentally
  // include any id field present on the incoming evt object.
  const { id: _maybe, ...rest } = evt as any;
  return { id, ...rest } as ActivityEvent;
  } catch (err) {
    logger.error('ACTIVITY', 'createAppwriteActivityEvent failed', err);
    throw err;
  }
}

export async function queryAppwriteActivityEvents(options: { limit?: number; offset?: number } = {}) {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !accountUpdatesCollectionId) throw new Error('Activity collection not configured');
  const userId = getUserId();
  
  const queries: any[] = [];
  
  // Add user filter if userId exists
  if (userId) {
    queries.push(Query.equal('userId', userId));
  }
  
  // Add limit query
  if (options.limit) {
    queries.push(Query.limit(options.limit));
  }
  
  // Add offset/pagination
  if (options.offset) {
    queries.push(Query.offset(options.offset));
  }
  
  // Add ordering by creation date (newest first)
  queries.push(Query.orderDesc('$createdAt'));

  try {
    const resp = await databases.listDocuments(databaseId, accountUpdatesCollectionId, queries);
    return resp;
  } catch (err) {
    logger.error('ACTIVITY', 'queryAppwriteActivityEvents failed', err);
    throw err;
  }
}
