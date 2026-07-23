import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContextProvider } from '@/components/ui/use-toast';
import { AppLoadingScreen, AppInitError } from '@/components/ErrorBoundary';
import { ProtectedRoute, AuthRoute, OnboardingRoute } from '@/components/auth/ProtectedRoute';
import { ExplorePage } from '@/pages/ExplorePage';
import { CreateJobPage } from '@/pages/CreateJobPage';
import { MyJobsPage } from '@/pages/MyJobsPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ProfileSetupPage } from '@/pages/ProfileSetupPage';
import { PublicOfferPage } from '@/pages/PublicOfferPage';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [authHydrated, setAuthHydrated] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const initialized = useAppStore((s) => s.initialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const initError = useAppStore((s) => s.initError);
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    hydrateLocale();
    hydrateAuth();
    setAuthHydrated(true);
  }, [hydrateAuth, hydrateLocale]);

  useEffect(() => {
    if (isAuthenticated && onboardingCompleted) {
      void initialize();
    }
  }, [isAuthenticated, onboardingCompleted, initialize]);

  if (!authHydrated) {
    return <AppLoadingScreen />;
  }

  if (initError) {
    return <AppInitError message={initError} onRetry={() => void initialize()} />;
  }

  if (isAuthenticated && onboardingCompleted && !initialized && isLoading) {
    return <AppLoadingScreen />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastContextProvider>
      <BrowserRouter>
        <AppBootstrap>
          <Routes>
            <Route
              path="/auth"
              element={
                <AuthRoute>
                  <OnboardingPage />
                </AuthRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <ProfileSetupPage />
                </OnboardingRoute>
              }
            />
            <Route path="/offer" element={<PublicOfferPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ExplorePage />} />
              <Route path="create" element={<CreateJobPage />} />
              <Route path="my-jobs" element={<MyJobsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </AppBootstrap>
      </BrowserRouter>
    </ToastContextProvider>
  );
}
