import { databases, appwriteConfig, AppwriteID as ID, AppwriteQuery as Query } from './appwrite/config';
import { ActivityEvent } from '@/types/activity';
import useAuthStore from '@/store/auth.store';
import { logger } from '@/lib/logger';

function getUserId() {
  const { user } = useAuthStore.getState();
  return (user as any)?.$id || (user as any)?.id;
}

export async function createAppwriteActivityEvent(evt: ActivityEvent): Promise<ActivityEvent> {
  // Stubbed - account_updates collection removed
  logger.info('ACTIVITY', 'createAppwriteActivityEvent stubbed (account_updates collection removed)');
  
  const id = ID.unique();
  const { id: _maybe, ...rest } = evt as any;
  return { id, ...rest, userId: getUserId(), createdAt: new Date().toISOString() } as ActivityEvent;
}

export async function queryAppwriteActivityEvents(options: { limit?: number; offset?: number } = {}) {
  // Stubbed - account_updates collection removed
  logger.info('ACTIVITY', 'queryAppwriteActivityEvents stubbed (account_updates collection removed)');
  
  // Return empty response
  return {
    documents: [],
    total: 0,
  };
}
