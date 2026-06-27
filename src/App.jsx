import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SignUp from './components/SignUp';
import Login from './components/Login';
import EmailVerification from './components/EmailVerification';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import SemesterHub from './components/SemesterHub';
import SemesterOptions from './components/SemesterOptions';
import AcademicCalendar from './components/AcademicCalendar';
import RoutineManagement from './components/RoutineManagement';
import ThesisManagement from './components/ThesisManagement';
import ExamRoutine from './components/ExamRoutine';
import InvigilationAssignment from './components/InvigilationAssignment';
import TeacherManagement from './components/TeacherManagement';
import StudentManagement from './components/StudentManagement';
import NotificationCenter from './components/NotificationCenter';
import Unsubscribe from './components/Unsubscribe';
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
              <SemesterHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/routine-management/:semesterId"
          element={
            <ProtectedRoute requiredRole="admin">
              <SemesterOptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/routine-management/:semesterId/routine"
          element={
            <ProtectedRoute requiredRole="admin">
              <RoutineManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/routine-management/:semesterId/academic-calendar"
          element={
            <ProtectedRoute requiredRole="admin">
              <AcademicCalendar />
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
        <Route
          path="/admin-dashboard/teacher-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <TeacherManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/student-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/notification-center"
          element={
            <ProtectedRoute requiredRole="admin">
              <NotificationCenter />
            </ProtectedRoute>
          }
        />

        {/* Public unsubscribe — no auth required */}
        <Route path="/unsubscribe" element={<Unsubscribe />} />

        {/* ── Teacher routes (role = 'teacher' only) ── */}
        <Route
          path="/teacher-dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Student routes (role = 'student' only) ── */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
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
