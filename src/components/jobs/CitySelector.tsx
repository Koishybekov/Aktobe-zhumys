import { MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CITIES } from '@/lib/constants';

interface CitySelectorProps {
  value: string;
  onChange: (city: string) => void;
}

export function CitySelector({ value, onChange }: CitySelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-10 border-gray-200">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="All">All Cities</SelectItem>
        {CITIES.map((city) => (
          <SelectItem key={city} value={city}>
            {city}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
