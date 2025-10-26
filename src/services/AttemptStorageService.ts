import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttemptData } from '../contexts/SpeakingTestContext';

export class AttemptStorageService {
  /**
   * Save attempt to AsyncStorage (like web app's localStorage)
   */
  static async saveAttempt(
    studentId: string,
    testId: string,
    attemptData: AttemptData
  ): Promise<void> {
    try {
      const attemptsKey = `speaking_attempts_${studentId}_${testId}`;
      const attemptHistoryKey = `speaking_attempt_history_${studentId}_${testId}`;
      
      // Save current attempt number
      await AsyncStorage.setItem(attemptsKey, attemptData.attemptNumber.toString());
      
      // Get existing attempts
      const existingAttempts = await this.getAttemptHistory(studentId, testId);
      const updatedAttempts = [...existingAttempts, attemptData];
      
      // Save updated attempt history
      await AsyncStorage.setItem(attemptHistoryKey, JSON.stringify(updatedAttempts));
      
      console.log('💾 Saved attempt to AsyncStorage:', {
        studentId,
        testId,
        attemptNumber: attemptData.attemptNumber,
        totalAttempts: updatedAttempts.length
      });
    } catch (error) {
      console.error('Failed to save attempt to AsyncStorage:', error);
      throw new Error('Failed to save attempt');
    }
  }

  /**
   * Get attempt history from AsyncStorage
   */
  static async getAttemptHistory(
    studentId: string,
    testId: string
  ): Promise<AttemptData[]> {
    try {
      const attemptHistoryKey = `speaking_attempt_history_${studentId}_${testId}`;
      const stored = await AsyncStorage.getItem(attemptHistoryKey);
      
      if (stored) {
        const attempts = JSON.parse(stored);
        console.log('💾 Loaded attempt history from AsyncStorage:', attempts);
        return attempts;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to load attempt history from AsyncStorage:', error);
      return [];
    }
  }

  /**
   * Get current attempt number from AsyncStorage
   */
  static async getCurrentAttemptNumber(
    studentId: string,
    testId: string
  ): Promise<number> {
    try {
      const attemptsKey = `speaking_attempts_${studentId}_${testId}`;
      const stored = await AsyncStorage.getItem(attemptsKey);
      
      if (stored) {
        const attemptNumber = parseInt(stored, 10);
        console.log('💾 Loaded current attempt number:', attemptNumber);
        return attemptNumber;
      }
      
      return 1; // Default to first attempt
    } catch (error) {
      console.error('Failed to load current attempt number:', error);
      return 1;
    }
  }

  /**
   * Clear all attempts for a test (for retests)
   */
  static async clearAttempts(
    studentId: string,
    testId: string
  ): Promise<void> {
    try {
      const attemptsKey = `speaking_attempts_${studentId}_${testId}`;
      const attemptHistoryKey = `speaking_attempt_history_${studentId}_${testId}`;
      
      await AsyncStorage.removeItem(attemptsKey);
      await AsyncStorage.removeItem(attemptHistoryKey);
      
      console.log('🧹 Cleared attempts from AsyncStorage:', { studentId, testId });
    } catch (error) {
      console.error('Failed to clear attempts:', error);
    }
  }

  /**
   * Save speaking test data to cache (like web app)
   */
  static async saveSpeakingTestData(
    studentId: string,
    testId: string,
    data: {
      audioUri: string;
      transcript: string;
      analysis: any;
      feedback: any;
      currentStep: string;
      timestamp: number;
    }
  ): Promise<void> {
    try {
      const cacheKey = `speaking_test_data_${studentId}_${testId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      console.log('💾 Saved speaking test data to cache:', cacheKey);
    } catch (error) {
      console.error('Failed to save speaking test data to cache:', error);
    }
  }

  /**
   * Load speaking test data from cache
   */
  static async loadSpeakingTestData(
    studentId: string,
    testId: string
  ): Promise<any | null> {
    try {
      const cacheKey = `speaking_test_data_${studentId}_${testId}`;
      const stored = await AsyncStorage.getItem(cacheKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        console.log('💾 Loaded speaking test data from cache:', data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load speaking test data from cache:', error);
      return null;
    }
  }

  /**
   * Clear speaking test data from cache
   */
  static async clearSpeakingTestData(
    studentId: string,
    testId: string
  ): Promise<void> {
    try {
      const cacheKey = `speaking_test_data_${studentId}_${testId}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log('🧹 Cleared speaking test data from cache:', cacheKey);
    } catch (error) {
      console.error('Failed to clear speaking test data from cache:', error);
    }
  }
}

export default AttemptStorageService;
