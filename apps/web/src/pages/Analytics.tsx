import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Alert,
  type SelectChangeEvent,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import TimerIcon from '@mui/icons-material/Timer';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import { useLabsList, useLabAnalytics } from '@/components/grading/useGradingQueries';
import { useAppStore } from '@/stores/useAppStore';

// ─── Stat Card ──────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: `${color}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Color helpers ──────────────────────────────────────────────

function accuracyColor(accuracy: number): string {
  if (accuracy >= 85) return '#2ECC71';
  if (accuracy >= 70) return '#F39C12';
  return '#E74C3C';
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Main Component ────────────────────────────────────────────

/**
 * Analytics page — staff-only dashboard with 4 stat cards and 6 charts.
 * Uses the dedicated /labs/:id/analytics endpoint for per-structure data.
 */
export default function Analytics() {
  const course = useAppStore((s) => s.course);
  const [selectedLabId, setSelectedLabId] = useState<string>('');

  const { data: labs, isLoading: labsLoading } = useLabsList(course?.id);
  const { data: analytics, isLoading: analyticsLoading, error } = useLabAnalytics(
    selectedLabId || undefined
  );

  // Auto-select first lab
  const effectiveLabId = selectedLabId || (labs?.[0]?.id ?? '');
  if (!selectedLabId && labs && labs.length > 0) {
    queueMicrotask(() => setSelectedLabId(labs[0].id));
  }

  // ─── Derived chart data ────────────────────────────────────

  const accuracyData = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    return [...analytics.structureBreakdown]
      .filter((s) => s.totalAttempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [analytics]);

  const hintData = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    return [...analytics.structureBreakdown]
      .filter((s) => s.totalAttempts > 0)
      .sort((a, b) => b.avgHintsUsed - a.avgHintsUsed);
  }, [analytics]);

  const timeData = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    return [...analytics.structureBreakdown]
      .filter((s) => s.avgTimeSeconds !== null)
      .sort((a, b) => (b.avgTimeSeconds ?? 0) - (a.avgTimeSeconds ?? 0));
  }, [analytics]);

  const difficultyData = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    const groups: Record<string, { total: number; accuracySum: number }> = {};
    for (const s of analytics.structureBreakdown) {
      if (s.totalAttempts === 0) continue;
      if (!groups[s.difficultyLevel]) {
        groups[s.difficultyLevel] = { total: 0, accuracySum: 0 };
      }
      groups[s.difficultyLevel].total++;
      groups[s.difficultyLevel].accuracySum += s.accuracy;
    }
    const order = ['easy', 'medium', 'hard'];
    return Object.entries(groups)
      .map(([level, g]) => ({
        level: level.charAt(0).toUpperCase() + level.slice(1),
        avgAccuracy: Math.round(g.accuracySum / g.total * 10) / 10,
        count: g.total,
      }))
      .sort((a, b) => {
        const ai = order.indexOf(a.level.toLowerCase());
        const bi = order.indexOf(b.level.toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [analytics]);

  return (
    <Box>
      {/* Page header + lab selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Lab Analytics
        </Typography>

        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Select Lab</InputLabel>
          <Select
            value={effectiveLabId}
            label="Select Lab"
            onChange={(e: SelectChangeEvent) => setSelectedLabId(e.target.value)}
            disabled={labsLoading}
          >
            {labs?.map((lab) => (
              <MenuItem key={lab.id} value={lab.id}>
                {lab.title} ({lab._count.attempts} attempts)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load analytics. Please try again.
        </Alert>
      )}

      {/* No lab selected */}
      {!effectiveLabId && !labsLoading && (
        <Alert severity="info">
          Select a lab above to view analytics.
        </Alert>
      )}

      {/* Loading skeleton */}
      {analyticsLoading && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Grid item xs={6} md={3} key={i}>
                <Skeleton variant="rounded" height={90} />
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} md={6} key={i}>
                <Skeleton variant="rounded" height={280} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Analytics content */}
      {analytics && !analyticsLoading && (
        <>
          {/* ─── Stat Cards ─────────────────────────────────────── */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <StatCard
                label="Total Attempts"
                value={analytics.overview.totalAttempts}
                icon={<PeopleIcon />}
                color="#1B4F72"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                label="Average Score"
                value={`${analytics.overview.averageScore}%`}
                icon={<TrendingUpIcon />}
                color="#2ECC71"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                label="Median Score"
                value={`${analytics.overview.medianScore}%`}
                icon={<EqualizerIcon />}
                color="#8E44AD"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                label="Avg Time"
                value={formatTime(analytics.overview.averageTimeSeconds)}
                icon={<TimerIcon />}
                color="#F39C12"
              />
            </Grid>
          </Grid>

          {/* ─── Charts Grid ────────────────────────────────────── */}
          <Grid container spacing={2}>
            {/* 1. Score Distribution */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Score Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1B4F72" radius={[4, 4, 0, 0]} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* 2. Score Trend */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Average Score Over Time
                  </Typography>
                  {analytics.scoreTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={analytics.scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="average"
                          stroke="#2ECC71"
                          strokeWidth={2}
                          dot={{ fill: '#2ECC71', r: 4 }}
                          name="Avg %"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Not enough data for trend chart.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 3. Per-Structure Accuracy */}
            {accuracyData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Structure Accuracy (Hardest First)
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.max(250, accuracyData.length * 32)}>
                      <BarChart data={accuracyData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, 'Accuracy']}
                        />
                        <Bar dataKey="accuracy" name="Accuracy %" radius={[0, 4, 4, 0]}>
                          {accuracyData.map((entry, index) => (
                            <Cell key={index} fill={accuracyColor(entry.accuracy)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 4. Hint Usage */}
            {hintData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Average Hints Used by Structure
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.max(250, hintData.length * 32)}>
                      <BarChart data={hintData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="avgHintsUsed" name="Avg Hints" radius={[0, 4, 4, 0]} fill="#F39C12" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 5. Time Per Structure */}
            {timeData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Average Time Per Structure (seconds)
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.max(250, timeData.length * 32)}>
                      <BarChart data={timeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number) => [formatTime(value), 'Avg Time']}
                        />
                        <Bar dataKey="avgTimeSeconds" name="Avg Time (s)" radius={[0, 4, 4, 0]} fill="#8E44AD" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 6. Difficulty vs Accuracy */}
            {difficultyData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Accuracy by Difficulty Level
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={difficultyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, 'Avg Accuracy']}
                        />
                        <Bar dataKey="avgAccuracy" name="Avg Accuracy %" radius={[4, 4, 0, 0]}>
                          {difficultyData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={
                                entry.level.toLowerCase() === 'easy'
                                  ? '#2ECC71'
                                  : entry.level.toLowerCase() === 'medium'
                                  ? '#F39C12'
                                  : '#E74C3C'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </>
      )}

      {/* No data state */}
      {analytics && analytics.overview.gradedAttempts === 0 && !analyticsLoading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No graded attempts yet for this lab. Analytics will populate once students submit and are graded.
        </Alert>
      )}
    </Box>
  );
}
