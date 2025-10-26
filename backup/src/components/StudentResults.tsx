import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TestResult, StudentResult } from '../types';
import { ResultsTable } from './ResultsTable';

interface StudentResultsProps {
  onResultPress?: (result: TestResult) => void;
  onFilterChange?: (filters: ResultFilters) => void;
  onExportResults?: () => void;
}

interface ResultFilters {
  subject?: string;
  test_type?: string;
  passed_only?: boolean;
  failed_only?: boolean;
  from_date?: string;
  to_date?: string;
  min_score?: number;
  max_score?: number;
}

export function StudentResults({ onResultPress, onFilterChange, onExportResults }: StudentResultsProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<ResultFilters>({});
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showAllResults, setShowAllResults] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call
      const mockResults: TestResult[] = [
        {
          id: '1',
          test_id: 'test1',
          test_name: 'Math Quiz 1',
          subject: 'Mathematics',
          test_type: 'quiz',
          percentage: 85,
          passed: true,
          submitted_at: new Date().toISOString(),
          teacher_name: 'Mr. Smith'
        },
        {
          id: '2',
          test_id: 'test2',
          test_name: 'Science Test',
          subject: 'Science',
          test_type: 'test',
          percentage: 72,
          passed: true,
          submitted_at: new Date(Date.now() - 86400000).toISOString(),
          teacher_name: 'Ms. Johnson'
        }
      ];
      setTestResults(mockResults);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh results:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleResultPress = (result: TestResult) => {
    if (onResultPress) {
      onResultPress(result);
    } else {
      router.push(`/results/${result.id}`);
    }
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    const newFilters: ResultFilters = {};
    
    switch (filter) {
      case 'passed':
        newFilters.passed_only = true;
        break;
      case 'failed':
        newFilters.failed_only = true;
        break;
      case 'recent':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        newFilters.from_date = weekAgo.toISOString();
        break;
      case 'high_score':
        newFilters.min_score = 80;
        break;
      case 'low_score':
        newFilters.max_score = 60;
        break;
    }
    
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const getFilteredResults = () => {
    let filteredResults = testResults;

    // Apply subject filter
    if (filters.subject) {
      filteredResults = filteredResults.filter(result => result.subject === filters.subject);
    }

    // Apply test type filter
    if (filters.test_type) {
      filteredResults = filteredResults.filter(result => result.test_type === filters.test_type);
    }

    // Apply passed/failed filter
    if (filters.passed_only) {
      filteredResults = filteredResults.filter(result => result.passed);
    } else if (filters.failed_only) {
      filteredResults = filteredResults.filter(result => !result.passed);
    }

    // Apply date range filter
    if (filters.from_date) {
      filteredResults = filteredResults.filter(result => 
        new Date(result.submitted_at) >= new Date(filters.from_date!)
      );
    }
    if (filters.to_date) {
      filteredResults = filteredResults.filter(result => 
        new Date(result.submitted_at) <= new Date(filters.to_date!)
      );
    }

    // Apply score range filter
    if (filters.min_score !== undefined) {
      filteredResults = filteredResults.filter(result => result.percentage >= filters.min_score!);
    }
    if (filters.max_score !== undefined) {
      filteredResults = filteredResults.filter(result => result.percentage <= filters.max_score!);
    }

    return filteredResults;
  };

  const getResultsStatistics = () => {
    const results = getFilteredResults();
    if (results.length === 0) {
      return { total: 0, passed: 0, failed: 0, average: 0 };
    }

    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const average = results.reduce((sum, r) => sum + r.percentage, 0) / total;

    return { total, passed, failed, average: Math.round(average) };
  };

  const getSubjects = () => {
    const subjects = new Set(testResults.map(result => result.subject));
    return Array.from(subjects);
  };

  const getTestTypes = () => {
    const types = new Set(testResults.map(result => result.test_type));
    return Array.from(types);
  };

  const getScoreDistribution = () => {
    const results = getFilteredResults();
    const distribution = {
      excellent: 0, // >= 90%
      good: 0,     // 80-89%
      average: 0,  // 70-79%
      below: 0,    // 60-69%
      poor: 0        // < 60%
    };

    results.forEach(result => {
      if (result.percentage >= 90) distribution.excellent++;
      else if (result.percentage >= 80) distribution.good++;
      else if (result.percentage >= 70) distribution.average++;
      else if (result.percentage >= 60) distribution.below++;
      else distribution.poor++;
    });

    return distribution;
  };

  const filteredResults = getFilteredResults();
  const statistics = getResultsStatistics();
  const subjects = getSubjects();
  const testTypes = getTestTypes();
  const scoreDistribution = getScoreDistribution();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Test Results</Text>
        <Text style={styles.subtitle}>
          {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.total}</Text>
          <Text style={styles.statLabel}>Total Tests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.passed}</Text>
          <Text style={styles.statLabel}>Passed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.average}%</Text>
          <Text style={styles.statLabel}>Average</Text>
        </View>
      </View>

      {/* Score Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Distribution</Text>
        <View style={styles.distributionContainer}>
          <View style={styles.distributionBar}>
            <View style={[styles.distributionSegment, { backgroundColor: '#10b981', flex: scoreDistribution.excellent }]} />
            <View style={[styles.distributionSegment, { backgroundColor: '#3b82f6', flex: scoreDistribution.good }]} />
            <View style={[styles.distributionSegment, { backgroundColor: '#f59e0b', flex: scoreDistribution.average }]} />
            <View style={[styles.distributionSegment, { backgroundColor: '#ef4444', flex: scoreDistribution.below }]} />
            <View style={[styles.distributionSegment, { backgroundColor: '#6b7280', flex: scoreDistribution.poor }]} />
          </View>
          <View style={styles.distributionLabels}>
            <View style={styles.distributionLabel}>
              <View style={[styles.distributionColor, { backgroundColor: '#10b981' }]} />
              <Text style={styles.distributionText}>90%+ ({scoreDistribution.excellent})</Text>
            </View>
            <View style={styles.distributionLabel}>
              <View style={[styles.distributionColor, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.distributionText}>80-89% ({scoreDistribution.good})</Text>
            </View>
            <View style={styles.distributionLabel}>
              <View style={[styles.distributionColor, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.distributionText}>70-79% ({scoreDistribution.average})</Text>
            </View>
            <View style={styles.distributionLabel}>
              <View style={[styles.distributionColor, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.distributionText}>60-69% ({scoreDistribution.below})</Text>
            </View>
            <View style={styles.distributionLabel}>
              <View style={[styles.distributionColor, { backgroundColor: '#6b7280' }]} />
              <Text style={styles.distributionText}>Below 60% ({scoreDistribution.poor})</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            {['all', 'passed', 'failed', 'recent', 'high_score', 'low_score'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  selectedFilter === filter && styles.activeFilterTab
                ]}
                onPress={() => handleFilterChange(filter)}
              >
                <Text style={[
                  styles.filterTabText,
                  selectedFilter === filter && styles.activeFilterTabText
                ]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Additional Filters */}
      <View style={styles.additionalFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterChips}>
            {subjects.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.filterChip,
                  filters.subject === subject && styles.activeFilterChip
                ]}
                onPress={() => setFilters(prev => ({ ...prev, subject: prev.subject === subject ? undefined : subject }))}
              >
                <Text style={[
                  styles.filterChipText,
                  filters.subject === subject && styles.activeFilterChipText
                ]}>
                  {subject}
                </Text>
              </TouchableOpacity>
            ))}
            {testTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  filters.test_type === type && styles.activeFilterChip
                ]}
                onPress={() => setFilters(prev => ({ ...prev, test_type: prev.test_type === type ? undefined : type }))}
              >
                <Text style={[
                  styles.filterChipText,
                  filters.test_type === type && styles.activeFilterChipText
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Results Table */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      ) : filteredResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            {Object.keys(filters).length > 0 
              ? 'Try adjusting your filters'
              : 'No test results available yet'
            }
          </Text>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          <ResultsTable
            results={filteredResults}
            showAll={showAllResults}
            onToggleShowAll={() => setShowAllResults(!showAllResults)}
            maxInitial={10}
            compact={false}
          />
        </View>
      )}

      {/* Export Button */}
      {filteredResults.length > 0 && (
        <View style={styles.exportContainer}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={onExportResults}
          >
            <Text style={styles.exportButtonText}>Export Results</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
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
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  distributionContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distributionBar: {
    height: 20,
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 16,
    overflow: 'hidden',
  },
  distributionSegment: {
    minWidth: 1,
  },
  distributionLabels: {
    gap: 8,
  },
  distributionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  distributionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  activeFilterTab: {
    backgroundColor: '#4f46e5',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: 'white',
  },
  additionalFilters: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterChips: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeFilterChip: {
    backgroundColor: '#e0e7ff',
    borderColor: '#4f46e5',
  },
  filterChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#4f46e5',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  resultsContainer: {
    padding: 16,
  },
  exportContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  exportButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
