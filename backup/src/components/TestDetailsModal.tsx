import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useTest } from '../contexts/TestContext';
import { useApi } from '../hooks/useApi';
import { Test, TestQuestion } from '../types';

interface TestDetailsModalProps {
  visible: boolean;
  testId: string;
  onClose: () => void;
  onStartTest?: (test: Test) => void;
  onViewResults?: (testId: string) => void;
}

export function TestDetailsModal({ 
  visible, 
  testId, 
  onClose, 
  onStartTest, 
  onViewResults 
}: TestDetailsModalProps) {
  const { state: testState, loadActiveTests } = useTest();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load test details when modal opens
  useEffect(() => {
    if (visible && testId) {
      loadTestDetails();
    }
  }, [visible, testId]);

  const loadTestDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Find test in active tests
      const foundTest = (testState.activeTests as any[]).find((t: any) => t.id === testId);
      if (foundTest) {
        setTest(foundTest as any);
        setQuestions((foundTest as any).questions || []);
      } else {
        // If not found in active tests, try to load from API
        // This would be implemented with actual API call
        setError('Test not found');
      }
    } catch (err) {
      setError('Failed to load test details');
      console.error('Failed to load test details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = () => {
    if (test && onStartTest) {
      onStartTest(test);
    }
    onClose();
  };

  const handleViewResults = () => {
    if (onViewResults) {
      onViewResults(testId);
    }
    onClose();
  };

  const getTestStatus = () => {
    if (!test) return 'unknown';
    if (!test.is_active) return 'inactive';
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

  const getQuestionTypeCount = () => {
    const counts: Record<string, number> = {};
    questions.forEach((q: any) => {
      const key = q.type || q.question_type || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const getTotalPoints = () => {
    return questions.reduce((sum: number, q: any) => sum + (q.points || q.max_points || 0), 0);
  };

  const getEstimatedTime = () => {
    // Estimate 2 minutes per question
    const estimatedMinutes = questions.length * 2;
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const status = getTestStatus();
  const statusColor = getStatusColor(status);
  const statusText = getStatusText(status);
  const questionTypeCount = getQuestionTypeCount();
  const totalPoints = getTotalPoints();
  const estimatedTime = getEstimatedTime();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test Details</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading test details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadTestDetails} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : test ? (
          <ScrollView style={styles.content}>
            {/* Test Header */}
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>{test.test_name || test.title || 'Test'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>

            {(test.description || test.instructions) && (
              <Text style={styles.testDescription}>{test.description || test.instructions}</Text>
            )}

            {/* Test Info */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Test Information</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Subject:</Text>
                  <Text style={styles.infoValue}>{test.subject}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Teacher:</Text>
                  <Text style={styles.infoValue}>{test.teacher_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type:</Text>
                  <Text style={styles.infoValue}>{test.test_type}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Points:</Text>
                  <Text style={styles.infoValue}>{totalPoints}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Questions:</Text>
                  <Text style={styles.infoValue}>{questions.length}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Estimated Time:</Text>
                  <Text style={styles.infoValue}>{estimatedTime}</Text>
                </View>
                {test.due_date && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Due Date:</Text>
                    <Text style={[
                      styles.infoValue,
                      status === 'overdue' && styles.overdueText
                    ]}>
                      {new Date(test.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(test.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Question Types */}
            {Object.keys(questionTypeCount).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Question Types</Text>
                <View style={styles.questionTypesCard}>
                  {Object.entries(questionTypeCount).map(([type, count]) => (
                    <View key={type} style={styles.questionTypeRow}>
                      <Text style={styles.questionTypeName}>
                        {type.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.questionTypeCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionText}>
                  • Read each question carefully before answering
                </Text>
                <Text style={styles.instructionText}>
                  • You can navigate between questions using the navigation buttons
                </Text>
                <Text style={styles.instructionText}>
                  • Your progress is automatically saved
                </Text>
                <Text style={styles.instructionText}>
                  • You can review your answers before submitting
                </Text>
                {test.due_date && (
                  <Text style={styles.instructionText}>
                    • This test is due on {new Date(test.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              {test.is_active && (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={handleStartTest}
                >
                  <Text style={styles.startButtonText}>Start Test</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.resultsButton}
                onPress={handleViewResults}
              >
                <Text style={styles.resultsButtonText}>View Results</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#4f46e5',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 1,
  },
  testTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  testDescription: {
    fontSize: 16,
    color: '#6b7280',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 1,
    lineHeight: 24,
  },
  section: {
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 1,
  },
  infoSection: {
    marginBottom: 1,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 20,
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
  overdueText: {
    color: '#ef4444',
  },
  questionTypesCard: {
    backgroundColor: 'white',
    padding: 20,
  },
  questionTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  questionTypeName: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  questionTypeCount: {
    fontSize: 16,
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  instructionsCard: {
    backgroundColor: 'white',
    padding: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 24,
  },
  actionsSection: {
    padding: 20,
    gap: 12,
  },
  startButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
