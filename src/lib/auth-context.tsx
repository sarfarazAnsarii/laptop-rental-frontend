'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function setRoleCookie(role: string) {
  document.cookie = `lr_role=${role};path=/;max-age=86400;samesite=lax`;
}

function clearRoleCookie() {
  document.cookie = 'lr_role=;path=/;max-age=0';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('auth_token');
    if (saved) {
      setToken(saved);
      api.auth.me()
        .then((res: any) => {
          setUser(res.data);
          setRoleCookie(res.data.role);
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          clearRoleCookie();
        })
        .finally(() => setLoading(false));
    } else {
      clearRoleCookie();
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.auth.login(email, password);
    localStorage.setItem('auth_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setRoleCookie(res.data.user.role);
    return res.data.user;
  };

  const logout = () => {
    api.auth.logout().catch(() => {});
    localStorage.removeItem('auth_token');
    clearRoleCookie();
    setToken(null);
    setUser(null);
    window.location.href = '/auth/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
