import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

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
  const skeletonItems = Array.from({ length: 3 }).map((_, i) => i);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Active Tests</Text>
      
      <View style={styles.card}>
        {loading ? (
          skeletonItems.map((i) => (
            <View key={`t-skel-${i}`} style={styles.cardSkeleton} />
          ))
        ) : tests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No Active Tests</Text>
            <Text style={styles.emptyText}>No active tests available for your class at the moment.</Text>
          </View>
        ) : (
          (showAllTests ? tests : tests.slice(0, 3)).map((test, index) => (
            <View key={`test-${test.test_id}-${index}`} style={styles.testItem}>
              <View style={styles.testInfo}>
                <Text style={styles.testName}>{test.test_name}</Text>
                <View style={styles.testMeta}>
                  <Text style={styles.testSubject}>{test.subject}</Text>
                  <Text style={styles.testTeacher}>{test.teacher_name}</Text>
                  <Text style={styles.testDate}>
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
                    <TouchableOpacity style={[styles.startButton, styles.disabledButton]} disabled>
                      <Text style={styles.disabledButtonText}>Loading...</Text>
                    </TouchableOpacity>
                  );
                }
                
                // Show completed status
                if (isCompleted && !test?.retest_available) {
                  return (
                    <TouchableOpacity style={[styles.startButton, styles.completedButton]} disabled>
                      <Text style={styles.completedButtonText}>✓ Completed</Text>
                    </TouchableOpacity>
                  );
                }
                
                // Show retest button if available
                if (isCompleted && test?.retest_available) {
                  return (
                    <TouchableOpacity 
                      style={styles.startButton}
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
                    >
                      <Text style={styles.startButtonText}>Start Retest</Text>
                    </TouchableOpacity>
                  );
                }
                
                // Show start test button
                return (
                  <TouchableOpacity 
                    style={styles.startButton}
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
                  >
                    <Text style={styles.startButtonText}>Start Test</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          ))
        )}
        
        {/* Show More Button - Copy from web app */}
        {tests.length > 3 && (
          <View style={styles.showMoreContainer}>
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={onToggleShowAll}
            >
              <Text style={styles.showMoreText}>
                {showAllTests ? 'Show Less' : `Show ${tests.length - 3} More`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cardSkeleton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    height: 60,
    marginBottom: 8,
  },
});
