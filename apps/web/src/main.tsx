import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppTheme } from '@/theme/theme';
import App from './App';
import SnackbarProvider from '@/components/shared/SnackbarProvider';
import { setTokens, getAccessToken } from '@/api/client';
import { useAppStore } from '@/stores/useAppStore';

// ─── Parse tokens + course context from URL hash (LTI launch) ──
function extractFromHash(): void {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    setTokens(accessToken, refreshToken);

    // Extract course context if present (set by LTI launch redirect)
    const courseId = params.get('course_id');
    const courseName = params.get('course_name');
    const canvasCourseId = params.get('canvas_course_id');
    const institutionId = params.get('institution_id');

    if (courseId && courseName && canvasCourseId && institutionId) {
      useAppStore.getState().setCourse({
        id: courseId,
        name: courseName,
        canvasCourseId,
        institutionId,
        term: params.get('course_term') || undefined,
      });
    }

    // Clean the URL (remove tokens + course context from hash)
    window.history.replaceState(null, '', window.location.pathname);
  }
}

extractFromHash();

// ─── E2E test injection ──────────────────────────────────────
// When Playwright injects a user via window.__E2E_INJECT_USER__,
// hydrate the store and set tokens so RoleGuard allows access.
if ((window as any).__E2E_INJECT_USER__) {
  const injectedUser = (window as any).__E2E_INJECT_USER__;
  useAppStore.getState().setUser(injectedUser);
  useAppStore.getState().setCourse({
    id: 'e2e-course-001',
    name: 'E2E Test Course',
    canvasCourseId: 'canvas-e2e-course',
    institutionId: injectedUser.institutionId || 'e2e-institution-001',
  });
  useAppStore.getState().setLoading(false);

  // Set tokens if injected
  const injectedToken = (window as any).__E2E_ACCESS_TOKEN__;
  const injectedRefresh = (window as any).__E2E_REFRESH_TOKEN__;
  if (injectedToken) {
    setTokens(injectedToken, injectedRefresh || injectedToken);
  }
}

// ─── React Query Client ──────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Dev mode: auto-login as dev user (no LTI needed) ───────
if (import.meta.env.DEV) {
  // Only auto-login if we don't already have tokens (e.g. from LTI hash)
  if (!getAccessToken()) {
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'instructor' }),
      });

      if (res.ok) {
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        useAppStore.getState().setUser(data.user);
        useAppStore.getState().setCourse({
          id: 'dev-course-001',
          name: 'BIOL 301 — Comparative Vertebrate Anatomy',
          canvasCourseId: 'canvas-dev-course',
          institutionId: 'dev-institution-001',
          term: 'Spring 2026',
        });
      } else {
        console.warn('[Dev] Auto-login failed — run `make seed` to create dev users.');
      }
    } catch {
      console.warn('[Dev] API not reachable for auto-login.');
    }
  }

  useAppStore.getState().setLoading(false);
}

// ─── Themed Root ─────────────────────────────────────────────
// Wraps App in a dynamic ThemeProvider that reacts to store changes.
function ThemedRoot() {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

// ─── Render ──────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedRoot />
    </QueryClientProvider>
  </React.StrictMode>
);
