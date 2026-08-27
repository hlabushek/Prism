import React from 'react';
import { Sparkles, Landmark, TrendingUp, ShieldAlert, Cpu, Globe, Users } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';

interface CategoryBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CATEGORIES = [
  { id: 'all', label: 'Все новости', icon: Sparkles },
  { id: 'Политика', label: 'Политика', icon: Landmark },
  { id: 'Экономика', label: 'Экономика', icon: TrendingUp },
  { id: 'ВПК', label: 'ВПК & Безопасность', icon: ShieldAlert },
  { id: 'Технологии', label: 'Технологии & ИИ', icon: Cpu },
  { id: 'В мире', label: 'В мире', icon: Globe },
  { id: 'Общество', label: 'Общество', icon: Users },
];

export const CategoryBar: React.FC<CategoryBarProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const { haptic } = useTelegram();

  return (
    <div className="sticky top-[58px] z-30 w-full glass-panel border-b border-slate-200/60 dark:border-white/5 shadow-sm transition-colors py-2 px-3">
      <div className="max-w-5xl mx-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center sm:justify-center space-x-1.5 min-w-max px-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  haptic('light');
                  onSelectCategory(cat.id);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none border whitespace-nowrap active:scale-95 ${
                  isSelected
                    ? 'bg-[#1969ae] text-white border-[#1969ae] shadow-md shadow-sky-500/20'
                    : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
