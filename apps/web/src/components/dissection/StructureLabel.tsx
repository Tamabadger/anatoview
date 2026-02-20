import { Chip } from '@mui/material';
import { Html } from 'react-konva-utils';
import type { DissectionMode } from './types';

interface StructureLabelProps {
  /** Display name for the structure */
  name: string;
  /** Canvas-space X coordinate for placement */
  x: number;
  /** Canvas-space Y coordinate for placement */
  y: number;
  /** Whether this structure has been correctly answered */
  isCorrect?: boolean;
  /** Whether this structure is currently selected */
  isSelected?: boolean;
  /** Current dissection mode — labels hidden in quiz mode */
  mode: DissectionMode;
  /** Whether to show the label (used for hover-only visibility) */
  visible?: boolean;
}

/**
 * Floating label that tracks a structure's coordinates on the Konva canvas.
 * Rendered using react-konva-utils Html bridge to place MUI Chip inside Konva Stage.
 *
 * - explore mode: visible on hover
 * - identify mode: visible after answered
 * - quiz mode: hidden until answered correctly
 */
export default function StructureLabel({
  name,
  x,
  y,
  isCorrect,
  isSelected,
  mode,
  visible = true,
}: StructureLabelProps) {
  // In quiz mode, only show label after correct answer
  if (mode === 'quiz' && !isCorrect) return null;

  // Only render when visible
  if (!visible) return null;

  const chipColor = isCorrect ? 'success' : isSelected ? 'primary' : 'default';
  const chipVariant = isCorrect || isSelected ? 'filled' : 'outlined';

  return (
    <Html
      groupProps={{ x, y: y - 32, listening: false }}
      divProps={{
        style: {
          pointerEvents: 'none',
          transform: 'translate(-50%, 0)',
        },
      }}
    >
      <Chip
        label={name}
        size="small"
        color={chipColor}
        variant={chipVariant}
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          height: 22,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          backgroundColor:
            chipVariant === 'outlined' ? 'rgba(255,255,255,0.92)' : undefined,
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.2s ease-in-out',
          maxWidth: 180,
          '& .MuiChip-label': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }}
      />
    </Html>
  );
}
