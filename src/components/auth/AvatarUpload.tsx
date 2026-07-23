import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  value: string | null;
  name?: string;
  onChange: (dataUrl: string | null) => void;
  className?: string;
  labels?: { photo: string; tap: string; remove: string };
}

export function AvatarUpload({ value, name = '', onChange, className, labels }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photo = labels?.photo ?? 'Profile Photo';
  const tap = labels?.tap ?? 'Tap to upload';
  const remove = labels?.remove ?? 'Remove photo';

  const handleFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <button type="button" onClick={() => inputRef.current?.click()} className="group relative" aria-label={photo}>
        <Avatar className="h-28 w-28 border-4 border-white shadow-lg ring-2 ring-emerald-100">
          {value ? (
            <AvatarImage src={value} alt="Profile" className="object-cover" />
          ) : (
            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-2xl">
              {name ? getInitials(name) : '?'}
            </AvatarFallback>
          )}
        </Avatar>
        <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-105">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">{photo}</p>
        <p className="text-xs text-gray-400 mt-0.5">{tap}</p>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-500 mt-1 hover:underline">
            {remove}
          </button>
        )}
      </div>
    </div>
  );
}
