import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Student {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  student_id: string;
  grade: string;
  class: string;
  subjects: string[];
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface UserProfile {
  student: Student;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    auto_save: boolean;
    show_hints: boolean;
  };
  statistics: {
    total_tests_taken: number;
    average_score: number;
    tests_passed: number;
    tests_failed: number;
    current_streak: number;
    best_streak: number;
  };
  academic_info: {
    current_term: string;
    current_period: string;
    academic_year: string;
    subjects: Array<{
      id: string;
      name: string;
      teacher: string;
      grade: string;
    }>;
  };
}

export interface Notification {
  id: string;
  type: 'test_assigned' | 'test_due' | 'result_available' | 'retest_available' | 'system';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: any;
}

// State interface
interface UserState {
  profile: UserProfile | null;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  lastSync: string | null;
  isOnline: boolean;
}

// Action types
type UserAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SET_LAST_SYNC'; payload: string }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'UPDATE_STATISTICS'; payload: Partial<UserProfile['statistics']> }
  | { type: 'LOGOUT' };

// Initial state
const initialState: UserState = {
  profile: null,
  notifications: [],
  loading: false,
  error: null,
  lastSync: null,
  isOnline: true,
};

// Reducer
function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_PROFILE':
      return { ...state, profile: action.payload, loading: false };
    
    case 'UPDATE_PROFILE':
      return {
        ...state,
        profile: state.profile ? { ...state.profile, ...action.payload } : null,
      };
    
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
      };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, read: true }
            : notification
        ),
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    
    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload };
    
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    
    case 'UPDATE_STATISTICS':
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          statistics: { ...state.profile.statistics, ...action.payload },
        },
      };
    
    case 'LOGOUT':
      return initialState;
    
    default:
      return state;
  }
}

// Context
const UserContext = createContext<{
  state: UserState;
  dispatch: React.Dispatch<UserAction>;
  // Actions
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  updateStatistics: (stats: Partial<UserProfile['statistics']>) => void;
  logout: () => void;
} | null>(null);

// Provider component
export function UserProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // Load user profile from storage on mount
  useEffect(() => {
    const loadStoredProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem('userProfile');
        if (stored) {
          const profile = JSON.parse(stored);
          dispatch({ type: 'SET_PROFILE', payload: profile });
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };
    loadStoredProfile();
  }, []);

  // Save profile to storage whenever it changes
  useEffect(() => {
    if (state.profile) {
      AsyncStorage.setItem('userProfile', JSON.stringify(state.profile));
    }
  }, [state.profile]);

  // Actions
  const loadProfile = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // This would be replaced with actual API call
      // const profile = await userService.getProfile();
      // dispatch({ type: 'SET_PROFILE', payload: profile });
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load profile' });
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
    try {
      // This would be replaced with actual API call
      // await userService.updateProfile(updates);
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update profile' });
    }
  };

  const loadNotifications = async () => {
    try {
      // This would be replaced with actual API call
      // const notifications = await userService.getNotifications();
      // dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load notifications' });
    }
  };

  const markNotificationRead = (id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    // This would be replaced with actual API call
    // userService.markNotificationRead(id);
  };

  const clearNotifications = () => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    // This would be replaced with actual API call
    // userService.clearNotifications();
  };

  const updateStatistics = (stats: Partial<UserProfile['statistics']>) => {
    dispatch({ type: 'UPDATE_STATISTICS', payload: stats });
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    // Clear stored data
    AsyncStorage.multiRemove(['userProfile', 'testProgress', 'authToken']);
  };

  const value = {
    state,
    dispatch,
    loadProfile,
    updateProfile,
    loadNotifications,
    markNotificationRead,
    clearNotifications,
    updateStatistics,
    logout,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// Hook to use the context
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
