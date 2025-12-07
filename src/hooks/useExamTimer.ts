import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Computes remaining exam seconds based on stored startTime and totalMinutes.
 * Falls back to null if data is missing.
 */
export const useExamTimer = ({
  examId,
  studentId,
  totalMinutes,
}: {
  examId?: string | string[];
  studentId?: string | number | null;
  totalMinutes?: number | null;
}) => {
  const [remaining, setRemaining] = useState<number | null>(null);

  const normalizedExamId = useMemo(() => (Array.isArray(examId) ? examId[0] : examId), [examId]);

  const examKey = useMemo(() => {
    if (!normalizedExamId || !studentId) return null;
    return `exam_progress_${studentId}_${normalizedExamId}`;
  }, [normalizedExamId, studentId]);

  const startKey = useMemo(() => {
    if (!normalizedExamId || !studentId) return null;
    return `exam_timer_start_${studentId}_${normalizedExamId}`;
  }, [normalizedExamId, studentId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      if (!totalMinutes || totalMinutes <= 0) {
        setRemaining(null);
        return;
      }

      let startTime: Date | null = null;

      // Try progress key first
      if (examKey) {
        try {
          const raw = await AsyncStorage.getItem(examKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.startTime) {
              startTime = new Date(parsed.startTime);
              if (startKey) {
                // persist a shared start key for test screens
                await AsyncStorage.setItem(startKey, parsed.startTime);
              }
            }
          }
        } catch {
          // ignore read errors
        }
      }

      // Fallback to persisted startKey if present
      if (!startTime && startKey) {
        try {
          const rawStart = await AsyncStorage.getItem(startKey);
          if (rawStart) {
            startTime = new Date(rawStart);
          }
        } catch {
          // ignore
        }
      }

      // If still no start time, start now and persist so it stays consistent across screens
      if (!startTime) {
        startTime = new Date();
        if (startKey) {
          try {
            await AsyncStorage.setItem(startKey, startTime.toISOString());
          } catch {
            // ignore
          }
        }
      }

      const totalSeconds = Math.floor(totalMinutes * 60);

      const updateRemaining = () => {
        const elapsed = Math.floor((Date.now() - (startTime as Date).getTime()) / 1000);
        setRemaining(Math.max(0, totalSeconds - elapsed));
      };

      updateRemaining();
      interval = setInterval(updateRemaining, 1000);
    };

    init();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [examKey, startKey, totalMinutes]);

  return remaining;
};

