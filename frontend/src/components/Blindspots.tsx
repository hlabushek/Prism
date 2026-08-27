import React from 'react';
import { EyeOff } from 'lucide-react';

interface BlindspotsProps {
  blindspots: string[];
}

export const Blindspots: React.FC<BlindspotsProps> = ({ blindspots }) => {
  if (!blindspots || blindspots.length === 0) return null;

  return (
    <div className="bg-rose-50/80 dark:bg-[#1f0a0d]/60 border border-rose-500/30 rounded-xl p-3 shadow-sm transition-colors">
      <div className="flex items-center space-x-1.5 text-xs text-rose-800 dark:text-rose-400 font-bold mb-2">
        <EyeOff className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        <span>Слепые зоны & умолчания лагерей</span>
      </div>
      <div className="space-y-1.5">
        {blindspots.map((item, idx) => (
          <div
            key={idx}
            className="text-xs text-rose-900 dark:text-rose-200/90 bg-rose-100/70 dark:bg-rose-500/10 border border-rose-300/60 dark:border-rose-500/20 rounded-lg p-2.5 leading-relaxed"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
