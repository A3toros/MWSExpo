import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../services/apiClient';
import { buildExamTestRoute } from '../utils/examRoutes';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ExamNavTest = {
  test_id: number | string;
  test_name: string;
  test_type: string;
};

type UseExamNavigationOptions = {
  examId?: string | string[];
  currentTestId?: string | string[] | number;
  currentTestType?: string;
  enabled?: boolean;
  studentId?: string | number | null;
};

export const useExamNavigation = ({
  examId,
  currentTestId,
  currentTestType,
  enabled = true,
  studentId,
}: UseExamNavigationOptions) => {
  const normalizedExamId = Array.isArray(examId) ? examId[0] : examId;
  const normalizedTestId = Array.isArray(currentTestId) ? currentTestId[0] : currentTestId;

  const [tests, setTests] = useState<ExamNavTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examName, setExamName] = useState<string | null>(null);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null);
  const [cachedAnswers, setCachedAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!enabled || !normalizedExamId) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await api.get(`/.netlify/functions/get-exam?exam_id=${normalizedExamId}`);
        if (!resp?.data?.success || !resp?.data?.data?.tests) {
          throw new Error(resp?.data?.message || 'Failed to load exam tests');
        }
        if (!isMounted) return;
        const exam = resp.data.data;
        setTests(exam.tests);
        setExamName(exam.exam_name || null);
        setTotalMinutes(exam.total_time_minutes || null);

        // Load cached answers for all tests (for prefill)
        if (studentId) {
          const loaded: Record<string, any> = {};
          for (const t of exam.tests) {
            const key = `exam_answer_${studentId}_${normalizedExamId}_${t.test_id}_${t.test_type}`;
            try {
              const raw = await AsyncStorage.getItem(key);
              if (raw) {
                loaded[key] = JSON.parse(raw);
              }
            } catch {
              // ignore
            }
          }
          setCachedAnswers(loaded);
        }
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to load exam tests');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [enabled, normalizedExamId, studentId]);

  const currentIndex = useMemo(
    () =>
      tests.findIndex(
        (t) => String(t.test_id) === String(normalizedTestId ?? '') && t.test_type === currentTestType,
      ),
    [tests, normalizedTestId, currentTestType],
  );

  const total = tests.length;
  const prevTest = currentIndex > 0 ? tests[currentIndex - 1] : undefined;
  const nextTest = currentIndex >= 0 && currentIndex < tests.length - 1 ? tests[currentIndex + 1] : undefined;

  const navigateToTest = useCallback(
    (test?: ExamNavTest) => {
      if (!test || !normalizedExamId) return;
      const path = buildExamTestRoute(test.test_type, test.test_id);
      if (!path) return;
      router.replace({ pathname: path as any, params: { exam: '1', examId: String(normalizedExamId) } as any });
    },
    [normalizedExamId],
  );

  const navigatePrev = useCallback(() => navigateToTest(prevTest), [navigateToTest, prevTest]);
  const navigateNext = useCallback(() => navigateToTest(nextTest), [navigateToTest, nextTest]);
  const navigateReview = useCallback(() => {
    if (!normalizedExamId) return;
    router.replace(`/exam/${normalizedExamId}` as any);
  }, [normalizedExamId]);

  return {
    tests,
    loading,
    error,
    currentIndex,
    total,
    prevTest,
    nextTest,
    navigatePrev,
    navigateNext,
    navigateReview,
    navigateToTest,
    examName,
    totalMinutes,
    cachedAnswers,
  };
};

