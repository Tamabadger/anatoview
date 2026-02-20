import {
  Box,
  Typography,
  Paper,
  Divider,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableContainer,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PublishIcon from '@mui/icons-material/Publish';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import { useAppStore } from '@/stores/useAppStore';
import type { LabBuilderFormData, AnimalListItem, StructureListItem } from './types';

/**
 * Step 6: Review & Publish
 * Full summary of all lab settings, structures, rubric.
 * "Save as Draft" → POST /api/labs
 * "Publish to Canvas" → POST /api/labs + POST /api/labs/:id/publish
 */
export default function ReviewAndPublish() {
  const { watch } = useFormContext<LabBuilderFormData>();
  const navigate = useNavigate();
  const course = useAppStore((s) => s.course);
  const formData = watch();

  // Fetch animal name
  const { data: animal } = useQuery({
    queryKey: ['animals', formData.animalId],
    queryFn: async () => {
      const resp = await apiClient.get<AnimalListItem>(`/animals/${formData.animalId}`);
      return resp.data;
    },
    enabled: !!formData.animalId,
  });

  // Fetch structure names
  const { data: structuresData } = useQuery({
    queryKey: ['structures', formData.animalId],
    queryFn: async () => {
      const resp = await apiClient.get<{ structures: StructureListItem[] }>(
        `/animals/${formData.animalId}/structures`
      );
      return resp.data.structures;
    },
    enabled: !!formData.animalId,
  });

  const structureMap = new Map(
    (structuresData ?? []).map((s) => [s.id, s])
  );

  // Build the payload for the API
  const buildPayload = () => {
    const totalPoints = formData.structureIds.reduce((sum, id) => {
      return sum + (formData.structureConfigs[id]?.pointsPossible ?? 1);
    }, 0);

    return {
      courseId: course?.id ?? '',
      title: formData.title,
      instructions: formData.instructions || undefined,
      animalId: formData.animalId,
      organSystems: formData.organSystems,
      labType: formData.labType,
      maxPoints: totalPoints,
      dueDate: formData.dueDate || undefined,
      structureIds: formData.structureIds,
      settings: {
        timeLimitMinutes: formData.timeLimitMinutes,
        attemptsAllowed: formData.attemptsAllowed,
        showHints: formData.showHints,
        randomizeOrder: formData.randomizeOrder,
        passingThresholdPercent: formData.passingThresholdPercent,
      },
      rubric: {
        structureRubrics: formData.structureRubrics,
        categoryWeights: formData.categoryWeights,
      },
    };
  };

  // Save as Draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      const resp = await apiClient.post('/labs', payload);
      return resp.data;
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
  });

  // Publish mutation (save + publish)
  const publishMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      const resp = await apiClient.post<{ id: string }>('/labs', payload);
      const labId = resp.data.id;
      await apiClient.post(`/labs/${labId}/publish`);
      return resp.data;
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
  });

  const isSaving = saveDraftMutation.isPending || publishMutation.isPending;

  // Computed values for display
  const totalPoints = formData.structureIds.reduce(
    (sum, id) => sum + (formData.structureConfigs[id]?.pointsPossible ?? 1),
    0
  );

  const requiredCount = formData.structureIds.filter(
    (id) => formData.structureConfigs[id]?.isRequired !== false
  ).length;

  const aliasCount = Object.values(formData.structureRubrics).reduce(
    (sum, r) => sum + (r.acceptedAliases?.length ?? 0),
    0
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 6: Review & Publish
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your lab configuration before saving or publishing to students.
      </Typography>

      {/* ─── Validation warnings ────────────────────────────── */}
      {!formData.title && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Lab title is missing. Go back to Settings to add one.
        </Alert>
      )}
      {formData.structureIds.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No structures selected. Go back to Step 3.
        </Alert>
      )}
      {!course?.id && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No course context — in dev mode, the lab will be created without a course association.
        </Alert>
      )}

      {/* ─── Summary Table ──────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Lab Summary
          </Typography>
        </Box>
        <Divider />
        <Table size="small">
          <TableBody>
            <SummaryRow label="Title" value={formData.title || '(not set)'} />
            <SummaryRow label="Animal" value={animal?.commonName ?? formData.animalId} />
            <SummaryRow
              label="Organ Systems"
              value={
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {formData.organSystems.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>
              }
            />
            <SummaryRow label="Structures" value={`${formData.structureIds.length} selected (${requiredCount} required)`} />
            <SummaryRow label="Total Points" value={totalPoints} />
            <SummaryRow label="Lab Type" value={formData.labType} />
            <SummaryRow
              label="Time Limit"
              value={formData.timeLimitMinutes ? `${formData.timeLimitMinutes} minutes` : 'Unlimited'}
            />
            <SummaryRow
              label="Attempts"
              value={formData.attemptsAllowed === 100 ? 'Unlimited' : formData.attemptsAllowed}
            />
            <SummaryRow label="Show Hints" value={formData.showHints ? 'Yes' : 'No'} />
            <SummaryRow label="Randomize Order" value={formData.randomizeOrder ? 'Yes' : 'No'} />
            <SummaryRow label="Passing Threshold" value={`${formData.passingThresholdPercent}%`} />
            <SummaryRow label="Accepted Aliases" value={`${aliasCount} total across all structures`} />
            <SummaryRow
              label="Due Date"
              value={formData.dueDate ? new Date(formData.dueDate).toLocaleString() : 'Not set'}
            />
          </TableBody>
        </Table>
      </Paper>

      {/* ─── Structure Detail Table ─────────────────────────── */}
      {formData.structureIds.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Structure Details
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Structure</TableCell>
                  <TableCell>System</TableCell>
                  <TableCell align="center">Points</TableCell>
                  <TableCell align="center">Required</TableCell>
                  <TableCell align="center">Aliases</TableCell>
                  <TableCell align="center">Hint Penalty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.structureIds.map((id) => {
                  const structure = structureMap.get(id);
                  const config = formData.structureConfigs[id];
                  const rubric = formData.structureRubrics[id];
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {structure?.name ?? id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={structure?.model.organSystem ?? ''}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize', fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell align="center">{config?.pointsPossible ?? 1}</TableCell>
                      <TableCell align="center">
                        {config?.isRequired !== false ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <Typography variant="caption" color="text.secondary">Optional</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">{rubric?.acceptedAliases?.length ?? 0}</TableCell>
                      <TableCell align="center">{rubric?.hintPenaltyPercent ?? 10}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ─── Error messages ─────────────────────────────────── */}
      {saveDraftMutation.isError && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
          Failed to save draft: {(saveDraftMutation.error as Error).message}
        </Alert>
      )}
      {publishMutation.isError && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
          Failed to publish: {(publishMutation.error as Error).message}
        </Alert>
      )}

      {/* ─── Action Buttons ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="large"
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={() => saveDraftMutation.mutate()}
          disabled={isSaving || !formData.title}
        >
          Save as Draft
        </Button>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          startIcon={isSaving ? <CircularProgress size={16} /> : <PublishIcon />}
          onClick={() => publishMutation.mutate()}
          disabled={isSaving || !formData.title || formData.structureIds.length === 0}
        >
          Publish to Canvas
        </Button>
      </Box>

      {publishMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Lab published successfully! Redirecting to dashboard...
        </Alert>
      )}
    </Box>
  );
}

// ─── Helper component ──────────────────────────────────────────

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 600, width: 180, borderBottom: '1px solid', borderColor: 'divider' }}>
        {label}
      </TableCell>
      <TableCell sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Typography variant="body2" sx={{ textTransform: label === 'Lab Type' ? 'capitalize' : 'none' }}>
            {value}
          </Typography>
        ) : (
          value
        )}
      </TableCell>
    </TableRow>
  );
}
