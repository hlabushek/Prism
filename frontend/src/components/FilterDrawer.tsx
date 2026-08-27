import React from 'react';
import { X, Check, Filter, RotateCcw, Newspaper, ArrowUpDown } from 'lucide-react';
import { FeedFilterState, NewsSource, UserPreferences, NewsSortMode } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FeedFilterState;
  onFilterChange: (filters: FeedFilterState) => void;
  sources: NewsSource[];
  preferences?: UserPreferences;
  onSavePreferences: (prefs: Partial<UserPreferences>) => void;
}

const POLITICAL_CAMPS = [
  { name: 'all', label: 'Все лагеря' },
  { name: 'Официально-лоялистская', label: 'Официальная' },
  { name: 'Военкоры/Z', label: 'Военкоры / Z' },
  { name: 'Деловая/Центристская', label: 'Деловая' },
  { name: 'Либерально-оппозиционная', label: 'Оппозиционная' },
  { name: 'Проукраинская/Внешняя', label: 'Внешняя' },
];

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  sources,
  onSavePreferences,
}) => {
  const { haptic } = useTelegram();

  if (!isOpen) return null;

  const handleSortChange = (sortBy: NewsSortMode) => {
    haptic('light');
    const newFilters = { ...filters, sort_by: sortBy, page: 1 };
    onFilterChange(newFilters);
  };

  const handleSentimentChange = (sentiment: string) => {
    haptic('light');
    const newFilters = { ...filters, sentiment, page: 1 };
    onFilterChange(newFilters);
    onSavePreferences({ sentiment_filter: sentiment });
  };

  const handleCampChange = (camp: string) => {
    haptic('light');
    const newFilters = { ...filters, political_vector: camp, page: 1 };
    onFilterChange(newFilters);
    onSavePreferences({ political_vectors_filter: camp === 'all' ? [] : [camp] });
  };

  const handleSourceToggle = (sourceId: number) => {
    haptic('light');
    const currentSelected = filters.source_ids
      ? filters.source_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean)
      : [];
    
    let newSelected: number[];
    if (currentSelected.includes(sourceId)) {
      newSelected = currentSelected.filter((id) => id !== sourceId);
    } else {
      newSelected = [...currentSelected, sourceId];
    }
    
    const newSourceIds = newSelected.join(',');
    onFilterChange({ ...filters, source_ids: newSourceIds, page: 1 });
    onSavePreferences({ sources_filter: newSelected });
  };

  const handleReset = () => {
    haptic('warning');
    const defaultFilters: FeedFilterState = {
      sentiment: 'all',
      political_vector: 'all',
      category: 'all',
      facts_only: false,
      source_ids: '',
      search: '',
      sort_by: 'latest',
      page: 1,
      page_size: 10,
    };
    onFilterChange(defaultFilters);
    onSavePreferences({
      sentiment_filter: 'all',
      political_vectors_filter: [],
      sources_filter: [],
    });
  };

  const currentSort = filters.sort_by || 'latest';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#090f1f] border-t sm:border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-5">
        {/* Top Handle */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-prism-blue" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Фильтры и Сортировка</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 text-xs flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5"
              title="Сбросить все фильтры"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сброс</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 0. Sorting Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-500" />
            <span>Сортировка новостей</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'latest' as NewsSortMode, label: '🕒 Свежие', sub: 'По дате' },
              { id: 'importance' as NewsSortMode, label: '⚡ Главные', sub: 'Охват СМИ' },
              { id: 'consensus' as NewsSortMode, label: '🤝 Консенсус', sub: 'Факты' },
              { id: 'polarization' as NewsSortMode, label: '⚡ Споры', sub: 'Полярность' },
              { id: 'comments' as NewsSortMode, label: '💬 Обсуждаемые', sub: 'Мнения' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSortChange(opt.id)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  currentSort === opt.id
                    ? 'bg-sky-500/15 border-sky-500 text-[#1969ae] dark:text-sky-300 ring-1 ring-sky-500/30'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs">{opt.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 1. Sentiment Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Тональность инфоповода
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'all', label: 'Все новости' },
              { id: 'positive_only', label: 'Позитив (>= +0.15)' },
              { id: 'neutral', label: 'Нейтральные' },
              { id: 'negative_only', label: 'Критические (<= -0.15)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSentimentChange(opt.id)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left flex items-center justify-between ${
                  filters.sentiment === opt.id
                    ? 'bg-[#1969ae]/15 border-[#1969ae] text-[#1969ae] dark:text-sky-300 ring-1 ring-[#1969ae]/30'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{opt.label}</span>
                {filters.sentiment === opt.id && <Check className="w-3.5 h-3.5 text-[#1969ae] dark:text-sky-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Political Camp Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Политический вектор (акцент лагеря)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {POLITICAL_CAMPS.map((camp) => (
              <button
                key={camp.name}
                onClick={() => handleCampChange(camp.name)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  filters.political_vector === camp.name
                    ? 'bg-slate-800 text-white dark:bg-slate-800 border-slate-700 dark:border-white/40 ring-1 ring-slate-400'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {camp.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Sources Selection */}
        <div>
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <Newspaper className="w-3.5 h-3.5 text-[#1969ae] dark:text-sky-400" />
            <span>Фильтр по источникам СМИ</span>
          </div>

          {sources && sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {sources.map((src) => {
                const selectedIds = filters.source_ids
                  ? filters.source_ids.split(',').map((id) => parseInt(id.trim(), 10))
                  : [];
                const isSelected = selectedIds.includes(src.id);
                return (
                  <button
                    key={src.id}
                    onClick={() => handleSourceToggle(src.id)}
                    className={`py-1 px-2.5 rounded-lg text-xs border transition-all ${
                      isSelected
                        ? 'bg-[#1969ae]/15 border-[#1969ae] text-[#1969ae] dark:text-sky-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {src.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Apply & Close Button */}
        <div className="pt-2">
          <button
            onClick={() => {
              haptic('success');
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-[#1969ae] hover:brightness-110 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
};
