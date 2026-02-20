import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Avatar,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories } from '@/api/categories';
import {
  useCreateAnimal,
  useUpdateAnimal,
  useUploadThumbnail,
  type Animal,
  type CreateAnimalPayload,
} from '@/api/animals';

// ─── Validation Schema ─────────────────────────────────────────

const animalFormSchema = z.object({
  commonName: z.string().min(1, 'Common name is required').max(255),
  scientificName: z.string().max(255).optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().max(2000).optional().or(z.literal('')),
  modelType: z.enum(['svg', 'three_js', 'photographic']),
});

type AnimalFormData = z.infer<typeof animalFormSchema>;

// ─── Props ──────────────────────────────────────────────────────

interface AnimalFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog is in "edit" mode */
  animal?: Animal | null;
}

export default function AnimalFormDialog({ open, onClose, animal }: AnimalFormDialogProps) {
  const isEdit = !!animal;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];

  const createAnimal = useCreateAnimal();
  const updateAnimal = useUpdateAnimal();
  const uploadThumbnail = useUploadThumbnail();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnimalFormData>({
    resolver: zodResolver(animalFormSchema),
    defaultValues: {
      commonName: '',
      scientificName: '',
      categoryId: '',
      description: '',
      modelType: 'svg',
    },
  });

  // Reset form when dialog opens/closes or animal changes
  useEffect(() => {
    if (open) {
      if (animal) {
        reset({
          commonName: animal.commonName,
          scientificName: animal.scientificName ?? '',
          categoryId: animal.categoryId,
          description: animal.description ?? '',
          modelType: animal.modelType as 'svg' | 'three_js' | 'photographic',
        });
      } else {
        reset({
          commonName: '',
          scientificName: '',
          categoryId: '',
          description: '',
          modelType: 'svg',
        });
      }
    }
  }, [open, animal, reset]);

  const onSubmit = async (data: AnimalFormData) => {
    try {
      const payload: CreateAnimalPayload = {
        commonName: data.commonName,
        scientificName: data.scientificName || undefined,
        categoryId: data.categoryId,
        description: data.description || undefined,
        modelType: data.modelType,
      };

      if (isEdit && animal) {
        await updateAnimal.mutateAsync({ id: animal.id, ...payload });
      } else {
        const newAnimal = await createAnimal.mutateAsync(payload);
        // Upload thumbnail if file selected
        const file = fileInputRef.current?.files?.[0];
        if (file) {
          await uploadThumbnail.mutateAsync({ animalId: newAnimal.id, file });
        }
      }
      onClose();
    } catch {
      // Mutation error is handled by react-query
    }
  };

  const handleThumbnailUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !animal) return;
    await uploadThumbnail.mutateAsync({ animalId: animal.id, file });
  };

  const isBusy = isSubmitting || createAnimal.isPending || updateAnimal.isPending || uploadThumbnail.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{isEdit ? 'Edit Specimen' : 'Add Specimen'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {/* Common Name */}
            <Controller
              name="commonName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Common Name"
                  required
                  error={!!errors.commonName}
                  helperText={errors.commonName?.message}
                  fullWidth
                />
              )}
            />

            {/* Scientific Name */}
            <Controller
              name="scientificName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Scientific Name"
                  helperText={errors.scientificName?.message || 'e.g. Felis catus'}
                  error={!!errors.scientificName}
                  fullWidth
                  InputProps={{ sx: { fontStyle: 'italic' } }}
                />
              )}
            />

            {/* Category */}
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth required error={!!errors.categoryId}>
                  <InputLabel>Category</InputLabel>
                  <Select {...field} label="Category">
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: cat.color,
                              flexShrink: 0,
                            }}
                          />
                          {cat.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.categoryId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {errors.categoryId.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  multiline
                  rows={3}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  fullWidth
                />
              )}
            />

            {/* Model Type */}
            <Controller
              name="modelType"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Model Type</InputLabel>
                  <Select {...field} label="Model Type">
                    <MenuItem value="svg">SVG (2D Illustration)</MenuItem>
                    <MenuItem value="three_js">Three.js (3D Model)</MenuItem>
                    <MenuItem value="photographic">Photographic</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            {/* Thumbnail Upload */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Thumbnail
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {animal?.thumbnailUrl ? (
                  <Avatar
                    src={animal.thumbnailUrl}
                    variant="rounded"
                    sx={{ width: 64, height: 64 }}
                  />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 64, height: 64, bgcolor: 'grey.200' }}>
                    <CloudUploadIcon color="action" />
                  </Avatar>
                )}
                <Box>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={isEdit ? handleThumbnailUpload : undefined}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadThumbnail.isPending}
                  >
                    {uploadThumbnail.isPending ? (
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                    ) : null}
                    {isEdit ? 'Change Thumbnail' : 'Select Thumbnail'}
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    PNG, JPEG, WebP, or SVG. Max 5 MB.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isBusy}>
            {isBusy ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            {isEdit ? 'Save Changes' : 'Add Specimen'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
