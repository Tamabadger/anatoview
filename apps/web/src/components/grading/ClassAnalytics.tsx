import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Paper,
  Grid,
  Chip,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BarChartIcon from '@mui/icons-material/BarChart';
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
} from 'recharts';
import { useLabResults, useLabAnalytics } from './useGradingQueries';

interface ClassAnalyticsProps {
  /** Lab ID to show analytics for */
  labId: string | undefined;
}

/**
 * Collapsible analytics panel below the DataGrid.
 * - Score distribution histogram (10-point buckets)
 * - Per-structure accuracy (sorted ascending — hardest first)
 * - Average score trend over time
 * - Hint usage by structure
 */
export default function ClassAnalytics({ labId }: ClassAnalyticsProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useLabResults(labId);
  const { data: analytics, isLoading: analyticsLoading } = useLabAnalytics(labId);

  // ─── Score distribution (10-point buckets) ──────────────────
  const distributionData = useMemo(() => {
    if (!data?.attempts) return [];
    const buckets: Record<string, number> = {};
    for (let i = 0; i <= 90; i += 10) {
      buckets[`${i}-${i + 9}`] = 0;
    }
    buckets['100'] = 0;

    data.attempts
      .filter((a) => a.status === 'graded' && a.percentage !== null)
      .forEach((a) => {
        const pct = Number(a.percentage);
        if (pct === 100) {
          buckets['100']++;
        } else {
          const bucket = Math.floor(pct / 10) * 10;
          const key = `${bucket}-${bucket + 9}`;
          if (key in buckets) buckets[key]++;
        }
      });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [data]);

  // ─── Per-structure accuracy from analytics endpoint ────────
  const structureAccuracy = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    return [...analytics.structureBreakdown]
      .filter((s) => s.totalAttempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [analytics]);

  // ─── Hint usage by structure ──────────────────────────────
  const hintUsageData = useMemo(() => {
    if (!analytics?.structureBreakdown) return [];
    return [...analytics.structureBreakdown]
      .filter((s) => s.totalAttempts > 0)
      .sort((a, b) => b.avgHintsUsed - a.avgHintsUsed);
  }, [analytics]);

  // ─── Score trend over time ──────────────────────────────────
  const trendData = useMemo(() => {
    if (!data?.attempts) return [];

    const gradedAttempts = data.attempts
      .filter((a) => a.status === 'graded' && a.submittedAt && a.percentage !== null)
      .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());

    if (gradedAttempts.length === 0) return [];

    // Group by day and compute rolling average
    const dailyGroups: Record<string, number[]> = {};
    gradedAttempts.forEach((a) => {
      const day = new Date(a.submittedAt!).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!dailyGroups[day]) dailyGroups[day] = [];
      dailyGroups[day].push(Number(a.percentage));
    });

    return Object.entries(dailyGroups).map(([date, scores]) => ({
      date,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      count: scores.length,
    }));
  }, [data]);

  if (!labId) return null;

  const loading = isLoading || analyticsLoading;

  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
      {/* Collapse toggle header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon color="primary" />
          <Typography variant="subtitle2" fontWeight={700}>
            Class Analytics
          </Typography>
          {data?.stats && (
            <Chip
              label={`Avg: ${Math.round(data.stats.average)}%`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {loading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Skeleton variant="rounded" height={250} />
                </Grid>
              ))}
            </Grid>
          ) : !data?.stats ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No graded attempts yet. Analytics will appear once students submit their work.
            </Typography>
          ) : (
            <>
              {/* Summary stats chips */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${data.stats.count} graded`} size="small" variant="outlined" />
                <Chip
                  label={`Avg: ${Math.round(data.stats.average)}%`}
                  size="small"
                  color="primary"
                />
                <Chip
                  label={`Median: ${Math.round(data.stats.median)}%`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Range: ${Math.round(data.stats.min)}% – ${Math.round(data.stats.max)}%`}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Grid container spacing={2}>
                {/* Score Distribution Histogram */}
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                    Score Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={distributionData}>
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
                      <Bar
                        dataKey="count"
                        fill="#1B4F72"
                        radius={[4, 4, 0, 0]}
                        name="Students"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Grid>

                {/* Average Score Trend */}
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                    Average Score Over Time
                  </Typography>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData}>
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
                    <Box
                      sx={{
                        height: 220,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Not enough data for trend chart.
                      </Typography>
                    </Box>
                  )}
                </Grid>

                {/* Per-Structure Accuracy */}
                {structureAccuracy.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                      Structure Accuracy (Hardest First)
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.max(200, structureAccuracy.length * 30)}>
                      <BarChart data={structureAccuracy} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="accuracy"
                          name="Accuracy %"
                          radius={[0, 4, 4, 0]}
                          fill="#E74C3C"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                )}

                {/* Hint Usage by Structure */}
                {hintUsageData.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                      Avg Hints Used by Structure
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.max(200, hintUsageData.length * 30)}>
                      <BarChart data={hintUsageData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="avgHintsUsed"
                          name="Avg Hints"
                          radius={[0, 4, 4, 0]}
                          fill="#F39C12"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
