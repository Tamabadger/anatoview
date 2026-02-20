import { Navigate } from 'react-router-dom';
import { useAppStore, UserRole } from '@/stores/useAppStore';
import { Box, CircularProgress, Typography } from '@mui/material';

interface RoleGuardProps {
  /** Roles allowed to access this route */
  allowedRoles: UserRole[];
  /** The protected content */
  children: React.ReactNode;
}

/**
 * Route-level guard that checks the user's role.
 * Redirects to /unauthorized if the user's role isn't in the allowed list.
 * Shows a loading spinner while the app is fetching user data.
 */
export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const user = useAppStore((state) => state.user);
  const isLoading = useAppStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        gap={2}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
