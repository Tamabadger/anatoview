import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Chip,
  Collapse,
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useDissectionStore } from '@/stores/useDissectionStore';
import type { AnatomicalStructure, DissectionEvent } from './types';

interface AnswerInputProps {
  /** The structure the student is identifying */
  structure: AnatomicalStructure | null;
  /** Callback when student submits an answer */
  onSubmitAnswer: (structureId: string, answer: string) => void;
  /** Callback when student uses a hint — persists to API via parent */
  onUseHint?: (structureId: string) => void;
  /** Event tracker from useEventBatcher */
  trackEvent?: (event: DissectionEvent) => void;
}

type FeedbackState = 'idle' | 'correct' | 'incorrect';

/**
 * Text input for identifying an anatomical structure.
 * Shows immediate visual feedback (green/red) after submission.
 * Auto-focuses when a structure is selected.
 */
export default function AnswerInput({
  structure,
  onSubmitAnswer,
  onUseHint,
  trackEvent,
}: AnswerInputProps) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const answeredStructures = useDissectionStore((s) => s.answeredStructures);
  const toggleHintDrawer = useDissectionStore((s) => s.toggleHintDrawer);
  const useHintStore = useDissectionStore((s) => s.useHint);

  // Auto-focus when a new structure is selected
  useEffect(() => {
    if (structure) {
      setAnswer('');
      setFeedback('idle');
      // Small delay to let the DOM settle
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [structure?.id]);

  // Check if structure is already answered
  const existingAnswer = structure ? answeredStructures.get(structure.id) : undefined;

  const handleSubmit = useCallback(() => {
    if (!structure || !answer.trim()) return;

    trackEvent?.({
      eventType: 'answer_submit',
      structureId: structure.id,
      payload: { answer: answer.trim() },
    });

    onSubmitAnswer(structure.id, answer.trim());

    // Check if the answer was correct by reading the updated store
    // The parent (DissectionViewer) handles the actual grading via onSubmitAnswer
    // We show feedback based on the store update in the next render
  }, [structure, answer, onSubmitAnswer, trackEvent]);

  // Watch for answer updates to show feedback
  useEffect(() => {
    if (!structure) return;
    const updated = answeredStructures.get(structure.id);
    if (updated && updated.studentAnswer) {
      setFeedback(updated.isCorrect ? 'correct' : 'incorrect');
    }
  }, [answeredStructures, structure]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleHintRequest = () => {
    if (!structure) return;
    // Use parent callback if provided (persists to API), fallback to store
    if (onUseHint) {
      onUseHint(structure.id);
    } else {
      useHintStore(structure.id);
    }
    trackEvent?.({
      eventType: 'hint_request',
      structureId: structure.id,
    });
    toggleHintDrawer();
  };

  // ─── No structure selected ───────────────────────────────
  if (!structure) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Identify Structure
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click a structure on the canvas to identify it.
        </Typography>
      </Box>
    );
  }

  // ─── Already answered ────────────────────────────────────
  if (existingAnswer && feedback !== 'idle') {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Identify Structure
        </Typography>

        <Collapse in>
          <Alert
            severity={feedback === 'correct' ? 'success' : 'error'}
            icon={feedback === 'correct' ? <CheckCircleIcon /> : <CancelIcon />}
            sx={{ mb: 1.5, borderRadius: 1.5 }}
          >
            {feedback === 'correct' ? (
              <>
                <strong>Correct!</strong> — {structure.name}
              </>
            ) : (
              <>
                <strong>Incorrect.</strong> You answered: &quot;{existingAnswer.studentAnswer}&quot;
              </>
            )}
          </Alert>
        </Collapse>

        {existingAnswer.hintsUsed > 0 && (
          <Chip
            icon={<LightbulbIcon />}
            label={`${existingAnswer.hintsUsed} hint${existingAnswer.hintsUsed > 1 ? 's' : ''} used`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ mb: 1 }}
          />
        )}

        <Typography variant="body2" color="text.secondary">
          Click another structure to continue.
        </Typography>
      </Box>
    );
  }

  // ─── Active answer input ─────────────────────────────────
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Identify This Structure
      </Typography>

      <TextField
        inputRef={inputRef}
        fullWidth
        size="small"
        placeholder="Type structure name..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={handleKeyDown}
        variant="outlined"
        autoComplete="off"
        sx={{ mb: 1.5 }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          fullWidth
          startIcon={<SendIcon />}
          onClick={handleSubmit}
          disabled={!answer.trim()}
        >
          Check
        </Button>
        {structure.hint && (
          <Button
            variant="outlined"
            size="small"
            color="warning"
            startIcon={<LightbulbIcon />}
            onClick={handleHintRequest}
          >
            Hint
          </Button>
        )}
      </Box>
    </Box>
  );
}
