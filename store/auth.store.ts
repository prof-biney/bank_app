/**
 * Authentication Store Module
 * 
 * This module provides a Zustand store for managing authentication state in the application.
 * It handles user authentication, session management, and provides methods for login, logout,
 * and fetching the authenticated user.
 * 
 * @module store/auth
 */
import { account, getCurrentUser, signIn, signOut } from "@/lib/appwrite";
import { User } from "@/types";
import { create } from "zustand";

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

        if (!user) console.log("No user found");

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
              const { getApiBase } = require('../lib/api');
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
      console.log("fetchAuthenticatedUser error", error);
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
      const session = await signIn(email, password);
      console.log("Session:", session);

      if (session) {
        // If login is successful, fetch the user
        const user = await account.get();

        if (!user) console.log("No user found");

        if (user) {
          set({
            isAuthenticated: true,
            user: user as unknown as User,
          });
          // Obtain and cache Appwrite JWT for server API calls
          try {
            const jwt = await account.createJWT();
            (global as any).__APPWRITE_JWT__ = jwt?.jwt;
            // Seed demo transactions on login (idempotent if transactions exist)
            try {
              const { getApiBase } = require('../lib/api');
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
            (global as any).__APPWRITE_JWT__ = undefined;
          }
        }
      }
    } catch (error: any) {
      // Removed Alert.alert to prevent scheduling updates during render phase
      console.log("Login error:", error);
      set({
        isAuthenticated: false,
        user: null,
      });
      (global as any).__APPWRITE_JWT__ = undefined;
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
      await signOut(); // This invalidates the session on Appwrite
      set({
        isAuthenticated: false,
        user: null,
      });
    } catch (error) {
      console.log("Logout error:", error);
      // Even if logout fails, clear local state
      set({
        isAuthenticated: false,
        user: null,
      });
    } finally {
      (global as any).__APPWRITE_JWT__ = undefined;
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
