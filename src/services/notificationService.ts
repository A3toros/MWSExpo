import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import BackgroundFetch from 'react-native-background-fetch';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from './apiClient';

// Configure notification behavior
// Note: Using standard notifications only - no fullscreen notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Storage keys
const STORAGE_KEYS = {
  NOTIFICATION_ENABLED: 'notification_enabled',
  LAST_FETCH_TIMESTAMP: 'last_notification_fetch',
  NOTIFIED_TESTS: 'notified_tests',
  NOTIFIED_RETESTS: 'notified_retests',
  LAST_APP_VERSION: 'last_app_version',
  PERMISSIONS_ASKED: 'notification_permissions_asked', // Track if we've asked for permissions before
};

// Get current app version
const getCurrentAppVersion = (): string => {
  return Constants.expoConfig?.version || Constants.nativeAppVersion || '1.0.0';
};

// Extract student ID from AsyncStorage
const getStudentId = async (): Promise<string | null> => {
  try {
    // Try JWT token first
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email || '';
        if (studentId) return studentId;
      }
    }

    // Fallback to auth_user
    const authUser = await AsyncStorage.getItem('auth_user');
    if (authUser) {
      const userData = JSON.parse(authUser);
      const studentId = userData?.student_id || userData?.id || userData?.user_id || userData?.username || userData?.email || '';
      if (studentId) return studentId;
    }

    // Fallback to user key
    const userRaw = await AsyncStorage.getItem('user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      const studentId = user?.student_id || user?.id || user?.user_id || user?.username || user?.email || '';
      if (studentId) return studentId;
    }

    return null;
  } catch (error) {
    console.error('[NotificationService] Error extracting student ID:', error);
    return null;
  }
};

// Fetch active tests from API
const fetchActiveTests = async (studentId: string): Promise<any[]> => {
  try {
    const cacheBust = Date.now();
    const response = await api.get('/api/get-student-active-tests', { params: { cb: cacheBust } });
    const tests = response.data?.tests ?? response.data?.data ?? [];
    console.log('[NotificationService] Fetched tests:', tests.length);
    return tests;
  } catch (error) {
    console.error('[NotificationService] Error fetching tests:', error);
    return [];
  }
};

// Headless task handler
const headlessTask = async (event: { taskId: string }) => {
  const taskId = event.taskId;
  console.log('[NotificationService] Headless task started:', taskId);

  try {
    // Check app state - only send notifications if app is NOT active
    const appState = AppState.currentState;
    console.log('[NotificationService] Current app state:', appState);

    if (appState === 'active') {
      console.log('[NotificationService] App is active (foreground) - skipping notifications');
      // Still update fetch timestamp but don't send notifications
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_FETCH_TIMESTAMP, new Date().toISOString());
      BackgroundFetch.finish(taskId);
      return;
    }

    // App is in background/inactive/closed - proceed with notifications
    console.log('[NotificationService] App is in background - checking for new tests/retests');

    // Get student ID
    const studentId = await getStudentId();
    if (!studentId) {
      console.log('[NotificationService] No student ID found - skipping');
      BackgroundFetch.finish(taskId);
      return;
    }

    // Check if notifications are enabled
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
    if (enabled !== 'true') {
      console.log('[NotificationService] Notifications disabled - skipping');
      BackgroundFetch.finish(taskId);
      return;
    }

    // Fetch active tests
    const tests = await fetchActiveTests(studentId);

    // Load notified items
    const notifiedTestsStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_TESTS);
    const notifiedRetestsStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_RETESTS);
    const notifiedTests: number[] = notifiedTestsStr ? JSON.parse(notifiedTestsStr) : [];
    const notifiedRetests: number[] = notifiedRetestsStr ? JSON.parse(notifiedRetestsStr) : [];

    // Filter new tests (not retests)
    const newTests = tests.filter(
      (test) => !notifiedTests.includes(test.test_id) && !test.retest_available
    );

    // Filter new retests
    const newRetests = tests.filter(
      (test) =>
        test.retest_available &&
        test.retest_assignment_id &&
        !notifiedRetests.includes(test.retest_assignment_id)
    );

    console.log('[NotificationService] New tests:', newTests.length, 'New retests:', newRetests.length);

    // Schedule notifications for new tests
    for (const test of newTests) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📝 New Test Available',
          body: `You have a new ${test.test_type || 'test'}: ${test.test_name || 'Test'}`,
          data: {
            type: 'new_test',
            test_id: test.test_id,
            test_type: test.test_type,
            test_name: test.test_name,
          },
          sound: true,
        },
        trigger: null, // Show immediately
      });

      notifiedTests.push(test.test_id);
      console.log('[NotificationService] Scheduled notification for test:', test.test_id);
    }

    // Schedule notifications for new retests
    for (const retest of newRetests) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔄 Retest Available',
          body: `A retest is available for: ${retest.test_name || 'Test'}`,
          data: {
            type: 'retest',
            test_id: retest.test_id,
            retest_assignment_id: retest.retest_assignment_id,
            test_name: retest.test_name,
          },
          sound: true,
        },
        trigger: null, // Show immediately
      });

      if (retest.retest_assignment_id) {
        notifiedRetests.push(retest.retest_assignment_id);
      }
      console.log('[NotificationService] Scheduled notification for retest:', retest.retest_assignment_id);
    }

    // Update notified items in AsyncStorage
    if (newTests.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_TESTS, JSON.stringify(notifiedTests));
    }
    if (newRetests.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_RETESTS, JSON.stringify(notifiedRetests));
    }

    // Update last fetch timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_FETCH_TIMESTAMP, new Date().toISOString());

    console.log('[NotificationService] Headless task completed successfully');
  } catch (error) {
    console.error('[NotificationService] Error in headless task:', error);
  } finally {
    BackgroundFetch.finish(taskId);
  }
};

// Register headless task
BackgroundFetch.registerHeadlessTask(headlessTask);

class NotificationService {
  private initialized = false;

  // Get current app version
  getCurrentAppVersion(): string {
    return getCurrentAppVersion();
  }

  // Check if app was updated
  async checkAppUpdate(): Promise<boolean> {
    try {
      const currentVersion = getCurrentAppVersion();
      const lastVersion = await AsyncStorage.getItem(STORAGE_KEYS.LAST_APP_VERSION);

      if (lastVersion && lastVersion !== currentVersion) {
        console.log('[NotificationService] App updated:', { from: lastVersion, to: currentVersion });
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_APP_VERSION, currentVersion);
        return true; // App was updated
      }

      // First time or same version
      if (!lastVersion) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_APP_VERSION, currentVersion);
      }

      return false; // No update
    } catch (error) {
      console.error('[NotificationService] Error checking app update:', error);
      return false;
    }
  }

  // Handle app update
  async handleAppUpdate(): Promise<void> {
    try {
      console.log('[NotificationService] Handling app update...');

      // Clear notification tracking (user will see tests as "new" again)
      await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFIED_TESTS);
      await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFIED_RETESTS);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_FETCH_TIMESTAMP);

      // Preserve user preferences
      // notification_enabled stays as-is

      console.log('[NotificationService] Cleared notification state after update');
    } catch (error) {
      console.error('[NotificationService] Error handling app update:', error);
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('[NotificationService] Not a physical device - permissions not available');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[NotificationService] Current permission status:', existingStatus);
      
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('[NotificationService] Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: false,
          },
        });
        finalStatus = status;
        console.log('[NotificationService] Permission request result:', status);
      }

      const granted = finalStatus === 'granted';
      console.log('[NotificationService] Final permission status:', finalStatus, 'Granted:', granted);
      return granted;
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return false;
    }
  }

  // Check notification permissions
  async checkPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        return false;
      }

      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[NotificationService] Error checking permissions:', error);
      return false;
    }
  }

  // Check if notifications are enabled
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('[NotificationService] Error checking if enabled:', error);
      return false;
    }
  }

  // Set notification enabled/disabled
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ENABLED, enabled ? 'true' : 'false');
      console.log('[NotificationService] Notifications', enabled ? 'enabled' : 'disabled');

      if (enabled) {
        await this.startBackgroundFetch();
      } else {
        await this.stopBackgroundFetch();
      }
    } catch (error) {
      console.error('[NotificationService] Error setting enabled:', error);
    }
  }

  // Configure background fetch
  async configureBackgroundFetch(): Promise<void> {
    try {
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // minutes
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
          requiresBatteryNotLow: false,
          requiresCharging: false,
          requiresDeviceIdle: false,
          requiresStorageNotLow: false,
        },
        async (taskId: string) => {
          console.log('[NotificationService] Background fetch triggered:', taskId);
          await headlessTask({ taskId });
        },
        (taskId: string) => {
          console.error('[NotificationService] Background fetch failed to start:', taskId);
        }
      );

      console.log('[NotificationService] Background fetch configured, status:', status);
    } catch (error) {
      console.error('[NotificationService] Error configuring background fetch:', error);
    }
  }

  // Start background fetch
  async startBackgroundFetch(): Promise<void> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log('[NotificationService] Notifications disabled - not starting background fetch');
        return;
      }

      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.log('[NotificationService] No permissions - not starting background fetch');
        return;
      }

      await this.configureBackgroundFetch();
      console.log('[NotificationService] Background fetch started');
    } catch (error) {
      console.error('[NotificationService] Error starting background fetch:', error);
    }
  }

  // Stop background fetch
  async stopBackgroundFetch(): Promise<void> {
    try {
      await BackgroundFetch.stop();
      console.log('[NotificationService] Background fetch stopped');
    } catch (error) {
      console.error('[NotificationService] Error stopping background fetch:', error);
    }
  }

  // Schedule a notification
  async scheduleNotification(title: string, body: string, data?: any): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Show immediately
      });

      console.log('[NotificationService] Scheduled notification:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('[NotificationService] Error scheduling notification:', error);
      throw error;
    }
  }

  // Cancel a notification
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('[NotificationService] Cancelled notification:', notificationId);
    } catch (error) {
      console.error('[NotificationService] Error cancelling notification:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationService] Cancelled all notifications');
    } catch (error) {
      console.error('[NotificationService] Error cancelling all notifications:', error);
    }
  }

  // Get last fetch timestamp
  async getLastFetchTimestamp(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_FETCH_TIMESTAMP);
    } catch (error) {
      console.error('[NotificationService] Error getting last fetch timestamp:', error);
      return null;
    }
  }

  // Set last fetch timestamp
  async setLastFetchTimestamp(timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_FETCH_TIMESTAMP, timestamp);
    } catch (error) {
      console.error('[NotificationService] Error setting last fetch timestamp:', error);
    }
  }

  // Get notified tests
  async getNotifiedTests(): Promise<number[]> {
    try {
      const notifiedTestsStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_TESTS);
      return notifiedTestsStr ? JSON.parse(notifiedTestsStr) : [];
    } catch (error) {
      console.error('[NotificationService] Error getting notified tests:', error);
      return [];
    }
  }

  // Add notified test
  async addNotifiedTest(testId: number): Promise<void> {
    try {
      const notifiedTests = await this.getNotifiedTests();
      if (!notifiedTests.includes(testId)) {
        notifiedTests.push(testId);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_TESTS, JSON.stringify(notifiedTests));
      }
    } catch (error) {
      console.error('[NotificationService] Error adding notified test:', error);
    }
  }

  // Get notified retests
  async getNotifiedRetests(): Promise<number[]> {
    try {
      const notifiedRetestsStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_RETESTS);
      return notifiedRetestsStr ? JSON.parse(notifiedRetestsStr) : [];
    } catch (error) {
      console.error('[NotificationService] Error getting notified retests:', error);
      return [];
    }
  }

  // Add notified retest
  async addNotifiedRetest(retestId: number): Promise<void> {
    try {
      const notifiedRetests = await this.getNotifiedRetests();
      if (!notifiedRetests.includes(retestId)) {
        notifiedRetests.push(retestId);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_RETESTS, JSON.stringify(notifiedRetests));
      }
    } catch (error) {
      console.error('[NotificationService] Error adding notified retest:', error);
    }
  }

  // Initialize notification service
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[NotificationService] Already initialized');
      return;
    }

    try {
      console.log('[NotificationService] Initializing...');

      // Check for app update
      const wasUpdated = await this.checkAppUpdate();
      if (wasUpdated) {
        await this.handleAppUpdate();
      }

      // Check if we've asked for permissions before
      const permissionsAsked = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSIONS_ASKED);
      const hasPermissions = await this.checkPermissions();

      // On first login, ask for permissions if not granted
      if (!permissionsAsked && Device.isDevice && !hasPermissions) {
        console.log('[NotificationService] First login - requesting notification permissions...');
        const granted = await this.requestPermissions();
        await AsyncStorage.setItem(STORAGE_KEYS.PERMISSIONS_ASKED, 'true');
        
        if (granted) {
          console.log('[NotificationService] Permissions granted on first login');
          // Enable notifications by default if permissions granted
          await this.setEnabled(true);
        } else {
          console.log('[NotificationService] Permissions denied on first login');
        }
      }

      // Check if notifications are enabled
      const enabled = await this.isEnabled();

      if (enabled) {
        // Request permissions if not granted (user might have disabled them)
        if (!hasPermissions) {
          console.log('[NotificationService] Permissions not granted - requesting...');
          const granted = await this.requestPermissions();
          if (!granted) {
            console.log('[NotificationService] Permissions denied - notifications will not work');
          }
        }

        // Start background fetch (will check permissions again)
        await this.startBackgroundFetch();
      }

      this.initialized = true;
      console.log('[NotificationService] Initialized successfully');
    } catch (error) {
      console.error('[NotificationService] Error initializing:', error);
    }
  }

  // Request permissions proactively (can be called from UI)
  async requestPermissionsProactively(): Promise<boolean> {
    try {
      console.log('[NotificationService] Proactively requesting permissions...');
      const granted = await this.requestPermissions();
      
      if (granted) {
        // If permissions granted and notifications are enabled, start background fetch
        const enabled = await this.isEnabled();
        if (enabled) {
          await this.startBackgroundFetch();
        }
      }
      
      return granted;
    } catch (error) {
      console.error('[NotificationService] Error in proactive permission request:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

