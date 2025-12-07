/** @jsxImportSource nativewind */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { getThemeClasses } from '../utils/themeUtils';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';

type Props = {
  themeMode: string;
  examId?: string | number;
  examName?: string;
  testName?: string;
  currentIndex?: number;
  total?: number;
  timeSeconds?: number | null;
  onBack?: () => void;
  enableBackButton?: boolean;
};

const ExamTestHeader: React.FC<Props> = ({
  themeMode,
  examId,
  examName,
  testName,
  currentIndex,
  total,
  timeSeconds,
  onBack,
  enableBackButton = true,
}) => {
  const themeClasses = getThemeClasses(themeMode);
  const position =
    typeof currentIndex === 'number' && typeof total === 'number' ? `${currentIndex + 1} / ${total}` : '--';
  const autoSubmitRef = useRef(false);

  const timeDisplay = useMemo(() => {
    if (typeof timeSeconds !== 'number') return '--:--';
    const clamped = Math.max(0, Math.floor(timeSeconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeSeconds]);

  const handleBack = () => {
    if (!onBack) return;
    Alert.alert('Leave exam?', 'Progress is saved. Do you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onBack },
    ]);
  };

  // Intercept Android hardware back
  useAndroidBackButton(enableBackButton, handleBack);

  // Auto-redirect to exam overview for auto-submit when timer hits 0 (web parity)
  useEffect(() => {
    if (!examId) return;
    if (typeof timeSeconds !== 'number') return;
    if (timeSeconds > 0) return;
    if (autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    router.replace({ pathname: '/exam/[examId]', params: { examId: String(examId), autoSubmit: '1' } as any });
  }, [examId, timeSeconds]);

  const getArrowSource = () => {
    switch (themeMode) {
      case 'dark':
        return require('../../assets/images/arrow-back-dark.png');
      case 'cyberpunk':
        return require('../../assets/images/arrow-back-cyberpunk.png');
      default:
        return require('../../assets/images/arrow-back-light.png');
    }
  };

  return (
    <View className={`border-b px-4 py-3 ${themeClasses.surface} ${themeClasses.border}`}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={handleBack} className="pr-3">
          <View
            className={`w-10 h-10 rounded-full justify-center items-center ${
              themeMode === 'cyberpunk'
                ? 'bg-black border border-cyan-400/30'
                : themeMode === 'dark'
                ? 'bg-white/10'
                : 'bg-white/20'
            }`}
          >
            <Image source={getArrowSource()} className="w-5 h-5" resizeMode="contain" />
          </View>
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
            numberOfLines={1}
          >
            {examName || 'Exam'}
          </Text>
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-cyan-300 text-xs'
                : themeMode === 'dark'
                ? 'text-gray-300 text-xs'
                : 'text-gray-600 text-xs'
            }
            numberOfLines={1}
          >
            {testName || ''}
          </Text>
        </View>

        <View className="pl-3 items-end" style={{ minWidth: 90 }}>
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-yellow-300 font-semibold'
                : themeMode === 'dark'
                ? 'text-yellow-200 font-semibold'
                : 'text-yellow-700 font-semibold'
            }
          >
            ⏱ {timeDisplay}
          </Text>
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-cyan-300 text-xs'
                : themeMode === 'dark'
                ? 'text-gray-300 text-xs'
                : 'text-gray-600 text-xs'
            }
          >
            {position}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ExamTestHeader;

