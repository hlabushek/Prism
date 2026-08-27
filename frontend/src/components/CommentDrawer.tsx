import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, MessageCircle } from 'lucide-react';
import { CommentItem, StoryCluster } from '../types';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

interface CommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryCluster | null;
  onCommentAdded?: () => void;
}

export const CommentDrawer: React.FC<CommentDrawerProps> = ({
  isOpen,
  onClose,
  story,
  onCommentAdded,
}) => {
  const { user, haptic } = useTelegram();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen && story) {
      setIsLoading(true);
      api.getStoryComments(story.id)
        .then((res) => {
          setComments(res);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, story]);

  if (!isOpen || !story) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    haptic('medium');
    setIsSending(true);
    const authorName = user?.first_name
      ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
      : 'Читатель Prism';

    try {
      const created = await api.addStoryComment(story.id, inputText, authorName);
      setComments((prev) => [...prev, created]);
      setInputText('');
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#090f1f] border-t sm:border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-[#1969ae] dark:text-sky-400" />
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                Обсуждение новости (Сайт ⇄ Telegram)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                {story.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="text-center py-8 text-xs text-slate-400">
              Синхронизация комментариев...
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto stroke-1 opacity-60" />
              <p className="text-xs">Здесь пока нет комментариев.</p>
              <p className="text-[11px] text-slate-500">Напишите первое сообщение или оставьте отзыв в Telegram!</p>
            </div>
          )}

          {!isLoading &&
            comments.map((c) => {
              const timeFormatted = new Date(c.created_at).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isTelegram = c.source === 'telegram';

              return (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200/80 dark:border-white/5 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                        {c.author_name ? c.author_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {c.author_name}
                      </span>
                      {isTelegram && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 text-[9px] font-semibold flex items-center space-x-0.5">
                          <span>via TG Канал</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{timeFormatted}</span>
                  </div>

                  {/* Comment Text */}
                  {c.text && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 pl-8 leading-relaxed font-normal">
                      {c.text}
                    </p>
                  )}

                  {/* Telegram Media Attachment: Sticker / GIF / Photo */}
                  {c.media_url && (
                    <div className="pl-8 pt-1">
                      <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 max-w-[160px] bg-slate-900">
                        <img
                          src={c.media_url}
                          alt="Медиа вложение"
                          className="w-full h-auto max-h-32 object-cover"
                        />
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-mono uppercase">
                          {c.media_type || 'TG Вложение'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-slate-100 dark:bg-slate-900/90 border-t border-slate-200 dark:border-white/10 flex items-center space-x-2 flex-shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ваш комментарий (отправится на сайт и в Telegram)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#1969ae] transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 rounded-xl bg-[#1969ae] hover:brightness-110 disabled:opacity-40 text-white font-bold transition-all shadow-md active:scale-95 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
