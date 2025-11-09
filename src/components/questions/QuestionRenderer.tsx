/** @jsxImportSource nativewind */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import MultipleChoiceQuestion from './MultipleChoiceQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import InputQuestion from './InputQuestion';
import FillBlanksQuestion from './FillBlanksQuestion';
import DrawingQuestion from './DrawingQuestion';
import MatchingQuestion from './MatchingQuestion';
import WordMatchingQuestion from './WordMatchingQuestion';
import SpeakingQuestion from './SpeakingQuestion';
import MathText from '../math/MathText';

type BaseQuestion = {
  id: string | number;
  question_text?: string;
  question?: string;
  question_type?: string;
  maxScore?: number;
};

type Props = {
  question: BaseQuestion;
  testId: string;
  testType: string;
  displayNumber: number;
  studentId: string;
  value?: any;
  onChange: (questionId: string | number, value: any) => void;
  showCorrectAnswers?: boolean;
  textInputProps?: {
    contextMenuHidden?: boolean;
    onFocus?: () => void;
    textContentType?: 'none';
    autoComplete?: 'off';
    autoCorrect?: boolean;
    spellCheck?: boolean;
  };
};

export default function QuestionRenderer({
  question,
  testId,
  testType,
  displayNumber,
  studentId,
  value,
  onChange,
  showCorrectAnswers = false,
  textInputProps,
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const qtype = (question?.question_type || testType || '').toLowerCase();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restore per-question saved value if parent didn't pass one yet
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      if (value != null) return;
      if (!studentId) return;
      setIsRestoring(true);
      try {
        const key = `test_progress_${studentId}_${qtype}_${testId}_${question.id}`;
        const saved = await AsyncStorage.getItem(key);
        if (mounted && saved != null) {
          onChange(question.id, saved);
          setRestored(true);
        }
      } catch {}
      finally {
        if (mounted) setIsRestoring(false);
      }
    };
    restore();
    return () => { mounted = false; };
  }, [value, studentId, qtype, testId, question?.id, onChange]);

  const header = (
    <View className="flex-row justify-between items-center mb-2">
      <Text className={`text-base font-semibold ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'text-white' 
          : 'text-gray-900'
      }`}>
        {themeMode === 'cyberpunk' ? 'QUESTION' : 'Question'} {displayNumber}
      </Text>
      {(isRestoring && !restored) && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60A5FA' : '#2563eb'} />
          <Text className={`text-xs ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'RESTORING...' : 'Restoring...'}
          </Text>
        </View>
      )}
    </View>
  );

  const commonProps = useMemo(() => ({
    question,
    testId,
    testType: qtype,
    displayNumber,
    studentAnswer: value ?? null,
    onAnswerChange: onChange,
    showCorrectAnswers,
    studentId,
    textInputProps,
  }), [question, testId, qtype, displayNumber, value, onChange, showCorrectAnswers, studentId, textInputProps]);

  
  return (
    <View className={`mb-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
      {header}
      {(question.question_text || question.question) && (
        (qtype === 'multiple_choice' || qtype === 'true_false' || qtype === 'input') ? (
          <View className="mb-4">
            <MathText 
              text={question.question_text || question.question || ''}
              fontSize={16}
            />
          </View>
        ) : (
          <Text className={`text-base mb-4 leading-6 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-700'
          }`}>
            {question.question_text || question.question}
          </Text>
        )
      )}
      {qtype === 'multiple_choice' && (
        <MultipleChoiceQuestion {...commonProps} />
      )}
      {qtype === 'true_false' && (
        <TrueFalseQuestion {...commonProps} />
      )}
      {qtype === 'input' && (
        <InputQuestion {...commonProps} />
      )}
      {qtype === 'fill_blanks' && (
        <FillBlanksQuestion {...commonProps} />
      )}
      {qtype === 'drawing' && (
        <DrawingQuestion {...commonProps} />
      )}
      {qtype === 'matching' && (
        <MatchingQuestion {...commonProps} />
      )}
      {qtype === 'word_matching' && (
        <WordMatchingQuestion {...commonProps} />
      )}
      {qtype === 'speaking' && (
        <SpeakingQuestion {...commonProps} />
      )}
      {qtype !== 'multiple_choice' && qtype !== 'true_false' && qtype !== 'input' && qtype !== 'fill_blanks' && qtype !== 'drawing' && qtype !== 'matching' && qtype !== 'word_matching' && qtype !== 'speaking' && (
        <View className={`p-3 rounded-lg border ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-yellow-400' 
            : themeMode === 'dark' 
            ? 'bg-yellow-900/30 border-yellow-600' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <Text className={`text-sm ${
            themeMode === 'cyberpunk' 
              ? 'text-yellow-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-yellow-400' 
              : 'text-yellow-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'UNSUPPORTED QUESTION TYPE:' : 'Unsupported question type:'} {qtype}
          </Text>
        </View>
      )}
    </View>
  );
}

// Styles removed - using NativeWind classes instead


