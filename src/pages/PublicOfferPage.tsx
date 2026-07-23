import { PUBLIC_OFFER } from '@/lib/publicOffer';
import { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n/useTranslation';

export function PublicOfferPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lang, setLang] = useState<'ru' | 'kk'>('ru');

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">{t('termsTitle')}</h1>
            <p className="text-xs text-gray-400">{t('appName')}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Tabs value={lang} onValueChange={(v) => setLang(v as 'ru' | 'kk')}>
          <TabsList className="mb-6">
            <TabsTrigger value="ru">{t('russian')}</TabsTrigger>
            <TabsTrigger value="kk">{t('kazakh')}</TabsTrigger>
          </TabsList>

          <TabsContent value="ru">
            <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-emerald-600">
                <FileText className="h-5 w-5" />
                <span className="font-semibold">{PUBLIC_OFFER.titleRu}</span>
              </div>
              <p className="text-sm text-gray-500">{PUBLIC_OFFER.subtitleRu}</p>
              {PUBLIC_OFFER.sections.map((s) => (
                <section key={s.titleRu}>
                  <h2 className="font-semibold text-gray-900 mb-2">{s.titleRu}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{s.bodyRu}</p>
                </section>
              ))}
            </article>
          </TabsContent>

          <TabsContent value="kk">
            <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-emerald-600">
                <FileText className="h-5 w-5" />
                <span className="font-semibold">{PUBLIC_OFFER.titleKk}</span>
              </div>
              <p className="text-sm text-gray-500">{PUBLIC_OFFER.subtitleKk}</p>
              {PUBLIC_OFFER.sections.map((s) => (
                <section key={s.titleKk}>
                  <h2 className="font-semibold text-gray-900 mb-2">{s.titleKk}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{s.bodyKk}</p>
                </section>
              ))}
            </article>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
