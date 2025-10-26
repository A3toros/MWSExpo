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
import { useTest } from '../contexts/TestContext';
import { useApi } from '../hooks/useApi';
import { Test } from '../types';

interface StudentTestsProps {
  onTestPress?: (test: Test) => void;
  onFilterChange?: (filters: TestFilters) => void;
}

interface TestFilters {
  subject?: string;
  test_type?: string;
  status?: 'active' | 'completed' | 'upcoming';
  due_date?: 'today' | 'week' | 'month';
}

export function StudentTests({ onTestPress, onFilterChange }: StudentTestsProps) {
  const router = useRouter();
  const { state: testState, loadActiveTests } = useTest();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TestFilters>({});
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadActiveTests();
    } catch (error) {
      console.error('Failed to load tests:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh tests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestPress = (test: any) => {
    if (onTestPress) {
      onTestPress(test);
    } else {
      router.push(`/tests/${test.id}`);
    }
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    const newFilters: TestFilters = {};
    
    switch (filter) {
      case 'active':
        newFilters.status = 'active';
        break;
      case 'completed':
        newFilters.status = 'completed';
        break;
      case 'upcoming':
        newFilters.status = 'upcoming';
        break;
      case 'today':
        newFilters.due_date = 'today';
        break;
      case 'week':
        newFilters.due_date = 'week';
        break;
      case 'month':
        newFilters.due_date = 'month';
        break;
    }
    
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const getFilteredTests = () => {
    let filteredTests = testState.activeTests as any[];

    // Apply status filter
    if (filters.status === 'active') {
      filteredTests = filteredTests.filter(test => test.is_active);
    } else if (filters.status === 'completed') {
      // This would need to be implemented based on test completion status
      filteredTests = [];
    } else if (filters.status === 'upcoming') {
      const now = new Date();
      filteredTests = filteredTests.filter(test => {
        if (!test.due_date) return false;
        const dueDate = new Date(test.due_date);
        return dueDate > now;
      });
    }

    // Apply subject filter
    if (filters.subject) {
      filteredTests = filteredTests.filter(test => test.subject === filters.subject);
    }

    // Apply test type filter
    if (filters.test_type) {
      filteredTests = filteredTests.filter(test => test.test_type === filters.test_type);
    }

    // Apply due date filter
    if (filters.due_date) {
      const now = new Date();
      filteredTests = filteredTests.filter(test => {
        if (!test.due_date) return false;
        const dueDate = new Date(test.due_date);
        
        switch (filters.due_date) {
          case 'today':
            return dueDate.toDateString() === now.toDateString();
          case 'week':
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return dueDate <= weekFromNow;
          case 'month':
            const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return dueDate <= monthFromNow;
          default:
            return true;
        }
      });
    }

    return filteredTests;
  };

  const getTestStatus = (test: any) => {
    if (test.is_active === false) return 'inactive';
    if (!test.due_date) return 'active';
    
    const now = new Date();
    const dueDate = new Date(test.due_date);
    
    if (dueDate < now) return 'overdue';
    if (dueDate.toDateString() === now.toDateString()) return 'due_today';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'due_today': return '#f59e0b';
      case 'overdue': return '#ef4444';
      case 'inactive': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'due_today': return 'Due Today';
      case 'overdue': return 'Overdue';
      case 'inactive': return 'Inactive';
      default: return 'Unknown';
    }
  };

  const getSubjects = () => {
    const subjects = new Set(testState.activeTests.map(test => test.subject));
    return Array.from(subjects);
  };

  const getTestTypes = () => {
    const types = new Set(testState.activeTests.map(test => test.test_type));
    return Array.from(types);
  };

  const filteredTests = getFilteredTests();
  const subjects = getSubjects();
  const testTypes = getTestTypes();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Tests</Text>
        <Text style={styles.subtitle}>
          {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            {['all', 'active', 'upcoming', 'today', 'week', 'month'].map((filter) => (
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
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
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

      {/* Tests List */}
      {testState.loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      ) : filteredTests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tests found</Text>
          <Text style={styles.emptySubtext}>
            {Object.keys(filters).length > 0 
              ? 'Try adjusting your filters'
              : 'Check back later for new tests'
            }
          </Text>
        </View>
      ) : (
        <View style={styles.testsList}>
          {filteredTests.map((test: any) => {
            const status = getTestStatus(test as any);
            const statusColor = getStatusColor(status);
            const statusText = getStatusText(status);
            
            return (
              <TouchableOpacity
                key={test.id}
                style={styles.testCard}
                onPress={() => handleTestPress(test as any)}
              >
                <View style={styles.testHeader}>
                  <Text style={styles.testTitle}>{test.test_name || test.title || 'Test'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusText}</Text>
                  </View>
                </View>
                
                <View style={styles.testDetails}>
                  <Text style={styles.testSubject}>{test.subject}</Text>
                  <Text style={styles.testType}>{test.test_type}</Text>
                </View>
                
                <View style={styles.testInfo}>
                  <Text style={styles.testPoints}>{test.total_points || test.points || 0} points</Text>
                  {test.due_date && (
                    <Text style={[
                      styles.testDueDate,
                      status === 'overdue' && styles.overdueText
                    ]}>
                      Due: {new Date(test.due_date).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                
                {test.description && (
                  <Text style={styles.testDescription} numberOfLines={2}>
                    {test.description}
                  </Text>
                )}
                
                <View style={styles.testFooter}>
                  <Text style={styles.testTeacher}>Teacher: {test.teacher_name}</Text>
                  <Text style={styles.testCreated}>
                    Created: {new Date(test.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
  testsList: {
    padding: 16,
    gap: 16,
  },
  testCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  testDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testSubject: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  testType: {
    fontSize: 12,
    color: '#4f46e5',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  testInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testPoints: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  testDueDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  overdueText: {
    color: '#ef4444',
    fontWeight: '500',
  },
  testDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  testFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  testTeacher: {
    fontSize: 12,
    color: '#9ca3af',
  },
  testCreated: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
