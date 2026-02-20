import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert,
  Skeleton,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import apiClient from '@/api/client';
import type { AnimalListItem, LabBuilderFormData } from './types';

/** Colour per organ system */
const SYSTEM_COLORS: Record<string, string> = {
  cardiovascular: '#E74C3C',
  digestive: '#F39C12',
  respiratory: '#3498DB',
  urogenital: '#9B59B6',
  skeletal: '#95A5A6',
  muscular: '#E67E22',
  nervous: '#1ABC9C',
  integumentary: '#D35400',
  lymphatic: '#27AE60',
  endocrine: '#8E44AD',
};

/**
 * Step 2: System Selector
 * Shows checkboxes for each organ system available on the selected animal.
 */
export default function SystemSelector() {
  const { setValue, watch, formState: { errors } } = useFormContext<LabBuilderFormData>();
  const selectedAnimalId = watch('animalId');
  const selectedSystems = watch('organSystems');

  // Fetch the selected animal's models to discover organ systems
  const { data: animal, isLoading } = useQuery({
    queryKey: ['animals', selectedAnimalId],
    queryFn: async () => {
      const resp = await apiClient.get<AnimalListItem>(`/animals/${selectedAnimalId}`);
      return resp.data;
    },
    enabled: !!selectedAnimalId,
  });

  // Extract unique organ systems from the animal's models
  const availableSystems = animal
    ? [...new Set(animal.models.map((m) => m.organSystem))]
    : [];

  const handleToggle = (system: string) => {
    const current = selectedSystems ?? [];
    const updated = current.includes(system)
      ? current.filter((s) => s !== system)
      : [...current, system];
    setValue('organSystems', updated, { shouldValidate: true });
    // When systems change, reset structure selection
    setValue('structureIds', []);
    setValue('structureConfigs', {});
  };

  const handleSelectAll = () => {
    if (selectedSystems.length === availableSystems.length) {
      setValue('organSystems', [], { shouldValidate: true });
    } else {
      setValue('organSystems', [...availableSystems], { shouldValidate: true });
    }
    setValue('structureIds', []);
    setValue('structureConfigs', {});
  };

  if (!selectedAnimalId) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Step 2: Choose Organ Systems
        </Typography>
        <Alert severity="info">
          Please select an animal in Step 1 first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 2: Choose Organ Systems
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Select which organ systems to include in this lab.
        {animal && (
          <>
            {' '}
            <strong>{animal.commonName}</strong> has {availableSystems.length} available system
            {availableSystems.length !== 1 ? 's' : ''}.
          </>
        )}
      </Typography>

      {errors.organSystems && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.organSystems.message}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ mt: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={40} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : availableSystems.length === 0 ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No organ system models found for this animal. Please select a different animal.
        </Alert>
      ) : (
        <>
          {/* Select All toggle */}
          <Box sx={{ mb: 2 }}>
            <Chip
              label={
                selectedSystems.length === availableSystems.length
                  ? 'Deselect All'
                  : 'Select All'
              }
              onClick={handleSelectAll}
              color="primary"
              variant="outlined"
              size="small"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {selectedSystems.length} of {availableSystems.length} selected
            </Typography>
          </Box>

          <FormGroup>
            {availableSystems.map((system) => {
              const isChecked = selectedSystems.includes(system);
              const color = SYSTEM_COLORS[system] ?? '#607D8B';
              const modelCount = animal!.models.filter(
                (m) => m.organSystem === system
              ).length;

              return (
                <FormControlLabel
                  key={system}
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={() => handleToggle(system)}
                      sx={{
                        color: `${color}80`,
                        '&.Mui-checked': { color },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: color,
                        }}
                      />
                      <Typography
                        variant="body1"
                        sx={{ textTransform: 'capitalize', fontWeight: isChecked ? 600 : 400 }}
                      >
                        {system}
                      </Typography>
                      <Chip
                        label={`${modelCount} model${modelCount !== 1 ? 's' : ''}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  }
                  sx={{
                    mb: 0.5,
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    backgroundColor: isChecked ? `${color}08` : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                />
              );
            })}
          </FormGroup>
        </>
      )}
    </Box>
  );
}
