import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    left_items?: Array<{
      id: string | number;
      text: string;
    }>;
    right_items?: Array<{
      id: string | number;
      text: string;
    }>;
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: any;
  onAnswerChange?: (questionId: string | number, answer: any) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
};

export default function WordMatchingQuestion({
  question,
  testId,
  testType = 'word_matching',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const [leftItems, setLeftItems] = useState<any[]>([]);
  const [rightItems, setRightItems] = useState<any[]>([]);
  const [matches, setMatches] = useState<{[key: string]: string}>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      setLeftItems(question.left_items || []);
      setRightItems(question.right_items || []);
      
      if (studentId) {
        // Load saved answer for student mode
        const loadSavedAnswer = async () => {
          try {
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`);
            if (savedAnswer) {
              const parsed = JSON.parse(savedAnswer);
              setMatches(parsed || {});
            }
          } catch (e) {
            console.error('Failed to load saved answer:', e);
          }
        };
        loadSavedAnswer();
      }
    }
  }, [question, testId, testType, studentId]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setMatches(studentAnswer || {});
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    if (Object.keys(matches).length > 0 && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, JSON.stringify(matches));
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [matches, testId, testType, question?.id, studentId]);

  // Handle match creation
  const handleMatch = useCallback((leftId: string | number, rightId: string | number) => {
    const newMatches = {
      ...matches,
      [String(leftId)]: String(rightId)
    };
    setMatches(newMatches);
    if (onAnswerChange) {
      onAnswerChange(question.id, newMatches);
    }
  }, [matches, onAnswerChange, question.id]);

  // Handle match removal
  const handleUnmatch = useCallback((leftId: string | number) => {
    const newMatches = { ...matches };
    delete newMatches[String(leftId)];
    setMatches(newMatches);
    if (onAnswerChange) {
      onAnswerChange(question.id, newMatches);
    }
  }, [matches, onAnswerChange, question.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.questionNumber}>
          Question {typeof displayNumber === 'number' ? displayNumber : question?.id}
        </Text>
        <View style={styles.saveIndicator}>
          {isAutoSaving && (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          )}
          {lastSaved && !isAutoSaving && (
            <Text style={styles.savedText}>
              ✓ Saved at {lastSaved}
            </Text>
          )}
        </View>
      </View>
      
      <Text style={styles.questionText}>
        {question.question_text || 'Match the items in the left column with the correct items in the right column.'}
      </Text>
      
      <View style={styles.matchingContainer}>
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Left Column</Text>
          {leftItems.map((item, index) => (
            <TouchableOpacity
              key={item.id || `left-${index}`}
              style={[
                styles.item,
                matches[String(item.id)] ? styles.matchedItem : null
              ]}
              onPress={() => {
                if (matches[String(item.id)]) {
                  handleUnmatch(item.id);
                }
              }}
            >
              <Text style={styles.itemText}>{item.text}</Text>
              {matches[String(item.id)] && (
                <Text style={styles.matchIndicator}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Right Column</Text>
          {rightItems.map((item, index) => (
            <TouchableOpacity
              key={item.id || `right-${index}`}
              style={[
                styles.item,
                Object.values(matches).includes(String(item.id)) ? styles.matchedItem : null
              ]}
              onPress={() => {
                // Find which left item this right item is matched to
                const leftId = Object.keys(matches).find(key => matches[key] === String(item.id));
                if (leftId) {
                  handleUnmatch(leftId);
                } else {
                  // Find first unmatched left item
                  const unmatchedLeft = leftItems.find(left => !matches[String(left.id)]);
                  if (unmatchedLeft) {
                    handleMatch(unmatchedLeft.id, item.id);
                  } else {
                    Alert.alert('All items matched', 'All left items are already matched.');
                  }
                }
              }}
            >
              <Text style={styles.itemText}>{item.text}</Text>
              {Object.values(matches).includes(String(item.id)) && (
                <Text style={styles.matchIndicator}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          • Tap items to create matches between left and right columns
        </Text>
        <Text style={styles.instructionText}>
          • Tap matched items to remove the match
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  savedText: {
    fontSize: 12,
    color: '#10b981',
  },
  questionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
  },
  matchingContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchedItem: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  itemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  matchIndicator: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  instructions: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 4,
  },
});