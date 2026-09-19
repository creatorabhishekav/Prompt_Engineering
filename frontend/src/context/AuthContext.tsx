import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, tokenStorage } from '@/lib/api';
import type { LoginRequest, RegisterRequest, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(tokenStorage.get()));

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    let active = true;
    authApi
      .me()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) {
          tokenStorage.clear();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (payload: LoginRequest): Promise<User> => {
    const res = await authApi.login(payload);
    tokenStorage.set(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterRequest): Promise<User> => {
    const res = await authApi.register(payload);
    tokenStorage.set(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, token, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}