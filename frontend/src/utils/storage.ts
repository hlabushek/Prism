/**
 * Safe Storage wrapper for Telegram Mini App
 * Handles Safari / iOS WebKit SecurityError when third-party localStorage is restricted.
 */
const memoryFallback: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : memoryFallback[key] || null;
    } catch {
      return memoryFallback[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      memoryFallback[key] = value;
    } catch {
      memoryFallback[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryFallback[key];
    } catch {
      delete memoryFallback[key];
    }
  },
};
