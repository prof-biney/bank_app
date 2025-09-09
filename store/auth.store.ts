/**
 * Authentication Store Module
 * 
 * This module provides a Zustand store for managing authentication state in the application.
 * It handles user authentication, session management, and provides methods for login, logout,
 * and fetching the authenticated user.
 * 
 * @module store/auth
 */
import { 
  account, 
  getCurrentUser, 
  signIn, 
  signOut,
  uploadProfilePicture,
  deleteProfilePicture,
  updateUserProfile 
} from "@/lib/appwrite";
import { User } from "@/types";
import { create } from "zustand";
import { logger } from "@/lib/logger";

/**
 * Authentication State Interface
 * 
 * Defines the shape of the authentication state and available methods.
 */
type AuthState = {
  /** Flag indicating whether a user is currently authenticated */
  isAuthenticated: boolean;
  
  /** The currently authenticated user or null if not authenticated */
  user: User | null;
  
  /** Flag indicating whether authentication operations are in progress */
  isLoading: boolean;
  
  /**
   * Sets the authentication state
   * @param value - The new authentication state
   */
  setIsAuthenticated: (value: boolean) => void;
  
  /**
   * Sets the current user
   * @param user - The user object or null to clear
   */
  setUser: (user: User | null) => void;
  
  /**
   * Sets the loading state
   * @param value - The new loading state
   */
  setIsLoading: (value: boolean) => void;
  
  /**
   * Fetches the currently authenticated user from the server
   * Updates the authentication state and user object accordingly
   * @returns A promise that resolves when the operation completes
   */
  fetchAuthenticatedUser: () => Promise<void>;
  
  /**
   * Authenticates a user with email and password
   * @param email - The user's email address
   * @param password - The user's password
   * @returns A promise that resolves when authentication completes
   * @throws Error if authentication fails
   */
  login: (email: string, password: string) => Promise<void>;
  
  /**
   * Logs out the current user and clears authentication state
   * @returns A promise that resolves when logout completes
   */
  logout: () => void;
  
  /**
   * Updates the user's profile picture
   * @param imageUri - Local URI of the image to upload
   * @returns A promise that resolves when the update completes
   * @throws Error if upload or update fails
   */
  updateProfilePicture: (imageUri: string) => Promise<void>;
};

/**
 * Authentication store implementation using Zustand
 * Provides state management for user authentication
 */
const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  isLoading: true,

  /**
   * Updates the authentication state
   * @param value - New authentication state
   */
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  
  /**
   * Updates the current user
   * @param user - User object or null
   */
  setUser: (user) => set({ user }),
  
  /**
   * Updates the loading state
   * @param value - New loading state
   */
  setIsLoading: (value) => set({ isLoading: value }),

  /**
   * Fetches the currently authenticated user from Appwrite
   * Checks for an active session and updates state accordingly
   */
  fetchAuthenticatedUser: async () => {
    set({ isLoading: true });
    try {
      //  First check if there is an active session
      const session = await account.getSession("current");

      // If there is an active session, fetch the user
      if (session) {
        const user = await getCurrentUser();

        if (!user) logger.warn('AUTH', 'No user found');

        if (user) {
          set({
            isAuthenticated: true,
            user: user as unknown as User,
          });
          // Obtain an Appwrite JWT for server API calls and stash globally
          try {
            const jwt = await account.createJWT();
            (global as any).__APPWRITE_JWT__ = jwt?.jwt;
            // Seed demo transactions on sign-in (idempotent if transactions exist)
            try {
              const { getApiBase } = require('@/lib/api');
              const url = `${getApiBase()}/v1/dev/seed-transactions`;
              if (jwt?.jwt) {
                await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.jwt}` },
                  body: JSON.stringify({ count: 20, skipIfNotEmpty: true })
                }).catch(() => {});
              }
            } catch {}
          } catch (e) {
            // Non-fatal if JWT cannot be created
            (global as any).__APPWRITE_JWT__ = undefined;
          }
        }
      } else {
        set({
          isAuthenticated: false,
          user: null,
        });
        (global as any).__APPWRITE_JWT__ = undefined;
      }
    } catch (error) {
      logger.error('AUTH', 'fetchAuthenticatedUser error', error);
      // Set authenticated state to false on error
      set({
        isAuthenticated: false,
        user: null,
      });
      (global as any).__APPWRITE_JWT__ = undefined;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Authenticates a user with their email and password
   * Updates authentication state and user object on success
   * @param email - User's email address
   * @param password - User's password
   * @throws Error if authentication fails
   */
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      if (__DEV__) {
        logger.info('AUTH', 'Starting login process', { email });
        logger.debug('AUTH', 'SignIn function debug', {
          signInType: typeof signIn,
          signInExists: signIn !== undefined,
          signInFunction: signIn.toString().substring(0, 100)
        });
      }
      
      const session = await signIn(email, password);
      
      if (__DEV__) {
        logger.info('AUTH', 'Session created', { sessionId: session.$id, userId: session.userId });
      }

      if (session) {
        // If login is successful, fetch the user using getCurrentUser which handles the database lookup
        if (__DEV__) {
          logger.info('AUTH', 'Fetching user data from database');
        }
        
        const user = await getCurrentUser();

        if (!user) {
          logger.error('AUTH', 'No user found in database for authenticated session');
          throw new Error('User not found in database. Your account may not be properly configured.');
        }

        if (__DEV__) {
          logger.info('AUTH', 'User data retrieved', { userId: user.$id, email: user.email });
        }
        
        set({
          isAuthenticated: true,
          user: user as unknown as User,
        });
        
        // Obtain and cache Appwrite JWT for server API calls
        try {
          if (__DEV__) {
            logger.info('AUTH', 'Creating JWT token for server API calls');
          }
          
          const jwt = await account.createJWT();
          (global as any).__APPWRITE_JWT__ = jwt?.jwt;
          
          if (__DEV__) {
            logger.info('AUTH', 'JWT created successfully');
          }
          
          // Seed demo transactions on login (idempotent if transactions exist)
          try {
            const { getApiBase } = require('@/lib/api');
            const url = `${getApiBase()}/v1/dev/seed-transactions`;
            if (jwt?.jwt) {
              await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.jwt}` },
                body: JSON.stringify({ count: 20, skipIfNotEmpty: true })
              }).catch(() => {});
            }
          } catch {}
        } catch (jwtError) {
          logger.error('AUTH', 'JWT creation failed', jwtError);
          
          // Check if this is a scope error
          if (jwtError instanceof Error && jwtError.message.includes('missing scope')) {
            logger.error('AUTH', 'Missing scope error detected - this indicates authentication configuration issues');
            logger.error('AUTH', 'Please verify Appwrite project settings and user permissions');
          }
          
          (global as any).__APPWRITE_JWT__ = undefined;
          // Don't throw here - the user is authenticated, just JWT creation failed
          logger.warn('AUTH', 'Continuing without JWT token');
        }
      } else {
        logger.error('AUTH', 'No session returned from signIn');
        throw new Error('Failed to create authentication session');
      }
    } catch (error: any) {
      logger.error('AUTH', 'Login error', error);
      
      // Provide more specific error messages
      let errorMessage = 'Authentication failed';
      if (error.message) {
        if (error.message.includes('Invalid credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'No account found with this email. Please sign up first.';
        } else if (error.message.includes('missing scope')) {
          errorMessage = 'Authentication system error. Please contact support.';
        } else if (error.message.includes('too many requests')) {
          errorMessage = 'Too many login attempts. Please wait before trying again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({
        isAuthenticated: false,
        user: null,
      });
      (global as any).__APPWRITE_JWT__ = undefined;
      
      const enhancedError = new Error(errorMessage);
      enhancedError.stack = error.stack;
      throw enhancedError;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logs out the current user
   * Invalidates the session on Appwrite, expires tokens, and clears local authentication state
   * Will clear local state even if the remote logout fails
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      if (__DEV__) {
        logger.info('AUTH', 'Starting logout with token expiration');
      }
      
      // signOut now handles complete token cleanup including expiration
      await signOut();
      
      if (__DEV__) {
        logger.info('AUTH', 'Appwrite logout completed, clearing local state');
      }
      
      set({
        isAuthenticated: false,
        user: null,
      });
      
      if (__DEV__) {
        logger.info('AUTH', 'Logout completed successfully');
      }
    } catch (error) {
      logger.error('AUTH', 'Logout error', error);
      
      // Even if logout fails, perform emergency cleanup
      try {
        if (__DEV__) {
          logger.info('AUTH', 'Performing emergency token cleanup');
        }
        
        // Import and use token manager for emergency cleanup
        const { expireToken, clearTokenData } = await import('@/lib/tokenManager');
        expireToken();
        clearTokenData();
        
        if (__DEV__) {
          logger.info('AUTH', 'Emergency cleanup completed');
        }
      } catch (cleanupError) {
        logger.error('AUTH', 'Emergency cleanup failed', cleanupError);
        // Force clear the global JWT as last resort
        (global as any).__APPWRITE_JWT__ = undefined;
      }
      
      // Always clear local state, even on error
      set({
        isAuthenticated: false,
        user: null,
      });
    } finally {
      // Ensure JWT is cleared (redundant but safe)
      (global as any).__APPWRITE_JWT__ = undefined;
      set({ isLoading: false });
    }
  },

  /**
   * Updates the user's profile picture
   * Uploads the new image to Appwrite Storage and updates the user document
   * @param imageUri - Local URI of the image to upload
   * @throws Error if upload or update fails
   */
  updateProfilePicture: async (imageUri: string) => {
    const { user } = useAuthStore.getState();
    
    if (!user) {
      throw new Error('No authenticated user found');
    }

    set({ isLoading: true });
    
    try {
      // Delete old profile picture if it exists
      if (user.avatarFileId) {
        try {
          await deleteProfilePicture(user.avatarFileId);
        } catch (error) {
          logger.warn('AUTH', 'Failed to delete old profile picture', error);
          // Don't throw here, continue with upload
        }
      }

      // Upload new profile picture
      const { fileId, fileUrl } = await uploadProfilePicture(imageUri, user.id);
      
      // Update user document with new avatar information
      const updatedUser = await updateUserProfile(user.id, fileUrl, fileId);
      
      // Update local state with new user data
      set({
        user: {
          ...user,
          avatar: fileUrl,
          avatarFileId: fileId,
        } as User,
      });
      
      logger.info('AUTH', 'Profile picture updated successfully');
    } catch (error) {
      logger.error('AUTH', 'Update profile picture error', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
