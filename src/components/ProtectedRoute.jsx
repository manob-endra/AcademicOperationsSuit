import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

function ProtectedRoute({ children, requiredRole = null, requireEmailSuffix = null }) {
  const { user, loading, userRole } = useContext(AuthContext);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  if (!user || !user.email_verified) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireEmailSuffix && !user.email?.toLowerCase().endsWith(requireEmailSuffix.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
