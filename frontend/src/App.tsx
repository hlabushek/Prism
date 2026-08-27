import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, ChevronLeft, ChevronRight, X, Newspaper, Bookmark } from 'lucide-react';
import { useTelegram } from './hooks/useTelegram';
import { useFeed, useUserPreferences, useSources } from './hooks/useFeed';
import { FeedFilterState, FontFamilyMode, ThemeMode, FontSizeScale, ActiveTab, StoryCluster, NewsSortMode } from './types';
import { api } from './api/client';
import { Header } from './components/Header';
import { StoryCard } from './components/StoryCard';
import { SortBar } from './components/SortBar';
import { FilterDrawer } from './components/FilterDrawer';
import { CommentDrawer } from './components/CommentDrawer';
import { MediaTrustModal } from './components/MediaTrustModal';
import { MediaDossierModal } from './components/MediaDossierModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AuthModal } from './components/AuthModal';
import { ProfileView } from './components/ProfileView';
import { BottomNav } from './components/BottomNav';
import { PrismLogo } from './components/PrismLogo';

export const App: React.FC = () => {
  const { user, initData, startParam, haptic, showBackButton, hideBackButton } = useTelegram();
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedDossierMedia, setSelectedDossierMedia] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [factsOnly, setFactsOnly] = useState(false);

  // Authenticated user state (null by default for guests)
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('prism_user');
      if (saved) return JSON.parse(saved);
      return null;
    } catch {
      return null;
    }
  });

  const [activeSourceFilterName, setActiveSourceFilterName] = useState<string | null>(null);

  // Comments state
  const [activeCommentStory, setActiveCommentStory] = useState<StoryCluster | null>(null);

  // Favorites state
  const [favoritesList, setFavoritesList] = useState<StoryCluster[]>([]);
  const [isLoadingFavs, setIsLoadingFavs] = useState(false);

  // Theme, Font & Size states
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('prism_theme') as ThemeMode) || 'dark';
  });
  const [fontFamily, setFontFamily] = useState<FontFamilyMode>(() => {
    return (localStorage.getItem('prism_font') as FontFamilyMode) || 'sans';
  });
  const [fontSize, setFontSize] = useState<FontSizeScale>(() => {
    return (localStorage.getItem('prism_font_size') as FontSizeScale) || 'base';
  });

  const [filters, setFilters] = useState<FeedFilterState>({
    sentiment: 'all',
    political_vector: 'all',
    category: 'all',
    facts_only: false,
    source_ids: '',
    search: '',
    sort_by: 'latest',
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('prism_theme', theme);
  }, [theme]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove('font-sans-mode', 'font-serif-mode', 'font-mono-mode');
    body.classList.add(`font-${fontFamily}-mode`);
    localStorage.setItem('prism_font', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove('text-size-sm', 'text-size-base', 'text-size-lg');
    body.classList.add(`text-size-${fontSize}`);
    localStorage.setItem('prism_font_size', fontSize);
  }, [fontSize]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleFactsOnly = () => {
    setFactsOnly((prev) => !prev);
    setFilters((prev) => ({ ...prev, facts_only: !factsOnly, page: 1 }));
  };

  // Telegram auth & load preferences (safely handle guest/null)
  const targetPrefUserId = currentUser?.telegram_id || currentUser?.id || user?.id || 0;
  const { preferences, updatePreferences } = useUserPreferences(targetPrefUserId);
  const { data: sources = [] } = useSources();

  // Telegram Mini App auto-auth
  useEffect(() => {
    if (initData) {
      api.authenticateTelegram(initData)
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
            localStorage.setItem('prism_user', JSON.stringify(res.user));
            if (res.access_token) {
              localStorage.setItem('prism_auth_token', res.access_token);
            }
          }
        })
        .catch((err) => {
          console.warn('Telegram auth warning:', err);
          if (user && user.id) {
            setCurrentUser(user);
            localStorage.setItem('prism_user', JSON.stringify(user));
          }
        });
    } else if (user && user.id) {
      setCurrentUser(user);
      localStorage.setItem('prism_user', JSON.stringify(user));
    }
  }, [initData, user]);

  // Load favorites
  useEffect(() => {
    setIsLoadingFavs(true);
    api.getFavorites()
      .then((favs) => setFavoritesList(favs))
      .finally(() => setIsLoadingFavs(false));
  }, []);

  const clientRefreshRate = preferences?.client_refresh_rate || 60;

  const {
    data: feedData,
    isLoading,
    isFetching,
    error,
    triggerSync,
    isSyncing,
  } = useFeed(filters, clientRefreshRate);

  // Deep Linking / Startapp story direct navigation
  useEffect(() => {
    let targetStoryId: number | null = null;

    // 1. From Telegram WebApp start_param (e.g. "story_42" or "42")
    if (startParam) {
      const match = String(startParam).match(/\d+/);
      if (match) targetStoryId = parseInt(match[0], 10);
    }

    // 2. From URL Search Parameters (e.g. "?story=42" or "?startapp=story_42")
    if (!targetStoryId && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('story') || params.get('startapp') || params.get('story_id');
      if (urlParam) {
        const match = urlParam.match(/\d+/);
        if (match) targetStoryId = parseInt(match[0], 10);
      }
      if (!targetStoryId && window.location.hash) {
        const match = window.location.hash.match(/\d+/);
        if (match) targetStoryId = parseInt(match[0], 10);
      }
    }

    if (targetStoryId) {
      setActiveTab('feed');
      const timer = setTimeout(() => {
        const el = document.getElementById(`story-card-${targetStoryId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('ring-2', 'ring-sky-500', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-sky-500', 'ring-offset-2');
          }, 3500);
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [startParam, feedData?.items]);

  const handleToggleFavoriteGlobal = () => {
    api.getFavorites().then((favs) => setFavoritesList(favs));
  };

  // Telegram WebApp BackButton Handler
  useEffect(() => {
    const isModalOpen =
      isFilterOpen ||
      isTrustModalOpen ||
      isAdminOpen ||
      isAuthOpen ||
      !!selectedDossierMedia ||
      !!activeCommentStory;

    if (isModalOpen) {
      showBackButton(() => {
        setIsFilterOpen(false);
        setIsTrustModalOpen(false);
        setIsAdminOpen(false);
        setIsAuthOpen(false);
        setSelectedDossierMedia(null);
        setActiveCommentStory(null);
      });
    } else if (activeTab !== 'feed') {
      showBackButton(() => {
        setActiveTab('feed');
      });
    } else {
      hideBackButton();
    }
  }, [
    isFilterOpen,
    isTrustModalOpen,
    isAdminOpen,
    isAuthOpen,
    selectedDossierMedia,
    activeCommentStory,
    activeTab,
    showBackButton,
    hideBackButton,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    haptic('light');
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleCategorySelect = (category: string) => {
    haptic('light');
    if (category === 'favorites_tab') {
      setActiveTab(activeTab === 'favorites' ? 'feed' : 'favorites');
      return;
    }
    setActiveTab('feed');
    setFilters((prev) => ({ ...prev, category, page: 1 }));
  };

  const handleFilterByMediaName = (mediaName: string) => {
    haptic('light');
    setActiveTab('feed');
    setActiveSourceFilterName(mediaName);
    const found = sources.find((s) => s.name.toLowerCase() === mediaName.toLowerCase());
    if (found) {
      setFilters((prev) => ({ ...prev, source_ids: String(found.id), page: 1 }));
    }
  };

  const handleClearSourceFilter = () => {
    setActiveSourceFilterName(null);
    setFilters((prev) => ({ ...prev, source_ids: '', page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    haptic('light');
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortSelect = (sort: NewsSortMode) => {
    haptic('light');
    setFilters((prev) => ({ ...prev, sort_by: sort, page: 1 }));
  };

  const activeFilterCount =
    (filters.sentiment !== 'all' ? 1 : 0) +
    (filters.political_vector !== 'all' ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.source_ids ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (filters.sort_by && filters.sort_by !== 'latest' ? 1 : 0) +
    (factsOnly ? 1 : 0);

  const todayFormatted = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date()).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300 pb-20 sm:pb-8">
      {/* Clean Unified Monolithic Header */}
      <Header
        selectedCategory={activeTab === 'favorites' ? 'favorites_tab' : (filters.category || 'all')}
        onSelectCategory={handleCategorySelect}
        onOpenFilter={() => setIsFilterOpen(true)}
        onOpenTrustModal={() => setIsTrustModalOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        currentUser={currentUser}
        onRefresh={triggerSync}
        isRefreshing={isFetching || isSyncing}
        activeFilterCount={activeFilterCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        fontFamily={fontFamily}
        onChangeFontFamily={setFontFamily}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        factsOnly={factsOnly}
        onToggleFactsOnly={toggleFactsOnly}
        showCategories={activeTab === 'feed'}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 relative z-10">
        {/* --- 1. PROFILE TAB --- */}
        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthOpen(true)}
            onOpenAdminModal={() => setIsAdminOpen(true)}
            onLogout={() => {
              localStorage.removeItem('prism_user');
              localStorage.removeItem('prism_auth_token');
              setCurrentUser(null);
            }}
            fontFamily={fontFamily}
            onChangeFontFamily={setFontFamily}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
          />
        )}

        {/* --- 2. FAVORITES / BOOKMARKS TAB --- */}
        {activeTab === 'favorites' && (
          <div className="space-y-4 animate-fade-in pb-12">
            <div className="text-center pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="font-extrabold text-xs tracking-widest text-slate-500 dark:text-slate-400 uppercase font-sans flex items-center justify-center space-x-1.5">
                <Bookmark className="w-4 h-4 text-amber-500" />
                <span>СОХРАНЕННЫЕ В ЗАКЛАДКИ ({favoritesList.length})</span>
              </span>
            </div>

            {isLoadingFavs && (
              <div className="text-center py-8 text-xs text-slate-400">
                Загрузка сохраненных статей...
              </div>
            )}

            {!isLoadingFavs && favoritesList.length === 0 && (
              <div className="text-center py-12 px-4 rounded-3xl glass-card border border-slate-200 dark:border-white/10 space-y-3 shadow-sm">
                <Bookmark className="w-10 h-10 mx-auto text-amber-500 stroke-1 opacity-70" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  В закладках пока ничего нет
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Нажимайте на значок закладки 🔖 на карточке статьи в ленте, чтобы сохранить её.
                </p>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#1969ae] text-white font-bold text-xs shadow-md"
                >
                  Перейти в ленту новостей
                </button>
              </div>
            )}

            {!isLoadingFavs &&
              favoritesList.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  factsOnly={factsOnly}
                  onOpenComments={(s) => setActiveCommentStory(s)}
                  onToggleFavoriteGlobal={handleToggleFavoriteGlobal}
                  onOpenMediaDossier={(name) => setSelectedDossierMedia(name)}
                />
              ))}
          </div>
        )}

        {/* --- 3. MAIN NEWS FEED TAB --- */}
        {activeTab === 'feed' && (
          <>
            {/* Date Bar */}
            <div className="text-center pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="font-extrabold text-xs tracking-widest text-slate-500 dark:text-slate-400 uppercase font-sans">
                {todayFormatted}
              </span>
              {factsOnly && (
                <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Включен режим «Только верифицированные факты»</span>
                </div>
              )}
            </div>

            {/* Active Source Filter Pill */}
            {activeSourceFilterName && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-[#1969ae] dark:text-sky-300 shadow-sm animate-fade-in">
                <div className="flex items-center space-x-2">
                  <Newspaper className="w-4 h-4 text-sky-500" />
                  <span>Фильтр по изданию: <strong>{activeSourceFilterName}</strong></span>
                </div>
                <button
                  onClick={handleClearSourceFilter}
                  className="p-1 rounded-lg hover:bg-sky-500/20 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  title="Сбросить фильтр по СМИ"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative group">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по инфоповодам, фактам и первоисточникам..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#0a101f] border border-slate-200 dark:border-white/10 focus:border-prism-blue focus:ring-1 focus:ring-prism-blue text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all shadow-sm"
              />
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3 group-focus-within:text-prism-blue transition-colors" />
            </form>

            {/* Quick Sort Bar */}
            <SortBar
              currentSort={filters.sort_by || 'latest'}
              onSelectSort={handleSortSelect}
              totalCount={feedData?.total}
            />

            {/* Loading */}
            {isLoading && (
              <div className="space-y-4 py-2">
                {[1, 2].map((i) => (
                  <div key={i} className="glass-card rounded-2xl p-4 space-y-3 prism-shimmer">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800/80 rounded-md w-1/4" />
                    <div className="h-6 bg-slate-200 dark:bg-slate-800/80 rounded-lg w-3/4" />
                    <div className="h-44 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
                    <div className="h-8 bg-slate-100 dark:bg-slate-800/30 rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <span>Ошибка загрузки данных. Проверьте соединение с сервером Prism.</span>
              </div>
            )}

            {/* Feed List */}
            {!isLoading && feedData && feedData.items.length > 0 && (
              <div className="space-y-4">
                {feedData.items.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    factsOnly={factsOnly}
                    onOpenComments={(s) => setActiveCommentStory(s)}
                    onToggleFavoriteGlobal={handleToggleFavoriteGlobal}
                    onOpenMediaDossier={(name) => setSelectedDossierMedia(name)}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && feedData && feedData.items.length === 0 && (
              <div className="text-center py-12 px-4 rounded-3xl glass-card border border-slate-200 dark:border-white/10 space-y-4 shadow-xl">
                <div className="flex justify-center">
                  <PrismLogo />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Инфоповоды не найдены
                </h3>
                <button
                  onClick={() => {
                    setFilters({
                      sentiment: 'all',
                      political_vector: 'all',
                      category: 'all',
                      facts_only: false,
                      source_ids: '',
                      search: '',
                      page: 1,
                      page_size: 10,
                    });
                    setActiveSourceFilterName(null);
                    setFactsOnly(false);
                    setSearchInput('');
                  }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-[#1969ae] hover:brightness-110 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                >
                  Сбросить все фильтры
                </button>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && feedData && feedData.total_pages > 1 && (
              <div className="flex items-center justify-between pt-4 pb-8 text-xs text-slate-500 dark:text-slate-400">
                <button
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center space-x-1.5 text-slate-700 dark:text-slate-200 transition-all font-medium shadow-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Назад</span>
                </button>

                <span className="font-mono">
                  Страница <strong className="text-slate-900 dark:text-white font-bold">{filters.page}</strong> из {feedData.total_pages}
                </span>

                <button
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= feedData.total_pages}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center space-x-1.5 text-slate-700 dark:text-slate-200 transition-all font-medium shadow-sm"
                >
                  <span>Вперед</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (5 Dedicated Tabs) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenTrustModal={() => setIsTrustModalOpen(true)}
        savedCount={favoritesList.length}
      />

      {/* Comment Drawer Modal */}
      <CommentDrawer
        isOpen={!!activeCommentStory}
        story={activeCommentStory}
        onClose={() => setActiveCommentStory(null)}
      />

      {/* Media Trust Rating Modal */}
      <MediaTrustModal
        isOpen={isTrustModalOpen}
        onClose={() => setIsTrustModalOpen(false)}
        onOpenDossier={(name) => setSelectedDossierMedia(name)}
        onSelectSourceFilter={handleFilterByMediaName}
      />

      {/* Media Dossier Encyclopedia Modal */}
      <MediaDossierModal
        mediaName={selectedDossierMedia}
        onClose={() => setSelectedDossierMedia(null)}
        onFilterByMedia={handleFilterByMediaName}
      />

      {/* Admin Dashboard (Protected for @Not_Hleb) */}
      <AdminDashboardModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        sources={sources}
        onUpdateSourceList={() => {}}
      />

      {/* Telegram 1-Click Deep Link Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(u) => setCurrentUser(u)}
        onLogout={() => {
          localStorage.removeItem('prism_user');
          localStorage.removeItem('prism_auth_token');
          setCurrentUser(null);
        }}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={setFilters}
        sources={sources}
        preferences={preferences}
        onSavePreferences={updatePreferences}
      />
    </div>
  );
};
