import { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext();

const STORAGE_KEY = 'auth_user';

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUserState(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setUser = useCallback((u) => {
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }, []);

  const userRole = user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, setUser, loading, userRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
