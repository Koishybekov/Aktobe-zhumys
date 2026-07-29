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
import { ChatPage } from '@/pages/ChatPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AuthPage } from '@/pages/AuthPage';
import { ProfileSetupPage } from '@/pages/ProfileSetupPage';
import { PublicOfferPage } from '@/pages/PublicOfferPage';
import { AdminPage } from '@/pages/AdminPage';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { InstallPrompt } from '@/InstallPrompt';

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const initAuthListener = useAuthStore((s) => s.initAuthListener);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const initialized = useAppStore((s) => s.initialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const initError = useAppStore((s) => s.initError);
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    hydrateLocale();
    void hydrateAuth().finally(() => setBootstrapped(true));
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, [hydrateAuth, hydrateLocale, initAuthListener]);

  useEffect(() => {
    if (isAuthenticated && onboardingCompleted) {
      void initialize();
    }
  }, [isAuthenticated, onboardingCompleted, initialize]);

  if (!bootstrapped || isHydrating) {
    return <AppLoadingScreen />;
  }

  if (initError && !initialized) {
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
                  <AuthPage />
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
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
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
              <Route path="chat/:conversationId" element={<ChatPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
          <InstallPrompt />
        </AppBootstrap>
      </BrowserRouter>
    </ToastContextProvider>
  );
}
