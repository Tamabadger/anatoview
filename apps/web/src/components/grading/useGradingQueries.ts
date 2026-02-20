import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  LabGradesResponse,
  LabListItem,
  AttemptDetail,
  LabResultsResponse,
  LabAnalyticsResponse,
  GradeOverridePayload,
} from './types';

// ─── Lab list for filter dropdown ───────────────────────────────

export function useLabsList(courseId: string | undefined) {
  return useQuery({
    queryKey: ['labs', courseId],
    queryFn: async () => {
      const resp = await apiClient.get<{ labs: LabListItem[]; total: number }>(
        '/labs',
        { params: { courseId } }
      );
      return resp.data.labs;
    },
    enabled: !!courseId,
  });
}

// ─── Grades for a specific lab ──────────────────────────────────

export function useLabGrades(labId: string | undefined) {
  return useQuery({
    queryKey: ['lab-grades', labId],
    queryFn: async () => {
      const resp = await apiClient.get<LabGradesResponse>(`/labs/${labId}/grades`);
      return resp.data;
    },
    enabled: !!labId,
  });
}

// ─── Lab results (stats + attempts) ─────────────────────────────

export function useLabResults(labId: string | undefined) {
  return useQuery({
    queryKey: ['lab-results', labId],
    queryFn: async () => {
      const resp = await apiClient.get<LabResultsResponse>(`/labs/${labId}/results`);
      return resp.data;
    },
    enabled: !!labId,
  });
}

// ─── Lab analytics (per-structure breakdown) ────────────────────

export function useLabAnalytics(labId: string | undefined) {
  return useQuery({
    queryKey: ['lab-analytics', labId],
    queryFn: async () => {
      const resp = await apiClient.get<LabAnalyticsResponse>(`/labs/${labId}/analytics`);
      return resp.data;
    },
    enabled: !!labId,
  });
}

// ─── Attempt detail (for AttemptReview drawer) ──────────────────

export function useAttemptDetail(attemptId: string | null) {
  return useQuery({
    queryKey: ['attempt-detail', attemptId],
    queryFn: async () => {
      const resp = await apiClient.get<AttemptDetail>(`/attempts/${attemptId}`);
      return resp.data;
    },
    enabled: !!attemptId,
  });
}

// ─── Instructor grade override ──────────────────────────────────

export function useGradeOverride(attemptId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GradeOverridePayload) => {
      const resp = await apiClient.put(`/attempts/${attemptId}/grade`, payload);
      return resp.data;
    },
    onSuccess: () => {
      // Invalidate attempt detail and lab grades
      queryClient.invalidateQueries({ queryKey: ['attempt-detail', attemptId] });
      queryClient.invalidateQueries({ queryKey: ['lab-grades'] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
    },
  });
}

// ─── Canvas sync: single attempt ────────────────────────────────

export function useSyncToCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attemptId: string) => {
      const resp = await apiClient.post(`/grades/${attemptId}/sync`);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-grades'] });
      queryClient.invalidateQueries({ queryKey: ['attempt-detail'] });
    },
  });
}

// ─── Canvas sync: all grades for a lab ──────────────────────────

export function useSyncAllToCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labId: string) => {
      const resp = await apiClient.post(`/grades/labs/${labId}/grades/sync`);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-grades'] });
    },
  });
}
