import { useState, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  Paper,
  IconButton,
  TextField,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import SaveIcon from '@mui/icons-material/Save';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StructureGradeRow from './StructureGradeRow';
import { useAttemptDetail, useGradeOverride, useSyncToCanvas } from './useGradingQueries';

interface AttemptReviewProps {
  /** The attempt ID to review (null = drawer closed) */
  attemptId: string | null;
  /** Close callback */
  onClose: () => void;
}

/** Format seconds into human-readable duration */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/** Format ISO date string */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString();
}

/**
 * Full-height AttemptReview drawer.
 * Shows student info, score summary, per-structure grades with overrides,
 * instructor feedback, and canvas sync actions.
 */
export default function AttemptReview({ attemptId, onClose }: AttemptReviewProps) {
  const { data: attempt, isLoading, error } = useAttemptDetail(attemptId);
  const overrideMutation = useGradeOverride(attemptId);
  const syncMutation = useSyncToCanvas();

  const [feedback, setFeedback] = useState('');
  const [feedbackDirty, setFeedbackDirty] = useState(false);

  // Reset feedback when attempt changes
  const currentFeedback = attempt?.instructorFeedback ?? '';
  if (!feedbackDirty && feedback !== currentFeedback) {
    setFeedback(currentFeedback);
  }

  const handleOverride = useCallback(
    (responseId: string, points: number) => {
      overrideMutation.mutate({
        responseId,
        overridePoints: points,
        feedback: feedbackDirty ? feedback : undefined,
      });
    },
    [overrideMutation, feedback, feedbackDirty]
  );

  const handleSaveChanges = useCallback(() => {
    if (!attempt || attempt.responses.length === 0) return;
    // Save feedback by overriding the first response with its current points
    const firstResp = attempt.responses[0];
    overrideMutation.mutate({
      responseId: firstResp.id,
      overridePoints: Number(firstResp.instructorOverride ?? firstResp.pointsEarned),
      feedback: feedback,
    });
    setFeedbackDirty(false);
  }, [attempt, overrideMutation, feedback]);

  const handleSyncToCanvas = useCallback(() => {
    if (attemptId) {
      syncMutation.mutate(attemptId);
    }
  }, [attemptId, syncMutation]);

  const isOpen = attemptId !== null;

  // Compute score display
  const score = attempt ? Number(attempt.score ?? 0) : 0;
  const maxPoints = attempt ? Number(attempt.lab.maxPoints) : 100;
  const percentage = attempt ? Number(attempt.percentage ?? 0) : 0;
  const isPassing = percentage >= 60;

  const lastSync = attempt?.syncLogs?.[0];

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{ sx: { width: 520, maxWidth: '95vw' } }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ─── Header ───────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Attempt Review
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* ─── Content ──────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {isLoading && (
            <Box>
              <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1 }} />
              ))}
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load attempt details. Please try again.
            </Alert>
          )}

          {attempt && (
            <>
              {/* Student info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon sx={{ color: 'white' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {attempt.student.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {attempt.student.email}
                  </Typography>
                </Box>
                <Chip
                  label={`Attempt #${attempt.attemptNumber}`}
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* Time info */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Submitted: {formatDate(attempt.submittedAt)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Time: {formatDuration(attempt.timeSpentSeconds)}
                </Typography>
                <Chip
                  label={attempt.status}
                  size="small"
                  color={
                    attempt.status === 'graded'
                      ? 'success'
                      : attempt.status === 'submitted'
                        ? 'primary'
                        : 'default'
                  }
                  variant="outlined"
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>

              {/* Score summary */}
              <Paper
                sx={{
                  p: 2.5,
                  mb: 3,
                  bgcolor: isPassing ? 'success.main' : 'error.main',
                  color: 'white',
                  textAlign: 'center',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h3" fontWeight={700}>
                  {attempt.percentage !== null ? `${Math.round(percentage)}%` : 'N/A'}
                </Typography>
                <Typography variant="body2">
                  {score} / {maxPoints} points
                </Typography>
                <Chip
                  label={isPassing ? 'PASSING' : 'FAILING'}
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 700,
                  }}
                />
              </Paper>

              {/* Canvas sync status */}
              {lastSync && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {lastSync.canvasStatus === 'success' ? (
                    <CheckCircleIcon fontSize="small" color="success" />
                  ) : (
                    <ErrorIcon fontSize="small" color="error" />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Canvas sync: {lastSync.canvasStatus ?? 'unknown'} —{' '}
                    {formatDate(lastSync.syncedAt)}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ mb: 2 }} />

              {/* Structure responses */}
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Structure Grades ({attempt.responses.length})
              </Typography>

              {attempt.responses.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No structure responses recorded for this attempt.
                </Alert>
              ) : (
                attempt.responses.map((resp) => (
                  <StructureGradeRow
                    key={resp.id}
                    response={resp}
                    pointsPossible={Math.round(maxPoints / attempt.responses.length) || 1}
                    onOverride={handleOverride}
                    saving={overrideMutation.isPending}
                  />
                ))
              )}

              <Divider sx={{ my: 2 }} />

              {/* Instructor feedback */}
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Instructor Feedback
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Add feedback for the student..."
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  setFeedbackDirty(true);
                }}
                variant="outlined"
                size="small"
                sx={{ mb: 2 }}
              />

              {/* Mutation status */}
              {overrideMutation.isSuccess && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  Grade override saved.
                </Alert>
              )}
              {overrideMutation.isError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  Failed to save override: {(overrideMutation.error as Error).message}
                </Alert>
              )}
              {syncMutation.isSuccess && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  Grade synced to Canvas.
                </Alert>
              )}
              {syncMutation.isError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  Canvas sync failed: {(syncMutation.error as Error).message}
                </Alert>
              )}
            </>
          )}
        </Box>

        {/* ─── Footer Actions ───────────────────────────────── */}
        {attempt && (
          <Box
            sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              startIcon={
                overrideMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />
              }
              onClick={handleSaveChanges}
              disabled={overrideMutation.isPending || !feedbackDirty}
            >
              Save Changes
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={syncMutation.isPending ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleSyncToCanvas}
              disabled={syncMutation.isPending || attempt.status !== 'graded'}
            >
              Sync to Canvas
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
