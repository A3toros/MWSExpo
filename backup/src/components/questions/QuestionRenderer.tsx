import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MultipleChoiceQuestion from './MultipleChoiceQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import InputQuestion from './InputQuestion';
import FillBlanksQuestion from './FillBlanksQuestion';
import DrawingQuestion from './DrawingQuestion';
import MatchingQuestion from './MatchingQuestion';
import WordMatchingQuestion from './WordMatchingQuestion';
import SpeakingQuestion from './SpeakingQuestion';

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
}: Props) {
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
    <View style={styles.header}>
      <Text style={styles.questionNumber}>Question {displayNumber}</Text>
      {(isRestoring && !restored) && (
        <View style={styles.saveIndicator}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.savingText}>Restoring...</Text>
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
  }), [question, testId, qtype, displayNumber, value, onChange, showCorrectAnswers, studentId]);

  
  return (
    <View style={styles.container}>
      {header}
      {(question.question_text || question.question) && (
        <Text style={styles.questionText}>{question.question_text || question.question}</Text>
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
        <View style={styles.unsupported}>
          <Text style={styles.unsupportedText}>Unsupported question type: {qtype}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  questionText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  unsupported: {
    padding: 12,
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 8,
  },
  unsupportedText: {
    color: '#9a3412',
  },
});


