import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Typography,
  Chip,
  Skeleton,
  Alert,
  Avatar,
  alpha,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { useLabs } from '@/api/labs';

export default function Dashboard() {
  const user = useAppStore((state) => state.user);
  const course = useAppStore((state) => state.course);
  const navigate = useNavigate();
  const isStaff = user && ['instructor', 'ta', 'admin'].includes(user.role);

  const { data, isLoading, error } = useLabs(course?.id);
  const labs = data?.labs ?? [];

  // ─── Computed Stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const publishedCount = labs.filter((l) => l.isPublished).length;
    const totalAttempts = labs.reduce((sum, l) => sum + l._count.attempts, 0);

    return [
      {
        label: 'Active Labs',
        value: isLoading ? '--' : String(publishedCount),
        icon: <ScienceIcon />,
        gradient: 'linear-gradient(135deg, #1B4F72 0%, #2E86C1 100%)',
        bgAlpha: '#1B4F72',
      },
      {
        label: isStaff ? 'Total Attempts' : 'Completed',
        value: isLoading ? '--' : String(totalAttempts),
        icon: isStaff ? <PeopleIcon /> : <AssignmentIcon />,
        gradient: 'linear-gradient(135deg, #27AE60 0%, #2ECC71 100%)',
        bgAlpha: '#27AE60',
      },
      {
        label: isStaff ? 'Pending Grades' : 'Average Score',
        value: '--',
        icon: isStaff ? <AssignmentIcon /> : <TrendingUpIcon />,
        gradient: 'linear-gradient(135deg, #D68910 0%, #F39C12 100%)',
        bgAlpha: '#F39C12',
      },
      {
        label: isStaff ? 'Canvas Synced' : 'In Progress',
        value: '--',
        icon: <TrendingUpIcon />,
        gradient: 'linear-gradient(135deg, #1E8449 0%, #27AE60 100%)',
        bgAlpha: '#1E8449',
      },
    ];
  }, [labs, isLoading, isStaff]);

  return (
    <Box>
      {/* ─── Welcome Banner ─────────────────────────────────── */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(27, 79, 114, 0.25) 0%, rgba(46, 204, 113, 0.12) 100%)'
              : 'linear-gradient(135deg, rgba(27, 79, 114, 0.06) 0%, rgba(46, 204, 113, 0.04) 100%)',
          border: (t) =>
            `1px solid ${t.palette.mode === 'dark' ? 'rgba(93, 173, 226, 0.15)' : 'rgba(27, 79, 114, 0.08)'}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative gradient orb */}
        <Box
          sx={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(27, 79, 114, 0.1) 0%, rgba(46, 204, 113, 0.08) 100%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1,
            letterSpacing: '-0.025em',
          }}
        >
          Welcome back, {user?.name || 'User'}{' '}
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            👋
          </Box>
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 600, lineHeight: 1.7 }}
        >
          {isStaff
            ? 'Manage your anatomy labs, review student progress, and sync grades to Canvas.'
            : 'Continue your anatomy lab assignments and track your progress.'}
        </Typography>
      </Box>

      {/* ─── Stats Row ──────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {stats.map((stat) => (
          <Grid item xs={6} sm={6} md={3} key={stat.label}>
            <Card
              sx={{
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: (t) =>
                    t.palette.mode === 'dark'
                      ? '0 8px 24px rgba(0,0,0,0.4)'
                      : '0 8px 24px rgba(0,0,0,0.08)',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
                <Box
                  sx={{
                    width: 50,
                    height: 50,
                    borderRadius: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: stat.gradient,
                    color: '#fff',
                    boxShadow: `0 4px 12px ${alpha(stat.bgAlpha, 0.3)}`,
                    flexShrink: 0,
                  }}
                >
                  {stat.icon}
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ─── Error State ────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load labs. {error instanceof Error ? error.message : 'Please try again.'}
        </Alert>
      )}

      {/* ─── Labs Section ───────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isStaff ? 'Your Labs' : 'My Assignments'}
        </Typography>
        <Chip
          label={isLoading ? '…' : labs.length}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            height: 24,
          }}
        />
      </Box>

      <Grid container spacing={2.5}>
        {/* Loading Skeletons */}
        {isLoading &&
          [1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={`skeleton-${i}`}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="rounded" width={60} height={24} />
                  </Box>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="40%" />
                  <Box sx={{ mt: 2, display: 'flex', gap: 0.5 }}>
                    <Skeleton variant="rounded" width={80} height={24} />
                    <Skeleton variant="rounded" width={60} height={24} />
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Skeleton variant="rounded" width={80} height={30} />
                </CardActions>
              </Card>
            </Grid>
          ))}

        {/* Empty State */}
        {!isLoading && !error && labs.length === 0 && (
          <Grid item xs={12}>
            <Card
              sx={{
                textAlign: 'center',
                py: 8,
                background: (t) =>
                  t.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, rgba(27, 79, 114, 0.08) 0%, rgba(46, 204, 113, 0.04) 100%)'
                    : 'linear-gradient(135deg, rgba(27, 79, 114, 0.03) 0%, rgba(46, 204, 113, 0.02) 100%)',
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: 4,
                  background: (t) =>
                    alpha(t.palette.primary.main, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <ScienceIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              </Box>
              <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                No labs yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
                {isStaff
                  ? 'Create your first anatomy lab to get started.'
                  : 'Your instructor hasn\'t published any labs yet.'}
              </Typography>
            </Card>
          </Grid>
        )}

        {/* Real Lab Cards */}
        {!isLoading &&
          labs.map((lab) => (
            <Grid item xs={12} sm={6} md={4} key={lab.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: (t) =>
                      t.palette.mode === 'dark'
                        ? '0 12px 32px rgba(0,0,0,0.4)'
                        : '0 12px 32px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'flex-start' }}>
                    <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1, fontWeight: 700 }}>
                      {lab.title}
                    </Typography>
                    <Chip
                      label={lab.isPublished ? 'Published' : 'Draft'}
                      size="small"
                      color={lab.isPublished ? 'success' : 'default'}
                      variant={lab.isPublished ? 'filled' : 'outlined'}
                    />
                  </Box>

                  {/* Animal info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Avatar
                      src={lab.animal.thumbnailUrl ?? undefined}
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                        color: 'primary.main',
                      }}
                    >
                      <ScienceIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      {lab.animal.commonName}
                    </Typography>
                  </Box>

                  {/* Organ systems + structure count */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {lab.organSystems.map((sys) => (
                      <Chip key={sys} label={sys} size="small" variant="outlined" />
                    ))}
                    <Chip
                      label={`${lab._count.structures} structures`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  </Box>

                  {/* Points and lab type */}
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {lab.labType} &middot; {lab.maxPoints} pts
                    {lab._count.attempts > 0 && ` · ${lab._count.attempts} attempts`}
                  </Typography>
                </CardContent>

                <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                  {isStaff ? (
                    <>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/labs/${lab.id}/edit`)}
                        sx={{ fontWeight: 600 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<BarChartIcon />}
                        onClick={() => navigate(`/labs/${lab.id}/results`)}
                        disabled={lab._count.attempts === 0}
                        sx={{ fontWeight: 600 }}
                      >
                        Results
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => navigate(`/lab/${lab.id}`)}
                      sx={{ fontWeight: 600 }}
                    >
                      {lab._count.attempts > 0 ? 'Continue' : 'Start Lab'}
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}

        {/* Create New Lab Card (staff only) */}
        {isStaff && !isLoading && (
          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed',
                borderColor: 'divider',
                cursor: 'pointer',
                minHeight: 200,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: (t) => alpha(t.palette.primary.main, 0.04),
                  transform: 'translateY(-3px)',
                },
              }}
              onClick={() => navigate('/labs/new')}
            >
              <Box textAlign="center" sx={{ p: 3 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    background: (t) => alpha(t.palette.primary.main, 0.08),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5,
                  }}
                >
                  <AddIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" fontWeight={600}>
                  Create New Lab
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Build an anatomy lab assignment
                </Typography>
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
