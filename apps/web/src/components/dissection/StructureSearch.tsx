import { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import type { AnatomicalStructure } from './types';

interface StructureSearchProps {
  /** All structures in the current model */
  structures: AnatomicalStructure[];
  /** Callback to focus/zoom to a specific structure */
  onFocusStructure: (structureId: string) => void;
  /** Currently hidden systems (to show indicator) */
  hiddenSystems?: Set<string>;
}

/**
 * Search bar for finding and zooming to anatomical structures.
 * Matches against name, latinName, and tags.
 * Placed in the right sidebar above the LayerPanel.
 */
export default function StructureSearch({
  structures,
  onFocusStructure,
  hiddenSystems = new Set(),
}: StructureSearchProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    return structures
      .filter((s) => {
        const nameMatch = s.name.toLowerCase().includes(q);
        const latinMatch = s.latinName?.toLowerCase().includes(q);
        const tagMatch = s.tags.some((t) => t.toLowerCase().includes(q));
        return nameMatch || latinMatch || tagMatch;
      })
      .slice(0, 8); // Limit to 8 results for performance
  }, [query, structures]);

  const handleSelect = (structureId: string) => {
    onFocusStructure(structureId);
    setQuery('');
  };

  return (
    <Box sx={{ p: 2, pb: 1 }}>
      <TextField
        placeholder="Search structures..."
        size="small"
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: results.length > 0 ? 1 : 0 }}
      />

      {results.length > 0 && (
        <Paper variant="outlined" sx={{ maxHeight: 240, overflow: 'auto' }}>
          <List dense disablePadding>
            {results.map((struct) => {
              const isInHiddenSystem = struct.tags.some((t) => hiddenSystems.has(t));

              return (
                <ListItemButton
                  key={struct.id}
                  onClick={() => handleSelect(struct.id)}
                  sx={{ py: 0.75 }}
                >
                  <MyLocationIcon
                    fontSize="small"
                    sx={{ mr: 1, color: 'primary.main', opacity: 0.6 }}
                  />
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600}>
                        {struct.name}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        {struct.latinName && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontStyle: 'italic' }}
                          >
                            {struct.latinName}
                          </Typography>
                        )}
                        {isInHiddenSystem && (
                          <Chip
                            label="hidden layer"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 16 }}
                          />
                        )}
                      </Box>
                    }
                  />
                  <Chip
                    label={struct.difficultyLevel}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.6rem',
                      height: 18,
                      textTransform: 'capitalize',
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      )}

      {query.trim() && results.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          No structures found for &ldquo;{query}&rdquo;
        </Typography>
      )}
    </Box>
  );
}
