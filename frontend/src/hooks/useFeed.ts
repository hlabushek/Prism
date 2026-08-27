import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { FeedFilterState, UserPreferences } from '../types';

export function useFeed(filters: FeedFilterState, refreshRateSeconds: number = 60) {
  const queryClient = useQueryClient();

  const feedQuery = useQuery({
    queryKey: ['feed', filters],
    queryFn: () => api.getFeed(filters),
    // Dynamic polling based on user's client_refresh_rate setting
    refetchInterval: Math.max(5, refreshRateSeconds) * 1000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: () => {
      // Invalidate queries so fresh data is fetched
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  return {
    ...feedQuery,
    triggerSync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}

export function useUserPreferences(telegramId: number) {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ['user_preferences', telegramId],
    queryFn: () => api.getUserPreferences(telegramId),
    enabled: !!telegramId,
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: (newPrefs: Partial<UserPreferences>) =>
      api.updateUserPreferences(telegramId, newPrefs),
    onSuccess: (updated) => {
      queryClient.setQueryData(['user_preferences', telegramId], updated);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    updatePreferences: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: api.getSources,
    staleTime: 300000,
  });
}
