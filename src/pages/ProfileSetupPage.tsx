import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/auth/AvatarUpload';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { AKTOBE_DISTRICTS, DEFAULT_CITY, WORKER_SKILL_CATEGORIES } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

export function ProfileSetupPage() {
  const navigate = useNavigate();
  const { t, locale, category } = useTranslation();
  const { profile, selectedRole, completeProfileSetup, isSubmitting, error } = useAuthStore();
  const syncUserFromAuth = useAppStore((s) => s.syncUserFromAuth);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [district, setDistrict] = useState(profile?.district ?? '');
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);

  const showSkills = selectedRole === 'worker' || selectedRole === 'both';

  const toggleSkill = (id: string) => {
    setSkills((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeProfileSetup({
      full_name: fullName.trim(),
      avatar_url: avatar,
      city: DEFAULT_CITY,
      district,
      skills: showSkills ? skills : [],
    });
    syncUserFromAuth();
    navigate('/', { replace: true });
  };

  const districtLabel = (d: (typeof AKTOBE_DISTRICTS)[number]) =>
    locale === 'kk' ? d.labelKk : d.labelRu;

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="mx-auto max-w-md px-5 py-8">
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            {t('almostThere')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('setupProfile')}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
            {DEFAULT_CITY}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
            <AvatarUpload
              value={avatar}
              name={fullName}
              onChange={setAvatar}
              labels={{ photo: t('profilePhoto'), tap: t('tapToUpload'), remove: t('removePhoto') }}
            />
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('fullName')}</Label>
              <Input
                id="fullName"
                placeholder={t('fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <Label>{t('selectDistrict')}</Label>
            <div className="flex flex-wrap gap-2">
              {AKTOBE_DISTRICTS.filter((d) => d.id !== 'all').map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDistrict(d.id)}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-sm font-medium border transition-all',
                    district === d.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                  )}
                >
                  {districtLabel(d)}
                </button>
              ))}
            </div>
          </div>

          {showSkills && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
              <div>
                <Label>{t('selectSkills')}</Label>
                <p className="text-xs text-gray-400 mt-0.5">{t('selectSkillsDesc')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WORKER_SKILL_CATEGORIES.map((cat) => {
                  const selected = skills.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleSkill(cat.id)}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all',
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      )}
                    >
                      {category(cat.id)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : t('enterApp')}
          </Button>

          {profile?.phone && (
            <p className="text-center text-xs text-gray-400">{t('signedInAs')} {profile.phone}</p>
          )}
        </form>
      </div>
    </div>
  );
}
