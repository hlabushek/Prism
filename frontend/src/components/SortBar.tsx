import React from 'react';
import { Clock, Zap, ShieldCheck, Flame, MessageSquare } from 'lucide-react';
import { NewsSortMode } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface SortBarProps {
  currentSort: NewsSortMode;
  onSelectSort: (sort: NewsSortMode) => void;
  totalCount?: number;
}

export const SORT_OPTIONS: { id: NewsSortMode; label: string; icon: React.FC<{ className?: string }>; description: string }[] = [
  { id: 'latest', label: 'Свежие', icon: Clock, description: 'По времени публикации' },
  { id: 'importance', label: 'Главные', icon: Zap, description: 'Максимальный охват СМИ' },
  { id: 'consensus', label: 'Консенсус', icon: ShieldCheck, description: 'Согласие между СМИ' },
  { id: 'polarization', label: 'Споры', icon: Flame, description: 'Острые разногласия' },
  { id: 'comments', label: 'Обсуждаемые', icon: MessageSquare, description: 'Больше всего мнений' },
];

export const SortBar: React.FC<SortBarProps> = ({
  currentSort,
  onSelectSort,
  totalCount,
}) => {
  const { haptic } = useTelegram();

  return (
    <div className="w-full flex items-center justify-between gap-2 px-1 py-0.5">
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {SORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = currentSort === opt.id;

          return (
            <button
              key={opt.id}
              onClick={() => {
                haptic('light');
                onSelectSort(opt.id);
              }}
              title={opt.description}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all select-none border whitespace-nowrap active:scale-95 ${
                isSelected
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                  : 'bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-3 h-3 ${isSelected ? 'text-white dark:text-slate-900' : 'text-slate-400'}`} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {totalCount !== undefined && totalCount > 0 && (
        <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono flex-shrink-0">
          {totalCount} сюжетов
        </span>
      )}
    </div>
  );
};

