import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'pwa_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const autoPromptAttemptedRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isDismissed = useCallback(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
    setIosHint(false);
  }, []);

  const runInstallPrompt = useCallback(async (source: 'auto' | 'manual') => {
    const event = deferredPromptRef.current;
    if (!event) return false;

    setInstalling(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;

      if (outcome === 'accepted') {
        deferredPromptRef.current = null;
        setVisible(false);
        return true;
      }

      if (source === 'auto') {
        setVisible(true);
      }
      return false;
    } catch {
      if (source === 'auto') {
        setVisible(true);
      }
      return false;
    } finally {
      setInstalling(false);
    }
  }, []);

  useEffect(() => {
    if (isStandaloneMode() || isDismissed()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;

      if (autoPromptAttemptedRef.current) return;
      autoPromptAttemptedRef.current = true;

      window.setTimeout(() => {
        void runInstallPrompt('auto');
      }, 1500);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setVisible(false);
      setIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    if (isIosSafari() && !isStandaloneMode()) {
      window.setTimeout(() => setIosHint(true), 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isDismissed, runInstallPrompt]);

  const handleInstall = () => {
    if (iosHint) {
      dismiss();
      return;
    }
    void runInstallPrompt('manual');
  };

  if (isStandaloneMode() || isDismissed()) return null;
  if (!visible && !iosHint) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 md:bottom-4 left-4 right-4 z-50 mx-auto max-w-md',
        'animate-fade-in'
      )}
      role="dialog"
      aria-live="polite"
      aria-label={t('pwaInstallTitle')}
    >
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{t('pwaInstallTitle')}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {iosHint ? t('pwaInstallIosDesc') : t('pwaInstallDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" size="sm" onClick={handleInstall} disabled={installing}>
            {installing ? t('loading') : iosHint ? t('pwaInstallGotIt') : t('pwaInstallBtn')}
          </Button>
          <Button variant="outline" size="sm" onClick={dismiss}>
            {t('pwaInstallLater')}
          </Button>
        </div>
      </div>
    </div>
  );
}
