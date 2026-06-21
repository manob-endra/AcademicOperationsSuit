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
    // Redirect to the correct portal instead of a dead end
    if (userRole === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (userRole === 'teacher') return <Navigate to="/teacher-dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  if (requireEmailSuffix && !user.email?.toLowerCase().endsWith(requireEmailSuffix.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
