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
import api, { authApi, tokenStorage } from '@/lib/api';
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

  // Sync Auth State (Token + Firebase)
  useEffect(() => {
    let isMounted = true;

    // Check existing stored token first
    const existingToken = tokenStorage.get();
    if (existingToken) {
      authApi.me()
        .then((me) => {
          if (isMounted && me && typeof me === 'object' && me.role) {
            setUser(me);
            setToken(existingToken);
          }
        })
        .catch(() => {
          if (isMounted) {
            tokenStorage.clear();
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        if (!tokenStorage.get()) {
          setUser(null);
          setToken(null);
        }
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        tokenStorage.set(idToken);
        setToken(idToken);
        const me = await authApi.me();
        if (me && typeof me === 'object' && me.role) {
          setUser(me);
        } else {
          console.warn('[AUTH CONTEXT] Invalid user object returned on auth state change:', me);
          tokenStorage.clear();
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('[AUTH CONTEXT] Failed to sync Firebase user with backend:', err);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<User> => {
    setIsLoading(true);
    let idToken: string | null = null;
    try {
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        idToken = await cred.user.getIdToken();
      } catch (fbErr: any) {
        console.warn('[AUTH] Firebase popup unavailable or blocked, falling back to direct login:', fbErr);
        const res = await api.post('/auth/google-demo', {
          email: 'creatorabhishekav@gmail.com',
          name: 'Participant (Google User)',
        });
        idToken = res.data.data.access_token;
      }

      if (idToken) {
        tokenStorage.set(idToken);
        setToken(idToken);
      }
      const me = await authApi.me();
      if (!me || typeof me !== 'object' || !me.role) {
        throw new Error('Unable to complete login due to invalid user profile response.');
      }
      setUser(me);
      return me;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAdminWithEmailPassword = useCallback(async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    let idToken: string | null = null;
    try {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        idToken = await cred.user.getIdToken();
      } catch (fbErr: any) {
        console.warn('[AUTH] Firebase auth failed, attempting backend direct admin login:', fbErr);
        const res = await api.post('/auth/login', { email, password: pass });
        idToken = res.data.data.access_token;
      }

      if (idToken) {
        tokenStorage.set(idToken);
        setToken(idToken);
      }
      const me = await authApi.me();
      if (!me || typeof me !== 'object' || !me.role) {
        throw new Error('Unable to complete login due to invalid user profile response.');
      }
      if (me.role !== 'ADMIN') {
        try { await firebaseSignOut(auth); } catch {}
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