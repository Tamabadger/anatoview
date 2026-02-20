import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Skeleton,
  Tooltip,
  type SelectChangeEvent,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowParams,
} from '@mui/x-data-grid';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import SchoolIcon from '@mui/icons-material/School';
import { AttemptReview, ClassAnalytics, LiveIndicator } from '@/components/grading';
import {
  useLabsList,
  useLabGrades,
  useSyncAllToCanvas,
} from '@/components/grading/useGradingQueries';
import type { GradeListItem, CanvasSyncStatus } from '@/components/grading/types';
import { useAppStore } from '@/stores/useAppStore';

// ─── Helpers ─────────────────────────────────────────────────────

/** Return MUI color for a percentage score */
function scoreColor(pct: number | null): 'error' | 'warning' | 'success' | 'default' {
  if (pct === null) return 'default';
  if (pct >= 85) return 'success';
  if (pct >= 70) return 'warning';
  return 'error';
}

/** Render a Canvas sync status icon with tooltip */
function SyncStatusIcon({ status, lastSyncAt }: { status: string; lastSyncAt: string | null }) {
  const tooltip = lastSyncAt
    ? `${status} — ${new Date(lastSyncAt).toLocaleString()}`
    : status;

  switch (status) {
    case 'success':
      return (
        <Tooltip title={tooltip}>
          <CheckCircleIcon fontSize="small" color="success" />
        </Tooltip>
      );
    case 'failed':
      return (
        <Tooltip title={tooltip}>
          <ErrorIcon fontSize="small" color="error" />
        </Tooltip>
      );
    case 'pending':
      return (
        <Tooltip title={tooltip}>
          <PendingIcon fontSize="small" color="warning" />
        </Tooltip>
      );
    default:
      return (
        <Tooltip title="Not synced to Canvas">
          <SyncIcon fontSize="small" color="disabled" />
        </Tooltip>
      );
  }
}

/** Export grades to CSV and trigger download */
function exportToCSV(grades: GradeListItem[], labTitle: string) {
  const headers = [
    'Student Name',
    'Email',
    'Attempt',
    'Status',
    'Score',
    'Percentage',
    'Max Points',
    'Submitted',
    'Graded',
    'Canvas Sync',
  ];
  const rows = grades.map((g) => [
    g.studentName,
    g.studentEmail,
    g.attemptNumber,
    g.status,
    g.score ?? '',
    g.percentage != null ? `${g.percentage}%` : '',
    g.maxPoints,
    g.submittedAt ? new Date(g.submittedAt).toLocaleString() : '',
    g.gradedAt ? new Date(g.gradedAt).toLocaleString() : '',
    g.canvasSyncStatus,
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${labTitle.replace(/\s+/g, '_')}_grades.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── DataGrid row shape ──────────────────────────────────────────

interface GradeRow {
  id: string;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: string;
  score: number | null;
  percentage: number | null;
  maxPoints: number;
  submittedAt: string | null;
  canvasSyncStatus: string;
  lastSyncAt: string | null;
  attemptId: string;
}

// ─── Main component ─────────────────────────────────────────────

/**
 * Grade Center — MUI DataGrid of all students × labs.
 * Color-coded cells: red < 70%, yellow 70-85%, green > 85%.
 * Click a row to open the AttemptReview drawer.
 */
export default function GradeCenter() {
  const course = useAppStore((s) => s.course);

  // ─── State ────────────────────────────────────────────────────
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────────
  const { data: labs, isLoading: labsLoading } = useLabsList(course?.id);
  const { data: gradesData, isLoading: gradesLoading, error: gradesError } = useLabGrades(
    selectedLabId || undefined
  );
  const syncAllMutation = useSyncAllToCanvas();

  // Auto-select first lab when labs load
  const effectiveLabId = selectedLabId || (labs?.[0]?.id ?? '');
  if (!selectedLabId && labs && labs.length > 0) {
    // Set on next tick to avoid setState-during-render
    queueMicrotask(() => setSelectedLabId(labs[0].id));
  }

  // ─── Filter grades by status ──────────────────────────────────
  const filteredGrades = useMemo(() => {
    if (!gradesData?.grades) return [];
    if (!statusFilter) return gradesData.grades;
    return gradesData.grades.filter((g) => g.status === statusFilter);
  }, [gradesData, statusFilter]);

  // ─── DataGrid rows ────────────────────────────────────────────
  const rows: GradeRow[] = useMemo(
    () =>
      filteredGrades.map((g) => ({
        id: g.attemptId,
        studentName: g.studentName,
        studentEmail: g.studentEmail,
        attemptNumber: g.attemptNumber,
        status: g.status,
        score: g.score,
        percentage: g.percentage,
        maxPoints: g.maxPoints,
        submittedAt: g.submittedAt,
        canvasSyncStatus: g.canvasSyncStatus,
        lastSyncAt: g.lastSyncAt,
        attemptId: g.attemptId,
      })),
    [filteredGrades]
  );

  // ─── DataGrid columns ────────────────────────────────────────
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'studentName',
        headerName: 'Student',
        flex: 1,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {params.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.studentEmail}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'attemptNumber',
        headerName: 'Attempt',
        width: 80,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams) => (
          <Chip label={`#${params.value}`} size="small" variant="outlined" />
        ),
      },
      {
        field: 'percentage',
        headerName: 'Score',
        width: 130,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams) => {
          const pct = params.value as number | null;
          const maxPts = params.row.maxPoints;
          const rawScore = params.row.score;

          if (pct === null) {
            return (
              <Chip label="Not graded" size="small" variant="outlined" color="default" />
            );
          }

          return (
            <Tooltip title={`${rawScore} / ${maxPts} points`}>
              <Chip
                label={`${Math.round(pct)}%`}
                size="small"
                color={scoreColor(pct)}
                variant="filled"
                sx={{ fontWeight: 600, minWidth: 56 }}
              />
            </Tooltip>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: (params: GridRenderCellParams) => (
          <Chip
            label={params.value}
            size="small"
            variant="outlined"
            color={
              params.value === 'graded'
                ? 'success'
                : params.value === 'submitted'
                  ? 'primary'
                  : params.value === 'in_progress'
                    ? 'warning'
                    : 'default'
            }
            sx={{ textTransform: 'capitalize' }}
          />
        ),
      },
      {
        field: 'submittedAt',
        headerName: 'Submitted',
        width: 170,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" color="text.secondary">
            {params.value ? new Date(params.value as string).toLocaleString() : '--'}
          </Typography>
        ),
      },
      {
        field: 'canvasSyncStatus',
        headerName: 'Canvas',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams) => (
          <SyncStatusIcon
            status={params.value as CanvasSyncStatus}
            lastSyncAt={params.row.lastSyncAt}
          />
        ),
      },
    ],
    []
  );

  // ─── Handlers ─────────────────────────────────────────────────

  const handleLabChange = useCallback((e: SelectChangeEvent) => {
    setSelectedLabId(e.target.value);
    setStatusFilter('');
  }, []);

  const handleStatusChange = useCallback((e: SelectChangeEvent) => {
    setStatusFilter(e.target.value);
  }, []);

  const handleRowClick = useCallback((params: GridRowParams) => {
    setSelectedAttemptId(params.row.attemptId as string);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedAttemptId(null);
  }, []);

  const handleSyncAll = useCallback(() => {
    if (effectiveLabId) {
      syncAllMutation.mutate(effectiveLabId);
    }
  }, [effectiveLabId, syncAllMutation]);

  const handleExportCSV = useCallback(() => {
    if (filteredGrades.length > 0) {
      const labTitle = gradesData?.lab.title ?? 'grades';
      exportToCSV(filteredGrades, labTitle);
    }
  }, [filteredGrades, gradesData]);

  // ─── Computed values ──────────────────────────────────────────

  const gradedCount = filteredGrades.filter((g) => g.status === 'graded').length;
  const submittedCount = filteredGrades.filter((g) => g.status === 'submitted').length;
  const avgScore =
    gradedCount > 0
      ? Math.round(
          filteredGrades
            .filter((g) => g.percentage !== null)
            .reduce((sum, g) => sum + Number(g.percentage), 0) / gradedCount
        )
      : null;

  const isLoading = labsLoading || gradesLoading;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <Box>
      {/* ─── Page Header ─────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h4" gutterBottom>
              Grade Center
            </Typography>
            <LiveIndicator labId={effectiveLabId || undefined} />
          </Box>
          <Typography variant="body1" color="text.secondary">
            Review student grades, override scores, and sync to Canvas.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            size="small"
            onClick={handleExportCSV}
            disabled={filteredGrades.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={
              syncAllMutation.isPending ? <CircularProgress size={16} /> : <SyncIcon />
            }
            size="small"
            onClick={handleSyncAll}
            disabled={syncAllMutation.isPending || !effectiveLabId || gradedCount === 0}
          >
            Sync All to Canvas
          </Button>
        </Box>
      </Box>

      {/* Sync status alerts */}
      {syncAllMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => syncAllMutation.reset()}>
          All graded attempts queued for Canvas sync.
        </Alert>
      )}
      {syncAllMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => syncAllMutation.reset()}>
          Canvas sync failed: {(syncAllMutation.error as Error).message}
        </Alert>
      )}

      {/* ─── Filters & Summary ───────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent
          sx={{ display: 'flex', gap: 2, alignItems: 'center', pb: '16px !important' }}
        >
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Lab</InputLabel>
            <Select
              value={effectiveLabId}
              onChange={handleLabChange}
              label="Lab"
            >
              {labsLoading && (
                <MenuItem value="" disabled>
                  Loading labs...
                </MenuItem>
              )}
              {labs?.map((lab) => (
                <MenuItem key={lab.id} value={lab.id}>
                  {lab.title}
                  {!lab.isPublished && (
                    <Chip
                      label="Draft"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, fontSize: '0.6rem', height: 18 }}
                    />
                  )}
                </MenuItem>
              ))}
              {labs?.length === 0 && (
                <MenuItem value="" disabled>
                  No labs found
                </MenuItem>
              )}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={handleStatusChange} label="Status">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="graded">Graded</MenuItem>
              <MenuItem value="submitted">Submitted</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="not_started">Not Started</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${filteredGrades.length} students`}
              size="small"
              variant="outlined"
            />
            {gradedCount > 0 && (
              <Chip
                label={`${gradedCount} graded`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {submittedCount > 0 && (
              <Chip
                label={`${submittedCount} pending`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {avgScore !== null && (
              <Chip
                label={`Avg: ${avgScore}%`}
                size="small"
                color={scoreColor(avgScore)}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* ─── Data Grid ───────────────────────────────────────── */}
      {gradesError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load grades. Please try again.
        </Alert>
      ) : isLoading ? (
        <Card sx={{ mb: 3 }}>
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={50} sx={{ mb: 1 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 0.5 }} />
            ))}
          </Box>
        </Card>
      ) : rows.length === 0 ? (
        <Card sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              px: 3,
            }}
          >
            <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Submissions Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {!effectiveLabId
                ? 'Select a lab from the dropdown above to view student grades.'
                : statusFilter
                  ? `No ${statusFilter.replace('_', ' ')} submissions found for this lab.`
                  : 'No students have started this lab yet. Grades will appear here once students submit their work.'}
            </Typography>
          </Box>
        </Card>
      ) : (
        <Card sx={{ mb: 3 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: {
                sortModel: [{ field: 'studentName', sort: 'asc' }],
              },
            }}
            onRowClick={handleRowClick}
            disableColumnMenu
            disableRowSelectionOnClick
            rowHeight={60}
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'grey.50',
                fontWeight: 700,
              },
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' },
              },
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-cell:focus-within': { outline: 'none' },
            }}
          />
        </Card>
      )}

      {/* ─── Class Analytics ─────────────────────────────────── */}
      <ClassAnalytics labId={effectiveLabId || undefined} />

      {/* ─── Attempt Review Drawer ───────────────────────────── */}
      <AttemptReview attemptId={selectedAttemptId} onClose={handleCloseDrawer} />
    </Box>
  );
}
