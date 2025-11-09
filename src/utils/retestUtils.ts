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
    retest_is_completed?: boolean;
    retest_attempts_left?: number | null;
    retest_assignment_id?: number;
  },
  studentId: string,
  onCompletedTestsUpdate?: (testKey: string, remove: boolean) => void
): Promise<void> {
  // Only process if retest available and not completed (from API)
  if (!test.retest_available || test.retest_is_completed) {
    return;
  }

  const retestKey = `retest1_${studentId}_${test.test_type}_${test.test_id}`;

  // Only set retest key, never delete completion key
  // API handles filtering - completion keys are kept temporarily until API refresh
  await AsyncStorage.setItem(retestKey, 'true');
  console.log('🎓 Set retest key (API-driven):', retestKey, 'attempts left:', test.retest_attempts_left);

  // Store retest_assignment_id for submission
  if (test.retest_assignment_id) {
    const retestAssignKey = `retest_assignment_id_${studentId}_${test.test_type}_${test.test_id}`;
    await AsyncStorage.setItem(retestAssignKey, test.retest_assignment_id.toString());
    console.log('🎓 Stored retest_assignment_id:', retestAssignKey, test.retest_assignment_id);
  }

  // ⚠️ REMOVED: No longer delete completion keys - API handles filtering
  // Completion keys are kept temporarily until API refresh
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

/**
 * Start a retest - set retest key and clear completion key before navigation (web app pattern)
 * This must be called BEFORE navigating to the test page
 */
export async function startRetest(
  studentId: string,
  test: {
    test_id: number;
    test_type: string;
    retest_available?: boolean;
    retest_is_completed?: boolean;
    retest_assignment_id?: number;
  }
): Promise<void> {
  // Only start retest if available and not completed (from API)
  if (!test.retest_available || test.retest_is_completed) {
    console.log('🎓 Retest not available or completed - skipping startRetest');
    return;
  }

  const testIdStr = String(test.test_id);
  const retestKey = `retest1_${studentId}_${test.test_type}_${testIdStr}`;

  // Set retest key BEFORE navigation
  await AsyncStorage.setItem(retestKey, 'true');
  console.log('🎓 Set retest key:', retestKey);

  // ⚠️ IMPORTANT: Clear completion key of original test when starting retest
  // This allows student to take retest even if original test was completed
  const completionKey = `test_completed_${studentId}_${test.test_type}_${testIdStr}`;
  await AsyncStorage.removeItem(completionKey);
  console.log('🎓 Cleared original test completion key for retest:', completionKey);

  // Store retest_assignment_id for submission (web app pattern)
  if (test.retest_assignment_id) {
    const retestAssignKey = `retest_assignment_id_${studentId}_${test.test_type}_${testIdStr}`;
    await AsyncStorage.setItem(retestAssignKey, test.retest_assignment_id.toString());
    console.log('🎓 Set retest assignment ID:', retestAssignKey, '=', test.retest_assignment_id);
  }

  // Clear per-test cached data (web app pattern)
  try {
    // Common prefixes for saved answers/state across tests
    const suffix = `_${studentId}_${test.test_type}_${testIdStr}`;
    const retestAssignKey = `retest_assignment_id_${studentId}_${test.test_type}_${testIdStr}`;
    const retestKey = `retest1_${studentId}_${test.test_type}_${testIdStr}`;
    const allKeys = await AsyncStorage.getAllKeys();
    const toDelete = allKeys.filter(key => {
      if (!key) return false;
      // ⚠️ IMPORTANT: Don't delete retest keys - they're needed for submission
      if (key === retestAssignKey || key === retestKey) return false;
      return (
        key.endsWith(suffix) ||
        key.includes(`answers_${studentId}_${test.test_type}_${testIdStr}`) ||
        key.includes(`progress_${studentId}_${test.test_type}_${testIdStr}`) ||
        key.includes(`state_${studentId}_${test.test_type}_${testIdStr}`) ||
        key.includes(`selected_${studentId}_${test.test_type}_${testIdStr}`) ||
        key.includes(`anti_cheating_${studentId}_${test.test_type}_${testIdStr}`) ||
        key.includes(`speaking_test_data_${studentId}_${testIdStr}`) ||
        key.includes(`speaking_progress_${testIdStr}`)
      );
    });
    
    for (const key of toDelete) {
      await AsyncStorage.removeItem(key);
    }
    console.log('🎓 Cleared cached keys for retest start:', toDelete);
  } catch (e) {
    console.warn('Error clearing cached keys for retest:', e);
  }
}

/**
 * Handle retest completion after submission - backend is authoritative
 * (REPLACES lines 169-255 in retestUtils.ts)
 * 
 * ⚠️ CRITICAL: Do NOT track attempts in AsyncStorage
 * Backend handles all attempt tracking in retest_targets table
 * Backend writes to test_attempts.attempt_number
 * Backend updates retest_targets.attempt_number, attempt_count, is_completed
 */
export async function handleRetestCompletion(
  studentId: string,
  testType: string,
  testId: string | number,
  submissionResult: {
    success: boolean;
    percentage?: number;
    percentage_score?: number;
  }
): Promise<void> {
  const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
  
  // Check if this is a retest
  const retestAssignKey = `retest_assignment_id_${studentId}_${testType}_${testIdStr}`;
  const retestAssignmentId = await AsyncStorage.getItem(retestAssignKey);
  const isRetest = !!retestAssignmentId;
  
  if (!isRetest) {
    // Regular test - mark as completed
    const completionKey = `test_completed_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(completionKey, 'true');
    console.log('🎓 Marked regular test as completed:', completionKey);
    return;
  }
  
  // ⚠️ CRITICAL: Do NOT track attempts in AsyncStorage
  // Backend handles all attempt tracking in retest_targets table
  // Backend writes to test_attempts.attempt_number
  // Backend updates retest_targets.attempt_number, attempt_count, is_completed
  
  // ⚠️ IMPORTANT: Mark retest as completed locally immediately to prevent duplicate starts
  // This is a temporary measure until API refresh returns retest_is_completed = true
  // The completion key prevents students from starting retest again while waiting for API
  const completionKey = `test_completed_${studentId}_${testType}_${testIdStr}`;
  
  if (submissionResult.success) {
    // Set completion key immediately (prevents duplicate starts while waiting for API)
    // This is cleared/overridden on next API refresh when backend returns retest_is_completed = true
    await AsyncStorage.setItem(completionKey, 'true');
    console.log('🎓 Marked retest as completed locally (prevents duplicate starts until API refresh):', completionKey);
    
    // ⚠️ REMOVED: All AsyncStorage attempt tracking (retest_attempt1_, retest_attempt2_, etc.)
    // ⚠️ REMOVED: Manual attempt counting
    // ⚠️ REMOVED: Manual completion calculation based on attempts
    // Backend will return retest_is_completed flag on next API call
    // If backend says retest is NOT completed (e.g., more attempts available), API refresh will clear this key
  }
}

