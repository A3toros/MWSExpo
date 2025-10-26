import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod, uploadSpeakingAudio } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';

export default function SpeakingTestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seeded random number generator (mulberry32) - copy web app exactly
  const mulberry32 = (a: number) => {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };

  // Function to select a random question deterministically - copy web app exactly
  const selectRandomQuestion = (questions: any[], testId: string, studentId: string) => {
    // If only one question, return it
    if (questions.length === 1) {
      return questions[0];
    }
    
    // Create deterministic seed from student ID and test ID
    const seedStr = `${studentId}:speaking:${testId}`;
    const seed = Array.from(seedStr).reduce((acc, c) => 
      ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
    
    // Use seeded RNG for consistent selection
    const rng = mulberry32(seed);
    const randomIndex = Math.floor(rng() * questions.length);
    
    return questions[randomIndex];
  };

  // Check if test is already completed (web app pattern)
  const checkTestCompleted = useCallback(async () => {
    const sid = user?.student_id || studentId;
    if (!sid || !testId) return false;
    
    try {
      const completionKey = `test_completed_${sid}_speaking_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${sid}_speaking_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      if (isCompleted === 'true' && hasRetest !== 'true') {
        Alert.alert('Test Completed', 'This test has already been completed', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error checking test completion:', e);
      return false;
    }
  }, [user?.student_id, studentId, testId]);

  // Load test data
  const loadTestData = useCallback(async () => {
    if (!testId) {
      setError('Test ID is required');
      setLoading(false);
      return;
    }

    if (await checkTestCompleted()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Ensure studentId is available (fallback to AsyncStorage)
      try {
        if (!user?.student_id) {
          const raw = await AsyncStorage.getItem('user');
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.student_id) setStudentId(String(parsed.student_id));
        } else {
          setStudentId(String(user.student_id));
        }
      } catch {}

      // Load test data - copy web app exactly
      const testResponse = await api.get('/api/get-speaking-test-new', { 
        params: { action: 'test', test_id: testId } 
      });

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || testResponse.data.message || 'Failed to load speaking test');
      }

      const test = testResponse.data.test || testResponse.data.data;
      setTestData(test);
      
      // Load questions - copy web app exactly
      const questionsResponse = await api.get('/api/get-speaking-test-new', {
        params: { action: 'questions', test_id: testId }
      });

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load test questions');
      }

      const questionsData = questionsResponse.data.questions || [];
      setQuestions(questionsData);

      // Select question: prefer deterministic if we have a student id; otherwise first item.
      const sid = user?.student_id || studentId || 'unknown';
      if (questionsData.length > 0) {
        const randomQuestion = user?.student_id || studentId
          ? selectRandomQuestion(questionsData, testId, String(sid))
          : questionsData[0];
        setSelectedQuestion(randomQuestion);
      } else if (test?.prompt) {
        // Web sometimes shows prompt even if questions endpoint empty; synthesize a single question
        setSelectedQuestion({ id: 1, prompt: test.prompt });
      }

    } catch (e: any) {
      console.error('Failed to load speaking test:', e?.message);
      setError('Failed to load test. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted, user?.student_id, studentId]);

  // Start recording (expo-av)
  const startRecording = useCallback(async () => {
    try {
      // Ask for microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Microphone permission is required to record audio.');
        return;
      }

      // Prepare audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('startRecording error', err);
      Alert.alert('Recording error', 'Failed to start recording.');
    }
  }, []);

  // Stop recording (expo-av)
  const stopRecording = useCallback(async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri || null);
      setRecording(null);
      setIsRecording(false);
    } catch (err) {
      console.error('stopRecording error', err);
      Alert.alert('Recording error', 'Failed to stop recording.');
    }
  }, [recording]);

  // Play recorded audio
  const playAudio = useCallback(async () => {
    try {
      if (!audioUri) return;
      // Unload previous sound if any
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(newSound);
      await newSound.playAsync();
    } catch (err) {
      console.error('playAudio error', err);
      Alert.alert('Playback error', 'Failed to play the recorded audio.');
    }
  }, [audioUri, sound]);

  // Submit test (web app pattern)
  const submitTest = useCallback(async () => {
    if (!audioUri) return;
    
    // Show confirmation dialog before submitting
    Alert.alert(
      'Submit Test',
      'Are you sure you want to submit your test? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: () => performSubmit() }
      ]
    );
  }, [audioUri, selectedQuestion, testData, user, testId]);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!audioUri) return;
    
    setIsSubmitting(true);
    try {
      // First upload audio and get URL from backend
      const uploadResp = await uploadSpeakingAudio(audioUri);
      const uploadedUrl = (uploadResp.data && (uploadResp.data.url || uploadResp.data.location || uploadResp.data.fileUrl)) || audioUri;

      // Submit to API using web app pattern
      const submissionData = {
        test_id: testId,
        test_name: testData?.test_name || `Speaking Test ${testId}`,
        test_type: 'speaking',
        teacher_id: testData?.teacher_id || null,
        subject_id: testData?.subject_id || null,
        student_id: user?.student_id,
        academic_period_id: await (async () => {
          await academicCalendarService.loadAcademicCalendar();
          const currentTerm = academicCalendarService.getCurrentTerm();
          return currentTerm?.id || 3;
        })(),
        answers: {
          audioUri: uploadedUrl,
          // transcript intentionally omitted until STT is implemented
          question_id: selectedQuestion?.id || 1
        },
        score: null, // Will be calculated by backend
        maxScore: 100,
        time_taken: 0,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: false,
        visibility_change_times: 0,
        is_completed: true,
        answers_by_id: {
          [selectedQuestion?.id || 1]: {
            audioUri: uploadedUrl,
          }
        },
        question_order: [selectedQuestion?.id || 1]
      };

      const submitMethod = getSubmissionMethod('speaking');
      const response = await submitMethod(submissionData);
      
      if (response.data.success) {
        // Mark test as completed (web app pattern)
        const completionKey = `test_completed_${user?.student_id}_speaking_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');

        // Clear retest key if it exists
        const retestKey = `retest1_${user?.student_id}_speaking_${testId}`;
        await AsyncStorage.removeItem(retestKey);

        // Clear retest assignment key if it exists
        const retestAssignKey = `retest_assignment_id_${user?.student_id}_speaking_${testId}`;
        await AsyncStorage.removeItem(retestAssignKey);
        
        // Store result for caching (web app pattern)
        await AsyncStorage.setItem(`speaking_test_result_${testId}`, JSON.stringify(response.data));
        
        setTestResults(response.data);
        setShowResults(true);
      } else {
        throw new Error(response.data.message || 'Failed to submit test');
      }
    } catch (e: any) {
      console.error('Failed to submit test:', e?.message);
      setError('Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [audioUri, testId, testData, user, selectedQuestion]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadTestData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults && testResults) {
    return (
      <View style={styles.container}>
        <Text style={styles.testTitle}>Test Results</Text>
        <Text style={styles.scoreText}>
          Score: {testResults.score || 0}/{testResults.maxScore || 1}
        </Text>
        <Text style={styles.percentageText}>
          Percentage: {testResults.percentage || 0}%
        </Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!testData || !selectedQuestion) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No test data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TestHeader 
        testName={testData.test_name}
      />
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.speakingTestRecording}>
        
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.promptText}>{testData.prompt || selectedQuestion.prompt}</Text>
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsText}>
              <Text style={styles.requirementsBold}>Requirements:</Text> Minimum {testData.min_words || 50} words, 
              0-{testData.max_duration || 600} seconds duration
            </Text>
          </View>
        </View>
        
        <View style={styles.recordingContainer}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordingButton
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.recordButtonText}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>
          
          {audioUri && (
            <View style={styles.audioContainer}>
              <Text style={styles.audioText}>Audio recorded successfully</Text>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => {
                  // TODO: Implement audio playback
                  console.log('Playing audio...');
                }}
              >
                <Text style={styles.playButtonText}>Play Audio</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {audioUri && (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={submitTest}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Text>
          </TouchableOpacity>
        )}
        
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flex: 1,
  },
  speakingTestRecording: {
    flex: 1,
    padding: 20,
  },
  testTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
  },
  instructionsContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  promptText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  requirementsBox: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  requirementsText: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
  },
  requirementsBold: {
    fontWeight: 'bold',
  },
  recordingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  recordButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 50,
    marginBottom: 20,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  audioContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  audioText: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 12,
  },
  playButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  percentageText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});