import { Box, ButtonGroup, Button, Chip, Tooltip, Divider } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import ExploreIcon from '@mui/icons-material/Explore';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import QuizIcon from '@mui/icons-material/Quiz';
import { useDissectionStore } from '@/stores/useDissectionStore';
import type { DissectionMode } from './types';

interface AnatomyToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

const MODE_CONFIG: { mode: DissectionMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'explore', label: 'Explore', icon: <ExploreIcon fontSize="small" /> },
  { mode: 'identify', label: 'Identify', icon: <TouchAppIcon fontSize="small" /> },
  { mode: 'quiz', label: 'Quiz', icon: <QuizIcon fontSize="small" /> },
];

/**
 * Toolbar with zoom controls (in/out/reset) and mode selector.
 * Positioned at the bottom of the canvas area.
 */
export default function AnatomyToolbar({
  onZoomIn,
  onZoomOut,
  onResetView,
}: AnatomyToolbarProps) {
  const mode = useDissectionStore((s) => s.mode);
  const zoomLevel = useDissectionStore((s) => s.zoomLevel);
  const setMode = useDissectionStore((s) => s.setMode);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Zoom Controls */}
      <ButtonGroup variant="outlined" size="small">
        <Tooltip title="Zoom Out (-)">
          <Button onClick={onZoomOut} disabled={zoomLevel <= 0.25}>
            <ZoomOutIcon fontSize="small" />
          </Button>
        </Tooltip>
        <Button disabled sx={{ minWidth: 60, fontFamily: 'monospace' }}>
          {Math.round(zoomLevel * 100)}%
        </Button>
        <Tooltip title="Zoom In (+)">
          <Button onClick={onZoomIn} disabled={zoomLevel >= 4.0}>
            <ZoomInIcon fontSize="small" />
          </Button>
        </Tooltip>
      </ButtonGroup>

      <Tooltip title="Reset View">
        <Button variant="outlined" size="small" onClick={onResetView}>
          <CenterFocusStrongIcon fontSize="small" />
        </Button>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Mode Selector */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {MODE_CONFIG.map(({ mode: m, label, icon }) => (
          <Chip
            key={m}
            icon={icon as React.ReactElement}
            label={label}
            size="small"
            color={mode === m ? 'primary' : 'default'}
            variant={mode === m ? 'filled' : 'outlined'}
            onClick={() => setMode(m)}
            clickable
          />
        ))}
      </Box>
    </Box>
  );
}
