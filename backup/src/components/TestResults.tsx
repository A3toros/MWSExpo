import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';

// TEST RESULTS COMPONENT - Complete Test Results Display for React Native
// ✅ REWRITTEN: From web TestResults.jsx to React Native
// ✅ REWRITTEN: Full test results rendering with detailed analysis
// ✅ REWRITTEN: Score display with pass/fail indication
// ✅ REWRITTEN: Question-by-question review
// ✅ REWRITTEN: Answer comparison (user vs correct)
// ✅ REWRITTEN: Responsive design for mobile
// ✅ REWRITTEN: Navigation back to cabinet
// ✅ REWRITTEN: Academic integrity warnings
// ✅ REWRITTEN: Summary statistics

type TestResultsData = {
  showResults: boolean;
  testInfo: {
    test_name: string;
    id: string | number;
    test_id: string | number;
  };
  testType: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  questionAnalysis: Array<{
    questionNumber: number;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    score: number;
    maxScore: number;
  }>;
  timestamp: string;
  caught_cheating?: boolean;
  visibility_change_times?: number;
};

type Props = {
  testResults: TestResultsData;
  onBackToCabinet: () => void;
  onRetakeTest?: (testType: string, testId: string) => void;
  isLoading?: boolean;
  caught_cheating?: boolean;
  visibility_change_times?: number;
};

export default function TestResults({
  testResults,
  onBackToCabinet,
  onRetakeTest,
  isLoading = false,
  caught_cheating = false,
  visibility_change_times = 0
}: Props) {
  if (!testResults || !testResults.showResults) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <Text style={{ color: '#6b7280', fontSize: 16 }}>No test results to display</Text>
      </View>
    );
  }

  const {
    testInfo,
    testType,
    score,
    totalQuestions,
    percentage,
    passed,
    questionAnalysis,
    timestamp
  } = testResults;

  const getTestTypeDisplay = (type: string) => {
    const types: Record<string, string> = {
      'multiple_choice': 'Multiple Choice',
      'true_false': 'True/False',
      'input': 'Input',
      'matching_type': 'Matching',
      'word_matching': 'Word Matching',
      'speaking': 'Speaking',
      'drawing': 'Drawing',
      'fill_blanks': 'Fill in the Blanks'
    };
    return types[type] || type;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return { text: '#16a34a', bg: '#dcfce7' };
    if (percentage >= 60) return { text: '#ca8a04', bg: '#fef3c7' };
    return { text: '#dc2626', bg: '#fecaca' };
  };

  const getPassStatusColor = (passed: boolean) => {
    return passed 
      ? { text: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' }
      : { text: '#dc2626', bg: '#fecaca', border: '#fca5a5' };
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: '#6b7280', fontSize: 16, marginTop: 16 }}>Loading test results...</Text>
      </View>
    );
  }

  const scoreColor = getScoreColor(percentage);
  const passStatusColor = getPassStatusColor(passed);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3 }}>
          {/* Academic Integrity Warning */}
          {(testResults?.caught_cheating || caught_cheating) && (
            <View style={{ backgroundColor: '#fef2f2', borderLeftWidth: 4, borderLeftColor: '#dc2626', padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 20, color: '#dc2626', marginRight: 8 }}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '600', marginBottom: 4 }}>
                    Academic Integrity Warning:
                  </Text>
                  <Text style={{ fontSize: 14, color: '#dc2626' }}>
                    This test has been flagged for suspicious behavior. 
                    You have switched tabs {testResults?.visibility_change_times || visibility_change_times || 0} times during the test.
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>
                Test Results
              </Text>
              <Text style={{ fontSize: 18, color: '#374151', marginBottom: 4 }}>
                {testInfo?.test_name || 'Test'}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                {getTestTypeDisplay(testType)} • Completed on {new Date(timestamp).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                backgroundColor: passStatusColor.bg,
                borderColor: passStatusColor.border,
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20
              }}>
                <Text style={{ color: passStatusColor.text, fontSize: 14, fontWeight: '600' }}>
                  {passed ? '✓ PASSED' : '✗ FAILED'}
                </Text>
              </View>
            </View>
          </View>

          {/* Score Summary */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, flex: 1, marginHorizontal: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>{score}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Correct Answers</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, flex: 1, marginHorizontal: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>{totalQuestions}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Total Questions</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: scoreColor.bg, borderRadius: 8, flex: 1, marginHorizontal: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: scoreColor.text }}>
                {percentage}%
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Score</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: 6, height: 12, marginBottom: 16 }}>
            <View style={{
              height: 12,
              borderRadius: 6,
              backgroundColor: scoreColor.text,
              width: `${percentage}%`
            }} />
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={onBackToCabinet}
            style={{
              backgroundColor: '#2563eb',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center'
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>← Back to Cabinet</Text>
          </TouchableOpacity>
        </View>

        {/* Question Analysis - Only show for non-matching tests */}
        {testType !== 'matching_type' && testType !== 'word_matching' && (
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
              Question Review
            </Text>
            
            <View style={{ gap: 16 }}>
              {questionAnalysis.map((q, index) => (
                <View
                  key={index}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: q.isCorrect ? '#bbf7d0' : '#fca5a5',
                    backgroundColor: q.isCorrect ? '#f0fdf4' : '#fef2f2'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                      Question {q.questionNumber}
                    </Text>
                    <View style={{
                      backgroundColor: q.isCorrect ? '#dcfce7' : '#fecaca',
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12
                    }}>
                      <Text style={{
                        color: q.isCorrect ? '#166534' : '#dc2626',
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        {q.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#111827', fontWeight: '500', marginBottom: 8 }}>Question:</Text>
                    <Text style={{ color: '#374151', backgroundColor: '#f9fafb', padding: 12, borderRadius: 6 }}>
                      {q.question}
                    </Text>
                  </View>
                  
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={{ color: '#111827', fontWeight: '500', marginBottom: 8 }}>Your Answer:</Text>
                      <Text style={{
                        padding: 12,
                        borderRadius: 6,
                        backgroundColor: q.isCorrect ? '#dcfce7' : '#fecaca',
                        color: q.isCorrect ? '#166534' : '#dc2626'
                      }}>
                        {q.userAnswer || 'No answer provided'}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: '#111827', fontWeight: '500', marginBottom: 8 }}>Correct Answer:</Text>
                      <Text style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: 12, borderRadius: 6 }}>
                        {q.correctAnswer}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary Statistics */}
        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
            Summary Statistics
          </Text>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#dbeafe', borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2563eb' }}>
                {questionAnalysis.filter(q => q.isCorrect).length}
              </Text>
              <Text style={{ fontSize: 12, color: '#2563eb' }}>Correct</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#fecaca', borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#dc2626' }}>
                {questionAnalysis.filter(q => !q.isCorrect).length}
              </Text>
              <Text style={{ fontSize: 12, color: '#dc2626' }}>Incorrect</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#6b7280' }}>
                {Math.round((questionAnalysis.filter(q => q.isCorrect).length / totalQuestions) * 100)}%
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Accuracy</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#f3e8ff', borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#9333ea' }}>
                {totalQuestions}
              </Text>
              <Text style={{ fontSize: 12, color: '#9333ea' }}>Total</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
