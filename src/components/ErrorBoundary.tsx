import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useLocaleStore } from '@/store/useLocaleStore';
import { tStatic } from '@/lib/i18n/useTranslation';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

function ErrorBoundaryFallback({ message, onReload }: { message: string; onReload: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 text-2xl font-bold">
          !
        </div>
        <h1 className="text-lg font-bold text-gray-900">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('errorTitle')}</p>
        {import.meta.env.DEV && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-left text-xs text-gray-400 break-all">{message}</p>
        )}
        <button
          type="button"
          onClick={onReload}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t('reload')}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    const locale = useLocaleStore.getState().locale;
    return { hasError: true, message: error.message || tStatic('unknownError', locale) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Актобе Жұмыс] Render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorBoundaryFallback message={this.state.message} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

export function AppLoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white text-lg font-bold animate-pulse">
        АЖ
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">{APP_NAME}</p>
        <p className="text-xs text-gray-400 mt-1">{t('loading')}</p>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AppInitError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-gray-500">{message || t('couldNotStart')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
