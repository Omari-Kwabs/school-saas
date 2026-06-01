import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BrandProvider } from './context/BrandContext';
import AppLayout from './components/AppLayout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import OfflineBanner from './components/OfflineBanner';
import { PRIVILEGES } from './utils/access';

// Pages — lazy loaded so each route is a separate chunk
const Login              = lazy(() => import('./pages/Login'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Students           = lazy(() => import('./pages/Students'));
const StudentProfile     = lazy(() => import('./pages/StudentProfile'));
const Results            = lazy(() => import('./pages/Results'));
const Fees               = lazy(() => import('./pages/Fees'));
const Users              = lazy(() => import('./pages/Users'));
const Store              = lazy(() => import('./pages/Store'));
const Classes            = lazy(() => import('./pages/Classes'));
const Assessments        = lazy(() => import('./pages/Assessments'));
const FeeStructures      = lazy(() => import('./pages/FeeStructures'));
const Attendance         = lazy(() => import('./pages/Attendance'));
const Timetable          = lazy(() => import('./pages/Timetable'));
const Announcements      = lazy(() => import('./pages/Announcements'));
const Reports            = lazy(() => import('./pages/Reports'));
const Profile            = lazy(() => import('./pages/Profile'));
const Grades             = lazy(() => import('./pages/Grades'));
const Feeding            = lazy(() => import('./pages/Feeding'));
const Intelligence       = lazy(() => import('./pages/Intelligence'));
const Memos              = lazy(() => import('./pages/Memos'));
const TeacherPerformance = lazy(() => import('./pages/TeacherPerformance'));
const TeacherDashboard   = lazy(() => import('./pages/TeacherDashboard'));
const SchoolCalendar     = lazy(() => import('./pages/SchoolCalendar'));
const Approvals          = lazy(() => import('./pages/Approvals'));
const Terms              = lazy(() => import('./pages/Terms'));
const Archive            = lazy(() => import('./pages/Archive'));
const Expenses           = lazy(() => import('./pages/Expenses'));
const DeletionRequests   = lazy(() => import('./pages/DeletionRequests'));
const Onboarding         = lazy(() => import('./features/onboarding/Onboarding'));
const AdminDashboard     = lazy(() => import('./pages/AdminDashboard'));
const AdminHealth        = lazy(() => import('./pages/AdminHealth'));
const AdminOnboarding    = lazy(() => import('./pages/AdminOnboarding'));
const AdminAlerts        = lazy(() => import('./pages/AdminAlerts'));
const AdminUsage         = lazy(() => import('./pages/AdminUsage'));
const AdminBilling       = lazy(() => import('./pages/AdminBilling'));
const AdminLogs          = lazy(() => import('./pages/AdminLogs'));
const AdminLogin         = lazy(() => import('./pages/AdminLogin'));

function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 200, color: '#94a3b8', fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

const P = PRIVILEGES;

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <OfflineBanner />
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/onboarding" element={<PrivateRoute roles={['owner']}><Onboarding onComplete={() => window.location.href = '/dashboard'} /></PrivateRoute>} />

            {/* Admin console — standalone layout, no school sidebar */}
            <Route path="/admin"            element={<Navigate to="/admin/schools" replace />} />
            <Route path="/admin/schools"    element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/health"     element={<AdminRoute><AdminHealth /></AdminRoute>} />
            <Route path="/admin/onboarding" element={<AdminRoute><AdminOnboarding /></AdminRoute>} />
            <Route path="/admin/alerts"     element={<AdminRoute><AdminAlerts /></AdminRoute>} />
            <Route path="/admin/usage"      element={<AdminRoute><AdminUsage /></AdminRoute>} />
            <Route path="/admin/billing"    element={<AdminRoute><AdminBilling /></AdminRoute>} />
            <Route path="/admin/logs"       element={<AdminRoute><AdminLogs /></AdminRoute>} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Open to all authenticated users */}
              <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/students"      element={<PrivateRoute><Students /></PrivateRoute>} />
              <Route path="/students/:id"  element={<PrivateRoute><StudentProfile /></PrivateRoute>} />
              <Route path="/announcements" element={<PrivateRoute><Announcements /></PrivateRoute>} />
              <Route path="/profile"       element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/memos"         element={<PrivateRoute><Memos /></PrivateRoute>} />
              <Route path="/approvals"     element={<PrivateRoute><Approvals /></PrivateRoute>} />

              {/* Privilege-gated */}
              <Route path="/attendance"    element={<PrivateRoute privilege={P.ATTENDANCE_WRITE}><Attendance /></PrivateRoute>} />
              <Route path="/feeding"       element={<PrivateRoute privilege={P.FEEDING_WRITE}><Feeding /></PrivateRoute>} />
              <Route path="/results"       element={<PrivateRoute privilege={P.ACADEMIC_READ}><Results /></PrivateRoute>} />
              <Route path="/grades"        element={<PrivateRoute privilege={P.ACADEMIC_READ}><Grades /></PrivateRoute>} />
              <Route path="/assessments"   element={<PrivateRoute privilege={P.ACADEMIC_READ}><Assessments /></PrivateRoute>} />
              <Route path="/reports"       element={<PrivateRoute privilege={P.REPORTS_READ}><Reports /></PrivateRoute>} />
              <Route path="/intelligence"  element={<PrivateRoute privilege={P.ACADEMIC_READ}><Intelligence /></PrivateRoute>} />
              <Route path="/timetable"     element={<PrivateRoute privilege={P.TIMETABLE_MANAGE}><Timetable /></PrivateRoute>} />
              <Route path="/classes"       element={<PrivateRoute privilege={P.CLASSES_MANAGE}><Classes /></PrivateRoute>} />
              <Route path="/fees"          element={<PrivateRoute privilege={P.FINANCE_READ}><Fees /></PrivateRoute>} />
              <Route path="/fee-structures" element={<PrivateRoute privilege={P.FINANCE_READ}><FeeStructures /></PrivateRoute>} />
              <Route path="/expenses"      element={<PrivateRoute privilege={P.FINANCE_READ}><Expenses /></PrivateRoute>} />
              <Route path="/users"         element={<PrivateRoute privilege={P.USERS_MANAGE}><Users /></PrivateRoute>} />

              <Route path="/calendar" element={<PrivateRoute><SchoolCalendar /></PrivateRoute>} />

              {/* Role-gated */}
              <Route path="/terms"   element={<PrivateRoute privilege={P.CLASSES_MANAGE}><Terms /></PrivateRoute>} />
              <Route path="/archive" element={<PrivateRoute privilege={P.CLASSES_MANAGE}><Archive /></PrivateRoute>} />

              <Route path="/deletion-requests" element={<PrivateRoute roles={['owner']}><DeletionRequests /></PrivateRoute>} />

              <Route path="/store"               element={<PrivateRoute roles={['owner']}><Store /></PrivateRoute>} />
              <Route path="/teacher-performance" element={<PrivateRoute roles={['owner','headmaster_academics','headmaster_admin']}><TeacherPerformance /></PrivateRoute>} />
              <Route path="/my-dashboard" element={<PrivateRoute roles={['teacher','class_teacher','department_head']}><TeacherDashboard /></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrandProvider>
    </AuthProvider>
  );
}
