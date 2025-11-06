/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';
import MathText from './math/MathText';

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
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  try {
    console.log('📊 TestResults received data:', {
      type: testResults?.testType,
      total: testResults?.totalQuestions,
      score: testResults?.score,
      qaCount: testResults?.questionAnalysis?.length,
      firstQA: testResults?.questionAnalysis?.[0]
    });
    if (testResults?.testType === 'word_matching' && Array.isArray(testResults?.questionAnalysis)) {
      const wm = testResults.questionAnalysis.map((q) => ({
        questionNumber: q.questionNumber,
        userAnswer: q.userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: q.isCorrect
      }));
      console.log('🧩 Word-matching TestResults questionAnalysis:', wm);
    }
  } catch {}
  if (!testResults || !testResults.showResults) {
    return (
      <View className={`flex-1 justify-center items-center ${themeClasses.background}`}>
        <Text className={`text-base ${themeClasses.textSecondary}`}>No test results to display</Text>
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

  // Derive correct values locally to avoid relying on stale backend-calculated percentages
  const derivedCorrect = Array.isArray(questionAnalysis) ? questionAnalysis.filter(q => q.isCorrect).length : (score ?? 0);
  const derivedTotal = (totalQuestions && totalQuestions > 0) ? totalQuestions : (Array.isArray(questionAnalysis) ? questionAnalysis.length : 0);
  const derivedPercentage = derivedTotal > 0 ? Math.round((derivedCorrect / derivedTotal) * 100) : 0;

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
      <View className={`flex-1 justify-center items-center ${themeClasses.background}`}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#00ffff' : '#2563eb'} />
        <Text className={`text-base mt-4 ${themeClasses.textSecondary}`}>
          {themeMode === 'cyberpunk' ? 'LOADING TEST RESULTS...' : 'Loading test results...'}
        </Text>
      </View>
    );
  }

  const scoreColor = getScoreColor(derivedPercentage);
  const passStatusColor = getPassStatusColor(derivedPercentage >= 60);

  return (
    <ScrollView className={`flex-1 ${themeClasses.background}`}>
      <View className="p-4">
        {/* Header */}
        <View className={`${themeClasses.surface} rounded-xl p-6 mb-4 shadow-sm border ${themeClasses.border}`}>
          {/* Academic Integrity Warning */}
          {(testResults?.caught_cheating || caught_cheating) && (
            <View className={`${themeMode === 'cyberpunk' ? 'bg-red-900/20 border-l-4 border-red-400' : 'bg-red-50 border-l-4 border-red-500'} p-4 mb-4`}>
              <View className="flex-row items-start">
                <Text className={`text-xl ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-500'} mr-2`}>⚠️</Text>
                <View className="flex-1">
                  <Text className={`text-sm ${themeMode === 'cyberpunk' ? 'text-red-400 font-bold tracking-wider' : 'text-red-500 font-semibold'} mb-1`}>
                    {themeMode === 'cyberpunk' ? 'ACADEMIC INTEGRITY WARNING:' : 'Academic Integrity Warning:'}
                  </Text>
                  <Text className={`text-sm ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-500'}`}>
                    {themeMode === 'cyberpunk' ? 'THIS TEST HAS BEEN FLAGGED FOR SUSPICIOUS BEHAVIOR. ' : 'This test has been flagged for suspicious behavior. '}
                    {themeMode === 'cyberpunk' ? 'YOU HAVE SWITCHED TABS ' : 'You have switched tabs '}
                    {testResults?.visibility_change_times || visibility_change_times || 0} 
                    {themeMode === 'cyberpunk' ? ' TIMES DURING THE TEST.' : ' times during the test.'}
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1">
              <Text className={`text-2xl font-bold mb-2 ${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeClasses.text}`}>
                {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
              </Text>
              <Text className={`text-lg mb-1 ${themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeClasses.text}`}>
                {themeMode === 'cyberpunk' ? (testInfo?.test_name || 'TEST').toUpperCase() : (testInfo?.test_name || 'Test')}
              </Text>
              <Text className={`text-sm ${themeClasses.textSecondary}`}>
                {getTestTypeDisplay(testType)} • Completed on {new Date(timestamp).toLocaleDateString()}
              </Text>
            </View>
            <View className="items-end">
              <View 
                className="px-4 py-2 rounded-full border"
                style={{
                  backgroundColor: passStatusColor.bg,
                  borderColor: passStatusColor.border,
                }}
              >
                <Text 
                  className="text-sm font-semibold"
                  style={{ color: passStatusColor.text }}
                >
                  {passed ? '✓ PASSED' : '✗ FAILED'}
                </Text>
              </View>
            </View>
          </View>

          {/* Score Summary */}
          <View className="flex-row justify-around mb-4">
            <View className={`items-center p-4 rounded-lg flex-1 mx-1 ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : 'bg-gray-50'}`}>
              <Text className={`text-2xl font-bold ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeClasses.text}`}>{derivedCorrect}</Text>
              <Text className={`text-xs ${themeClasses.textSecondary}`}>
                {themeMode === 'cyberpunk' ? 'CORRECT ANSWERS' : 'Correct Answers'}
              </Text>
            </View>
            <View className={`items-center p-4 rounded-lg flex-1 mx-1 ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : 'bg-gray-50'}`}>
              <Text className={`text-2xl font-bold ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeClasses.text}`}>{derivedTotal}</Text>
              <Text className={`text-xs ${themeClasses.textSecondary}`}>
                {themeMode === 'cyberpunk' ? 'TOTAL QUESTIONS' : 'Total Questions'}
              </Text>
            </View>
            <View 
              className={`items-center p-4 rounded-lg flex-1 mx-1 ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : ''}`}
              style={{ backgroundColor: themeMode === 'cyberpunk' ? 'transparent' : scoreColor.bg }}
            >
              <Text 
                className={`text-2xl font-bold ${themeMode === 'cyberpunk' ? 'text-cyan-400' : ''}`}
                style={{ color: themeMode === 'cyberpunk' ? '#00ffff' : scoreColor.text }}
              >
                {derivedPercentage}%
              </Text>
              <Text className={`text-xs ${themeClasses.textSecondary}`}>
                {themeMode === 'cyberpunk' ? 'SCORE' : 'Score'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className={`w-full rounded-lg h-3 mb-4 ${themeMode === 'cyberpunk' ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <View 
              className="h-3 rounded-lg"
              style={{
                backgroundColor: themeMode === 'cyberpunk' ? '#00ffff' : scoreColor.text,
                width: `${derivedPercentage}%`
              }} 
            />
          </View>
        </View>

        {/* Question Analysis - Only show for non-matching tests */}
        {testType !== 'matching_type' && testType !== 'word_matching' && (
          <View className={`${themeClasses.surface} rounded-xl p-6 mb-4 shadow-sm border ${themeClasses.border}`}>
            <Text className={`text-xl font-bold mb-4 ${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeClasses.text}`}>
              {themeMode === 'cyberpunk' ? 'QUESTION REVIEW' : 'Question Review'}
            </Text>
            
            <View className="gap-4">
              {questionAnalysis.map((q, index) => (
                <View
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    q.isCorrect 
                      ? (themeMode === 'cyberpunk' ? 'border-green-400/30 bg-green-900/20' : 'border-green-200 bg-green-50')
                      : (themeMode === 'cyberpunk' ? 'border-red-400/30 bg-red-900/20' : 'border-red-200 bg-red-50')
                  }`}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <Text className={`text-base font-semibold ${themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeClasses.text}`}>
                      {themeMode === 'cyberpunk' ? `QUESTION ${q.questionNumber}` : `Question ${q.questionNumber}`}
                    </Text>
                    <View className={`px-3 py-1 rounded-xl ${
                      q.isCorrect 
                        ? (themeMode === 'cyberpunk' ? 'bg-green-900/30 border border-green-400/30' : 'bg-green-100')
                        : (themeMode === 'cyberpunk' ? 'bg-red-900/30 border border-red-400/30' : 'bg-red-100')
                    }`}>
                      <Text className={`text-xs font-semibold ${
                        q.isCorrect 
                          ? (themeMode === 'cyberpunk' ? 'text-green-400' : 'text-green-800')
                          : (themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-800')
                      }`}>
                        {q.isCorrect ? (themeMode === 'cyberpunk' ? '✓ CORRECT' : '✓ Correct') : (themeMode === 'cyberpunk' ? '✗ INCORRECT' : '✗ Incorrect')}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="mb-4">
                    <Text className={`font-medium mb-2 ${themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeClasses.text}`}>
                      {themeMode === 'cyberpunk' ? 'QUESTION:' : 'Question:'}
                    </Text>
                    <View className={`p-3 rounded-lg ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : 'bg-gray-50'}`}>
                      {(testType === 'multiple_choice' || testType === 'true_false' || testType === 'input') ? (
                        <MathText text={q.question} fontSize={14} />
                      ) : (
                        <Text className={`${themeMode === 'cyberpunk' ? 'text-cyan-200' : 'text-gray-700'}`}>
                          {q.question}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View className="gap-3">
                    <View>
                      <Text className={`font-medium mb-2 ${themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeClasses.text}`}>
                        {themeMode === 'cyberpunk' ? 'YOUR ANSWER:' : 'Your Answer:'}
                      </Text>
                      <View className={`p-3 rounded-lg ${
                        q.isCorrect 
                          ? (themeMode === 'cyberpunk' ? 'bg-green-900/30 border border-green-400/30' : 'bg-green-100')
                          : (themeMode === 'cyberpunk' ? 'bg-red-900/30 border border-red-400/30' : 'bg-red-100')
                      }`}>
                        {(q.userAnswer !== undefined && q.userAnswer !== null && String(q.userAnswer).length > 0) ? (
                          (testType === 'multiple_choice' || testType === 'input') ? (
                            <MathText 
                              text={String(q.userAnswer)} 
                              fontSize={14}
                            />
                          ) : (
                            <Text className={`${
                              q.isCorrect 
                                ? (themeMode === 'cyberpunk' ? 'text-green-400' : 'text-green-800')
                                : (themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-800')
                            }`}>
                              {String(q.userAnswer)}
                            </Text>
                          )
                        ) : (
                          <Text className={`${
                            q.isCorrect 
                              ? (themeMode === 'cyberpunk' ? 'text-green-400' : 'text-green-800')
                              : (themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-800')
                          }`}>
                            {themeMode === 'cyberpunk' ? 'NO ANSWER PROVIDED' : 'No answer provided'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View>
                      <Text className={`font-medium mb-2 ${themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeClasses.text}`}>
                        {themeMode === 'cyberpunk' ? 'CORRECT ANSWER:' : 'Correct Answer:'}
                      </Text>
                      <View className={`p-3 rounded-lg ${themeMode === 'cyberpunk' ? 'bg-blue-900/30 border border-blue-400/30' : 'bg-blue-100'}`}>
                        {(testType === 'multiple_choice' || testType === 'input') ? (
                          <MathText 
                            text={q.correctAnswer} 
                            fontSize={14}
                          />
                        ) : (
                          <Text className={`${themeMode === 'cyberpunk' ? 'text-blue-400' : 'text-blue-800'}`}>
                            {q.correctAnswer}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary Statistics */}
        <View className={`${themeClasses.surface} rounded-xl p-6 shadow-sm border ${themeClasses.border}`}>
          <Text className={`text-xl font-bold mb-4 ${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeClasses.text}`}>
            {themeMode === 'cyberpunk' ? 'SUMMARY STATISTICS' : 'Summary Statistics'}
          </Text>
          
          <View className="flex-row flex-wrap justify-between">
            <View className={`items-center p-4 rounded-lg w-[48%] mb-2 ${themeMode === 'cyberpunk' ? 'bg-blue-900/30 border border-blue-400/30' : 'bg-blue-100'}`}>
              <Text className={`text-xl font-bold ${themeMode === 'cyberpunk' ? 'text-blue-400' : 'text-blue-600'}`}>
                {questionAnalysis.filter(q => q.isCorrect).length}
              </Text>
              <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-blue-400' : 'text-blue-600'}`}>
                {themeMode === 'cyberpunk' ? 'CORRECT' : 'Correct'}
              </Text>
            </View>
            <View className={`items-center p-4 rounded-lg w-[48%] mb-2 ${themeMode === 'cyberpunk' ? 'bg-red-900/30 border border-red-400/30' : 'bg-red-100'}`}>
              <Text className={`text-xl font-bold ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'}`}>
                {questionAnalysis.filter(q => !q.isCorrect).length}
              </Text>
              <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'}`}>
                {themeMode === 'cyberpunk' ? 'INCORRECT' : 'Incorrect'}
              </Text>
            </View>
            <View className={`items-center p-4 rounded-lg w-[48%] mb-2 ${themeMode === 'cyberpunk' ? 'bg-gray-800 border border-cyan-400/30' : 'bg-gray-100'}`}>
              <Text className={`text-xl font-bold ${themeMode === 'cyberpunk' ? 'text-cyan-400' : 'text-gray-600'}`}>
                {Math.round((questionAnalysis.filter(q => q.isCorrect).length / totalQuestions) * 100)}%
              </Text>
              <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-cyan-400' : 'text-gray-600'}`}>
                {themeMode === 'cyberpunk' ? 'ACCURACY' : 'Accuracy'}
              </Text>
            </View>
            <View className={`items-center p-4 rounded-lg w-[48%] mb-2 ${themeMode === 'cyberpunk' ? 'bg-purple-900/30 border border-purple-400/30' : 'bg-purple-100'}`}>
              <Text className={`text-xl font-bold ${themeMode === 'cyberpunk' ? 'text-purple-400' : 'text-purple-600'}`}>
                {totalQuestions}
              </Text>
              <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-purple-400' : 'text-purple-600'}`}>
                {themeMode === 'cyberpunk' ? 'TOTAL' : 'Total'}
              </Text>
            </View>
          </View>
        </View>

        {/* Back to Dashboard Button - At bottom like multiple choice */}
        <View className="pt-4">
          <TouchableOpacity
            onPress={onBackToCabinet}
            className={`py-3 px-6 rounded-lg ${
              themeMode === 'cyberpunk' 
                ? 'bg-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-blue-600' 
                : 'bg-[#8B5CF6]'
            }`}
          >
            <Text className={`text-center font-semibold text-lg ${
              themeMode === 'cyberpunk' 
                ? 'text-black tracking-wider' 
                : 'text-white'
            }`}>
              {themeMode === 'cyberpunk' ? 'BACK TO DASHBOARD' : 'Back to Dashboard'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
