# Web API Integration Plan

## 🎯 GOAL
Properly connect the React Native app to the existing web API at `https://mathayomwatsing.netlify.app`.

## 📋 CURRENT STATUS
- API client is configured to use `https://mathayomwatsing.netlify.app`
- All endpoints have `/api/` prefix for Netlify Functions
- Login currently uses mock data for development
- Need to fix CORS and authentication issues

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Fix API Configuration
1. **Update API Base URL**
   - Ensure all endpoints use correct base URL
   - Add proper headers for CORS
   - Configure timeout settings

2. **Fix Authentication Flow**
   - Remove mock login fallback
   - Use real `student-login` endpoint
   - Handle token refresh properly
   - Store tokens securely

### Phase 2: Test Core Endpoints
2. **Test Essential API Calls**
   - `POST /api/student-login` - Student authentication
   - `GET /api/get-student-active-tests` - Get active tests
   - `GET /api/get-test-questions` - Get test questions
   - `POST /api/submit-*-test` - Submit test answers
   - `GET /api/get-student-results-view` - Get results

### Phase 3: Handle CORS Issues
3. **Resolve Cross-Origin Problems**
   - Check Netlify CORS configuration
   - Add proper headers to requests
   - Handle preflight requests
   - Test from different environments

### Phase 4: Complete Integration
4. **Connect All Features**
   - Dashboard with real data
   - Test runner with real questions
   - Results display with real scores
   - File uploads (audio, images)
   - All question types working

### Phase 5: Production Testing
5. **Test Full App Flow**
   - Login with real credentials
   - Take complete tests
   - View results
   - Test all question types
   - Verify data persistence

## 🚀 IMMEDIATE NEXT STEPS

1. **Remove Mock Login** - Update login to use real API
2. **Test API Connection** - Verify endpoints are accessible
3. **Fix CORS Issues** - Ensure proper headers and configuration
4. **Test Authentication** - Verify login and token handling
5. **Connect Dashboard** - Load real data instead of mock data
   - Results display
   - All question types
   - Navigation

## 🔧 TECHNICAL APPROACH

### Option A: Replace API Client
- Modify existing `apiClient.ts` to use local functions
- Keep same interface, change implementation
- All existing code continues to work

### Option B: Create New Local API
- Create `localApi.ts` with all functions
- Update imports in components
- More work but cleaner separation

### Option C: Hybrid Approach
- Keep axios for production
- Add local fallback for development
- Best of both worlds

## 📊 MOCK DATA REQUIREMENTS

### Student Data
```typescript
interface Student {
  id: string;
  student_id: string;
  name: string;
  surname: string;
  nickname: string;
  grade: string;
  class: string;
  number: string;
}
```

## 🔧 COMPLETE API FUNCTIONS LIST

### Authentication & User Management
- [ ] `studentLogin(username, password)` - Student authentication
- [ ] `refreshToken()` - Token refresh
- [ ] `logout()` - Student logout
- [ ] `changeStudentPassword(studentId, oldPassword, newPassword)` - Password change

### Test Management
- [ ] `getStudentActiveTests()` - Get active tests for student
- [ ] `getActiveTests()` - Generic active tests endpoint
- [ ] `getTestQuestions(testId)` - Get questions for specific test
- [ ] `getTestAssignments(testId)` - Get test assignments
- [ ] `getTestPerformance(testId)` - Get test performance data
- [ ] `checkTestCompletion(testId, studentId)` - Check if test is completed
- [ ] `markTestCompleted(testId, studentId)` - Mark test as completed

### Test Submission (All Question Types)
- [ ] `submitTest(testId, answers)` - Generic test submission
- [ ] `submitTrueFalseTest(testId, answers)` - True/False test submission
- [ ] `submitMultipleChoiceTest(testId, answers)` - Multiple choice submission
- [ ] `submitInputTest(testId, answers)` - Input test submission
- [ ] `submitFillBlanksTest(testId, answers)` - Fill blanks submission
- [ ] `submitMatchingTest(testId, answers)` - Matching test submission
- [ ] `submitWordMatchingTest(testId, answers)` - Word matching submission
- [ ] `submitSpeakingTest(testId, answers)` - Speaking test submission
- [ ] `submitDrawingTest(testId, answers)` - Drawing test submission

### Results & Performance
- [ ] `getStudentResults(limit?)` - Get student test results
- [ ] `getStudentResultsView(limit?)` - Get results view
- [ ] `getTestResults(testId)` - Get specific test results
- [ ] `getStudentTestResults()` - Get all student test results
- [ ] `getStudentProfile()` - Get student profile
- [ ] `getStudentSubjects()` - Get student subjects

### Retest System
- [ ] `getRetestAssignments(studentId)` - Get retest assignments
- [ ] `getRetestEligibleStudents(testId)` - Get eligible students for retest
- [ ] `getRetestTargets(assignmentId)` - Get retest targets
- [ ] `createRetestAssignment(data)` - Create retest assignment
- [ ] `cancelRetestAssignment(assignmentId)` - Cancel retest assignment

### File Upload & Media
- [ ] `uploadSpeakingAudio(audioUri, testId, questionId)` - Upload speaking audio
- [ ] `uploadImage(imageData, folder)` - Upload images
- [ ] `processSpeakingAudioAI(audioBlob, testId, questionId)` - AI audio processing

### Score Management
- [ ] `updateDrawingTestScore(resultId, score, maxScore)` - Update drawing scores
- [ ] `updateSpeakingTestScore(resultId, score)` - Update speaking scores

### System & Monitoring
- [ ] `checkOverdueAssignments()` - Check overdue assignments
- [ ] `getSubjects()` - Get all subjects
- [ ] `getAcademicCalendar()` - Get academic calendar

### Test Data
```typescript
interface Test {
  test_id: number;
  test_name: string;
  test_type: string;
  teacher_name: string;
  assigned_at: number;
  deadline: number | null;
}
```

### Question Data
```typescript
interface Question {
  id: number;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer?: string;
  points: number;
  canvas_width?: number;
  canvas_height?: number;
  min_drawing_time?: number;
}
```

### Results Data
```typescript
interface Result {
  id: number;
  test_id: number;
  test_name: string;
  test_type: string;
  subject: string;
  teacher_name: string;
  score: number;
  max_score: number;
  percentage: number;
  submitted_at: string;
  best_retest_score?: number;
  best_retest_max_score?: number;
  caught_cheating?: boolean;
  visibility_change_times?: number;
}
```

## 🚀 IMPLEMENTATION STEPS

### Step 1: Create Mock Data
- [ ] Student profiles (3-5 students)
- [ ] Test assignments (5-8 tests)
- [ ] Question banks (20-30 questions)
- [ ] Previous results (10-15 results)
- [ ] Academic calendar data

### Step 2: Create Local API Functions
- [ ] `studentLogin(username, password)`
- [ ] `getStudentActiveTests()`
- [ ] `getActiveTests()` - Generic active tests endpoint
- [ ] `getTestQuestions(testId)`
- [ ] `submitTest(testId, answers)` - Generic test submission
- [ ] `submitTrueFalseTest(testId, answers)`
- [ ] `submitMultipleChoiceTest(testId, answers)`
- [ ] `submitInputTest(testId, answers)`
- [ ] `submitFillBlanksTest(testId, answers)`
- [ ] `submitMatchingTest(testId, answers)`
- [ ] `submitWordMatchingTest(testId, answers)`
- [ ] `submitSpeakingTest(testId, answers)`
- [ ] `submitDrawingTest(testId, answers)`
- [ ] `getStudentResults(limit?)`
- [ ] `getStudentResultsView(limit?)`
- [ ] `getTestResults(testId)`
- [ ] `getTestPerformance(testId)`
- [ ] `getStudentProfile()`
- [ ] `getStudentSubjects()`
- [ ] `getStudentTestResults()`
- [ ] `getSubjects()`
- [ ] `getAcademicCalendar()`
- [ ] `uploadSpeakingAudio(audioUri, testId, questionId)`
- [ ] `uploadImage(imageData, folder)`
- [ ] `processSpeakingAudioAI(audioBlob, testId, questionId)`
- [ ] `updateDrawingTestScore(resultId, score, maxScore)`
- [ ] `updateSpeakingTestScore(resultId, score)`
- [ ] `markTestCompleted(testId, studentId)`
- [ ] `checkTestCompletion(testId, studentId)`
- [ ] `getRetestAssignments(studentId)`
- [ ] `getRetestEligibleStudents(testId)`
- [ ] `getRetestTargets(assignmentId)`
- [ ] `createRetestAssignment(data)`
- [ ] `cancelRetestAssignment(assignmentId)`
- [ ] `checkOverdueAssignments()`
- [ ] `logout()`
- [ ] `changeStudentPassword(studentId, oldPassword, newPassword)`
- [ ] `refreshToken()`

### Step 3: Update API Client
- [ ] Replace axios calls with local functions
- [ ] Maintain same interface
- [ ] Add proper error handling
- [ ] Test all endpoints

### Step 4: Test All Features
- [ ] Login flow
- [ ] Dashboard display
- [ ] Test taking (all question types)
- [ ] Results display
- [ ] Navigation
- [ ] Error handling

## 🎯 SUCCESS CRITERIA
- [ ] App works completely offline
- [ ] All features function properly
- [ ] No network requests
- [ ] Realistic data and behavior
- [ ] Fast performance
- [ ] Easy to test and demo

## 📝 NOTES
- Keep the same API interface to minimize changes
- Use realistic mock data that matches production
- Include proper error handling
- Make it easy to switch back to network API
- Document all mock data for easy modification
