import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { isOnboardingCompletedLocal } from '@/lib/authStorage';

function isOnboardingDone(onboardingCompleted: boolean): boolean {
  return onboardingCompleted || isOnboardingCompletedLocal();
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!isOnboardingDone(onboardingCompleted)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  if (isAuthenticated && isOnboardingDone(onboardingCompleted)) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && !isOnboardingDone(onboardingCompleted)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (isOnboardingDone(onboardingCompleted)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
