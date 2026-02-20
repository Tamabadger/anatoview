import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type { Category } from './categories';

// ─── Types ───────────────────────────────────────────────────

export interface AnimalModel {
  id: string;
  organSystem: string;
  version: string;
  thumbnailUrl: string | null;
  layerOrder: number;
}

export interface Animal {
  id: string;
  commonName: string;
  scientificName: string | null;
  categoryId: string;
  category: Category;
  description: string | null;
  thumbnailUrl: string | null;
  modelType: string;
  isActive: boolean;
  createdAt: string;
  models: AnimalModel[];
  _count: { labs: number };
}

export interface CreateAnimalPayload {
  commonName: string;
  scientificName?: string;
  categoryId: string;
  description?: string;
  modelType: 'svg' | 'three_js' | 'photographic';
}

export interface UpdateAnimalPayload {
  commonName?: string;
  scientificName?: string | null;
  categoryId?: string;
  description?: string | null;
  modelType?: 'svg' | 'three_js' | 'photographic';
  isActive?: boolean;
}

export interface DissectionModel {
  id: string;
  animalId: string;
  organSystem: string;
  version: string;
  modelFileUrl: string;
  thumbnailUrl: string | null;
  layerOrder: number;
  isPublished: boolean;
  createdAt: string;
  animal?: { id: string; commonName: string };
  _count?: { structures: number };
}

export interface CreateModelPayload {
  animalId: string;
  organSystem: string;
  version?: string;
  layerOrder?: number;
}

export interface Structure {
  name: string;
  latinName?: string;
  svgElementId?: string;
  description?: string;
  funFact?: string;
  hint?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

// ─── Animal Hooks ────────────────────────────────────────────

export function useAnimals(params?: { categoryId?: string; search?: string; active?: string }) {
  return useQuery({
    queryKey: ['animals', params],
    queryFn: async () => {
      const resp = await apiClient.get<{ animals: Animal[]; total: number }>('/animals', { params });
      return resp.data;
    },
  });
}

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: ['animals', id],
    queryFn: async () => {
      const resp = await apiClient.get<Animal>(`/animals/${id}`);
      return resp.data;
    },
    enabled: !!id,
  });
}

export function useCreateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnimalPayload) =>
      apiClient.post<Animal>('/animals', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function useUpdateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAnimalPayload & { id: string }) =>
      apiClient.put<Animal>(`/animals/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function useDeleteAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/animals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function useUploadThumbnail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ animalId, file }: { animalId: string; file: File }) => {
      const formData = new FormData();
      formData.append('thumbnail', file);
      return apiClient.post(`/animals/${animalId}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

// ─── Model Hooks ─────────────────────────────────────────────

export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateModelPayload) =>
      apiClient.post<DissectionModel>('/models', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function useUploadModelSvg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, file }: { modelId: string; file: File }) => {
      const formData = new FormData();
      formData.append('model', file);
      return apiClient.post(`/models/${modelId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function usePublishModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) => apiClient.post(`/models/${modelId}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}

export function useCreateStructures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, structures }: { modelId: string; structures: Structure[] }) =>
      apiClient.post(`/models/${modelId}/structures`, { structures }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  });
}
