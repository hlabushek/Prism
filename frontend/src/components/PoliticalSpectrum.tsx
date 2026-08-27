import React, { useState } from 'react';
import { Compass, ChevronDown } from 'lucide-react';
import { PoliticalVectorItem } from '../types';

interface PoliticalSpectrumProps {
  vectors: PoliticalVectorItem[];
}

const CAMP_COLORS: Record<string, { bg: string; text: string; border: string; bar: string; dot: string }> = {
  'Официально-лоялистская': {
    bg: 'bg-[#1969ae]/15',
    text: 'text-[#1969ae] dark:text-[#60a5fa]',
    border: 'border-[#1969ae]/40',
    bar: 'bg-[#1969ae]',
    dot: '#1969ae',
  },
  'Военкоры/Z': {
    bg: 'bg-[#db233d]/15',
    text: 'text-[#db233d] dark:text-[#f87171]',
    border: 'border-[#db233d]/40',
    bar: 'bg-[#db233d]',
    dot: '#db233d',
  },
  'Деловая/Центристская': {
    bg: 'bg-[#1ca369]/15',
    text: 'text-[#16a34a] dark:text-[#4ade80]',
    border: 'border-[#1ca369]/40',
    bar: 'bg-[#1ca369]',
    dot: '#1ca369',
  },
  'Либерально-оппозиционная': {
    bg: 'bg-[#ef9630]/15',
    text: 'text-[#d97706] dark:text-[#fbbf24]',
    border: 'border-[#ef9630]/40',
    bar: 'bg-[#ef9630]',
    dot: '#ef9630',
  },
  'Проукраинская/Внешняя': {
    bg: 'bg-[#f6c82d]/15',
    text: 'text-[#ca8a04] dark:text-[#fde047]',
    border: 'border-[#f6c82d]/40',
    bar: 'bg-[#f6c82d]',
    dot: '#f6c82d',
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-slate-500/10',
  text: 'text-slate-500 dark:text-slate-400',
  border: 'border-slate-500/30',
  bar: 'bg-slate-500',
  dot: '#64748b',
};

export const PoliticalSpectrum: React.FC<PoliticalSpectrumProps> = ({ vectors }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!vectors || vectors.length === 0) return null;

  return (
    <div className="bg-slate-50 dark:bg-[#090f1e]/80 rounded-xl p-3 border border-slate-200 dark:border-white/5 shadow-sm transition-all">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer group select-none"
      >
        <div className="flex items-center space-x-2 text-xs text-slate-800 dark:text-slate-200 font-semibold">
          <Compass className="w-3.5 h-3.5 text-prism-blue" />
          <span>Политический спектр (5 векторов)</span>
        </div>
        <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-xs group-hover:text-slate-800 dark:group-hover:text-slate-200">
          <span>{isExpanded ? 'Свернуть' : 'Подробнее'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
        </div>
      </div>

      {/* Multi-segment Spectrum Bar */}
      <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden flex my-2.5 border border-slate-300/50 dark:border-white/5 shadow-inner">
        {vectors.map((vec, idx) => {
          const isNoData = vec.position.includes('Нет данных') || vec.percentage === 0;
          if (isNoData) return null;
          const style = CAMP_COLORS[vec.camp] || DEFAULT_STYLE;
          const pct = vec.percentage || Math.round(100 / vectors.length);
          return (
            <div
              key={idx}
              className={`${style.bar} h-full transition-all duration-300 hover:brightness-125`}
              style={{ width: `${pct}%` }}
              title={`${vec.camp}: ${pct}%`}
            />
          );
        })}
      </div>

      {/* Mini Badges */}
      <div className="flex flex-wrap gap-1.5">
        {vectors.map((vec, idx) => {
          const isNoData = vec.position.includes('Нет данных') || vec.percentage === 0;
          const style = CAMP_COLORS[vec.camp] || DEFAULT_STYLE;
          return (
            <div
              key={idx}
              className={`text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center space-x-1.5 ${
                isNoData
                  ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 text-slate-400 line-through opacity-70'
                  : `${style.bg} ${style.border} ${style.text}`
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isNoData ? '#94a3b8' : style.dot }} />
              <span>{vec.camp}</span>
              {vec.percentage !== undefined && !isNoData && (
                <span className="opacity-80 font-mono font-bold">({vec.percentage}%)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Smooth Slide-down Expanded Details */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-slate-200 dark:border-white/5' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden space-y-2">
          {vectors.map((vec, idx) => {
            const isNoData = vec.position.includes('Нет данных') || vec.percentage === 0;
            const style = CAMP_COLORS[vec.camp] || DEFAULT_STYLE;
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                  isNoData
                    ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 text-slate-500'
                    : `${style.bg} ${style.border}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isNoData ? '#94a3b8' : style.dot }} />
                    <span className={isNoData ? 'text-slate-500 line-through' : style.text}>{vec.camp}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 font-medium">
                    {isNoData ? 'Не освещался лагерем' : `Тональность: ${vec.tone}`}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed pl-3.5 ${isNoData ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isNoData ? 'СМИ и каналы данного лагеря не публиковали материалов по этому инфоповоду.' : vec.position}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
