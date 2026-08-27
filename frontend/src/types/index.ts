export interface PoliticalVectorItem {
  camp: string;
  position: string;
  tone: string;
  percentage?: number;
  is_covered?: boolean;
}

export interface QuoteItem {
  quote: string;
  speaker_or_source: string;
  source_url: string;
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  caption?: string;
  source_name?: string;
}

export interface TimelineEvent {
  time: string;
  title: string;
  description: string;
}

export interface ArticleSnippet {
  id: number;
  title: string;
  url: string;
  source_name?: string;
  published_at: string;
}

export interface CommentItem {
  id: number;
  cluster_id: number;
  author_name: string;
  author_username?: string;
  author_avatar?: string;
  text: string;
  source: 'web' | 'telegram';
  media_type?: 'photo' | 'sticker' | 'gif';
  media_url?: string;
  created_at: string;
}

export interface ReactionSummary {
  like: number;
  thumb_up: number;
  objective: number;
  fire: number;
  fact: number;
  user_reaction?: string | null;
}

export interface StoryCluster {
  id: number;
  title: string;
  summary: string;
  sentiment: number; // -1.0 to 1.0
  category?: string;
  consensus_score?: number; // 0 to 100%
  polarization_score?: number; // 0 to 100%
  importance_score?: number; // 1 to 10
  importance_reason?: string;
  media?: MediaItem[];
  timeline?: TimelineEvent[];
  political_vectors: PoliticalVectorItem[];
  quotes: QuoteItem[];
  verified_facts: string[];
  blindspots: string[];
  article_count: number;
  sources_count: number;
  created_at: string;
  updated_at: string;
  articles?: ArticleSnippet[];
  comments_count?: number;
  reactions?: ReactionSummary;
  is_favorite?: boolean;
}

export interface FeedResponse {
  items: StoryCluster[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  server_time: string;
}

export type FontFamilyMode = 'sans' | 'serif' | 'mono';
export type FontSizeScale = 'sm' | 'base' | 'lg';
export type ThemeMode = 'dark' | 'light';
export type ActiveTab = 'feed' | 'favorites' | 'media' | 'profile';

export interface UserPreferences {
  sentiment_filter: string;
  political_vectors_filter: string[];
  sources_filter: number[];
  client_refresh_rate: number;
  theme?: ThemeMode;
  font_family?: FontFamilyMode;
  font_size?: FontSizeScale;
  facts_only_mode?: boolean;
}

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  preferences?: UserPreferences;
}

export interface NewsSource {
  id: number;
  name: string;
  url: string;
  feed_type: 'rss' | 'telegram';
  default_camp: string;
  is_active: boolean;
  logo_url?: string;
  factuality_score?: number;
  bias_score?: number;
  coverage_count?: number;
}

export interface MediaDossier {
  id: number;
  name: string;
  shortName: string;
  logoUrl?: string;
  camp: string;
  campColor: string;
  ownership: string;
  founded: string;
  audience: string;
  editorialProfile: string;
  strengths: string[];
  blindspotsTendency: string[];
  factualityScore: number;
  polarizationScore: number;
  coverageCount?: number;
  averageTone: string;
  websiteUrl: string;
}

export type NewsSortMode = 'latest' | 'importance' | 'consensus' | 'polarization' | 'comments';

export interface FeedFilterState {
  sentiment: string;
  political_vector: string;
  category?: string;
  facts_only?: boolean;
  source_ids: string;
  search: string;
  sort_by?: NewsSortMode;
  page: number;
  page_size: number;
}

export interface AdminArticleItem {
  id: number;
  title: string;
  url: string;
  source_id: number;
  source_name: string;
  source_camp: string;
  published_at: string | null;
  created_at: string | null;
  cluster_id: number | null;
  cluster_title: string | null;
  importance_score?: number | null;
  importance_reason?: string | null;
  media_url: string | null;
  snippet: string;
}

export interface AdminClusterItem {
  id: number;
  title: string;
  summary: string;
  category: string;
  sentiment: number;
  importance_score: number;
  importance_reason: string;
  consensus_score: number;
  sources_count: number;
  article_count: number;
  tg_channel_message_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface SourceActivityItem {
  id: number;
  name: string;
  feed_type: string;
  camp: string;
  is_active: boolean;
  logo_url?: string;
  factuality_score: number;
  bias_score: number;
  total_articles: number;
  articles_24h: number;
  clustered_articles: number;
  media_articles: number;
  last_published_at: string | null;
}

export interface AdminDetailedStats {
  articles: {
    total: number;
    last_24h: number;
    last_1h: number;
    unclustered: number;
    with_media: number;
  };
  clusters: {
    total: number;
    last_24h: number;
    in_telegram: number;
    categories: Array<{ category: string; count: number }>;
  };
  sources: SourceActivityItem[];
  token_usage?: {
    last_24h: {
      total_tokens: number;
      total_cost_rub: number;
      stages: {
        embedding: { calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_rub: number };
        cheap_filter: { calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_rub: number };
        story_synthesis: { calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_rub: number };
      };
    };
    all_time: {
      total_tokens: number;
      total_cost_rub: number;
      total_calls: number;
    };
  };
  social: {
    total_users: number;
    total_comments: number;
    total_favorites: number;
    reactions: {
      like: number;
      thumb_up: number;
      objective: number;
      fire: number;
      fact: number;
    };
  };
  system: {
    server_time: string;
    models: {
      cheap_llm?: string;
      llm_model?: string;
    };
    intervals: {
      parse_minutes?: number;
      llm_minutes?: number;
    };
  };
}
