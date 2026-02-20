import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Button, Divider, Typography, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useParams, useNavigate } from 'react-router-dom';
import { useDissectionStore } from '@/stores/useDissectionStore';
import apiClient from '@/api/client';
import {
  DissectionViewer,
  LayerPanel,
  StructurePopover,
  StructureSearch,
  AnswerInput,
  HintDrawer,
  DissectionProgress,
  AnatomyToolbar,
} from '@/components/dissection';
import type { AnatomicalStructure } from '@/components/dissection/types';
import type { DissectionViewerHandle } from '@/components/dissection';

// ─── Fuzzy matching utilities (mirrors server-side grading) ───

/** Normalize an answer for comparison: lowercase, strip punctuation, collapse spaces */
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/** Wagner-Fischer Levenshtein distance (edit distance between two strings) */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// ─── Types for API responses ──────────────────────────────────

/** Shape returned by GET /labs/:id (with animal.models included) */
interface LabApiResponse {
  id: string;
  title: string;
  instructions: string | null;
  organSystems: string[];
  settings: Record<string, unknown>;
  maxPoints: number;
  animal: {
    id: string;
    commonName: string;
    scientificName: string | null;
    thumbnailUrl: string | null;
    models: {
      id: string;
      organSystem: string;
      modelFileUrl: string;
      layerOrder: number;
      version: string;
    }[];
  };
  structures: {
    id: string;
    structureId: string;
    orderIndex: number;
    pointsPossible: number;
    structure: AnatomicalStructure;
  }[];
}

/** Shape returned by GET /labs/:id/attempt */
interface AttemptData {
  id: string;
  status: string;
  startedAt: string | null;
  attemptNumber: number;
  responses: {
    structureId: string;
    studentAnswer: string | null;
    isCorrect: boolean | null;
    hintsUsed: number;
    timeSpentSeconds: number | null;
  }[];
}

/**
 * Full-screen dissection lab view.
 * This is the main interactive anatomy canvas where students identify structures.
 *
 * Layout:
 *   - Top: Progress bar with timer, score, mode chips, submit button
 *   - Left (~80%): DissectionViewer canvas (Konva Stage)
 *   - Right (~20%): LayerPanel + AnswerInput
 *   - Bottom of canvas: AnatomyToolbar (zoom controls)
 *   - Drawer: HintDrawer (slide-in from right)
 *   - Popover: StructurePopover (explore mode)
 */
export default function DissectionLab() {
  const { id: labId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ─── Store ────────────────────────────────────────────────
  const selectedStructure = useDissectionStore((s) => s.selectedStructure);
  const hintsUsed = useDissectionStore((s) => s.hintsUsed);
  const mode = useDissectionStore((s) => s.mode);
  const zoomLevel = useDissectionStore((s) => s.zoomLevel);
  const answeredStructures = useDissectionStore((s) => s.answeredStructures);
  const setZoom = useDissectionStore((s) => s.setZoom);
  const setPan = useDissectionStore((s) => s.setPan);
  const startTimer = useDissectionStore((s) => s.startTimer);
  const resetDissection = useDissectionStore((s) => s.resetDissection);
  const answerStructure = useDissectionStore((s) => s.answerStructure);
  const useHintStore = useDissectionStore((s) => s.useHint);

  // ─── Local state ──────────────────────────────────────────
  const [labData, setLabData] = useState<LabApiResponse | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [modelUrl, setModelUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hiddenSystems, setHiddenSystems] = useState<Set<string>>(new Set());
  const [popoverStructure, setPopoverStructure] = useState<AnatomicalStructure | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);
  const popoverVirtualRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DissectionViewerHandle>(null);

  // ─── Flatten lab structures into AnatomicalStructure[] ────
  const structures: AnatomicalStructure[] = labData
    ? labData.structures.map((ls) => ls.structure)
    : [];
  const totalStructures = structures.length;
  const selectedStructureData = structures.find((s) => s.id === selectedStructure) ?? null;

  // Extract unique organ systems from structures
  const availableSystems = [
    ...new Set(
      structures.flatMap((s) =>
        s.tags.filter((t) =>
          [
            'cardiovascular',
            'digestive',
            'respiratory',
            'urogenital',
            'skeletal',
            'muscular',
            'nervous',
            'integumentary',
            'lymphatic',
            'endocrine',
            'pulmonary',
          ].includes(t)
        )
      )
    ),
  ];

  // ─── Fetch lab data + get/create attempt + resume ─────────
  useEffect(() => {
    if (!labId) return;

    resetDissection();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch lab details with structures + animal models
        const labResp = await apiClient.get<LabApiResponse>(`/labs/${labId}`);
        const lab = labResp.data;
        setLabData(lab);

        // 2. Resolve SVG model URL from animal's published models
        const primarySystem = lab.organSystems[0];
        const model =
          lab.animal.models.find((m) => m.organSystem === primarySystem) ??
          lab.animal.models[0];
        if (model) {
          setModelUrl(model.modelFileUrl);
        }

        // 3. Get or create an attempt (returns existing responses if resuming)
        const attemptResp = await apiClient.get<AttemptData>(`/labs/${labId}/attempt`);
        let attemptData = attemptResp.data;

        // 4. If not_started, transition to in_progress
        if (attemptData.status === 'not_started') {
          const startResp = await apiClient.post<AttemptData>(
            `/labs/${labId}/attempt/start`
          );
          attemptData = {
            ...attemptData,
            ...startResp.data,
            responses: attemptData.responses,
          };
        }

        setAttempt(attemptData);

        // 5. Restore previous answers (resume flow)
        if (attemptData.responses && attemptData.responses.length > 0) {
          for (const resp of attemptData.responses) {
            if (resp.studentAnswer) {
              answerStructure({
                structureId: resp.structureId,
                studentAnswer: resp.studentAnswer,
                isCorrect: resp.isCorrect ?? undefined,
                hintsUsed: resp.hintsUsed,
                timeSpentSeconds: resp.timeSpentSeconds ?? undefined,
              });
            }
          }
        }

        // 6. Start the timer
        startTimer();
      } catch (err) {
        console.error('[DissectionLab] Failed to initialize:', err);
        setError('Failed to load lab data. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [labId, resetDissection, startTimer, answerStructure]);

  // ─── Callbacks ────────────────────────────────────────────

  const handleToggleSystem = useCallback((system: string) => {
    setHiddenSystems((prev) => {
      const next = new Set(prev);
      if (next.has(system)) {
        next.delete(system);
      } else {
        next.add(system);
      }
      return next;
    });
  }, []);

  const handleAnswer = useCallback(
    (structureId: string, answer: string) => {
      const structure = structures.find((s) => s.id === structureId);
      if (!structure) return;

      // Client-side fuzzy matching (mirrors server-side Levenshtein grading)
      const normalizedAns = normalizeAnswer(answer);
      const normalizedName = normalizeAnswer(structure.name);
      const normalizedLatin = normalizeAnswer(structure.latinName ?? '');

      // Exact match first
      let isCorrect =
        normalizedAns === normalizedName || normalizedAns === normalizedLatin;

      // Fuzzy match: Levenshtein distance ≤ 2
      if (!isCorrect && normalizedAns.length >= 3) {
        const nameDist = levenshteinDistance(normalizedAns, normalizedName);
        const latinDist = normalizedLatin
          ? levenshteinDistance(normalizedAns, normalizedLatin)
          : Infinity;
        isCorrect = Math.min(nameDist, latinDist) <= 2;
      }

      // Get current hint count for this structure
      const existingAnswer = answeredStructures.get(structureId);
      const currentHints = existingAnswer?.hintsUsed ?? 0;

      // Update local store immediately (instant UI feedback)
      answerStructure({
        structureId,
        studentAnswer: answer,
        isCorrect,
        hintsUsed: currentHints,
      });

      // Persist to API (fire-and-forget — don't block UI)
      if (attempt?.id) {
        apiClient
          .post(`/attempts/${attempt.id}/responses`, {
            responses: [
              {
                structureId,
                studentAnswer: answer,
                hintsUsed: currentHints,
              },
            ],
          })
          .catch((err) =>
            console.warn('[DissectionLab] Failed to save response:', err)
          );
      }
    },
    [structures, answerStructure, answeredStructures, attempt]
  );

  /** Wraps the store's useHint and also persists hint usage to the API */
  const handleUseHint = useCallback(
    (structureId: string) => {
      // Update local store
      useHintStore(structureId);

      // Persist updated hint count to API
      if (attempt?.id) {
        const existing = answeredStructures.get(structureId);
        const newHintCount = (existing?.hintsUsed ?? 0) + 1;
        apiClient
          .post(`/attempts/${attempt.id}/responses`, {
            responses: [
              {
                structureId,
                hintsUsed: newHintCount,
                studentAnswer: existing?.studentAnswer ?? null,
              },
            ],
          })
          .catch((err) =>
            console.warn('[DissectionLab] Failed to save hint usage:', err)
          );
      }
    },
    [useHintStore, attempt, answeredStructures]
  );

  const handleStructureClick = useCallback(
    (structureId: string, anchorPosition: { x: number; y: number }) => {
      if (mode !== 'explore') return;

      const structure = structures.find((s) => s.id === structureId);
      if (!structure) return;

      // Position a virtual anchor element for the popover
      const virtualEl = popoverVirtualRef.current;
      if (virtualEl) {
        virtualEl.style.position = 'fixed';
        virtualEl.style.left = `${anchorPosition.x}px`;
        virtualEl.style.top = `${anchorPosition.y}px`;
        virtualEl.style.width = '1px';
        virtualEl.style.height = '1px';
      }
      setPopoverStructure(structure);
      setPopoverAnchorEl(virtualEl);
    },
    [mode, structures]
  );

  const handleClosePopover = useCallback(() => {
    setPopoverStructure(null);
    setPopoverAnchorEl(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!attempt?.id || submitting) return;

    try {
      setSubmitting(true);

      // Bulk save all responses to ensure DB is fully in sync
      const allResponses = Array.from(answeredStructures.values()).map((a) => ({
        structureId: a.structureId,
        studentAnswer: a.studentAnswer,
        hintsUsed: a.hintsUsed,
        timeSpentSeconds: a.timeSpentSeconds,
      }));

      if (allResponses.length > 0) {
        await apiClient.post(`/attempts/${attempt.id}/responses`, {
          responses: allResponses,
        });
      }

      // Submit for grading
      await apiClient.post(`/labs/${labId}/attempt/submit`);

      // Navigate to results review page
      navigate(`/lab/${labId}/results`, { state: { attemptId: attempt.id } });
    } catch (err) {
      console.error('[DissectionLab] Failed to submit:', err);
      setError('Failed to submit lab. Please try again.');
      setSubmitting(false);
    }
  }, [attempt, submitting, answeredStructures, labId, navigate]);

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(4.0, zoomLevel + 0.25));
  }, [zoomLevel, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.25, zoomLevel - 0.25));
  }, [zoomLevel, setZoom]);

  const handleResetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, [setZoom, setPan]);

  const handleFocusStructure = useCallback(
    (structureId: string) => {
      // If the structure is in a hidden system, show that system first
      const struct = structures.find((s) => s.id === structureId);
      if (struct) {
        const systemTag = struct.tags.find((t) => hiddenSystems.has(t));
        if (systemTag) {
          setHiddenSystems((prev) => {
            const next = new Set(prev);
            next.delete(systemTag);
            return next;
          });
        }
      }
      viewerRef.current?.focusStructure(structureId);
    },
    [structures, hiddenSystems]
  );

  // ─── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Loading lab...
        </Typography>
      </Box>
    );
  }

  // ─── Error state (fatal — no lab data) ────────────────────
  if (error && !labData) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  const answeredCount = answeredStructures.size;

  // ─── Render ───────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Virtual anchor for popover positioning */}
      <div
        ref={popoverVirtualRef}
        style={{ position: 'fixed', pointerEvents: 'none' }}
      />

      {/* ─── Top Bar: Progress + Mode + Submit ─────────────── */}
      <Box
        sx={{
          px: { xs: 1.5, md: 3 },
          py: 1.5,
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { xs: 1, md: 2 },
          zIndex: 10,
        }}
      >
        <DissectionProgress totalStructures={totalStructures} />

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon fontSize="small" color="warning" />
          <Typography variant="body2" color="text.secondary">
            Hints: {hintsUsed}
          </Typography>
        </Box>

        {/* Non-fatal error inline */}
        {error && labData && (
          <Alert
            severity="error"
            variant="outlined"
            sx={{ py: 0, px: 1 }}
            onClose={() => setError(null)}
          >
            <Typography variant="caption">{error}</Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={<SendIcon />}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </Button>
      </Box>

      {/* ─── Main Content Area ─────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Canvas Area (~80% on desktop, full width on mobile) */}
        <Box
          sx={{
            flex: { xs: 'none', md: 4 },
            height: { xs: '55vh', md: 'auto' },
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* DissectionViewer canvas */}
          <DissectionViewer
            ref={viewerRef}
            modelUrl={modelUrl}
            structures={structures}
            mode={mode}
            labId={labId ?? ''}
            attemptId={attempt?.id ?? null}
            onAnswer={handleAnswer}
            onStructureClick={handleStructureClick}
            hiddenSystems={hiddenSystems}
          />

          {/* Bottom Toolbar */}
          <AnatomyToolbar
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
          />
        </Box>

        {/* Right Sidebar (~20% on desktop, full width stacked on mobile) */}
        <Box
          sx={{
            flex: { xs: 1, md: 'none' },
            width: { xs: '100%', md: 320 },
            minWidth: { xs: 'auto', md: 280 },
            maxWidth: { xs: '100%', md: 320 },
            backgroundColor: 'background.paper',
            borderLeft: { xs: 'none', md: '1px solid' },
            borderTop: { xs: '1px solid', md: 'none' },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          {/* Structure Search */}
          <StructureSearch
            structures={structures}
            onFocusStructure={handleFocusStructure}
            hiddenSystems={hiddenSystems}
          />

          <Divider />

          {/* Layer Panel */}
          <LayerPanel
            availableSystems={availableSystems}
            hiddenSystems={hiddenSystems}
            onToggleSystem={handleToggleSystem}
          />

          <Divider />

          {/* Answer Input (identify / quiz modes) */}
          {(mode === 'identify' || mode === 'quiz') && (
            <>
              <AnswerInput
                structure={selectedStructureData}
                onSubmitAnswer={handleAnswer}
                onUseHint={handleUseHint}
              />
              <Divider />
            </>
          )}

          {/* Answered Structures Summary */}
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Answered ({answeredCount}/{totalStructures})
            </Typography>
            {answeredCount === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No structures answered yet. Start identifying!
              </Typography>
            ) : (
              Array.from(answeredStructures.values()).map((answer) => {
                const struct = structures.find(
                  (s) => s.id === answer.structureId
                );
                return (
                  <Box
                    key={answer.structureId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      px: 1,
                      borderRadius: 1,
                      mb: 0.5,
                      backgroundColor: answer.isCorrect
                        ? 'success.main'
                        : 'grey.100',
                      color: answer.isCorrect ? 'white' : 'text.primary',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ flex: 1 }}
                    >
                      {struct?.name ?? answer.studentAnswer}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {answer.isCorrect ? '\u2713' : '\u2717'}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* ─── Overlays ──────────────────────────────────────── */}

      {/* Explore mode popover */}
      <StructurePopover
        structure={popoverStructure}
        anchorEl={popoverAnchorEl}
        onClose={handleClosePopover}
      />

      {/* Hint Drawer */}
      <HintDrawer structures={structures} />
    </Box>
  );
}
