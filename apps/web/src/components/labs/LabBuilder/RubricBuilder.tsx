import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Divider,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { useFormContext } from 'react-hook-form';
import type { LabBuilderFormData, StructureListItem } from './types';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

/**
 * Step 4: Rubric Builder
 * Per-structure config: accepted aliases (Chip input), hint penalty slider,
 * spelling tolerance toggle, partial credit toggle.
 * Also: category weight inputs (per organ system).
 */
export default function RubricBuilder() {
  const { setValue, watch } = useFormContext<LabBuilderFormData>();
  const selectedAnimalId = watch('animalId');
  const selectedStructureIds = watch('structureIds');
  const selectedSystems = watch('organSystems');
  const structureRubrics = watch('structureRubrics');
  const categoryWeights = watch('categoryWeights');

  // Fetch structures to display names
  const { data: structuresData } = useQuery({
    queryKey: ['structures', selectedAnimalId],
    queryFn: async () => {
      const resp = await apiClient.get<{
        structures: StructureListItem[];
      }>(`/animals/${selectedAnimalId}/structures`);
      return resp.data.structures;
    },
    enabled: !!selectedAnimalId,
  });

  const structureMap = new Map(
    (structuresData ?? []).map((s) => [s.id, s])
  );

  // Get only selected structures
  const selectedStructures = selectedStructureIds
    .map((id) => structureMap.get(id))
    .filter(Boolean) as StructureListItem[];

  const getStructureRubric = (structureId: string) =>
    structureRubrics[structureId] ?? {
      acceptedAliases: [],
      hintPenaltyPercent: 10,
      spellingToleranceEnabled: true,
      partialCreditEnabled: false,
    };

  const updateStructureRubric = useCallback(
    (structureId: string, field: string, value: unknown) => {
      const current = structureRubrics[structureId] ?? {
        acceptedAliases: [],
        hintPenaltyPercent: 10,
        spellingToleranceEnabled: true,
        partialCreditEnabled: false,
      };
      setValue('structureRubrics', {
        ...structureRubrics,
        [structureId]: { ...current, [field]: value },
      });
    },
    [structureRubrics, setValue]
  );

  if (selectedStructureIds.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Step 4: Configure Rubric
        </Typography>
        <Alert severity="info">
          Please select structures in Step 3 first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 4: Configure Rubric
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set grading rules for each structure. Add accepted aliases, configure penalties, and
        adjust scoring options.
      </Typography>

      {/* ─── Category Weights ──────────────────────────────── */}
      {selectedSystems.length > 1 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Category Weights
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Optionally weight organ systems differently. Leave at 0 for equal weighting.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {selectedSystems.map((sys) => (
              <TextField
                key={sys}
                label={sys}
                size="small"
                type="number"
                value={categoryWeights[sys] ?? ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setValue('categoryWeights', { ...categoryWeights, [sys]: val });
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  inputProps: { min: 0, max: 100, step: 5 },
                }}
                sx={{ width: 140, textTransform: 'capitalize' }}
              />
            ))}
          </Box>
          <Divider sx={{ mt: 2 }} />
        </Box>
      )}

      {/* ─── Per-Structure Rubrics ─────────────────────────── */}
      {selectedStructures.map((structure) => {
        const rubric = getStructureRubric(structure.id);
        return (
          <StructureRubricCard
            key={structure.id}
            structure={structure}
            rubric={rubric}
            onUpdate={(field, value) => updateStructureRubric(structure.id, field, value)}
          />
        );
      })}

      {selectedStructures.length === 0 && (
        <Alert severity="warning">
          No structures found. Check that Step 3 has selections.
        </Alert>
      )}
    </Box>
  );
}

// ─── Sub-component: per-structure accordion ─────────────────────

interface StructureRubricCardProps {
  structure: StructureListItem;
  rubric: {
    acceptedAliases: string[];
    hintPenaltyPercent: number;
    spellingToleranceEnabled: boolean;
    partialCreditEnabled: boolean;
  };
  onUpdate: (field: string, value: unknown) => void;
}

function StructureRubricCard({ structure, rubric, onUpdate }: StructureRubricCardProps) {
  const [aliasInput, setAliasInput] = useState('');

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !rubric.acceptedAliases.includes(trimmed)) {
      onUpdate('acceptedAliases', [...rubric.acceptedAliases, trimmed]);
      setAliasInput('');
    }
  };

  const handleRemoveAlias = (alias: string) => {
    onUpdate(
      'acceptedAliases',
      rubric.acceptedAliases.filter((a) => a !== alias)
    );
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  return (
    <Accordion
      disableGutters
      sx={{ mb: 1, '&:before': { display: 'none' }, borderRadius: '8px !important' }}
      variant="outlined"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {structure.name}
          </Typography>
          {structure.latinName && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              ({structure.latinName})
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Chip
            label={structure.model.organSystem}
            size="small"
            variant="outlined"
            sx={{ textTransform: 'capitalize', fontSize: '0.65rem', mr: 1 }}
          />
          {rubric.acceptedAliases.length > 0 && (
            <Chip
              label={`${rubric.acceptedAliases.length} alias${rubric.acceptedAliases.length > 1 ? 'es' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.65rem' }}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {/* Accepted Aliases */}
        <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
          Accepted Aliases
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Alternative names that will also be accepted (e.g., abbreviations, common misspellings).
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          {rubric.acceptedAliases.map((alias) => (
            <Chip
              key={alias}
              label={alias}
              size="small"
              onDelete={() => handleRemoveAlias(alias)}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Add alias..."
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={handleAliasKeyDown}
            sx={{ flex: 1 }}
          />
          <Chip
            icon={<AddIcon />}
            label="Add"
            onClick={handleAddAlias}
            clickable
            color="primary"
            variant="outlined"
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Hint Penalty Slider */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600}>
            Hint Penalty: {rubric.hintPenaltyPercent}%
          </Typography>
          <Slider
            value={rubric.hintPenaltyPercent}
            onChange={(_, val) => onUpdate('hintPenaltyPercent', val as number)}
            min={0}
            max={50}
            step={5}
            marks={[
              { value: 0, label: '0%' },
              { value: 10, label: '10%' },
              { value: 25, label: '25%' },
              { value: 50, label: '50%' },
            ]}
            size="small"
            valueLabelDisplay="auto"
          />
        </Box>

        {/* Toggles */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={rubric.spellingToleranceEnabled}
                onChange={(_, checked) => onUpdate('spellingToleranceEnabled', checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Spelling Tolerance</Typography>
                <Typography variant="caption" color="text.secondary">
                  Accept answers within Levenshtein distance &le; 2
                </Typography>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={rubric.partialCreditEnabled}
                onChange={(_, checked) => onUpdate('partialCreditEnabled', checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Partial Credit</Typography>
                <Typography variant="caption" color="text.secondary">
                  Award 50% for fuzzy matches
                </Typography>
              </Box>
            }
          />
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
