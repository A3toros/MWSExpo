# Retest Completion Function Consolidation Plan

## Current State

### Two Separate Functions:

1. **`markTestCompleted`** (lines 121-135)
   - Simple function for regular tests
   - Marks as completed
   - Clears retest keys
   - Used by: matching, drawing, fill-blanks, word-matching, multiple-choice, true-false

2. **`handleRetestCompletion`** (lines 206-292)
   - Complex function for retests with attempts tracking
   - Currently handles BOTH regular tests (lines 221-226) and retests
   - Retest logic: tracks attempts, marks completed only if attempts exhausted or passed
   - Used by: input test

## Goal

**Keep `markTestCompleted` as the main function** and enhance it to handle retests:
- Regular tests: Simple completion (existing behavior)
- Retests: Tracks attempts and marks completed only if attempts exhausted or passed
- Remove `handleRetestCompletion` (merge its logic into `markTestCompleted`)

## Implementation Plan

### Step 1: Enhance `markTestCompleted` to handle retests

**New signature:**
```typescript
export async function markTestCompleted(
  studentId: string,
  testType: string,
  testId: string | number | string[] | undefined | null,
  maxAttempts?: number,  // Optional - only needed for retests
  percentage?: number,   // Optional - only needed for retests
  passed?: boolean       // Optional - only needed for retests
): Promise<void>
```

**Logic:**
1. Check if it's a retest (retest_assignment_id exists)
2. **If NOT retest:**
   - Mark as completed (simple)
   - Clear retest keys
   - Return early (existing behavior)
3. **If retest:**
   - Require `maxAttempts`, `percentage`, `passed` parameters
   - Write attempt keys
   - Check if attempts exhausted OR passed
   - Mark as completed only if attempts exhausted or passed
   - Otherwise, don't mark as completed (allows retake)

### Step 2: Remove `handleRetestCompletion` function

- Delete the function entirely
- All callers will use `markTestCompleted` instead

### Step 3: Update ALL 8 test types to use `markTestCompleted`

**Test types:**
1. `multiple-choice/[testId]/index.tsx` (line 399)
2. `true-false/[testId]/index.tsx` (line 473)
3. `input/[testId]/index.tsx` (line 734) - currently uses `handleRetestCompletion`
4. `matching/[testId]/index.tsx` (line 514)
5. `drawing/[testId]/index.tsx` (line 839)
6. `fill-blanks/[testId]/index.tsx` (line 510)
7. `word-matching/[testId]/index.tsx` (line 359)
8. `speaking/[testId]/index.tsx` - check if it uses completion

**For each test type:**

**If retest (retestAssignmentId exists):**
```typescript
if (retestAssignmentId) {
  const percentage = /* calculate from score */;
  const passed = percentage >= 60;
  const maxAttempts = testData?.retest_attempts_left || testData?.max_attempts || 3;
  await markTestCompleted(studentId, testType, testIdStr, maxAttempts, percentage, passed);
}
```

**If regular test (no retestAssignmentId):**
```typescript
else {
  await markTestCompleted(studentId, testType, testIdStr);
}
```

## Detailed Implementation

### Step 1: Enhanced `markTestCompleted` Function Implementation

```typescript
/**
 * Mark test as completed and clear retest keys (web app pattern)
 * Also handles retest completion with attempts tracking
 * - Regular tests: Simple completion
 * - Retests: Tracks attempts and marks completed only if attempts exhausted or passed
 */
export async function markTestCompleted(
  studentId: string,
  testType: string,
  testId: string | number | string[] | undefined | null,
  maxAttempts?: number,
  percentage?: number,
  passed?: boolean
): Promise<void> {
  // Handle array case from Expo Router params
  const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
  
  // Check if this is a retest
  const retestAssignKey = `retest_assignment_id_${studentId}_${testType}_${testIdStr}`;
  const retestAssignmentId = await AsyncStorage.getItem(retestAssignKey);
  const isRetest = !!retestAssignmentId;
  
  if (!isRetest) {
    // Regular test - simple completion (existing behavior)
    const completionKey = `test_completed_${studentId}_${testType}_${testIdStr}`;
    await AsyncStorage.setItem(completionKey, 'true');
    
    // Clear retest keys (web app pattern)
    await clearRetestKeys(studentId, testType, testIdStr);
    
    console.log('🎓 Marked test as completed:', completionKey);
    return;
  }
  
  // Retest submission - require parameters
  if (maxAttempts === undefined || percentage === undefined || passed === undefined) {
    console.error('🎓 markTestCompleted called for retest but missing required parameters (maxAttempts, percentage, passed)');
    throw new Error('Retest completion requires maxAttempts, percentage, and passed parameters');
  }
  
  // Retest logic (from handleRetestCompletion)
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
    
    // Clear retest keys
    await clearRetestKeys(studentId, testType, testIdStr);
    
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
```

### Step 2: Update All Test Submissions

**Pattern for all tests:**

```typescript
if (response.data.success) {
  const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
  
  if (retestAssignmentId) {
    // Retest - calculate score and pass status
    const percentage = /* calculate from score/maxScore */;
    const passed = percentage >= 60;
    const maxAttempts = testData?.retest_attempts_left || testData?.max_attempts || 3;
    await markTestCompleted(studentId, testType, testIdStr, maxAttempts, percentage, passed);
  } else {
    // Regular test - simple completion
    await markTestCompleted(studentId, testType, testIdStr);
  }
}
```

**Specific implementations for each test type:**

1. **multiple-choice** (line 399): Already has `percentage` at line 320, `score` and `maxScore` available
2. **true-false** (line 473): Already has `percentage` at line 433
3. **input** (line 734): Currently uses `handleRetestCompletion`, needs to switch to `markTestCompleted`
4. **matching** (line 514): Calculate `percentage` from score/maxScore
5. **drawing** (line 839): Calculate `percentage` from score/maxScore
6. **fill-blanks** (line 510): Calculate `percentage` from score/maxScore
7. **word-matching** (line 359): Calculate `percentage` from score/maxScore
8. **speaking**: Check if it uses completion logic

## Verification

After implementation:
- ✅ ALL tests use single `markTestCompleted` function
- ✅ Regular tests → marked as completed
- ✅ Retests with no attempts left → marked as completed
- ✅ Retests with attempts left and passed → marked as completed
- ✅ Retests with attempts left and failed → NOT marked as completed
- ✅ `handleRetestCompletion` function removed (no longer needed)

## Notes

- `markTestCompleted` is the single source of truth for test completion
- Consistent behavior across all test types
- Easier to maintain and debug
- Function name clearly indicates its purpose
