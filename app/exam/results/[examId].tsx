/** @jsxImportSource nativewind */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../src/utils/themeUtils';
import { useAppSelector } from '../../../src/store';
import { api } from '../../../src/services/apiClient';

type ExamTestResult = {
  test_id: number | string;
  test_name?: string;
  test_type: string;
  score: number;
  max_score: number;
  answers?: any;
  studentAnswers?: any;
  leftWords?: string[];
  rightWords?: string[];
  correctPairs?: Record<number, number>;
};

type ExamResultsPayload = {
  exam_name: string;
  score: number;
  max_score: number;
  percentage?: number;
  passing_score?: number | null;
  time_taken?: number | null;
  submitted_at?: string | null;
  test_results: ExamTestResult[];
};

const buildCorrectAnswersMap = (questions: any[], testType: string) => {
  const correctAnswers: Record<string | number, any> = {};
  if (!questions) return correctAnswers;
  questions.forEach((q) => {
    const questionId = q?.question_id ?? q?.id;
    switch (testType) {
      case 'multiple_choice':
        correctAnswers[questionId] = q?.correct_answer;
        break;
      case 'true_false':
        correctAnswers[questionId] = q?.correct_answer === true ? 'true' : 'false';
        break;
      case 'input':
      case 'fill_blanks':
        correctAnswers[questionId] = Array.isArray(q?.correct_answers) ? q?.correct_answers : q?.correct_answer ?? [];
        break;
      case 'matching_type':
        correctAnswers[questionId] = q?.correct_match;
        break;
      case 'word_matching':
        // handled from correctPairs when present
        break;
      default:
        break;
    }
  });
  return correctAnswers;
};

const formatAnswer = (ans: any) => {
  if (ans === null || ans === undefined) return '—';
  if (Array.isArray(ans)) return ans.join(', ');
  if (typeof ans === 'object') return JSON.stringify(ans);
  return String(ans);
};

const ExamResultsScreen: React.FC = () => {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const authUser = useAppSelector((s) => s.auth.user);
  const studentId = useMemo(() => (authUser?.student_id ? String(authUser.student_id) : null), [authUser?.student_id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<ExamResultsPayload | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [testQuestions, setTestQuestions] = useState<Record<string, any[]>>({});
  const [correctMaps, setCorrectMaps] = useState<Record<string, Record<string | number, any>>>({});

  const loadExamResults = useCallback(async () => {
    if (!examId || !studentId) {
      setError('Missing exam or student info');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const resp = await api.get('/.netlify/functions/get-exam-results', {
        params: { exam_id: examId, student_id: studentId },
      });
      if (!resp?.data?.success) {
        throw new Error(resp?.data?.message || 'Failed to load exam results');
      }
      setExamResults(resp.data.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load exam results');
    } finally {
      setLoading(false);
    }
  }, [examId, studentId]);

  useEffect(() => {
    loadExamResults();
  }, [loadExamResults]);

  const fetchQuestions = useCallback(
    async (test: ExamTestResult) => {
      const cacheKey = `${test.test_type}_${test.test_id}`;
      if (testQuestions[cacheKey]) return;
      try {
        if (test.test_type === 'word_matching') {
          if (Array.isArray(test.leftWords) && Array.isArray(test.rightWords)) {
            const questions = test.leftWords.map((leftWord, displayIndex) => {
              const correctRightIndex = test.correctPairs?.[displayIndex];
              const correctRightWord =
                correctRightIndex !== undefined && test.rightWords?.[correctRightIndex] !== undefined
                  ? test.rightWords[correctRightIndex]
                  : '';
              return {
                question_id: displayIndex,
                left_word: leftWord,
                right_word: correctRightWord,
                displayIndex,
              };
            });
            setTestQuestions((prev) => ({ ...prev, [cacheKey]: questions }));
            setCorrectMaps((prev) => ({ ...prev, [cacheKey]: buildCorrectAnswersMap(questions, test.test_type) }));
            return;
          }
          // fallback fetch if not provided
          const resp = await api.get('/.netlify/functions/get-word-matching-test', {
            params: { test_id: test.test_id },
          });
          if (resp?.data?.success && resp.data.data) {
            const leftWords = resp.data.data.leftWords || [];
            const rightWords = resp.data.data.rightWords || [];
            const correctPairs = resp.data.data.correctPairs || {};
            const questions = leftWords.map((leftWord: string, displayIndex: number) => {
              const correctRightIndex = correctPairs[displayIndex];
              const correctRightWord =
                correctRightIndex !== undefined && rightWords[correctRightIndex] !== undefined
                  ? rightWords[correctRightIndex]
                  : '';
              return {
                question_id: displayIndex,
                left_word: leftWord,
                right_word: correctRightWord,
                displayIndex,
              };
            });
            setTestQuestions((prev) => ({ ...prev, [cacheKey]: questions }));
            setCorrectMaps((prev) => ({ ...prev, [cacheKey]: buildCorrectAnswersMap(questions, test.test_type) }));
          }
          return;
        }

        const resp = await api.get('/api/get-test-questions', {
          params: { test_type: test.test_type, test_id: test.test_id },
        });
        if (resp?.data?.success) {
          const questions = resp.data.questions || [];
          setTestQuestions((prev) => ({ ...prev, [cacheKey]: questions }));
          setCorrectMaps((prev) => ({ ...prev, [cacheKey]: buildCorrectAnswersMap(questions, test.test_type) }));
        }
      } catch {
        // ignore
      }
    },
    [testQuestions],
  );

  const toggleExpand = useCallback(
    (index: number, test: ExamTestResult) => {
      setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
      if (!expanded[index]) {
        fetchQuestions(test);
      }
    },
    [expanded, fetchQuestions],
  );

  const renderQuestionReview = (test: ExamTestResult) => {
    const cacheKey = `${test.test_type}_${test.test_id}`;
    const questions = testQuestions[cacheKey] || [];
    const correctMap = correctMaps[cacheKey] || {};
    const studentAnswers = test.answers || test.studentAnswers || {};

    if (!questions.length) {
      return (
        <View className="py-3">
          <Text className={themeClasses.textSecondary}>No questions available.</Text>
        </View>
      );
    }

    return (
      <View className="mt-2">
        {questions.map((q: any, idx: number) => {
          const qid = q?.question_id ?? q?.id ?? idx;
          const studentAnswer = studentAnswers[qid];
          let correctAnswer = correctMap[qid];

          if (test.test_type === 'word_matching' && Array.isArray(test.rightWords)) {
            const pairIdx = test.correctPairs?.[qid];
            correctAnswer =
              pairIdx !== undefined && test.rightWords[pairIdx] !== undefined ? test.rightWords[pairIdx] : correctAnswer;
          }

          return (
            <View
              key={`${test.test_id}-${qid}`}
              className={`p-3 mb-2 rounded-lg border ${themeClasses.border} ${themeClasses.surface}`}
            >
              <Text className={`font-semibold ${themeClasses.text}`}>
                {q?.question_text || q?.prompt || q?.text || q?.title || `Question ${idx + 1}`}
              </Text>
              {test.test_type === 'word_matching' && typeof q?.left_word === 'string' ? (
                <Text className={`${themeClasses.textSecondary} mt-1`}>Left: {q.left_word}</Text>
              ) : null}
              <Text className={`${themeClasses.textSecondary} mt-2`}>Your answer: {formatAnswer(studentAnswer)}</Text>
              <Text className={`${themeClasses.textSecondary} mt-1`}>Correct answer: {formatAnswer(correctAnswer)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${themeClasses.background}`}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#22d3ee' : '#2563eb'} />
        <Text className={`${themeClasses.textSecondary} mt-2`}>Loading exam results...</Text>
      </View>
    );
  }

  if (error || !examResults) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${themeClasses.background}`}>
        <Text className={`${themeClasses.text} text-lg mb-4`}>{error || 'Failed to load exam results'}</Text>
        <TouchableOpacity
          className={`px-4 py-2 rounded ${themeMode === 'cyberpunk' ? 'bg-cyan-500' : themeMode === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { score, max_score, percentage, passing_score, test_results, exam_name, time_taken, submitted_at } = examResults;
  const percentageValue =
    typeof percentage === 'number' ? percentage : max_score > 0 ? Math.round((score / max_score) * 1000) / 10 : 0;
  const passed = passing_score ? percentageValue >= passing_score : percentageValue >= 60;

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <ScrollView className="flex-1 px-4 py-4">
        <View className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.surface}`}>
          <Text className={`text-2xl font-bold ${themeClasses.text}`}>Exam Results</Text>
          <Text className={`${themeClasses.textSecondary} mt-1`}>{exam_name}</Text>
          <Text className={`${themeClasses.textSecondary} mt-1`}>
            Submitted: {submitted_at ? new Date(submitted_at).toLocaleString() : '—'}
            {time_taken ? ` • Time: ${Math.floor((time_taken || 0) / 60)}m ${(time_taken || 0) % 60}s` : ''}
          </Text>

          <View
            className={`mt-4 p-4 rounded-xl border ${themeClasses.border} ${
              passed ? 'bg-green-50/50 dark:bg-green-900/20' : 'bg-yellow-50/50 dark:bg-yellow-900/20'
            }`}
          >
            <Text className={`text-lg font-semibold ${themeClasses.text}`}>{score} / {max_score}</Text>
            <Text className={`text-xl font-bold ${passed ? 'text-green-600 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {percentageValue.toFixed(1)}%
            </Text>
            {passing_score ? (
              <Text className={`${themeClasses.textSecondary} mt-1`}>Passing score: {passing_score}%</Text>
            ) : null}
            <Text className={`${themeClasses.textSecondary} mt-1`}>{passed ? 'Passed' : 'Failed'}</Text>
          </View>
        </View>

        <View className="mt-4">
          <Text className={`text-xl font-semibold mb-3 ${themeClasses.text}`}>Test Breakdown</Text>
          {test_results?.map((t, idx) => {
            const testPercentage = t.max_score > 0 ? (t.score / t.max_score) * 100 : 0;
            const isExpanded = expanded[idx];
            return (
              <View key={`${t.test_id}-${idx}`} className={`mb-3 rounded-xl border ${themeClasses.border} ${themeClasses.surface}`}>
                <TouchableOpacity className="p-4 flex-row justify-between items-center" onPress={() => toggleExpand(idx, t)}>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${themeClasses.text}`}>{t.test_name || `Test ${idx + 1}`}</Text>
                    <Text className={`${themeClasses.textSecondary} mt-1`}>
                      {t.test_type} • {t.score} / {t.max_score} ({testPercentage.toFixed(1)}%)
                    </Text>
                  </View>
                  <Text className={`${themeClasses.textSecondary}`}>{isExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                {isExpanded ? (
                  <View className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                    {renderQuestionReview(t)}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View className="mt-6 mb-8 flex-row justify-center">
          <TouchableOpacity
            className={`px-4 py-3 rounded-lg ${
              themeMode === 'cyberpunk' ? 'bg-cyan-500' : themeMode === 'dark' ? 'bg-blue-600' : 'bg-header-blue'
            }`}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text className="text-white font-semibold">Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ExamResultsScreen;

