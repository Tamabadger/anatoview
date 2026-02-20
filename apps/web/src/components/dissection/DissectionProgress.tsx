import { useState, useEffect } from 'react';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDissectionStore } from '@/stores/useDissectionStore';

interface DissectionProgressProps {
  totalStructures: number;
}

/**
 * Top progress bar for the dissection lab.
 * Shows timer (counting up), progress bar, answered/total count, and score.
 */
export default function DissectionProgress({ totalStructures }: DissectionProgressProps) {
  const startTime = useDissectionStore((s) => s.startTime);
  const answeredStructures = useDissectionStore((s) => s.answeredStructures);
  const [elapsed, setElapsed] = useState(0);

  // Tick the timer every second
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const answeredCount = answeredStructures.size;
  const correctCount = Array.from(answeredStructures.values()).filter(
    (a) => a.isCorrect === true
  ).length;
  const progress = totalStructures > 0 ? (answeredCount / totalStructures) * 100 : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        width: '100%',
      }}
    >
      {/* Timer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 80 }}>
        <TimerIcon fontSize="small" color="action" />
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {timeStr}
        </Typography>
      </Box>

      {/* Progress Bar */}
      <Box sx={{ flex: 1, mx: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {answeredCount}/{totalStructures} structures
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 3 }}
          color={progress >= 100 ? 'success' : 'primary'}
        />
      </Box>

      {/* Score Chip */}
      <Chip
        icon={<CheckCircleIcon />}
        label={`${correctCount}/${answeredCount} correct`}
        size="small"
        color={answeredCount > 0 && correctCount === answeredCount ? 'success' : 'default'}
        variant="outlined"
      />
    </Box>
  );
}
