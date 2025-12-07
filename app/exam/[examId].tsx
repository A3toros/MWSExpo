/** @jsxImportSource nativewind */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../src/utils/themeUtils';
import { useAntiCheatingDetection } from '../../src/hooks/useAntiCheatingDetection';
import { useAppSelector } from '../../src/store';
import { buildExamTestRoute } from '../../src/utils/examRoutes';

const DEBUG_EXAM = true;
const dlog = (...args: any[]) => {
  if (DEBUG_EXAM) {
    // eslint-disable-next-line no-console
    console.log('[Exam]', ...args);
  }
};

type ExamTest = {
  test_id: number | string;
  test_name: string;
  test_type: string;
};

type ExamData = {
  exam_name: string;
  total_time_minutes: number;
  tests: ExamTest[];
};

type TestAnswersState = Record<
  number,
  { answers: any; testType: string; testId: number | string }
>;

const ExamScreen: React.FC = () => {
  const { examId, autoSubmit } = useLocalSearchParams<{ examId: string; autoSubmit?: string }>();
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);

  const [examData, setExamData] = useState<ExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testAnswers, setTestAnswers] = useState<TestAnswersState>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const authUser = useAppSelector((s) => s.auth.user);
  const studentId = useMemo(
    () => (authUser?.student_id ? String(authUser.student_id) : 'student'),
    [authUser?.student_id],
  );
  const studentIdRef = useRef<string>(studentId);

  useEffect(() => {
    studentIdRef.current = studentId;
    dlog('Student resolved', studentIdRef.current);
  }, [studentId]);

  useEffect(() => {
    dlog('Exam screen mounted', { examId });
  }, [examId]);

  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys } = useAntiCheatingDetection({
    studentId,
    testType: 'exam',
    testId: examId || 'unknown',
    enabled: true,
    debug: __DEV__,
  });

  const progressKey = useMemo(() => {
    const key = `exam_progress_${studentId}_${examId}`;
    dlog('Progress key', key);
    return key;
  }, [examId, studentId]);

  const loadStoredAnswers = useCallback(async () => {
    if (!examData) return;
    const collected: TestAnswersState = {};
    for (let i = 0; i < examData.tests.length; i++) {
      const t = examData.tests[i];
      const key = `exam_answer_${studentId}_${examId}_${t.test_id}_${t.test_type}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          collected[i] = { answers: parsed, testType: t.test_type, testId: t.test_id };
          dlog('Loaded answers', { idx: i, key });
        }
      } catch {
        // ignore
      }
    }
    if (Object.keys(collected).length > 0) {
      setTestAnswers((prev) => ({ ...prev, ...collected }));
      dlog('Merged stored answers', Object.keys(collected));
    }
  }, [examData, examId, studentId]);

  useFocusEffect(
    useCallback(() => {
      loadStoredAnswers();
      return () => {};
    }, [loadStoredAnswers]),
  );

  useEffect(() => {
    const loadExam = async () => {
      if (!examId) {
        setError('Exam ID missing');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        dlog('Fetching exam', examId);
        const response = await api.get(`/.netlify/functions/get-exam?exam_id=${examId}`);
        const result = response.data;
        if (!result?.success) {
          throw new Error(result?.message || 'Failed to load exam');
        }
        const exam = result.data as ExamData;
        setExamData(exam);
        dlog('Exam loaded', { tests: exam.tests?.length });

        const saved = await AsyncStorage.getItem(progressKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          dlog('Restored progress', parsed);
          if (parsed.examStarted && parsed.startTime) {
            setExamStarted(true);
            setCurrentTestIndex(parsed.currentTestIndex || 0);
            setTestAnswers(parsed.testAnswers || {});
            const restoredStart = new Date(parsed.startTime);
            setStartTime(restoredStart);
            const elapsed = Math.floor((Date.now() - restoredStart.getTime()) / 1000);
            const totalSeconds = (exam.total_time_minutes || 0) * 60;
            const remaining = Math.max(0, totalSeconds - elapsed);
            setTimeRemaining(remaining);
            if (remaining > 0) {
              startTimer(remaining);
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load exam');
        dlog('Exam load error', e?.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadExam();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const persistProgress = useCallback(
    async (nextState?: Partial<{ currentTestIndex: number; testAnswers: TestAnswersState; examStarted: boolean; startTime: Date | null }>) => {
      const payload = {
        examStarted: nextState?.examStarted ?? examStarted,
        startTime: (nextState?.startTime ?? startTime)?.toISOString?.() ?? null,
        currentTestIndex: nextState?.currentTestIndex ?? currentTestIndex,
        testAnswers: nextState?.testAnswers ?? testAnswers,
      };
      try {
        await AsyncStorage.setItem(progressKey, JSON.stringify(payload));
      } catch {}
    },
    [examStarted, startTime, currentTestIndex, testAnswers, progressKey],
  );

  const startTimer = useCallback((initialSeconds: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeRemaining(initialSeconds);
    dlog('Start timer', initialSeconds);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleStartExam = useCallback(() => {
    if (!examData) return;
    const totalSeconds = (examData.total_time_minutes || 0) * 60;
    const now = new Date();
    dlog('Start exam requested', { examId, totalSeconds });
    setStartTime(now);
    setExamStarted(true);
    startTimer(totalSeconds);
    persistProgress({ examStarted: true, startTime: now });
  }, [examData, persistProgress, startTimer, examId]);

  useEffect(() => {
    if (examStarted) {
      dlog('Exam started state', { examId, examStarted, startTime: startTime?.toISOString?.() });
    }
  }, [examStarted, examId, startTime]);

  const handleSubmit = useCallback(
    async (isAutoSubmit = false) => {
      if (isSubmitting || !examData) return;
      setIsSubmitting(true);
      try {
        const timeTaken = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;
        const formattedAnswers: Record<number, any> = {};
        examData.tests.forEach((t, idx) => {
          const saved = testAnswers[idx];
          if (saved) {
            formattedAnswers[idx] = {
              testType: saved.testType,
              testId: saved.testId,
              answers: saved.answers ?? null,
            };
          } else {
            formattedAnswers[idx] = {
              testType: t.test_type,
              testId: t.test_id,
              answers: null,
            };
          }
        });

        const payload = {
          exam_id: Number(examId),
          student_id: studentId,
          answers: formattedAnswers,
          time_taken: timeTaken,
          started_at: startTime?.toISOString?.() ?? null,
          submitted_at: new Date().toISOString(),
          is_auto_submit: isAutoSubmit,
          caught_cheating: caughtCheating,
          visibility_change_times: visibilityChangeTimes,
        };
        dlog('Submit payload', payload);

        let attempts = 0;
        const maxAttempts = 3;
        let lastErr: any = null;
        while (attempts < maxAttempts) {
          try {
            const resp = await api.post('/.netlify/functions/submit-exam', payload);
            if (resp?.data?.success) {
              dlog('Submit success');
              await AsyncStorage.removeItem(progressKey);
              for (const t of examData.tests) {
                const key = `exam_answer_${studentId}_${examId}_${t.test_id}_${t.test_type}`;
                await AsyncStorage.removeItem(key);
              }
              router.replace(`/exam/results/${examId}` as any);
              try {
                await clearCheatingKeys?.();
              } catch {}
              return;
            }
            lastErr = new Error(resp?.data?.message || 'Submit failed');
          } catch (e) {
            lastErr = e;
            attempts += 1;
            const errMsg = e instanceof Error ? e.message : String(e);
            dlog('Submit attempt failed', attempts, errMsg);
            if (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1000 * attempts));
            }
          }
        }
        throw lastErr || new Error('Submit failed');
      } catch (e: any) {
        dlog('Submit error', e?.message);
        Alert.alert('Submit failed', e?.message || 'Unknown error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [caughtCheating, examData, examId, isSubmitting, progressKey, startTime, testAnswers, visibilityChangeTimes],
  );

  const handleAutoSubmit = useCallback(() => {
    if (isSubmitting) return;
    handleSubmit(true);
  }, [handleSubmit, isSubmitting]);

  useEffect(() => {
    if (!examStarted) return;
    if (isSubmitting) return;
    if (autoSubmit === '1') {
      handleAutoSubmit();
      return;
    }
    if (timeRemaining === 0) {
      handleAutoSubmit();
    }
  }, [autoSubmit, examStarted, handleAutoSubmit, isSubmitting, timeRemaining]);

  const currentTest = useMemo(() => {
    if (!examData) return null;
    return examData.tests?.[currentTestIndex] || null;
  }, [examData, currentTestIndex]);

  const displayTime = useMemo(() => {
    if (timeRemaining !== null) return timeRemaining;
    if (examData?.total_time_minutes) return (examData.total_time_minutes || 0) * 60;
    return null;
  }, [timeRemaining, examData?.total_time_minutes]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const goToTestRoute = useCallback((test: ExamTest) => {
    const path = buildExamTestRoute(test.test_type, test.test_id);
    if (!path) {
      Alert.alert('Unsupported test type', test.test_type || 'unknown');
      return;
    }
    dlog('Navigate to test', { path, testId: test.test_id, examId });
    router.push({ pathname: path as any, params: { exam: '1', examId: String(examId) } as any });
  }, [examId]);

  const handleNext = useCallback(() => {
    if (!examData) return;
    if (currentTestIndex < examData.tests.length - 1) {
      const nextIndex = currentTestIndex + 1;
      setCurrentTestIndex(nextIndex);
      persistProgress({ currentTestIndex: nextIndex });
    } else {
      setShowOverview(true);
    }
  }, [currentTestIndex, examData, persistProgress]);

  const handlePrev = useCallback(() => {
    if (currentTestIndex > 0) {
      const prev = currentTestIndex - 1;
      setCurrentTestIndex(prev);
      persistProgress({ currentTestIndex: prev });
    }
  }, [currentTestIndex, persistProgress]);

  const header = (
    <View
      className={`px-4 py-3 border-b flex-row items-center justify-between ${
        themeMode === 'cyberpunk'
          ? 'bg-black border-cyan-700'
          : themeMode === 'dark'
          ? 'bg-gray-900 border-gray-800'
          : 'bg-white border-gray-200'
      }`}
    >
      <TouchableOpacity
        onPress={() =>
          Alert.alert('Leave exam?', 'Your current exam progress is saved. Do you want to leave?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => router.back() },
          ])
        }
        className="pr-3"
      >
        <Text
          className={
            themeMode === 'cyberpunk'
              ? 'text-cyan-300 font-semibold'
              : themeMode === 'dark'
              ? 'text-blue-300 font-semibold'
              : 'text-blue-600 font-semibold'
          }
        >
          ← Back
        </Text>
      </TouchableOpacity>
      <View className="flex-1 items-center">
        <Text
          className={
            themeMode === 'cyberpunk'
              ? 'text-cyan-200 font-bold'
              : themeMode === 'dark'
              ? 'text-gray-100 font-bold'
              : 'text-gray-900 font-bold'
          }
        >
          {examData?.exam_name || 'Exam'}
        </Text>
      </View>
      <View className="pl-3 items-end" style={{ minWidth: 90 }}>
        {displayTime !== null ? (
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-yellow-300 font-semibold'
                : themeMode === 'dark'
                ? 'text-yellow-200 font-semibold'
                : 'text-yellow-700 font-semibold'
            }
          >
            {`⏱ ${formatTime(displayTime)}`}
          </Text>
        ) : (
          <Text className={themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-300' : 'text-gray-500'}>
            —
          </Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View className={`flex-1 items-center justify-center ${themeClasses.background}`}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#22d3ee' : '#2563eb'} />
        <Text
          className={`mt-2 ${
            themeMode === 'cyberpunk'
              ? 'text-cyan-300'
              : themeMode === 'dark'
              ? 'text-gray-200'
              : 'text-gray-700'
          }`}
        >
          Loading exam...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${themeClasses.background}`}>
        <Text
          className={`text-lg mb-4 ${
            themeMode === 'cyberpunk'
              ? 'text-red-400'
              : themeMode === 'dark'
              ? 'text-red-300'
              : 'text-red-600'
          }`}
        >
          {error || 'Failed to load exam'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className={`px-4 py-2 rounded ${
            themeMode === 'cyberpunk'
              ? 'bg-cyan-500'
              : themeMode === 'dark'
              ? 'bg-blue-600'
              : 'bg-blue-500'
          }`}
        >
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-black font-semibold'
                : 'text-white font-semibold'
            }
          >
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!examData) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${themeClasses.background}`}>
        <Text
          className={`text-lg ${
            themeMode === 'cyberpunk'
              ? 'text-red-400'
              : themeMode === 'dark'
              ? 'text-red-300'
              : 'text-red-600'
          }`}
        >
          No exam data
        </Text>
      </View>
    );
  }

  const renderOverview = () => {
    return (
      <View className="mt-4">
        <Text
          className={`text-lg font-semibold mb-3 ${
            themeMode === 'cyberpunk'
              ? 'text-cyan-300'
              : themeMode === 'dark'
              ? 'text-gray-100'
              : 'text-gray-800'
          }`}
        >
          Overview
        </Text>
        <View
          className={`rounded-xl p-4 ${
            themeMode === 'cyberpunk'
              ? 'bg-gray-900 border border-cyan-700'
              : themeMode === 'dark'
              ? 'bg-gray-800 border border-gray-700'
              : 'bg-white border border-gray-200'
          }`}
        >
          {examData.tests.map((t, idx) => {
            const answered = testAnswers[idx]?.answers != null;
            const answersVal = testAnswers[idx]?.answers;
            const answeredCount = Array.isArray(answersVal)
              ? answersVal.filter((v) => v !== null && v !== undefined && `${v}`.trim() !== '').length
              : answersVal && typeof answersVal === 'object'
              ? Object.values(answersVal).filter((v) => v !== null && v !== undefined && `${v}`.trim?.() !== '').length
              : 0;
            const statusColor =
              themeMode === 'cyberpunk'
                ? answered
                  ? 'text-lime-300'
                  : 'text-yellow-300'
                : themeMode === 'dark'
                ? answered
                  ? 'text-green-300'
                  : 'text-yellow-200'
                : answered
                ? 'text-green-600'
                : 'text-yellow-600';
            return (
              <TouchableOpacity
                key={`overview-${idx}-${t.test_id}`}
                onPress={() => setCurrentTestIndex(idx)}
                className="flex-row items-center justify-between py-2"
              >
                <Text
                  className={`text-base ${
                    themeMode === 'cyberpunk'
                      ? 'text-cyan-200'
                      : themeMode === 'dark'
                      ? 'text-gray-200'
                      : 'text-gray-800'
                  }`}
                >
                  {idx + 1}. {t.test_name} ({t.test_type})
                </Text>
                <View className="items-end">
                  <Text className={`text-sm font-semibold ${statusColor}`}>
                    {answered ? 'Done' : 'Pending'}
                  </Text>
                  <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                    Answered: {answeredCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderControls = () => {
    const isLast = examData ? currentTestIndex >= examData.tests.length - 1 : false;
    return (
      <View className="flex-row justify-between items-center mt-6">
        <TouchableOpacity
          disabled={currentTestIndex === 0}
          onPress={handlePrev}
          className={`px-4 py-2 rounded-lg ${
            themeMode === 'cyberpunk'
              ? currentTestIndex === 0
                ? 'bg-gray-800'
                : 'bg-cyan-600'
              : themeMode === 'dark'
              ? currentTestIndex === 0
                ? 'bg-gray-700'
                : 'bg-blue-600'
              : currentTestIndex === 0
              ? 'bg-gray-300'
              : 'bg-header-blue'
          }`}
        >
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-black font-semibold'
                : 'text-white font-semibold'
            }
          >
            Previous
          </Text>
        </TouchableOpacity>
        <Text
          className={`text-base font-semibold ${
            themeMode === 'cyberpunk'
              ? 'text-cyan-300'
              : themeMode === 'dark'
              ? 'text-gray-200'
              : 'text-gray-700'
          }`}
        >
          {currentTestIndex + 1} / {examData.tests.length}
        </Text>
        {isLast ? (
          <TouchableOpacity
            onPress={() => setShowOverview(true)}
            className={`px-4 py-2 rounded-lg ${
              themeMode === 'cyberpunk'
                ? 'bg-cyan-600'
                : themeMode === 'dark'
                ? 'bg-blue-600'
                : 'bg-header-blue'
            }`}
          >
            <Text
              className={
                themeMode === 'cyberpunk'
                  ? 'text-black font-semibold'
                  : 'text-white font-semibold'
              }
            >
              Review
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            disabled={currentTestIndex >= examData.tests.length - 1}
            onPress={handleNext}
            className={`px-4 py-2 rounded-lg ${
              themeMode === 'cyberpunk'
                ? currentTestIndex >= examData.tests.length - 1
                  ? 'bg-gray-800'
                  : 'bg-cyan-600'
                : themeMode === 'dark'
                ? currentTestIndex >= examData.tests.length - 1
                  ? 'bg-gray-700'
                  : 'bg-blue-600'
                : currentTestIndex >= examData.tests.length - 1
                ? 'bg-gray-300'
                : 'bg-header-blue'
            }`}
          >
            <Text
              className={
                themeMode === 'cyberpunk'
                  ? 'text-black font-semibold'
                  : 'text-white font-semibold'
              }
            >
              Next
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderActions = () => (
    <View className="mt-6">
      <TouchableOpacity
        onPress={() => handleSubmit()}
        disabled={isSubmitting}
        className={`py-3 rounded-xl items-center ${
          themeMode === 'cyberpunk'
            ? 'bg-cyan-500'
            : themeMode === 'dark'
            ? 'bg-blue-600'
            : 'bg-purple-600'
        }`}
      >
        <Text
          className={
            themeMode === 'cyberpunk'
              ? 'text-black font-bold'
              : 'text-white font-bold'
          }
        >
          {isSubmitting ? 'Submitting...' : 'Submit Exam'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      {header}
      <ScrollView className="flex-1 px-4 py-4">
        <View
          className={`rounded-2xl p-4 ${
            themeMode === 'cyberpunk'
              ? 'bg-black border border-cyan-700'
              : themeMode === 'dark'
              ? 'bg-gray-900 border border-gray-800'
              : 'bg-white border border-gray-200'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-xl font-bold ${
                themeMode === 'cyberpunk'
                  ? 'text-cyan-300'
                  : themeMode === 'dark'
                  ? 'text-gray-100'
                  : 'text-gray-900'
              }`}
            >
              {examData.exam_name}
            </Text>
            {displayTime !== null ? (
              <Text
                className={`text-sm font-semibold ${
                  themeMode === 'cyberpunk'
                    ? 'text-yellow-300'
                    : themeMode === 'dark'
                    ? 'text-yellow-200'
                    : 'text-yellow-700'
                }`}
              >
                Time left: {formatTime(displayTime)}
              </Text>
            ) : null}
          </View>

          <Text
            className={`mt-2 ${
              themeMode === 'cyberpunk'
                ? 'text-cyan-200'
                : themeMode === 'dark'
                ? 'text-gray-300'
                : 'text-gray-700'
            }`}
          >
            {examData.tests.length} tests
          </Text>

          <View className="mt-4 space-y-3">
            {examData.tests.map((test, idx) => {
              const isActive = idx === currentTestIndex;
              return (
                <TouchableOpacity
                  key={`test-${idx}-${test.test_id}`}
                  onPress={() => setCurrentTestIndex(idx)}
                  className={`p-3 rounded-xl border ${
                    themeMode === 'cyberpunk'
                      ? isActive
                        ? 'bg-gray-900 border-cyan-500'
                        : 'bg-gray-950 border-cyan-800'
                      : themeMode === 'dark'
                      ? isActive
                        ? 'bg-gray-800 border-blue-500'
                        : 'bg-gray-900 border-gray-700'
                      : isActive
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-base font-semibold ${
                      themeMode === 'cyberpunk'
                        ? 'text-cyan-200'
                        : themeMode === 'dark'
                        ? 'text-gray-100'
                        : 'text-gray-900'
                    }`}
                  >
                    {idx + 1}. {test.test_name}
                  </Text>
                  <Text
                    className={
                      themeMode === 'cyberpunk'
                        ? 'text-cyan-300'
                        : themeMode === 'dark'
                        ? 'text-gray-300'
                        : 'text-gray-600'
                    }
                  >
                    Type: {test.test_type}
                  </Text>
                  <TouchableOpacity
                    onPress={() => goToTestRoute(test)}
                    className={`mt-2 px-3 py-2 rounded-lg self-start ${
                      themeMode === 'cyberpunk'
                        ? 'bg-cyan-600'
                        : themeMode === 'dark'
                        ? 'bg-blue-600'
                        : 'bg-header-blue'
                    }`}
                  >
                    <Text
                      className={
                        themeMode === 'cyberpunk'
                          ? 'text-black font-semibold'
                          : 'text-white font-semibold'
                      }
                    >
                      Open test
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>

          {renderControls()}
          {renderOverview()}
          {renderActions()}
        </View>
      </ScrollView>
    </View>
  );
};

export default ExamScreen;

