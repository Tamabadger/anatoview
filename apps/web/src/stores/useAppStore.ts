import { create } from 'zustand';
import type { PaletteMode } from '@mui/material';

export type UserRole = 'instructor' | 'student' | 'ta' | 'admin';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  canvasUserId: string;
  institutionId: string;
  institution?: {
    id: string;
    name: string;
    canvasUrl: string;
  };
}

export interface Course {
  id: string;
  name: string;
  canvasCourseId: string;
  institutionId: string;
  term?: string;
}

interface AppState {
  user: User | null;
  course: Course | null;
  isLoading: boolean;
  themeMode: PaletteMode;

  setUser: (user: User | null) => void;
  setCourse: (course: Course | null) => void;
  setLoading: (loading: boolean) => void;
  toggleTheme: () => void;
  reset: () => void;
}

// Read saved preference from localStorage, default to 'light'
function getInitialThemeMode(): PaletteMode {
  try {
    const saved = localStorage.getItem('anatoview-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // localStorage may not be available
  }
  return 'light';
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  course: null,
  isLoading: true,
  themeMode: getInitialThemeMode(),

  setUser: (user) => set({ user }),
  setCourse: (course) => set({ course }),
  setLoading: (isLoading) => set({ isLoading }),
  toggleTheme: () =>
    set((state) => {
      const next = state.themeMode === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('anatoview-theme', next);
      } catch {
        // Ignore
      }
      return { themeMode: next };
    }),
  reset: () => set({ user: null, course: null, isLoading: false }),
}));
