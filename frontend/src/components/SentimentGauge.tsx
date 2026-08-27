import React from 'react';
import { Activity } from 'lucide-react';

interface SentimentGaugeProps {
  sentiment: number; // -1.0 to 1.0
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({ sentiment }) => {
  const percentage = Math.min(100, Math.max(0, ((sentiment + 1) / 2) * 100));

  const getSentimentDetails = (val: number) => {
    if (val >= 0.35) {
      return {
        label: 'Позитивная / Созидательная',
        color: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
      };
    }
    if (val >= 0.1) {
      return {
        label: 'Умеренно позитивная',
        color: 'text-teal-700 dark:text-teal-300',
        badgeBg: 'bg-teal-500/10 border-teal-500/30',
      };
    }
    if (val > -0.1) {
      return {
        label: 'Строго нейтральная',
        color: 'text-slate-700 dark:text-slate-300',
        badgeBg: 'bg-slate-500/10 border-slate-400/30 dark:border-slate-500/30',
      };
    }
    if (val > -0.35) {
      return {
        label: 'Умеренно тревожная',
        color: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-500/10 border-amber-500/30',
      };
    }
    return {
      label: 'Критическая / Негативная',
      color: 'text-rose-700 dark:text-rose-400',
      badgeBg: 'bg-rose-500/10 border-rose-500/30',
    };
  };

  const details = getSentimentDetails(sentiment);

  return (
    <div className="bg-slate-50 dark:bg-[#090f1e]/80 rounded-xl p-3 border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
          <Activity className="w-3.5 h-3.5 text-prism-blue" />
          <span>Тональность инфоповода</span>
        </div>
        <div className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${details.badgeBg} ${details.color}`}>
          {sentiment > 0 ? `+${sentiment.toFixed(2)}` : sentiment.toFixed(2)} • {details.label}
        </div>
      </div>

      {/* Spectrum Dispersion Gradient Bar */}
      <div className="relative w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden border border-slate-300/40 dark:border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-[#db233d] via-[#ef9630] via-[#f6c82d] via-[#1ca369] to-[#1969ae] opacity-85" />
        {/* Dynamic Needle Indicator */}
        <div
          className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(0,0,0,0.4)] ring-2 ring-slate-800 dark:ring-slate-950 transition-all duration-500"
          style={{ left: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
        <span className="text-prism-red font-semibold">-1.0 (Негатив)</span>
        <span className="text-slate-500 dark:text-slate-400 font-semibold">0.0 (Нейтрально)</span>
        <span className="text-prism-green font-semibold">+1.0 (Позитив)</span>
      </div>
    </div>
  );
};
