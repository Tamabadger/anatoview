import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  Skeleton,
  Button,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import apiClient from '@/api/client';
import type { StructureListItem, LabBuilderFormData } from './types';

/** Difficulty badge colours */
const DIFFICULTY_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
};

/**
 * Step 3: Structure Picker
 * MUI DataGrid of structures for the selected animal + organ systems.
 * Supports inline editing of points_possible, toggle isRequired, search/filter.
 */
export default function StructurePicker() {
  const { setValue, watch, formState: { errors } } = useFormContext<LabBuilderFormData>();
  const selectedAnimalId = watch('animalId');
  const selectedSystems = watch('organSystems');
  const selectedStructureIds = watch('structureIds');
  const structureConfigs = watch('structureConfigs');

  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState<string | null>(null);

  // Fetch structures for the selected animal
  const { data: structuresData, isLoading } = useQuery({
    queryKey: ['structures', selectedAnimalId],
    queryFn: async () => {
      const resp = await apiClient.get<{
        animalId: string;
        animalName: string;
        structures: StructureListItem[];
        total: number;
      }>(`/animals/${selectedAnimalId}/structures`);
      return resp.data;
    },
    enabled: !!selectedAnimalId,
  });

  // Filter structures by selected organ systems, search, and system filter
  const filteredStructures = useMemo(() => {
    if (!structuresData?.structures) return [];
    return structuresData.structures.filter((s) => {
      const inSelectedSystem = selectedSystems.includes(s.model.organSystem);
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.latinName?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesSystemFilter = !systemFilter || s.model.organSystem === systemFilter;
      return inSelectedSystem && matchesSearch && matchesSystemFilter;
    });
  }, [structuresData, selectedSystems, search, systemFilter]);

  // DataGrid rows
  const rows = useMemo(
    () =>
      filteredStructures.map((s) => ({
        id: s.id,
        name: s.name,
        latinName: s.latinName ?? '',
        system: s.model.organSystem,
        difficulty: s.difficultyLevel,
        hint: s.hint ? 'Yes' : 'No',
        pointsPossible: structureConfigs[s.id]?.pointsPossible ?? 1,
        isRequired: structureConfigs[s.id]?.isRequired ?? true,
      })),
    [filteredStructures, structureConfigs]
  );

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Structure',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'latinName',
      headerName: 'Latin Name',
      flex: 0.8,
      minWidth: 130,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'system',
      headerName: 'System',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
        />
      ),
    },
    {
      field: 'difficulty',
      headerName: 'Difficulty',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={DIFFICULTY_COLORS[params.value as string] ?? 'default'}
          variant="outlined"
          sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
        />
      ),
    },
    {
      field: 'pointsPossible',
      headerName: 'Points',
      width: 90,
      editable: true,
      type: 'number',
    },
    {
      field: 'isRequired',
      headerName: 'Required',
      width: 90,
      type: 'boolean',
      editable: true,
    },
    {
      field: 'hint',
      headerName: 'Hint',
      width: 60,
    },
  ];

  // Selection model — map selectedStructureIds to DataGrid selection
  const selectionModel: GridRowSelectionModel = selectedStructureIds;

  const handleSelectionChange = (newSelection: GridRowSelectionModel) => {
    const ids = newSelection as string[];
    setValue('structureIds', ids, { shouldValidate: true });

    // Initialize configs for newly selected structures
    const updatedConfigs = { ...structureConfigs };
    ids.forEach((id) => {
      if (!updatedConfigs[id]) {
        updatedConfigs[id] = { pointsPossible: 1, isRequired: true };
      }
    });
    // Remove configs for deselected structures
    Object.keys(updatedConfigs).forEach((id) => {
      if (!ids.includes(id)) {
        delete updatedConfigs[id];
      }
    });
    setValue('structureConfigs', updatedConfigs);
  };

  const handleCellEdit = (params: { id: string | number; field: string; value: unknown }) => {
    const id = String(params.id);
    const current = structureConfigs[id] ?? { pointsPossible: 1, isRequired: true };
    const updated = { ...current, [params.field]: params.value };
    setValue('structureConfigs', { ...structureConfigs, [id]: updated });
  };

  // Select all by system
  const handleSelectAllBySystem = (system: string) => {
    const systemStructureIds = filteredStructures
      .filter((s) => s.model.organSystem === system)
      .map((s) => s.id);
    const allAlreadySelected = systemStructureIds.every((id) =>
      selectedStructureIds.includes(id)
    );

    let newSelection: string[];
    if (allAlreadySelected) {
      // Deselect all from this system
      newSelection = selectedStructureIds.filter((id) => !systemStructureIds.includes(id));
    } else {
      // Add all from this system
      newSelection = [...new Set([...selectedStructureIds, ...systemStructureIds])];
    }
    handleSelectionChange(newSelection);
  };

  if (!selectedAnimalId || selectedSystems.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Step 3: Select Structures
        </Typography>
        <Alert severity="info">
          Please select an animal and organ systems in the previous steps.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 3: Select Structures
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which anatomical structures students must identify. Edit points and required
        status inline.
      </Typography>

      {errors.structureIds && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof errors.structureIds.message === 'string'
            ? errors.structureIds.message
            : 'Select at least one structure'}
        </Alert>
      )}

      {/* Toolbar: search + filter + bulk select */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search structures..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 220 }}
        />

        {/* System filter chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            size="small"
            color={!systemFilter ? 'primary' : 'default'}
            variant={!systemFilter ? 'filled' : 'outlined'}
            onClick={() => setSystemFilter(null)}
            clickable
          />
          {selectedSystems.map((sys) => (
            <Chip
              key={sys}
              label={sys}
              size="small"
              color={systemFilter === sys ? 'primary' : 'default'}
              variant={systemFilter === sys ? 'filled' : 'outlined'}
              onClick={() => setSystemFilter(systemFilter === sys ? null : sys)}
              clickable
              sx={{ textTransform: 'capitalize' }}
            />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Bulk select by system */}
        {selectedSystems.map((sys) => (
          <Button
            key={sys}
            size="small"
            variant="outlined"
            startIcon={<SelectAllIcon />}
            onClick={() => handleSelectAllBySystem(sys)}
            sx={{ textTransform: 'capitalize', fontSize: '0.75rem' }}
          >
            All {sys}
          </Button>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {selectedStructureIds.length} of {filteredStructures.length} structures selected
        {' · '}
        Total points: {Object.values(structureConfigs).reduce(
          (sum, c) => sum + (c.pointsPossible ?? 1),
          0
        )}
      </Typography>

      {isLoading ? (
        <Skeleton variant="rounded" height={400} />
      ) : (
        <Box sx={{ height: 420 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            checkboxSelection
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={handleSelectionChange}
            processRowUpdate={(updatedRow) => {
              handleCellEdit({
                id: updatedRow.id,
                field: 'pointsPossible',
                value: updatedRow.pointsPossible,
              });
              handleCellEdit({
                id: updatedRow.id,
                field: 'isRequired',
                value: updatedRow.isRequired,
              });
              return updatedRow;
            }}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            density="compact"
            disableColumnMenu
            sx={{
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { backgroundColor: 'action.hover' },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
