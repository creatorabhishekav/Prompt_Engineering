import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { authApi, tokenStorage } from '@/lib/api';
import type { LoginRequest, RegisterRequest, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<User>;
  loginAdminWithEmailPassword: (email: string, pass: string) => Promise<User>;
  login: (payload: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        setUser(null);
        setToken(null);
        tokenStorage.clear();
        setIsLoading(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        tokenStorage.set(idToken);
        setToken(idToken);
        const me = await authApi.me();
        setUser(me);
      } catch (err) {
        console.error('[AUTH CONTEXT] Failed to sync Firebase user with backend:', err);
        tokenStorage.clear();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<User> => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      tokenStorage.set(idToken);
      setToken(idToken);
      const me = await authApi.me();
      setUser(me);
      return me;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAdminWithEmailPassword = useCallback(async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await cred.user.getIdToken();
      tokenStorage.set(idToken);
      setToken(idToken);
      const me = await authApi.me();
      if (me.role !== 'ADMIN') {
        await firebaseSignOut(auth);
        tokenStorage.clear();
        setToken(null);
        setUser(null);
        throw new Error('Access denied. This account does not have administrator privileges.');
      }
      setUser(me);
      return me;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (payload: LoginRequest): Promise<User> => {
    return loginAdminWithEmailPassword(payload.email, payload.password);
  }, [loginAdminWithEmailPassword]);

  const register = useCallback(async (_payload: RegisterRequest): Promise<User> => {
    return loginWithGoogle();
  }, [loginWithGoogle]);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
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
      loginWithGoogle,
      loginAdminWithEmailPassword,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, loginWithGoogle, loginAdminWithEmailPassword, login, register, logout]
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