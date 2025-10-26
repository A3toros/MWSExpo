import { apiClient } from './apiClient';
import { TestResult } from '../types';

export interface ResultFilters {
  test_id?: string;
  subject?: string;
  from_date?: string;
  to_date?: string;
  passed_only?: boolean;
  failed_only?: boolean;
  min_score?: number;
  max_score?: number;
}

export interface ResultSummary {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  average_score: number;
  best_score: number;
  worst_score: number;
  total_time_spent: number;
  improvement_trend: 'up' | 'down' | 'stable';
}

export interface SubjectPerformance {
  subject: string;
  total_tests: number;
  average_score: number;
  best_score: number;
  worst_score: number;
  pass_rate: number;
  improvement_trend: 'up' | 'down' | 'stable';
  recent_results: TestResult[];
}

export interface PerformanceAnalytics {
  overall_performance: ResultSummary;
  subject_performance: SubjectPerformance[];
  monthly_trends: Array<{
    month: string;
    tests_taken: number;
    average_score: number;
    pass_rate: number;
  }>;
  question_type_performance: Array<{
    question_type: string;
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
  }>;
  time_analysis: {
    fastest_completion: number;
    slowest_completion: number;
    average_completion_time: number;
    time_distribution: Array<{
      range: string;
      count: number;
    }>;
  };
}

export interface ResultComparison {
  test_id: string;
  test_name: string;
  attempts: Array<{
    attempt_number: number;
    score: number;
    percentage: number;
    submitted_at: string;
    improvement: number;
  }>;
  best_attempt: {
    attempt_number: number;
    score: number;
    percentage: number;
    submitted_at: string;
  };
  improvement_summary: {
    total_improvement: number;
    average_improvement: number;
    consistent_improvement: boolean;
  };
}

class ResultService {
  private baseUrl = '/api/results';

  // Get all results for student
  async getResults(filters?: ResultFilters): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results:', error);
      throw error;
    }
  }

  // Get result by ID
  async getResultById(resultId: string): Promise<TestResult> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${resultId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch result:', error);
      throw error;
    }
  }

  // Get results summary
  async getResultsSummary(filters?: ResultFilters): Promise<ResultSummary> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/summary`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results summary:', error);
      throw error;
    }
  }

  // Get subject performance
  async getSubjectPerformance(subject?: string): Promise<SubjectPerformance[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/subject-performance`, {
        params: { subject },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch subject performance:', error);
      throw error;
    }
  }

  // Get performance analytics
  async getPerformanceAnalytics(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<PerformanceAnalytics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/analytics`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance analytics:', error);
      throw error;
    }
  }

  // Get result comparison for retests
  async getResultComparison(testId: string): Promise<ResultComparison> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/comparison/${testId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch result comparison:', error);
      throw error;
    }
  }

  // Get recent results
  async getRecentResults(limit: number = 10): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/recent`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch recent results:', error);
      throw error;
    }
  }

  // Get best results
  async getBestResults(limit: number = 10): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/best`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch best results:', error);
      throw error;
    }
  }

  // Get worst results
  async getWorstResults(limit: number = 10): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/worst`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch worst results:', error);
      throw error;
    }
  }

  // Get results by date range
  async getResultsByDateRange(
    startDate: string,
    endDate: string,
    filters?: Omit<ResultFilters, 'from_date' | 'to_date'>
  ): Promise<TestResult[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/date-range`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          ...filters,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results by date range:', error);
      throw error;
    }
  }

  // Get results statistics
  async getResultsStatistics(filters?: ResultFilters): Promise<{
    total_tests: number;
    average_score: number;
    median_score: number;
    standard_deviation: number;
    score_distribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    pass_rate: number;
    fail_rate: number;
    improvement_rate: number;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/statistics`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results statistics:', error);
      throw error;
    }
  }

  // Get results trends
  async getResultsTrends(filters?: {
    period: 'week' | 'month' | 'semester' | 'year';
    subject?: string;
  }): Promise<Array<{
    period: string;
    tests_taken: number;
    average_score: number;
    pass_rate: number;
    improvement: number;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/trends`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results trends:', error);
      throw error;
    }
  }

  // Get results leaderboard
  async getResultsLeaderboard(filters?: {
    subject?: string;
    period?: 'week' | 'month' | 'semester' | 'year';
    limit?: number;
  }): Promise<Array<{
    rank: number;
    student_name: string;
    score: number;
    percentage: number;
    test_name: string;
    submitted_at: string;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/leaderboard`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch results leaderboard:', error);
      throw error;
    }
  }

  // Export results
  async exportResults(
    format: 'csv' | 'pdf' | 'excel',
    filters?: ResultFilters
  ): Promise<{
    download_url: string;
    expires_at: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/export`, {
        format,
        filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export results:', error);
      throw error;
    }
  }

  // Get result insights
  async getResultInsights(resultId: string): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    similar_questions: Array<{
      question_id: string;
      question_text: string;
      difficulty: 'easy' | 'medium' | 'hard';
      success_rate: number;
    }>;
    study_suggestions: Array<{
      topic: string;
      resources: string[];
      practice_tests: string[];
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${resultId}/insights`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch result insights:', error);
      throw error;
    }
  }

  // Get result feedback
  async getResultFeedback(resultId: string): Promise<{
    teacher_feedback?: string;
    ai_feedback: string;
    improvement_suggestions: string[];
    next_steps: string[];
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${resultId}/feedback`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch result feedback:', error);
      throw error;
    }
  }
}

export const resultService = new ResultService();
