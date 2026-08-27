import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Users, Building, CheckCircle2, AlertTriangle, ExternalLink, Filter } from 'lucide-react';
import { MEDIA_DOSSIERS } from '../api/mockData';
import { MediaDossier } from '../types';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

interface MediaDossierModalProps {
  mediaName: string | null;
  onClose: () => void;
  onFilterByMedia?: (mediaName: string) => void;
}

export const MediaDossierModal: React.FC<MediaDossierModalProps> = ({
  mediaName,
  onClose,
  onFilterByMedia,
}) => {
  const { haptic } = useTelegram();
  const [dossier, setDossier] = useState<MediaDossier | null>(null);

  useEffect(() => {
    if (!mediaName) {
      setDossier(null);
      return;
    }

    // Try fetching live dossier from backend
    api.getMediaDossiers().then((list) => {
      const match = list.find(
        (d) =>
          d.shortName.toLowerCase() === mediaName.toLowerCase() ||
          d.name.toLowerCase().includes(mediaName.toLowerCase()) ||
          mediaName.toLowerCase().includes(d.shortName.toLowerCase())
      );
      if (match) {
        setDossier(match);
      } else {
        // Fallback to static mockData if offline
        const fallback =
          MEDIA_DOSSIERS[mediaName] ||
          Object.values(MEDIA_DOSSIERS).find(
            (d) =>
              d.shortName.toLowerCase() === mediaName.toLowerCase() ||
              d.name.toLowerCase().includes(mediaName.toLowerCase())
          );
        setDossier(fallback || null);
      }
    });
  }, [mediaName]);

  if (!mediaName || !dossier) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#090f1f] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start space-x-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-white/10 shadow-md flex-shrink-0 overflow-hidden"
            >
              {dossier.logoUrl ? (
                <img
                  src={dossier.logoUrl}
                  alt={dossier.shortName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="font-black text-base" style={{ color: dossier.campColor }}>
                  {dossier.shortName.charAt(0)}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {dossier.name}
              </h3>
              <div className="flex items-center space-x-2">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: dossier.campColor }}
                >
                  {dossier.camp}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {dossier.founded}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Верификация фактов</span>
                </span>
                <span className="font-mono font-bold">{dossier.factualityScore}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-emerald-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${dossier.factualityScore}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                <span>Поляризация</span>
                <span className="font-mono font-bold">{dossier.polarizationScore}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-amber-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${dossier.polarizationScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Ownership & Audience */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span><strong>Владелец:</strong> {dossier.ownership}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span><strong>Аудитория:</strong> {dossier.audience}</span>
            </div>
          </div>

          {/* Editorial Profile */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] text-slate-400">
              Редакционная политика и специфика
            </h4>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
              {dossier.editorialProfile}
            </p>
          </div>

          {/* Strengths */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Сильные стороны и специализация</span>
            </h4>
            <ul className="space-y-1 pl-1">
              {dossier.strengths.map((s, idx) => (
                <li key={idx} className="flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Blindspots tendency */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[10px] flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Характерные слепые зоны</span>
            </h4>
            <ul className="space-y-1 pl-1">
              {dossier.blindspotsTendency.map((b, idx) => (
                <li key={idx} className="flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => {
              haptic('light');
              if (onFilterByMedia) onFilterByMedia(dossier.shortName);
              onClose();
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#1969ae] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-98 transition-all"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Смотреть новости {dossier.shortName}</span>
          </button>

          <a
            href={dossier.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs flex items-center justify-center"
            title="Перейти на сайт СМИ"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
