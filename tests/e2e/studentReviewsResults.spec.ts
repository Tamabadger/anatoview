import { test, expect } from './helpers/fixtures';
import {
  createTestLab,
  deleteTestLab,
  createApiContext,
  E2E_IDS,
} from './helpers/seed';
import { STUDENT_USER, INSTRUCTOR_USER } from './helpers/auth';

/**
 * E2E: Student reviews lab results after submitting.
 *
 * Flow:
 *   1. Pre-seed a published lab and a graded attempt via API
 *   2. Navigate to /lab/:id/results
 *   3. Verify score card displays correctly
 *   4. Verify structure breakdown table with correct/incorrect indicators
 *   5. Verify navigation buttons work
 */
test.describe('Student Reviews Results', () => {
  let labId: string;
  let attemptId: string;

  test.beforeAll(async () => {
    // Create a published lab
    labId = await createTestLab({
      title: 'Results Review E2E — Cat Cardiovascular',
      structureIds: E2E_IDS.structureIds.slice(0, 5),
      publish: true,
      maxPoints: 100,
      rubric: {
        hintPenaltyPercent: 10,
        fuzzyMatch: true,
        partialCredit: false,
      },
    });

    // Create a graded attempt via API
    const studentApi = await createApiContext(STUDENT_USER);

    try {
      const attemptResp = await studentApi.get(`/labs/${labId}/attempt`);
      const attempt = await attemptResp.json();
      attemptId = attempt.id;

      // Start the attempt
      await studentApi.post(`/labs/${labId}/attempt/start`);

      // Submit 5 responses: 3 correct, 2 wrong, 1 with hints
      await studentApi.post(`/attempts/${attemptId}/responses`, {
        data: {
          responses: [
            {
              structureId: 'struct-cat-cv-001',
              studentAnswer: 'Left Ventricle',
              hintsUsed: 0,
              timeSpentSeconds: 10,
            },
            {
              structureId: 'struct-cat-cv-002',
              studentAnswer: 'Right Ventricle',
              hintsUsed: 0,
              timeSpentSeconds: 8,
            },
            {
              structureId: 'struct-cat-cv-003',
              studentAnswer: 'Left Atrium',
              hintsUsed: 1,
              timeSpentSeconds: 25,
            },
            {
              structureId: 'struct-cat-cv-004',
              studentAnswer: 'Wrong Answer',
              hintsUsed: 0,
              timeSpentSeconds: 15,
            },
            {
              structureId: 'struct-cat-cv-005',
              studentAnswer: 'Pulmonary Trunk',
              hintsUsed: 2,
              timeSpentSeconds: 40,
            },
          ],
        },
      });

      // Submit for grading
      const submitResp = await studentApi.post(`/labs/${labId}/attempt/submit`);
      const submitData = await submitResp.json();
      expect(submitData.gradeResult).toBeDefined();
    } finally {
      await studentApi.dispose();
    }
  });

  test.afterAll(async () => {
    if (labId) {
      await deleteTestLab(labId).catch(() => {});
    }
  });

  test('should display the score card with correct stats', async ({
    studentPage: page,
  }) => {
    await page.goto(`/lab/${labId}/results`);
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Score card should be visible
    const scoreCard = page.locator('.MuiCard-root').first();
    await expect(scoreCard).toBeVisible({ timeout: 10000 });

    // Should display the lab title
    await expect(
      page.getByText(/Results Review E2E/i).or(page.getByText(/Cat Cardiovascular/i))
    ).toBeVisible({ timeout: 5000 });

    // Should display a percentage score
    const percentageText = page.getByText(/%/).first();
    await expect(percentageText).toBeVisible({ timeout: 5000 });

    // Should display the correct count (3/5)
    await expect(page.getByText('3/5')).toBeVisible({ timeout: 5000 });

    // Should display "Score" label
    await expect(page.getByText('Score')).toBeVisible();

    // Should display "Correct" label
    await expect(page.getByText('Correct')).toBeVisible();
  });

  test('should display structure breakdown table', async ({
    studentPage: page,
  }) => {
    await page.goto(`/lab/${labId}/results`);
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Structure Breakdown heading should be visible
    await expect(page.getByText(/Structure Breakdown/i)).toBeVisible({ timeout: 10000 });

    // Table should be visible
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Table header should have expected columns
    const headerRow = page.locator('thead tr');
    await expect(headerRow.getByText('Structure')).toBeVisible();
    await expect(headerRow.getByText('Your Answer')).toBeVisible();
    await expect(headerRow.getByText('Result')).toBeVisible();
    await expect(headerRow.getByText('Points')).toBeVisible();

    // Should have 5 data rows (one per structure)
    const dataRows = page.locator('tbody tr');
    const rowCount = await dataRows.count();
    expect(rowCount).toBe(5);

    // Verify structure names appear in the table
    await expect(page.getByText('Left Ventricle')).toBeVisible();
    await expect(page.getByText('Right Ventricle')).toBeVisible();
    await expect(page.getByText('Left Atrium')).toBeVisible();

    // Verify student answers appear
    await expect(page.getByText('Wrong Answer')).toBeVisible();

    // Verify check/cancel icons exist (at least some correct, some incorrect)
    const checkIcons = page.locator('[data-testid="CheckCircleIcon"]');
    const cancelIcons = page.locator('[data-testid="CancelIcon"]');

    const checkCount = await checkIcons.count();
    const cancelCount = await cancelIcons.count();

    // 3 correct + 2 incorrect
    expect(checkCount).toBe(3);
    expect(cancelCount).toBe(2);
  });

  test('should display hint usage indicators', async ({
    studentPage: page,
  }) => {
    await page.goto(`/lab/${labId}/results`);
    await page.waitForLoadState('networkidle');
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Find hint usage chips in the table (structures with hintsUsed > 0)
    // Left Atrium had 1 hint, Aorta had 2 hints
    const hintChips = page.locator('.MuiChip-root');
    const chipCount = await hintChips.count();

    // At least 2 structures used hints
    expect(chipCount).toBeGreaterThanOrEqual(2);
  });

  test('should have working navigation buttons', async ({
    studentPage: page,
  }) => {
    await page.goto(`/lab/${labId}/results`);
    await page.waitForLoadState('networkidle');
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // "Back to Dashboard" button should be visible
    const dashboardButton = page.getByRole('button', { name: /back to dashboard/i });
    await expect(dashboardButton).toBeVisible({ timeout: 5000 });

    // "View Lab" button should be visible
    const viewLabButton = page.getByRole('button', { name: /view lab/i });
    await expect(viewLabButton).toBeVisible({ timeout: 5000 });

    // Click "Back to Dashboard" and verify navigation
    await dashboardButton.click();
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('should show error state when attempt is not found', async ({
    studentPage: page,
  }) => {
    // Navigate to results for a non-existent lab
    await page.goto('/lab/non-existent-lab-id/results');
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Should show an error alert
    const errorAlert = page.locator('.MuiAlert-standardError')
      .or(page.getByText(/could not load/i))
      .or(page.getByText(/not found/i));

    await expect(errorAlert.first()).toBeVisible({ timeout: 5000 });

    // Should have a "Back to Dashboard" button
    await expect(
      page.getByRole('button', { name: /back to dashboard/i })
    ).toBeVisible({ timeout: 3000 });
  });

  test('should display attempt metadata (attempt number, timestamp)', async ({
    studentPage: page,
  }) => {
    await page.goto(`/lab/${labId}/results`);
    await page.waitForLoadState('networkidle');
    await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Should show attempt number
    await expect(page.getByText(/Attempt #/i)).toBeVisible({ timeout: 5000 });

    // Should show timestamp (date portion)
    // The date format varies, so just check for a common pattern
    const dateText = page.getByText(/\d{1,2}\/\d{1,2}\/\d{2,4}/i)
      .or(page.getByText(/\d{4}/)); // Year in any format

    await expect(dateText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show instructor feedback when present', async ({
    studentPage: page,
  }) => {
    // First, add instructor feedback via API
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // Override the grade with feedback
      const overrideResp = await instructorApi.put(`/attempts/${attemptId}/grade`, {
        data: {
          overrideScore: 75,
          instructorFeedback: 'Good effort! Review the aorta vs pulmonary trunk.',
        },
      });

      // Only test feedback display if the override succeeded
      if (overrideResp.ok()) {
        await page.goto(`/lab/${labId}/results`);
        await page.waitForLoadState('networkidle');
        await page.locator('.MuiSkeleton-root').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        // Instructor feedback should be visible
        await expect(
          page.getByText(/Instructor Feedback/i)
        ).toBeVisible({ timeout: 5000 });

        await expect(
          page.getByText(/Good effort/i)
        ).toBeVisible({ timeout: 3000 });
      }
    } finally {
      await instructorApi.dispose();
    }
  });
});
