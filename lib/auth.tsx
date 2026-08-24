"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearStoredToken,
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setStoredToken,
  signup as apiSignup,
  type User,
} from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (payload: {
    name: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const applyUser = useCallback((nextUser: User | null) => {
    if (nextUser) {
      setUser(nextUser);
      setStatus("authenticated");
    } else {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const checkSession = useCallback((): Promise<User | null> => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("interview-pressure-token")
      : null;

    if (!token) {
      return Promise.resolve(null);
    }

    return fetchCurrentUser().catch(() => null);
  }, []);

  const refreshUser = useCallback(() => {
    let active = true;

    checkSession().then((nextUser) => {
      if (active) {
        applyUser(nextUser);
      }
    });

    return () => {
      active = false;
    };
  }, [applyUser, checkSession]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin({ email, password });
      setStoredToken(result.token);
      applyUser(result.user);
      return result.user;
    },
    [applyUser]
  );

  const signUp = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      confirm_password: string;
    }) => {
      const result = await apiSignup(payload);
      setStoredToken(result.token);
      applyUser(result.user);
      return result.user;
    },
    [applyUser]
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Backend may already be down; clearing the local session is enough.
    }

    clearStoredToken();
    applyUser(null);
    router.push("/");
  }, [applyUser, router]);

  return (
    <AuthContext.Provider
      value={{ status, user, signIn, signUp, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export function useRequireAuth(): { ready: boolean; user: User | null } {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return { ready: status === "authenticated" && user !== null, user };
}
