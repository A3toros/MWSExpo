import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get retest_assignment_id from AsyncStorage for a test (web app pattern)
 */
export async function getRetestAssignmentId(
  studentId: string,
  testType: string,
  testId: string | number | string[] | undefined | null
): Promise<number | null> {
  // Handle array case from Expo Router params
  const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
  try {
    const retestAssignKey = `retest_assignment_id_${studentId}_${testType}_${testIdStr}`;
    const retestAssignmentId = await AsyncStorage.getItem(retestAssignKey);
    return retestAssignmentId ? parseInt(retestAssignmentId, 10) : null;
  } catch (e) {
    console.warn('Error getting retest_assignment_id:', e);
    return null;
  }
}

/**
 * Process retest_available flag from API and set/clear retest keys (web app pattern)
 * Used in dashboard and tests tab when loading active tests
 */
export async function processRetestAvailability(
  test: {
    test_id: number;
    test_type: string;
    retest_available?: boolean;
    retest_attempts_left?: number;
    retest_assignment_id?: number;
  },
  studentId: string,
  onCompletedTestsUpdate?: (testKey: string, remove: boolean) => void
): Promise<void> {
  if (!test.retest_available) {
    return;
  }

  const retestKey = `retest1_${studentId}_${test.test_type}_${test.test_id}`;
  const completionKey = `test_completed_${studentId}_${test.test_type}_${test.test_id}`;

  // Check current state in AsyncStorage
  const currentRetestKey = await AsyncStorage.getItem(retestKey);
  const currentCompletionKey = await AsyncStorage.getItem(completionKey);

  // If completion key exists but retest key doesn't, test was just submitted - don't process retest yet
  // This prevents race condition where dashboard reloads before backend updates attempt_count
  if (currentCompletionKey === 'true' && currentRetestKey !== 'true') {
    console.log('🎓 Test was just submitted - skipping retest key setup to prevent race condition:', completionKey);
    return;
  }

  // Only set retest key if there are attempts left (web app pattern)
  // retest_attempts_left > 0 means user can still retake
  // If retest_attempts_left is undefined/null, assume it's available (for backwards compatibility)
  const hasAttemptsLeft =
    test.retest_attempts_left === undefined ||
    test.retest_attempts_left === null ||
    test.retest_attempts_left > 0;

  if (hasAttemptsLeft) {
    await AsyncStorage.setItem(retestKey, 'true');
    console.log('🎓 Set retest key (web app pattern):', retestKey, 'attempts left:', test.retest_attempts_left);

    // Store retest_assignment_id for submission (web app pattern)
    if (test.retest_assignment_id) {
      const retestAssignKey = `retest_assignment_id_${studentId}_${test.test_type}_${test.test_id}`;
      await AsyncStorage.setItem(retestAssignKey, test.retest_assignment_id.toString());
      console.log('🎓 Stored retest_assignment_id:', retestAssignKey, test.retest_assignment_id);
    }

    // Clear completion key so test doesn't show as completed (web app pattern)
    await AsyncStorage.removeItem(completionKey);
    console.log('🎓 Cleared completion key for retest:', completionKey);

    // Also remove from completedTests set if callback provided
    if (onCompletedTestsUpdate) {
      const testKey = `${test.test_type}_${test.test_id}`;
      onCompletedTestsUpdate(testKey, true);
    }
  } else {
    // No attempts left - ensure retest key is removed
    await AsyncStorage.removeItem(retestKey);
    // Also remove retest_assignment_id
    if (test.retest_assignment_id) {
      const retestAssignKey = `retest_assignment_id_${studentId}_${test.test_type}_${test.test_id}`;
      await AsyncStorage.removeItem(retestAssignKey);
    }
    // Ensure completion key is set when no attempts left (like web app)
    // This ensures completed retests show "Completed" instead of "Start Retest"
    await AsyncStorage.setItem(completionKey, 'true');
    console.log('🎓 Removed retest key (no attempts left) and ensured completion key is set:', retestKey, completionKey);
  }
}

/**
 * Clear retest keys after submission (web app pattern)
 */
export async function clearRetestKeys(
  studentId: string,
  testType: string,
  testId: string | number | string[] | undefined | null
): Promise<void> {
  // Handle array case from Expo Router params
  const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
  const retestKey = `retest1_${studentId}_${testType}_${testIdStr}`;
  const retestAssignKey = `retest_assignment_id_${studentId}_${testType}_${testIdStr}`;
  
  await AsyncStorage.removeItem(retestKey);
  await AsyncStorage.removeItem(retestAssignKey);
  
  console.log('🎓 Cleared retest keys after submission:', retestKey, retestAssignKey);
}

/**
 * Mark test as completed and clear retest keys (web app pattern)
 */
export async function markTestCompleted(
  studentId: string,
  testType: string,
  testId: string | number | string[] | undefined | null
): Promise<void> {
  // Handle array case from Expo Router params
  const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
  const completionKey = `test_completed_${studentId}_${testType}_${testIdStr}`;
  await AsyncStorage.setItem(completionKey, 'true');
  
  // Clear retest keys (web app pattern)
  await clearRetestKeys(studentId, testType, testIdStr);
  
  console.log('🎓 Marked test as completed:', completionKey);
}

