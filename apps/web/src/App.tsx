import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from '@/router';
import { getAccessToken } from '@/api/client';
import apiClient from '@/api/client';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Root application component.
 * All providers (Theme, QueryClient) are set up in main.tsx.
 *
 * On mount, if we have tokens but no user in the store (e.g. page refresh),
 * hydrate the user and course from /auth/me.
 */
function App() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setCourse = useAppStore((s) => s.setCourse);
  const setLoading = useAppStore((s) => s.setLoading);

  useEffect(() => {
    // Skip hydration if user is already in store (set by dev-login or LTI hash)
    if (user) {
      setLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // We have a token but no user — hydrate from /auth/me
    let cancelled = false;

    apiClient
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          canvasUserId: data.canvasUserId,
          institutionId: data.institutionId,
          institution: data.institution,
        });

        if (data.course) {
          setCourse(data.course);
        }
      })
      .catch(() => {
        // Token is invalid — clear state
        if (!cancelled) {
          useAppStore.getState().reset();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <RouterProvider router={router} />;
}

export default App;
