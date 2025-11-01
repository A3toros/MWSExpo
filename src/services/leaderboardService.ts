import { api } from './apiClient';
import { LeaderboardEntry } from '../types';

export const leaderboardService = {
  async getClassLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      console.log('📊 Fetching class leaderboard from: /api/get-class-leaderboard');
      const response = await api.get<{
        success: boolean;
        leaderboard: LeaderboardEntry[];
      }>('/api/get-class-leaderboard');
      
      console.log('📊 Leaderboard response:', {
        success: response.data.success,
        leaderboardLength: response.data.leaderboard?.length || 0
      });
      
      if (response.data.success && response.data.leaderboard) {
        return response.data.leaderboard;
      }
      
      console.warn('📊 Leaderboard response missing data:', response.data);
      throw new Error('Failed to fetch leaderboard: Invalid response');
    } catch (error: any) {
      console.error('📊 Error fetching class leaderboard:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        fullError: error
      });
      
      if (error.response) {
        const errorMessage = 
          error.response.data?.error || 
          error.response.data?.message || 
          `HTTP ${error.response.status}: ${error.response.statusText || 'Failed to fetch leaderboard'}`;
        throw new Error(errorMessage);
      }
      
      throw new Error(error.message || 'Failed to fetch leaderboard');
    }
  },
};

