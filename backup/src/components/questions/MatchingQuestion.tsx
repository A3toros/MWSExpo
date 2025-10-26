import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    image_url?: string;
    blocks?: Array<{
      id: string | number;
      coordinates: { x: number; y: number; width: number; height: number };
      word?: string;
    }>;
    words?: Array<{
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

export default function MatchingQuestion({
  question,
  testId,
  testType = 'matching',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [placedWords, setPlacedWords] = useState<{[key: string]: string}>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      // Parse blocks and words from question data
      const questionBlocks = question.blocks || [];
      const questionWords = question.words || [];
      
      setBlocks(questionBlocks);
      setWords(questionWords);
      
      if (studentId) {
        // Load saved answer for student mode
        const loadSavedAnswer = async () => {
          try {
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`);
            if (savedAnswer) {
              const parsed = JSON.parse(savedAnswer);
              setPlacedWords(parsed || {});
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
      setPlacedWords(studentAnswer || {});
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    if (Object.keys(placedWords).length > 0 && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, JSON.stringify(placedWords));
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [placedWords, testId, testType, question?.id, studentId]);

  // Handle word placement
  const handleWordTap = useCallback((wordId: string | number) => {
    const wordText = words.find(w => w.id === wordId)?.text || '';
    
    // Find first empty block
    const emptyBlock = blocks.find(block => !placedWords[String(block.id)]);
    if (emptyBlock) {
      const newPlacedWords = {
        ...placedWords,
        [String(emptyBlock.id)]: wordText
      };
      setPlacedWords(newPlacedWords);
      if (onAnswerChange) {
        onAnswerChange(question.id, newPlacedWords);
      }
    } else {
      Alert.alert('All blocks filled', 'All blocks already have words placed.');
    }
  }, [blocks, placedWords, words, onAnswerChange, question.id]);

  // Handle word removal from block
  const handleBlockTap = useCallback((blockId: string | number) => {
    if (placedWords[String(blockId)]) {
      const newPlacedWords = { ...placedWords };
      delete newPlacedWords[String(blockId)];
      setPlacedWords(newPlacedWords);
      if (onAnswerChange) {
        onAnswerChange(question.id, newPlacedWords);
      }
    }
  }, [placedWords, onAnswerChange, question.id]);

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
        {question.question_text || 'Match the words to the correct positions on the image.'}
      </Text>
      
      {question.image_url && (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: question.image_url }} 
            style={styles.image}
            resizeMode="contain"
          />
          {/* Render blocks as overlays */}
          {blocks.map((block, index) => (
            <TouchableOpacity
              key={block.id || `block-${index}`}
              style={[
                styles.block,
                {
                  left: block.coordinates?.x || 0,
                  top: block.coordinates?.y || 0,
                  width: block.coordinates?.width || 100,
                  height: block.coordinates?.height || 50,
                }
              ]}
              onPress={() => handleBlockTap(block.id)}
            >
              <Text style={styles.blockText}>
                {placedWords[String(block.id)] || 'Tap to place word'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Word bank */}
      <View style={styles.wordBank}>
        <Text style={styles.wordBankTitle}>Word Bank:</Text>
        <View style={styles.wordsContainer}>
          {words.map((word, index) => (
            <TouchableOpacity
              key={word.id || `word-${index}`}
              style={styles.wordButton}
              onPress={() => handleWordTap(word.id)}
            >
              <Text style={styles.wordText}>{word.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          • Tap a word to place it in the first available block
        </Text>
        <Text style={styles.instructionText}>
          • Tap a block to remove the placed word
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
  imageContainer: {
    position: 'relative',
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 300,
  },
  block: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 30,
  },
  blockText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
    textAlign: 'center',
    padding: 4,
  },
  wordBank: {
    marginBottom: 16,
  },
  wordBankTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wordText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
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