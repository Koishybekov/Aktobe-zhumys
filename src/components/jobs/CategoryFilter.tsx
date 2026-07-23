import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface CategoryFilterProps {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const { category } = useTranslation();

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={cn(
            'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all',
            selected === cat.id
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
          )}
        >
          {category(cat.id)}
        </button>
      ))}
    </div>
  );
}
