import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { retestService } from '../services/retestService';
import { useApi } from '../hooks/useApi';
import { logger } from '../utils/logger';

interface RetestSystemProps {
  onRetestPress?: (assignment: any) => void;
  onRequestRetest?: (testId: string, reason: string) => void;
}

export function RetestSystem({ onRetestPress, onRequestRetest }: RetestSystemProps) {
  const router = useRouter();
  const [retestAssignments, setRetestAssignments] = useState<any[]>([]);
  const [retestHistory, setRetestHistory] = useState<any[]>([]);
  const [retestStatistics, setRetestStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'assignments' | 'history' | 'statistics'>('assignments');

  // Load retest data
  const loadRetestData = useCallback(async () => {
    setLoading(true);
    try {
      const [assignments, history, statistics] = await Promise.all([
        retestService.getRetestAssignments(),
        retestService.getRetestHistory(),
        retestService.getRetestStatistics(),
      ]);
      
      setRetestAssignments(assignments);
      setRetestHistory(history);
      setRetestStatistics(statistics);
      
      logger.info('Retest data loaded', 'retest', { 
        assignments: assignments.length, 
        history: history.length 
      });
    } catch (error) {
      logger.error('Failed to load retest data', 'retest', error);
      Alert.alert('Error', 'Failed to load retest data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRetestData();
    } catch (error) {
      logger.error('Failed to refresh retest data', 'retest', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadRetestData]);

  // Load data on mount
  useEffect(() => {
    loadRetestData();
  }, [loadRetestData]);

  // Handle retest press
  const handleRetestPress = useCallback((assignment: any) => {
    if (onRetestPress) {
      onRetestPress(assignment);
    } else {
      router.push(`/tests/${assignment.test_id}`);
    }
  }, [onRetestPress, router]);

  // Handle request retest
  const handleRequestRetest = useCallback(async (testId: string) => {
    Alert.prompt(
      'Request Retest',
      'Please provide a reason for requesting a retest:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (reason && reason.trim()) {
              try {
                const response = await (retestService as any).requestRetest?.(testId, reason.trim()) ?? (retestService as any).submitRetestRequest?.(testId);
                if (response.success) {
                  Alert.alert('Success', response.message);
                  await loadRetestData(); // Refresh data
                } else {
                  Alert.alert('Error', response.message);
                }
              } catch (error) {
                logger.error('Failed to request retest', 'retest', error);
                Alert.alert('Error', 'Failed to request retest. Please try again.');
              }
            }
          },
        },
      ]
    );
  }, [loadRetestData]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'expired': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'expired': return 'Expired';
      default: return 'Unknown';
    }
  };

  // Render assignments tab
  const renderAssignments = () => (
    <View style={styles.tabContent}>
      {retestAssignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No retest assignments</Text>
          <Text style={styles.emptySubtext}>
            You don't have any retest assignments at the moment.
          </Text>
        </View>
      ) : (
        <View style={styles.assignmentsList}>
          {retestAssignments.map((assignment) => (
            <TouchableOpacity
              key={assignment.id}
              style={styles.assignmentCard}
              onPress={() => handleRetestPress(assignment)}
            >
              <View style={styles.assignmentHeader}>
                <Text style={styles.assignmentTitle}>{assignment.test_title}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(assignment.status) }
                ]}>
                  <Text style={styles.statusText}>
                    {getStatusText(assignment.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.assignmentDetails}>
                <Text style={styles.assignmentSubject}>{assignment.subject}</Text>
                <Text style={styles.assignmentReason}>Reason: {assignment.reason}</Text>
              </View>
              
              <View style={styles.assignmentInfo}>
                <Text style={styles.assignmentDueDate}>
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </Text>
                <Text style={styles.assignmentAttempts}>
                  Attempt {assignment.current_attempt}/{assignment.max_attempts}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Render history tab
  const renderHistory = () => (
    <View style={styles.tabContent}>
      {retestHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No retest history</Text>
          <Text style={styles.emptySubtext}>
            You haven't taken any retests yet.
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {retestHistory.map((history) => (
            <View key={history.test_id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>{history.test_title}</Text>
                <Text style={styles.historySubject}>{history.subject}</Text>
              </View>
              
              <View style={styles.historyAttempts}>
                {history.attempts.map((attempt: any, index: number) => (
                  <View key={index} style={styles.attemptRow}>
                    <Text style={styles.attemptNumber}>Attempt {attempt.attempt_number}</Text>
                    <Text style={styles.attemptScore}>
                      {attempt.score}/{attempt.max_score} ({attempt.percentage}%)
                    </Text>
                    <Text style={styles.attemptDate}>
                      {new Date(attempt.submitted_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.historySummary}>
                <Text style={styles.historyBestScore}>
                  Best Score: {history.best_attempt.percentage}%
                </Text>
                <Text style={styles.historyImprovement}>
                  Improvement: {history.improvement_summary.total_improvement > 0 ? '+' : ''}
                  {history.improvement_summary.total_improvement}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Render statistics tab
  const renderStatistics = () => (
    <View style={styles.tabContent}>
      {retestStatistics ? (
        <View style={styles.statisticsContainer}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{retestStatistics.total_retests}</Text>
              <Text style={styles.statLabel}>Total Retests</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{retestStatistics.successful_retests}</Text>
              <Text style={styles.statLabel}>Successful</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{retestStatistics.failed_retests}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{retestStatistics.retest_success_rate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>
          
          <View style={styles.subjectBreakdown}>
            <Text style={styles.breakdownTitle}>Subject Breakdown</Text>
            {retestStatistics.subject_breakdown.map((subject: any, index: number) => (
              <View key={index} style={styles.subjectRow}>
                <Text style={styles.subjectName}>{subject.subject}</Text>
                <Text style={styles.subjectStats}>
                  {subject.retest_count} retests • {subject.success_rate}% success
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No statistics available</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Retest System</Text>
        <Text style={styles.subtitle}>
          Manage your retest assignments and track your progress
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'assignments', label: 'Assignments', count: retestAssignments.length },
          { key: 'history', label: 'History', count: retestHistory.length },
          { key: 'statistics', label: 'Statistics', count: null },
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
            {tab.count !== null && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading retest data...</Text>
          </View>
        ) : (
          <>
            {selectedTab === 'assignments' && renderAssignments()}
            {selectedTab === 'history' && renderHistory()}
            {selectedTab === 'statistics' && renderStatistics()}
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
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
  tabBadge: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
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
  assignmentsList: {
    padding: 16,
    gap: 16,
  },
  assignmentCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  assignmentDetails: {
    marginBottom: 8,
  },
  assignmentSubject: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  assignmentReason: {
    fontSize: 14,
    color: '#6b7280',
  },
  assignmentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  assignmentDueDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  assignmentAttempts: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '500',
  },
  historyList: {
    padding: 16,
    gap: 16,
  },
  historyCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  historySubject: {
    fontSize: 14,
    color: '#6b7280',
  },
  historyAttempts: {
    marginBottom: 12,
  },
  attemptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  attemptNumber: {
    fontSize: 14,
    color: '#6b7280',
  },
  attemptScore: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  attemptDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  historySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  historyBestScore: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
  },
  historyImprovement: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
  },
  statisticsContainer: {
    padding: 16,
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
  subjectBreakdown: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  subjectName: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  subjectStats: {
    fontSize: 14,
    color: '#6b7280',
  },
});
