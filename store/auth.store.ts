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
  authService, 
  login as appwriteLogin,
  logout as appwriteLogout,
  register as appwriteRegister,
  getCurrentUser,
  getUserProfile,
  updateUserProfile as updateAppwriteUserProfile,
  updateProfilePicture,
  createJWT,
} from "@/lib/appwrite/auth";
import { User } from "@/types";
import { create } from "zustand";
import { logger } from '@/lib/logger';
import { loginAttemptsService, LoginAttemptResult } from '@/lib/loginAttempts';
import {
  BiometricType,
  BiometricAuthResult,
  checkBiometricAvailability,
  authenticateWithBiometrics,
  setupBiometricAuthentication,
  disableBiometricAuthentication,
  isBiometricEnabled,
  getStoredBiometricType,
  validateBiometricSetup,
  clearAllBiometricData,
  updateLastPasswordLogin,
} from "@/lib/biometric/biometric.service";

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
  
  /** Flag indicating whether biometric authentication is enabled for the current user */
  biometricEnabled: boolean;
  
  /** Type of biometric authentication available and configured */
  biometricType: BiometricType;
  
  /** Timestamp of the last password login for security requirements */
  lastPasswordLogin: Date | null;
  
  /** Current login attempt status and lockout information */
  loginAttempts: LoginAttemptResult | null;
  
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
   * Registers a new user with email, password, and optional name
   * @param email - The user's email address
   * @param password - The user's password
   * @param name - The user's name (optional)
   * @returns A promise that resolves when registration completes
   * @throws Error if registration fails
   */
  register: (email: string, password: string, name?: string) => Promise<void>;
  
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
  
  /**
   * Checks biometric availability and updates state
   * @returns A promise that resolves when the check completes
   */
  checkBiometricAvailability: () => Promise<void>;
  
  /**
   * Sets up biometric authentication for the current user
   * @returns A promise that resolves with the setup result
   */
  setupBiometric: () => Promise<BiometricAuthResult>;
  
  /**
   * Authenticates user with biometrics
   * @returns A promise that resolves with the authentication result
   */
  authenticateWithBiometric: () => Promise<BiometricAuthResult>;
  
  /**
   * Disables biometric authentication for the current user
   * @returns A promise that resolves when biometric auth is disabled
   */
  disableBiometric: () => Promise<void>;
  
  /**
   * Updates biometric state from stored values
   * @returns A promise that resolves when state is updated
   */
  loadBiometricState: () => Promise<void>;
  
  /**
   * Checks and loads current login attempt/lockout status for an email
   * This ensures lockout state persists across app restarts
   * @param email - Email to check lockout status for
   * @returns A promise that resolves when status is loaded
   */
  checkLoginAttemptStatus: (email: string) => Promise<void>;
};

/**
 * Authentication store implementation using Zustand
 * Provides state management for user authentication
 */
const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  isLoading: true,
  biometricEnabled: false,
  biometricType: null,
  lastPasswordLogin: null,
  loginAttempts: null,

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
      // Check if user session is valid
      const isValid = await authService.validateSession();

      if (isValid) {
        const user = await getCurrentUser();
        const userProfile = await getUserProfile();

        if (user && userProfile) {
          set({
            isAuthenticated: true,
            user: {
              $id: user.$id,
              id: user.$id,
              email: user.email,
              name: userProfile.name,
              createdAt: userProfile.createdAt,
              avatar: userProfile.profilePicture?.url,
              avatarFileId: userProfile.profilePicture?.id,
            } as User,
          });

          // Create JWT for server API calls
          try {
            const jwt = await createJWT();
            (global as any).__APPWRITE_JWT__ = jwt?.jwt;
            
            // Seed demo transactions on sign-in (idempotent if transactions exist)
            try {
              const apiMod = await import('@/lib/api');
              const { getApiBase } = apiMod;
              const url = `${getApiBase()}/v1/dev/seed-transactions`;
              if (jwt?.jwt) {
                await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.jwt}` },
                  body: JSON.stringify({ count: 20, skipIfNotEmpty: true })
                }).catch(() => {});
              }
            } catch {}
          } catch {
            // Non-fatal if JWT cannot be created
            (global as any).__APPWRITE_JWT__ = undefined;
          }
        } else {
          set({
            isAuthenticated: false,
            user: null,
          });
          (global as any).__APPWRITE_JWT__ = undefined;
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
   * Registers a new user with email, password, and optional name
   * @param email - User's email address
   * @param password - User's password
   * @param name - User's name (optional)
   * @throws Error if registration fails
   */
  register: async (email: string, password: string, name?: string) => {
    set({ isLoading: true });
    try {
      if (__DEV__) {
        logger.info('AUTH', 'Starting registration process', { email, name });
      }

      // Register with Appwrite
      const authUser = await appwriteRegister({ email, password, name });
      if (__DEV__) logger.info('AUTH', 'User registered', { userId: authUser.$id });

      logger.info('AUTH', 'Registration completed successfully', { userId: authUser.$id });
      
      // Note: User will need to login after registration
      // We don't automatically log them in for security reasons
      
    } catch (error: any) {
      logger.error('AUTH', 'Registration error', error);
      
      // Surface full error to stdout/console for runtime environments
      try {
        console.error('Registration error (raw):', error);
        console.error('Registration error stack (raw):', (error as any)?.stack);
      } catch {}

      // Re-throw the error (Appwrite auth service already formats errors)
      throw error;
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
      }

      // Check login attempts with multiple safety checks to ensure expired lockouts are cleared
      logger.info('AUTH', 'Performing lockout safety checks', { email });
      
      // Step 1: Try to unlock any expired accounts
      const unlockResult = await loginAttemptsService.unlockExpiredAccount(email);
      if (unlockResult) {
        logger.info('AUTH', 'Account was unlocked due to expired lockout', { email });
      }
      
      // Step 2: Check current attempt status
      let attemptStatus = await loginAttemptsService.checkLoginAttempts(email);
      set({ loginAttempts: attemptStatus });
      
      // Step 3: If blocked, perform additional verification
      if (!attemptStatus.canAttempt) {
        logger.info('AUTH', 'Login blocked, performing additional lockout verification', { 
          email, 
          isLocked: attemptStatus.isLocked,
          timeRemaining: attemptStatus.lockoutTimeRemaining 
        });
        
        // Get precise time left
        const timeLeft = await loginAttemptsService.getLockoutTimeLeft(email);
        logger.info('AUTH', 'Precise lockout time check', { email, timeLeftSeconds: timeLeft });
        
        if (timeLeft <= 0) {
          // Lockout has definitely expired, force unlock and re-check
          logger.info('AUTH', 'Forcing account unlock due to expired lockout', { email });
          await loginAttemptsService.forceUnlockAccount(email);
          
          // Re-check status after forced unlock
          attemptStatus = await loginAttemptsService.checkLoginAttempts(email);
          set({ loginAttempts: attemptStatus });
          
          if (!attemptStatus.canAttempt) {
            logger.error('AUTH', 'Account still blocked after forced unlock - this should not happen', { email });
            throw new Error('Login system error. Please contact support.');
          } else {
            logger.info('AUTH', 'Account successfully unlocked and ready for login', { email });
          }
        } else {
          // Still within lockout period
          const timeRemainingFormatted = loginAttemptsService.formatTimeRemaining(attemptStatus.lockoutTimeRemaining || 0);
          logger.info('AUTH', 'Account still locked, showing lockout message', { 
            email, 
            timeRemaining: timeRemainingFormatted 
          });
          
          throw new Error(
            attemptStatus.isLocked 
              ? `Account temporarily locked. Too many failed attempts. Try again in ${timeRemainingFormatted}.`
              : 'Login attempts exceeded. Please try again later.'
          );
        }
      }
      
      logger.info('AUTH', 'Lockout safety checks passed, proceeding with login', { 
        email, 
        remainingAttempts: attemptStatus.remainingAttempts 
      });

      // Login with Appwrite
      const { user: authUser } = await appwriteLogin({ email, password });
      if (__DEV__) logger.info('AUTH', 'User authenticated', { userId: authUser.$id });

      // Get user profile from database
      const userProfile = await getUserProfile(authUser.$id);
      if (__DEV__) logger.info('AUTH', 'User profile retrieved');

      if (!userProfile) {
        logger.warn('AUTH', 'No user profile found, creating fallback profile');
        // Create a minimal user profile from auth user data instead of failing
        const fallbackProfile = {
          name: authUser.name || authUser.email.split('@')[0] || 'User',
          createdAt: new Date().toISOString(),
          profilePicture: null
        };
        
        set({
          isAuthenticated: true,
          user: {
            $id: authUser.$id,
            id: authUser.$id,
            email: authUser.email,
            name: fallbackProfile.name,
            createdAt: fallbackProfile.createdAt,
            avatar: null,
            avatarFileId: null,
          } as User,
          lastPasswordLogin: new Date(),
        });
      } else {
        // Set authenticated state with full profile
        set({
          isAuthenticated: true,
          user: {
            $id: authUser.$id,
            id: authUser.$id,
            email: authUser.email,
            name: userProfile.name,
            createdAt: userProfile.createdAt,
            avatar: userProfile.profilePicture?.url,
            avatarFileId: userProfile.profilePicture?.id,
          } as User,
          lastPasswordLogin: new Date(),
        });
      }
      
      // Update password login timestamp for biometric security
      await updateLastPasswordLogin();
      
      // Load biometric state after successful login
      await get().loadBiometricState();

      // Create JWT for server API calls
      try {
        if (__DEV__) logger.info('AUTH', 'Creating JWT token for server API calls');
        const jwt = await createJWT();
        (global as any).__APPWRITE_JWT__ = jwt?.jwt;
        if (__DEV__) logger.info('AUTH', 'JWT created successfully', { hasJwt: !!jwt?.jwt });

        // seed demo transactions (fire-and-forget)
        try {
          const apiMod = await import('@/lib/api');
          const { getApiBase } = apiMod;
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
        console.error('createJWT failed:', jwtError, (jwtError as any)?.stack);
        logger.error('AUTH', 'JWT creation failed', jwtError);
        (global as any).__APPWRITE_JWT__ = undefined;
        logger.warn('AUTH', 'Continuing without JWT token');
      }

      // Clear login attempts on successful login
      await loginAttemptsService.clearLoginAttempts(email);
      set({ loginAttempts: null });
      
      if (__DEV__) {
        logger.info('AUTH', 'Login completed successfully');
      }
    } catch (error: any) {
      logger.error('AUTH', 'Login error', error);
      
      set({
        isAuthenticated: false,
        user: null,
      });
      (global as any).__APPWRITE_JWT__ = undefined;
      
      // Record failed login attempt (unless it's already a lockout error)
      if (!error.message?.includes('Account temporarily locked')) {
        try {
          const updatedAttemptStatus = await loginAttemptsService.recordFailedAttempt(email);
          set({ loginAttempts: updatedAttemptStatus });
          
          // Update error message to include remaining attempts info
          if (updatedAttemptStatus.isLocked) {
            error.message = `Account temporarily locked due to too many failed attempts. Try again in ${loginAttemptsService.formatTimeRemaining(updatedAttemptStatus.lockoutTimeRemaining || 0)}.`;
          } else if (updatedAttemptStatus.remainingAttempts > 0) {
            const attemptsText = updatedAttemptStatus.remainingAttempts === 1 ? 'attempt' : 'attempts';
            error.message = `${error.message} ${updatedAttemptStatus.remainingAttempts} ${attemptsText} remaining.`;
          }
        } catch (attemptError) {
          logger.error('AUTH', 'Error recording failed login attempt:', attemptError);
        }
      }
      
      // Surface full error to stdout/console for runtime environments
      try {
        console.error('Login error (raw):', error);
        console.error('Login error stack (raw):', (error as any)?.stack);
      } catch {}

      // Re-throw the error (Appwrite auth service already formats errors)
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logs out the current user
   * Invalidates the session on Appwrite and clears local authentication state
   * Will clear local state even if the remote logout fails
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      if (__DEV__) {
        logger.info('AUTH', 'Starting logout process');
      }
      
      // Logout using Appwrite auth service
      await appwriteLogout();
      
      if (__DEV__) {
        logger.info('AUTH', 'Appwrite logout completed, clearing local state');
      }
      
      // Clear all biometric data on logout
      await clearAllBiometricData();
      
      set({
        isAuthenticated: false,
        user: null,
        biometricEnabled: false,
        biometricType: null,
        lastPasswordLogin: null,
      });
      
      if (__DEV__) {
        logger.info('AUTH', 'Logout completed successfully');
      }
    } catch (error) {
      logger.error('AUTH', 'Logout error', error);
      
      // Always clear local state, even on error
      set({
        isAuthenticated: false,
        user: null,
      });
    } finally {
      // Ensure JWT is cleared
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
      // Update profile picture using Appwrite auth service
      const updatedProfile = await updateProfilePicture(imageUri);
      
      // Update local state with new user data
      set({
        user: {
          ...user,
          avatar: updatedProfile.profilePicture?.url,
          avatarFileId: updatedProfile.profilePicture?.id,
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
  
  /**
   * Checks biometric availability and updates state
   */
  checkBiometricAvailability: async () => {
    try {
      const availability = await checkBiometricAvailability();
      
      if (availability.isAvailable) {
        set({
          biometricType: availability.biometricType,
        });
      } else {
        set({
          biometricType: null,
          biometricEnabled: false,
        });
      }
    } catch (error) {
      logger.error('AUTH', 'Error checking biometric availability:', error);
      set({
        biometricType: null,
        biometricEnabled: false,
      });
    }
  },
  
  /**
   * Sets up biometric authentication for the current user
   */
  setupBiometric: async (): Promise<BiometricAuthResult> => {
    const { user } = get();
    
    if (!user) {
      return {
        success: false,
        error: 'No authenticated user found',
      };
    }
    
    try {
      const result = await setupBiometricAuthentication(user.id);
      
      if (result.success) {
        // Update state to reflect biometric setup
        await get().loadBiometricState();
        logger.info('AUTH', 'Biometric authentication set up successfully');
      }
      
      return result;
    } catch (error) {
      logger.error('AUTH', 'Error setting up biometric authentication:', error);
      return {
        success: false,
        error: 'Failed to set up biometric authentication',
      };
    }
  },
  
  /**
   * Authenticates user with biometrics
   */
  authenticateWithBiometric: async (): Promise<BiometricAuthResult> => {
    try {
      // Check if there's already an active session before proceeding
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          logger.info('AUTH', 'User already has active session, biometric auth skipped');
          set({
            isAuthenticated: true,
            user: {
              $id: currentUser.$id,
              id: currentUser.$id,
              email: currentUser.email,
              name: currentUser.name,
              createdAt: currentUser.registration,
              avatar: null,
              avatarFileId: null,
            } as User,
          });
          
          return {
            success: true,
            biometricType: get().biometricType || 'fingerprint',
            token: 'existing_session', // Indicate existing session was used
          };
        }
      } catch (sessionError) {
        logger.info('AUTH', 'No existing session found, proceeding with biometric auth');
      }
      
      const result = await authenticateWithBiometrics();
      
      if (result.success && result.token) {
        // Biometric authentication successful
        // Update authentication state without triggering full login
        const { user } = get();
        if (user) {
          set({
            isAuthenticated: true,
            // Don't update lastPasswordLogin for biometric auth
          });
          
          logger.info('AUTH', 'Biometric authentication successful');
        } else {
          // If no user in state, try to get current user from session
          try {
            const currentUser = await getCurrentUser();
            if (currentUser) {
              set({
                isAuthenticated: true,
                user: {
                  $id: currentUser.$id,
                  id: currentUser.$id,
                  email: currentUser.email,
                  name: currentUser.name,
                  createdAt: currentUser.registration,
                  avatar: null,
                  avatarFileId: null,
                } as User,
              });
            }
          } catch (userError) {
            logger.warn('AUTH', 'Failed to get user after biometric auth', userError);
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error('AUTH', 'Biometric authentication error:', error);
      return {
        success: false,
        error: 'Biometric authentication failed',
      };
    }
  },
  
  /**
   * Disables biometric authentication for the current user
   */
  disableBiometric: async (): Promise<void> => {
    try {
      await disableBiometricAuthentication();
      
      set({
        biometricEnabled: false,
        biometricType: null,
      });
      
      logger.info('AUTH', 'Biometric authentication disabled');
    } catch (error) {
      logger.error('AUTH', 'Error disabling biometric authentication:', error);
      throw error;
    }
  },
  
  /**
   * Loads biometric state from storage
   */
  loadBiometricState: async (): Promise<void> => {
    try {
      const [isEnabled, biometricType] = await Promise.all([
        isBiometricEnabled(),
        getStoredBiometricType(),
      ]);
      
      // Validate that biometric setup is still valid
      const isValid = await validateBiometricSetup();
      
      set({
        biometricEnabled: isEnabled && isValid,
        biometricType: isValid ? biometricType : null,
      });
      
      if (isEnabled && !isValid) {
        logger.warn('AUTH', 'Biometric setup invalid, disabled biometric authentication');
      }
    } catch (error) {
      logger.error('AUTH', 'Error loading biometric state:', error);
      set({
        biometricEnabled: false,
        biometricType: null,
      });
    }
  },
  
  /**
   * Checks and loads current login attempt/lockout status for an email
   * This ensures lockout state persists across app restarts and force-quits
   */
  checkLoginAttemptStatus: async (email: string): Promise<void> => {
    if (!email?.trim()) {
      set({ loginAttempts: null });
      return;
    }
    
    try {
      const status = await loginAttemptsService.getCurrentLockoutStatus(email);
      const attemptResult: LoginAttemptResult = {
        isLocked: status.isLockedOut,
        remainingAttempts: status.remainingAttempts,
        lockoutTimeRemaining: status.timeLeftSeconds * 1000, // Convert to milliseconds
        canAttempt: !status.isLockedOut,
      };
      
      set({ loginAttempts: attemptResult });
      
      if (status.isLockedOut) {
        logger.info('AUTH', 'Loaded lockout status from storage', {
          email,
          timeLeftSeconds: status.timeLeftSeconds,
          attempts: status.attempts,
        });
      }
    } catch (error) {
      logger.error('AUTH', 'Error checking login attempt status:', error);
      // On error, don't block user - set null state
      set({ loginAttempts: null });
    }
  },
}));

export default useAuthStore;
