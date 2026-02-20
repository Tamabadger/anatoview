import {
  Drawer,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useDissectionStore } from '@/stores/useDissectionStore';
import type { AnatomicalStructure } from './types';

interface HintDrawerProps {
  /** All structures available in this lab */
  structures: AnatomicalStructure[];
}

/**
 * Slide-in MUI Drawer that shows hint text for the selected structure.
 * Tracks hints_used in the Zustand store.
 * Each hint usage incurs a 10% penalty on the structure's score.
 */
export default function HintDrawer({ structures }: HintDrawerProps) {
  const hintDrawerOpen = useDissectionStore((s) => s.hintDrawerOpen);
  const toggleHintDrawer = useDissectionStore((s) => s.toggleHintDrawer);
  const selectedStructure = useDissectionStore((s) => s.selectedStructure);
  const hintsUsed = useDissectionStore((s) => s.hintsUsed);
  const answeredStructures = useDissectionStore((s) => s.answeredStructures);

  // Find the full structure data for the selected structure
  const structure = structures.find((s) => s.id === selectedStructure) ?? null;
  const answerData = selectedStructure
    ? answeredStructures.get(selectedStructure)
    : undefined;

  return (
    <Drawer
      anchor="right"
      open={hintDrawerOpen}
      onClose={toggleHintDrawer}
      PaperProps={{
        sx: {
          width: 380,
          maxWidth: '90vw',
        },
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon color="warning" />
          <Typography variant="h6" fontWeight={700}>
            Hints
          </Typography>
        </Box>
        <IconButton size="small" onClick={toggleHintDrawer}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ─── Penalty Warning ────────────────────────────────── */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ borderRadius: 1.5, mb: 2 }}
        >
          <Typography variant="body2">
            Each hint used reduces the structure&apos;s score by <strong>10%</strong>.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${hintsUsed} total hints used`}
            size="small"
            color="warning"
            variant="outlined"
          />
          {answerData && answerData.hintsUsed > 0 && (
            <Chip
              label={`${answerData.hintsUsed} for this structure`}
              size="small"
              color="warning"
            />
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />
      </Box>

      {/* ─── Hint Content ───────────────────────────────────── */}
      <Box sx={{ px: 2, pb: 3, flex: 1, overflow: 'auto' }}>
        {!structure ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <LightbulbIcon
              sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 2 }}
            />
            <Typography variant="body1" color="text.secondary">
              Select a structure on the canvas to see available hints.
            </Typography>
          </Box>
        ) : !structure.hint ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No hint available for <strong>{structure.name}</strong>.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              {structure.name}
            </Typography>
            {structure.latinName && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontStyle: 'italic', mb: 2 }}
              >
                {structure.latinName}
              </Typography>
            )}

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: 'warning.main',
                color: 'warning.contrastText',
              }}
            >
              <Typography variant="body1" fontWeight={500}>
                {structure.hint}
              </Typography>
            </Box>

            {/* Additional context if available */}
            {structure.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {structure.description}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
