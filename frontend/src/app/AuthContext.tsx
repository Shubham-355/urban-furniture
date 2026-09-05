import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setToken } from '../lib/api';
import type { AuthUser } from '../lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (loginId: string, password: string) => Promise<AuthUser>;
  signUp: (input: {
    name: string;
    loginId: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isBackOffice: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on a hard refresh.
  useEffect(() => {
    let cancelled = false;
    api
      .get<AuthUser>('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (loginId: string, password: string) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      loginId,
      password,
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/signup', input);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      isAdmin: user?.role === 'ADMIN',
      isBackOffice: user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT',
    }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Where a user lands after signing in. */
export function homeFor(user: AuthUser): string {
  return user.role === 'CONTACT' ? '/portal' : '/dashboard';
}
