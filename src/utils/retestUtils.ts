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

  // ⚠️ REMOVED: No longer delete completion keys - API handles filtering
  // Completion keys are kept temporarily until API refresh

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
    const allKeys = await AsyncStorage.getAllKeys();
    const toDelete = allKeys.filter(key => {
      if (!key) return false;
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
 * Handle retest completion after submission - write attempt keys and check if completed
 * (same as web app pattern)
 */
export async function handleRetestCompletion(
  studentId: string,
  testType: string,
  testId: string | number,
  maxAttempts: number,
  percentage: number,
  passed: boolean
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
  
  // Retest submission - write attempt key and check completion
  const passedNow = passed || percentage >= 60; // 60% is passing threshold
  
  // If passed, mark last attempt slot (web app pattern)
  if (passedNow) {
    const lastSlotKey = `retest_attempt${maxAttempts}_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(lastSlotKey, 'true');
    console.log('🎓 Passed retest, marking last-slot key:', lastSlotKey);
  } else {
    // Find next available attempt slot
    let attemptNumber = 1;
    for (let i = 1; i <= maxAttempts; i++) {
      const attemptKey = `retest_attempt${i}_${studentId}_${testType}_${testIdStr}`;
      const attemptExists = await AsyncStorage.getItem(attemptKey);
      if (!attemptExists) {
        attemptNumber = i;
        break;
      }
    }
    
    const attemptKey = `retest_attempt${attemptNumber}_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(attemptKey, 'true');
    console.log('🎓 Marked retest attempt as completed:', attemptKey);
  }
  
  // Count actual attempts used after marking this attempt
  let usedAttempts = 0;
  for (let i = 1; i <= 10; i++) {
    const attemptKey = `retest_attempt${i}_${studentId}_${testType}_${testIdStr}`;
    const attemptExists = await AsyncStorage.getItem(attemptKey);
    if (attemptExists === 'true') {
      usedAttempts++;
    }
  }
  
  // Check if attempts exhausted OR student passed
  const attemptsLeft = maxAttempts - usedAttempts;
  const shouldComplete = attemptsLeft <= 0 || passedNow;
  
  console.log('🎓 Retest completion check:', { 
    usedAttempts, 
    maxAttempts, 
    attemptsLeft, 
    passedNow, 
    shouldComplete 
  });
  
  if (shouldComplete) {
    // Mark retest as completed (attempts exhausted OR passed)
    const completionKey = `test_completed_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(completionKey, 'true');
    console.log('🎓 Marked retest as completed (attempts exhausted or passed):', completionKey);
    
    // Set retest_attempts metadata so button logic can check if attempts are exhausted
    const attemptsMetaKey = `retest_attempts_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(attemptsMetaKey, JSON.stringify({ used: usedAttempts, max: maxAttempts }));
    console.log('🎓 Set retest attempts metadata:', attemptsMetaKey, { used: usedAttempts, max: maxAttempts });
  } else {
    // Still have attempts left - set metadata but don't mark as completed
    const attemptsMetaKey = `retest_attempts_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(attemptsMetaKey, JSON.stringify({ used: usedAttempts, max: maxAttempts }));
    console.log('🎓 Set retest attempts metadata (attempts remaining):', attemptsMetaKey, { used: usedAttempts, max: maxAttempts });
  }
}

