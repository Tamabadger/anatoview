/**
 * Shared types for the Grade Center and grading components.
 * These mirror the API response shapes from /labs/:id/grades and /attempts/:id.
 */

// ─── Grade list (from GET /labs/:id/grades) ─────────────────────

export interface GradeListItem {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  score: number | null;
  percentage: number | null;
  maxPoints: number;
  submittedAt: string | null;
  gradedAt: string | null;
  canvasSyncStatus: string;
  lastSyncAt: string | null;
}

export interface LabGradesResponse {
  lab: {
    id: string;
    title: string;
    maxPoints: number;
  };
  grades: GradeListItem[];
  total: number;
}

// ─── Lab list item (for filter dropdown) ────────────────────────

export interface LabListItem {
  id: string;
  title: string;
  isPublished: boolean;
  maxPoints: number;
  animal: {
    id: string;
    commonName: string;
    thumbnailUrl: string | null;
  };
  _count: {
    structures: number;
    attempts: number;
  };
}

// ─── Attempt detail (from GET /attempts/:id) ────────────────────

export interface StructureResponseDetail {
  id: string;
  attemptId: string;
  structureId: string;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  confidenceLevel: number | null;
  hintsUsed: number;
  timeSpentSeconds: number | null;
  pointsEarned: number;
  autoGraded: boolean;
  instructorOverride: number | null;
  structure: {
    id: string;
    name: string;
    latinName: string | null;
    hint: string | null;
    difficultyLevel: string;
    description: string | null;
    tags: string[];
  };
}

export interface AttemptDetail {
  id: string;
  labId: string;
  studentId: string;
  attemptNumber: number;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  timeSpentSeconds: number | null;
  score: number | null;
  percentage: number | null;
  instructorFeedback: string | null;
  lab: {
    id: string;
    title: string;
    maxPoints: number;
    labType: string;
  };
  student: {
    id: string;
    name: string;
    email: string;
  };
  responses: StructureResponseDetail[];
  syncLogs: {
    id: string;
    canvasStatus: string | null;
    syncedAt: string;
  }[];
}

// ─── Lab results (from GET /labs/:id/results) ───────────────────

export interface LabResultsResponse {
  lab: {
    id: string;
    title: string;
    maxPoints: number;
  };
  attempts: {
    id: string;
    studentId: string;
    attemptNumber: number;
    status: string;
    startedAt: string | null;
    submittedAt: string | null;
    gradedAt: string | null;
    timeSpentSeconds: number | null;
    score: number | null;
    percentage: number | null;
    student: {
      id: string;
      name: string;
      email: string;
      canvasUserId: string;
    };
    _count: { responses: number };
  }[];
  stats: {
    count: number;
    average: number;
    median: number;
    min: number;
    max: number;
  } | null;
}

// ─── Grade override (PUT /attempts/:id/grade body) ──────────────

export interface GradeOverridePayload {
  responseId: string;
  overridePoints: number;
  feedback?: string;
}

// ─── Canvas sync status ─────────────────────────────────────────

export type CanvasSyncStatus = 'not_synced' | 'pending' | 'success' | 'failed';

// ─── Lab analytics (from GET /labs/:id/analytics) ────────────

export interface StructureAnalytics {
  structureId: string;
  name: string;
  latinName: string | null;
  difficultyLevel: string;
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  avgHintsUsed: number;
  avgTimeSeconds: number | null;
}

export interface LabAnalyticsResponse {
  lab: {
    id: string;
    title: string;
    maxPoints: number;
  };
  overview: {
    totalAttempts: number;
    gradedAttempts: number;
    averageScore: number;
    medianScore: number;
    averageTimeSeconds: number | null;
    completionRate: number;
  };
  structureBreakdown: StructureAnalytics[];
  scoreDistribution: { range: string; count: number }[];
  scoreTrend: { date: string; average: number; count: number }[];
}
