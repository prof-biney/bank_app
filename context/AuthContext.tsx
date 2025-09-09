import { logger } from '@/utils/logger';
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { User } from "@/constants/index";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      logger.error('CONTEXT', "Error checking auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      // Mock authentication - replace with Supabase auth
      const mockUser: User = {
        id: "1",
        email,
        name: "Andrew Biney",
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("user", JSON.stringify(mockUser));
      setUser(mockUser);
      return true;
    } catch (error) {
      logger.error('CONTEXT', "Sign in error:", error);
      return false;
    }
  };

  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      // Mock authentication - replace with Supabase auth
      const mockUser: User = {
        id: "1",
        email,
        name,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("user", JSON.stringify(mockUser));
      setUser(mockUser);
      return true;
    } catch (error) {
      logger.error('CONTEXT', "Sign up error:", error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      logger.error('CONTEXT', "Sign out error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
