# NativeWind Complete Rewrite Plan

## Overview
Complete rewrite of the dashboard and all components to use NativeWind/Tailwind classes instead of StyleSheet.create(), while maintaining exact same visual appearance and functionality.

## Current State Analysis

### What We Have:
- ✅ NativeWind v4.2.1 installed
- ✅ TailwindCSS v4.1.14 configured
- ✅ PostCSS configured
- ❌ Not using NativeWind - all styles are StyleSheet.create()

### Current Dashboard Structure:
```
app/(tabs)/index.tsx (770 lines)
├── Main Dashboard Component
├── Swipe Menu Implementation
├── View Components (ActiveTestsView, ResultsView, ProfileView)
└── StyleSheet.create() styles (200+ lines)
```

## Rewrite Plan

### Phase 1: Setup NativeWind Configuration

#### 1.1 Update Babel Configuration
**File**: `babel.config.js`
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel', // Add NativeWind babel plugin
    ],
  };
};
```

#### 1.2 Update Tailwind Configuration
**File**: `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors from current styles
        'menu-purple': '#8E66EB',
        'menu-blue': '#5F64E8',
        'header-blue': '#3b82f6',
        'light-blue': '#76CBEF',
        'light-gray': '#f8fafc',
        'dark-gray': '#1f2937',
        'medium-gray': '#374151',
        'text-gray': '#6b7280',
        'border-gray': '#e5e7eb',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    },
  },
  plugins: [],
}
```

#### 1.3 Create Global Styles
**File**: `src/styles/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Phase 2: Convert Main Dashboard

#### 2.1 Main Dashboard Component
**File**: `app/(tabs)/index.tsx`

**Current StyleSheet approach:**
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 20,
    paddingBottom: 16,
  },
  // ... 200+ more lines
});
```

**NativeWind approach:**
```jsx
<View className="flex-1 bg-light-gray">
  <View className="bg-header-blue pt-5 pb-4">
    <View className="flex-row justify-between items-center px-4">
      <View className="flex-row items-center">
        <View className="w-12 h-12 bg-white rounded-full justify-center items-center mr-3">
          <Text className="text-header-blue text-2xl font-semibold">S</Text>
        </View>
        <View>
          <Text className="text-white text-lg font-bold">Bawonchai Udomkhongmangmee</Text>
          <Text className="text-blue-200 text-sm">Grade 1 - Class 15</Text>
        </View>
      </View>
    </View>
  </View>
</View>
```

#### 2.2 Swipe Menu Conversion
**Current:**
```javascript
overlayMenu: {
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  backgroundColor: '#8E66EB',
  zIndex: 1000,
  elevation: 1000,
},
overlayMenuItem: {
  paddingVertical: 15,
  paddingHorizontal: 20,
  marginVertical: 5,
  backgroundColor: '#5F64E8',
  borderRadius: 8,
},
```

**NativeWind:**
```jsx
<View className="absolute top-0 left-0 h-full bg-menu-purple z-50">
  <View className="flex-1 pt-12 px-1">
    <TouchableOpacity className="py-4 px-5 my-1 bg-menu-blue rounded-lg">
      <Text className="text-white text-base font-medium">Active Tests</Text>
    </TouchableOpacity>
  </View>
</View>
```

### Phase 3: Convert View Components

#### 3.1 ActiveTestsView Component
**File**: `src/components/dashboard/ActiveTestsView.tsx`

**Current:**
```javascript
const styles = StyleSheet.create({
  section: {
    margin: 16,
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
});
```

**NativeWind:**
```jsx
<View className="m-4">
  <Text className="text-lg font-bold text-dark-gray mb-3 text-center">Active Tests</Text>
  
  <View className="bg-white rounded-xl p-4 shadow-sm">
    {tests.map((test, index) => (
      <View key={`test-${test.test_id}-${index}`} className="flex-row justify-between items-center py-3 border-b border-gray-100">
        <View className="flex-1">
          <Text className="text-base font-semibold text-dark-gray mb-1">{test.test_name}</Text>
          <View className="flex-row items-center flex-wrap">
            <Text className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2 mb-1">{test.subject}</Text>
            <Text className="text-xs text-text-gray mr-2 mb-1">{test.teacher_name}</Text>
            <Text className="text-xs text-text-gray mb-1">
              {new Date(test.assigned_at || 0).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <TouchableOpacity className="bg-header-blue px-4 py-2 rounded">
          <Text className="text-white text-sm font-semibold">Start Test</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
</View>
```

#### 3.2 ResultsView Component
**File**: `src/components/dashboard/ResultsView.tsx`

**NativeWind conversion:**
```jsx
<View className="m-4">
  <Text className="text-lg font-bold text-dark-gray mb-3 text-center">Test Results</Text>
  <View className="bg-white rounded-xl p-4 shadow-sm">
    <ResultsTable
      results={results}
      loading={loading}
      showAllResults={showAllResults}
      onToggleShowAll={onToggleShowAll}
      maxInitial={3}
      compact={false}
    />
  </View>
</View>
```

#### 3.3 ProfileView Component
**File**: `src/components/dashboard/ProfileView.tsx`

**NativeWind conversion:**
```jsx
<View className="m-4">
  <Text className="text-lg font-bold text-dark-gray mb-3 text-center">Profile</Text>
  
  <View className="bg-white rounded-xl p-4 shadow-sm">
    <View className="flex-row items-center mb-6 pb-4 border-b border-gray-100">
      <View className="w-15 h-15 bg-header-blue rounded-full justify-center items-center mr-4">
        <Text className="text-white text-2xl font-semibold">
          {user?.name?.charAt(0) || 'S'}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-xl font-bold text-dark-gray mb-1">
          {user?.name} {user?.surname}
        </Text>
        <Text className="text-base text-text-gray mb-1">
          Grade {user?.grade} - Class {user?.class}
        </Text>
        <Text className="text-sm text-gray-400">
          Student ID: {user?.student_id}
        </Text>
      </View>
    </View>

    <View className="space-y-3">
      <TouchableOpacity className="bg-gray-50 py-3 px-4 rounded-lg border border-gray-200 items-center">
        <Text className="text-base font-medium text-gray-700">Change Password</Text>
      </TouchableOpacity>
      
      <TouchableOpacity className="bg-red-50 py-3 px-4 rounded-lg border border-red-200 items-center">
        <Text className="text-base font-medium text-red-600">Logout</Text>
      </TouchableOpacity>
    </View>
  </View>
</View>
```

### Phase 4: Convert ResultsTable Component

#### 4.1 ResultsTable Component
**File**: `src/components/ResultsTable.tsx`

**Current StyleSheet approach:**
```javascript
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
```

**NativeWind approach:**
```jsx
<View className="bg-white rounded-lg p-4">
  <View className="flex-row bg-gray-50 py-3 px-4 border-b border-gray-200">
    <Text className="text-sm font-semibold text-gray-700 flex-1">Test</Text>
    <Text className="text-sm font-semibold text-gray-700 w-20 text-center">Score</Text>
    <Text className="text-sm font-semibold text-gray-700 w-20 text-center">Date</Text>
  </View>
  {results.map((result, index) => (
    <View key={index} className="flex-row py-3 px-4 border-b border-gray-100">
      <Text className="text-sm text-gray-900 flex-1">{result.test_name}</Text>
      <Text className={`text-sm font-medium w-20 text-center ${
        result.score >= 80 ? 'text-green-600' : 
        result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
      }`}>
        {result.score}%
      </Text>
      <Text className="text-sm text-gray-500 w-20 text-center">
        {new Date(result.completed_at).toLocaleDateString()}
      </Text>
    </View>
  ))}
</View>
```

### Phase 5: Convert All Test Components

#### 5.1 Drawing Test Component
**File**: `app/tests/drawing/[testId]/index.tsx`

**Key conversions:**
- Tool selection buttons
- Canvas container
- Question navigation
- Submit button

**Example:**
```jsx
// Tool buttons
<View className="flex-row justify-center space-x-2 mb-4">
  <TouchableOpacity className={`w-12 h-12 rounded-lg justify-center items-center ${
    currentTool === 'pencil' ? 'bg-header-blue' : 'bg-gray-200'
  }`}>
    <Text className="text-lg">✏️</Text>
  </TouchableOpacity>
  <TouchableOpacity className={`w-12 h-12 rounded-lg justify-center items-center ${
    currentTool === 'eraser' ? 'bg-header-blue' : 'bg-gray-200'
  }`}>
    <Text className="text-lg">🧹</Text>
  </TouchableOpacity>
</View>

// Submit button
<TouchableOpacity className="bg-violet-600 py-3 px-6 rounded-lg mx-4 mb-4">
  <Text className="text-white text-center font-semibold text-lg">Submit Test</Text>
</TouchableOpacity>
```

#### 5.2 Matching Test Component
**File**: `app/tests/matching/[testId]/index.tsx`

**Key conversions:**
- Drag and drop areas
- Word items
- Submit button

#### 5.3 All Other Test Components
- Speaking Test
- Multiple Choice Test
- True/False Test
- Input Test
- Fill Blanks Test
- Word Matching Test

### Phase 6: Convert Utility Components

#### 6.1 ErrorBoundary Component
**File**: `src/components/ErrorBoundary.tsx`

#### 6.2 All UI Components
**Files**: `src/components/ui/`
- Button.jsx
- Card.jsx
- Input.jsx
- Modal.jsx
- etc.

### Phase 7: Remove All StyleSheet.create()

#### 7.1 Delete StyleSheet Imports
Remove all `StyleSheet` imports from components:
```javascript
// Remove this
import { StyleSheet } from 'react-native';

// Remove this
const styles = StyleSheet.create({...});
```

#### 7.2 Replace style Props
Replace all `style={styles.xyz}` with `className="..."`

### Phase 8: Testing and Validation

#### 8.1 Visual Testing
- Compare screenshots before/after
- Ensure all colors match exactly
- Verify all spacing and layouts
- Test on different screen sizes

#### 8.2 Functionality Testing
- Test all navigation
- Test all interactions
- Test all form submissions
- Test all animations

#### 8.3 Performance Testing
- Measure bundle size impact
- Test rendering performance
- Test memory usage

## Implementation Timeline

### Week 1: Setup and Main Dashboard
- [ ] Configure NativeWind properly
- [ ] Convert main dashboard component
- [ ] Convert swipe menu
- [ ] Test basic functionality

### Week 2: View Components
- [ ] Convert ActiveTestsView
- [ ] Convert ResultsView  
- [ ] Convert ProfileView
- [ ] Convert ResultsTable

### Week 3: Test Components
- [ ] Convert Drawing Test
- [ ] Convert Matching Test
- [ ] Convert Speaking Test
- [ ] Convert other test types

### Week 4: Polish and Testing
- [ ] Convert remaining components
- [ ] Remove all StyleSheet.create()
- [ ] Comprehensive testing
- [ ] Performance optimization

## Phase 9: Structure Integrity & Modal Components

### 9.1 Structure Integrity Rules

#### 9.1.1 Component Preservation
**CRITICAL**: All existing components must remain in their exact same locations:
- `src/components/` - All UI components stay here
- `src/components/dashboard/` - Dashboard view components
- `src/components/ui/` - Reusable UI components
- `src/components/forms/` - Form components
- `src/components/modals/` - Modal components
- `app/tests/` - Test screens stay in same structure
- `app/(tabs)/` - Tab navigation structure unchanged

#### 9.1.2 File Structure Preservation
**MUST MAINTAIN**:
```
MWSExpo/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx (Dashboard - MAIN SCREEN)
│   │   ├── results.tsx
│   │   └── profile.tsx
│   └── tests/
│       ├── drawing/[testId]/index.tsx
│       ├── matching/[testId]/index.tsx
│       ├── input/[testId]/index.tsx
│       ├── multiple-choice/[testId]/index.tsx
│       ├── true-false/[testId]/index.tsx
│       ├── fill-blanks/[testId]/index.tsx
│       └── speaking/[testId]/index.tsx
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── ActiveTestsView.tsx
│   │   │   ├── ResultsView.tsx
│   │   │   └── ProfileView.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── Modal.tsx
│   │   └── modals/
│   │       ├── LoadingModal.tsx
│   │       ├── SubmitModal.tsx
│   │       └── ConfirmationModal.tsx
│   └── services/
│       └── AcademicCalendarService.ts
```

#### 9.1.3 Functionality Preservation
**NO CHANGES TO**:
- Redux store structure (`src/store/`)
- API client functionality (`src/services/apiClient.ts`)
- Authentication flow (`src/contexts/AuthContext.tsx`)
- Test submission logic
- Navigation structure
- AsyncStorage usage patterns

### 9.2 Modal Components Implementation

#### 9.2.1 Loading Spinner Modal
**File**: `src/components/modals/LoadingModal.tsx`

**Purpose**: Show loading state during API calls, test loading, data fetching
**Usage**: Test loading, submission, data refresh

```jsx
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Modal } from 'react-native';

interface LoadingModalProps {
  visible: boolean;
  message?: string;
  showSpinner?: boolean;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  visible,
  message = "Loading...",
  showSpinner = true
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-white rounded-lg p-6 items-center min-w-[200px]">
          {showSpinner && (
            <ActivityIndicator 
              size="large" 
              color="#8E66EB" 
              className="mb-4"
            />
          )}
          <Text className="text-gray-800 text-center font-medium">
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
};
```

#### 9.2.2 Submit Confirmation Modal
**File**: `src/components/modals/SubmitModal.tsx`

**Purpose**: Confirm test submission with violet styling
**Usage**: Before submitting any test

```jsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Modal } from 'react-native';

interface SubmitModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testName?: string;
  questionCount?: number;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  testName = "Test",
  questionCount
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-xl p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">
            Submit {testName}?
          </Text>
          
          {questionCount && (
            <Text className="text-gray-600 text-center mb-4">
              {questionCount} question{questionCount > 1 ? 's' : ''} completed
            </Text>
          )}
          
          <Text className="text-gray-600 text-center mb-6">
            Are you sure you want to submit your answers? This action cannot be undone.
          </Text>
          
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 bg-gray-200 py-3 rounded-lg"
            >
              <Text className="text-gray-700 text-center font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onConfirm}
              className="flex-1 bg-[#8E66EB] py-3 rounded-lg"
            >
              <Text className="text-white text-center font-semibold">
                Submit
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
```

#### 9.2.3 Success/Error Feedback Modal
**File**: `src/components/modals/FeedbackModal.tsx`

**Purpose**: Show success/error messages after actions
**Usage**: After test submission, API errors, completion confirmations

```jsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Modal } from 'react-native';

interface FeedbackModalProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 3000
}) => {
  useEffect(() => {
    if (visible && autoClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, autoCloseDelay, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          buttonColor: 'bg-green-600',
          iconColor: 'text-green-600'
        };
      case 'error':
        return {
          icon: '❌',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          buttonColor: 'bg-red-600',
          iconColor: 'text-red-600'
        };
      default:
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          buttonColor: 'bg-blue-600',
          iconColor: 'text-blue-600'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className={`${styles.bgColor} ${styles.borderColor} border-2 rounded-xl p-6 w-full max-w-sm`}>
          <Text className={`text-4xl text-center mb-4 ${styles.iconColor}`}>
            {styles.icon}
          </Text>
          
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">
            {title}
          </Text>
          
          <Text className="text-gray-600 text-center mb-6">
            {message}
          </Text>
          
          <TouchableOpacity
            onPress={onClose}
            className={`${styles.buttonColor} py-3 rounded-lg`}
          >
            <Text className="text-white text-center font-semibold">
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
```

#### 9.2.4 Navigation Confirmation Modal
**File**: `src/components/modals/NavigationModal.tsx`

**Purpose**: Confirm navigation when leaving tests with unsaved changes
**Usage**: When user tries to leave test with unsaved progress

```jsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Modal } from 'react-native';

interface NavigationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export const NavigationModal: React.FC<NavigationModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  title,
  message
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-xl p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-gray-800 text-center mb-4">
            {title}
          </Text>
          
          <Text className="text-gray-600 text-center mb-6">
            {message}
          </Text>
          
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 bg-gray-200 py-3 rounded-lg"
            >
              <Text className="text-gray-700 text-center font-semibold">
                Stay
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onConfirm}
              className="flex-1 bg-[#8E66EB] py-3 rounded-lg"
            >
              <Text className="text-white text-center font-semibold">
                Leave
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
```

### 9.3 Modal Integration Points

#### 9.3.1 Test Loading Integration
**Files**: All test screens (`app/tests/*/[testId]/index.tsx`)

```jsx
// Add to test screens
import { LoadingModal } from '../../../src/components/modals/LoadingModal';
import { SubmitModal } from '../../../src/components/modals/SubmitModal';
import { FeedbackModal } from '../../../src/components/modals/FeedbackModal';

// State for modals
const [showLoading, setShowLoading] = useState(false);
const [showSubmit, setShowSubmit] = useState(false);
const [showFeedback, setShowFeedback] = useState(false);
const [feedbackData, setFeedbackData] = useState({ type: 'success', title: '', message: '' });

// Usage in test loading
useEffect(() => {
  const loadTest = async () => {
    setShowLoading(true);
    try {
      // Load test data
      await loadTestData();
    } catch (error) {
      setFeedbackData({
        type: 'error',
        title: 'Loading Failed',
        message: 'Could not load test. Please try again.'
      });
      setShowFeedback(true);
    } finally {
      setShowLoading(false);
    }
  };
  
  loadTest();
}, []);

// Usage in test submission
const handleSubmit = () => {
  setShowSubmit(true);
};

const confirmSubmit = async () => {
  setShowSubmit(false);
  setShowLoading(true);
  
  try {
    await submitTest();
    setFeedbackData({
      type: 'success',
      title: 'Test Submitted',
      message: 'Your test has been submitted successfully!'
    });
    setShowFeedback(true);
  } catch (error) {
    setFeedbackData({
      type: 'error',
      title: 'Submission Failed',
      message: 'Could not submit test. Please try again.'
    });
    setShowFeedback(true);
  } finally {
    setShowLoading(false);
  }
};
```

#### 9.3.2 Dashboard Integration
**File**: `app/(tabs)/index.tsx`

```jsx
// Add to dashboard
import { LoadingModal } from '../../src/components/modals/LoadingModal';
import { FeedbackModal } from '../../src/components/modals/FeedbackModal';

// Usage in data fetching
const fetchData = async () => {
  setShowLoading(true);
  try {
    // Fetch dashboard data
    await loadDashboardData();
  } catch (error) {
    setFeedbackData({
      type: 'error',
      title: 'Loading Failed',
      message: 'Could not load dashboard data.'
    });
    setShowFeedback(true);
  } finally {
    setShowLoading(false);
  }
};
```

### 9.4 Modal Usage Guidelines

#### 9.4.1 When to Use LoadingModal
- **Test Loading**: When loading test questions and data
- **Data Fetching**: When fetching user data, test results
- **API Calls**: During any async operation
- **File Uploads**: During image/audio uploads

#### 9.4.2 When to Use SubmitModal
- **Test Submission**: Before submitting any test
- **Data Saving**: Before saving important data
- **Navigation**: Before leaving with unsaved changes

#### 9.4.3 When to Use FeedbackModal
- **Success**: After successful test submission
- **Errors**: When API calls fail
- **Warnings**: When user actions have consequences
- **Info**: Important information for user

#### 9.4.4 When to Use NavigationModal
- **Test Navigation**: When leaving test with unsaved progress
- **Form Navigation**: When leaving forms with unsaved data
- **Critical Actions**: Before destructive actions

### 9.5 Modal Styling Consistency

#### 9.5.1 Color Scheme
- **Primary**: `#8E66EB` (Violet) - Submit buttons, primary actions
- **Success**: `#10B981` (Green) - Success states
- **Error**: `#EF4444` (Red) - Error states
- **Warning**: `#F59E0B` (Yellow) - Warning states
- **Info**: `#3B82F6` (Blue) - Information states

#### 9.5.2 Typography
- **Titles**: `text-xl font-bold text-gray-800`
- **Messages**: `text-gray-600`
- **Buttons**: `font-semibold`

#### 9.5.3 Spacing
- **Modal Padding**: `p-6`
- **Button Spacing**: `space-x-3`
- **Content Spacing**: `mb-4`, `mb-6`

## Phase 10: Add React Native Reanimated 3 Animations

### 9.1 Dashboard Animations

#### 9.1.1 Swipe Menu Animations
**File**: `app/(tabs)/index.tsx`

**Current**: Basic transform animations
**NativeWind + Reanimated**:
```jsx
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

// Smooth menu slide animation
const menuTranslateX = useSharedValue(-screenWidth * 0.6);
const menuAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: menuTranslateX.value }],
}));

// Menu backdrop fade
const backdropOpacity = useSharedValue(0);
const backdropAnimatedStyle = useAnimatedStyle(() => ({
  opacity: backdropOpacity.value,
}));

// Menu open/close functions
const openMenu = () => {
  menuTranslateX.value = withSpring(0, { damping: 15, stiffness: 150 });
  backdropOpacity.value = withTiming(0.5, { duration: 300 });
};

const closeMenu = () => {
  menuTranslateX.value = withSpring(-screenWidth * 0.6, { damping: 15, stiffness: 150 });
  backdropOpacity.value = withTiming(0, { duration: 300 });
};

// Usage
<Animated.View style={[menuAnimatedStyle]} className="absolute top-0 left-0 h-full bg-menu-purple z-50">
  <View className="flex-1 pt-12 px-1">
    {/* Menu items with hover animations */}
  </View>
</Animated.View>
```

#### 9.1.2 View Transition Animations
**File**: `app/(tabs)/index.tsx`

**Current**: Instant view switching
**NativeWind + Reanimated**:
```jsx
// Smooth view transitions
const viewOpacity = useSharedValue(1);
const viewScale = useSharedValue(1);

const switchView = (newView: string) => {
  // Fade out current view
  viewOpacity.value = withTiming(0, { duration: 200 }, () => {
    setCurrentView(newView);
    // Fade in new view
    viewOpacity.value = withTiming(1, { duration: 200 });
  });
  
  // Scale animation
  viewScale.value = withSpring(0.95, { damping: 15 }, () => {
    viewScale.value = withSpring(1, { damping: 15 });
  });
};

const viewAnimatedStyle = useAnimatedStyle(() => ({
  opacity: viewOpacity.value,
  transform: [{ scale: viewScale.value }],
}));

// Usage
<Animated.View style={viewAnimatedStyle}>
  {currentView === 'active' && <ActiveTestsView />}
  {currentView === 'results' && <ResultsView />}
  {currentView === 'profile' && <ProfileView />}
</Animated.View>
```

#### 9.1.3 Loading State Animations
**File**: `src/components/dashboard/ActiveTestsView.tsx`

**Current**: Static skeleton loading
**NativeWind + Reanimated**:
```jsx
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

// Skeleton loading animation
const skeletonOpacity = useSharedValue(0.3);
const skeletonAnimatedStyle = useAnimatedStyle(() => ({
  opacity: skeletonOpacity.value,
}));

useEffect(() => {
  skeletonOpacity.value = withRepeat(
    withTiming(1, { duration: 1000 }),
    -1,
    true
  );
}, []);

// Usage
{loading && (
  <Animated.View style={skeletonAnimatedStyle} className="bg-gray-200 rounded-lg h-16 mb-2" />
)}
```

### 9.2 Test Component Animations

#### 9.2.1 Drawing Test Animations
**File**: `app/tests/drawing/[testId]/index.tsx`

**Tool Selection Animations**:
```jsx
// Tool button press animation
const toolScale = useSharedValue(1);
const toolAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: toolScale.value }],
}));

const handleToolPress = (tool: string) => {
  // Scale down then up
  toolScale.value = withSpring(0.9, { damping: 15 }, () => {
    toolScale.value = withSpring(1, { damping: 15 });
  });
  setCurrentTool(tool);
};

// Usage
<Animated.View style={toolAnimatedStyle}>
  <TouchableOpacity className={`w-12 h-12 rounded-lg justify-center items-center ${
    currentTool === 'pencil' ? 'bg-header-blue' : 'bg-gray-200'
  }`}>
    <Text className="text-lg">✏️</Text>
  </TouchableOpacity>
</Animated.View>
```

**Canvas Zoom/Pan Animations**:
```jsx
// Smooth zoom transitions
const canvasScale = useSharedValue(1);
const canvasTranslateX = useSharedValue(0);
const canvasTranslateY = useSharedValue(0);

const canvasAnimatedStyle = useAnimatedStyle(() => ({
  transform: [
    { scale: canvasScale.value },
    { translateX: canvasTranslateX.value },
    { translateY: canvasTranslateY.value },
  ],
}));
```

#### 9.2.2 Matching Test Animations
**File**: `app/tests/matching/[testId]/index.tsx`

**Drag and Drop Animations**:
```jsx
// Word item drag animation
const wordScale = useSharedValue(1);
const wordRotation = useSharedValue(0);

const handleDragStart = () => {
  wordScale.value = withSpring(1.1, { damping: 15 });
  wordRotation.value = withSpring(5, { damping: 15 });
};

const handleDragEnd = () => {
  wordScale.value = withSpring(1, { damping: 15 });
  wordRotation.value = withSpring(0, { damping: 15 });
};

// Success feedback animation
const successScale = useSharedValue(0);
const successAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: successScale.value }],
}));

const showSuccess = () => {
  successScale.value = withSpring(1.2, { damping: 15 }, () => {
    successScale.value = withSpring(1, { damping: 15 });
  });
};
```

#### 9.2.3 Form Input Animations
**File**: `app/tests/input/[testId]/index.tsx`

**Input Focus Animations**:
```jsx
// Input focus animation
const inputScale = useSharedValue(1);
const inputBorderColor = useSharedValue(0);

const inputAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: inputScale.value }],
  borderColor: `rgba(59, 130, 246, ${inputBorderColor.value})`,
}));

const handleFocus = () => {
  inputScale.value = withSpring(1.02, { damping: 15 });
  inputBorderColor.value = withTiming(1, { duration: 200 });
};

const handleBlur = () => {
  inputScale.value = withSpring(1, { damping: 15 });
  inputBorderColor.value = withTiming(0, { duration: 200 });
};
```

### 9.3 Button and Interaction Animations

#### 9.3.1 Universal Button Animations
**File**: `src/components/ui/Button.tsx`

**Press Animations**:
```jsx
const buttonScale = useSharedValue(1);
const buttonAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: buttonScale.value }],
}));

const handlePressIn = () => {
  buttonScale.value = withSpring(0.95, { damping: 15 });
};

const handlePressOut = () => {
  buttonScale.value = withSpring(1, { damping: 15 });
};

// Usage
<Animated.View style={buttonAnimatedStyle}>
  <TouchableOpacity 
    onPressIn={handlePressIn}
    onPressOut={handlePressOut}
    className="bg-header-blue py-3 px-6 rounded-lg"
  >
    <Text className="text-white text-center font-semibold">Submit</Text>
  </TouchableOpacity>
</Animated.View>
```

#### 9.3.2 Card Hover Animations
**File**: `src/components/ui/Card.tsx`

**Hover Effects**:
```jsx
const cardScale = useSharedValue(1);
const cardShadow = useSharedValue(2);

const cardAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: cardScale.value }],
  shadowOpacity: cardShadow.value / 10,
}));

const handleHoverIn = () => {
  cardScale.value = withSpring(1.02, { damping: 15 });
  cardShadow.value = withTiming(8, { duration: 200 });
};

const handleHoverOut = () => {
  cardScale.value = withSpring(1, { damping: 15 });
  cardShadow.value = withTiming(2, { duration: 200 });
};
```

### 9.4 Page Transition Animations

#### 9.4.1 Navigation Animations
**File**: `app/_layout.tsx`

**Screen Transitions**:
```jsx
// Page slide animations
const pageTranslateX = useSharedValue(0);
const pageOpacity = useSharedValue(1);

const pageAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: pageTranslateX.value }],
  opacity: pageOpacity.value,
}));

// Navigation handler
const navigateWithAnimation = (route: string) => {
  pageTranslateX.value = withTiming(-screenWidth, { duration: 300 });
  pageOpacity.value = withTiming(0, { duration: 300 }, () => {
    router.push(route);
    pageTranslateX.value = screenWidth;
    pageOpacity.value = 0;
    pageTranslateX.value = withTiming(0, { duration: 300 });
    pageOpacity.value = withTiming(1, { duration: 300 });
  });
};
```

### 9.5 Micro-Interactions

#### 9.5.1 Success/Error Feedback
**File**: `src/components/ui/Feedback.tsx`

**Toast Animations**:
```jsx
const toastTranslateY = useSharedValue(-100);
const toastOpacity = useSharedValue(0);

const showToast = (message: string, type: 'success' | 'error') => {
  toastTranslateY.value = withSpring(0, { damping: 15 });
  toastOpacity.value = withTiming(1, { duration: 200 });
  
  setTimeout(() => {
    toastTranslateY.value = withSpring(-100, { damping: 15 });
    toastOpacity.value = withTiming(0, { duration: 200 });
  }, 3000);
};
```

#### 9.5.2 Loading Spinners
**File**: `src/components/ui/LoadingSpinner.tsx`

**Rotating Animation**:
```jsx
const rotation = useSharedValue(0);

useEffect(() => {
  rotation.value = withRepeat(
    withTiming(360, { duration: 1000 }),
    -1,
    false
  );
}, []);

const spinnerAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ rotate: `${rotation.value}deg` }],
}));
```

## Benefits of NativeWind + Reanimated 3

### 1. Developer Experience
- **Faster development**: No more writing StyleSheet objects
- **Better IntelliSense**: Tailwind autocomplete
- **Consistent spacing**: Using Tailwind's spacing scale
- **Easier maintenance**: Less code to maintain
- **Smooth animations**: Reanimated 3 for 60fps animations

### 2. Performance
- **Smaller bundle**: Tailwind purges unused styles
- **Better tree-shaking**: Only used classes are included
- **Faster compilation**: No StyleSheet processing
- **Native animations**: Reanimated runs on UI thread
- **60fps animations**: Smooth, responsive interactions

### 3. Consistency
- **Design system**: Consistent colors, spacing, typography
- **Responsive design**: Easy media queries
- **Dark mode**: Built-in dark mode support
- **Animation patterns**: Consistent animation timing and easing

### 4. Code Quality
- **Less boilerplate**: No more 200+ line StyleSheet objects
- **Better readability**: Classes are self-documenting
- **Easier refactoring**: Change classes instead of objects
- **Declarative animations**: Clear animation intentions

## File Structure After Rewrite

```
MWSExpo/
├── app/
│   ├── (tabs)/
│   │   └── index.tsx (NativeWind classes)
│   └── tests/
│       ├── drawing/[testId]/index.tsx (NativeWind)
│       ├── matching/[testId]/index.tsx (NativeWind)
│       └── ... (all test components)
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── ActiveTestsView.tsx (NativeWind)
│   │   │   ├── ResultsView.tsx (NativeWind)
│   │   │   └── ProfileView.tsx (NativeWind)
│   │   ├── ui/
│   │   │   └── ... (all NativeWind)
│   │   └── ResultsTable.tsx (NativeWind)
│   └── styles/
│       └── globals.css (Tailwind imports)
├── tailwind.config.js (Custom colors)
└── babel.config.js (NativeWind plugin)
```

## Migration Checklist

### Setup
- [ ] Update babel.config.js
- [ ] Update tailwind.config.js with custom colors
- [ ] Create globals.css
- [ ] Test NativeWind is working

### Main Dashboard
- [ ] Convert container styles
- [ ] Convert header styles
- [ ] Convert swipe menu styles
- [ ] Convert ScrollView styles
- [ ] Test navigation

### View Components
- [ ] Convert ActiveTestsView
- [ ] Convert ResultsView
- [ ] Convert ProfileView
- [ ] Convert ResultsTable
- [ ] Test all views

### Test Components
- [ ] Convert Drawing Test
- [ ] Convert Matching Test
- [ ] Convert Speaking Test
- [ ] Convert Multiple Choice
- [ ] Convert True/False
- [ ] Convert Input Test
- [ ] Convert Fill Blanks
- [ ] Convert Word Matching

### Cleanup
- [ ] Remove all StyleSheet imports
- [ ] Remove all StyleSheet.create() calls
- [ ] Remove all style props
- [ ] Test everything works

### Final Testing
- [ ] Visual comparison
- [ ] Functionality testing
- [ ] Performance testing
- [ ] Cross-platform testing

## Conclusion

This rewrite will modernize the entire codebase to use NativeWind while maintaining the exact same visual appearance and functionality. The result will be cleaner, more maintainable code with better developer experience and performance.
