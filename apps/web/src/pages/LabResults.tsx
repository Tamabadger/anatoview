import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Skeleton,
  Alert,
  Divider,
  Grid,
  alpha,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TimerIcon from '@mui/icons-material/Timer';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplayIcon from '@mui/icons-material/Replay';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import apiClient from '@/api/client';
import type { AttemptDetail } from '@/components/grading/types';

/**
 * Lab Results page — shows after a student submits a lab attempt.
 * Displays score, per-structure breakdown, and navigation options.
 */
export default function LabResults() {
  const { id: labId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get attemptId from location state (set by DissectionLab after submit)
  // or fall back to fetching the latest attempt
  const attemptIdFromState = (location.state as { attemptId?: string })?.attemptId;

  useEffect(() => {
    if (!labId) return;

    async function fetchAttempt() {
      try {
        setLoading(true);

        let attemptId = attemptIdFromState;

        // If no attemptId in state, fetch the latest attempt for this lab
        if (!attemptId) {
          const attemptResp = await apiClient.get(`/labs/${labId}/attempt`);
          attemptId = attemptResp.data.id;
        }

        const resp = await apiClient.get<AttemptDetail>(`/attempts/${attemptId}`);
        setAttempt(resp.data);
      } catch (err: any) {
        console.error('[LabResults] Failed to load attempt:', err);
        setError('Could not load your results. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchAttempt();
  }, [labId, attemptIdFromState]);

  if (loading) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Skeleton variant="rounded" height={220} sx={{ mb: 3, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (error || !attempt) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Results not found.'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  const pct = attempt.percentage != null ? Number(attempt.percentage) : null;
  const scoreColor =
    pct === null ? 'default' : pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'error';
  const totalCorrect = attempt.responses.filter((r) => r.isCorrect).length;
  const totalStructures = attempt.responses.length;

  function formatTime(seconds: number | null): string {
    if (seconds === null) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const scoreGradient =
    scoreColor === 'success'
      ? 'linear-gradient(135deg, #1E8449 0%, #27AE60 100%)'
      : scoreColor === 'warning'
      ? 'linear-gradient(135deg, #D68910 0%, #F39C12 100%)'
      : 'linear-gradient(135deg, #CB4335 0%, #E74C3C 100%)';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* ─── Score Card ──────────────────────────────────── */}
      <Card
        sx={{
          mb: 3,
          overflow: 'visible',
          position: 'relative',
        }}
      >
        {/* Gradient banner at top */}
        <Box
          sx={{
            height: 6,
            background: scoreGradient,
            borderRadius: '14px 14px 0 0',
          }}
        />
        <CardContent sx={{ textAlign: 'center', py: 4, px: { xs: 2, sm: 4 } }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              background: scoreGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: `0 4px 16px ${
                scoreColor === 'success'
                  ? 'rgba(39, 174, 96, 0.3)'
                  : scoreColor === 'warning'
                  ? 'rgba(243, 156, 18, 0.3)'
                  : 'rgba(231, 76, 60, 0.3)'
              }`,
            }}
          >
            <EmojiEventsIcon sx={{ fontSize: 32, color: '#fff' }} />
          </Box>

          <Typography variant="h4" fontWeight={800} gutterBottom letterSpacing="-0.02em">
            {attempt.lab.title}
          </Typography>

          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Attempt #{attempt.attemptNumber}
            {attempt.submittedAt && ` — ${new Date(attempt.submittedAt).toLocaleString()}`}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3} justifyContent="center">
            <Grid item>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: (t) =>
                    alpha(
                      scoreColor === 'success'
                        ? t.palette.success.main
                        : scoreColor === 'warning'
                        ? t.palette.warning.main
                        : t.palette.error.main,
                      0.08
                    ),
                }}
              >
                <Typography
                  variant="h2"
                  fontWeight={800}
                  color={`${scoreColor}.main`}
                  sx={{ letterSpacing: '-0.02em', lineHeight: 1 }}
                >
                  {pct !== null ? `${Math.round(pct)}%` : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Score
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ p: 2 }}>
                <Typography variant="h2" fontWeight={800} sx={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {attempt.score != null ? Number(attempt.score).toFixed(1) : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  of {Number(attempt.lab.maxPoints)} pts
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ p: 2 }}>
                <Typography variant="h2" fontWeight={800} color="primary.main" sx={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {totalCorrect}/{totalStructures}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Correct
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ p: 2 }}>
                <Typography variant="h2" fontWeight={800} color="text.secondary" sx={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {formatTime(attempt.timeSpentSeconds)}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Time
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {attempt.instructorFeedback && (
            <Alert
              severity="info"
              sx={{
                mt: 3,
                textAlign: 'left',
                borderRadius: 2.5,
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Instructor Feedback
              </Typography>
              <Typography variant="body2">{attempt.instructorFeedback}</Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ─── Structure Breakdown Table ───────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Structure Breakdown
        </Typography>
        <Chip
          label={`${totalCorrect}/${totalStructures} correct`}
          size="small"
          color={scoreColor === 'default' ? undefined : scoreColor}
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Structure</TableCell>
              <TableCell>Your Answer</TableCell>
              <TableCell align="center">Result</TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <LightbulbIcon fontSize="small" />
                  Hints
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <TimerIcon fontSize="small" />
                  Time
                </Box>
              </TableCell>
              <TableCell align="right">Points</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attempt.responses
              .sort((a, b) => a.structure.name.localeCompare(b.structure.name))
              .map((resp) => (
                <TableRow
                  key={resp.id}
                  sx={{
                    backgroundColor: (t) =>
                      resp.isCorrect
                        ? alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.12 : 0.06)
                        : resp.isCorrect === false
                        ? alpha(t.palette.error.main, t.palette.mode === 'dark' ? 0.12 : 0.06)
                        : 'transparent',
                    '&:last-child td': { borderBottom: 0 },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {resp.structure.name}
                    </Typography>
                    {resp.structure.latinName && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {resp.structure.latinName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {resp.studentAnswer || (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
                        No answer
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {resp.isCorrect ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : resp.isCorrect === false ? (
                      <CancelIcon fontSize="small" color="error" />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {resp.hintsUsed > 0 ? (
                      <Chip
                        label={resp.hintsUsed}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontWeight: 700, minWidth: 28 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(resp.timeSpentSeconds)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>
                      {Number(resp.pointsEarned).toFixed(1)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ─── Action Buttons ─────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{ fontWeight: 600 }}
        >
          Back to Dashboard
        </Button>
        <Button
          variant="contained"
          startIcon={<ReplayIcon />}
          onClick={() => navigate(`/lab/${labId}`)}
          sx={{ fontWeight: 600 }}
        >
          View Lab
        </Button>
      </Box>
    </Box>
  );
}
