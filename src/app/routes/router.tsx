import { createBrowserRouter } from 'react-router-dom'

import { AdminAnnouncementsPage } from '@/features/announcements'
import { AdminAttendancePage, MarkAttendancePage } from '@/features/attendance'
import { ForgotPasswordPage, LoginPage, ProtectedRoute, ResetPasswordPage } from '@/features/auth'
import { AddBatchPage, BatchDetailPage, BatchesListPage, EditBatchPage } from '@/features/batches'
import { AddCoachPage, CoachDetailPage, CoachesListPage, EditCoachPage } from '@/features/coaches'
import {
  AttendanceHistoryPage,
  ChildProfilePage,
  ChildSchedulePage,
  ParentAnnouncementsPage,
  ParentHomePage,
  ParentProfilePage,
} from '@/features/parent'
import { CoachInboxPage, CoachTodayPage, WeekCalendarPage } from '@/features/schedule'
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
          { index: true, element: <PlaceholderPage title="Admin dashboard" /> },
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
          { path: 'attendance', element: <AdminAttendancePage /> },
          { path: 'announcements', element: <AdminAnnouncementsPage /> },
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
          { path: 'inbox', element: <CoachInboxPage /> },
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
        children: [{ index: true, element: <PlaceholderPage title="Dev overview" /> }],
      },
    ],
  },
  { path: '/403', element: <ForbiddenPage />, errorElement: <RouteErrorBoundary /> },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteErrorBoundary /> },
])
