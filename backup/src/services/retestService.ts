import { apiClient } from './apiClient';

export interface RetestAssignment {
  id: string;
  test_id: string;
  test_title: string;
  subject: string;
  teacher_name: string;
  assigned_at: string;
  due_date: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  max_attempts: number;
  current_attempt: number;
  cooldown_period: number; // hours
  last_attempt?: string;
  next_available?: string;
}

export interface RetestEligibility {
  eligible: boolean;
  reason?: string;
  retake_count: number;
  max_retakes: number;
  last_attempt?: string;
  cooldown_period?: number;
  next_available?: string;
  requirements: Array<{
    requirement: string;
    met: boolean;
    details?: string;
  }>;
}

export interface RetestRequest {
  test_id: string;
  reason: string;
  additional_info?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface RetestResponse {
  success: boolean;
  assignment_id?: string;
  message: string;
  next_available?: string;
}

export interface RetestHistory {
  test_id: string;
  test_title: string;
  attempts: Array<{
    attempt_number: number;
    score: number;
    percentage: number;
    submitted_at: string;
    status: 'passed' | 'failed' | 'incomplete';
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

export interface RetestStatistics {
  total_retests: number;
  successful_retests: number;
  failed_retests: number;
  average_improvement: number;
  best_improvement: number;
  retest_success_rate: number;
  subject_breakdown: Array<{
    subject: string;
    retest_count: number;
    success_rate: number;
    average_improvement: number;
  }>;
}

class RetestService {
  private baseUrl = '/api/retests';

  // Check retest eligibility for a test
  async checkEligibility(testId: string): Promise<RetestEligibility> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/eligibility/${testId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to check retest eligibility:', error);
      throw error;
    }
  }

  // Request a retest
  async requestRetest(request: RetestRequest): Promise<RetestResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/request`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to request retest:', error);
      throw error;
    }
  }

  // Get retest assignments
  async getRetestAssignments(filters?: {
    status?: string;
    subject?: string;
    due_date_from?: string;
    due_date_to?: string;
  }): Promise<RetestAssignment[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/assignments`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest assignments:', error);
      throw error;
    }
  }

  // Get retest assignment by ID
  async getRetestAssignment(assignmentId: string): Promise<RetestAssignment> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/assignments/${assignmentId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest assignment:', error);
      throw error;
    }
  }

  // Start retest
  async startRetest(assignmentId: string): Promise<{
    success: boolean;
    test_session_id?: string;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/assignments/${assignmentId}/start`);
      return response.data;
    } catch (error) {
      console.error('Failed to start retest:', error);
      throw error;
    }
  }

  // Submit retest
  async submitRetest(assignmentId: string, answers: Record<string, any>): Promise<{
    success: boolean;
    result_id?: string;
    score?: number;
    percentage?: number;
    passed?: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/assignments/${assignmentId}/submit`, {
        answers,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to submit retest:', error);
      throw error;
    }
  }

  // Get retest history
  async getRetestHistory(filters?: {
    test_id?: string;
    subject?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<RetestHistory[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/history`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest history:', error);
      throw error;
    }
  }

  // Get retest statistics
  async getRetestStatistics(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<RetestStatistics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/statistics`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest statistics:', error);
      throw error;
    }
  }

  // Cancel retest request
  async cancelRetestRequest(assignmentId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/assignments/${assignmentId}`, {
        data: { reason },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to cancel retest request:', error);
      throw error;
    }
  }

  // Get retest progress
  async getRetestProgress(assignmentId: string): Promise<{
    assignment: RetestAssignment;
    progress: {
      questions_answered: number;
      total_questions: number;
      time_spent: number;
      last_activity: string;
    };
    previous_attempts: Array<{
      attempt_number: number;
      score: number;
      percentage: number;
      submitted_at: string;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/assignments/${assignmentId}/progress`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest progress:', error);
      throw error;
    }
  }

  // Get retest recommendations
  async getRetestRecommendations(testId: string): Promise<{
    recommended: boolean;
    reason: string;
    suggestions: string[];
    study_materials: Array<{
      type: string;
      title: string;
      url: string;
      description: string;
    }>;
    practice_tests: Array<{
      test_id: string;
      test_title: string;
      difficulty: 'easy' | 'medium' | 'hard';
      estimated_time: number;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/recommendations/${testId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest recommendations:', error);
      throw error;
    }
  }

  // Get retest calendar
  async getRetestCalendar(filters?: {
    month?: string;
    year?: string;
    subject?: string;
  }): Promise<Array<{
    date: string;
    assignments: Array<{
      id: string;
      test_title: string;
      subject: string;
      due_time: string;
      status: string;
    }>;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/calendar`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest calendar:', error);
      throw error;
    }
  }

  // Get retest notifications
  async getRetestNotifications(): Promise<Array<{
    id: string;
    type: 'assignment' | 'reminder' | 'deadline' | 'completion';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    action_url?: string;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/notifications`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest notifications:', error);
      throw error;
    }
  }

  // Mark retest notification as read
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark retest notification as read:', error);
      throw error;
    }
  }

  // Get retest leaderboard
  async getRetestLeaderboard(filters?: {
    subject?: string;
    period?: 'week' | 'month' | 'semester' | 'year';
    limit?: number;
  }): Promise<Array<{
    rank: number;
    student_name: string;
    improvement: number;
    retest_count: number;
    success_rate: number;
    best_score: number;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/leaderboard`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch retest leaderboard:', error);
      throw error;
    }
  }
}

export const retestService = new RetestService();
