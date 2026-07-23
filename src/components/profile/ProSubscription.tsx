import { useState } from 'react';
import { Crown, Check, CreditCard, QrCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

interface ProSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onSubscribe: (method: 'kaspi' | 'card') => Promise<void>;
  isSubmitting?: boolean;
}

export function ProSubscriptionModal({ open, onClose, onSubscribe, isSubmitting }: ProSubscriptionModalProps) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<'kaspi' | 'card'>('kaspi');

  const benefits = [t('proBenefit1'), t('proBenefit2'), t('proBenefit3')];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-emerald-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-6 w-6 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">PRO</span>
            </div>
            <DialogTitle className="text-xl text-white text-left">{t('proModalTitle')}</DialogTitle>
            <DialogDescription className="text-indigo-100 text-left">{t('proModalDesc')}</DialogDescription>
            <p className="text-3xl font-bold mt-3">{t('proPrice')}</p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <ul className="space-y-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('paymentMethod')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('kaspi')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                  method === 'kaspi' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <QrCode className="h-6 w-6" />
                <span className="text-xs font-semibold text-center">{t('proKaspi')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                  method === 'card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-xs font-semibold text-center">{t('proCard')}</span>
              </button>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
            size="lg"
            disabled={isSubmitting}
            onClick={() => void onSubscribe(method)}
          >
            <Crown className="h-4 w-4" />
            {isSubmitting ? t('saving') : t('proSubscribe')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProSubscriptionCardProps {
  isPro: boolean;
  onOpenModal: () => void;
}

export function ProSubscriptionCard({ isPro, onOpenModal }: ProSubscriptionCardProps) {
  const { t } = useTranslation();

  if (isPro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-indigo-50 p-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white shrink-0">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{t('proTitle')}</p>
          <p className="text-xs text-emerald-600 font-medium">{t('proActive')} ✓</p>
        </div>
        <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
          {t('proBadge')}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-emerald-50 p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white shrink-0">
        <Crown className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{t('proTitle')}</p>
        <p className="text-sm text-indigo-600 font-bold">{t('proPrice')}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{t('proBenefit1')}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-emerald-600">{t('proSubscribe')} →</span>
    </button>
  );
}
