import React, { useState, useEffect } from 'react';
import { X, LogOut, CheckCircle2, Loader2, ExternalLink, Copy, Check, Sparkles, MessageSquare } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import { api } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const { haptic, initData, tg } = useTelegram();
  const [sessionData, setSessionData] = useState<{ session_id: string; code?: string; emojis?: string; deep_link: string; bot_username: string } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // If inside Telegram WebApp, auto-authenticate on open
  useEffect(() => {
    if (isOpen && !currentUser && initData) {
      api.authenticateTelegram(initData)
        .then((res) => {
          if (res?.user) {
            localStorage.setItem('prism_user', JSON.stringify(res.user));
            onLoginSuccess(res.user);
          }
        })
        .catch((e) => console.warn('TMA auto-auth check:', e));
    }
  }, [isOpen, currentUser, initData]);

  // Pre-generate session with code & emojis when modal opens
  const fetchSession = async () => {
    setIsLoadingSession(true);
    try {
      const data = await api.createAuthSession();
      if (data) {
        setSessionData(data);
      }
    } catch (err) {
      console.error('Failed to create auth session:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    if (isOpen && !currentUser) {
      fetchSession();
    }
  }, [isOpen, currentUser]);

  // Continuous polling for authorization confirmation
  useEffect(() => {
    let interval: any = null;
    if (isOpen && !currentUser) {
      interval = setInterval(async () => {
        try {
          if (sessionData?.session_id || sessionData?.code) {
            const res = await api.checkAuthSession(sessionData.session_id || '', sessionData.code);
            if (res?.status === 'authenticated' && res.user) {
              haptic('success');
              localStorage.setItem('prism_user', JSON.stringify(res.user));
              if (res.access_token) {
                localStorage.setItem('prism_auth_token', res.access_token);
              }
              onLoginSuccess(res.user);
              onClose();
            }
          }
        } catch (e) {
          // continue polling
        }
      }, 800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, currentUser, sessionData]);

  if (!isOpen) return null;

  const botUsername = sessionData?.bot_username || 'PrismNewsBot';
  const botChatLink = `https://t.me/${botUsername}`;

  const handleCopyText = (val: string, label: string) => {
    if (!val) return;
    haptic('success');
    navigator.clipboard.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleOpenBot = (e: React.MouseEvent) => {
    haptic('medium');
    if (tg?.openTelegramLink) {
      e.preventDefault();
      tg.openTelegramLink(botChatLink);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#090f1f] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center -mt-1 -mr-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            {currentUser ? 'Профиль читателя' : 'Авторизация'}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentUser ? (
          /* Profile Authenticated View */
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg ring-4 ring-sky-500/20">
              {currentUser.first_name ? currentUser.first_name.charAt(0) : 'U'}
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {currentUser.first_name} {currentUser.last_name || ''}
              </h3>
              {currentUser.username && (
                <p className="text-xs text-[#1969ae] dark:text-sky-400 font-mono font-bold">
                  @{currentUser.username}
                </p>
              )}
              <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Telegram подтвержден</span>
              </div>
            </div>

            <button
              onClick={() => {
                haptic('warning');
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        ) : (
          /* Modern Emoji & 4-Digit Code Telegram Login View */
          <div className="space-y-4 py-1">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center mx-auto text-[#1969ae] dark:text-sky-400 shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Вход через Telegram
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Отправьте в чат боту <span className="font-mono font-bold text-sky-500">@{botUsername}</span> этот эмодзи-код или цифры:
              </p>
            </div>

            {/* Code / Emojis Display */}
            <div className="py-2 space-y-3">
              {isLoadingSession || !sessionData ? (
                <div className="h-16 flex items-center justify-center space-x-2 text-sky-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Генерация кода...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Emoji Combo Box */}
                  {sessionData.emojis && (
                    <div
                      onClick={() => handleCopyText(sessionData.emojis || '', 'emojis')}
                      className="p-3 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border-2 border-sky-500/30 dark:border-sky-500/50 flex items-center justify-center space-x-3 cursor-pointer hover:scale-102 active:scale-98 transition-all shadow-inner"
                      title="Нажмите чтобы скопировать эмодзи"
                    >
                      <span className="text-3xl tracking-widest">{sessionData.emojis}</span>
                    </div>
                  )}

                  {/* 4-digit code numbers */}
                  {sessionData.code && (
                    <div className="flex items-center justify-center space-x-2">
                      {sessionData.code.split('').map((char, index) => (
                        <span
                          key={index}
                          className="w-10 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xl font-black text-slate-900 dark:text-sky-300 flex items-center justify-center font-mono shadow-sm"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Copy Action Buttons */}
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    {sessionData.emojis && (
                      <button
                        onClick={() => handleCopyText(sessionData.emojis || '', 'emojis')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center space-x-1 border border-slate-200 dark:border-white/5 transition-all"
                      >
                        {copied === 'emojis' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500 font-bold">Эмодзи скопированы!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-sky-500" />
                            <span>Скопировать эмодзи</span>
                          </>
                        )}
                      </button>
                    )}

                    {sessionData.code && (
                      <button
                        onClick={() => handleCopyText(sessionData.code || '', 'code')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center space-x-1 border border-slate-200 dark:border-white/5 transition-all"
                      >
                        {copied === 'code' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500 font-bold">Код скопирован!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-sky-500" />
                            <span>Скопировать цифры</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Link to Telegram Chat with Bot (Opens in normal new tab) */}
            <div className="space-y-2.5 pt-1">
              <a
                href={botChatLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenBot}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:brightness-110 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/25 active:scale-98 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Открыть диалог с @{botUsername}</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
              </a>

              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 flex items-center justify-center space-x-2 animate-fade-in">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 flex-shrink-0" />
                <span className="text-[11px] font-medium text-slate-400">
                  Ожидание отправки кода в бот...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
