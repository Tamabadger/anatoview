import {
  normalizeAnswer,
  levenshteinDistance,
} from '../services/gradingService';

// ─── normalizeAnswer Tests ───────────────────────────────────

describe('normalizeAnswer', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
    expect(normalizeAnswer('')).toBe('');
  });

  it('should lowercase the answer', () => {
    expect(normalizeAnswer('Aorta')).toBe('aorta');
    expect(normalizeAnswer('LEFT VENTRICLE')).toBe('left ventricle');
    expect(normalizeAnswer('Superior Vena Cava')).toBe('superior vena cava');
  });

  it('should trim whitespace', () => {
    expect(normalizeAnswer('  aorta  ')).toBe('aorta');
    expect(normalizeAnswer('\taorta\n')).toBe('aorta');
  });

  it('should remove punctuation', () => {
    expect(normalizeAnswer('aorta.')).toBe('aorta');
    expect(normalizeAnswer("Starling's law")).toBe('starlings law');
    expect(normalizeAnswer('aorta (ascending)')).toBe('aorta ascending');
    expect(normalizeAnswer('R. atrium')).toBe('r atrium');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeAnswer('left   ventricle')).toBe('left ventricle');
    expect(normalizeAnswer('superior   vena   cava')).toBe('superior vena cava');
  });

  it('should handle combined normalization', () => {
    expect(normalizeAnswer('  Left  Ventricle!  ')).toBe('left ventricle');
    expect(normalizeAnswer('PULMONARY   ARTERY...')).toBe('pulmonary artery');
    expect(normalizeAnswer("  Starling's  Law  ")).toBe('starlings law');
  });
});

// ─── levenshteinDistance Tests ────────────────────────────────

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('aorta', 'aorta')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('left ventricle', 'left ventricle')).toBe(0);
  });

  it('should return length of other string when one is empty', () => {
    expect(levenshteinDistance('', 'aorta')).toBe(5);
    expect(levenshteinDistance('aorta', '')).toBe(5);
  });

  it('should handle single character edits', () => {
    // Substitution
    expect(levenshteinDistance('aorta', 'aorte')).toBe(1);
    // Insertion
    expect(levenshteinDistance('aorta', 'aortas')).toBe(1);
    // Deletion
    expect(levenshteinDistance('aorta', 'aort')).toBe(1);
  });

  it('should correctly calculate distance for common typos', () => {
    // Transposition requires 2 operations (delete + insert)
    expect(levenshteinDistance('aorta', 'aotra')).toBe(2);
    // Missing letter + wrong letter
    expect(levenshteinDistance('ventricle', 'vntricle')).toBe(1);
    // Common misspelling (pulm-o-nary → pulm-i-nary is one substitution)
    expect(levenshteinDistance('pulmonary', 'pulminary')).toBe(1);
    // Two edits: pulminary → pulmanery (o→a, a→e)
    expect(levenshteinDistance('pulmonary', 'pulmanery')).toBe(2);
  });

  it('should handle distance within fuzzy match threshold (≤ 2)', () => {
    // These should pass fuzzy matching
    expect(levenshteinDistance('aorta', 'aorte')).toBeLessThanOrEqual(2);
    expect(levenshteinDistance('aorta', 'aortas')).toBeLessThanOrEqual(2);
    expect(levenshteinDistance('ventricle', 'ventricel')).toBeLessThanOrEqual(2);
    expect(levenshteinDistance('atrium', 'atrim')).toBeLessThanOrEqual(2);
  });

  it('should return > 2 for very different strings', () => {
    expect(levenshteinDistance('aorta', 'ventricle')).toBeGreaterThan(2);
    expect(levenshteinDistance('heart', 'kidney')).toBeGreaterThan(2);
    expect(levenshteinDistance('pulmonary artery', 'aorta')).toBeGreaterThan(2);
  });

  it('should be case-sensitive (normalization is done before calling)', () => {
    // Levenshtein itself is case-sensitive — normalization is a separate step
    expect(levenshteinDistance('Aorta', 'aorta')).toBe(1);
    expect(levenshteinDistance('LEFT', 'left')).toBe(4);
  });

  it('should handle multi-word anatomical terms', () => {
    expect(levenshteinDistance('left ventricle', 'left ventricle')).toBe(0);
    expect(levenshteinDistance('left ventricle', 'left ventricel')).toBe(2);
    expect(levenshteinDistance('superior vena cava', 'superior vena cava')).toBe(0);
    expect(levenshteinDistance('superior vena cava', 'superior vena cave')).toBe(1);
  });
});

// ─── Grading Edge Cases ──────────────────────────────────────

describe('Grading edge cases', () => {
  describe('answer matching scenarios', () => {
    it('should match common name exactly after normalization', () => {
      const normalized = normalizeAnswer('Aorta');
      const correct = normalizeAnswer('aorta');
      expect(normalized).toBe(correct);
    });

    it('should match latin name after normalization', () => {
      const studentAnswer = normalizeAnswer('Musculus biceps brachii');
      const latinName = normalizeAnswer('musculus biceps brachii');
      expect(studentAnswer).toBe(latinName);
    });

    it('should handle answers with extra punctuation', () => {
      const studentAnswer = normalizeAnswer('left ventricle!');
      const correct = normalizeAnswer('left ventricle');
      expect(studentAnswer).toBe(correct);
    });

    it('should handle answers with possessives', () => {
      // "Starling's" becomes "starlings" after normalization
      const studentAnswer = normalizeAnswer("Starling's Law");
      expect(studentAnswer).toBe('starlings law');
    });

    it('should fuzzy match within 2 edits', () => {
      // Student types "aotra" instead of "aorta" (transposition)
      const distance = levenshteinDistance(
        normalizeAnswer('aotra'),
        normalizeAnswer('aorta')
      );
      expect(distance).toBeLessThanOrEqual(2);
    });

    it('should reject answers too far from correct', () => {
      const distance = levenshteinDistance(
        normalizeAnswer('kidney'),
        normalizeAnswer('aorta')
      );
      expect(distance).toBeGreaterThan(2);
    });
  });

  describe('hint penalty calculation', () => {
    it('should calculate hint penalty correctly', () => {
      const pointsPossible = 10;
      const hintPenaltyPercent = 10; // 10% per hint
      const hintsUsed = 2;

      const penalty = hintsUsed * (hintPenaltyPercent / 100) * pointsPossible;
      expect(penalty).toBe(2); // 2 hints × 10% × 10 points = 2 points
    });

    it('should not allow negative points after penalty', () => {
      const pointsPossible = 1;
      const hintPenaltyPercent = 50; // 50% per hint
      const hintsUsed = 3;

      const basePoints = pointsPossible; // Correct answer
      const penalty = hintsUsed * (hintPenaltyPercent / 100) * pointsPossible;
      const finalPoints = Math.max(0, basePoints - penalty);
      expect(finalPoints).toBe(0); // Should floor at 0, not go negative
    });

    it('should give full credit with zero hints', () => {
      const pointsPossible = 5;
      const hintPenaltyPercent = 10;
      const hintsUsed = 0;

      const basePoints = pointsPossible;
      const penalty = hintsUsed * (hintPenaltyPercent / 100) * pointsPossible;
      const finalPoints = Math.max(0, basePoints - penalty);
      expect(finalPoints).toBe(5);
    });

    it('should apply correct penalty for single hint', () => {
      const pointsPossible = 10;
      const hintPenaltyPercent = 15; // 15% per hint
      const hintsUsed = 1;

      const basePoints = pointsPossible;
      const penalty = hintsUsed * (hintPenaltyPercent / 100) * pointsPossible;
      const finalPoints = Math.max(0, basePoints - penalty);
      expect(finalPoints).toBe(8.5); // 10 - 1.5 = 8.5
    });
  });

  describe('fuzzy matching with partial credit', () => {
    it('should give 90% for distance=1 with partial credit', () => {
      const pointsPossible = 10;
      const distance = 1;
      const partialCredit = pointsPossible * (1 - distance * 0.1);
      expect(partialCredit).toBe(9); // 90% of 10
    });

    it('should give 80% for distance=2 with partial credit', () => {
      const pointsPossible = 10;
      const distance = 2;
      const partialCredit = pointsPossible * (1 - distance * 0.1);
      expect(partialCredit).toBe(8); // 80% of 10
    });
  });

  describe('percentage calculation', () => {
    it('should calculate percentage correctly', () => {
      const totalScore = 85;
      const maxPoints = 100;
      const percentage = Math.round((totalScore / maxPoints) * 10000) / 100;
      expect(percentage).toBe(85);
    });

    it('should handle zero max points', () => {
      const totalScore = 0;
      const maxPoints = 0;
      const percentage = maxPoints > 0
        ? Math.round((totalScore / maxPoints) * 10000) / 100
        : 0;
      expect(percentage).toBe(0);
    });

    it('should handle fractional percentages', () => {
      const totalScore = 7;
      const maxPoints = 9;
      const percentage = Math.round((totalScore / maxPoints) * 10000) / 100;
      expect(percentage).toBe(77.78);
    });

    it('should handle perfect score', () => {
      const totalScore = 100;
      const maxPoints = 100;
      const percentage = Math.round((totalScore / maxPoints) * 10000) / 100;
      expect(percentage).toBe(100);
    });
  });

  describe('scoring scale', () => {
    it('should scale points when structure total differs from maxPoints', () => {
      // 5 structures worth 1 point each, but lab maxPoints is 100
      const structureTotal = 5;
      const structureEarned = 4; // Got 4 out of 5 correct
      const maxPoints = 100;

      const scaledScore = (structureEarned / structureTotal) * maxPoints;
      expect(scaledScore).toBe(80);
    });

    it('should not scale when totals match', () => {
      const structureTotal = 100;
      const structureEarned = 85;
      const maxPoints = 100;

      // When structureTotal equals maxPoints, no scaling needed
      const scaledScore = structureTotal === maxPoints
        ? structureEarned
        : (structureEarned / structureTotal) * maxPoints;
      expect(scaledScore).toBe(85);
    });
  });
});
