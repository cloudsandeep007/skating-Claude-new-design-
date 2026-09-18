import { createBrowserRouter } from 'react-router-dom'

import { AdminAnnouncementsPage } from '@/features/announcements'
import { AdminAttendancePage, MarkAttendancePage } from '@/features/attendance'
import { ForgotPasswordPage, LoginPage, ProtectedRoute, ResetPasswordPage } from '@/features/auth'
import { AddBatchPage, BatchDetailPage, BatchesListPage, EditBatchPage } from '@/features/batches'
import { AddCoachPage, CoachDetailPage, CoachesListPage, EditCoachPage } from '@/features/coaches'
import { AdminDashboardPage } from '@/features/dashboard'
import { FeeDashboardPage, FeePlansManagePage } from '@/features/fees'
import { ReportsPage } from '@/features/reports'
import {
  AttendanceHistoryPage,
  ChildProfilePage,
  ChildSchedulePage,
  ParentAnnouncementsPage,
  ParentFeesPage,
  ParentHomePage,
  ParentProfilePage,
  ParentProgressPage,
} from '@/features/parent'
import {
  AdminProgressionPage,
  BulkAssessPage,
  CoachStudentSkillsPage,
  LevelsManagePage,
} from '@/features/progression'
import {
  BookingRequestsPage,
  CoachInboxPage,
  CoachTodayPage,
  UpcomingBookingsPage,
  WeekCalendarPage,
} from '@/features/schedule'
import {
  AddStudentPage,
  EditStudentPage,
  StudentDetailPage,
  StudentsListPage,
} from '@/features/students'
import { AdminLayout, CoachLayout, DevLayout, ParentLayout } from '@/app/layouts'

import { ForbiddenPage } from './ForbiddenPage'
import { NotFoundPage } from './NotFoundPage'
import { PlaceholderPage } from './PlaceholderPage'
import { RootRedirect } from './RootRedirect'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <ProtectedRoute allowedRoles={['academy_admin']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'students', element: <StudentsListPage /> },
          { path: 'students/new', element: <AddStudentPage /> },
          { path: 'students/:studentId', element: <StudentDetailPage /> },
          { path: 'students/:studentId/edit', element: <EditStudentPage /> },
          { path: 'coaches', element: <CoachesListPage /> },
          { path: 'coaches/new', element: <AddCoachPage /> },
          { path: 'coaches/:coachId', element: <CoachDetailPage /> },
          { path: 'coaches/:coachId/edit', element: <EditCoachPage /> },
          { path: 'batches', element: <BatchesListPage /> },
          { path: 'batches/new', element: <AddBatchPage /> },
          { path: 'batches/:batchId', element: <BatchDetailPage /> },
          { path: 'batches/:batchId/edit', element: <EditBatchPage /> },
          { path: 'schedule', element: <WeekCalendarPage /> },
          { path: 'schedule/coming-up', element: <UpcomingBookingsPage /> },
          { path: 'schedule/bookings', element: <BookingRequestsPage variant="admin" /> },
          { path: 'attendance', element: <AdminAttendancePage /> },
          { path: 'announcements', element: <AdminAnnouncementsPage /> },
          { path: 'progression', element: <AdminProgressionPage /> },
          { path: 'levels', element: <LevelsManagePage /> },
          { path: 'fees', element: <FeeDashboardPage /> },
          { path: 'fee-plans', element: <FeePlansManagePage /> },
          { path: 'reports', element: <ReportsPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['coach']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/coach',
        element: <CoachLayout />,
        children: [
          { index: true, element: <CoachTodayPage /> },
          { path: 'attendance/:sessionId', element: <MarkAttendancePage /> },
          { path: 'skills/session/:sessionId', element: <BulkAssessPage /> },
          { path: 'skills/:studentId', element: <CoachStudentSkillsPage /> },
          { path: 'inbox', element: <CoachInboxPage /> },
          { path: 'bookings', element: <BookingRequestsPage variant="coach" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['parent']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/parent',
        element: <ParentLayout />,
        children: [
          { index: true, element: <ParentHomePage /> },
          { path: 'child', element: <ChildProfilePage /> },
          { path: 'progress', element: <ParentProgressPage /> },
          { path: 'fees', element: <ParentFeesPage /> },
          { path: 'attendance', element: <AttendanceHistoryPage /> },
          { path: 'schedule', element: <ChildSchedulePage /> },
          { path: 'announcements', element: <ParentAnnouncementsPage /> },
          { path: 'profile', element: <ParentProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['super_admin']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/dev',
        element: <DevLayout />,
        children: [
          { index: true, element: <PlaceholderPage title="Overview" dark /> },
          { path: 'academies', element: <PlaceholderPage title="Academies" dark /> },
          { path: 'errors', element: <PlaceholderPage title="Error log" dark /> },
          { path: 'flags', element: <PlaceholderPage title="Feature flags" dark /> },
          { path: 'audit', element: <PlaceholderPage title="Jobs and audit" dark /> },
        ],
      },
    ],
  },
  { path: '/403', element: <ForbiddenPage />, errorElement: <RouteErrorBoundary /> },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteErrorBoundary /> },
])
