import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageState<T> {
  value: T | null;
  loading: boolean;
  error: string | null;
}

export function useLocalStorage<T>(
  key: string,
  initialValue?: T
) {
  const [state, setState] = useState<StorageState<T>>({
    value: initialValue || null,
    loading: true,
    error: null,
  });

  // Load value from storage on mount
  useEffect(() => {
    loadValue();
  }, [key]);

  // Load value from AsyncStorage
  const loadValue = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          value: parsed,
          loading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          value: initialValue || null,
          loading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        value: initialValue || null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load from storage',
      }));
    }
  }, [key, initialValue]);

  // Set value in storage
  const setValue = useCallback(async (value: T | null) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      if (value === null) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }
      
      setState(prev => ({
        ...prev,
        value,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save to storage',
      }));
    }
  }, [key]);

  // Update value (merge for objects)
  const updateValue = useCallback(async (updater: T | ((prev: T | null) => T)) => {
    const newValue = typeof updater === 'function' 
      ? (updater as (prev: T | null) => T)(state.value)
      : updater;
    
    await setValue(newValue);
  }, [state.value, setValue]);

  // Remove value from storage
  const removeValue = useCallback(async () => {
    await setValue(null);
  }, [setValue]);

  // Clear all storage
  const clearAll = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await AsyncStorage.clear();
      setState(prev => ({
        ...prev,
        value: initialValue || null,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to clear storage',
      }));
    }
  }, [initialValue]);

  // Get multiple values
  const getMultiple = useCallback(async (keys: string[]) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const values = await AsyncStorage.multiGet(keys);
      const result = values.reduce((acc, [key, value]) => {
        acc[key] = value ? JSON.parse(value) : null;
        return acc;
      }, {} as Record<string, any>);
      
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get multiple values',
      }));
      return {};
    }
  }, []);

  // Set multiple values
  const setMultiple = useCallback(async (keyValuePairs: Array<[string, any]>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const serializedPairs = keyValuePairs.map(([key, value]) => [
        key,
        JSON.stringify(value)
      ]);
      
      await AsyncStorage.multiSet(serializedPairs as [string, string][]);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to set multiple values',
      }));
    }
  }, []);

  // Remove multiple values
  const removeMultiple = useCallback(async (keys: string[]) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await AsyncStorage.multiRemove(keys);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to remove multiple values',
      }));
    }
  }, []);

  // Get all keys
  const getAllKeys = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      setState(prev => ({ ...prev, loading: false }));
      return keys;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get all keys',
      }));
      return [];
    }
  }, []);

  // Get storage size
  const getStorageSize = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const values = await AsyncStorage.multiGet(keys);
      
      let totalSize = 0;
      values.forEach(([key, value]) => {
        totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16 encoding
      });
      
      return {
        totalSize,
        keyCount: keys.length,
        averageSize: keys.length > 0 ? totalSize / keys.length : 0,
      };
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return { totalSize: 0, keyCount: 0, averageSize: 0 };
    }
  }, []);

  return {
    ...state,
    setValue,
    updateValue,
    removeValue,
    clearAll,
    getMultiple,
    setMultiple,
    removeMultiple,
    getAllKeys,
    getStorageSize,
    reload: loadValue,
  };
}
