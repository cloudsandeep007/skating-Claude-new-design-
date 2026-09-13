import { createBrowserRouter } from 'react-router-dom'

import { ForgotPasswordPage, LoginPage, ProtectedRoute, ResetPasswordPage } from '@/features/auth'
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
        children: [{ index: true, element: <PlaceholderPage title="Admin dashboard" /> }],
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
        children: [{ index: true, element: <PlaceholderPage title="Coach home" /> }],
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
        children: [{ index: true, element: <PlaceholderPage title="Parent home" /> }],
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
