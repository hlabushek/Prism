import React, { useState } from 'react';
import { Newspaper, ExternalLink, ChevronDown, Layers, Sparkles, Share2, Check, Clock, ShieldCheck, Zap, MessageCircle, Bookmark, Heart, ThumbsUp, Info } from 'lucide-react';
import { StoryCluster, ReactionSummary } from '../types';
import { SentimentGauge } from './SentimentGauge';
import { PoliticalSpectrum } from './PoliticalSpectrum';
import { VerifiedFacts } from './VerifiedFacts';
import { Blindspots } from './Blindspots';
import { QuotesList } from './QuotesList';
import { MediaCarousel } from './MediaCarousel';
import { useTelegram } from '../hooks/useTelegram';
import { api } from '../api/client';

interface StoryCardProps {
  story: StoryCluster;
  factsOnly?: boolean;
  onOpenComments?: (story: StoryCluster) => void;
  onToggleFavoriteGlobal?: (storyId: number) => void;
  onOpenMediaDossier?: (mediaName: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  factsOnly = false,
  onOpenComments,
  onToggleFavoriteGlobal,
  onOpenMediaDossier,
}) => {
  const { haptic, openLink } = useTelegram();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showArticles, setShowArticles] = useState(false);
  const [copied, setCopied] = useState(false);

  // Social states
  const [isFavorite, setIsFavorite] = useState(story.is_favorite || false);
  const [reactions, setReactions] = useState<ReactionSummary>(
    story.reactions || { like: 0, thumb_up: 0, objective: 0, fire: 0, fact: 0, user_reaction: null }
  );

  const formattedDate = new Date(story.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('medium');
    const nextState = !isFavorite;
    setIsFavorite(nextState);
    await api.toggleFavorite(story.id);
    if (onToggleFavoriteGlobal) onToggleFavoriteGlobal(story.id);
  };

  const handleReact = async (type: 'like' | 'thumb_up' | 'objective' | 'fire' | 'fact', e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('light');
    const updated = await api.toggleReaction(story.id, type as any);
    setReactions(updated);
  };

  const handleCopyForTelegram = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('success');

    const factsPlain = story.verified_facts.map((f) => `• ${f}`).join('\n');
    const factsHtml = story.verified_facts.map((f) => `<li>${f}</li>`).join('');

    const plainText = `💎 **${story.title}**\n\n${story.summary}\n\n🛡️ **Верифицированные факты:**\n${factsPlain}\n\n📊 **Тональность:** ${story.sentiment > 0 ? '+' : ''}${story.sentiment.toFixed(2)}\n⚡ *Аналитика: Prism News AI*`;

    const htmlText = `<b>💎 ${story.title}</b><br><br>${story.summary}<br><br><b>🛡️ Верифицированные факты:</b><ul>${factsHtml}</ul><br><b>📊 Тональность:</b> ${story.sentiment > 0 ? '+' : ''}${story.sentiment.toFixed(2)}<br>⚡ <i>Аналитика: Prism News AI</i>`;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([htmlText], { type: 'text/html' });
        const blobPlain = new Blob([plainText], { type: 'text/plain' });
        const item = new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobPlain,
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <article
      id={`story-card-${story.id}`}
      className="glass-card rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-300 space-y-3.5 relative overflow-hidden group scroll-mt-28"
    >
      {/* Top Refractive Spectrum Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-prism-blue/40 via-prism-green/40 via-prism-orange/40 to-prism-red/40 group-hover:h-[3px] transition-all duration-300" />

      {/* Clean Minimalist Meta Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-2 font-medium">
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{formattedDate}</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          {story.category && (
            <span className="text-[#1969ae] dark:text-sky-400 font-bold text-[11px]">
              {story.category}
            </span>
          )}
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center space-x-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>{story.sources_count || 1} СМИ</span>
          </span>
        </div>

        {/* Right: Consensus / Polarization Badge */}
        <div>
          {story.consensus_score && story.consensus_score >= 70 ? (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>{story.consensus_score}% Консенсус</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center space-x-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{story.polarization_score || 65}% Поляризация</span>
            </span>
          )}
        </div>
      </div>

      {/* News Title */}
      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
        {story.title}
      </h2>

      {/* Neutral Summary */}
      <div className="relative text-slate-800 dark:text-slate-300 text-xs leading-relaxed bg-slate-50 dark:bg-[#080d1a]/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 shadow-inner">
        <div className="flex items-start space-x-2">
          <span className="w-1 h-3.5 bg-gradient-to-b from-prism-blue to-prism-green rounded-full mt-0.5 flex-shrink-0" />
          <p className="flex-1 font-normal leading-relaxed">{story.summary}</p>
        </div>
      </div>

      {/* Sentiment Gauge */}
      {!factsOnly && <SentimentGauge sentiment={story.sentiment} />}

      {/* Media Carousel */}
      <MediaCarousel media={story.media} />

      {/* Social Actions Bar */}
      <div className="pt-1 flex items-center justify-between gap-1.5 flex-wrap border-t border-slate-100 dark:border-white/5">
        {/* Reactions List */}
        <div className="flex items-center space-x-1 flex-wrap gap-y-1">
          <button
            onClick={(e) => handleReact('like', e)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border active:scale-95 ${
              reactions.user_reaction === 'like'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 ring-1 ring-rose-500/30'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
            }`}
            title="Нравится (Лайк)"
          >
            <Heart className={`w-3.5 h-3.5 ${reactions.user_reaction === 'like' ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
            <span className="text-[11px] font-mono">{reactions.like || 0}</span>
          </button>

          <button
            onClick={(e) => handleReact('thumb_up', e)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border active:scale-95 ${
              reactions.user_reaction === 'thumb_up'
                ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 ring-1 ring-indigo-500/30'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
            }`}
            title="Согласен"
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${reactions.user_reaction === 'thumb_up' ? 'fill-indigo-500 text-indigo-500' : 'text-indigo-500'}`} />
            <span className="text-[11px] font-mono">{reactions.thumb_up || 0}</span>
          </button>

          <button
            onClick={(e) => handleReact('objective', e)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border active:scale-95 ${
              reactions.user_reaction === 'objective'
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/40 ring-1 ring-sky-500/30'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
            }`}
            title="Объективно"
          >
            <span>💎</span>
            <span className="text-[11px] font-mono">{reactions.objective || 0}</span>
          </button>

          <button
            onClick={(e) => handleReact('fire', e)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border active:scale-95 ${
              reactions.user_reaction === 'fire'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
            }`}
            title="Важно"
          >
            <span>🔥</span>
            <span className="text-[11px] font-mono">{reactions.fire || 0}</span>
          </button>

          <button
            onClick={(e) => handleReact('fact', e)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border active:scale-95 ${
              reactions.user_reaction === 'fact'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
            }`}
            title="Факты"
          >
            <span>🛡️</span>
            <span className="text-[11px] font-mono">{reactions.fact || 0}</span>
          </button>
        </div>

        {/* Right Action Icons: Comments, Bookmark, TG */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onOpenComments && onOpenComments(story)}
            className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1 transition-all active:scale-95"
            title="Открыть обсуждение"
          >
            <MessageCircle className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[11px] font-mono">{story.comments_count || 0}</span>
          </button>

          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg border text-xs font-medium flex items-center space-x-1 transition-all active:scale-95 ${
              isFavorite
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-400'
            }`}
            title={isFavorite ? 'Удалить из закладок' : 'Сохранить в избранное'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>

          <button
            onClick={handleCopyForTelegram}
            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg border font-bold text-xs flex items-center space-x-1 transition-all ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/5'
            }`}
            title="Скопировать для Telegram"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5 text-[#1969ae] dark:text-sky-400" />}
            <span className="text-[10px] hidden sm:inline">{copied ? 'OK' : 'TG'}</span>
          </button>
        </div>
      </div>

      {/* Expand Analytics Button */}
      <div className="pt-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs transition-all duration-200 flex items-center justify-between border ${
            isExpanded
              ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/15'
              : 'bg-gradient-to-r from-prism-blue/10 via-prism-green/10 to-prism-orange/10 hover:from-prism-blue/20 hover:to-prism-green/20 text-[#1969ae] dark:text-sky-300 border-[#1969ae]/30 dark:border-sky-500/30 shadow-sm'
          }`}
        >
          <span className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-[#1969ae] dark:text-sky-400" />
            <span>{isExpanded ? 'Свернуть аналитику' : 'Разложить по спектру (Аналитика Prism)'}</span>
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      {/* Smooth Slide-down Details */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden space-y-3.5 pt-2 border-t border-slate-200 dark:border-white/10">
          {!factsOnly && <PoliticalSpectrum vectors={story.political_vectors} />}
          <VerifiedFacts facts={story.verified_facts} />
          {!factsOnly && <Blindspots blindspots={story.blindspots} />}

          {/* Timeline */}
          {story.timeline && story.timeline.length > 0 && !factsOnly && (
            <div className="bg-slate-50 dark:bg-[#090f1e]/80 rounded-xl p-3 border border-slate-200 dark:border-white/5 shadow-sm space-y-2">
              <div className="flex items-center space-x-1.5 text-xs text-slate-800 dark:text-slate-200 font-bold">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Хроника развития событий (Timeline)</span>
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-sky-500/30 ml-1 mt-2">
                {story.timeline.map((evt, idx) => (
                  <div key={idx} className="relative pl-3 text-xs">
                    <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-sky-500" />
                    <div className="font-mono text-[10px] text-[#1969ae] dark:text-sky-400 font-bold">{evt.time}</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{evt.title}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">{evt.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <QuotesList quotes={story.quotes} />

          {/* Original Sources with Dossier Click */}
          {story.articles && story.articles.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowArticles(!showArticles)}
                className="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-white/5 transition-all"
              >
                <span className="flex items-center space-x-2">
                  <Newspaper className="w-3.5 h-3.5 text-prism-blue" />
                  <span className="font-medium">Оригинальные публикации ({story.articles.length})</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showArticles ? 'rotate-180' : 'rotate-0'}`} />
              </button>

              {/* Smooth Slide-down Original Publications */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  showArticles ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden space-y-1.5 pl-2 border-l-2 border-slate-300 dark:border-slate-800">
                  {story.articles.map((art) => (
                    <div
                      key={art.id}
                      className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 hover:text-[#1969ae] dark:hover:text-sky-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group/art"
                    >
                      <button
                        type="button"
                        onClick={() => openLink(art.url)}
                        className="text-left truncate max-w-[200px] sm:max-w-[260px] font-normal hover:underline text-slate-800 dark:text-slate-200"
                      >
                        {art.title}
                      </button>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (art.source_name && onOpenMediaDossier) {
                              onOpenMediaDossier(art.source_name);
                            }
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-900 hover:bg-sky-500/20 hover:text-sky-500 border border-slate-300 dark:border-slate-800 flex items-center space-x-1 transition-colors"
                          title="Открыть досье на это СМИ"
                        >
                          <span>{art.source_name || 'СМИ'}</span>
                          <Info className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openLink(art.url)}
                          className="text-slate-400 hover:text-sky-500 p-0.5"
                          title="Открыть первоисточник"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
