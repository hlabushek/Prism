import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.enableClosingConfirmation();
      } catch (e) {
        // older clients ignore
      }
      setIsReady(true);
    }
  }, [tg]);

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (!tg?.HapticFeedback) return;
    try {
      if (['light', 'medium', 'heavy'].includes(type)) {
        tg.HapticFeedback.impactOccurred(type);
      } else if (['success', 'warning', 'error'].includes(type)) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch (e) {
      // Haptics not supported in desktop browser
    }
  }, [tg]);

  const initData = tg?.initData || '';
  const user = tg?.initDataUnsafe?.user || null;
  const startParam = tg?.initDataUnsafe?.start_param || null;
  const isDarkMode = tg?.colorScheme === 'dark' || true;

  const openLink = useCallback((url: string) => {
    if (!url) return;
    try {
      if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [tg]);

  const showBackButton = useCallback((onClick: () => void) => {
    if (!tg?.BackButton) return;
    try {
      tg.BackButton.show();
      tg.BackButton.onClick(onClick);
    } catch (e) {
      // not supported in browser
    }
  }, [tg]);

  const hideBackButton = useCallback(() => {
    if (!tg?.BackButton) return;
    try {
      tg.BackButton.hide();
      tg.BackButton.offClick();
    } catch (e) {
      // not supported in browser
    }
  }, [tg]);

  return {
    tg,
    isReady,
    user,
    initData,
    startParam,
    isDarkMode,
    haptic,
    openLink,
    showBackButton,
    hideBackButton,
  };
}

