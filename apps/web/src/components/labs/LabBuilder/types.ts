import { z } from 'zod';

// ─── API Response Types ─────────────────────────────────────────

export interface AnimalListItem {
  id: string;
  commonName: string;
  scientificName: string | null;
  categoryId: string;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  };
  description: string | null;
  thumbnailUrl: string | null;
  modelType: string;
  models: {
    id: string;
    organSystem: string;
    version: string;
    thumbnailUrl: string | null;
    layerOrder: number;
  }[];
  _count: { labs: number };
}

export interface StructureListItem {
  id: string;
  modelId: string;
  name: string;
  latinName: string | null;
  svgElementId: string | null;
  description: string | null;
  funFact: string | null;
  hint: string | null;
  difficultyLevel: string;
  coordinates: unknown;
  tags: string[];
  model: {
    id: string;
    organSystem: string;
    version: string;
  };
}

// ─── Form Data: per-structure rubric config ─────────────────────

export interface StructureRubric {
  structureId: string;
  pointsPossible: number;
  isRequired: boolean;
  acceptedAliases: string[];
  hintPenaltyPercent: number;
  spellingToleranceEnabled: boolean;
  partialCreditEnabled: boolean;
}

// ─── Form Schemas (Zod) ────────────────────────────────────────

export const animalStepSchema = z.object({
  animalId: z.string().min(1, 'Please select an animal'),
});

export const systemStepSchema = z.object({
  organSystems: z.array(z.string()).min(1, 'Select at least one organ system'),
});

export const structureStepSchema = z.object({
  structureIds: z.array(z.string()).min(1, 'Select at least one structure'),
  structureConfigs: z.record(
    z.string(),
    z.object({
      pointsPossible: z.number().min(0).default(1),
      isRequired: z.boolean().default(true),
    })
  ),
});

export const rubricStepSchema = z.object({
  structureRubrics: z.record(
    z.string(),
    z.object({
      acceptedAliases: z.array(z.string()).default([]),
      hintPenaltyPercent: z.number().min(0).max(100).default(10),
      spellingToleranceEnabled: z.boolean().default(true),
      partialCreditEnabled: z.boolean().default(false),
    })
  ),
  categoryWeights: z.record(z.string(), z.number().min(0).max(100)).default({}),
});

export const settingsStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  instructions: z.string().optional().default(''),
  labType: z.enum(['identification', 'dissection', 'quiz', 'practical']),
  timeLimitMinutes: z.number().min(0).max(600).nullable().default(null),
  attemptsAllowed: z.number().min(1).max(100).default(1),
  showHints: z.boolean().default(true),
  randomizeOrder: z.boolean().default(false),
  passingThresholdPercent: z.number().min(0).max(100).default(60),
  dueDate: z.string().optional().default(''),
});

// ─── Combined form data ────────────────────────────────────────

export interface LabBuilderFormData {
  // Step 1
  animalId: string;
  // Step 2
  organSystems: string[];
  // Step 3
  structureIds: string[];
  structureConfigs: Record<string, { pointsPossible: number; isRequired: boolean }>;
  // Step 4
  structureRubrics: Record<
    string,
    {
      acceptedAliases: string[];
      hintPenaltyPercent: number;
      spellingToleranceEnabled: boolean;
      partialCreditEnabled: boolean;
    }
  >;
  categoryWeights: Record<string, number>;
  // Step 5
  title: string;
  instructions: string;
  labType: 'identification' | 'dissection' | 'quiz' | 'practical';
  timeLimitMinutes: number | null;
  attemptsAllowed: number;
  showHints: boolean;
  randomizeOrder: boolean;
  passingThresholdPercent: number;
  dueDate: string;
}

export const defaultFormData: LabBuilderFormData = {
  animalId: '',
  organSystems: [],
  structureIds: [],
  structureConfigs: {},
  structureRubrics: {},
  categoryWeights: {},
  title: '',
  instructions: '',
  labType: 'identification',
  timeLimitMinutes: null,
  attemptsAllowed: 1,
  showHints: true,
  randomizeOrder: false,
  passingThresholdPercent: 60,
  dueDate: '',
};

// ─── Step metadata ─────────────────────────────────────────────

export const LAB_BUILDER_STEPS = [
  { label: 'Select Animal', key: 'animal' },
  { label: 'Organ Systems', key: 'systems' },
  { label: 'Pick Structures', key: 'structures' },
  { label: 'Rubric', key: 'rubric' },
  { label: 'Settings', key: 'settings' },
  { label: 'Review & Publish', key: 'review' },
] as const;

export type StepKey = (typeof LAB_BUILDER_STEPS)[number]['key'];
