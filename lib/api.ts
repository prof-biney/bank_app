// Centralized API configuration for Appwrite cloud functions
// Uses Appwrite Functions instead of external servers like fly.io

import { Functions } from 'appwrite';
import { appwriteConfig, client } from './appwrite/config';

// Get Appwrite Functions client
export function getFunctionsClient(): Functions {
  return new Functions(client);
}

// Execute Appwrite function
export async function executeFunction(functionId: string, data: any = {}) {
  try {
    const functions = getFunctionsClient();
    const execution = await functions.createExecution(
      functionId,
      JSON.stringify(data)
    );
    
    if (execution.statusCode === 200) {
      return {
        success: true,
        data: JSON.parse(execution.responseBody || '{}')
      };
    } else {
      return {
        success: false,
        error: execution.stderr || 'Function execution failed'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Function execution error'
    };
  }
}

// Legacy API base function for backward compatibility
// Now returns Appwrite endpoint
export function getApiBase(): string {
  const env: any = process.env || {};
  return env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace('/v1', '') || 'https://cloud.appwrite.io';
}

