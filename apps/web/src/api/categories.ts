import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ─── Types ───────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  _count: { animals: number };
}

export interface CreateCategoryPayload {
  name: string;
  color: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string;
  icon?: string | null;
  sortOrder?: number;
}

// ─── Hooks ───────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const resp = await apiClient.get<{ categories: Category[]; total: number }>('/categories');
      return resp.data.categories;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryPayload) =>
      apiClient.post<Category>('/categories', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryPayload & { id: string }) =>
      apiClient.put<Category>(`/categories/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
