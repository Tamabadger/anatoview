import { Box, Typography, Button, Paper } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SchoolIcon from '@mui/icons-material/School';
import { useSearchParams } from 'react-router-dom';

/**
 * Unauthorized / Error page.
 * Shown when:
 *   - User's role doesn't match the required role for a page
 *   - JWT is expired or invalid
 *   - LTI launch fails
 */
export default function Unauthorized() {
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('error');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1B4F72 0%, #2E86C1 100%)',
        p: 3,
      }}
    >
      <Paper
        sx={{
          maxWidth: 480,
          width: '100%',
          p: 5,
          textAlign: 'center',
          borderRadius: 3,
        }}
        elevation={8}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <LockIcon sx={{ fontSize: 40, color: 'white' }} />
        </Box>

        <Typography variant="h4" gutterBottom fontWeight={700} color="text.primary">
          Access Denied
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {errorMessage
            ? `Authentication error: ${errorMessage}`
            : 'You do not have permission to access this page. Please launch AnatoView from your Canvas LMS to authenticate.'}
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={<SchoolIcon />}
          href={
            typeof window !== 'undefined' &&
            window.location.origin.includes('localhost')
              ? '/'
              : undefined
          }
          sx={{ px: 4, py: 1.5 }}
        >
          Return to Canvas
        </Button>

        <Typography
          variant="caption"
          display="block"
          color="text.secondary"
          sx={{ mt: 4 }}
        >
          If you believe this is an error, contact your instructor or IT department.
        </Typography>
      </Paper>
    </Box>
  );
}
