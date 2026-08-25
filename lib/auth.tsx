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
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
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
    // Cookie-based: no token check needed, just call /api/auth/me
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
      // Cookie is set server-side; no localStorage needed
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
      // Cookie is set server-side; no localStorage needed
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
