/** @jsxImportSource nativewind */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View, Text, Alert, Dimensions, Image } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import SwipeMenuModern from '../../src/components/menu/SwipeMenuModern';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS
} from 'react-native-reanimated';
import { api } from '../../src/services/apiClient';
import { TestResult } from '../../src/types';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { ActiveTestsView, ResultsView, ProfileView } from '../../src/components/dashboard';
import SettingsView from '../../src/components/dashboard/SettingsView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { logout } from '../../src/store/slices/authSlice';
import { useTheme } from '../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../src/utils/themeUtils';

type ActiveTest = {
  test_id: number;
  test_name: string;
  test_type: string;
  subject?: string;
  teacher_name?: string;
  assigned_at?: number;
  deadline?: number | null;
  retest_available?: boolean;
};

type User = {
  student_id: string;
  name: string;
  surname: string;
  nickname?: string;
  grade: string;
  class: string;
};

export default function DashboardScreen() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState<ActiveTest[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());
  const [isCompletionStatusLoaded, setIsCompletionStatusLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'active' | 'results' | 'profile' | 'settings'>('active');

  // Reanimated 3 values
  const menuTranslateX = useSharedValue(-Dimensions.get('window').width * 0.6);
  const backdropOpacity = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Debug: Check if user is authenticated
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Dashboard: Auth token exists:', !!token);
      
      // Enhanced student ID extraction with multiple fallbacks (same as tests)
      let studentId = '';
      
      // Try JWT token first
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email || '';
            console.log('Dashboard: JWT payload:', payload);
            console.log('Dashboard: JWT studentId:', studentId);
          }
        }
      } catch (e) {
        console.log('Dashboard: JWT extraction failed:', e);
      }
      
      // Fallback to AsyncStorage
      if (!studentId) {
        const authUser = await AsyncStorage.getItem('auth_user');
        const userData = authUser ? JSON.parse(authUser) : null;
        console.log('Dashboard: Auth user data:', userData);
        studentId = userData?.student_id || userData?.id || userData?.user_id || userData?.username || userData?.email || '';
        console.log('Dashboard: AsyncStorage studentId:', studentId);
      }
      
      // Try 'user' key if still no ID
      if (!studentId) {
        const userRaw = await AsyncStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        studentId = user?.student_id || user?.id || user?.user_id || user?.username || user?.email || '';
        console.log('Dashboard: user key studentId:', studentId);
      }
      
      if (!studentId) {
        console.error('Student ID not found in any source');
        console.error('Available AsyncStorage keys:');
        try {
          const keys = await AsyncStorage.getAllKeys();
          console.error('AsyncStorage keys:', keys);
        } catch (e) {
          console.error('Error getting AsyncStorage keys:', e);
        }
        throw new Error('Student ID not found. Please log in again.');
      }
      
      console.log('Dashboard: Final studentId:', studentId);
      
      // Set user data - use the best available user data
      let finalUserData = null;
      
      // Try to get user data from AsyncStorage
      const userRaw = await AsyncStorage.getItem('user');
      finalUserData = userRaw ? JSON.parse(userRaw) : null;
      
      if (!finalUserData) {
        const authUserRaw = await AsyncStorage.getItem('auth_user');
        finalUserData = authUserRaw ? JSON.parse(authUserRaw) : null;
      }
      
      // Create user object if we have student ID but no user data
      if (!finalUserData && studentId) {
        finalUserData = {
          student_id: studentId,
          name: 'Student',
          surname: '',
          grade: '',
          class: ''
        };
      }
      
      setUser(finalUserData);
      
      // Load completed tests from AsyncStorage (web app pattern)
      const completed = new Set<string>();
      try {
        const keys = await AsyncStorage.getAllKeys();
        const completionKeys = keys.filter(key => 
          key.startsWith(`test_completed_${studentId}_`)
        );
        
        console.log('🎓 Dashboard: Looking for completion keys with pattern:', `test_completed_${studentId}_`);
        console.log('🎓 Dashboard: Found completion keys:', completionKeys);
        
        // Debug: Show all AsyncStorage keys that contain 'test_completed'
        const allKeys = await AsyncStorage.getAllKeys();
        const allCompletionKeys = allKeys.filter(key => key.includes('test_completed'));
        console.log('🎓 Dashboard: All completion keys in AsyncStorage:', allCompletionKeys);
        
        for (const key of completionKeys) {
          const value = await AsyncStorage.getItem(key);
          console.log('🎓 Checking completion key:', key, 'value:', value);
          if (value === 'true') {
            // Extract test type and ID from key (format: test_completed_studentId_type_id)
            const parts = key.replace(`test_completed_${studentId}_`, '').split('_');
            console.log('🎓 Parsed parts:', parts);
            if (parts.length >= 2) {
              const testType = parts[0];
              const testId = parts.slice(1).join('_');
              const testKey = `${testType}_${testId}`;
              completed.add(testKey);
              console.log('🎓 Found completed test in AsyncStorage:', testKey);
            }
          }
        }
      } catch (completionError) {
        console.warn('Error loading completion status:', completionError);
      }
      setCompletedTests(completed);
      setIsCompletionStatusLoaded(true);
      console.log('🎓 Initialized completed tests from AsyncStorage:', Array.from(completed));
      
      try {
        const [testsRes, resultsRes] = await Promise.all([
          api.get('/api/get-student-active-tests'),
          api.get('/api/get-student-test-results', { params: { student_id: studentId, limit: 5 } }),
        ]);
        const testsData: ActiveTest[] = testsRes.data?.tests ?? testsRes.data?.data ?? [];
        const rawResults = resultsRes.data?.results ?? resultsRes.data?.data ?? [];
        // Transform API data to TestResult format
        const resultsData: TestResult[] = rawResults.map((result: any) => ({
          id: result.id || result.test_id,
          test_id: result.test_id,
          test_name: result.test_name,
          subject: result.subject || 'Unknown',
          test_type: result.test_type,
          percentage: result.percentage || result.score || 0,
          passed: (result.percentage || result.score || 0) >= 60, // 60% is passing
          submitted_at: result.submitted_at || new Date().toISOString(),
          teacher_name: result.teacher_name,
          retest_score: result.retest_score
        }));
        setTests(testsData);
        setResults(resultsData);
        
        // Update completed tests from API results (web app pattern)
        if (resultsData && resultsData.length > 0) {
          const newCompleted = new Set<string>();
          resultsData.forEach(result => {
            const key = `${result.test_type}_${result.test_id}`;
            newCompleted.add(key);
            // Also mark in AsyncStorage (with student ID)
            const completionKey = `test_completed_${studentId}_${result.test_type}_${result.test_id}`;
            AsyncStorage.setItem(completionKey, 'true');
          });
          
          // Merge with existing completed tests instead of overwriting
          setCompletedTests(prev => {
            const merged = new Set([...prev, ...newCompleted]);
            console.log('🎓 Updated completed tests (merged):', Array.from(merged));
            return merged;
          });
        }
      } catch (apiError: any) {
        console.warn('API Error (CORS or other):', apiError.message);
        
        // Try to load cached results when API fails
        try {
          const cacheKey = `student_results_table_${studentId}`;
          const cachedResults = await AsyncStorage.getItem(cacheKey);
          if (cachedResults) {
            const cachedData = JSON.parse(cachedResults);
            console.log('📱 Using cached results:', cachedData);
            // Transform cached data to TestResult format
            const resultsData: TestResult[] = [{
              id: cachedData.result_id || cachedData.test_id,
              test_id: cachedData.test_id,
              test_name: cachedData.test_name || 'Test',
              subject: 'Unknown',
              test_type: 'matching_type',
              percentage: cachedData.percentage || 0,
              passed: (cachedData.percentage || 0) >= 60,
              submitted_at: new Date().toISOString(),
              teacher_name: 'Unknown',
              retest_score: undefined
            }];
            setResults(resultsData);
            console.log('📱 Cached results loaded:', resultsData);
          }
        } catch (cacheError) {
          console.warn('Cache Error:', cacheError);
        }
        
        // Show empty state when API fails due to CORS or other issues
        setTests([]);
        setError('Unable to load data. Please check your connection or try again later.');
      }
    } catch (e: any) {
      console.error('Dashboard API Error:', e);
      console.error('Error response:', e.response?.data);
      console.error('Error status:', e.response?.status);
      
      // Handle CORS errors gracefully
      if (e.message === 'Network Error' || e.code === 'ERR_NETWORK') {
        setError('Unable to connect to server. Please check your internet connection and try again.');
      } else {
        setError(`Failed to load data. ${e.response?.data?.message || e.message || 'Please check your connection and try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []); // Remove fetchData dependency to prevent infinite loop

  // Auto-refresh when user returns to dashboard (e.g., after completing a test)
  useFocusEffect(
    useCallback(() => {
      console.log('🎓 Dashboard focused - refreshing data');
      fetchData();
    }, []) // Remove fetchData dependency to prevent infinite loop
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await api.post('/api/logout');
            } catch (e) {
              console.error('Logout API failed, but proceeding with client logout:', e);
            } finally {
              dispatch(logout());
              router.replace('/auth/login');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [dispatch]);

  // Gesture handler for swipe menu
  const onGestureEvent = (event: any) => {
    'worklet';
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = screenWidth * 0.6;
    const newTranslateX = Math.max(-menuWidth, Math.min(0, event.nativeEvent.translationX));
    menuTranslateX.value = newTranslateX;
    
    // Update backdrop opacity based on menu position
    const progress = Math.abs(newTranslateX) / menuWidth;
    backdropOpacity.value = withTiming(progress * 0.5, { duration: 0 });
  };

  const onHandlerStateChange = (event: any) => {
    'worklet';
    if (event.nativeEvent.state === State.END) {
      const screenWidth = Dimensions.get('window').width;
      const menuWidth = screenWidth * 0.6;
      const velocity = event.nativeEvent.velocityX;
      const translation = event.nativeEvent.translationX;
      
      let targetX = -menuWidth;
      
      if (velocity > 500 || translation > menuWidth * 0.3) {
        targetX = 0; // Open menu
        runOnJS(setIsMenuOpen)(true);
      } else if (velocity < -500 || translation < -menuWidth * 0.3) {
        targetX = -menuWidth; // Close menu
        runOnJS(setIsMenuOpen)(false);
      } else {
        // Snap to current state
        targetX = isMenuOpen ? 0 : -menuWidth;
      }
      
      menuTranslateX.value = withSpring(targetX, {
        damping: 20,
        stiffness: 300,
      });
      
      backdropOpacity.value = withTiming(targetX === 0 ? 0.5 : 0, { duration: 300 });
    }
  };

  // Animated styles
  const menuAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: menuTranslateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const closeMenu = useCallback(() => {
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = screenWidth * 0.6;
    menuTranslateX.value = withSpring(-menuWidth, {
      damping: 20,
      stiffness: 300,
    });
    backdropOpacity.value = withTiming(0, { duration: 300 });
    setIsMenuOpen(false);
  }, [menuTranslateX, backdropOpacity]);

  // Toggle show all tests
  const toggleShowAllTests = useCallback(() => {
    setShowAllTests(prev => !prev);
  }, []);

  const skeletonItems = useMemo(() => Array.from({ length: 3 }).map((_, i) => i), []);

  // Gesture handler for swipe from left

  return (
    <ErrorBoundary>
      {/* Modern SwipeMenu Component */}
      <SwipeMenuModern
        isOpen={isMenuOpen}
        onClose={closeMenu}
        onNavigate={(view) => {
          if (view === 'password') {
            router.push('/(tabs)/profile');
          } else if (view === 'dashboard') {
            setCurrentView('dashboard');
          } else {
            setCurrentView(view as 'active' | 'results' | 'profile' | 'settings');
          }
        }}
        userName={user?.nickname || user?.name || 'Student'}
        userRole="Student"
        activeTestsCount={tests.filter(test => {
          const testKey = `${test.test_type}_${test.test_id}`;
          return !completedTests.has(testKey);
        }).length}
      />

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={10}
        failOffsetY={[-5, 5]}
      >
    <View className={`flex-1 ${themeClasses.background}`}>

        {/* Simplified Header */}
        <View className={`shadow-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-b border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800' 
            : 'bg-header-blue'
        }`}>
          <View className="px-4 py-4">
            
            {/* Student Info */}
            <View className="flex-row items-center">
              <View className={`w-14 h-14 rounded-full justify-center items-center mr-4 overflow-hidden ${
                themeMode === 'cyberpunk' 
                  ? 'bg-cyan-400 border border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-white/20' 
                  : 'bg-white'
              }`}>
                {user?.profilePicture ? (
                  <Image 
                    source={{ uri: user.profilePicture }} 
                    className="w-full h-full rounded-full"
                    resizeMode="cover"
                    onError={() => {
                      console.log('Dashboard: Error loading profile picture, falling back to anon.png');
                    }}
                  />
                ) : (
                  <Image 
                    source={require('../../assets/images/anon.png')} 
                    className="w-full h-full rounded-full"
                    resizeMode="cover"
                    onError={() => {
                      console.log('Dashboard: Error loading anon.png, falling back to initials');
                    }}
                  />
                )}
                {/* Fallback to initials if both images fail */}
                <View className="absolute inset-0 justify-center items-center">
                  <Text className={`text-xl font-bold ${
                    themeMode === 'cyberpunk' 
                      ? 'text-black' 
                      : themeMode === 'dark' 
                      ? 'text-white' 
                      : 'text-blue-500'
                  }`}>
                    {user?.name?.charAt(0) || 'S'}
                  </Text>
                </View>
              </View>
              <View className="flex-1">
                <Text className={`text-lg font-semibold ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400 tracking-wider' 
                    : 'text-white'
                }`}>
                  {themeMode === 'cyberpunk' 
                    ? `${user?.name?.toUpperCase()} ${user?.surname?.toUpperCase()}` 
                    : `${user?.name} ${user?.surname}`}
                </Text>
                <Text className={`text-sm ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-300' 
                    : themeMode === 'dark' 
                    ? 'text-gray-300' 
                    : 'text-blue-100'
                }`}>
                  Grade {user?.grade} - Class {user?.class}
                </Text>
                <Text className={`text-xs mt-1 ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-200' 
                    : themeMode === 'dark' 
                    ? 'text-gray-400' 
                    : 'text-blue-200'
                }`}>
                  Student ID: {user?.student_id}
                </Text>
              </View>
              
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {error ? (
            <View className="bg-red-50 rounded-lg p-3 m-4">
              <Text className="text-red-800 text-sm">{error}</Text>
            </View>
          ) : null}

          {currentView === 'active' && (
            <ActiveTestsView
              tests={tests}
              loading={loading}
              completedTests={completedTests}
              isCompletionStatusLoaded={isCompletionStatusLoaded}
              showAllTests={showAllTests}
              onToggleShowAll={() => setShowAllTests(!showAllTests)}
            />
          )}

          {currentView === 'results' && (
            <ResultsView
              results={results}
              loading={loading}
              showAllResults={showAllResults}
              onToggleShowAll={() => setShowAllResults(!showAllResults)}
            />
          )}

          {currentView === 'profile' && (
            <ProfileView
              user={user}
              onLogout={handleLogout}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView />
          )}
        </ScrollView>

    </View>
      </PanGestureHandler>
    </ErrorBoundary>
  );
}

// Styles removed - using NativeWind classes instead
 