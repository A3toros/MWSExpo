/** @jsxImportSource nativewind */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
    <View className="p-4">
      {retestAssignments.length === 0 ? (
        <View className="p-8 items-center">
          <Text className="text-lg text-gray-500 mb-2">No retest assignments</Text>
          <Text className="text-sm text-gray-400 text-center">
            You don't have any retest assignments at the moment.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {retestAssignments.map((assignment) => (
            <TouchableOpacity
              key={assignment.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"
              onPress={() => handleRetestPress(assignment)}
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-bold text-gray-900 flex-1 mr-2">{assignment.test_title}</Text>
                <View 
                  className="px-2 py-1 rounded"
                  style={{ backgroundColor: getStatusColor(assignment.status) }}
                >
                  <Text className="text-xs text-white font-bold">
                    {getStatusText(assignment.status)}
                  </Text>
                </View>
              </View>
              
              <View className="mb-3">
                <Text className="text-sm font-medium text-gray-700 mb-1">{assignment.subject}</Text>
                <Text className="text-sm text-gray-600">Reason: {assignment.reason}</Text>
              </View>
              
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-gray-600">
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </Text>
                <Text className="text-sm text-gray-600">
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
    <View className="p-4">
      {retestHistory.length === 0 ? (
        <View className="p-8 items-center">
          <Text className="text-lg text-gray-500 mb-2">No retest history</Text>
          <Text className="text-sm text-gray-400 text-center">
            You haven't taken any retests yet.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {retestHistory.map((history) => (
            <View key={history.test_id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <View className="mb-3">
                <Text className="text-lg font-bold text-gray-900 mb-1">{history.test_title}</Text>
                <Text className="text-sm text-gray-600">{history.subject}</Text>
              </View>
              
              <View className="mb-3">
                {history.attempts.map((attempt: any, index: number) => (
                  <View key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                    <Text className="text-sm text-gray-600">Attempt {attempt.attempt_number}</Text>
                    <Text className="text-sm text-gray-600">
                      {attempt.score}/{attempt.max_score} ({attempt.percentage}%)
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {new Date(attempt.submitted_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
              
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-medium text-gray-700">
                  Best Score: {history.best_attempt.percentage}%
                </Text>
                <Text className="text-sm font-medium text-green-600">
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
    <View className="p-4">
      {retestStatistics ? (
        <View className="gap-6">
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
              <Text className="text-2xl font-bold text-header-blue mb-1">{retestStatistics.total_retests}</Text>
              <Text className="text-xs text-gray-600 text-center">Total Retests</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
              <Text className="text-2xl font-bold text-green-600 mb-1">{retestStatistics.successful_retests}</Text>
              <Text className="text-xs text-gray-600 text-center">Successful</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
              <Text className="text-2xl font-bold text-red-600 mb-1">{retestStatistics.failed_retests}</Text>
              <Text className="text-xs text-gray-600 text-center">Failed</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
              <Text className="text-2xl font-bold text-header-blue mb-1">{retestStatistics.retest_success_rate}%</Text>
              <Text className="text-xs text-gray-600 text-center">Success Rate</Text>
            </View>
          </View>
          
          <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <Text className="text-lg font-bold text-gray-800 mb-3">Subject Breakdown</Text>
            <View className="gap-3">
              {retestStatistics.subject_breakdown.map((subject: any, index: number) => (
                <View key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="text-sm font-medium text-gray-700">{subject.subject}</Text>
                  <Text className="text-sm text-gray-600">
                    {subject.retest_count} retests • {subject.success_rate}% success
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View className="p-8 items-center">
          <Text className="text-lg text-gray-500">No statistics available</Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue p-5 pt-10">
        <Text className="text-white text-2xl font-bold mb-1">Retest System</Text>
        <Text className="text-blue-100 text-base">
          Manage your retest assignments and track your progress
        </Text>
      </View>

      {/* Tabs */}
      <View className="bg-white flex-row border-b border-gray-200">
        {[
          { key: 'assignments', label: 'Assignments', count: retestAssignments.length },
          { key: 'history', label: 'History', count: retestHistory.length },
          { key: 'statistics', label: 'Statistics', count: null },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-3 px-4 items-center ${
              selectedTab === tab.key 
                ? 'bg-header-blue' 
                : 'bg-white'
            }`}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text className={`text-sm font-medium ${
              selectedTab === tab.key 
                ? 'text-white' 
                : 'text-gray-600'
            }`}>
              {tab.label}
            </Text>
            {tab.count !== null && (
              <View className="bg-white/20 px-2 py-1 rounded-full mt-1">
                <Text className="text-xs text-white font-bold">{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View className="p-5 items-center">
            <Text className="text-base text-gray-500">Loading retest data...</Text>
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

export default RetestSystem;