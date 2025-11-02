/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemedButton } from '../ui';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses, getCyberpunkClasses } from '../../utils/themeUtils';
import { useCyberpunkPulse, useCyberpunkGlow } from '../../utils/cyberpunkAnimations';

type ActiveTest = {
  test_id: number;
  test_name: string;
  test_type: string;
  subject?: string;
  teacher_name?: string;
  assigned_at?: number;
  deadline?: number | null;
  retest_available?: boolean;
  retest_attempts_left?: number | null;
};

type Props = {
  tests: ActiveTest[];
  loading: boolean;
  completedTests: Set<string>;
  isCompletionStatusLoaded: boolean;
  showAllTests: boolean;
  onToggleShowAll: () => void;
};

export function ActiveTestsView({ 
  tests, 
  loading, 
  completedTests, 
  isCompletionStatusLoaded, 
  showAllTests, 
  onToggleShowAll 
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const cyberpunkClasses = getCyberpunkClasses();
  const { animatedStyle: pulseStyle, startPulse } = useCyberpunkPulse();
  const { glowStyle, startGlow } = useCyberpunkGlow();
  
  const skeletonItems = Array.from({ length: 3 }).map((_, i) => i);

  return (
    <View className={`m-4 ${themeClasses.background}`}>
      <Text className={`text-lg font-bold ${themeClasses.text} mb-3 text-center`}>
        {themeMode === 'cyberpunk' ? 'ACTIVE TESTS' : 'Active Tests'}
      </Text>
      
      <View className={`${themeClasses.surface} rounded-xl p-4 shadow-md border ${themeClasses.border}`}>
        {loading ? (
          skeletonItems.map((i) => (
            <View key={`t-skel-${i}`} className={`${themeClasses.surface} rounded-lg h-15 mb-2 border ${themeClasses.border}`} />
          ))
        ) : tests.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-5xl mb-4">📝</Text>
            <Text className={`text-lg font-semibold ${themeClasses.text} mb-2`}>
              {themeMode === 'cyberpunk' ? 'NO ACTIVE TESTS' : 'No Active Tests'}
            </Text>
            <Text className={`text-sm ${themeClasses.textSecondary} text-center`}>
              {themeMode === 'cyberpunk' 
                ? 'NO ACTIVE TESTS AVAILABLE FOR YOUR CLASS AT THE MOMENT.'
                : 'No active tests available for your class at the moment.'
              }
            </Text>
          </View>
        ) : (
          (showAllTests ? tests : tests.slice(0, 3)).map((test, index) => (
            <View key={`test-${test.test_id}-${index}`} className={`flex-row justify-between items-center py-3 border-b ${themeClasses.border}`}>
              <View className="flex-1">
                <Text className={`text-base font-semibold ${themeClasses.text} mb-1`}>
                  {themeMode === 'cyberpunk' ? test.test_name.toUpperCase() : test.test_name}
                </Text>
                <View className="flex-row items-center flex-wrap">
                  <Text className={themeMode === 'cyberpunk' 
                    ? 'bg-black border border-cyan-400 text-cyan-400 text-xs px-2 py-1 rounded mr-2 mb-1 shadow-lg shadow-cyan-400/50'
                    : themeMode === 'dark'
                    ? 'bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded mr-2 mb-1'
                    : 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2 mb-1'
                  }>
                    {themeMode === 'cyberpunk' ? test.subject?.toUpperCase() : test.subject}
                  </Text>
                  <Text className={`text-xs ${themeClasses.textSecondary} mr-2 mb-1`}>
                    {themeMode === 'cyberpunk' ? test.teacher_name?.toUpperCase() : test.teacher_name}
                  </Text>
                  <Text className={`text-xs ${themeClasses.textSecondary} mb-1`}>
                    {new Date(test.assigned_at || 0).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              {(() => {
                const testKey = `${test.test_type}_${test.test_id}`;
                const isCompleted = completedTests.has(testKey);
                console.log('🎓 Checking test completion:', testKey, 'isCompleted:', isCompleted, 'completedTests:', Array.from(completedTests));
                
                // Show loading state while completion status is being determined
                if (!isCompletionStatusLoaded) {
                  return (
                    <ThemedButton
                      title={themeMode === 'cyberpunk' ? 'LOADING...' : 'Loading...'}
                      disabled
                      size="sm"
                      variant="modal"
                    />
                  );
                }
                
                // Show completed status for regular tests (no retest available)
                if (isCompleted && !test?.retest_available) {
                  return (
                    <ThemedButton
                      title={themeMode === 'cyberpunk' ? '✓ COMPLETED' : '✓ Completed'}
                      disabled
                      size="sm"
                      variant="modal"
                    />
                  );
                }
                
                // If test is completed with retest available:
                // Always show "Completed" regardless of attempts_left (test was just submitted)
                // This handles the case where test was just submitted and API hasn't updated yet
                if (isCompleted && test?.retest_available) {
                  return (
                    <ThemedButton
                      title={themeMode === 'cyberpunk' ? '✓ COMPLETED' : '✓ Completed'}
                      disabled
                      size="sm"
                      variant="modal"
                    />
                  );
                }
                
                // If retest is available and NOT completed yet, check attempts
                if (!isCompleted && test?.retest_available) {
                  const hasRetestAttempts = 
                    test?.retest_attempts_left !== undefined &&
                    test?.retest_attempts_left !== null &&
                    test?.retest_attempts_left > 0;
                  
                  if (hasRetestAttempts) {
                    // Show "Start Retest" button if attempts are available and test is not completed
                    return (
                      <ThemedButton
                        title={themeMode === 'cyberpunk' ? 'START RETEST' : 'Start Retest'}
                        size="sm"
                        variant="modal"
                        onPress={() => {
                          // Copy web app navigation logic exactly
                          if (test.test_type === 'matching_type') {
                            router.push(`/tests/matching/${test.test_id}`);
                            return;
                          }
                          
                          if (test.test_type === 'word_matching') {
                            router.push(`/tests/word-matching/${test.test_id}`);
                            return;
                          }
                          
                          if (test.test_type === 'speaking') {
                            router.push(`/tests/speaking/${test.test_id}`);
                            return;
                          }
                          
                          if (test.test_type === 'multiple_choice') {
                            router.push(`/tests/multiple-choice/${test.test_id}?type=multiple_choice`);
                            return;
                          }
                          
                          if (test.test_type === 'true_false') {
                            router.push(`/tests/true-false/${test.test_id}?type=true_false`);
                            return;
                          }
                          
                          if (test.test_type === 'input') {
                            router.push(`/tests/input/${test.test_id}?type=input`);
                            return;
                          }
                          
                          if (test.test_type === 'drawing') {
                            router.push(`/tests/drawing/${test.test_id}?type=drawing`);
                            return;
                          }
                          
                          if (test.test_type === 'fill_blanks') {
                            router.push(`/tests/fill-blanks/${test.test_id}?type=fill_blanks`);
                            return;
                          }
                          
                          // Default navigation for other test types
                          router.push(`/tests/${test.test_type}/${test.test_id}?type=${test.test_type}`);
                        }}
                      />
                    );
                  }
                }
                
                // Show start test button
                return (
                  <ThemedButton
                    title={themeMode === 'cyberpunk' ? 'START TEST' : 'Start Test'}
                    size="sm"
                    variant="modal"
                    onPress={() => {
                      // Copy web app navigation logic exactly
                      if (test.test_type === 'matching_type') {
                        router.push(`/tests/matching/${test.test_id}`);
                        return;
                      }
                      
                      if (test.test_type === 'word_matching') {
                        router.push(`/tests/word-matching/${test.test_id}`);
                        return;
                      }
                      
                      if (test.test_type === 'speaking') {
                        router.push(`/tests/speaking/${test.test_id}`);
                        return;
                      }
                      
                      if (test.test_type === 'multiple_choice') {
                        router.push(`/tests/multiple-choice/${test.test_id}?type=multiple_choice`);
                        return;
                      }
                      
                      if (test.test_type === 'true_false') {
                        router.push(`/tests/true-false/${test.test_id}?type=true_false`);
                        return;
                      }
                      
                      if (test.test_type === 'input') {
                        router.push(`/tests/input/${test.test_id}?type=input`);
                        return;
                      }
                      
                      if (test.test_type === 'drawing') {
                        router.push(`/tests/drawing/${test.test_id}?type=drawing`);
                        return;
                      }
                      
                      if (test.test_type === 'fill_blanks') {
                        router.push(`/tests/fill-blanks/${test.test_id}?type=fill_blanks`);
                        return;
                      }
                      
                      // Default navigation for other test types
                      router.push(`/tests/${test.test_type}/${test.test_id}?type=${test.test_type}`);
                    }}
                  />
                );
              })()}
            </View>
          ))
        )}
        
        {/* Show More Button - Copy from web app */}
        {tests.length > 3 && (
          <View className="items-center pt-2">
            <ThemedButton
              title={themeMode === 'cyberpunk' 
                ? (showAllTests ? 'SHOW LESS' : `SHOW ${tests.length - 3} MORE`)
                : (showAllTests ? 'Show Less' : `Show ${tests.length - 3} More`)
              }
              size="sm"
              variant="modal"
              onPress={onToggleShowAll}
            />
          </View>
        )}
      </View>
    </View>
  );
}

