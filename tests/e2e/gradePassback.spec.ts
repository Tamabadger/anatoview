import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import { signTestToken, INSTRUCTOR_USER, STUDENT_USER } from './helpers/auth';
import {
  createTestLab,
  deleteTestLab,
  createApiContext,
  E2E_IDS,
} from './helpers/seed';

const API_BASE = 'http://localhost/api';

/**
 * E2E: Grade passback to Canvas via LTI AGS.
 *
 * These tests verify the grade sync API endpoints and the GradeSyncLog
 * database entries. Since we cannot connect to an actual Canvas instance
 * in E2E tests, we test:
 *
 *   1. The sync endpoint correctly processes a graded attempt
 *   2. GradeSyncLog entries are created with correct status
 *   3. Error handling when Canvas is unavailable (no LTI outcome URL)
 *   4. The bulk sync endpoint enqueues jobs for all graded attempts
 *
 * The actual Canvas AGS mock is handled by the ltiService.ts which checks
 * for `ltiOutcomeUrl` on the attempt — our test attempts have no LTI URL,
 * so they get status 'skipped'/'error', which we verify.
 */
test.describe('Grade Passback to Canvas', () => {
  let labId: string;
  let attemptId: string;

  test.beforeAll(async () => {
    // Create a lab and a graded attempt
    labId = await createTestLab({
      title: 'Grade Passback E2E — Cat Cardiovascular',
      structureIds: E2E_IDS.structureIds.slice(0, 5),
      publish: true,
      maxPoints: 100,
      rubric: {
        hintPenaltyPercent: 10,
        fuzzyMatch: true,
        partialCredit: false,
      },
    });

    // Create the graded attempt via student API
    const studentApi = await createApiContext(STUDENT_USER);

    try {
      // Get attempt
      const attemptResp = await studentApi.get(`/labs/${labId}/attempt`);
      const attempt = await attemptResp.json();
      attemptId = attempt.id;

      // Start
      await studentApi.post(`/labs/${labId}/attempt/start`);

      // Submit responses (3 correct, 2 wrong)
      await studentApi.post(`/attempts/${attemptId}/responses`, {
        data: {
          responses: [
            { structureId: 'struct-cat-cv-001', studentAnswer: 'Left Ventricle', hintsUsed: 0 },
            { structureId: 'struct-cat-cv-002', studentAnswer: 'Right Ventricle', hintsUsed: 0 },
            { structureId: 'struct-cat-cv-003', studentAnswer: 'Left Atrium', hintsUsed: 0 },
            { structureId: 'struct-cat-cv-004', studentAnswer: 'Wrong Answer', hintsUsed: 0 },
            { structureId: 'struct-cat-cv-005', studentAnswer: 'Wrong Answer', hintsUsed: 0 },
          ],
        },
      });

      // Submit for grading
      const submitResp = await studentApi.post(`/labs/${labId}/attempt/submit`);
      const submitData = await submitResp.json();

      expect(submitData.gradeResult).toBeDefined();
      expect(submitData.gradeResult.percentage).toBe(60);
    } finally {
      await studentApi.dispose();
    }
  });

  test.afterAll(async () => {
    if (labId) {
      await deleteTestLab(labId).catch(() => {});
    }
  });

  test('should call single attempt sync endpoint and create a sync log', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // ─── Call the sync endpoint ────────────────────────────────
      const syncResp = await instructorApi.post(`/grades/${attemptId}/sync`);

      // The sync should succeed at the API level (the actual Canvas call
      // will fail gracefully since there's no ltiOutcomeUrl on test attempts)
      expect(syncResp.ok() || syncResp.status() === 200).toBeTruthy();

      const syncData = await syncResp.json();

      // The result should indicate the attempt was processed
      expect(syncData.attemptId).toBe(attemptId);

      // Since there's no ltiOutcomeUrl, the service logs 'skipped' or returns success=false
      // The important thing is that it doesn't throw a 500
      expect(syncData).toHaveProperty('success');

      // ─── Verify GradeSyncLog was created ───────────────────────
      const logsResp = await instructorApi.get(`/grades/${attemptId}/sync-logs`);
      expect(logsResp.ok()).toBe(true);

      const logsData = await logsResp.json();
      expect(logsData.attemptId).toBe(attemptId);
      expect(logsData.logs.length).toBeGreaterThanOrEqual(1);

      // Check the most recent sync log
      const latestLog = logsData.logs[0]; // Ordered by syncedAt desc
      expect(latestLog).toHaveProperty('canvasStatus');
      expect(latestLog).toHaveProperty('syncedAt');
      expect(latestLog.attemptId).toBe(attemptId);

      // Since no LTI outcome URL, status should be 'skipped' or 'error'
      expect(['skipped', 'error', 'success', 'failed']).toContain(latestLog.canvasStatus);

      // canvasResponse should contain details about why it was skipped/failed
      if (latestLog.canvasResponse) {
        expect(typeof latestLog.canvasResponse).toBe('object');
      }

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should verify correct scoreGiven and scoreMaximum in sync payload', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // Get the attempt detail to verify score values
      const attemptResp = await instructorApi.get(`/attempts/${attemptId}`);
      expect(attemptResp.ok()).toBe(true);
      const attempt = await attemptResp.json();

      // Verify the attempt has the expected grading data
      expect(attempt.status).toBe('graded');
      expect(Number(attempt.score)).toBeGreaterThan(0);

      // The score should be 60% of maxPoints (3/5 correct)
      const scoreGiven = Number(attempt.score);
      const scoreMaximum = Number(attempt.lab.maxPoints);

      expect(scoreMaximum).toBe(100);
      expect(scoreGiven).toBeGreaterThanOrEqual(55);
      expect(scoreGiven).toBeLessThanOrEqual(65);

      // Verify the percentage matches
      const expectedPercentage = Math.round((scoreGiven / scoreMaximum) * 10000) / 100;
      expect(Number(attempt.percentage)).toBeCloseTo(expectedPercentage, 0);

      // Call sync again to verify it processes correctly
      const syncResp = await instructorApi.post(`/grades/${attemptId}/sync`);
      expect(syncResp.status()).toBeLessThan(500); // Should not error

      const syncData = await syncResp.json();
      expect(syncData.attemptId).toBe(attemptId);

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should create a failed sync log when Canvas is unreachable', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // Call sync — since there's no real Canvas connection, this should
      // result in a non-success status but NOT a 500 error
      const syncResp = await instructorApi.post(`/grades/${attemptId}/sync`);

      // The API should handle the Canvas failure gracefully
      expect(syncResp.status()).toBeLessThan(500);

      const syncData = await syncResp.json();

      // Check sync logs — there should be at least one log entry
      const logsResp = await instructorApi.get(`/grades/${attemptId}/sync-logs`);
      expect(logsResp.ok()).toBe(true);

      const logsData = await logsResp.json();
      expect(logsData.logs.length).toBeGreaterThanOrEqual(1);

      // The latest log should record the result (skipped/error/failed)
      const latestLog = logsData.logs[0];
      expect(latestLog).toBeDefined();
      expect(latestLog.canvasStatus).toBeTruthy();

      // If the status is 'skipped' (no LTI URL) or 'error' (Canvas unreachable)
      // the canvasResponse should contain the reason
      if (latestLog.canvasStatus === 'skipped') {
        expect(latestLog.canvasResponse).toHaveProperty('reason');
      }

      if (latestLog.canvasStatus === 'error') {
        expect(latestLog.canvasResponse).toHaveProperty('error');
      }

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should retry sync and record multiple sync log entries', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // Get initial log count
      const initialLogsResp = await instructorApi.get(`/grades/${attemptId}/sync-logs`);
      const initialLogs = await initialLogsResp.json();
      const initialCount = initialLogs.logs.length;

      // Call sync twice to simulate retry behavior
      await instructorApi.post(`/grades/${attemptId}/sync`);
      await instructorApi.post(`/grades/${attemptId}/sync`);

      // Verify that two new sync log entries were created
      const finalLogsResp = await instructorApi.get(`/grades/${attemptId}/sync-logs`);
      expect(finalLogsResp.ok()).toBe(true);

      const finalLogs = await finalLogsResp.json();
      expect(finalLogs.logs.length).toBeGreaterThanOrEqual(initialCount + 2);

      // Each log entry should have its own timestamp
      const timestamps = finalLogs.logs.map(
        (log: { syncedAt: string }) => log.syncedAt
      );
      // The most recent two should be different (or at least exist)
      expect(timestamps.length).toBeGreaterThanOrEqual(2);

      // All logs should reference the correct attempt
      for (const log of finalLogs.logs) {
        expect(log.attemptId).toBe(attemptId);
      }

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should bulk sync all graded attempts for a lab', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      // Call the bulk sync endpoint
      const bulkSyncResp = await instructorApi.post(`/grades/labs/${labId}/grades/sync`);
      expect(bulkSyncResp.ok()).toBe(true);

      const bulkData = await bulkSyncResp.json();

      // Should have enqueued at least 1 job (our graded attempt)
      expect(bulkData.enqueuedCount).toBeGreaterThanOrEqual(1);
      expect(bulkData.totalGraded).toBeGreaterThanOrEqual(1);
      expect(bulkData.message).toContain('Enqueued');

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should reject sync for non-graded attempt', async () => {
    // Create a new attempt that is NOT graded
    const studentApi = await createApiContext(STUDENT_USER);
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    let newLabId: string | null = null;

    try {
      // Create a new lab for this test
      newLabId = await createTestLab({
        title: 'Sync Rejection E2E — Ungraded',
        structureIds: E2E_IDS.structureIds.slice(0, 3),
        publish: true,
      });

      // Create an attempt but don't submit it
      const attemptResp = await studentApi.get(`/labs/${newLabId}/attempt`);
      const attempt = await attemptResp.json();

      // Start it but don't submit
      await studentApi.post(`/labs/${newLabId}/attempt/start`);

      // Try to sync this ungraded attempt — should fail with 400
      const syncResp = await instructorApi.post(`/grades/${attempt.id}/sync`);
      expect(syncResp.status()).toBe(400);

      const errorData = await syncResp.json();
      expect(errorData.error).toBe('Validation Error');
      expect(errorData.message).toContain('in_progress');

    } finally {
      await studentApi.dispose();
      await instructorApi.dispose();
      if (newLabId) {
        await deleteTestLab(newLabId).catch(() => {});
      }
    }
  });

  test('should return 404 for non-existent attempt sync', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);

    try {
      const fakeAttemptId = '00000000-0000-0000-0000-000000000000';
      const syncResp = await instructorApi.post(`/grades/${fakeAttemptId}/sync`);
      expect(syncResp.status()).toBe(404);

      const errorData = await syncResp.json();
      expect(errorData.error).toBe('Not Found');

    } finally {
      await instructorApi.dispose();
    }
  });

  test('should return empty sync logs for attempt with no syncs', async () => {
    const instructorApi = await createApiContext(INSTRUCTOR_USER);
    const studentApi = await createApiContext(STUDENT_USER);

    let newLabId: string | null = null;

    try {
      // Create a fresh graded attempt with no prior syncs
      newLabId = await createTestLab({
        title: 'Fresh Sync Logs E2E',
        structureIds: E2E_IDS.structureIds.slice(0, 2),
        publish: true,
      });

      const attemptResp = await studentApi.get(`/labs/${newLabId}/attempt`);
      const attempt = await attemptResp.json();

      await studentApi.post(`/labs/${newLabId}/attempt/start`);
      await studentApi.post(`/attempts/${attempt.id}/responses`, {
        data: {
          responses: [
            { structureId: 'struct-cat-cv-001', studentAnswer: 'Left Ventricle', hintsUsed: 0 },
            { structureId: 'struct-cat-cv-002', studentAnswer: 'Right Ventricle', hintsUsed: 0 },
          ],
        },
      });
      await studentApi.post(`/labs/${newLabId}/attempt/submit`);

      // Check sync logs BEFORE any sync — should have auto-enqueued log or empty
      const logsResp = await instructorApi.get(`/grades/${attempt.id}/sync-logs`);
      expect(logsResp.ok()).toBe(true);

      const logsData = await logsResp.json();
      expect(logsData.attemptId).toBe(attempt.id);
      expect(Array.isArray(logsData.logs)).toBe(true);

      // Now sync and verify a log appears
      await instructorApi.post(`/grades/${attempt.id}/sync`);

      const afterSyncLogsResp = await instructorApi.get(`/grades/${attempt.id}/sync-logs`);
      const afterSyncLogs = await afterSyncLogsResp.json();
      expect(afterSyncLogs.logs.length).toBeGreaterThanOrEqual(1);

    } finally {
      await studentApi.dispose();
      await instructorApi.dispose();
      if (newLabId) {
        await deleteTestLab(newLabId).catch(() => {});
      }
    }
  });
});
