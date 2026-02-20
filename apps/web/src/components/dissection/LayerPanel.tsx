import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import { useDissectionStore } from '@/stores/useDissectionStore';
import type { DissectionEvent } from './types';

/** Colour per organ system — matches the API seed data conventions */
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

interface LayerPanelProps {
  /** List of organ systems present in the current model */
  availableSystems: string[];
  /** Currently hidden systems — toggled off by the student */
  hiddenSystems: Set<string>;
  /** Callback to toggle a system on/off */
  onToggleSystem: (system: string) => void;
  /** Event tracker from useEventBatcher */
  trackEvent?: (event: DissectionEvent) => void;
}

/**
 * Sidebar panel listing organ-system layers with toggle switches.
 * Toggling a layer hides/shows the corresponding Konva group on the canvas.
 */
export default function LayerPanel({
  availableSystems,
  hiddenSystems,
  onToggleSystem,
  trackEvent,
}: LayerPanelProps) {
  const activeLayer = useDissectionStore((s) => s.activeLayer);
  const setActiveLayer = useDissectionStore((s) => s.setActiveLayer);

  const handleToggle = (system: string) => {
    onToggleSystem(system);
    trackEvent?.({
      eventType: 'layer_toggle',
      payload: { system, visible: hiddenSystems.has(system) },
    });
  };

  const handleFocus = (system: string) => {
    setActiveLayer(activeLayer === system ? null : system);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LayersIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={700}>
          Organ Systems
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        Toggle visibility or click the chip to isolate a system.
      </Typography>

      <Divider sx={{ mb: 1.5 }} />

      {availableSystems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No organ systems available for this model.
        </Typography>
      )}

      {availableSystems.map((system) => {
        const visible = !hiddenSystems.has(system);
        const focused = activeLayer === system;
        const color = SYSTEM_COLORS[system] ?? '#607D8B';

        return (
          <Box
            key={system}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 0.5,
              px: 1,
              borderRadius: 1,
              backgroundColor: focused ? `${color}10` : 'transparent',
              transition: 'background-color 0.2s',
              '&:hover': { backgroundColor: `${color}08` },
            }}
          >
            <Chip
              label={system}
              size="small"
              onClick={() => handleFocus(system)}
              sx={{
                textTransform: 'capitalize',
                fontWeight: focused ? 700 : 500,
                backgroundColor: focused ? `${color}25` : 'transparent',
                color: focused ? color : 'text.primary',
                border: `1px solid ${color}40`,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: `${color}18`,
                },
              }}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={visible}
                  onChange={() => handleToggle(system)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: color,
                    },
                  }}
                />
              }
              label=""
              sx={{ mr: 0 }}
            />
          </Box>
        );
      })}

      {hiddenSystems.size > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {hiddenSystems.size} system{hiddenSystems.size > 1 ? 's' : ''} hidden
          </Typography>
        </Box>
      )}
    </Box>
  );
}
