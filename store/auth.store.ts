import { account, getCurrentUser, signIn, signOut } from "@/lib/appwrite";
import { User } from "@/types";
import { Alert } from "react-native";
import { create } from "zustand";

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  setIsAuthenticated: (value: boolean) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (value: boolean) => void;
  fetchAuthenticatedUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void; // Added logout method
};

const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,

  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setUser: (user) => set({ user }),
  setIsLoading: (value) => set({ isLoading: value }),

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
        }
      } else {
        set({
          isAuthenticated: false,
          user: null,
        });
      }
    } catch (error) {
      console.log("fetchAuthenticatedUser error", error);
      // Set authenticated state to false on error
      set({
        isAuthenticated: false,
        user: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // Add login method
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      // Clear existing session
      await account.deleteSession("current");

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
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
      console.log("Login error:", error);
      set({
        isAuthenticated: false,
        user: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // Add logout method for clearing auth state
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
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
