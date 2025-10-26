import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, Text, Alert, Dimensions } from 'react-native';
import { Link, router } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { api } from '../../src/services/apiClient';
import { ResultsTable } from '../../src/components/ResultsTable';
import { TestResult } from '../../src/types';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { ActiveTestsView, ResultsView, ProfileView } from '../../src/components/dashboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { logout } from '../../src/store/slices/authSlice';

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
  grade: string;
  class: string;
};

export default function DashboardScreen() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
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
  const [menuTranslateX, setMenuTranslateX] = useState(-Dimensions.get('window').width * 0.6);
  const [isDragging, setIsDragging] = useState(false);
  const [currentView, setCurrentView] = useState<'active' | 'results' | 'profile'>('active');

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Debug: Check if user is authenticated
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Dashboard: Auth token exists:', !!token);
      
      // Get student_id from auth state
      const authUser = await AsyncStorage.getItem('auth_user');
      const userData = authUser ? JSON.parse(authUser) : null;
      console.log('Dashboard: Auth user data:', userData);
      const studentId = userData?.student_id;
      console.log('Dashboard: Student ID:', studentId);
      
      if (!studentId) {
        console.error('Student ID not found. User data:', userData);
        console.error('Available AsyncStorage keys:');
        try {
          const keys = await AsyncStorage.getAllKeys();
          console.error('AsyncStorage keys:', keys);
        } catch (e) {
          console.error('Error getting AsyncStorage keys:', e);
        }
        throw new Error('Student ID not found. Please log in again.');
      }
      
      setUser(userData);
      
      // Load completed tests from AsyncStorage (web app pattern)
      const completed = new Set<string>();
      try {
        const keys = await AsyncStorage.getAllKeys();
        const completionKeys = keys.filter(key => 
          key.startsWith(`test_completed_${studentId}_`)
        );
        
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
  }, [fetchData]);

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

  // Toggle show all tests
  const toggleShowAllTests = useCallback(() => {
    setShowAllTests(prev => !prev);
  }, []);

  const skeletonItems = useMemo(() => Array.from({ length: 3 }).map((_, i) => i), []);

  // Gesture handler for swipe from left
  const onGestureEvent = useCallback((event: any) => {
    const { translationX } = event.nativeEvent;
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = screenWidth * 0.6;
    
    if (translationX > 0) {
      // Swiping right - show menu
      const newTranslateX = Math.min(0, -menuWidth + translationX);
      setMenuTranslateX(newTranslateX);
    }
  }, []);

  const onHandlerStateChange = useCallback((event: any) => {
    const { state, translationX } = event.nativeEvent;
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = screenWidth * 0.6;
    
    if (state === State.END) {
      setIsDragging(false);
      
      if (translationX > screenWidth * 0.2) {
        // Swipe threshold reached - open menu
        setMenuTranslateX(0);
        setIsMenuOpen(true);
      } else {
        // Not enough swipe - close menu
        setMenuTranslateX(-menuWidth);
        setIsMenuOpen(false);
      }
    } else if (state === State.BEGAN) {
      setIsDragging(true);
    }
  }, []);

  const closeMenu = useCallback(() => {
    const screenWidth = Dimensions.get('window').width;
    setMenuTranslateX(-screenWidth * 0.6);
    setIsMenuOpen(false);
  }, []);

  return (
    <ErrorBoundary>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={10}
        failOffsetY={[-5, 5]}
      >
    <View style={styles.container}>
        {/* Overlay Menu */}
        <View style={[
          styles.overlayMenu,
          {
            transform: [{ translateX: menuTranslateX }],
            width: Dimensions.get('window').width * 0.6,
          }
        ]}>
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <TouchableOpacity onPress={closeMenu} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.overlayMenuItem}
              onPress={() => {
                closeMenu();
                setCurrentView('active');
              }}
            >
              <Text style={styles.overlayMenuItemText}>Active Tests</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.overlayMenuItem}
              onPress={() => {
                closeMenu();
                setCurrentView('results');
              }}
            >
              <Text style={styles.overlayMenuItemText}>Results</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.overlayMenuItem}
              onPress={() => {
                closeMenu();
                setCurrentView('profile');
              }}
            >
              <Text style={styles.overlayMenuItemText}>Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.overlayMenuItem}
              onPress={() => {
                closeMenu();
                router.push('/(tabs)/profile');
              }}
            >
              <Text style={styles.overlayMenuItemText}>Change Password</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.overlayMenuItem}
              onPress={() => {
                closeMenu();
                handleLogout();
              }}
            >
              <Text style={styles.overlayMenuItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Backdrop */}
        {isMenuOpen && (
          <TouchableOpacity
            style={styles.backdrop}
            onPress={closeMenu}
            activeOpacity={1}
          />
        )}

        {/* Header - Exact copy of web app */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {/* Student Info */}
            <View style={styles.studentInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0) || 'S'}
                </Text>
              </View>
              <View style={styles.studentDetails}>
                <Text style={styles.studentName}>
                  {user?.name} {user?.surname}
                </Text>
                <Text style={styles.studentClass}>
                  Grade {user?.grade} - Class {user?.class}
                </Text>
              </View>
            </View>
            
          </View>
        </View>

        <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
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
        </ScrollView>

        {/* Navigation Links - Only show for active view */}
        {currentView === 'active' && (
          <View style={styles.linksRow}>
            <Link href="/tests" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Go to Tests</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/results" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>See Results</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
    </View>
      </PanGestureHandler>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // Light blue-gray background like web app
  },
  header: {
    backgroundColor: '#3b82f6', // Blue gradient header
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  studentClass: {
    color: '#bfdbfe', // Light blue
    fontSize: 14,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  menuButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  menuIcon: {
    color: 'white',
    fontSize: 16,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  testMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  testSubject: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  testTeacher: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 8,
    marginBottom: 4,
  },
  testDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  startButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  disabledButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  completedButton: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  completedButtonText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  showMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  showMoreText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  cardSkeleton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    height: 60,
    marginBottom: 8,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  linkBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    alignItems: 'center',
    padding: 14,
  },
  linkBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  // Overlay Menu Styles
  overlayMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#8E66EB',
    zIndex: 1000,
    elevation: 1000,
  },
  menuContent: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlayMenuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 5,
    backgroundColor: '#5F64E8',
    borderRadius: 8,
  },
  overlayMenuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    elevation: 999,
  },
});
