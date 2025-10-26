import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
  key: string;
}

interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxSize: number; // maximum number of items
  enablePersistence: boolean;
  compressionEnabled: boolean;
}

interface CacheState {
  items: Map<string, CacheItem<any>>;
  size: number;
  lastCleanup: number;
}

const defaultConfig: CacheConfig = {
  defaultTTL: 300000, // 5 minutes
  maxSize: 100,
  enablePersistence: true,
  compressionEnabled: false,
};

export function useDataCache<T>(
  cacheKey: string,
  config: Partial<CacheConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<CacheState>({
    items: new Map(),
    size: 0,
    lastCleanup: Date.now(),
  });

  const cacheRef = useRef<Map<string, CacheItem<any>>>(new Map());

  // Load cache from storage on mount
  useEffect(() => {
    if (finalConfig.enablePersistence) {
      loadFromStorage();
    }
  }, [finalConfig.enablePersistence]);

  // Save cache to storage when it changes
  useEffect(() => {
    if (finalConfig.enablePersistence && state.items.size > 0) {
      saveToStorage();
    }
  }, [state.items, finalConfig.enablePersistence]);

  // Load from storage
  const loadFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(`cache_${cacheKey}`);
      if (stored) {
        const cacheData = JSON.parse(stored);
        const items = new Map<string, CacheItem<any>>(cacheData.items);
        cacheRef.current = items;
        setState(prev => ({
          ...prev,
          items,
          size: items.size,
        }));
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }, [cacheKey]);

  // Save to storage
  const saveToStorage = useCallback(async () => {
    try {
      const cacheData = {
        items: Array.from(state.items.entries()),
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(`cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }, [cacheKey, state.items]);

  // Check if item is expired
  const isExpired = useCallback((item: CacheItem<any>): boolean => {
    return Date.now() - item.timestamp > item.ttl;
  }, []);

  // Clean expired items
  const cleanExpired = useCallback(() => {
    const now = Date.now();
    const expiredKeys: string[] = [];

    state.items.forEach((item, key) => {
      if (isExpired(item)) {
        expiredKeys.push(key);
      }
    });

    if (expiredKeys.length > 0) {
      setState(prev => {
        const newItems = new Map(prev.items);
        expiredKeys.forEach(key => newItems.delete(key));
        return {
          ...prev,
          items: newItems,
          size: newItems.size,
          lastCleanup: now,
        };
      });
    }
  }, [state.items, isExpired]);

  // Evict oldest items if cache is full
  const evictOldest = useCallback(() => {
    if (state.items.size < finalConfig.maxSize) return;

    const sortedItems = Array.from(state.items.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const itemsToRemove = sortedItems.slice(0, state.items.size - finalConfig.maxSize + 1);
    const keysToRemove = itemsToRemove.map(([key]) => key);

    setState(prev => {
      const newItems = new Map(prev.items);
      keysToRemove.forEach(key => newItems.delete(key));
      return {
        ...prev,
        items: newItems,
        size: newItems.size,
      };
    });
  }, [state.items, finalConfig.maxSize]);

  // Get item from cache
  const get = useCallback((key: string): T | null => {
    const item = state.items.get(key);
    if (!item) return null;

    if (isExpired(item)) {
      setState(prev => {
        const newItems = new Map(prev.items);
        newItems.delete(key);
        return {
          ...prev,
          items: newItems,
          size: newItems.size,
        };
      });
      return null;
    }

    return item.data;
  }, [state.items, isExpired]);

  // Set item in cache
  const set = useCallback((key: string, data: T, ttl?: number): void => {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || finalConfig.defaultTTL,
      key,
    };

    setState(prev => {
      const newItems = new Map(prev.items);
      newItems.set(key, item);
      return {
        ...prev,
        items: newItems,
        size: newItems.size,
      };
    });

    // Clean up if needed
    if (state.items.size >= finalConfig.maxSize) {
      evictOldest();
    }
  }, [finalConfig.defaultTTL, finalConfig.maxSize, state.items.size, evictOldest]);

  // Remove item from cache
  const remove = useCallback((key: string): boolean => {
    const existed = state.items.has(key);
    if (existed) {
      setState(prev => {
        const newItems = new Map(prev.items);
        newItems.delete(key);
        return {
          ...prev,
          items: newItems,
          size: newItems.size,
        };
      });
    }
    return existed;
  }, [state.items]);

  // Clear all items
  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      items: new Map(),
      size: 0,
    }));
  }, []);

  // Check if key exists
  const has = useCallback((key: string): boolean => {
    const item = state.items.get(key);
    return item ? !isExpired(item) : false;
  }, [state.items, isExpired]);

  // Get cache statistics
  const getStats = useCallback(() => {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;

    state.items.forEach(item => {
      if (isExpired(item)) {
        expiredCount++;
      }
      totalSize += JSON.stringify(item.data).length;
    });

    return {
      totalItems: state.items.size,
      expiredItems: expiredCount,
      validItems: state.items.size - expiredCount,
      totalSize,
      lastCleanup: state.lastCleanup,
      maxSize: finalConfig.maxSize,
    };
  }, [state.items, isExpired, finalConfig.maxSize]);

  // Auto-cleanup every 5 minutes
  useEffect(() => {
    const interval = setInterval(cleanExpired, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [cleanExpired]);

  // Get or set pattern
  const getOrSet = useCallback(async (
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> => {
    const cached = get(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const data = await fetcher();
      set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('Failed to fetch data:', error);
      throw error;
    }
  }, [get, set]);

  return {
    get,
    set,
    remove,
    clear,
    has,
    getStats,
    getOrSet,
    cleanExpired,
    config: finalConfig,
  };
}
