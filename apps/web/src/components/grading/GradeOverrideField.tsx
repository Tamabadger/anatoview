import { useState } from 'react';
import { Box, TextField, IconButton, Tooltip, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';

interface GradeOverrideFieldProps {
  /** Current points earned (auto-graded or previous override) */
  currentPoints: number;
  /** Maximum possible points for this structure */
  maxPoints: number;
  /** Whether an instructor override already exists */
  hasOverride: boolean;
  /** Callback when instructor saves an override */
  onOverride: (points: number) => void;
  /** Whether a save is in progress */
  saving?: boolean;
}

/**
 * Inline number input for instructor grade overrides.
 * Shows current points with an editable field and save button.
 */
export default function GradeOverrideField({
  currentPoints,
  maxPoints,
  hasOverride,
  onOverride,
  saving = false,
}: GradeOverrideFieldProps) {
  const [value, setValue] = useState<string>(String(currentPoints));
  const [editing, setEditing] = useState(false);

  const numValue = parseFloat(value) || 0;
  const isDirty = numValue !== currentPoints;
  const isValid = numValue >= 0 && numValue <= maxPoints;

  const handleSave = () => {
    if (isValid && isDirty) {
      onOverride(numValue);
      setEditing(false);
    }
  };

  const handleReset = () => {
    setValue(String(currentPoints));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleReset();
    }
  };

  if (!editing) {
    return (
      <Tooltip title="Click to override grade">
        <Box
          onClick={() => setEditing(true)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            border: '1px solid transparent',
            '&:hover': {
              borderColor: 'primary.light',
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Typography
            variant="body2"
            fontWeight={hasOverride ? 700 : 500}
            color={hasOverride ? 'primary.main' : 'text.primary'}
          >
            {currentPoints}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            / {maxPoints}
          </Typography>
          {hasOverride && (
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              (override)
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <TextField
        size="small"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        inputProps={{ min: 0, max: maxPoints, step: 0.5 }}
        error={!isValid}
        sx={{ width: 70 }}
      />
      <Typography variant="caption" color="text.secondary">
        / {maxPoints}
      </Typography>
      <Tooltip title="Save override">
        <span>
          <IconButton
            size="small"
            color="primary"
            onClick={handleSave}
            disabled={!isDirty || !isValid || saving}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Cancel">
        <IconButton size="small" onClick={handleReset}>
          <UndoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
