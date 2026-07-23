import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { AKTOBE_DISTRICTS } from '@/lib/constants';

interface DistrictFilterProps {
  selected: string;
  onChange: (district: string) => void;
}

export function DistrictFilter({ selected, onChange }: DistrictFilterProps) {
  const { t, locale } = useTranslation();

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {AKTOBE_DISTRICTS.map((d) => {
        const label = d.id === 'all' ? t('allDistricts') : locale === 'kk' ? d.labelKk : d.labelRu;
        return (
          <button
            key={d.id}
            onClick={() => onChange(d.id)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-all',
              selected === d.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
