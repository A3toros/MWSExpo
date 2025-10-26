import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SpeakingTestProvider } from '../../contexts/SpeakingTestContext';
import SpeakingTestStudent from '../test/SpeakingTestStudent';
import { ThemeMode } from '../../contexts/ThemeContext';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    prompt?: string;
    min_words?: number;
    max_duration?: number;
    expected_keywords?: string[];
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: any;
  onAnswerChange?: (questionId: string | number, answer: any) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
  themeMode?: ThemeMode;
};

export default function SpeakingQuestion({
  question,
  testId,
  testType = 'speaking',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null,
  themeMode = 'light'
}: Props) {
  // Convert single question to array format expected by SpeakingTestStudent
  const questions = [{
    id: String(question.id),
    question_text: question.question_text || question.question || 'Please record your answer.',
    prompt: question.prompt,
    min_words: question.min_words || 10,
    max_duration: question.max_duration || 300,
    expected_keywords: question.expected_keywords || [],
  }];

  const handleTestComplete = (results: any) => {
    // Handle test completion if needed
    console.log('Speaking test completed:', results);
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    if (onAnswerChange) {
      onAnswerChange(questionId, answer);
    }
  };

  return (
    <SpeakingTestProvider>
      <SpeakingTestStudent
        testId={testId}
        testName={`Question ${displayNumber || question.id}`}
        questions={questions}
        onTestComplete={handleTestComplete}
        onAnswerChange={handleAnswerChange}
        studentId={studentId}
        showCorrectAnswers={showCorrectAnswers}
        themeMode={themeMode}
      />
    </SpeakingTestProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});