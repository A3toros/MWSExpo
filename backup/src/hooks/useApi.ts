import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { useAppSelector } from '../store';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface ApiOptions {
  immediate?: boolean;
  retries?: number;
  retryDelay?: number;
  cache?: boolean;
  cacheKey?: string;
}

export function useApi<T>(
  endpoint: string,
  options: ApiOptions = {}
) {
  const { immediate = false, retries = 3, retryDelay = 1000, cache = false, cacheKey } = options;
  const token = useAppSelector(s => s.auth.token);
  
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cache management
  const getCachedData = useCallback((key: string): T | null => {
    if (!cache) return null;
    try {
      const cached = localStorage.getItem(`api_cache_${key}`);
      if (cached) {
        const { data, timestamp, ttl } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to read from cache:', error);
    }
    return null;
  }, [cache]);

  const setCachedData = useCallback((key: string, data: T, ttl: number = 300000) => {
    if (!cache) return;
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to write to cache:', error);
    }
  }, [cache]);

  const execute = useCallback(async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    payload?: any,
    customEndpoint?: string
  ): Promise<T> => {
    const url = customEndpoint || endpoint;
    const cacheKeyToUse = cacheKey || url;

    // Check cache first
    if (method === 'GET' && cache) {
      const cachedData = getCachedData(cacheKeyToUse);
      if (cachedData) {
        setState(prev => ({ ...prev, data: cachedData, loading: false, error: null }));
        return cachedData;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    const makeRequest = async (attempt: number): Promise<T> => {
      try {
        const config = {
          signal: abortControllerRef.current?.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        };

        let response;
        switch (method) {
          case 'GET':
            response = await apiClient.get(url, config);
            break;
          case 'POST':
            response = await apiClient.post(url, payload, config);
            break;
          case 'PUT':
            response = await apiClient.put(url, payload, config);
            break;
          case 'DELETE':
            response = await apiClient.delete(url, config);
            break;
          default:
            throw new Error(`Unsupported method: ${method}`);
        }

        const data = response.data;

        // Cache successful GET requests
        if (method === 'GET' && cache) {
          setCachedData(cacheKeyToUse, data);
        }

        setState({ data, loading: false, error: null });
        retryCountRef.current = 0;
        return data;

      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw error;
        }

        // Retry logic
        if (attempt < retries && error.response?.status >= 500) {
          retryCountRef.current = attempt + 1;
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          return makeRequest(attempt + 1);
        }

        const errorMessage = error.response?.data?.message || error.message || 'Request failed';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        throw error;
      }
    };

    try {
      return await makeRequest(0);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return state.data as T;
    }
  }, [endpoint, token, retries, retryDelay, cache, cacheKey, getCachedData, setCachedData, state.data]);

  // Convenience methods
  const get = useCallback((customEndpoint?: string) => execute('GET', undefined, customEndpoint), [execute]);
  const post = useCallback((payload?: any, customEndpoint?: string) => execute('POST', payload, customEndpoint), [execute]);
  const put = useCallback((payload?: any, customEndpoint?: string) => execute('PUT', payload, customEndpoint), [execute]);
  const del = useCallback((customEndpoint?: string) => execute('DELETE', undefined, customEndpoint), [execute]);

  // Auto-execute on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      get();
    }
  }, [immediate, get]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    execute,
    get,
    post,
    put,
    delete: del,
    retryCount: retryCountRef.current,
  };
}
