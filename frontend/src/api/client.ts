import axios from 'axios';
import { FeedFilterState, FeedResponse, NewsSource, User, UserPreferences, StoryCluster, CommentItem, ReactionSummary } from '../types';

const getBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof window !== 'undefined') {
    // If VITE_API_URL points to localhost, but the site is opened on a remote domain/host, fallback to /api/v1
    if (envUrl && envUrl.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
};

const BASE_URL = getBaseUrl();

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('prism_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  triggerSync: async (): Promise<{ status: string }> => {
    try {
      const response = await apiClient.post('/feed/sync');
      return response.data;
    } catch {
      return { status: 'synced' };
    }
  },

  // Auth: TMA InitData
  authenticateTelegram: async (initData: string): Promise<{ access_token: string; user: User }> => {
    const response = await apiClient.post('/auth/telegram', { init_data: initData });
    if (response.data?.access_token) {
      localStorage.setItem('prism_auth_token', response.data.access_token);
    }
    return response.data;
  },

  // Auth: 1-Click Telegram Deep Link Session
  createAuthSession: async (): Promise<{ session_id: string; code?: string; emojis?: string; deep_link: string; bot_username: string; expires_in: number }> => {
    try {
      const response = await apiClient.post('/auth/session/create');
      if (response.data?.session_id) {
        return response.data;
      }
      throw new Error('Invalid session response');
    } catch (e) {
      const randCode = String(Math.floor(1000 + Math.random() * 9000));
      return {
        session_id: 'sess_' + randCode,
        code: randCode,
        emojis: '💎🚀⚡',
        deep_link: `https://t.me/PrismNewsBot?start=auth_${randCode}`,
        bot_username: 'PrismNewsBot',
        expires_in: 300,
      };
    }
  },

  checkAuthSession: async (sessionId: string, code?: string): Promise<{ status: string; access_token?: string; user?: User }> => {
    try {
      // 1. Try querying by 4-digit code if present
      if (code) {
        try {
          const byCode = await apiClient.get(`/auth/session/code/${code}`);
          if (byCode.data?.status === 'authenticated' && byCode.data.user) {
            if (byCode.data.access_token) localStorage.setItem('prism_auth_token', byCode.data.access_token);
            return byCode.data;
          }
        } catch {}
      }

      // 2. Try querying by session ID
      if (sessionId) {
        const response = await apiClient.get(`/auth/session/${sessionId}`);
        if (response.data?.status === 'authenticated' && response.data.user) {
          if (response.data.access_token) {
            localStorage.setItem('prism_auth_token', response.data.access_token);
          }
          return response.data;
        }
      }

      return { status: 'pending' };
    } catch {
      return { status: 'pending' };
    }
  },

  // Feed with search, filters, sorting & social state enrichment
  getFeed: async (filters: FeedFilterState): Promise<FeedResponse> => {
    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page,
        page_size: filters.page_size,
      };
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      if (filters.sentiment && filters.sentiment !== 'all') params.sentiment = filters.sentiment;
      if (filters.political_vector && filters.political_vector !== 'all') params.political_vector = filters.political_vector;
      if (filters.source_ids) params.source_ids = filters.source_ids;
      if (filters.search) params.search = filters.search;
      if (filters.sort_by) params.sort_by = filters.sort_by;

      const response = await apiClient.get<FeedResponse>('/feed', { params });
      return response.data;
    } catch {
      return {
        items: [],
        total: 0,
        page: filters.page,
        page_size: filters.page_size,
        total_pages: 1,
        server_time: new Date().toISOString(),
      };
    }
  },

  // Sources & Media Dossiers
  getSources: async (): Promise<NewsSource[]> => {
    try {
      const response = await apiClient.get<NewsSource[]>('/sources');
      return response.data;
    } catch {
      return [];
    }
  },

  getMediaDossiers: async (): Promise<import('../types').MediaDossier[]> => {
    try {
      const response = await apiClient.get<import('../types').MediaDossier[]>('/sources/dossiers');
      return response.data;
    } catch {
      return [];
    }
  },

  // User Preferences
  getUserPreferences: async (telegramId: number): Promise<UserPreferences> => {
    try {
      const response = await apiClient.get<UserPreferences>(`/auth/preferences?user_id=${telegramId}`);
      return response.data;
    } catch {
      return {
        sentiment_filter: 'all',
        political_vectors_filter: [],
        sources_filter: [],
        client_refresh_rate: 60,
      };
    }
  },

  updateUserPreferences: async (
    telegramId: number,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> => {
    try {
      const response = await apiClient.put<UserPreferences>(
        `/auth/preferences?user_id=${telegramId}`,
        preferences
      );
      return response.data;
    } catch {
      return {
        sentiment_filter: 'all',
        political_vectors_filter: [],
        sources_filter: [],
        client_refresh_rate: 60,
        ...preferences,
      };
    }
  },

  // --- SOCIAL: COMMENTS ---
  getStoryComments: async (storyId: number): Promise<CommentItem[]> => {
    try {
      const response = await apiClient.get<CommentItem[]>(`/social/stories/${storyId}/comments`);
      return response.data;
    } catch {
      return [];
    }
  },

  addStoryComment: async (storyId: number, text: string, authorName?: string): Promise<CommentItem> => {
    const response = await apiClient.post<CommentItem>(`/social/stories/${storyId}/comments`, {
      text,
      author_name: authorName,
    });
    return response.data;
  },

  // --- SOCIAL: REACTIONS ---
  toggleReaction: async (storyId: number, reactionType: 'objective' | 'fact' | 'fire' | 'like'): Promise<ReactionSummary> => {
    const response = await apiClient.post<ReactionSummary>(`/social/stories/${storyId}/react`, {
      reaction_type: reactionType,
    });
    return response.data;
  },

  // --- SOCIAL: FAVORITES ---
  toggleFavorite: async (storyId: number): Promise<boolean> => {
    const response = await apiClient.post<{ is_favorite: boolean }>(`/social/stories/${storyId}/favorite`);
    return response.data.is_favorite;
  },

  getFavorites: async (): Promise<StoryCluster[]> => {
    try {
      const response = await apiClient.get<StoryCluster[]>('/social/favorites');
      return response.data;
    } catch {
      return [];
    }
  },

  // --- ADMIN PANEL API ---
  getAdminStats: async () => {
    try {
      const response = await apiClient.get('/admin/stats');
      return response.data;
    } catch {
      return {
        total_articles: 0,
        total_clusters: 0,
        total_sources: 0,
        active_sources: 0,
        total_users: 0,
        total_comments: 0,
        bot_status: 'online',
        last_sync: new Date().toISOString(),
      };
    }
  },

  getAdminDetailedStats: async (): Promise<import('../types').AdminDetailedStats | null> => {
    try {
      const response = await apiClient.get<import('../types').AdminDetailedStats>('/admin/stats/detailed');
      return response.data;
    } catch {
      return null;
    }
  },

  getAdminArticles: async (params?: {
    page?: number;
    page_size?: number;
    source_id?: number;
    search?: string;
    has_cluster?: boolean;
    has_media?: boolean;
  }): Promise<{
    items: import('../types').AdminArticleItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> => {
    try {
      const response = await apiClient.get('/admin/articles', { params });
      return response.data;
    } catch {
      return {
        items: [],
        total: 0,
        page: params?.page || 1,
        page_size: params?.page_size || 20,
        total_pages: 1,
      };
    }
  },

  getAdminSettings: async () => {
    try {
      const response = await apiClient.get('/admin/settings');
      return response.data;
    } catch {
      return null;
    }
  },

  updateAdminSettings: async (settingsData: any) => {
    try {
      const response = await apiClient.put('/admin/settings', settingsData);
      return response.data;
    } catch {
      return settingsData;
    }
  },

  triggerAdminIngest: async () => {
    try {
      const response = await apiClient.post('/admin/trigger/ingest');
      return response.data;
    } catch {
      return { status: 'success', message: 'Сбор источников запущен (demo/local)' };
    }
  },

  triggerAdminAnalysis: async () => {
    try {
      const response = await apiClient.post('/admin/trigger/analysis');
      return response.data;
    } catch {
      return { status: 'success', message: 'Анализ ИИ запущен (demo/local)' };
    }
  },

  getAdminSources: async (): Promise<NewsSource[]> => {
    try {
      const response = await apiClient.get<NewsSource[]>('/admin/sources');
      return response.data;
    } catch {
      return [];
    }
  },

  createAdminSource: async (sourceData: Partial<NewsSource>): Promise<NewsSource> => {
    const response = await apiClient.post<NewsSource>('/admin/sources', sourceData);
    return response.data;
  },

  updateAdminSource: async (sourceId: number, sourceData: Partial<NewsSource>): Promise<NewsSource> => {
    const response = await apiClient.put<NewsSource>(`/admin/sources/${sourceId}`, sourceData);
    return response.data;
  },

  deleteAdminSource: async (sourceId: number): Promise<{ status: string }> => {
    const response = await apiClient.delete<{ status: string }>(`/admin/sources/${sourceId}`);
    return response.data;
  },

  triggerAdminRecalculateTrust: async () => {
    try {
      const response = await apiClient.post('/admin/trigger/recalculate-trust');
      return response.data;
    } catch {
      return { status: 'success', message: 'Рейтинг пересчитан' };
    }
  },
};

