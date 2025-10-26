import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import { cacheManager, cacheUtils } from '../utils/cacheUtils';
import { useDataCache } from '../hooks/useDataCache';
import { logger } from '../utils/logger';

interface DataCachingSystemProps {
  onCacheCleared?: () => void;
  onCacheExported?: (data: string) => void;
}

export function DataCachingSystem({ onCacheCleared, onCacheExported }: DataCachingSystemProps) {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [cacheConfig, setCacheConfig] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'settings' | 'storage' | 'export'>('overview');

  // Load cache data
  const loadCacheData = useCallback(async () => {
    try {
      const stats = cacheManager.getStats();
      const config = cacheManager.getConfig();
      setCacheStats(stats);
      setCacheConfig(config);
      logger.info('Cache data loaded', 'data-caching', { stats, config });
    } catch (error) {
      logger.error('Failed to load cache data', 'data-caching', error);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCacheData();
    } catch (error) {
      logger.error('Failed to refresh cache data', 'data-caching', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadCacheData]);

  // Load data on mount
  useEffect(() => {
    loadCacheData();
  }, [loadCacheData]);

  // Handle clear cache
  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data? This will remove all offline data and may affect app performance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await cacheManager.clear();
              await loadCacheData();
              if (onCacheCleared) {
                onCacheCleared();
              }
              logger.info('Cache cleared', 'data-caching');
            } catch (error) {
              logger.error('Failed to clear cache', 'data-caching', error);
              Alert.alert('Error', 'Failed to clear cache. Please try again.');
            }
          },
        },
      ]
    );
  }, [loadCacheData, onCacheCleared]);

  // Handle export cache
  const handleExportCache = useCallback(async () => {
    try {
      const exportData = await (cacheManager as any).exportData?.('json') ?? (cacheManager as any).exportLogs?.('json');
      if (onCacheExported) {
        onCacheExported(exportData);
      }
      logger.info('Cache exported', 'data-caching');
    } catch (error) {
      logger.error('Failed to export cache', 'data-caching', error);
      Alert.alert('Error', 'Failed to export cache. Please try again.');
    }
  }, [onCacheExported]);

  // Handle config change
  const handleConfigChange = useCallback((key: string, value: any) => {
    const newConfig = { ...cacheConfig, [key]: value };
    cacheManager.updateConfig(newConfig);
    setCacheConfig(newConfig);
    logger.info('Cache config updated', 'data-caching', { key, value });
  }, [cacheConfig]);

  // Format cache size
  const formatCacheSize = (bytes: number) => {
    return cacheUtils.formatSize(bytes);
  };

  // Get cache health status
  const getCacheHealthStatus = () => {
    if (!cacheStats) return 'unknown';
    
    const hitRate = cacheStats.hitRate;
    if (hitRate >= 0.8) return 'excellent';
    if (hitRate >= 0.6) return 'good';
    if (hitRate >= 0.4) return 'fair';
    return 'poor';
  };

  // Get cache health color
  const getCacheHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Render overview tab
  const renderOverview = () => {
    if (!cacheStats) return null;

    const healthStatus = getCacheHealthStatus();
    const healthColor = getCacheHealthColor(healthStatus);

    return (
      <View style={styles.overviewContainer}>
        {/* Cache Health */}
        <View style={styles.healthCard}>
          <Text style={styles.healthTitle}>Cache Health</Text>
          <View style={styles.healthStatus}>
            <View style={[styles.healthIndicator, { backgroundColor: healthColor }]} />
            <Text style={[styles.healthText, { color: healthColor }]}>
              {healthStatus.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.healthDescription}>
            Hit Rate: {(cacheStats.hitRate * 100).toFixed(1)}% • 
            Miss Rate: {(cacheStats.missRate * 100).toFixed(1)}%
          </Text>
        </View>

        {/* Cache Statistics */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{cacheStats.totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatCacheSize(cacheStats.totalSize)}</Text>
            <Text style={styles.statLabel}>Total Size</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{cacheStats.evictionCount}</Text>
            <Text style={styles.statLabel}>Evictions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {new Date(cacheStats.lastCleanup).toLocaleDateString()}
            </Text>
            <Text style={styles.statLabel}>Last Cleanup</Text>
          </View>
        </View>

        {/* Cache Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          <View style={styles.metricsList}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Hit Rate</Text>
              <Text style={styles.metricValue}>{(cacheStats.hitRate * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Miss Rate</Text>
              <Text style={styles.metricValue}>{(cacheStats.missRate * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Eviction Rate</Text>
              <Text style={styles.metricValue}>
                {cacheStats.totalItems > 0 ? 
                  ((cacheStats.evictionCount / cacheStats.totalItems) * 100).toFixed(1) : 0}%
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Average Item Size</Text>
              <Text style={styles.metricValue}>
                {cacheStats.totalItems > 0 ? 
                  formatCacheSize(cacheStats.totalSize / cacheStats.totalItems) : '0 B'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render settings tab
  const renderSettings = () => {
    if (!cacheConfig) return null;

    return (
      <View style={styles.settingsContainer}>
        <Text style={styles.sectionTitle}>Cache Configuration</Text>
        
        <View style={styles.settingsList}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Default TTL</Text>
            <Text style={styles.settingValue}>{cacheConfig.defaultTTL / 1000}s</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Max Size</Text>
            <Text style={styles.settingValue}>{cacheConfig.maxSize} items</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Compression</Text>
            <Switch
              value={cacheConfig.compressionEnabled}
              onValueChange={(value) => handleConfigChange('compressionEnabled', value)}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Encryption</Text>
            <Switch
              value={cacheConfig.encryptionEnabled}
              onValueChange={(value) => handleConfigChange('encryptionEnabled', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Management</Text>
          <View style={styles.managementButtons}>
            <TouchableOpacity
              style={styles.managementButton}
              onPress={() => cacheManager.cleanExpired()}
            >
              <Text style={styles.managementButtonText}>Clean Expired</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.managementButton}
              onPress={handleClearCache}
            >
              <Text style={styles.managementButtonText}>Clear Cache</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render storage tab
  const renderStorage = () => {
    if (!cacheStats) return null;

    return (
      <View style={styles.storageContainer}>
        <Text style={styles.sectionTitle}>Storage Information</Text>
        
        <View style={styles.storageCard}>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Total Size</Text>
            <Text style={styles.storageValue}>{formatCacheSize(cacheStats.totalSize)}</Text>
          </View>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Item Count</Text>
            <Text style={styles.storageValue}>{cacheStats.totalItems}</Text>
          </View>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Average Size</Text>
            <Text style={styles.storageValue}>
              {cacheStats.totalItems > 0 ? 
                formatCacheSize(cacheStats.totalSize / cacheStats.totalItems) : '0 B'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Breakdown</Text>
          <View style={styles.breakdownList}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Valid Items</Text>
              <Text style={styles.breakdownValue}>{cacheStats.validItems}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Expired Items</Text>
              <Text style={styles.breakdownValue}>{cacheStats.expiredItems}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Evicted Items</Text>
              <Text style={styles.breakdownValue}>{cacheStats.evictionCount}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render export tab
  const renderExport = () => {
    return (
      <View style={styles.exportContainer}>
        <Text style={styles.sectionTitle}>Export Cache Data</Text>
        
        <View style={styles.exportCard}>
          <Text style={styles.exportDescription}>
            Export your cache data for backup or analysis purposes. This will include all cached items and their metadata.
          </Text>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportCache}
          >
            <Text style={styles.exportButtonText}>Export Cache Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Information</Text>
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{cacheConfig?.version || 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Cleanup</Text>
              <Text style={styles.infoValue}>
                {cacheStats ? new Date(cacheStats.lastCleanup).toLocaleString() : 'Never'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Requests</Text>
              <Text style={styles.infoValue}>
                {cacheStats ? cacheStats.hitRate + cacheStats.missRate : 0}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Data Caching</Text>
        <Text style={styles.subtitle}>
          Manage offline data storage and cache performance
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'settings', label: 'Settings' },
          { key: 'storage', label: 'Storage' },
          { key: 'export', label: 'Export' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              selectedTab === tab.key && styles.activeTab
            ]}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text style={[
              styles.tabText,
              selectedTab === tab.key && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'settings' && renderSettings()}
        {selectedTab === 'storage' && renderStorage()}
        {selectedTab === 'export' && renderExport()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4f46e5',
  },
  tabText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  overviewContainer: {
    padding: 16,
  },
  healthCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  healthText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  healthDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  metricsList: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  metricLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  settingsContainer: {
    padding: 16,
  },
  settingsList: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: '#6b7280',
  },
  managementButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  managementButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  managementButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  storageContainer: {
    padding: 16,
  },
  storageCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  storageLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  storageValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  breakdownList: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  breakdownLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  exportContainer: {
    padding: 16,
  },
  exportCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  exportButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoList: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
});
