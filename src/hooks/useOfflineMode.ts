import { useState, useEffect, useCallback } from 'react';
import { get, set, del, keys } from 'idb-keyval';

interface OfflineAction {
  id: string;
  type: 'like' | 'bookmark' | 'follow' | 'post' | 'comment';
  data: any;
  timestamp: number;
  userId: string;
}

interface OfflineState {
  isOnline: boolean;
  pendingActions: OfflineAction[];
  cachedData: Map<string, any>;
}

export const useOfflineMode = () => {
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    pendingActions: [],
    cachedData: new Map()
  });

  // Load pending actions from IndexedDB on mount
  useEffect(() => {
    loadPendingActions();
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      syncPendingActions();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending actions from IndexedDB
  const loadPendingActions = async () => {
    try {
      const actions = await get('offline-actions') || [];
      setState(prev => ({ ...prev, pendingActions: actions }));
    } catch (error) {
      console.error('Failed to load pending actions:', error);
    }
  };

  // Save pending actions to IndexedDB
  const savePendingActions = async (actions: OfflineAction[]) => {
    try {
      await set('offline-actions', actions);
    } catch (error) {
      console.error('Failed to save pending actions:', error);
    }
  };

  // Queue an action for offline execution
  const queueAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    const newAction: OfflineAction = {
      ...action,
      id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    const updatedActions = [...state.pendingActions, newAction];
    setState(prev => ({ ...prev, pendingActions: updatedActions }));
    await savePendingActions(updatedActions);

    // If online, try to sync immediately
    if (state.isOnline) {
      syncPendingActions();
    }

    return newAction.id;
  }, [state.pendingActions, state.isOnline]);

  // Sync pending actions when back online
  const syncPendingActions = async () => {
    if (!state.isOnline || state.pendingActions.length === 0) return;

    const successfulActions: string[] = [];
    
    for (const action of state.pendingActions) {
      try {
        const success = await executeAction(action);
        if (success) {
          successfulActions.push(action.id);
        }
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);
      }
    }

    // Remove successful actions
    if (successfulActions.length > 0) {
      const remainingActions = state.pendingActions.filter(
        action => !successfulActions.includes(action.id)
      );
      setState(prev => ({ ...prev, pendingActions: remainingActions }));
      await savePendingActions(remainingActions);
    }
  };

  // Execute a specific action
  const executeAction = async (action: OfflineAction): Promise<boolean> => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return false;

      let response: Response;

      switch (action.type) {
        case 'like':
          response = await fetch(`/api/posts/${action.data.postId}/like`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;

        case 'bookmark':
          response = await fetch(`/api/posts/${action.data.postId}/bookmark`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;

        case 'follow':
          response = await fetch(`/api/follows/${action.data.username}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;

        case 'post':
          response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(action.data)
          });
          break;

        case 'view':
          response = await fetch(`/api/posts/${action.data.postId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;

        default:
          return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Action execution failed:', error);
      return false;
    }
  };

  // Cache data for offline access
  const cacheData = useCallback(async (key: string, data: any) => {
    try {
      await set(`cache_${key}`, {
        data,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      });
      
      setState(prev => ({
        ...prev,
        cachedData: new Map(prev.cachedData.set(key, data))
      }));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback(async (key: string) => {
    try {
      // Check memory cache first
      if (state.cachedData.has(key)) {
        return state.cachedData.get(key);
      }

      // Check IndexedDB cache
      const cached = await get(`cache_${key}`);
      if (cached && cached.expires > Date.now()) {
        setState(prev => ({
          ...prev,
          cachedData: new Map(prev.cachedData.set(key, cached.data))
        }));
        return cached.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }, [state.cachedData]);

  // Clear expired cache
  const clearExpiredCache = useCallback(async () => {
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith('cache_')
      );

      for (const key of cacheKeys) {
        const cached = await get(key);
        if (cached && cached.expires <= Date.now()) {
          await del(key);
        }
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }, []);

  // Clear all offline data
  const clearOfflineData = useCallback(async () => {
    try {
      await del('offline-actions');
      const allKeys = await keys();
      const cacheKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith('cache_')
      );
      
      for (const key of cacheKeys) {
        await del(key);
      }

      setState(prev => ({
        ...prev,
        pendingActions: [],
        cachedData: new Map()
      }));
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }, []);

  // Enhanced fetch with offline support
  const offlineFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (state.isOnline) {
      try {
        const response = await fetch(url, options);
        
        // Cache successful GET requests
        if (response.ok && (!options.method || options.method === 'GET')) {
          const data = await response.clone().json();
          await cacheData(url, data);
        }
        
        return response;
      } catch (error) {
        // If fetch fails, try to get cached data
        const cached = await getCachedData(url);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw error;
      }
    } else {
      // Offline mode - return cached data or queue action
      if (!options.method || options.method === 'GET') {
        const cached = await getCachedData(url);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw new Error('No cached data available');
      } else {
        // Queue non-GET requests for later
        // This would need to be implemented based on your API structure
        throw new Error('Cannot perform this action while offline');
      }
    }
  }, [state.isOnline, cacheData, getCachedData]);

  return {
    isOnline: state.isOnline,
    pendingActions: state.pendingActions,
    queueAction,
    syncPendingActions,
    cacheData,
    getCachedData,
    clearExpiredCache,
    clearOfflineData,
    offlineFetch
  };
};

