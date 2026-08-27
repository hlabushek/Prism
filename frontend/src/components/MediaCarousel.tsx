import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X, Image as ImageIcon } from 'lucide-react';
import { MediaItem } from '../types';
import { useTelegram } from '../hooks/useTelegram';

interface MediaCarouselProps {
  media?: MediaItem[];
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({ media }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (isLightboxOpen) {
      showBackButton(() => setIsLightboxOpen(false));
      document.body.style.overflow = 'hidden';
    } else {
      hideBackButton();
      document.body.style.overflow = '';
    }
  }, [isLightboxOpen, showBackButton, hideBackButton]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight' && media && media.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % media.length);
      }
      if (e.key === 'ArrowLeft' && media && media.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
      }
    };

    if (isLightboxOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, media]);

  if (!media || media.length === 0) return null;

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    haptic('light');
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    haptic('light');
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  const currentItem = media[currentIndex];

  return (
    <>
      {/* Feed Card Carousel Container */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/80 dark:border-white/10 group select-none shadow-sm">
        <div
          className="relative w-full h-48 sm:h-56 cursor-pointer overflow-hidden flex items-center justify-center bg-slate-950"
          onClick={() => setIsLightboxOpen(true)}
        >
          <img
            src={currentItem.url}
            alt={currentItem.caption || 'Иллюстрация'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

          {/* Source Attribution Badge */}
          {currentItem.source_name && (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-medium text-white flex items-center space-x-1">
              <ImageIcon className="w-2.5 h-2.5 text-sky-400" />
              <span>{currentItem.source_name}</span>
            </div>
          )}

          {/* Fullscreen Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(true);
            }}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-white hover:bg-black transition-all"
            title="Открыть фото во весь экран"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Caption */}
          {currentItem.caption && (
            <div className="absolute bottom-2.5 left-3 right-14 text-xs text-white/95 font-medium truncate pointer-events-none">
              {currentItem.caption}
            </div>
          )}

          {/* Slide Counter Badge */}
          {media.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white font-bold">
              {currentIndex + 1} / {media.length}
            </div>
          )}
        </div>

        {/* Card Navigation Arrows */}
        {media.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur-md border border-white/15 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur-md border border-white/15 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Modern Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-between bg-black/95 backdrop-blur-2xl p-4 sm:p-6 select-none animate-fade-in"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 20px) + 12px)' }}
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar with Counter & Close Button */}
          <div
            className="w-full max-w-4xl flex items-center justify-between z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white text-xs font-mono font-bold bg-white/10 px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-md">
              {currentItem.source_name || 'Фото'} • {currentIndex + 1} из {media.length}
            </div>

            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="p-3 rounded-full bg-white/20 hover:bg-rose-600 active:scale-95 text-white border border-white/25 shadow-2xl transition-all cursor-pointer"
              title="Закрыть"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Center Image Container with Side Arrows & Touch Swipe */}
          <div
            className="relative w-full max-w-4xl flex-1 flex items-center justify-center my-auto overflow-hidden py-2 touch-pan-y"
            onClick={() => setIsLightboxOpen(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentItem.url}
              alt={currentItem.caption || 'Фотография'}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl transition-all duration-300 pointer-events-auto"
            />

            {media.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Caption & Dot Navigation */}
          <div
            className="w-full max-w-2xl text-center space-y-2 z-10 pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {currentItem.caption && (
              <p className="text-white/90 text-xs sm:text-sm font-medium px-4 line-clamp-2">
                {currentItem.caption}
              </p>
            )}

            {media.length > 1 && (
              <div className="flex items-center justify-center space-x-1.5 pt-1">
                {media.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      currentIndex === idx ? 'w-6 bg-sky-400' : 'w-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
