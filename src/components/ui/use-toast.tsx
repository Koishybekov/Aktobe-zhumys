import * as React from 'react';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';

type ToastVariant = 'default' | 'success' | 'error';

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (options: Omit<ToastData, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastContextProvider');
  return ctx;
}

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = React.useCallback((options: Omit<ToastData, 'id'>) => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...options, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider>
        {children}
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-fade-in rounded-xl border px-5 py-3 shadow-lg max-w-sm w-[calc(100%-2rem)] ${
              t.variant === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : t.variant === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="text-xs mt-0.5 opacity-80">{t.description}</p>}
          </div>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
