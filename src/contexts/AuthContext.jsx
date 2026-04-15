import { createContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email_verified', true)
        .limit(1);

      if (data && data.length > 0) {
        setUser(data[0]);
        setUserRole(data[0].role);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
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