import { apiClient } from './apiClient';

export interface PerformanceMetrics {
  overall_score: number;
  tests_taken: number;
  tests_passed: number;
  tests_failed: number;
  average_time_per_test: number;
  improvement_rate: number;
  consistency_score: number;
  subject_breakdown: Array<{
    subject: string;
    score: number;
    tests_taken: number;
    improvement: number;
  }>;
}

export interface PerformanceTrend {
  period: string;
  score: number;
  tests_taken: number;
  improvement: number;
  rank?: number;
}

export interface PerformanceInsights {
  strengths: Array<{
    area: string;
    score: number;
    description: string;
  }>;
  weaknesses: Array<{
    area: string;
    score: number;
    description: string;
    recommendations: string[];
  }>;
  recommendations: Array<{
    type: 'study' | 'practice' | 'review' | 'retest';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    resources: string[];
  }>;
  goals: Array<{
    goal: string;
    current_progress: number;
    target: number;
    deadline: string;
    status: 'on_track' | 'behind' | 'completed';
  }>;
}

export interface PerformanceComparison {
  student_performance: PerformanceMetrics;
  class_average: PerformanceMetrics;
  school_average: PerformanceMetrics;
  percentile_rank: number;
  comparison_insights: Array<{
    metric: string;
    student_value: number;
    average_value: number;
    difference: number;
    status: 'above' | 'below' | 'equal';
  }>;
}

export interface PerformancePrediction {
  predicted_score: number;
  confidence_level: number;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  recommendations: Array<{
    action: string;
    expected_improvement: number;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface PerformanceAnalytics {
  current_performance: PerformanceMetrics;
  historical_trends: PerformanceTrend[];
  insights: PerformanceInsights;
  comparison: PerformanceComparison;
  prediction: PerformancePrediction;
  benchmarks: Array<{
    benchmark: string;
    value: number;
    student_value: number;
    status: 'met' | 'exceeded' | 'below';
  }>;
}

class PerformanceService {
  private baseUrl = '/api/performance';

  // Get overall performance metrics
  async getPerformanceMetrics(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<PerformanceMetrics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/metrics`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      throw error;
    }
  }

  // Get performance trends
  async getPerformanceTrends(filters?: {
    period: 'week' | 'month' | 'semester' | 'year';
    subject?: string;
    limit?: number;
  }): Promise<PerformanceTrend[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/trends`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance trends:', error);
      throw error;
    }
  }

  // Get performance insights
  async getPerformanceInsights(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<PerformanceInsights> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/insights`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance insights:', error);
      throw error;
    }
  }

  // Get performance comparison
  async getPerformanceComparison(filters?: {
    comparison_type: 'class' | 'school' | 'district' | 'national';
    subject?: string;
    period?: 'week' | 'month' | 'semester' | 'year';
  }): Promise<PerformanceComparison> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/comparison`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance comparison:', error);
      throw error;
    }
  }

  // Get performance prediction
  async getPerformancePrediction(filters?: {
    test_id?: string;
    subject?: string;
    time_horizon?: 'short' | 'medium' | 'long';
  }): Promise<PerformancePrediction> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/prediction`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance prediction:', error);
      throw error;
    }
  }

  // Get comprehensive performance analytics
  async getPerformanceAnalytics(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
    include_comparison?: boolean;
    include_prediction?: boolean;
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

  // Get performance dashboard
  async getPerformanceDashboard(): Promise<{
    current_performance: PerformanceMetrics;
    recent_trends: PerformanceTrend[];
    key_insights: PerformanceInsights;
    upcoming_goals: Array<{
      goal: string;
      progress: number;
      deadline: string;
    }>;
    recommendations: Array<{
      type: string;
      title: string;
      priority: string;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/dashboard`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance dashboard:', error);
      throw error;
    }
  }

  // Get performance by question type
  async getPerformanceByQuestionType(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<Array<{
    question_type: string;
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
    improvement_trend: 'up' | 'down' | 'stable';
    recommendations: string[];
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/question-types`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance by question type:', error);
      throw error;
    }
  }

  // Get performance by difficulty
  async getPerformanceByDifficulty(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<Array<{
    difficulty: 'easy' | 'medium' | 'hard';
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
    improvement_trend: 'up' | 'down' | 'stable';
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/difficulty`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance by difficulty:', error);
      throw error;
    }
  }

  // Get performance goals
  async getPerformanceGoals(): Promise<Array<{
    id: string;
    goal: string;
    target_value: number;
    current_value: number;
    progress_percentage: number;
    deadline: string;
    status: 'active' | 'completed' | 'overdue';
    category: 'score' | 'consistency' | 'improvement' | 'time';
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/goals`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance goals:', error);
      throw error;
    }
  }

  // Set performance goals
  async setPerformanceGoals(goals: Array<{
    goal: string;
    target_value: number;
    deadline: string;
    category: 'score' | 'consistency' | 'improvement' | 'time';
  }>): Promise<{
    success: boolean;
    created_goals: number;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/goals`, { goals });
      return response.data;
    } catch (error) {
      console.error('Failed to set performance goals:', error);
      throw error;
    }
  }

  // Update performance goals
  async updatePerformanceGoals(goalId: string, updates: {
    target_value?: number;
    deadline?: string;
    status?: 'active' | 'completed' | 'overdue';
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/goals/${goalId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update performance goals:', error);
      throw error;
    }
  }

  // Get performance milestones
  async getPerformanceMilestones(): Promise<Array<{
    id: string;
    milestone: string;
    description: string;
    achieved_at: string;
    category: 'score' | 'consistency' | 'improvement' | 'time' | 'streak';
    value: number;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/milestones`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance milestones:', error);
      throw error;
    }
  }

  // Get performance reports
  async getPerformanceReports(filters?: {
    report_type: 'summary' | 'detailed' | 'comparative';
    from_date?: string;
    to_date?: string;
    subject?: string;
    format?: 'json' | 'pdf' | 'csv';
  }): Promise<{
    report_url: string;
    expires_at: string;
    report_type: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/reports`, filters);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance reports:', error);
      throw error;
    }
  }
}

export const performanceService = new PerformanceService();
