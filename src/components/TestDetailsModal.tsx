/** @jsxImportSource nativewind */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useTest } from '../contexts/TestContext';
import { useApi } from '../hooks/useApi';
import { Test, TestQuestion } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getModalStyles } from '../utils/themeUtils';

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
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);
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
      <View className={`flex-1 ${themeMode === 'cyberpunk' ? 'bg-black' : themeMode === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <View className={`flex-row items-center justify-between p-4 pt-10 ${themeMode === 'cyberpunk' 
          ? 'bg-black border-b border-cyan-400' 
          : themeMode === 'dark' 
          ? 'bg-gray-800' 
          : 'bg-header-blue'
        }`}>
          <TouchableOpacity 
            onPress={onClose} 
            className={`w-8 h-8 rounded-full items-center justify-center ${themeMode === 'cyberpunk' 
              ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' 
              : 'bg-white/20'
            }`}
          >
            <Text className={`text-base font-bold ${themeMode === 'cyberpunk' ? 'text-black' : 'text-white'}`}>✕</Text>
          </TouchableOpacity>
          <Text className={`text-lg font-bold ${themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : 'text-white'
          }`}>
            {themeMode === 'cyberpunk' ? 'TEST DETAILS' : 'Test Details'}
          </Text>
          <View className="w-8" />
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text className={`text-base ${themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-500'
            }`}>
              {themeMode === 'cyberpunk' ? 'LOADING TEST DETAILS...' : 'Loading test details...'}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-5">
            <Text className={`text-base text-center mb-4 ${themeMode === 'cyberpunk' 
              ? 'text-red-400 tracking-wider' 
              : 'text-red-500'
            }`}>
              {themeMode === 'cyberpunk' ? error.toUpperCase() : error}
            </Text>
            <TouchableOpacity 
              onPress={loadTestDetails} 
              className={`px-6 py-3 rounded-lg ${themeMode === 'cyberpunk' 
                ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' 
                : themeMode === 'dark' 
                ? 'bg-blue-600' 
                : 'bg-header-blue'
              }`}
            >
              <Text className={`text-base font-bold ${themeMode === 'cyberpunk' 
                ? 'text-black tracking-wider' 
                : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'RETRY' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : test ? (
          <ScrollView className="flex-1">
            {/* Test Header */}
            <View className={`flex-row justify-between items-start p-5 mb-px ${themeMode === 'cyberpunk' 
              ? 'bg-black border-b border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800' 
              : 'bg-white'
            }`}>
              <Text className={`text-2xl font-bold flex-1 mr-3 ${themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-gray-100' 
                : 'text-gray-900'
              }`}>
                {themeMode === 'cyberpunk' 
                  ? (test.test_name || test.title || 'TEST').toUpperCase() 
                  : (test.test_name || test.title || 'Test')
                }
              </Text>
              <View 
                className={`px-3 py-1.5 rounded ${themeMode === 'cyberpunk' ? 'shadow-lg' : ''}`}
                style={{ 
                  backgroundColor: statusColor,
                  ...(themeMode === 'cyberpunk' && {
                    shadowColor: statusColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 4,
                    elevation: 4,
                  })
                }}
              >
                <Text className={`text-white text-xs font-bold ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
                  {themeMode === 'cyberpunk' ? statusText.toUpperCase() : statusText}
                </Text>
              </View>
            </View>

            {(test.description || test.instructions) && (
              <Text className="text-base text-gray-500 p-5 bg-white mb-px leading-6">{test.description || test.instructions}</Text>
            )}

            {/* Test Info */}
            <View className="mb-px">
              <Text className="text-lg font-bold text-gray-900 p-5 bg-white mb-px">Test Information</Text>
              <View className="bg-white p-5">
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Subject:</Text>
                  <Text className="text-base text-gray-900 font-medium">{test.subject}</Text>
                </View>
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Teacher:</Text>
                  <Text className="text-base text-gray-900 font-medium">{test.teacher_name}</Text>
                </View>
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Type:</Text>
                  <Text className="text-base text-gray-900 font-medium">{test.test_type}</Text>
                </View>
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Total Points:</Text>
                  <Text className="text-base text-gray-900 font-medium">{totalPoints}</Text>
                </View>
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Questions:</Text>
                  <Text className="text-base text-gray-900 font-medium">{questions.length}</Text>
                </View>
                <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                  <Text className="text-base text-gray-500 font-medium">Estimated Time:</Text>
                  <Text className="text-base text-gray-900 font-medium">{estimatedTime}</Text>
                </View>
                {test.due_date && (
                  <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                    <Text className="text-base text-gray-500 font-medium">Due Date:</Text>
                    <Text className={`text-base font-medium ${
                      status === 'overdue' ? 'text-red-500' : 'text-gray-900'
                    }`}>
                      {new Date(test.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                <View className="flex-row justify-between items-center py-3">
                  <Text className="text-base text-gray-500 font-medium">Created:</Text>
                  <Text className="text-base text-gray-900 font-medium">
                    {new Date(test.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Question Types */}
            {Object.keys(questionTypeCount).length > 0 && (
              <View className="mb-px">
                <Text className="text-lg font-bold text-gray-900 p-5 bg-white mb-px">Question Types</Text>
                <View className="bg-white p-5">
                  {Object.entries(questionTypeCount).map(([type, count]) => (
                    <View key={type} className="flex-row justify-between items-center py-3 border-b border-gray-100">
                      <Text className="text-base text-gray-900 font-medium">
                        {type.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text className="text-base text-header-blue font-bold">{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Instructions */}
            <View className="mb-px">
              <Text className="text-lg font-bold text-gray-900 p-5 bg-white mb-px">Instructions</Text>
              <View className="bg-white p-5">
                <Text className="text-base text-gray-500 mb-2 leading-6">
                  • Read each question carefully before answering
                </Text>
                <Text className="text-base text-gray-500 mb-2 leading-6">
                  • You can navigate between questions using the navigation buttons
                </Text>
                <Text className="text-base text-gray-500 mb-2 leading-6">
                  • Your progress is automatically saved
                </Text>
                <Text className="text-base text-gray-500 mb-2 leading-6">
                  • You can review your answers before submitting
                </Text>
                {test.due_date && (
                  <Text className="text-base text-gray-500 mb-2 leading-6">
                    • This test is due on {new Date(test.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>

            {/* Actions */}
            <View className="p-5 gap-3">
              {test.is_active && (
                <TouchableOpacity
                  className="bg-green-500 p-4 rounded-xl items-center"
                  onPress={handleStartTest}
                >
                  <Text className="text-white text-lg font-bold">Start Test</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                className="bg-header-blue p-4 rounded-xl items-center"
                onPress={handleViewResults}
              >
                <Text className="text-white text-base font-bold">View Results</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

