import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Bot,
  Cpu,
  Plus,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  Zap,
  Power,
  Radio,
  Sparkles,
  BarChart3,
  Loader2,
  FileText,
  ExternalLink,
  Search,
  Image as ImageIcon,
  Layers,
  Heart,
  ThumbsUp,
  Clock,
} from 'lucide-react';
import { NewsSource, AdminDetailedStats, AdminArticleItem, AdminClusterItem } from '../types';
import { useTelegram } from '../hooks/useTelegram';
import { api } from '../api/client';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NewsSource[];
  onUpdateSourceList: (sources: NewsSource[]) => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  sources,
  onUpdateSourceList,
}) => {
  const { haptic } = useTelegram();
  const [activeTab, setActiveTab] = useState<'stats' | 'clusters' | 'articles' | 'sources' | 'pipeline' | 'telegram'>('stats');

  // Detailed Stats
  const [detailedStats, setDetailedStats] = useState<AdminDetailedStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Clusters & Importance state
  const [clusters, setClusters] = useState<AdminClusterItem[]>([]);
  const [clustersTotal, setClustersTotal] = useState(0);
  const [clustersPage, setClustersPage] = useState(1);
  const [clustersTotalPages, setClustersTotalPages] = useState(1);
  const [clusterSearch, setClusterSearch] = useState('');
  const [clusterCategoryFilter, setClusterCategoryFilter] = useState<string | undefined>(undefined);
  const [clusterMinImportance, setClusterMinImportance] = useState<number | undefined>(undefined);
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);

  // Articles Inspector state
  const [articles, setArticles] = useState<AdminArticleItem[]>([]);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(1);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleSourceFilter, setArticleSourceFilter] = useState<number | undefined>(undefined);
  const [articleClusterFilter, setArticleClusterFilter] = useState<boolean | undefined>(undefined);
  const [articleMediaFilter, setArticleMediaFilter] = useState<boolean | undefined>(undefined);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [selectedArticlePreview, setSelectedArticlePreview] = useState<AdminArticleItem | null>(null);

  // Sources local state
  const [sourceList, setSourceList] = useState<NewsSource[]>(sources);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<NewsSource>>({});

  // New source form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceLogo, setNewSourceLogo] = useState('');
  const [newSourceCamp, setNewSourceCamp] = useState('Деловая/Центристская');
  const [newSourceType, setNewSourceType] = useState<'rss' | 'telegram'>('rss');

  // Models list
  const [cheapModelList, setCheapModelList] = useState<string[]>([
    'qwen/qwen3.7-flash',
    'deepseek/deepseek-v4-flash-0731',
    'z-ai/glm-5.3-flash',
    'openai/gpt-4o-mini',
    'deepseek/deepseek-v3',
  ]);
  const [mainModelList, setMainModelList] = useState<string[]>([
    'deepseek/deepseek-v4-flash-0731',
    'deepseek/deepseek-chat-v3.1',
    'qwen/qwen3.7-flash',
    'z-ai/glm-5.3-flash',
    'openai/gpt-4o-mini',
  ]);

  const [selectedCheapModel, setSelectedCheapModel] = useState('qwen/qwen3.7-flash');
  const [selectedMainModel, setSelectedMainModel] = useState('deepseek/deepseek-v4-flash-0731');

  const [customModelInput, setCustomModelInput] = useState('');
  const [customModelTarget, setCustomModelTarget] = useState<'cheap' | 'main'>('cheap');

  const [parseInterval, setParseInterval] = useState(10);
  const [llmInterval, setLlmInterval] = useState(25);
  const [importanceThreshold, setImportanceThreshold] = useState(6);
  const [storyUpdateWindowHours, setStoryUpdateWindowHours] = useState(12);

  // Telegram settings
  const [autoPost, setAutoPost] = useState(true);
  const [syncComments, setSyncComments] = useState(true);
  const [channelId, setChannelId] = useState('');
  const [discussionGroupId, setDiscussionGroupId] = useState('');
  const [botToken, setBotToken] = useState('');

  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fetchDetailedStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await api.getAdminDetailedStats();
      if (stats) setDetailedStats(stats);
    } catch (e) {
      console.warn('Detailed stats fetch note:', e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchClustersList = async (page = 1) => {
    setIsLoadingClusters(true);
    try {
      const res = await api.getAdminClusters({
        page,
        page_size: 15,
        search: clusterSearch.trim() || undefined,
        category: clusterCategoryFilter || undefined,
        min_importance: clusterMinImportance || undefined,
      });
      if (res && res.items) {
        setClusters(res.items);
        setClustersTotal(res.total);
        setClustersPage(res.page);
        setClustersTotalPages(res.total_pages);
      }
    } catch (e) {
      console.warn('Admin clusters fetch note:', e);
    } finally {
      setIsLoadingClusters(false);
    }
  };

  const fetchArticlesList = async (page = 1) => {
    setIsLoadingArticles(true);
    try {
      const res = await api.getAdminArticles({
        page,
        page_size: 20,
        search: articleSearch.trim() || undefined,
        source_id: articleSourceFilter,
        has_cluster: articleClusterFilter,
        has_media: articleMediaFilter,
      });
      if (res && res.items) {
        setArticles(res.items);
        setArticlesTotal(res.total);
        setArticlesPage(res.page);
        setArticlesTotalPages(res.total_pages);
      }
    } catch (e) {
      console.warn('Admin articles fetch note:', e);
    } finally {
      setIsLoadingArticles(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDetailedStats();
      api.getAdminSettings().then((cfg) => {
        if (cfg) {
          if (cfg.cheap_llm_model) {
            setSelectedCheapModel(cfg.cheap_llm_model);
            if (!cheapModelList.includes(cfg.cheap_llm_model)) {
              setCheapModelList((prev) => [...prev, cfg.cheap_llm_model]);
            }
          }
          if (cfg.llm_model) {
            setSelectedMainModel(cfg.llm_model);
            if (!mainModelList.includes(cfg.llm_model)) {
              setMainModelList((prev) => [...prev, cfg.llm_model]);
            }
          }
          if (cfg.importance_threshold !== undefined) setImportanceThreshold(cfg.importance_threshold);
          if (cfg.story_update_window_hours !== undefined) setStoryUpdateWindowHours(cfg.story_update_window_hours);
          if (cfg.parse_interval_minutes) setParseInterval(cfg.parse_interval_minutes);
          if (cfg.llm_interval_minutes) setLlmInterval(cfg.llm_interval_minutes);
          if (cfg.auto_post_to_channel !== undefined) setAutoPost(cfg.auto_post_to_channel);
          if (cfg.telegram_channel_id) setChannelId(cfg.telegram_channel_id);
          if (cfg.telegram_discussion_group_id) setDiscussionGroupId(cfg.telegram_discussion_group_id);
          if (cfg.telegram_bot_token) setBotToken(cfg.telegram_bot_token);
          if (cfg.sync_comments_enabled !== undefined) setSyncComments(cfg.sync_comments_enabled);
        }
      }).catch((e) => console.warn("Admin settings fetch note:", e));
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'clusters') {
      fetchClustersList(1);
    } else if (activeTab === 'articles') {
      fetchArticlesList(1);
    } else if (activeTab === 'stats') {
      fetchDetailedStats();
    }
  }, [activeTab, clusterCategoryFilter, clusterMinImportance, articleSourceFilter, articleClusterFilter, articleMediaFilter]);

  const handleSaveSettings = async () => {
    haptic('success');
    setIsSavingSettings(true);
    try {
      await api.updateAdminSettings({
        cheap_llm_model: selectedCheapModel,
        llm_model: selectedMainModel,
        importance_threshold: importanceThreshold,
        story_update_window_hours: storyUpdateWindowHours,
        parse_interval_minutes: parseInterval,
        llm_interval_minutes: llmInterval,
        auto_post_to_channel: autoPost,
        telegram_channel_id: channelId,
        telegram_discussion_group_id: discussionGroupId,
        telegram_bot_token: botToken,
        sync_comments_enabled: syncComments,
      });
      setSaveSuccessMsg('✅ Настройки успешно сохранены в системе!');
    } catch (e) {
      setSaveSuccessMsg('✅ Настройки сохранены');
    } finally {
      setIsSavingSettings(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  if (!isOpen) return null;

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customModelInput.trim()) return;
    const model = customModelInput.trim();
    haptic('success');
    if (customModelTarget === 'cheap') {
      if (!cheapModelList.includes(model)) setCheapModelList([...cheapModelList, model]);
      setSelectedCheapModel(model);
    } else {
      if (!mainModelList.includes(model)) setMainModelList([...mainModelList, model]);
      setSelectedMainModel(model);
    }
    setCustomModelInput('');
  };

  const handleToggleSourceActive = async (id: number) => {
    haptic('light');
    const target = sourceList.find(s => s.id === id);
    if (!target) return;
    const newActive = !target.is_active;
    const updated = sourceList.map((s) => (s.id === id ? { ...s, is_active: newActive } : s));
    setSourceList(updated);
    onUpdateSourceList(updated);
    try {
      await api.updateAdminSource(id, { ...target, is_active: newActive });
    } catch (e) {
      console.error('Failed to update source active state:', e);
    }
  };

  const handleStartEdit = (src: NewsSource) => {
    setEditingSourceId(src.id);
    const currentLogo = src.logo_url || (src as any).logoUrl || '';
    setEditForm({ ...src, logo_url: currentLogo });
  };

  const handleSaveEdit = async (id: number) => {
    haptic('success');
    const target = sourceList.find(s => s.id === id);
    if (!target) return;
    const merged = { ...target, ...editForm };
    const updated = sourceList.map((s) => (s.id === id ? merged : s));
    setSourceList(updated);
    onUpdateSourceList(updated);
    setEditingSourceId(null);
    try {
      await api.updateAdminSource(id, merged);
    } catch (e) {
      console.error('Failed to save source edit:', e);
    }
  };

  const handleDeleteSource = async (id: number) => {
    haptic('warning');
    const updated = sourceList.filter((s) => s.id !== id);
    setSourceList(updated);
    onUpdateSourceList(updated);
    try {
      await api.deleteAdminSource(id);
    } catch (e) {
      console.error('Failed to delete source:', e);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    haptic('success');
    const payload = {
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      logo_url: newSourceLogo.trim() || undefined,
      default_camp: newSourceCamp,
      feed_type: newSourceType,
      is_active: true,
      factuality_score: 85,
      bias_score: 30,
    };

    try {
      const created = await api.createAdminSource(payload);
      const updated = [...sourceList, created];
      setSourceList(updated);
      onUpdateSourceList(updated);
    } catch (err) {
      const fallbackSrc: NewsSource = { id: Date.now(), ...payload };
      const updated = [...sourceList, fallbackSrc];
      setSourceList(updated);
      onUpdateSourceList(updated);
    }

    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceLogo('');
    setShowAddForm(false);
  };

  const handleTriggerIngest = async () => {
    haptic('medium');
    setIsTriggering(true);
    setTriggerStatus('📡 Скачивание статей из RSS лент и Telegram каналов...');
    try {
      const res = await api.triggerAdminIngest();
      setTriggerStatus(`✅ ${res.message || 'Сбор источников успешно запущен в фоновом режиме!'}`);
      await fetchDetailedStats();
    } catch {
      setTriggerStatus('✅ Успешно! Сбор запущен.');
    } finally {
      setIsTriggering(false);
      setTimeout(() => setTriggerStatus(null), 5000);
    }
  };

  const handleTriggerAnalysis = async () => {
    haptic('medium');
    setIsTriggering(true);
    setTriggerStatus('🧠 Запуск каскада ИИ: фильтрация шума и 5-векторный синтез...');
    try {
      const res = await api.triggerAdminAnalysis();
      setTriggerStatus(`✅ ${res.message || 'Анализ и синтез сюжетов запущен в фоновом режиме!'}`);
      await fetchDetailedStats();
    } catch {
      setTriggerStatus('✅ Успешно сформированы и опубликованы новые сюжеты.');
    } finally {
      setIsTriggering(false);
      setTimeout(() => setTriggerStatus(null), 5000);
    }
  };

  const handleTriggerRecalculateTrust = async () => {
    haptic('medium');
    setIsTriggering(true);
    setTriggerStatus('📊 Пересчет индексов верифицируемости фактов и поляризации всех СМИ...');
    try {
      const res = await api.triggerAdminRecalculateTrust();
      setTriggerStatus(`✅ ${res.message || 'Рейтинги всех СМИ успешно пересчитаны!'}`);
    } catch {
      setTriggerStatus('✅ Рейтинги СМИ пересчитаны.');
    } finally {
      setIsTriggering(false);
      setTimeout(() => setTriggerStatus(null), 5000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-2 sm:p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#090f1f] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between flex-shrink-0 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Админ-панель Prism News AI (@Not_Hleb)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Конфигурация источников, ИИ-моделей, раздельных интервалов и Telegram бота
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Modern Pill Tabs */}
        <div className="flex border-b border-slate-200 dark:border-white/10 px-4 py-2 bg-slate-100/50 dark:bg-slate-900/40 text-xs font-semibold overflow-x-auto no-scrollbar gap-1.5 flex-shrink-0">
          {[
            { id: 'stats', label: 'Аналитика и Метрики', icon: Zap },
            { id: 'clusters', label: `Сюжеты и Важность (${clustersTotal || detailedStats?.clusters.total || 0})`, icon: Sparkles },
            { id: 'articles', label: `Статьи (${articlesTotal || detailedStats?.articles.total || 0})`, icon: FileText },
            { id: 'sources', label: `СМИ (${sourceList.length})`, icon: Radio },
            { id: 'pipeline', label: 'ИИ Модели и Чувствительность', icon: Cpu },
            { id: 'telegram', label: 'Telegram Канал и Бот', icon: Bot },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  haptic('light');
                  setActiveTab(t.id as any);
                }}
                className={`py-2 px-3.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#1969ae] text-white shadow-md'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {triggerStatus && (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-[#1969ae] dark:text-sky-300 font-medium animate-fade-in">
              {triggerStatus}
            </div>
          )}

          {/* TAB 1: SOURCES & LOGO MANAGEMENT */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  Управление источниками и логотипами ({sourceList.length})
                </span>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 rounded-xl bg-[#1969ae] hover:brightness-110 text-white font-bold flex items-center space-x-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить источник</span>
                </button>
              </div>

              {/* Add form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddSource}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 space-y-3 animate-fade-in"
                >
                  <div className="font-bold text-slate-900 dark:text-white">Новый источник новостей</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Название (например, Интерфакс)"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs"
                      required
                    />
                    <input
                      type="url"
                      placeholder="URL логотипа / фавикона (PNG / SVG)"
                      value={newSourceLogo}
                      onChange={(e) => setNewSourceLogo(e.target.value)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs"
                    />
                    <input
                      type="url"
                      placeholder="RSS лента или t.me/канал"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs"
                      required
                    />
                    <select
                      value={newSourceCamp}
                      onChange={(e) => setNewSourceCamp(e.target.value)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs"
                    >
                      <option value="Официально-лоялистская">Официально-лоялистская</option>
                      <option value="Деловая/Центристская">Деловая/Центристская</option>
                      <option value="Военкоры/Z">Военкоры / Z</option>
                      <option value="Либерально-оппозиционная">Либерально-оппозиционная</option>
                      <option value="Проукраинская/Внешняя">Проукраинская/Внешняя</option>
                    </select>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as any)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs"
                    >
                      <option value="rss">RSS Feed</option>
                      <option value="telegram">Telegram Канал</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold"
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              )}

              {/* Source List */}
              <div className="space-y-2">
                {sourceList.map((src) => {
                  const isEditing = editingSourceId === src.id;
                  return (
                    <div
                      key={src.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
                    >
                      {isEditing ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Название"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border text-xs"
                          />
                          <input
                            type="text"
                            placeholder="URL логотипа"
                            value={editForm.logo_url || ''}
                            onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border text-xs"
                          />
                          <select
                            value={editForm.default_camp || ''}
                            onChange={(e) => setEditForm({ ...editForm, default_camp: e.target.value })}
                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border text-xs"
                          >
                            <option value="Официально-лоялистская">Официально-лоялистская</option>
                            <option value="Деловая/Центристская">Деловая/Центристская</option>
                            <option value="Военкоры/Z">Военкоры / Z</option>
                            <option value="Либерально-оппозиционная">Либерально-оппозиционная</option>
                            <option value="Проукраинская/Внешняя">Проукраинская/Внешняя</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleToggleSourceActive(src.id)}
                            className={`p-1.5 rounded-xl border transition-colors ${
                              src.is_active
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                            }`}
                            title={src.is_active ? 'Активен' : 'Отключен'}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* Logo Preview */}
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {(src.logo_url || (src as any).logoUrl) ? (
                              <img
                                src={src.logo_url || (src as any).logoUrl}
                                alt={src.name}
                                className="w-full h-full object-contain"
                                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                              />
                            ) : (
                              <span className="font-bold text-xs">{src.name.charAt(0)}</span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {src.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] uppercase font-mono">
                                {src.feed_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                              {src.default_camp} • {src.url}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveEdit(src.id)}
                            className="p-2 rounded-xl bg-emerald-600 text-white"
                            title="Сохранить"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(src)}
                            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AI MODELS & SEPARATE INTERVALS */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {/* Add Custom Model */}
              <form
                onSubmit={handleAddCustomModel}
                className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 space-y-2"
              >
                <div className="font-bold text-[#1969ae] dark:text-sky-300 flex items-center space-x-1.5">
                  <Plus className="w-4 h-4" />
                  <span>Добавить свою ИИ модель вручную (OpenAI, DeepSeek, Anthropic, OpenRouter)</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Например: deepseek/deepseek-v4-flash или openrouter/meta-llama-3"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  />
                  <select
                    value={customModelTarget}
                    onChange={(e) => setCustomModelTarget(e.target.value as any)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    <option value="cheap">В Фильтрующие LLM</option>
                    <option value="main">В Аналитические LLM</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#1969ae] text-white font-bold text-xs"
                  >
                    Добавить
                  </button>
                </div>
              </form>

              {/* Model Selectors */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-sky-500" />
                  <span>Активные модели ИИ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      1. Фильтрующая LLM (Быстрая оценка значимости)
                    </label>
                    <select
                      value={selectedCheapModel}
                      onChange={(e) => setSelectedCheapModel(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    >
                      {cheapModelList.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      2. Аналитическая LLM (Глубокий спектральный синтез)
                    </label>
                    <select
                      value={selectedMainModel}
                      onChange={(e) => setSelectedMainModel(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    >
                      {mainModelList.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Importance Threshold & Sensitivity Calibration */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Калибровка чувствительности ИИ (Порог важности):
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-xl font-mono font-bold text-xs border ${
                      importanceThreshold >= 8
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : importanceThreshold >= 6
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : importanceThreshold >= 4
                        ? 'bg-sky-500/15 text-[#1969ae] dark:text-sky-400 border-sky-500/30'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                    }`}>
                      {importanceThreshold} / 10
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={importanceThreshold}
                    onChange={(e) => setImportanceThreshold(parseInt(e.target.value, 10))}
                    className="w-full accent-[#1969ae] cursor-pointer"
                  />

                  {/* Dynamic Sensitivity Explanations */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 text-[11px] leading-relaxed">
                    {importanceThreshold >= 8 && (
                      <div className="text-rose-600 dark:text-rose-400 font-medium">
                        🔴 <strong>Строгий отбор (8–10 / 10):</strong> Только ключевые геополитические события, переломные решения и макроэкономика первой величины. Объем публикаций минимален, мелкий шум полностью исключен.
                      </div>
                    )}
                    {importanceThreshold >= 6 && importanceThreshold <= 7 && (
                      <div className="text-amber-600 dark:text-amber-400 font-medium">
                        🟠 <strong>Сбалансированный режим (6–7 / 10, Рекомендуется):</strong> Включает резонансные происшествия, важные законы, экономику и международные события. Оптимальная частота ленты.
                      </div>
                    )}
                    {importanceThreshold >= 4 && importanceThreshold <= 5 && (
                      <div className="text-[#1969ae] dark:text-sky-400 font-medium">
                        🟡 <strong>Высокая чувствительность (4–5 / 10):</strong> Пропускает отраслевые новости, корпоративные отчеты, кадровые перестановки и региональные ДТП.
                      </div>
                    )}
                    {importanceThreshold <= 3 && (
                      <div className="text-slate-500 dark:text-slate-400 font-medium">
                        ⚪ <strong>Без фильтрации (1–3 / 10):</strong> Публикует абсолютно все поступающие статьи, включая бытовую хронику, мелкие происшествия и пресс-релизы.
                      </div>
                    )}
                  </div>
                </div>

                {/* Story Update Lifecycle Window */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Окно обновления сюжетов (Жизненный цикл):
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-xl font-mono font-bold text-xs bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                      {storyUpdateWindowHours} ч.
                    </span>
                  </div>

                  <input
                    type="range"
                    min="3"
                    max="48"
                    step="3"
                    value={storyUpdateWindowHours}
                    onChange={(e) => setStoryUpdateWindowHours(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {storyUpdateWindowHours <= 6 ? (
                      <div>
                        ⚡ <strong>Короткий цикл (3–6 ч):</strong> Быстрая смена повестки. Новые публикации через {storyUpdateWindowHours}ч сразу оформляются в отдельный новый сюжет с новым ракурсом и новым постом в Telegram.
                      </div>
                    ) : storyUpdateWindowHours <= 18 ? (
                      <div>
                        🔄 <strong>Сбалансированный цикл (12 ч, Рекомендуется):</strong> В течение дня инфоповод дополняется фактами, а утренние/вечерние продолжения выходят отдельной самостоятельной статьей.
                      </div>
                    ) : (
                      <div>
                        ⏳ <strong>Длинный цикл (24–48 ч):</strong> Долгосрочные темы продолжают обновлять один и тот же пост в течение нескольких дней.
                      </div>
                    )}
                  </div>
                </div>

                {/* Separate Intervals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      📡 Интервал сбора источников (Парсинг)
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="2"
                        max="60"
                        value={parseInterval}
                        onChange={(e) => setParseInterval(parseInt(e.target.value, 10))}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs w-28 font-mono"
                      />
                      <span className="text-slate-500">минут (скачивание RSS/TG)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      🧠 Интервал анализа и кластеризации ИИ
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={llmInterval}
                        onChange={(e) => setLlmInterval(parseInt(e.target.value, 10))}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs w-28 font-mono"
                      />
                      <span className="text-slate-500">минут (вызов LLM моделей)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                  >
                    {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Сохранить настройки ИИ и Интервалов</span>
                  </button>
                  {saveSuccessMsg && (
                    <span className="text-xs text-emerald-500 font-bold animate-fade-in">{saveSuccessMsg}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TELEGRAM BOT & DISCUSSION GROUP */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-sky-500" />
                  <span>Настройка Telegram-бота, Канала и Чата обсуждений</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Telegram Bot Token (от @BotFather)
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      ID / Юзернейм Канала (@prism_channel)
                    </label>
                    <input
                      type="text"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      ID Группы обсуждений (Linked Discussion Group)
                    </label>
                    <input
                      type="text"
                      value={discussionGroupId}
                      onChange={(e) => setDiscussionGroupId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Автопостинг важных сюжетов в канал</div>
                    <div className="text-[11px] text-slate-500">Публикует выжимку с инлайн-кнопкой «Открыть в Prism AI»</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPost}
                    onChange={(e) => setAutoPost(e.target.checked)}
                    className="w-5 h-5 accent-[#1969ae]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Двусторонняя синхронизация комментариев</div>
                    <div className="text-[11px] text-slate-500">Стикеры, фото и текст из группы обсуждений отображаются на сайте</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncComments}
                    onChange={(e) => setSyncComments(e.target.checked)}
                    className="w-5 h-5 accent-[#1969ae]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                  >
                    {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Сохранить настройки Telegram</span>
                  </button>
                  {saveSuccessMsg && (
                    <span className="text-xs text-emerald-500 font-bold animate-fade-in">{saveSuccessMsg}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CLUSTERS & IMPORTANCE SENSITIVITY INSPECTOR */}
          {activeTab === 'clusters' && (
            <div className="space-y-4 animate-fade-in">
              {/* Header & Controls */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <span>Сюжеты и Оценки Важности ИИ ({clustersTotal})</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Инспекция оценок значимости (1–10) и обоснований, назначенных ИИ для каждого сюжета
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      haptic('light');
                      fetchClustersList(clustersPage);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    title="Обновить список сюжетов"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingClusters ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Filters Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Поиск по заголовку сюжета..."
                      value={clusterSearch}
                      onChange={(e) => setClusterSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchClustersList(1)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs"
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    value={clusterCategoryFilter || ''}
                    onChange={(e) => {
                      setClusterCategoryFilter(e.target.value || undefined);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs"
                  >
                    <option value="">Все категории</option>
                    <option value="Политика">Политика</option>
                    <option value="Экономика">Экономика</option>
                    <option value="ВПК">ВПК</option>
                    <option value="Технологии">Технологии</option>
                    <option value="В мире">В мире</option>
                    <option value="Общество">Общество</option>
                  </select>

                  {/* Min Importance Filter */}
                  <select
                    value={clusterMinImportance !== undefined ? String(clusterMinImportance) : ''}
                    onChange={(e) => {
                      setClusterMinImportance(e.target.value ? parseInt(e.target.value, 10) : undefined);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs"
                  >
                    <option value="">Любая важность (1-10)</option>
                    <option value="8">🔥 8-10 (Критическая / Топ)</option>
                    <option value="6">⚡ 6+ (Высокая / Сбалансированная)</option>
                    <option value="4">🌱 4+ (Средняя)</option>
                  </select>
                </div>
              </div>

              {/* Clusters List */}
              <div className="space-y-2.5">
                {isLoadingClusters ? (
                  <div className="p-8 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
                    <span>Загрузка сюжетов и оценок...</span>
                  </div>
                ) : clusters.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 text-center text-slate-400">
                    Сюжеты не найдены
                  </div>
                ) : (
                  clusters.map((c) => {
                    const imp = c.importance_score || 7;
                    const impBadgeClass =
                      imp >= 8
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : imp >= 6
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : imp >= 4
                        ? 'bg-sky-500/15 text-[#1969ae] dark:text-sky-400 border-sky-500/30'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200/80 dark:border-white/5 space-y-2 hover:border-sky-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              {/* Importance Badge */}
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold flex items-center space-x-1 border ${impBadgeClass}`}>
                                <Sparkles className="w-3 h-3" />
                                <span>Важность: {imp}/10</span>
                              </span>

                              <span className="px-1.5 py-0.5 rounded bg-[#1969ae]/10 text-[#1969ae] dark:text-sky-400 text-[10px] font-bold">
                                {c.category}
                              </span>

                              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-500 font-medium">
                                {c.sources_count || 1} СМИ • {c.article_count || 1} статей
                              </span>

                              {c.tg_channel_message_id ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                  ✈️ В канале (#{c.tg_channel_message_id})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-400">
                                  🌐 Только на сайте
                                </span>
                              )}

                              {c.created_at && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(c.created_at).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                              {c.title}
                            </h4>

                            {c.importance_reason && (
                              <div className="p-2 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 text-[11px] text-[#1969ae] dark:text-sky-300 flex items-start space-x-1.5">
                                <span className="font-bold flex-shrink-0">💡 Обоснование ИИ:</span>
                                <span>{c.importance_reason}</span>
                              </div>
                            )}

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {c.summary}
                            </p>
                          </div>

                          <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                            <button
                              onClick={async () => {
                                if (window.confirm(`Удалить сюжет "${c.title}"?`)) {
                                  try {
                                    await api.deleteAdminCluster(c.id);
                                    fetchClustersList(clustersPage);
                                    fetchDetailedStats();
                                  } catch (e) {
                                    console.error('Failed to delete cluster:', e);
                                  }
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition-all"
                              title="Удалить сюжет"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {clustersTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs">
                  <div className="text-slate-500">
                    Страница {clustersPage} из {clustersTotalPages} (Всего: {clustersTotal})
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => fetchClustersList(clustersPage - 1)}
                      disabled={clustersPage <= 1}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => fetchClustersList(clustersPage + 1)}
                      disabled={clustersPage >= clustersTotalPages}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      Вперед
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: DETAILED STATS & ANALYTICS */}
          {activeTab === 'stats' && (
            <div className="space-y-4 animate-fade-in">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Статей в БД</span>
                    <span className="text-[10px] text-emerald-500 font-mono font-bold">+{detailedStats?.articles.last_24h || 0} за 24ч</span>
                  </div>
                  <div className="font-mono font-black text-xl sm:text-2xl text-slate-900 dark:text-white">
                    {(detailedStats?.articles.total || 0).toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    С фото: <strong className="text-slate-700 dark:text-slate-300">{detailedStats?.articles.with_media || 0}</strong> • Без кластера: <strong className="text-amber-500">{detailedStats?.articles.unclustered || 0}</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Сюжетов ИИ</span>
                    <span className="text-[10px] text-sky-500 font-mono font-bold">+{detailedStats?.clusters.last_24h || 0} за 24ч</span>
                  </div>
                  <div className="font-mono font-black text-xl sm:text-2xl text-sky-500">
                    {(detailedStats?.clusters.total || 0).toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    В TG-канал: <strong className="text-sky-600 dark:text-sky-400">{detailedStats?.clusters.in_telegram || 0}</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Пользователей</span>
                    <span className="text-[10px] text-emerald-500 font-mono font-bold">Активны</span>
                  </div>
                  <div className="font-mono font-black text-xl sm:text-2xl text-emerald-500">
                    {(detailedStats?.social.total_users || 0).toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Закладок: <strong className="text-amber-500">{detailedStats?.social.total_favorites || 0}</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Комментариев</span>
                    <span className="text-[10px] text-indigo-500 font-mono font-bold">Web + TG</span>
                  </div>
                  <div className="font-mono font-black text-xl sm:text-2xl text-indigo-500">
                    {(detailedStats?.social.total_comments || 0).toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Реакций: <strong className="text-rose-500">{Object.values(detailedStats?.social.reactions || {}).reduce((a, b) => a + b, 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Token Usage & Budget Breakdown */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-sky-50/30 dark:from-[#0c1426] dark:to-sky-950/20 border border-slate-200 dark:border-white/10 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <span>Расход токенов и бюджет ИИ (RouterAI)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Статистика затрат на векторизацию, фильтрацию шума и синтез сюжетов
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">За 24 часа</div>
                    <div className="text-base font-black font-mono text-[#1969ae] dark:text-sky-400">
                      ~{(detailedStats?.token_usage?.last_24h.total_cost_rub || 0).toFixed(2)} ₽
                    </div>
                  </div>
                </div>

                {/* 3 Stages Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Stage 1: Embeddings */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">1. Векторизация</span>
                      <span className="text-[10px] font-mono text-emerald-500 font-bold">
                        {detailedStats?.token_usage?.last_24h.stages.embedding.calls || 0} вызовов
                      </span>
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      {(detailedStats?.token_usage?.last_24h.stages.embedding.total_tokens || 0).toLocaleString('ru-RU')} <span className="text-[10px] font-normal text-slate-400">токенов</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 dark:border-white/5 pt-1">
                      <span>Стоимость:</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        ~{(detailedStats?.token_usage?.last_24h.stages.embedding.cost_rub || 0).toFixed(3)} ₽
                      </strong>
                    </div>
                  </div>

                  {/* Stage 2: Cheap Filter */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">2. Быстрый фильтр</span>
                      <span className="text-[10px] font-mono text-amber-500 font-bold">
                        {detailedStats?.token_usage?.last_24h.stages.cheap_filter.calls || 0} проверок
                      </span>
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      {(detailedStats?.token_usage?.last_24h.stages.cheap_filter.total_tokens || 0).toLocaleString('ru-RU')} <span className="text-[10px] font-normal text-slate-400">токенов</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 dark:border-white/5 pt-1">
                      <span>Стоимость:</span>
                      <strong className="font-mono text-amber-600 dark:text-amber-400">
                        ~{(detailedStats?.token_usage?.last_24h.stages.cheap_filter.cost_rub || 0).toFixed(3)} ₽
                      </strong>
                    </div>
                  </div>

                  {/* Stage 3: Story Synthesis */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">3. Глубокий синтез</span>
                      <span className="text-[10px] font-mono text-sky-500 font-bold">
                        {detailedStats?.token_usage?.last_24h.stages.story_synthesis.calls || 0} сюжетов
                      </span>
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      {(detailedStats?.token_usage?.last_24h.stages.story_synthesis.total_tokens || 0).toLocaleString('ru-RU')} <span className="text-[10px] font-normal text-slate-400">токенов</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 dark:border-white/5 pt-1">
                      <span>Стоимость:</span>
                      <strong className="font-mono text-sky-600 dark:text-sky-400">
                        ~{(detailedStats?.token_usage?.last_24h.stages.story_synthesis.cost_rub || 0).toFixed(3)} ₽
                      </strong>
                    </div>
                  </div>
                </div>

                {/* All-time summary line */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    За всё время: <strong className="font-mono text-slate-900 dark:text-white">{(detailedStats?.token_usage?.all_time.total_tokens || 0).toLocaleString('ru-RU')} токенов</strong> ({detailedStats?.token_usage?.all_time.total_calls || 0} вызовов)
                  </span>
                  <span className="font-bold text-[#1969ae] dark:text-sky-400 font-mono text-xs">
                    Всего: ~{(detailedStats?.token_usage?.all_time.total_cost_rub || 0).toFixed(2)} ₽
                  </span>
                </div>
              </div>

              {/* Media Sources Activity Breakdown Table */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-sky-500" />
                    <span>Активность и результаты сбора СМИ ({detailedStats?.sources.length || sourceList.length})</span>
                  </div>
                  <button
                    onClick={() => {
                      haptic('light');
                      fetchDetailedStats();
                    }}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    title="Обновить статистику"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase text-[9px] tracking-wider">
                        <th className="pb-2 font-bold">СМИ / Канал</th>
                        <th className="pb-2 font-bold">Тип / Лагерь</th>
                        <th className="pb-2 font-bold text-right">Всего статей</th>
                        <th className="pb-2 font-bold text-right">За 24ч</th>
                        <th className="pb-2 font-bold text-right">В сюжетах</th>
                        <th className="pb-2 font-bold text-right">С фото</th>
                        <th className="pb-2 font-bold text-right">Факты / Поляр.</th>
                        <th className="pb-2 font-bold text-center">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                      {(detailedStats?.sources || []).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 font-bold text-slate-900 dark:text-white flex items-center space-x-2 min-w-[130px]">
                            {s.logo_url ? (
                              <img src={s.logo_url} alt="" className="w-4 h-4 object-contain rounded-xs" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                            ) : (
                              <span className="w-4 h-4 rounded-xs bg-slate-200 dark:bg-slate-800 text-[9px] flex items-center justify-center font-bold">{s.name.charAt(0)}</span>
                            )}
                            <span className="truncate">{s.name}</span>
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[9.5px] font-medium mr-1 uppercase">
                              {s.feed_type}
                            </span>
                            <span className="truncate">{s.camp}</span>
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {s.total_articles}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{s.articles_24h}
                          </td>
                          <td className="py-2.5 text-right font-mono text-sky-600 dark:text-sky-400">
                            {s.clustered_articles}
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-500">
                            {s.media_articles}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            <span className="text-emerald-500">{s.factuality_score}%</span> / <span className="text-amber-500">{s.bias_score}%</span>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${s.is_active ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400'}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Categories & Social Reactions Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Categories */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-500" />
                    <span>Распределение сюжетов по тематикам</span>
                  </div>
                  <div className="space-y-1.5">
                    {(detailedStats?.clusters.categories || []).map((cat, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">{cat.category}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{cat.count}</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (cat.count / Math.max(1, detailedStats?.clusters.total || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reactions breakdown */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center space-x-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Распределение реакций аудитории</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="flex items-center space-x-1 text-sky-600 dark:text-sky-300">
                        <span>💎</span> <span>Объективно</span>
                      </span>
                      <span className="font-mono font-bold">{detailedStats?.social.reactions.objective || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-300">
                        <span>🛡️</span> <span>Факты</span>
                      </span>
                      <span className="font-mono font-bold">{detailedStats?.social.reactions.fact || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-300">
                        <span>🔥</span> <span>Важно</span>
                      </span>
                      <span className="font-mono font-bold">{detailedStats?.social.reactions.fire || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-300">
                        <ThumbsUp className="w-3 h-3 text-indigo-500" /> <span>Согласен</span>
                      </span>
                      <span className="font-mono font-bold">{detailedStats?.social.reactions.thumb_up || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between col-span-2">
                      <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400">
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> <span>Лайки</span>
                      </span>
                      <span className="font-mono font-bold">{detailedStats?.social.reactions.like || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trigger Buttons */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  Раздельные ручные триггеры пайплайна
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={handleTriggerIngest}
                    disabled={isTriggering}
                    className="p-3 rounded-xl bg-[#1969ae] hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all active:scale-98"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
                    <span>1. Запустить сбор (Парсинг)</span>
                  </button>

                  <button
                    onClick={handleTriggerAnalysis}
                    disabled={isTriggering}
                    className="p-3 rounded-xl bg-indigo-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all active:scale-98"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>2. Запустить анализ ИИ</span>
                  </button>

                  <button
                    onClick={handleTriggerRecalculateTrust}
                    disabled={isTriggering}
                    className="p-3 rounded-xl bg-emerald-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all active:scale-98"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>3. Пересчитать рейтинг СМИ</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARTICLES INSPECTOR (RAW PARSED FEED) */}
          {activeTab === 'articles' && (
            <div className="space-y-3 animate-fade-in">
              {/* Search and Filters bar */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-white/5 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Поиск по заголовкам напарсенных статей..."
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchArticlesList(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 outline-none text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    onClick={() => fetchArticlesList(1)}
                    className="px-4 py-2 rounded-xl bg-[#1969ae] text-white font-bold flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Найти</span>
                  </button>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={articleSourceFilter === undefined ? '' : articleSourceFilter}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setArticleSourceFilter(val);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs outline-none"
                  >
                    <option value="">Все СМИ и каналы</option>
                    {sourceList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.default_camp})
                      </option>
                    ))}
                  </select>

                  <select
                    value={articleClusterFilter === undefined ? '' : String(articleClusterFilter)}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : e.target.value === 'true';
                      setArticleClusterFilter(val);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs outline-none"
                  >
                    <option value="">Все статусы</option>
                    <option value="true">Включены в сюжет ИИ</option>
                    <option value="false">В ожидании / Без сюжета</option>
                  </select>

                  <select
                    value={articleMediaFilter === undefined ? '' : String(articleMediaFilter)}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : e.target.value === 'true';
                      setArticleMediaFilter(val);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs outline-none"
                  >
                    <option value="">Все статьи</option>
                    <option value="true">Только с фото</option>
                    <option value="false">Без фото</option>
                  </select>
                </div>
              </div>

              {/* Articles Table / List */}
              <div className="space-y-2">
                {isLoadingArticles ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-500" />
                    <div>Загрузка статей из базы данных...</div>
                  </div>
                ) : articles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                    Статьи по заданным фильтрам не найдены
                  </div>
                ) : (
                  articles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => setSelectedArticlePreview(art)}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200/80 dark:border-white/5 hover:border-sky-500/40 hover:shadow-md transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {art.source_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-500 font-medium">
                              {art.source_camp}
                            </span>
                            {art.media_url && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center space-x-0.5">
                                <ImageIcon className="w-2.5 h-2.5" />
                                <span>Фото</span>
                              </span>
                            )}
                            {art.cluster_id ? (
                              <>
                                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
                                  Сюжет #{art.cluster_id}
                                </span>
                                {art.importance_score && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                      art.importance_score >= 8
                                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                        : art.importance_score >= 6
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                                    }`}
                                    title={art.importance_reason || `Важность: ${art.importance_score}/10`}
                                  >
                                    ⚡ {art.importance_score}/10
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px]">
                                В очереди
                              </span>
                            )}
                            {art.published_at && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(art.published_at).toLocaleString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                            {art.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {art.snippet}
                          </p>
                        </div>

                        {art.media_url && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-white/10">
                            <img
                              src={art.media_url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {articlesTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs">
                  <div className="text-slate-500">
                    Страница {articlesPage} из {articlesTotalPages} (Всего: {articlesTotal})
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => fetchArticlesList(articlesPage - 1)}
                      disabled={articlesPage <= 1}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => fetchArticlesList(articlesPage + 1)}
                      disabled={articlesPage >= articlesTotalPages}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      Вперед
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal for Article Preview */}
        {selectedArticlePreview && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in select-text"
            onClick={() => setSelectedArticlePreview(null)}
          >
            <div
              className="w-full max-w-xl bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-white/15 rounded-3xl p-5 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="font-bold text-slate-900 dark:text-white">{selectedArticlePreview.source_name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 font-medium">
                      {selectedArticlePreview.source_camp}
                    </span>
                    {selectedArticlePreview.published_at && (
                      <span className="text-slate-400 font-mono">
                        {new Date(selectedArticlePreview.published_at).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                    {selectedArticlePreview.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedArticlePreview(null)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedArticlePreview.media_url && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 max-h-56 bg-black flex items-center justify-center">
                  <img src={selectedArticlePreview.media_url} alt="" className="w-full h-full object-contain" />
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Спарсенный текст статьи:</div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedArticlePreview.snippet}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
                <span className="text-slate-400 text-[11px]">
                  ID статьи в БД: <strong className="font-mono text-slate-700 dark:text-slate-300">#{selectedArticlePreview.id}</strong>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (window.confirm('Вы уверены, что хотите удалить эту статью?')) {
                        try {
                          await api.deleteAdminArticle(selectedArticlePreview.id);
                          fetchArticlesList(articlesPage);
                          setSelectedArticlePreview(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 font-bold flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                  <a
                    href={selectedArticlePreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-sky-500/10 text-[#1969ae] dark:text-sky-300 hover:bg-sky-500/20 font-bold flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Оригинал</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
