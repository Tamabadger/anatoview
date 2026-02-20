import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────

export interface StructureAnswer {
  structureId: string;
  studentAnswer: string;
  isCorrect?: boolean;
  hintsUsed: number;
  confidenceLevel?: number;
  timeSpentSeconds?: number;
}

// ─── Store ───────────────────────────────────────────────────

interface DissectionState {
  /** Currently visible organ system layer */
  activeLayer: string | null;
  /** Currently selected (highlighted) structure on the canvas */
  selectedStructure: string | null;
  /** Map of structureId → answer data for structures the student has answered */
  answeredStructures: Map<string, StructureAnswer>;
  /** Total hints used across all structures in this session */
  hintsUsed: number;
  /** Whether the hint drawer is open */
  hintDrawerOpen: boolean;
  /** Zoom level for the canvas (1.0 = 100%) */
  zoomLevel: number;
  /** Canvas pan offset */
  panOffset: { x: number; y: number };
  /** Current interaction mode */
  mode: 'explore' | 'identify' | 'quiz';
  /** Timer start time (epoch ms) */
  startTime: number | null;

  // ─── Actions ───────────────────────────────────────────────

  /** Set the active organ system layer */
  setActiveLayer: (layer: string | null) => void;
  /** Select a structure on the canvas */
  selectStructure: (structureId: string | null) => void;
  /** Record a student's answer for a structure */
  answerStructure: (answer: StructureAnswer) => void;
  /** Increment hint usage for a specific structure */
  useHint: (structureId: string) => void;
  /** Toggle the hint drawer */
  toggleHintDrawer: () => void;
  /** Set zoom level */
  setZoom: (level: number) => void;
  /** Set pan offset */
  setPan: (offset: { x: number; y: number }) => void;
  /** Switch interaction mode */
  setMode: (mode: 'explore' | 'identify' | 'quiz') => void;
  /** Start the session timer */
  startTimer: () => void;
  /** Reset the entire dissection state for a new lab */
  resetDissection: () => void;
}

const initialState = {
  activeLayer: null,
  selectedStructure: null,
  answeredStructures: new Map<string, StructureAnswer>(),
  hintsUsed: 0,
  hintDrawerOpen: false,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  mode: 'explore' as const,
  startTime: null,
};

export const useDissectionStore = create<DissectionState>((set) => ({
  ...initialState,

  setActiveLayer: (layer) => set({ activeLayer: layer }),

  selectStructure: (structureId) => set({ selectedStructure: structureId }),

  answerStructure: (answer) =>
    set((state) => {
      const updated = new Map(state.answeredStructures);
      updated.set(answer.structureId, answer);
      return { answeredStructures: updated };
    }),

  useHint: (structureId) =>
    set((state) => {
      const updated = new Map(state.answeredStructures);
      const existing = updated.get(structureId);
      if (existing) {
        updated.set(structureId, {
          ...existing,
          hintsUsed: existing.hintsUsed + 1,
        });
      } else {
        updated.set(structureId, {
          structureId,
          studentAnswer: '',
          hintsUsed: 1,
        });
      }
      return {
        answeredStructures: updated,
        hintsUsed: state.hintsUsed + 1,
      };
    }),

  toggleHintDrawer: () =>
    set((state) => ({ hintDrawerOpen: !state.hintDrawerOpen })),

  setZoom: (level) => set({ zoomLevel: Math.max(0.25, Math.min(4.0, level)) }),

  setPan: (offset) => set({ panOffset: offset }),

  setMode: (mode) => set({ mode }),

  startTimer: () => set({ startTime: Date.now() }),

  resetDissection: () => set({ ...initialState, answeredStructures: new Map() }),
}));
