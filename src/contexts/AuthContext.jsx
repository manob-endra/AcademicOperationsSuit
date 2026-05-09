import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    checkUser();
  }, []);

  const checkUser = async () => {
    // In a real app, you might check if user is stored in localStorage or a session
    // For now, we'll just mark loading as complete
    setLoading(false);
  };

  const logout = async () => {
    setUser(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, userRole, setUserRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};