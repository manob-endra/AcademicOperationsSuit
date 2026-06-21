import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SignUp from './components/SignUp';
import Login from './components/Login';
import EmailVerification from './components/EmailVerification';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import RoutineManagement from './components/RoutineManagement';
import ThesisManagement from './components/ThesisManagement';
import ExamRoutine from './components/ExamRoutine';
import InvigilationAssignment from './components/InvigilationAssignment';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/verify" element={<EmailVerification />} />

        {/* ── Admin routes (role = 'admin' only) ── */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/routine-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <RoutineManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/thesis-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <ThesisManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/exam-routine"
          element={
            <ProtectedRoute requiredRole="admin">
              <ExamRoutine />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/invigilation-assignment"
          element={
            <ProtectedRoute requiredRole="admin">
              <InvigilationAssignment />
            </ProtectedRoute>
          }
        />

        {/* ── Teacher routes (role = 'teacher' only) ── */}
        <Route
          path="/teacher-dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Convenience redirects */}
        <Route path="/dashboard" element={<Navigate to="/login" replace />} />
        <Route path="/"          element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
