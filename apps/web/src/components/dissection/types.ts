/**
 * Shared types for the dissection engine components.
 * These mirror the Prisma models from the API.
 */

export interface AnatomicalStructure {
  id: string;
  modelId: string;
  name: string;
  latinName: string | null;
  svgElementId: string | null;
  description: string | null;
  funFact: string | null;
  hint: string | null;
  difficultyLevel: string;
  coordinates: { x: number; y: number; width?: number; height?: number } | null;
  tags: string[];
  // ─── Rich anatomy fields (Visible Body-style) ────────────
  bloodSupply: string | null;
  innervation: string | null;
  muscleAttachments: string | null;
  clinicalNote: string | null;
  pronunciationUrl: string | null;
}

export interface DissectionEvent {
  eventType: 'click' | 'hover' | 'zoom' | 'hint_request' | 'layer_toggle' | 'answer_submit';
  structureId?: string;
  payload?: Record<string, unknown>;
}

export type DissectionMode = 'explore' | 'identify' | 'quiz';

/** Parsed SVG structure element with bounding box data */
export interface ParsedSvgStructure {
  structureId: string;
  svgElementId: string;
  system: string;
  pathData: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  bounds: { x: number; y: number; width: number; height: number };
  /** Original transform attribute if present */
  transform?: string;
}

/** Viewport dimensions for the Konva stage */
export interface ViewportSize {
  width: number;
  height: number;
}

/** SVG viewBox parsed dimensions */
export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
