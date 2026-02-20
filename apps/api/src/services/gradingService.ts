import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { getGradeQueue } from './gradeQueue';

// ─── Types ───────────────────────────────────────────────────

export interface GradeResult {
  attemptId: string;
  totalScore: number;
  maxPoints: number;
  percentage: number;
  structureResults: StructureGradeResult[];
}

export interface StructureGradeResult {
  responseId: string;
  structureId: string;
  structureName: string;
  studentAnswer: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
  hintsUsed: number;
  hintPenalty: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'incorrect';
}

// ─── Main Grading Function ───────────────────────────────────

/**
 * Grade an entire attempt:
 *   1. Load attempt + all structure responses + lab rubric
 *   2. For each structure response:
 *      a. Normalize answer (lowercase, trim, punctuation removed)
 *      b. Check exact match → accepted aliases in rubric
 *      c. Fuzzy match via Levenshtein distance ≤ 2
 *      d. Deduct hint penalty (hintsUsed × hintPenaltyPercent / 100)
 *      e. Calculate pointsEarned with optional partial credit
 *   3. Sum points, weight by category if rubric specifies
 *   4. Write results to lab_attempts + structure_responses
 *   5. Enqueue Canvas grade passback job (Bull queue → worker)
 */
export async function gradeAttempt(attemptId: string): Promise<GradeResult> {
  // 1. Load attempt with all related data
  const attempt = await prisma.labAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lab: {
        include: {
          structures: {
            include: {
              structure: true,
            },
          },
        },
      },
      responses: {
        include: {
          structure: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }

  if (attempt.status === 'graded') {
    throw new Error(`Attempt ${attemptId} has already been graded.`);
  }

  const rubric = (attempt.lab.rubric || {}) as Record<string, any>;
  const hintPenaltyPercent = rubric.hintPenaltyPercent ?? 10; // Default 10% per hint
  const fuzzyMatchEnabled = rubric.fuzzyMatch !== false; // Default enabled
  const partialCredit = rubric.partialCredit ?? false;
  const categoryWeights = rubric.categoryWeights as Record<string, number> | undefined;

  // Build a lookup of lab structures for points possible
  const labStructureMap = new Map<string, { pointsPossible: number }>();
  for (const ls of attempt.lab.structures) {
    labStructureMap.set(ls.structureId, {
      pointsPossible: Number(ls.pointsPossible),
    });
  }

  // Build accepted aliases map from rubric
  const acceptedAliases = (rubric.acceptedAliases || {}) as Record<string, string[]>;

  // 2. Grade each response
  const structureResults: StructureGradeResult[] = [];

  for (const response of attempt.responses) {
    const structure = response.structure;
    const labStructure = labStructureMap.get(response.structureId);
    const pointsPossible = labStructure?.pointsPossible ?? 1;

    // Get all accepted names for this structure
    const correctNames = buildAcceptedNames(structure, acceptedAliases[structure.id]);

    // Normalize student answer
    const normalizedAnswer = normalizeAnswer(response.studentAnswer);

    // Check answer
    let isCorrect = false;
    let matchType: StructureGradeResult['matchType'] = 'incorrect';
    let basePoints = 0;

    if (normalizedAnswer) {
      // a. Exact match
      if (correctNames.some(name => normalizeAnswer(name) === normalizedAnswer)) {
        isCorrect = true;
        matchType = 'exact';
        basePoints = pointsPossible;
      }

      // b. Alias match (check aliases from rubric specifically)
      if (!isCorrect && acceptedAliases[structure.id]) {
        const aliases = acceptedAliases[structure.id].map(a => normalizeAnswer(a));
        if (aliases.includes(normalizedAnswer)) {
          isCorrect = true;
          matchType = 'alias';
          basePoints = pointsPossible;
        }
      }

      // c. Fuzzy match via Levenshtein
      if (!isCorrect && fuzzyMatchEnabled) {
        for (const name of correctNames) {
          const distance = levenshteinDistance(normalizedAnswer, normalizeAnswer(name));
          if (distance <= 2 && distance > 0) {
            isCorrect = true;
            matchType = 'fuzzy';
            // Fuzzy matches get slightly reduced credit
            basePoints = partialCredit
              ? pointsPossible * (1 - distance * 0.1) // 90% for dist=1, 80% for dist=2
              : pointsPossible;
            break;
          }
        }
      }

      // d. Partial credit for close but not matching answers
      if (!isCorrect && partialCredit) {
        const minDistance = Math.min(
          ...correctNames.map(name => levenshteinDistance(normalizedAnswer, normalizeAnswer(name)))
        );
        if (minDistance <= 4) {
          basePoints = pointsPossible * Math.max(0, (5 - minDistance) / 10); // 40%→10%
        }
      }
    }

    // e. Apply hint penalty
    const hintPenalty = response.hintsUsed * (hintPenaltyPercent / 100) * pointsPossible;
    const pointsEarned = Math.max(0, basePoints - hintPenalty);

    structureResults.push({
      responseId: response.id,
      structureId: response.structureId,
      structureName: structure.name,
      studentAnswer: response.studentAnswer,
      isCorrect,
      pointsEarned: Math.round(pointsEarned * 100) / 100, // Round to 2 decimal places
      pointsPossible,
      hintsUsed: response.hintsUsed,
      hintPenalty: Math.round(hintPenalty * 100) / 100,
      matchType,
    });
  }

  // 3. Calculate totals with optional category weighting
  let totalScore: number;
  let maxPoints: number;

  if (categoryWeights && Object.keys(categoryWeights).length > 0) {
    // Category-weighted grading
    const categoryScores = new Map<string, { earned: number; possible: number }>();

    for (const result of structureResults) {
      // Look up the structure's tags/category
      const response = attempt.responses.find(r => r.structureId === result.structureId);
      const structure = response?.structure;
      const category = structure?.tags?.[0] || 'default';

      if (!categoryScores.has(category)) {
        categoryScores.set(category, { earned: 0, possible: 0 });
      }
      const cat = categoryScores.get(category)!;
      cat.earned += result.pointsEarned;
      cat.possible += result.pointsPossible;
    }

    // Apply weights
    totalScore = 0;
    maxPoints = Number(attempt.lab.maxPoints);
    let totalWeight = 0;

    for (const [category, scores] of categoryScores) {
      const weight = categoryWeights[category] ?? 1;
      totalWeight += weight;
      if (scores.possible > 0) {
        totalScore += (scores.earned / scores.possible) * weight;
      }
    }

    if (totalWeight > 0) {
      totalScore = (totalScore / totalWeight) * maxPoints;
    }
  } else {
    // Simple sum grading
    totalScore = structureResults.reduce((sum, r) => sum + r.pointsEarned, 0);
    maxPoints = Number(attempt.lab.maxPoints);

    // Scale to max points if structure points don't equal maxPoints
    const rawMax = structureResults.reduce((sum, r) => sum + r.pointsPossible, 0);
    if (rawMax > 0 && rawMax !== maxPoints) {
      totalScore = (totalScore / rawMax) * maxPoints;
    }
  }

  totalScore = Math.round(totalScore * 100) / 100;
  const percentage = maxPoints > 0 ? Math.round((totalScore / maxPoints) * 10000) / 100 : 0;

  // 4. Write results to DB
  await prisma.$transaction(async (tx) => {
    // Update each structure response
    for (const result of structureResults) {
      await tx.structureResponse.update({
        where: { id: result.responseId },
        data: {
          isCorrect: result.isCorrect,
          pointsEarned: result.pointsEarned,
          autoGraded: true,
        },
      });
    }

    // Update the attempt
    await tx.labAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'graded',
        score: totalScore,
        percentage,
        gradedAt: new Date(),
      },
    });
  });

  // 5. Enqueue Canvas grade passback (async — doesn't block the response)
  try {
    const gradeQueue = getGradeQueue();
    await gradeQueue.add(
      'grade-passback',
      { attemptId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    console.log(`[Grading] Enqueued Canvas grade passback for attempt ${attemptId}`);
  } catch (error: any) {
    // Don't fail the grading if queue is unavailable
    console.warn(`[Grading] Could not enqueue grade passback: ${error.message}`);
  }

  console.log(`[Grading] Graded attempt ${attemptId}: ${totalScore}/${maxPoints} (${percentage}%)`);

  return {
    attemptId,
    totalScore,
    maxPoints,
    percentage,
    structureResults,
  };
}

// ─── Instructor Grade Override ───────────────────────────────

/**
 * Allow an instructor to override the auto-graded score for a specific response.
 */
export async function overrideResponseGrade(
  responseId: string,
  overridePoints: number
): Promise<void> {
  await prisma.structureResponse.update({
    where: { id: responseId },
    data: {
      instructorOverride: overridePoints,
      autoGraded: false,
    },
  });
}

/**
 * Recalculate the attempt total after instructor overrides.
 */
export async function recalculateAttemptScore(attemptId: string): Promise<{
  totalScore: number;
  percentage: number;
}> {
  const attempt = await prisma.labAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lab: { select: { maxPoints: true } },
      responses: {
        include: {
          structure: true,
        },
      },
    },
  });

  if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);

  // Use instructor override if present, otherwise auto-graded points
  const totalEarned = attempt.responses.reduce((sum, r) => {
    const points = r.instructorOverride !== null
      ? Number(r.instructorOverride)
      : Number(r.pointsEarned);
    return sum + points;
  }, 0);

  const maxPoints = Number(attempt.lab.maxPoints);
  const rawMax = attempt.responses.length; // Each response defaults to 1 point
  const totalScore = rawMax > 0 ? (totalEarned / rawMax) * maxPoints : 0;
  const percentage = maxPoints > 0 ? Math.round((totalScore / maxPoints) * 10000) / 100 : 0;

  await prisma.labAttempt.update({
    where: { id: attemptId },
    data: {
      score: Math.round(totalScore * 100) / 100,
      percentage,
    },
  });

  return { totalScore: Math.round(totalScore * 100) / 100, percentage };
}

// ─── Helper Functions ────────────────────────────────────────

/**
 * Normalize an answer string for comparison:
 * - lowercase
 * - trim whitespace
 * - remove punctuation
 * - collapse multiple spaces
 */
export function normalizeAnswer(answer: string | null | undefined): string {
  if (!answer) return '';
  return answer
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse spaces
    .trim();
}

/**
 * Build all accepted names for a structure:
 * - Common name
 * - Latin name (if present)
 * - Additional aliases from rubric
 */
function buildAcceptedNames(
  structure: { name: string; latinName: string | null },
  aliases?: string[]
): string[] {
  const names: string[] = [structure.name];

  if (structure.latinName) {
    names.push(structure.latinName);
  }

  if (aliases && aliases.length > 0) {
    names.push(...aliases);
  }

  return names;
}

/**
 * Calculate the Levenshtein distance between two strings.
 * Uses the Wagner-Fischer dynamic programming algorithm.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two rows instead of full matrix for memory efficiency
  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currentRow = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,      // Insertion
        previousRow[j] + 1,          // Deletion
        previousRow[j - 1] + cost    // Substitution
      );
    }

    // Swap rows
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[b.length];
}
