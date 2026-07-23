import { useState } from 'react';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PUBLIC_OFFER } from '@/lib/publicOffer';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { APP_NAME } from '@/lib/constants';

interface PublicOfferModalProps {
  open: boolean;
  onClose: () => void;
}

export function PublicOfferModal({ open, onClose }: PublicOfferModalProps) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<'ru' | 'kk'>('ru');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('legal')}</span>
          </div>
          <DialogTitle className="text-left text-xl">
            Публичная оферта / Жария оферта
            <span className="block text-sm font-normal text-gray-400 mt-0.5">{APP_NAME}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={lang} onValueChange={(v) => setLang(v as 'ru' | 'kk')} className="flex flex-col min-h-0 flex-1">
          <TabsList className="mx-6 mt-3 shrink-0">
            <TabsTrigger value="ru">{t('russian')}</TabsTrigger>
            <TabsTrigger value="kk">{t('kazakh')}</TabsTrigger>
          </TabsList>

          <TabsContent value="ru" className="overflow-y-auto px-6 pb-6 mt-3 flex-1">
            <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
              {PUBLIC_OFFER.sections.map((section) => (
                <section key={section.titleRu}>
                  <h3 className="font-semibold text-gray-900 mb-2">{section.titleRu}</h3>
                  <p className="whitespace-pre-line">{section.bodyRu}</p>
                </section>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="kk" className="overflow-y-auto px-6 pb-6 mt-3 flex-1">
            <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
              {PUBLIC_OFFER.sections.map((section) => (
                <section key={section.titleKk}>
                  <h3 className="font-semibold text-gray-900 mb-2">{section.titleKk}</h3>
                  <p className="whitespace-pre-line">{section.bodyKk}</p>
                </section>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface OfferAgreementCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onOpenOffer: () => void;
}

export function OfferAgreementCheckbox({ checked, onCheckedChange, onOpenOffer }: OfferAgreementCheckboxProps) {
  const { t } = useTranslation();

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span className="text-xs text-gray-500 leading-relaxed">
        {t('termsAgree')}{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onOpenOffer(); }} className="text-emerald-600 font-medium underline underline-offset-2">
          {t('publicOffer')}
        </button>{' '}
        {t('and')}{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onOpenOffer(); }} className="text-emerald-600 font-medium underline underline-offset-2">
          {t('privacyPolicy')}
        </button>
      </span>
    </label>
  );
}
