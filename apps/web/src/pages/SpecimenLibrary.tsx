import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Skeleton,
  Alert,
  Button,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PetsIcon from '@mui/icons-material/Pets';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAnimals } from '@/api/animals';
import { useCategories } from '@/api/categories';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Specimen Library — browse all animals and their anatomical structures.
 * Filterable by category, organ system, and search.
 * Data is fetched from the API (no hardcoded placeholders).
 */
export default function SpecimenLibrary() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const isStaff = user && ['instructor', 'ta', 'admin'].includes(user.role);

  const { data: animalsData, isLoading: animalsLoading, error: animalsError } = useAnimals({
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(search ? { search } : {}),
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  const animals = animalsData?.animals ?? [];
  const categories = categoriesData ?? [];

  // Build dynamic color map from API categories
  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.id] = cat.color;
    }
    return map;
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.id] = cat.name;
    }
    return map;
  }, [categories]);

  const isLoading = animalsLoading || categoriesLoading;

  return (
    <Box>
      {/* ─── Page Header ──────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Specimen Library
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            Browse all available animal specimens and their anatomical structures.
          </Typography>
        </Box>
        {isStaff && (
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/animals/manage')}
            sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            Manage Specimens
          </Button>
        )}
      </Box>

      {animalsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load specimens. Please try again later.
        </Alert>
      )}

      {/* ─── Filters ──────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 4,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Search animals..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 280 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
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
        </FormControl>
        <Box sx={{ flex: 1 }} />
        {!isLoading && (
          <Chip
            label={`${animals.length} specimen${animals.length !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        )}
      </Box>

      {/* ─── Animal Cards ─────────────────────────────────── */}
      <Grid container spacing={2.5}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card sx={{ height: '100%' }}>
                  <Skeleton variant="rectangular" height={180} />
                  <CardContent>
                    <Skeleton variant="text" width="70%" height={32} />
                    <Skeleton variant="text" width="50%" />
                    <Skeleton variant="text" width="40%" sx={{ mt: 2 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : animals.map((animal) => {
              const color = categoryColorMap[animal.categoryId] || '#95A5A6';
              const catName = categoryNameMap[animal.categoryId] || 'Unknown';
              const modelCount = animal.models?.length ?? 0;
              const uniqueSystems = [
                ...new Set((animal.models ?? []).map((m) => m.organSystem)),
              ];

              return (
                <Grid item xs={12} sm={6} md={4} key={animal.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'default',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: (t) =>
                          t.palette.mode === 'dark'
                            ? '0 12px 32px rgba(0,0,0,0.45)'
                            : '0 12px 32px rgba(0,0,0,0.1)',
                      },
                    }}
                  >
                    {/* Image / Thumbnail */}
                    <Box
                      sx={{
                        height: 180,
                        background: (t) =>
                          t.palette.mode === 'dark'
                            ? `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`
                            : `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.03)} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Decorative circle */}
                      <Box
                        sx={{
                          position: 'absolute',
                          width: 200,
                          height: 200,
                          borderRadius: '50%',
                          background: alpha(color, 0.06),
                          bottom: -60,
                          right: -40,
                          pointerEvents: 'none',
                        }}
                      />
                      {animal.thumbnailUrl ? (
                        <Box
                          component="img"
                          src={animal.thumbnailUrl}
                          alt={animal.commonName}
                          sx={{
                            maxHeight: 150,
                            maxWidth: '80%',
                            objectFit: 'contain',
                            position: 'relative',
                            zIndex: 1,
                            filter: (t) =>
                              t.palette.mode === 'dark' ? 'brightness(0.9)' : 'none',
                          }}
                        />
                      ) : (
                        <PetsIcon
                          sx={{
                            fontSize: 72,
                            color,
                            opacity: 0.3,
                            position: 'relative',
                            zIndex: 1,
                          }}
                        />
                      )}
                    </Box>

                    <CardContent sx={{ flex: 1, p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'flex-start' }}>
                        <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                          {animal.commonName}
                        </Typography>
                        <Chip
                          label={catName}
                          size="small"
                          sx={{
                            backgroundColor: alpha(color, 0.12),
                            color,
                            textTransform: 'capitalize',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                      {animal.scientificName && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic', mb: 2, lineHeight: 1.4 }}
                        >
                          {animal.scientificName}
                        </Typography>
                      )}

                      <Divider sx={{ mb: 1.5 }} />

                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ScienceIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                          <Typography variant="body2" color="text.secondary" fontWeight={500}>
                            {modelCount} model{modelCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Box>

                      {uniqueSystems.length > 0 && (
                        <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {uniqueSystems.map((sys) => (
                            <Chip
                              key={sys}
                              label={sys}
                              size="small"
                              variant="outlined"
                              sx={{
                                textTransform: 'capitalize',
                                fontSize: '0.7rem',
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
      </Grid>

      {/* ─── Empty state ──────────────────────────────────── */}
      {!isLoading && animals.length === 0 && !animalsError && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 4,
              background: (t) => alpha(t.palette.primary.main, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <PetsIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
          </Box>
          <Typography variant="h6" color="text.secondary" fontWeight={600}>
            No specimens found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 320, mx: 'auto' }}>
            {search || categoryFilter
              ? 'Try adjusting your search or filters.'
              : 'Get started by adding specimens.'}
          </Typography>
          {isStaff && !search && !categoryFilter && (
            <Button
              variant="contained"
              startIcon={<AddCircleIcon />}
              onClick={() => navigate('/animals/manage')}
              sx={{ fontWeight: 600 }}
            >
              Add Specimen
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
