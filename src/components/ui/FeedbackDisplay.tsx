import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface FeedbackDisplayProps {
  feedback: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    analysis: {
      transcript: string;
      word_count: number;
      keywords_found: string[];
      keywords_missing: string[];
      fluency_score: number;
      pronunciation_score: number;
      overall_score: number;
      feedback: string;
      suggestions: string[];
      grammar_score?: number;
      vocabulary_score?: number;
      content_score?: number;
      grammar_mistakes?: number;
      vocabulary_mistakes?: number;
      improved_transcript?: string;
      grammar_corrections?: any[];
      vocabulary_corrections?: any[];
      pronunciation_corrections?: any[];
    };
    teacher_feedback?: string;
  };
  onNextQuestion: () => void;
  onRetry: () => void;
  isLastQuestion: boolean;
  attempts: number;
  maxAttempts: number;
}

export default function FeedbackDisplay({
  feedback,
  onNextQuestion,
  onRetry,
  isLastQuestion,
  attempts,
  maxAttempts,
}: FeedbackDisplayProps) {
  const { themeMode } = useTheme();
  console.log('🎯 FeedbackDisplay received feedback:', JSON.stringify(feedback, null, 2));
  const { score, maxScore, percentage, passed, analysis } = feedback;

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return '#059669';
    if (percentage >= 60) return '#f59e0b';
    return '#dc2626';
  };

  const getOverallGrade = () => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Speaking Test Results</Text>
        <Text style={styles.headerSubtitle}>Review your performance and decide whether to submit or re-record.</Text>
      </View>

      {/* Overall Score - Gradient Background */}
      <View style={styles.overallScoreCard}>
        <View style={styles.overallScoreContent}>
          <Text style={[styles.overallScoreNumber, { color: getScoreColor(score, maxScore) }]}>
            {score}/100
          </Text>
          <Text style={[styles.overallScoreGrade, { color: getScoreColor(score, maxScore) }]}>
            Grade: {getOverallGrade()}
          </Text>
          <Text style={styles.overallScoreMessage}>
            {percentage >= 80 ? 'Excellent work!' : 
             percentage >= 60 ? 'Good job!' : 
             percentage >= 50 ? 'Not bad, but could be better.' : 
             'Keep practicing!'}
          </Text>
        </View>
      </View>

      {/* Score Breakdown Grid */}
      <View style={styles.scoreGrid}>
        {/* Grammar Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Grammar</Text>
            <Text style={[styles.scoreCardValue, { color: getScoreColor(analysis?.grammar_score || 0, 25) }]}>
              {analysis?.grammar_score || 0}/25
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            {analysis?.grammar_mistakes || 0} mistakes found
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.grammar_score || 0) / 25 * 100, 100)}%`,
                backgroundColor: '#10b981'
              }]}
            />
          </View>
        </View>

        {/* Vocabulary Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Vocabulary</Text>
            <Text style={[styles.scoreCardValue, { color: getScoreColor(analysis?.vocabulary_score || 0, 20) }]}>
              {analysis?.vocabulary_score || 0}/20
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            {analysis?.vocabulary_mistakes || 0} vocabulary issues
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.vocabulary_score || 0) / 20 * 100, 100)}%`,
                backgroundColor: '#8b5cf6'
              }]}
            />
          </View>
        </View>

        {/* Pronunciation Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Pronunciation</Text>
            <Text style={[styles.scoreCardValue, { color: getScoreColor(analysis?.pronunciation_score || 0, 15) }]}>
              {analysis?.pronunciation_score || 0}/15
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            Clarity and accuracy
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.pronunciation_score || 0) / 15 * 100, 100)}%`,
                backgroundColor: '#f59e0b'
              }]}
            />
          </View>
        </View>

        {/* Fluency Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Fluency</Text>
            <Text style={[styles.scoreCardValue, { color: getScoreColor(analysis?.fluency_score || 0, 20) }]}>
              {analysis?.fluency_score || 0}/20
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            Pace, pauses, and flow
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.fluency_score || 0) / 20 * 100, 100)}%`,
                backgroundColor: '#3b82f6'
              }]}
            />
          </View>
        </View>

        {/* Content Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Content</Text>
            <Text style={[styles.scoreCardValue, { color: getScoreColor(analysis?.content_score || 0, 20) }]}>
              {analysis?.content_score || 0}/20
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            How well addressed the prompt
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.content_score || 0) / 20 * 100, 100)}%`,
                backgroundColor: '#6366f1'
              }]}
            />
          </View>
        </View>

        {/* Word Count */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCardHeader, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.scoreCardTitle}>Word Count</Text>
            <Text style={[styles.scoreCardValue, { color: '#374151' }]}>
              {analysis?.word_count || 0} words
            </Text>
          </View>
          <Text style={styles.scoreCardSubtitle}>
            Total words spoken
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min((analysis?.word_count || 0) / 100 * 100, 100)}%`,
                backgroundColor: '#6b7280'
              }]}
            />
          </View>
        </View>
      </View>

      {/* Improved Transcript */}
      <View style={styles.transcriptSection}>
        <Text style={styles.sectionTitle}>Improved Transcript</Text>
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptText}>{analysis?.improved_transcript || analysis?.transcript || 'No transcript available'}</Text>
        </View>
      </View>

      {/* Grammar Corrections */}
      {analysis?.grammar_corrections && analysis.grammar_corrections.length > 0 && (
        <View style={styles.correctionsSection}>
          <Text style={styles.sectionTitle}>Grammar Corrections</Text>
          {analysis.grammar_corrections.map((correction: any, index: number) => (
            <View key={index} style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionMistake}>{correction.mistake}</Text>
                <Text style={styles.correctionArrow}>→</Text>
                <Text style={styles.correctionFixed}>{correction.correction}</Text>
              </View>
              <Text style={styles.correctionExplanation}>{correction.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Vocabulary Corrections */}
      {analysis?.vocabulary_corrections && analysis.vocabulary_corrections.length > 0 && (
        <View style={styles.correctionsSection}>
          <Text style={styles.sectionTitle}>Vocabulary Corrections</Text>
          {analysis.vocabulary_corrections.map((correction: any, index: number) => (
            <View key={index} style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionMistake}>{correction.mistake}</Text>
                <Text style={styles.correctionArrow}>→</Text>
                <Text style={styles.correctionFixed}>{correction.correction}</Text>
              </View>
              <Text style={styles.correctionExplanation}>{correction.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Pronunciation Corrections */}
      {analysis?.pronunciation_corrections && analysis.pronunciation_corrections.length > 0 && (
        <View style={styles.correctionsSection}>
          <Text style={styles.sectionTitle}>Pronunciation Tips</Text>
          {analysis.pronunciation_corrections.map((correction: any, index: number) => (
            <View key={index} style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionWord}>{correction.word}</Text>
              </View>
              <Text style={styles.correctionExplanation}>{correction.correction}</Text>
            </View>
          ))}
        </View>
      )}

      {/* AI Feedback */}
      <View style={styles.feedbackSection}>
        <Text style={styles.sectionTitle}>AI Feedback</Text>
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{analysis?.feedback || 'No feedback available'}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {attempts < maxAttempts && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Ionicons name="refresh" size={20} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextButton} onPress={onNextQuestion}>
          {themeMode === 'cyberpunk' && isLastQuestion ? (
            <Image 
              source={require('../../../assets/images/save-cyberpunk.png')} 
              style={{ width: 20, height: 20 }} 
              resizeMode="contain"
            />
          ) : (
            <Ionicons 
              name={isLastQuestion ? "checkmark" : "arrow-forward"} 
              size={20} 
              color="#ffffff" 
              style={styles.buttonIcon} 
            />
          )}
          <Text style={styles.buttonText}>
            {isLastQuestion ? 'Finish Test' : 'Next Question'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  overallScoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  overallScoreContent: {
    alignItems: 'center',
  },
  overallScoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  overallScoreGrade: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  overallScoreMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  scoreCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreCardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  transcriptSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  transcriptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transcriptText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  feedbackSection: {
    marginBottom: 24,
  },
  feedbackCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  nextButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  correctionsSection: {
    marginBottom: 24,
  },
  correctionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  correctionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  correctionMistake: {
    fontSize: 16,
    color: '#dc2626',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  correctionArrow: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 8,
  },
  correctionFixed: {
    fontSize: 16,
    color: '#059669',
    fontWeight: 'bold',
  },
  correctionWord: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  correctionExplanation: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});