import { Box, Typography, Chip, Paper, Badge } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import GradeOverrideField from './GradeOverrideField';
import type { StructureResponseDetail } from './types';

interface StructureGradeRowProps {
  /** The structure response data */
  response: StructureResponseDetail;
  /** Points possible for this structure (from lab config) */
  pointsPossible: number;
  /** Callback to save a grade override */
  onOverride: (responseId: string, points: number) => void;
  /** Whether a save is in progress */
  saving?: boolean;
}

/**
 * A single row in the AttemptReview drawer showing one structure's grading result.
 * Displays: structure name, latin name, student answer (color-coded), correct answer,
 * points earned, hints used, and an override field.
 */
export default function StructureGradeRow({
  response,
  pointsPossible,
  onOverride,
  saving = false,
}: StructureGradeRowProps) {
  const { structure, studentAnswer, isCorrect, hintsUsed, pointsEarned, instructorOverride } =
    response;

  const displayPoints = instructorOverride ?? pointsEarned;
  const hasOverride = instructorOverride !== null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1,
        borderColor: isCorrect ? 'success.light' : isCorrect === false ? 'error.light' : 'divider',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: isCorrect ? 'success.main' : isCorrect === false ? 'error.main' : 'grey.300',
      }}
    >
      {/* Top row: structure name + correctness badge */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {structure.name}
          </Typography>
          {structure.latinName && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {structure.latinName}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {hintsUsed > 0 && (
            <Badge badgeContent={hintsUsed} color="warning" max={9}>
              <LightbulbIcon fontSize="small" color="warning" />
            </Badge>
          )}
          {isCorrect === true && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Correct"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
          {isCorrect === false && (
            <Chip
              icon={<CancelIcon />}
              label="Incorrect"
              size="small"
              color="error"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
          {isCorrect === null && (
            <Chip
              label="Not answered"
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </Box>

      {/* Answer comparison */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Student Answer
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: isCorrect ? 'success.dark' : isCorrect === false ? 'error.dark' : 'text.secondary',
              fontWeight: 500,
            }}
          >
            {studentAnswer || <em>No answer</em>}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Correct Answer
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {structure.name}
          </Typography>
        </Box>
      </Box>

      {/* Points + Override */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 0.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={structure.difficultyLevel}
            size="small"
            variant="outlined"
            sx={{
              textTransform: 'capitalize',
              fontSize: '0.65rem',
              height: 20,
            }}
            color={
              structure.difficultyLevel === 'easy'
                ? 'success'
                : structure.difficultyLevel === 'medium'
                  ? 'warning'
                  : 'error'
            }
          />
          {hintsUsed > 0 && (
            <Typography variant="caption" color="warning.dark">
              {hintsUsed} hint{hintsUsed > 1 ? 's' : ''} used ({hintsUsed * 10}% penalty)
            </Typography>
          )}
        </Box>

        <GradeOverrideField
          currentPoints={Number(displayPoints)}
          maxPoints={pointsPossible}
          hasOverride={hasOverride}
          onOverride={(pts) => onOverride(response.id, pts)}
          saving={saving}
        />
      </Box>
    </Paper>
  );
}
