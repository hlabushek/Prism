import React from 'react';
import { Quote, ExternalLink } from 'lucide-react';
import { QuoteItem } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface QuotesListProps {
  quotes: QuoteItem[];
}

export const QuotesList: React.FC<QuotesListProps> = ({ quotes }) => {
  const { openLink } = useTelegram();
  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="bg-slate-50 dark:bg-[#090f1e]/80 rounded-xl p-3 border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
      <div className="flex items-center space-x-1.5 text-xs text-amber-800 dark:text-amber-300 font-bold mb-2.5">
        <Quote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Ключевые цитаты первоисточников</span>
      </div>
      <div className="space-y-2">
        {quotes.map((q, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-white/5 text-xs relative group shadow-sm"
          >
            <p className="text-slate-800 dark:text-slate-200 italic mb-2 leading-relaxed font-serif text-[12px] border-l-2 border-amber-500/60 pl-2.5">
              «{q.quote}»
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="font-semibold text-slate-800 dark:text-slate-300 truncate max-w-[200px]">
                — {q.speaker_or_source}
              </span>
              {q.source_url && (
                <button
                  type="button"
                  onClick={() => openLink(q.source_url)}
                  className="flex items-center space-x-1 text-[#1969ae] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <span>Первоисточник</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
