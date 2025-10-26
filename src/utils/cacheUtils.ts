import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
  key: string;
  version?: string;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  version: string;
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  lastCleanup: number;
}

const defaultConfig: CacheConfig = {
  defaultTTL: 300000, // 5 minutes
  maxSize: 1000,
  compressionEnabled: false,
  encryptionEnabled: false,
  version: '1.0.0',
};

class CacheManager {
  private config: CacheConfig;
  private stats: CacheStats;
  private cache: Map<string, CacheItem<any>>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.stats = {
      totalItems: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      lastCleanup: Date.now(),
    };
    this.cache = new Map();
  }

  // Set item in cache
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
        key,
        version: this.config.version,
      };

      // Check if cache is full
      if (this.cache.size >= this.config.maxSize) {
        await this.evictOldest();
      }

      this.cache.set(key, item);
      this.stats.totalItems = this.cache.size;
      this.stats.totalSize += JSON.stringify(data).length;

      // Persist to storage if enabled
      if (this.config.encryptionEnabled) {
        await this.persistToStorage();
      }
    } catch (error) {
      console.error('Failed to set cache item:', error);
      throw error;
    }
  }

  // Get item from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = this.cache.get(key);
      if (!item) {
        this.stats.missRate++;
        return null;
      }

      // Check if item is expired
      if (this.isExpired(item)) {
        this.cache.delete(key);
        this.stats.missRate++;
        return null;
      }

      this.stats.hitRate++;
      return item.data;
    } catch (error) {
      console.error('Failed to get cache item:', error);
      return null;
    }
  }

  // Check if item exists and is not expired
  has(key: string): boolean {
    const item = this.cache.get(key);
    return item ? !this.isExpired(item) : false;
  }

  // Remove item from cache
  async remove(key: string): Promise<boolean> {
    try {
      const existed = this.cache.has(key);
      if (existed) {
        this.cache.delete(key);
        this.stats.totalItems = this.cache.size;
      }
      return existed;
    } catch (error) {
      console.error('Failed to remove cache item:', error);
      return false;
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.stats.totalItems = 0;
      this.stats.totalSize = 0;
      
      if (this.config.encryptionEnabled) {
        await AsyncStorage.removeItem('app_cache');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  // Get multiple items
  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    
    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }
    
    return result;
  }

  // Set multiple items
  async setMultiple<T>(items: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.data, item.ttl);
    }
  }

  // Remove multiple items
  async removeMultiple(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.remove(key);
    }
  }

  // Check if item is expired
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  // Evict oldest items
  private async evictOldest(): Promise<void> {
    const sortedItems = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const itemsToRemove = sortedItems.slice(0, Math.ceil(this.config.maxSize * 0.1));
    
    for (const [key] of itemsToRemove) {
      this.cache.delete(key);
      this.stats.evictionCount++;
    }
  }

  // Clean expired items
  async cleanExpired(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    this.stats.lastCleanup = now;
    this.stats.totalItems = this.cache.size;
    
    return cleanedCount;
  }

  // Get cache statistics
  getStats(): CacheStats {
    const totalRequests = this.stats.hitRate + this.stats.missRate;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? this.stats.hitRate / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.missRate / totalRequests : 0,
    };
  }

  // Get cache size
  getSize(): number {
    return this.cache.size;
  }

  // Get cache keys
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Persist cache to storage
  private async persistToStorage(): Promise<void> {
    try {
      const cacheData = {
        items: Array.from(this.cache.entries()),
        stats: this.stats,
        config: this.config,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem('app_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to persist cache to storage:', error);
    }
  }

  // Load cache from storage
  async loadFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('app_cache');
      if (stored) {
        const cacheData = JSON.parse(stored);
        
        // Check version compatibility
        if (cacheData.config?.version === this.config.version) {
          this.cache = new Map(cacheData.items);
          this.stats = { ...this.stats, ...cacheData.stats };
        } else {
          // Clear incompatible cache
          await this.clear();
        }
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
      await this.clear();
    }
  }

  // Get cache item metadata
  getItemMetadata(key: string): {
    exists: boolean;
    timestamp?: number;
    ttl?: number;
    age?: number;
    expiresAt?: number;
  } | null {
    const item = this.cache.get(key);
    if (!item) {
      return { exists: false };
    }

    return {
      exists: true,
      timestamp: item.timestamp,
      ttl: item.ttl,
      age: Date.now() - item.timestamp,
      expiresAt: item.timestamp + item.ttl,
    };
  }

  // Update cache configuration
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get cache configuration
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Utility functions
export const cacheUtils = {
  // Create cache key with namespace
  createKey: (namespace: string, key: string): string => `${namespace}:${key}`,
  
  // Parse cache key
  parseKey: (fullKey: string): { namespace: string; key: string } => {
    const [namespace, ...keyParts] = fullKey.split(':');
    return { namespace, key: keyParts.join(':') };
  },
  
  // Generate cache key from object
  generateKey: (obj: any): string => {
    return JSON.stringify(obj)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
  },
  
  // Check if cache key is valid
  isValidKey: (key: string): boolean => {
    return key.length > 0 && key.length <= 100 && !key.includes(':');
  },
  
  // Get cache size in bytes
  getCacheSize: (): number => {
    let size = 0;
    for (const [, item] of cacheManager['cache'].entries()) {
      size += JSON.stringify(item).length;
    }
    return size;
  },
  
  // Format cache size
  formatSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  },
};
