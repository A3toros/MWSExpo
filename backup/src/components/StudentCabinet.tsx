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
import { useUser } from '../contexts/UserContext';
import { useApi } from '../hooks/useApi';
import { Test, TestResult } from '../types';
import { ResultsTable } from './ResultsTable';

interface StudentCabinetProps {
  onNavigateToTest?: (testId: string) => void;
  onNavigateToResults?: () => void;
}

export function StudentCabinet({ onNavigateToTest, onNavigateToResults }: StudentCabinetProps) {
  const router = useRouter();
  const { state: testState, loadActiveTests, loadTestResults } = useTest();
  const { state: userState, loadProfile } = useUser();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadActiveTests(),
        loadTestResults(),
        loadProfile(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestPress = (test: any) => {
    if (onNavigateToTest) {
      onNavigateToTest(test.id);
    } else {
      router.push(`/tests/${test.id}`);
    }
  };

  const handleResultsPress = () => {
    if (onNavigateToResults) {
      onNavigateToResults();
    } else {
      router.push('/results');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getActiveTestsCount = () => {
    return testState.activeTests.filter(test => test.is_active !== false).length;
  };

  const getUpcomingTestsCount = () => {
    const now = new Date();
    return testState.activeTests.filter(test => {
      if (!test.due_date) return false;
      const dueDate = new Date(test.due_date);
      return dueDate > now;
    }).length;
  };

  const getRecentResults = () => {
    return testState.testResults.slice(0, 5);
  };

  const getOverallStats = () => {
    if (testState.testResults.length === 0) {
      return { averageScore: 0, testsPassed: 0, testsFailed: 0 };
    }

    const totalTests = testState.testResults.length;
    const passedTests = testState.testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;
    const averageScore = testState.testResults.reduce((sum, result) => sum + result.percentage, 0) / totalTests;

    return {
      averageScore: Math.round(averageScore),
      testsPassed: passedTests,
      testsFailed: failedTests,
    };
  };

  const stats = getOverallStats();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}, {userState.profile?.student.first_name || 'Student'}!
        </Text>
        <Text style={styles.subtitle}>
          Welcome to your student dashboard
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getActiveTestsCount()}</Text>
          <Text style={styles.statLabel}>Active Tests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getUpcomingTestsCount()}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.averageScore}%</Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.testsPassed}</Text>
          <Text style={styles.statLabel}>Passed</Text>
        </View>
      </View>

      {/* Active Tests Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Tests</Text>
          <TouchableOpacity onPress={() => router.push('/tests')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {testState.loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading tests...</Text>
          </View>
        ) : testState.activeTests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active tests available</Text>
          </View>
        ) : (
          <View style={styles.testsList}>
            {testState.activeTests.slice(0, 3).map((test) => (
              <TouchableOpacity
                key={test.id}
                style={styles.testCard}
                onPress={() => handleTestPress(test)}
              >
                <View style={styles.testHeader}>
                  <Text style={styles.testTitle}>{(test as any).test_name || (test as any).title || 'Test'}</Text>
                  <Text style={styles.testSubject}>{(test as any).subject || 'Subject'}</Text>
                </View>
                <View style={styles.testDetails}>
                  <Text style={styles.testType}>{(test as any).test_type || 'Test Type'}</Text>
                  <Text style={styles.testPoints}>{(test as any).total_points || (test as any).points || 0} points</Text>
                </View>
                {test.due_date && (
                  <Text style={styles.testDueDate}>
                    Due: {new Date(test.due_date).toLocaleDateString()}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Recent Results Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Results</Text>
          <TouchableOpacity onPress={handleResultsPress}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {testState.loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading results...</Text>
          </View>
        ) : testState.testResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No results available</Text>
          </View>
        ) : (
          <ResultsTable
            results={testState.testResults.map(result => ({
              id: result.id,
              test_id: result.test_id,
              test_name: (result as any).test_name || 'Test',
              subject: (result as any).subject || 'Subject',
              test_type: (result as any).test_type || 'Test Type',
              percentage: result.percentage,
              passed: result.passed,
              submitted_at: result.submitted_at,
              teacher_name: (result as any).teacher_name,
              retest_score: (result as any).retest_score,
            }))}
            showAll={showAllResults}
            onToggleShowAll={() => setShowAllResults(!showAllResults)}
            maxInitial={3}
            compact={true}
          />
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/tests')}
          >
            <Text style={styles.actionButtonText}>Take Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleResultsPress}
          >
            <Text style={styles.actionButtonText}>View Results</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.actionButtonText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      {userState.notifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.notificationsList}>
            {userState.notifications.slice(0, 3).map((notification) => (
              <View key={notification.id} style={styles.notificationCard}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
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
  greeting: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
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
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  testsList: {
    gap: 12,
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
    marginBottom: 8,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  testSubject: {
    fontSize: 14,
    color: '#6b7280',
  },
  testDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  testType: {
    fontSize: 12,
    color: '#4f46e5',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  testPoints: {
    fontSize: 12,
    color: '#6b7280',
  },
  testDueDate: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
