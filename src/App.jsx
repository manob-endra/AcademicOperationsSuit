import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SignUp from './components/SignUp';
import Login from './components/Login';
import EmailVerification from './components/EmailVerification';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './components/AdminDashboard';
import RoutineManagement from './components/RoutineManagement';
import ThesisManagement from './components/ThesisManagement';
import ExamRoutine from './components/ExamRoutine';
import InvigilationAssignment from './components/InvigilationAssignment';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<EmailVerification />} /> {/* Verification code input page */}
        
        {/* Protected Admin Dashboard Route */}
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute requireEmailSuffix="@cse.du.ac.bd">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Module Routes */}
        <Route
          path="/admin-dashboard/routine-management"
          element={
            <ProtectedRoute requireEmailSuffix="@cse.du.ac.bd">
              <RoutineManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin-dashboard/thesis-management"
          element={
            <ProtectedRoute requireEmailSuffix="@cse.du.ac.bd">
              <ThesisManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin-dashboard/exam-routine"
          element={
            <ProtectedRoute requireEmailSuffix="@cse.du.ac.bd">
              <ExamRoutine />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin-dashboard/invigilation-assignment"
          element={
            <ProtectedRoute requireEmailSuffix="@cse.du.ac.bd">
              <InvigilationAssignment />
            </ProtectedRoute>
          }
        />

        <Route path="/dashboard" element={<Navigate to="/admin-dashboard" replace />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;