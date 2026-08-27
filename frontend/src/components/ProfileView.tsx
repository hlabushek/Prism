import React from 'react';
import { User as UserIcon, Settings, LogOut, Check, Send } from 'lucide-react';
import { FontFamilyMode, FontSizeScale } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface ProfileViewProps {
  currentUser: any;
  onOpenAuthModal: () => void;
  onOpenAdminModal: () => void;
  onLogout: () => void;
  fontFamily: FontFamilyMode;
  onChangeFontFamily: (font: FontFamilyMode) => void;
  fontSize: FontSizeScale;
  onChangeFontSize: (size: FontSizeScale) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onOpenAuthModal,
  onOpenAdminModal,
  onLogout,
  fontFamily,
  onChangeFontFamily,
  fontSize,
  onChangeFontSize,
}) => {
  const { haptic } = useTelegram();

  const isAdmin = currentUser?.username?.toLowerCase() === 'not_hleb';

  const fontOptions: { id: FontFamilyMode; label: string; preview: string }[] = [
    { id: 'sans', label: 'Modern Sans', preview: 'Inter (Четкий и современный)' },
    { id: 'serif', label: 'Editorial Serif', preview: 'Newsreader (Классический книжный)' },
    { id: 'mono', label: 'Tech Mono', preview: 'JetBrains Mono (Моноширинный код)' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* User Header Profile Card */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Perfect non-squished Avatar */}
            <div className="w-12 h-12 min-w-[48px] min-h-[48px] aspect-square rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md ring-4 ring-sky-500/20 flex-shrink-0">
              {currentUser?.first_name ? currentUser.first_name.charAt(0) : <UserIcon className="w-6 h-6" />}
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
                {currentUser ? `${currentUser.first_name} ${currentUser.last_name || ''}` : 'Гостевой читатель'}
              </h3>
              {currentUser?.username ? (
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5 mt-0.5">
                  <span className="text-xs text-[#1969ae] dark:text-sky-400 font-mono font-bold">
                    @{currentUser.username}
                  </span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase">
                      Главный Админ
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Войдите через Telegram</p>
              )}
            </div>
          </div>

          {/* Auth Action Button */}
          {currentUser ? (
            <button
              onClick={() => {
                haptic('warning');
                onLogout();
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 border border-slate-200 dark:border-white/5 transition-colors flex-shrink-0"
              title="Выйти из аккаунта"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                haptic('light');
                onOpenAuthModal();
              }}
              className="px-3 py-2 rounded-xl bg-[#1969ae] hover:brightness-110 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Войти</span>
            </button>
          )}
        </div>

        {/* ADMIN PANEL BUTTON (STRICTLY FOR @Not_Hleb ONLY!) */}
        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-amber-600 dark:text-amber-400 font-bold">
              <Settings className="w-4 h-4 animate-spin-slow" />
              <span>Панель Управления Prism</span>
            </div>
            <button
              onClick={() => {
                haptic('success');
                onOpenAdminModal();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
            >
              Открыть админку
            </button>
          </div>
        )}
      </div>

      {/* Reader & Typography Settings Card */}
      <div className="p-5 rounded-3xl glass-card border border-slate-200 dark:border-white/10 space-y-5 shadow-sm text-xs">
        {/* Font Scaler */}
        <div>
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-2">
            Размер шрифта для чтения
          </label>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5">
            {[
              { id: 'sm', label: 'A-', desc: 'Компактный' },
              { id: 'base', label: 'A', desc: 'Стандартный' },
              { id: 'lg', label: 'A+', desc: 'Крупный' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  haptic('light');
                  onChangeFontSize(opt.id as FontSizeScale);
                }}
                className={`py-2.5 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                  fontSize === opt.id
                    ? 'bg-white dark:bg-slate-800 text-[#1969ae] dark:text-sky-300 shadow-md ring-1 ring-black/5 dark:ring-white/10 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="text-sm font-black">{opt.label}</span>
                <span className="text-[9px] opacity-75 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family Selector */}
        <div>
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-2">
            Семейство шрифтов платформы
          </label>
          <div className="space-y-2">
            {fontOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  haptic('light');
                  onChangeFontFamily(opt.id);
                }}
                className={`w-full text-left p-3 rounded-2xl text-xs flex items-center justify-between border transition-all ${
                  fontFamily === opt.id
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30 font-bold'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold">{opt.label}</div>
                  <div className="text-[10px] opacity-60 font-normal">{opt.preview}</div>
                </div>
                {fontFamily === opt.id && <Check className="w-4 h-4 text-sky-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
