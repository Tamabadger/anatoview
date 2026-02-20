import {
  Popover,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import InfoIcon from '@mui/icons-material/Info';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import type { AnatomicalStructure, DissectionEvent } from './types';
import { useDissectionStore } from '@/stores/useDissectionStore';

interface StructurePopoverProps {
  /** The structure to display (null = closed) */
  structure: AnatomicalStructure | null;
  /** Anchor element for positioning */
  anchorEl: HTMLElement | null;
  /** Close callback */
  onClose: () => void;
  /** Event tracker from useEventBatcher */
  trackEvent?: (event: DissectionEvent) => void;
}

/**
 * MUI Popover that shows detailed info about an anatomical structure.
 * Shown in 'explore' mode when a structure is clicked.
 * Displays: name, latinName, description, funFact, and a Hint button.
 */
export default function StructurePopover({
  structure,
  anchorEl,
  onClose,
  trackEvent,
}: StructurePopoverProps) {
  const useHint = useDissectionStore((s) => s.useHint);
  const toggleHintDrawer = useDissectionStore((s) => s.toggleHintDrawer);

  if (!structure) return null;

  const handleHintRequest = () => {
    useHint(structure.id);
    trackEvent?.({
      eventType: 'hint_request',
      structureId: structure.id,
    });
    toggleHintDrawer();
  };

  const difficultyColor =
    structure.difficultyLevel === 'easy'
      ? 'success'
      : structure.difficultyLevel === 'medium'
        ? 'warning'
        : 'error';

  return (
    <Popover
      open={Boolean(anchorEl && structure)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            maxWidth: 360,
            minWidth: 280,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {structure.name}
            </Typography>
            {structure.latinName && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontStyle: 'italic', mt: 0.25 }}
              >
                {structure.latinName}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ ml: 1, mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tags row */}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Chip
            label={structure.difficultyLevel}
            size="small"
            color={difficultyColor as 'success' | 'warning' | 'error'}
            variant="outlined"
            sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
          />
          {structure.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          ))}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Description */}
        {structure.description && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <InfoIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary">
              {structure.description}
            </Typography>
          </Box>
        )}

        {/* Fun Fact */}
        {structure.funFact && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mb: 1.5,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: 'secondary.main',
              color: 'secondary.contrastText',
            }}
          >
            <AutoAwesomeIcon fontSize="small" sx={{ mt: 0.25 }} />
            <Box>
              <Typography variant="caption" fontWeight={700}>
                Fun Fact
              </Typography>
              <Typography variant="body2">{structure.funFact}</Typography>
            </Box>
          </Box>
        )}

        {/* ─── Rich anatomy details ────────────────────────── */}
        {(structure.bloodSupply || structure.innervation || structure.muscleAttachments || structure.clinicalNote) && (
          <Box sx={{ mb: 1.5 }}>
            {structure.bloodSupply && (
              <DetailRow icon={<BloodtypeIcon />} label="Blood Supply" value={structure.bloodSupply} color="#E74C3C" />
            )}
            {structure.innervation && (
              <DetailRow icon={<ElectricBoltIcon />} label="Innervation" value={structure.innervation} color="#F39C12" />
            )}
            {structure.muscleAttachments && (
              <DetailRow icon={<FitnessCenterIcon />} label="Attachments" value={structure.muscleAttachments} color="#E67E22" />
            )}
            {structure.clinicalNote && (
              <DetailRow icon={<LocalHospitalIcon />} label="Clinical Note" value={structure.clinicalNote} color="#3498DB" />
            )}
          </Box>
        )}

        {/* Pronunciation audio */}
        {structure.pronunciationUrl && (
          <Button
            variant="text"
            size="small"
            startIcon={<VolumeUpIcon />}
            onClick={() => {
              const audio = new Audio(structure.pronunciationUrl!);
              audio.play().catch(() => {});
            }}
            sx={{ mb: 1, textTransform: 'none' }}
          >
            Pronunciation
          </Button>
        )}

        {/* Hint button */}
        {structure.hint && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Button
              variant="outlined"
              size="small"
              color="warning"
              fullWidth
              startIcon={<LightbulbIcon />}
              onClick={handleHintRequest}
            >
              Show Hint (−10% penalty)
            </Button>
          </>
        )}
      </Box>
    </Popover>
  );
}

// ─── Helper: compact detail row ──────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'flex-start' }}>
      <Box sx={{ color, mt: 0.25, fontSize: 16, display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
