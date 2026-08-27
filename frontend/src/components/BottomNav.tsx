import React from 'react';
import { Newspaper, BarChart3, Bookmark, Sun, Moon, User as UserIcon } from 'lucide-react';
import { ActiveTab, ThemeMode } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenTrustModal: () => void;
  savedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenTrustModal,
  savedCount,
}) => {
  const { haptic } = useTelegram();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-slate-200 dark:border-white/10 px-2 py-1.5 shadow-2xl backdrop-blur-2xl transition-colors">
      <div className="flex items-center justify-around">
        {/* 1. Feed Tab */}
        <button
          onClick={() => {
            haptic('light');
            onSelectTab('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center p-1.5 active:scale-90 transition-all ${
            activeTab === 'feed'
              ? 'text-[#1969ae] dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Newspaper className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Лента</span>
        </button>

        {/* 2. Media Dossiers */}
        <button
          onClick={() => {
            haptic('light');
            onOpenTrustModal();
          }}
          className="flex flex-col items-center justify-center p-1.5 text-slate-500 dark:text-slate-400 hover:text-sky-500 active:scale-90 transition-all"
        >
          <BarChart3 className="w-5 h-5 text-sky-500" />
          <span className="text-[10px] font-medium mt-0.5">СМИ</span>
        </button>

        {/* 3. Bookmarks Tab (Opens dedicated saved articles feed) */}
        <button
          onClick={() => {
            haptic('light');
            onSelectTab('favorites' as any);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`relative flex flex-col items-center justify-center p-1.5 active:scale-90 transition-all ${
            (activeTab as string) === 'favorites'
              ? 'text-amber-500 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Bookmark className={`w-5 h-5 ${(activeTab as string) === 'favorites' ? 'fill-amber-500' : ''}`} />
          <span className="text-[10px] font-medium mt-0.5">Закладки</span>
          {savedCount > 0 && (
            <span className="absolute top-1 right-2 w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-mono text-[8px] flex items-center justify-center font-bold">
              {savedCount}
            </span>
          )}
        </button>

        {/* 4. Instant Theme Switcher */}
        <button
          onClick={() => {
            haptic('light');
            onToggleTheme();
          }}
          className="flex flex-col items-center justify-center p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-500 active:scale-90 transition-all"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
          <span className="text-[10px] font-medium mt-0.5">{theme === 'dark' ? 'Светлая' : 'Темная'}</span>
        </button>

        {/* 5. Profile Tab */}
        <button
          onClick={() => {
            haptic('light');
            onSelectTab('profile');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center p-1.5 active:scale-90 transition-all ${
            activeTab === 'profile'
              ? 'text-[#1969ae] dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Профиль</span>
        </button>
      </div>
    </nav>
  );
};
