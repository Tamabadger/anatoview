import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket, getSocket } from '@/api/socket';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
`;

interface LiveIndicatorProps {
  labId: string | undefined;
}

/**
 * Small indicator showing a pulsing green dot + "Live" text when the
 * WebSocket connection is active. Subscribes to real-time grading events
 * and automatically invalidates React Query caches so data stays fresh.
 */
export default function LiveIndicator({ labId }: LiveIndicatorProps) {
  const { isConnected } = useSocket(labId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleAttemptSubmitted() {
      queryClient.invalidateQueries({ queryKey: ['lab-grades'] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['lab-analytics'] });
    }

    function handleGradeUpdated() {
      queryClient.invalidateQueries({ queryKey: ['lab-grades'] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['lab-analytics'] });
    }

    socket.on('attempt:submitted', handleAttemptSubmitted);
    socket.on('grade:updated', handleGradeUpdated);

    return () => {
      socket.off('attempt:submitted', handleAttemptSubmitted);
      socket.off('grade:updated', handleGradeUpdated);
    };
  }, [queryClient, isConnected]);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        ml: 2,
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isConnected ? 'success.main' : 'text.disabled',
          animation: isConnected ? `${pulse} 2s ease-in-out infinite` : 'none',
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: isConnected ? 'success.main' : 'text.disabled',
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontSize: '0.65rem',
        }}
      >
        {isConnected ? 'Live' : 'Offline'}
      </Typography>
    </Box>
  );
}
