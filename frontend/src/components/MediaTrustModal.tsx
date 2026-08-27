import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, BarChart3, Filter, Info } from 'lucide-react';
import { MediaDossier } from '../types';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

interface MediaTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDossier: (mediaName: string) => void;
  onSelectSourceFilter: (sourceName: string) => void;
}

export const MediaTrustModal: React.FC<MediaTrustModalProps> = ({
  isOpen,
  onClose,
  onOpenDossier,
  onSelectSourceFilter,
}) => {
  const { haptic } = useTelegram();
  const [dossiers, setDossiers] = useState<MediaDossier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.getMediaDossiers()
        .then((res) => {
          if (res && res.length > 0) {
            setDossiers(res.sort((a, b) => b.factualityScore - a.factualityScore));
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-2.5 sm:p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#090f1f] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[#1969ae] dark:text-sky-400 flex-shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Индекс объективности СМИ
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Рейтинг верифицируемости фактов и досье
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          <div className="p-2.5 rounded-2xl bg-sky-500/5 border border-sky-500/15 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-[#1969ae] dark:text-sky-400">Нажмите на карточку СМИ</span>, чтобы открыть детальное досье: владельцы, специфика подачи, сильные стороны и слепые зоны. Рейтинг рассчитывается динамически по реальным материалам в базе данных.
          </div>

          {isLoading && dossiers.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              Загрузка актуального рейтинга СМИ...
            </div>
          )}

          <div className="space-y-2">
            {dossiers.map((src) => (
              <div
                key={src.id}
                onClick={() => {
                  haptic('light');
                  onOpenDossier(src.shortName);
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200/80 dark:border-white/5 space-y-2.5 shadow-sm transition-all hover:border-sky-500/40 hover:shadow-md cursor-pointer group select-none"
              >
                {/* Media Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                      {src.logoUrl ? (
                        <img
                          src={src.logoUrl}
                          alt={src.shortName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="font-bold text-xs" style={{ color: src.campColor }}>
                          {src.shortName.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-[#1969ae] dark:group-hover:text-sky-400 transition-colors">
                          {src.shortName}
                        </h4>
                        <Info className="w-3 h-3 text-slate-400 group-hover:text-sky-500 flex-shrink-0" />
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{src.camp}</span>
                        {(src.coverageCount || 0) > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                              {src.coverageCount} материалов
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic('light');
                      onSelectSourceFilter(src.shortName);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-[#1969ae] dark:text-sky-300 border border-sky-500/20 text-[11px] font-bold flex items-center space-x-1 transition-colors flex-shrink-0"
                  >
                    <Filter className="w-3 h-3" />
                    <span>Фильтр</span>
                  </button>
                </div>

                {/* Bars: Factuality & Polarization */}
                <div className="grid grid-cols-2 gap-2.5 pt-0.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>Факты</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {src.factualityScore}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${src.factualityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-slate-500 dark:text-slate-400">Поляризация</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {src.polarizationScore}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${src.polarizationScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
