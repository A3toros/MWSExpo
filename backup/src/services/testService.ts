import { apiClient } from './apiClient';
import { Test, TestQuestion, TestResult } from '../types';

export interface TestFilters {
  subject?: string;
  test_type?: string;
  is_active?: boolean;
  due_date_from?: string;
  due_date_to?: string;
}

export interface TestSubmission {
  test_id: string;
  answers: Record<string, any>;
  time_spent: number;
  submitted_at: string;
  device_info?: any;
  cheating_events?: any[];
}

export interface TestPerformance {
  test_id: string;
  student_id: string;
  score: number;
  max_score: number;
  percentage: number;
  time_spent: number;
  question_analysis: Array<{
    question_id: string;
    correct: boolean;
    points_earned: number;
    points_possible: number;
    time_spent: number;
  }>;
  cheating_events: any[];
  submitted_at: string;
}

class TestService {
  private baseUrl = '/api/tests';

  // Get active tests for student
  async getActiveTests(filters?: TestFilters): Promise<Test[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/active`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch active tests:', error);
      throw error;
    }
  }

  // Get test by ID
  async getTestById(testId: string): Promise<Test> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test:', error);
      throw error;
    }
  }

  // Get test questions
  async getTestQuestions(testId: string): Promise<TestQuestion[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}/questions`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test questions:', error);
      throw error;
    }
  }

  // Submit test
  async submitTest(submission: TestSubmission): Promise<TestResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/submit`, submission);
      return response.data;
    } catch (error) {
      console.error('Failed to submit test:', error);
      throw error;
    }
  }

  // Save test progress
  async saveTestProgress(testId: string, progress: {
    current_question_index: number;
    answers: Record<string, any>;
    time_spent: number;
  }): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/${testId}/progress`, progress);
    } catch (error) {
      console.error('Failed to save test progress:', error);
      throw error;
    }
  }

  // Get test results for student
  async getTestResults(filters?: {
    test_id?: string;
    subject?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/results`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test results:', error);
      throw error;
    }
  }

  // Get test result by ID
  async getTestResult(resultId: string): Promise<TestResult> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/results/${resultId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test result:', error);
      throw error;
    }
  }

  // Get test performance analytics
  async getTestPerformance(testId: string): Promise<TestPerformance> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}/performance`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test performance:', error);
      throw error;
    }
  }

  // Get student performance summary
  async getStudentPerformance(filters?: {
    subject?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<{
    total_tests: number;
    average_score: number;
    tests_passed: number;
    tests_failed: number;
    best_score: number;
    worst_score: number;
    improvement_trend: 'up' | 'down' | 'stable';
    subject_performance: Array<{
      subject: string;
      average_score: number;
      tests_taken: number;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/performance`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch student performance:', error);
      throw error;
    }
  }

  // Check if test is available for retake
  async checkRetestEligibility(testId: string): Promise<{
    eligible: boolean;
    reason?: string;
    retake_count: number;
    max_retakes: number;
    last_attempt?: string;
    cooldown_period?: number;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}/retest-eligibility`);
      return response.data;
    } catch (error) {
      console.error('Failed to check retest eligibility:', error);
      throw error;
    }
  }

  // Request retest
  async requestRetest(testId: string, reason?: string): Promise<{
    success: boolean;
    retest_assignment_id?: string;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${testId}/request-retest`, {
        reason,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to request retest:', error);
      throw error;
    }
  }

  // Get retest assignments
  async getRetestAssignments(): Promise<Array<{
    id: string;
    test_id: string;
    test_title: string;
    subject: string;
    assigned_at: string;
    due_date: string;
    reason: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/retest-assignments`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest assignments:', error);
      throw error;
    }
  }

  // Get test statistics
  async getTestStatistics(testId: string): Promise<{
    total_questions: number;
    total_points: number;
    time_limit?: number;
    difficulty_level: 'easy' | 'medium' | 'hard';
    average_completion_time: number;
    pass_rate: number;
    question_types: Array<{
      type: string;
      count: number;
      points: number;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test statistics:', error);
      throw error;
    }
  }

  // Validate test answers
  async validateAnswers(testId: string, answers: Record<string, any>): Promise<{
    valid: boolean;
    errors: Array<{
      question_id: string;
      error: string;
    }>;
    warnings: Array<{
      question_id: string;
      warning: string;
    }>;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${testId}/validate`, {
        answers,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to validate answers:', error);
      throw error;
    }
  }

  // Get test hints (if available)
  async getTestHints(testId: string, questionId: string): Promise<{
    hints: string[];
    hint_count: number;
    max_hints: number;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${testId}/questions/${questionId}/hints`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch test hints:', error);
      throw error;
    }
  }

  // Use hint
  async useHint(testId: string, questionId: string): Promise<{
    hint: string;
    remaining_hints: number;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${testId}/questions/${questionId}/use-hint`);
      return response.data;
    } catch (error) {
      console.error('Failed to use hint:', error);
      throw error;
    }
  }
}

export const testService = new TestService();
