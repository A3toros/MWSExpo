# Retest Filtering Fix Plan

## Web App Filtering Logic (Reference)

**Backend** (`functions/get-student-active-tests.js` lines 210-213):
```javascript
// Skip if completed AND no retest available
if (isCompleted && !retestAvailable) {
  continue; // Skip this test
}
```

**Frontend** (`src/student/StudentCabinet.jsx` line 440):
```javascript
if (completedTests.has(testKey) && !test?.retest_available) {
  return; // Block starting test
}
```

**Web app rule**: Show test if `retest_available = true`, regardless of completion status.

## Problem

When a retest is submitted and marked as completed:
1. `markTestCompleted` correctly marks it as completed and sets metadata (used >= max)
2. On dashboard refresh, `processRetestAvailability` runs
3. API still shows `retest_available: true` with `retest_attempts_left: 1` (backend hasn't updated yet)
4. `processRetestAvailability` clears the completion flag because it only checks API data
5. Test shows as "Start Retest" again instead of "Completed"

## Root Cause

`processRetestAvailability` only checks API data (`retest_attempts_left`) to determine if it should clear completion. It doesn't check the local metadata that `markTestCompleted` sets when a retest is completed.

## How Web App Handles This

The web app uses the **same approach** - it checks local attempt tracking:

1. **`checkTestCompleted` function** (lines 331-356):
   - When `retestAvailable = true`, checks localStorage attempt keys (`retest_attempt1_`, `retest_attempt2_`, etc.)
   - Counts attempts: `currentAttempts = attemptKeys.length`
   - Compares with `maxAttempts` from test data
   - If `currentAttempts >= maxAttempts` → returns `true` (completed)

2. **Button rendering** (lines 906-925):
   - Checks `retest_attempts_${studentId}_${testType}_${testId}` metadata
   - If `meta.used >= meta.max` → shows "✓ Completed" (disabled) instead of "Start Retest"
   - Even when API says `retest_available = true`

**Web app rule**: Use local attempt tracking/metadata to determine if retest is actually completed, regardless of API `retest_available` flag.

## Solution

**Only fix `processRetestAvailability` to check metadata before clearing completion:**

1. Before clearing completion flag, check if metadata exists
2. If metadata exists and shows attempts exhausted (`used >= max`), **DO NOT** clear completion
3. Only clear completion if:
   - No metadata exists (fresh retest offer, not taken yet), OR
   - Metadata exists but attempts left (`used < max`)

## Implementation

### Step 1: Modify `processRetestAvailability` in `retestUtils.ts`

**Current logic (lines 57-84):**
```typescript
if (hasAttemptsLeft) {
  // Clear completion key so test doesn't show as completed
  await AsyncStorage.removeItem(completionKey);
  // ...
}
```

**New logic:**
```typescript
if (hasAttemptsLeft) {
  // Check metadata first - if attempts exhausted, don't clear completion
  const attemptsMetaKey = `retest_attempts_${studentId}_${test.test_type}_${test.test_id}`;
  const attemptsMetaRaw = await AsyncStorage.getItem(attemptsMetaKey);
  
  if (attemptsMetaRaw) {
    try {
      const attemptsMeta = JSON.parse(attemptsMetaRaw);
      const attemptsLeft = attemptsMeta.max - attemptsMeta.used;
      
      if (attemptsLeft <= 0) {
        // Attempts exhausted - keep completion flag, don't clear it
        console.log('🎓 Retest attempts exhausted (metadata) - keeping completion:', completionKey);
        return; // Don't process retest setup
      }
      // Attempts left - continue with retest setup
    } catch (e) {
      console.warn('Error parsing retest attempts metadata:', e);
      // Continue with retest setup if metadata parse fails
    }
  }
  
  // No metadata or attempts left - set up retest
  await AsyncStorage.setItem(retestKey, 'true');
  // ... rest of retest setup
  await AsyncStorage.removeItem(completionKey);
  // ...
}
```

## Key Points

- **Only change**: Add metadata check before clearing completion in `processRetestAvailability`
- **No other changes**: Don't touch `markTestCompleted`, filtering logic in `ActiveTestsView`, or any other retest logic
- **Preserves existing behavior**: If no metadata exists, behavior is unchanged (fresh retest offer)
- **Fixes bug**: If metadata shows attempts exhausted, completion stays set

## Verification

After fix:
- ✅ Retest submitted and completed → marked as completed → stays completed on refresh
- ✅ Fresh retest offer (no metadata) → completion cleared → shows as retest
- ✅ Retest with attempts left (metadata shows used < max) → completion cleared → shows as retest
- ✅ Retest with attempts exhausted (metadata shows used >= max) → completion stays → shows as completed

