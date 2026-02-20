import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import RoleGuard from '@/components/shared/RoleGuard';

// ─── Pages ───────────────────────────────────────────────────
import Dashboard from '@/pages/Dashboard';
import LabBuilder from '@/pages/LabBuilder';
import LabView from '@/pages/LabView';
import DissectionLab from '@/pages/DissectionLab';
import GradeCenter from '@/pages/GradeCenter';
import Analytics from '@/pages/Analytics';
import SpecimenLibrary from '@/pages/SpecimenLibrary';
import SpecimenManage from '@/pages/SpecimenManage';
import LabResults from '@/pages/LabResults';
import Unauthorized from '@/pages/Unauthorized';

/**
 * Application routes per FRAMEWORK.md Section 8.
 *
 * Route structure:
 *   /                     → Redirect (role-based to /dashboard)
 *   /dashboard            → Instructor Dashboard / Student Dashboard
 *   /labs/new             → Lab Builder Wizard (instructor/admin)
 *   /labs/:id/edit        → Edit Lab (instructor/admin)
 *   /labs/:id/results     → Class Results (staff)
 *   /lab/:id              → Student Lab View (all roles)
 *   /lab/:id/attempt      → Active Dissection (all roles)
 *   /lab/:id/results      → Student Results Review (all roles)
 *   /grade-center         → Grade Center (staff)
 *   /analytics            → Lab Analytics (staff)
 *   /animals              → Specimen Library (all roles)
 *   /unauthorized         → Error / Access Denied
 */
const router = createBrowserRouter([
  // ─── Unauthorized (no shell) ───────────────────────────
  {
    path: '/unauthorized',
    element: <Unauthorized />,
  },

  // ─── Full-screen lab layout (no sidebar) ───────────────
  {
    path: '/lab/:id/attempt',
    element: (
      <RoleGuard allowedRoles={['student', 'instructor', 'ta', 'admin']}>
        <DissectionLab />
      </RoleGuard>
    ),
  },

  // ─── Lab Results (no sidebar) ─────────────────────────
  {
    path: '/lab/:id/results',
    element: (
      <RoleGuard allowedRoles={['student', 'instructor', 'ta', 'admin']}>
        <LabResults />
      </RoleGuard>
    ),
  },

  // ─── Main app shell (with sidebar nav) ─────────────────
  {
    element: <AppShell />,
    children: [
      // Root redirect
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },

      // Dashboard — all authenticated roles
      {
        path: '/dashboard',
        element: (
          <RoleGuard allowedRoles={['instructor', 'student', 'ta', 'admin']}>
            <Dashboard />
          </RoleGuard>
        ),
      },

      // Lab Builder — instructors and admins
      {
        path: '/labs/new',
        element: (
          <RoleGuard allowedRoles={['instructor', 'admin']}>
            <LabBuilder />
          </RoleGuard>
        ),
      },

      // Edit Lab — instructors and admins (reuses LabBuilder)
      {
        path: '/labs/:id/edit',
        element: (
          <RoleGuard allowedRoles={['instructor', 'admin']}>
            <LabBuilder />
          </RoleGuard>
        ),
      },

      // Class Results — staff only
      {
        path: '/labs/:id/results',
        element: (
          <RoleGuard allowedRoles={['instructor', 'ta', 'admin']}>
            <GradeCenter />
          </RoleGuard>
        ),
      },

      // Student Lab View — all roles
      {
        path: '/lab/:id',
        element: (
          <RoleGuard allowedRoles={['student', 'instructor', 'ta', 'admin']}>
            <LabView />
          </RoleGuard>
        ),
      },

      // Grade Center — staff only
      {
        path: '/grade-center',
        element: (
          <RoleGuard allowedRoles={['instructor', 'ta', 'admin']}>
            <GradeCenter />
          </RoleGuard>
        ),
      },

      // Lab Analytics — staff only
      {
        path: '/analytics',
        element: (
          <RoleGuard allowedRoles={['instructor', 'ta', 'admin']}>
            <Analytics />
          </RoleGuard>
        ),
      },

      // Specimen Library — all roles
      {
        path: '/animals',
        element: (
          <RoleGuard allowedRoles={['student', 'instructor', 'ta', 'admin']}>
            <SpecimenLibrary />
          </RoleGuard>
        ),
      },

      // Manage Specimens — instructors and admins
      {
        path: '/animals/manage',
        element: (
          <RoleGuard allowedRoles={['instructor', 'admin']}>
            <SpecimenManage />
          </RoleGuard>
        ),
      },
    ],
  },

  // ─── Catch-all 404 → redirect to unauthorized ─────────
  {
    path: '*',
    element: <Navigate to="/unauthorized" replace />,
  },
]);

export default router;
