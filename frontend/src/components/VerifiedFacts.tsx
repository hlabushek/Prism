import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface VerifiedFactsProps {
  facts: string[];
}

export const VerifiedFacts: React.FC<VerifiedFactsProps> = ({ facts }) => {
  if (!facts || facts.length === 0) return null;

  return (
    <div className="bg-emerald-50/80 dark:bg-[#071a14]/60 border border-emerald-500/30 rounded-xl p-3 shadow-sm transition-colors">
      <div className="flex items-center space-x-1.5 text-xs text-emerald-800 dark:text-emerald-400 font-bold mb-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>Верифицированные факты (2+ независимых лагеря)</span>
      </div>
      <ul className="space-y-1.5">
        {facts.map((fact, idx) => (
          <li key={idx} className="flex items-start space-x-2 text-xs text-slate-800 dark:text-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0 shadow-sm" />
            <span className="leading-relaxed font-normal">{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
