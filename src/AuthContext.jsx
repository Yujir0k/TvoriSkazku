import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, signIn as apiSignIn, signUp as apiSignUp, signOut as apiSignOut, signOutAll as apiSignOutAll, deleteAccount as apiDeleteAccount, updateAccount as apiUpdateAccount } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Слушаем глобальное событие 'auth:unauthorized' — сбрасываем state и уводим на /sign-in
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      // Если мы не на странице входа — редиректим
      const path = window.location.pathname;
      if (path !== '/sign-in' && path !== '/sign-up') {
        window.location.href = '/sign-in';
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const signIn = async (credentials) => {
    const data = await apiSignIn(credentials);
    setUser(data.user);
    return data.user;
  };

  const signUp = async (credentials) => {
    const data = await apiSignUp(credentials);
    setUser(data.user);
    return data.user;
  };

  const signOut = async () => {
    await apiSignOut();
    setUser(null);
  };

  const signOutAll = async () => {
    await apiSignOutAll();
    setUser(null);
  };

  const deleteAccount = async () => {
    await apiDeleteAccount();
    setUser(null);
  };

  const updateName = async (name) => {
    const data = await apiUpdateAccount({ name });
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signOutAll, deleteAccount, updateName, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthGuard({ children, redirectTo = '/sign-in', navigate }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      if (navigate) {
        navigate(redirectTo);
      } else {
        window.location.href = redirectTo;
      }
    }
  }, [user, loading, redirectTo, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-text-secondary text-sm">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}
