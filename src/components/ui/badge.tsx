import { cn } from '@/lib/utils';
import { CATEGORY_COLORS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface BadgeProps {
  children: React.ReactNode;
  category?: string;
  className?: string;
}

export function Badge({ children, category, className }: BadgeProps) {
  const colorClass = category ? CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colorClass, className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { status: label } = useTranslation();
  const config: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config[status] ?? 'bg-gray-100 text-gray-600')}>
      {label(status)}
    </span>
  );
}

export function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const safeRating =
    typeof rating === 'number' && !Number.isNaN(rating) ? rating : Number(rating) || 0;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={cn(
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5',
            i < Math.floor(safeRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'
          )}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className={cn('ml-1 text-gray-600 font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {safeRating.toFixed(1)}
      </span>
    </div>
  );
}

export function InteractiveStarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95"
        >
          <svg
            className={cn('w-8 h-8 transition-colors', i < value ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200 hover:text-amber-200 hover:fill-amber-200')}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
