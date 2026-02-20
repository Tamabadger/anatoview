import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Alert,
  Skeleton,
  alpha,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimerIcon from '@mui/icons-material/Timer';
import ScienceIcon from '@mui/icons-material/Science';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useParams, useNavigate } from 'react-router-dom';
import { useLab } from '@/api/labs';

// ─── Difficulty color helper ─────────────────────────────────

const difficultyColor = (level: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (level) {
    case 'easy':
      return 'success';
    case 'medium':
      return 'warning';
    case 'hard':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Lab preview page — shows lab info and allows starting an attempt.
 * Displayed when navigating to /lab/:id.
 */
export default function LabView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lab, isLoading, error } = useLab(id);

  // ─── Loading State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box
          sx={{
            mb: 4,
            p: 4,
            borderRadius: 3,
            background: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(27, 79, 114, 0.1)'
                : 'rgba(27, 79, 114, 0.03)',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Skeleton variant="rounded" width={64} height={64} sx={{ borderRadius: 3 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="50%" height={40} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="rounded" width={90} height={24} />
                <Skeleton variant="rounded" width={110} height={24} />
                <Skeleton variant="rounded" width={80} height={24} />
              </Box>
            </Box>
          </Box>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rounded" height={200} sx={{ mb: 3, borderRadius: 3 }} />
            <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  // ─── Error State ─────────────────────────────────────────────
  if (error || !lab) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          }
        >
          {error instanceof Error
            ? error.message
            : 'Lab not found. It may have been removed or you don\'t have access.'}
        </Alert>
      </Box>
    );
  }

  // ─── Parse settings ──────────────────────────────────────────
  const settings = lab.settings as Record<string, unknown>;
  const hintPenalty = settings.hintPenalty as number | undefined;
  const timeLimit = settings.timeLimit as number | undefined;
  const dueDate = lab.dueDate ? new Date(lab.dueDate) : null;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* ─── Lab Header ──────────────────────────────────── */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(27, 79, 114, 0.2) 0%, rgba(46, 204, 113, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(27, 79, 114, 0.06) 0%, rgba(46, 204, 113, 0.03) 100%)',
          border: (t) =>
            `1px solid ${t.palette.mode === 'dark' ? 'rgba(93, 173, 226, 0.12)' : 'rgba(27, 79, 114, 0.08)'}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative orb */}
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46, 204, 113, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, position: 'relative' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #1B4F72 0%, #2ECC71 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(27, 79, 114, 0.3)',
              flexShrink: 0,
            }}
          >
            {lab.animal.thumbnailUrl ? (
              <Box
                component="img"
                src={lab.animal.thumbnailUrl}
                alt={lab.animal.commonName}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ScienceIcon sx={{ color: 'white', fontSize: 32 }} />
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
              {lab.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label={lab.labType} size="small" color="primary" />
              {lab.organSystems.map((sys) => (
                <Chip key={sys} label={sys} size="small" variant="outlined" />
              ))}
              <Chip label={`${lab.maxPoints} points`} size="small" variant="outlined" />
            </Box>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* ─── Instructions Card ──────────────────────────── */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MenuBookIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                <Typography variant="h6" fontWeight={700}>
                  Instructions
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                {lab.instructions ||
                  'Identify each labeled anatomical structure in the dissection view. ' +
                    'Type the name of each structure when prompted. You may request hints, ' +
                    'but each hint reduces your score by the penalty amount set by your instructor.'}
              </Typography>

              <Divider sx={{ my: 2.5 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ScienceIcon sx={{ color: 'secondary.main', fontSize: 22 }} />
                <Typography variant="h6" fontWeight={700}>
                  Structures to Identify
                </Typography>
                <Chip
                  label={lab.structures.length}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, ml: 0.5 }}
                />
              </Box>

              {lab.structures.length === 0 ? (
                <Alert severity="warning">
                  No structures have been assigned to this lab yet.
                </Alert>
              ) : (
                <List dense sx={{ mx: -1 }}>
                  {lab.structures.map((ls, i) => (
                    <ListItem
                      key={ls.id}
                      divider={i < lab.structures.length - 1}
                      sx={{
                        borderRadius: 2,
                        mx: 0.5,
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          backgroundColor: (t) => alpha(t.palette.primary.main, 0.03),
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: (t) => alpha(t.palette.primary.main, 0.08),
                                color: 'primary.main',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                flexShrink: 0,
                              }}
                            >
                              {i + 1}
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {ls.structure.name}
                            </Typography>
                            {ls.structure.latinName && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                fontStyle="italic"
                              >
                                ({ls.structure.latinName})
                              </Typography>
                            )}
                            <Chip
                              label={ls.structure.difficultyLevel}
                              size="small"
                              color={difficultyColor(ls.structure.difficultyLevel)}
                              sx={{ ml: 'auto', height: 20, fontSize: '0.675rem', fontWeight: 600 }}
                            />
                          </Box>
                        }
                        secondary={ls.structure.description || undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ─── Sidebar ────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          {/* Start Button Card */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              textAlign: 'center',
              background: (t) =>
                t.palette.mode === 'dark'
                  ? 'linear-gradient(180deg, rgba(27, 79, 114, 0.12) 0%, transparent 100%)'
                  : 'linear-gradient(180deg, rgba(27, 79, 114, 0.04) 0%, transparent 100%)',
              border: (t) =>
                `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            {timeLimit ? (
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #D68910 0%, #F39C12 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5,
                    boxShadow: '0 4px 12px rgba(243, 156, 18, 0.3)',
                  }}
                >
                  <TimerIcon sx={{ color: '#fff', fontSize: 28 }} />
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Time Limit: {timeLimit} min
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #1B4F72 0%, #2E86C1 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5,
                    boxShadow: '0 4px 12px rgba(27, 79, 114, 0.3)',
                  }}
                >
                  <PlayArrowIcon sx={{ color: '#fff', fontSize: 28 }} />
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Ready to Start?
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
              {timeLimit
                ? `You have ${timeLimit} minutes to complete this lab. Your timer will begin when you click Start.`
                : 'Your timer will begin when you click Start. You can save progress and return later.'}
            </Typography>
            <Button
              variant="contained"
              size="large"
              fullWidth
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/lab/${id}/attempt`)}
              sx={{
                py: 1.5,
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: 2.5,
                boxShadow: (t) =>
                  t.palette.mode === 'dark'
                    ? '0 4px 16px rgba(93, 173, 226, 0.3)'
                    : '0 4px 16px rgba(27, 79, 114, 0.25)',
              }}
            >
              Start Lab
            </Button>
          </Paper>

          {/* Lab Details Card */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 3,
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ letterSpacing: '0.04em' }}>
              Lab Details
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Animal</Typography>
                <Typography variant="body2" fontWeight={600}>{lab.animal.commonName}</Typography>
              </Box>
              {lab.animal.scientificName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontStyle="italic"
                  sx={{ textAlign: 'right', mt: -0.5 }}
                >
                  {lab.animal.scientificName}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Structures</Typography>
                <Typography variant="body2" fontWeight={600}>{lab.structures.length}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Max Points</Typography>
                <Typography variant="body2" fontWeight={600}>{lab.maxPoints}</Typography>
              </Box>
              {hintPenalty != null && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Hint Penalty</Typography>
                  <Typography variant="body2" fontWeight={600}>{hintPenalty}%</Typography>
                </Box>
              )}
            </Box>

            {dueDate && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarTodayIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Due:</strong>{' '}
                    {dueDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
