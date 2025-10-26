import { apiClient } from './apiClient';
import { Student, UserProfile, Notification } from '../contexts/UserContext';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: Student;
  expires_in: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  auto_save: boolean;
  show_hints: boolean;
  language: string;
  timezone: string;
}

export interface UserStatistics {
  total_tests_taken: number;
  average_score: number;
  tests_passed: number;
  tests_failed: number;
  current_streak: number;
  best_streak: number;
  total_time_spent: number;
  favorite_subjects: string[];
  improvement_rate: number;
}

export interface AcademicInfo {
  current_term: string;
  current_period: string;
  academic_year: string;
  subjects: Array<{
    id: string;
    name: string;
    teacher: string;
    grade: string;
    schedule: Array<{
      day: string;
      time: string;
    }>;
  }>;
}

class UserService {
  private baseUrl = '/api/user';

  // Login user
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/login`, credentials);
      return response.data;
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/logout`);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/refresh`, {
        refresh_token: refreshToken,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  // Get user profile
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/profile`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/profile`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  // Update user preferences
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/preferences`, preferences);
      return response.data;
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }

  // Get user statistics
  async getStatistics(filters?: {
    from_date?: string;
    to_date?: string;
    subject?: string;
  }): Promise<UserStatistics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/statistics`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user statistics:', error);
      throw error;
    }
  }

  // Get academic information
  async getAcademicInfo(): Promise<AcademicInfo> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/academic-info`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch academic info:', error);
      throw error;
    }
  }

  // Get notifications
  async getNotifications(filters?: {
    unread_only?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/notifications`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsRead(): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/notifications/read-all`);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Clear notifications
  async clearNotifications(): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/notifications`);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      throw error;
    }
  }

  // Get user activity log
  async getActivityLog(filters?: {
    from_date?: string;
    to_date?: string;
    activity_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<{
    id: string;
    activity_type: string;
    description: string;
    timestamp: string;
    metadata?: any;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/activity-log`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
      throw error;
    }
  }

  // Update user settings
  async updateSettings(settings: {
    privacy?: {
      show_profile: boolean;
      show_statistics: boolean;
      allow_analytics: boolean;
    };
    notifications?: {
      email_notifications: boolean;
      push_notifications: boolean;
      test_reminders: boolean;
      result_notifications: boolean;
    };
    accessibility?: {
      high_contrast: boolean;
      large_text: boolean;
      screen_reader: boolean;
    };
  }): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/settings`, settings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  // Get user achievements
  async getAchievements(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked_at: string;
    progress?: number;
    max_progress?: number;
  }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/achievements`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
      throw error;
    }
  }

  // Get user leaderboard position
  async getLeaderboardPosition(filters?: {
    subject?: string;
    time_period?: 'week' | 'month' | 'semester' | 'year';
  }): Promise<{
    position: number;
    total_students: number;
    percentile: number;
    score: number;
    top_performers: Array<{
      rank: number;
      student_name: string;
      score: number;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/leaderboard`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch leaderboard position:', error);
      throw error;
    }
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/request-password-reset`, {
        email,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to request password reset:', error);
      throw error;
    }
  }

  // Verify email
  async verifyEmail(token: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/verify-email`, {
        token,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to verify email:', error);
      throw error;
    }
  }

  // Get user dashboard data
  async getDashboardData(): Promise<{
    active_tests: number;
    upcoming_tests: number;
    recent_results: Array<{
      test_name: string;
      score: number;
      max_score: number;
      percentage: number;
      submitted_at: string;
    }>;
    notifications: Notification[];
    statistics: UserStatistics;
    achievements: Array<{
      id: string;
      name: string;
      unlocked_at: string;
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/dashboard`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
