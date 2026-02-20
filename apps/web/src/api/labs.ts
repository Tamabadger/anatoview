import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import type { Animal } from './animals';

// ─── Types ───────────────────────────────────────────────────

export interface LabListItem {
  id: string;
  title: string;
  instructions: string | null;
  animalId: string;
  organSystems: string[];
  labType: string;
  settings: Record<string, unknown>;
  dueDate: string | null;
  isPublished: boolean;
  maxPoints: number;
  createdAt: string;
  animal: { id: string; commonName: string; thumbnailUrl: string | null };
  _count: { structures: number; attempts: number };
}

export interface LabStructureDetail {
  id: string;
  structureId: string;
  orderIndex: number;
  pointsPossible: number;
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

export interface LabDetail {
  id: string;
  title: string;
  instructions: string | null;
  animalId: string;
  organSystems: string[];
  labType: string;
  settings: Record<string, unknown>;
  rubric: Record<string, unknown>;
  dueDate: string | null;
  isPublished: boolean;
  maxPoints: number;
  createdAt: string;
  course: { id: string; name: string; institutionId: string };
  animal: Animal;
  structures: LabStructureDetail[];
  _count: { attempts: number };
}

// ─── Hooks ───────────────────────────────────────────────────

/**
 * Fetch labs for a given course.
 * Students see only published labs; staff see all.
 */
export function useLabs(courseId: string | undefined) {
  return useQuery({
    queryKey: ['labs', courseId],
    queryFn: async () => {
      const resp = await apiClient.get<{ labs: LabListItem[]; total: number }>(
        '/labs',
        { params: { courseId } }
      );
      return resp.data;
    },
    enabled: !!courseId,
  });
}

/**
 * Fetch full lab detail including structures, animal, and course info.
 */
export function useLab(id: string | undefined) {
  return useQuery({
    queryKey: ['lab', id],
    queryFn: async () => {
      const resp = await apiClient.get<LabDetail>(`/labs/${id}`);
      return resp.data;
    },
    enabled: !!id,
  });
}
