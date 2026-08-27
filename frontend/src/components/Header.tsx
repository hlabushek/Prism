import React, { useState } from 'react';
import { SlidersHorizontal, Bookmark, RefreshCw, Moon, Sun, Type, Check, ShieldCheck, BarChart3, Sparkles, Landmark, TrendingUp, ShieldAlert, Cpu, Globe, Users, User as UserIcon, Settings } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import { PrismLogo } from './PrismLogo';
import { FontFamilyMode, ThemeMode, FontSizeScale } from '../types';

export const CATEGORIES = [
  { id: 'all', label: 'Все новости', icon: Sparkles },
  { id: 'Политика', label: 'Политика', icon: Landmark },
  { id: 'Экономика', label: 'Экономика', icon: TrendingUp },
  { id: 'ВПК', label: 'ВПК & Безопасность', icon: ShieldAlert },
  { id: 'Технологии', label: 'Технологии & ИИ', icon: Cpu },
  { id: 'В мире', label: 'В мире', icon: Globe },
  { id: 'Общество', label: 'Общество', icon: Users },
];

interface HeaderProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenFilter: () => void;
  onOpenTrustModal: () => void;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  currentUser: any;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeFilterCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  fontFamily: FontFamilyMode;
  onChangeFontFamily: (font: FontFamilyMode) => void;
  fontSize: FontSizeScale;
  onChangeFontSize: (size: FontSizeScale) => void;
  factsOnly: boolean;
  onToggleFactsOnly: () => void;
  showCategories?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedCategory,
  onSelectCategory,
  onOpenFilter,
  onOpenTrustModal,
  onOpenAuth,
  onOpenAdmin,
  currentUser,
  onRefresh,
  isRefreshing,
  activeFilterCount,
  theme,
  onToggleTheme,
  fontFamily,
  onChangeFontFamily,
  fontSize,
  onChangeFontSize,
  factsOnly,
  onToggleFactsOnly,
  showCategories = true,
}) => {
  const { haptic } = useTelegram();
  const [showTypographyMenu, setShowTypographyMenu] = useState(false);

  const isAdmin = currentUser?.username?.toLowerCase() === 'not_hleb';

  const fontOptions: { id: FontFamilyMode; label: string; preview: string }[] = [
    { id: 'sans', label: 'Modern Sans', preview: 'Inter' },
    { id: 'serif', label: 'Editorial Serif', preview: 'Newsreader' },
    { id: 'mono', label: 'Tech Mono', preview: 'JetBrains Mono' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel transition-colors duration-300 shadow-sm select-none">
      {/* Top Refraction Hairline */}
      <div className="spectrum-divider" />

      {/* Row 1: Brand Logo + Responsive Controls */}
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Left: Brand Logo */}
        <div
          className="flex items-center space-x-2 cursor-pointer flex-shrink-0"
          onClick={() => {
            haptic('light');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <PrismLogo showText={true} />
        </div>

        {/* Right Desktop Controls (Full-featured for PC) */}
        <div className="hidden sm:flex items-center space-x-1.5 md:space-x-2 flex-shrink-0">
          {/* 0. Favorites on PC */}
          <button
            onClick={() => {
              haptic('light');
              onSelectCategory('favorites_tab');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
            title="Открыть сохраненные статьи"
          >
            <Bookmark className="w-4 h-4 text-amber-500" />
            <span>Закладки</span>
          </button>

          {/* 1. Media Trust Rating */}
          <button
            onClick={() => {
              haptic('light');
              onOpenTrustModal();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
            title="Рейтинг и досье СМИ"
          >
            <BarChart3 className="w-4 h-4 text-[#1969ae] dark:text-sky-400" />
            <span>Рейтинг СМИ</span>
          </button>

          {/* 2. Facts Only Toggle */}
          <button
            onClick={() => {
              haptic('medium');
              onToggleFactsOnly();
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border ${
              factsOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-500'
            }`}
            title="Режим «Только факты»"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{factsOnly ? 'Факты: ВКЛ' : 'Только факты'}</span>
          </button>

          {/* 3. Theme Switcher */}
          <button
            onClick={() => {
              haptic('light');
              onToggleTheme();
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* 4. Typography Menu */}
          <div className="relative">
            <button
              onClick={() => setShowTypographyMenu(!showTypographyMenu)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
              title="Шрифт и размер текста"
            >
              <Type className="w-4 h-4" />
            </button>

            {showTypographyMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-white/15 shadow-2xl p-3 z-50 animate-fade-in space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Размер шрифта
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    {[
                      { id: 'sm', label: 'A-' },
                      { id: 'base', label: 'A' },
                      { id: 'lg', label: 'A+' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          haptic('light');
                          onChangeFontSize(opt.id as FontSizeScale);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                          fontSize === opt.id
                            ? 'bg-white dark:bg-slate-800 text-[#1969ae] dark:text-sky-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Семейство шрифта
                  </div>
                  <div className="space-y-1">
                    {fontOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          haptic('light');
                          onChangeFontFamily(opt.id);
                          setShowTypographyMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                          fontFamily === opt.id
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {fontFamily === opt.id && <Check className="w-3.5 h-3.5 text-sky-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Filter Trigger */}
          <button
            onClick={() => {
              haptic('light');
              onOpenFilter();
            }}
            className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
            title="Фильтры ленты"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1969ae] text-white font-extrabold text-[10px] flex items-center justify-center shadow-md ring-1 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 6. Sync / Refresh */}
          <button
            onClick={() => {
              haptic('medium');
              onRefresh();
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            title="Обновить данные"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-prism-blue' : ''}`} />
          </button>

          {/* 7. Admin Button (Strictly for @Not_Hleb on PC) */}
          {isAdmin && (
            <button
              onClick={() => {
                haptic('success');
                onOpenAdmin();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold flex items-center space-x-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              title="Панель администратора"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Админка</span>
            </button>
          )}

          {/* 8. User Profile / Login on PC */}
          <button
            onClick={() => {
              haptic('light');
              onOpenAuth();
            }}
            className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[#1969ae] dark:text-sky-400 transition-all active:scale-95 shadow-sm flex items-center space-x-1.5"
            title={currentUser ? `Профиль: ${currentUser.first_name}` : 'Войти через Telegram'}
          >
            <UserIcon className="w-4 h-4" />
            {currentUser?.first_name && (
              <span className="text-xs font-bold max-w-[80px] truncate">{currentUser.first_name}</span>
            )}
          </button>
        </div>

        {/* Minimal Mobile Controls (Strictly fits on 320px-390px screens without ANY overflow) */}
        <div className="flex sm:hidden items-center space-x-1.5 flex-shrink-0">
          {/* Compact Facts Toggle Icon */}
          <button
            onClick={() => {
              haptic('medium');
              onToggleFactsOnly();
            }}
            className={`p-1.5 rounded-xl border text-xs transition-all ${
              factsOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
            }`}
            title={factsOnly ? 'Факты: ВКЛ' : 'Включить режим «Только факты»'}
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Compact Refresh Icon */}
          <button
            onClick={() => {
              haptic('medium');
              onRefresh();
            }}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 transition-all active:scale-95"
            title="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-prism-blue' : ''}`} />
          </button>
        </div>
      </div>

      {/* Row 2: Fixed Category Horizontal Strip */}
      {showCategories && (
        <div className="w-full border-t border-slate-200/60 dark:border-white/5 py-1.5 px-2.5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="max-w-6xl mx-auto overflow-x-auto no-scrollbar">
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
                        ? 'bg-[#1969ae] text-white border-[#1969ae] shadow-sm'
                        : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800'
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
      )}
    </header>
  );
};
