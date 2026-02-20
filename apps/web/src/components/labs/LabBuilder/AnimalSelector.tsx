import { Box, Typography, Grid, Paper, Chip, Skeleton, Alert } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import apiClient from '@/api/client';
import type { AnimalListItem, LabBuilderFormData } from './types';

/** Category colours now come from the API via animal.category.color */

/**
 * Step 1: Animal Selector
 * Fetches animals from GET /api/animals and displays as a selectable card grid.
 */
export default function AnimalSelector() {
  const { setValue, watch, formState: { errors } } = useFormContext<LabBuilderFormData>();
  const selectedAnimalId = watch('animalId');

  const { data, isLoading, error } = useQuery({
    queryKey: ['animals'],
    queryFn: async () => {
      const resp = await apiClient.get<{ animals: AnimalListItem[]; total: number }>('/animals');
      return resp.data.animals;
    },
  });

  const handleSelect = (animalId: string) => {
    setValue('animalId', animalId, { shouldValidate: true });
    // Reset downstream selections when animal changes
    setValue('organSystems', []);
    setValue('structureIds', []);
    setValue('structureConfigs', {});
    setValue('structureRubrics', {});
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 1: Select a Specimen
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose the animal specimen for this lab. Students will study its anatomical structures.
      </Typography>

      {errors.animalId && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.animalId.message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load animals. Please try again.
        </Alert>
      )}

      <Grid container spacing={2}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Skeleton variant="rounded" height={200} />
              </Grid>
            ))
          : data?.map((animal) => {
              const isSelected = selectedAnimalId === animal.id;
              const color = animal.category?.color ?? '#95A5A6';
              const systemCount = animal.models.length;
              const uniqueSystems = [...new Set(animal.models.map((m) => m.organSystem))];

              return (
                <Grid item xs={6} sm={4} md={3} key={animal.id}>
                  <Paper
                    onClick={() => handleSelect(animal.id)}
                    sx={{
                      p: 0,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : 'transparent',
                      borderRadius: 2,
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      position: 'relative',
                      '&:hover': {
                        borderColor: isSelected ? 'primary.main' : 'primary.light',
                        boxShadow: 3,
                      },
                    }}
                    elevation={isSelected ? 4 : 1}
                  >
                    {/* Selection badge */}
                    {isSelected && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                          bgcolor: 'primary.main',
                          borderRadius: '50%',
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 20, color: 'white' }} />
                      </Box>
                    )}

                    {/* Image area */}
                    <Box
                      sx={{
                        height: 100,
                        backgroundColor: `${color}12`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {animal.thumbnailUrl ? (
                        <Box
                          component="img"
                          src={animal.thumbnailUrl}
                          alt={animal.commonName}
                          sx={{ maxHeight: 80, maxWidth: '80%', objectFit: 'contain' }}
                        />
                      ) : (
                        <PetsIcon sx={{ fontSize: 48, color, opacity: 0.4 }} />
                      )}
                    </Box>

                    {/* Info */}
                    <Box sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {animal.commonName}
                      </Typography>
                      {animal.scientificName && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic', display: 'block', mb: 0.5 }}
                          noWrap
                        >
                          {animal.scientificName}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <Chip
                          label={animal.category?.name ?? 'Unknown'}
                          size="small"
                          sx={{
                            backgroundColor: `${color}18`,
                            color,
                            textTransform: 'capitalize',
                            fontSize: '0.65rem',
                            height: 20,
                          }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ScienceIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                        <Typography variant="caption" color="text.secondary">
                          {systemCount} model{systemCount !== 1 ? 's' : ''}
                        </Typography>
                      </Box>

                      {uniqueSystems.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                          {uniqueSystems.slice(0, 3).map((sys) => (
                            <Chip
                              key={sys}
                              label={sys}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18, textTransform: 'capitalize' }}
                            />
                          ))}
                          {uniqueSystems.length > 3 && (
                            <Chip
                              label={`+${uniqueSystems.length - 3}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
      </Grid>
    </Box>
  );
}
