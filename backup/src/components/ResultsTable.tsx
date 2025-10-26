import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { TestResult } from '../types';

// RESULTS TABLE COMPONENT - React Native Component for Test Results Table
// ✅ REWRITTEN: From web StudentResults.jsx to React Native
// ✅ REWRITTEN: Enhanced results table with detailed analysis
// ✅ REWRITTEN: Score display with pass/fail indication
// ✅ REWRITTEN: Subject abbreviations and teacher names
// ✅ REWRITTEN: Responsive design for mobile
// ✅ REWRITTEN: Show more/less functionality
// ✅ REWRITTEN: Color-coded scores and performance indicators

type Props = {
  results: TestResult[];
  showAll?: boolean;
  onToggleShowAll?: () => void;
  maxInitial?: number;
  compact?: boolean;
};

export function ResultsTable({
  results,
  showAll = false,
  onToggleShowAll,
  maxInitial = 3,
  compact = false
}: Props) {
  // Get subject abbreviations for results table
  const getSubjectAbbreviation = useCallback((subjectName: string) => {
    const abbreviations: Record<string, string> = {
      'Listening and Speaking': 'L&S',
      'Reading and Writing': 'R&W',
      'English for Career': 'Eng for Career',
      'Science Fundamental': 'Science F',
      'Science Supplementary': 'Science S',
      'Math Fundamental': 'Math F',
      'Math Supplementary': 'Math S',
      'English for Communication': 'Eng for Comm'
    };
    return abbreviations[subjectName] || subjectName;
  }, []);

  // Helper function to get display scores (prefer retest if available)
  const getDisplayScores = useCallback((result: TestResult) => {
    const displayPercentage = result.retest_score || result.percentage;
    
    return {
      score: Math.round(displayPercentage), // Use percentage as score
      maxScore: 100, // Max score is always 100 for percentage
      percentage: displayPercentage
    };
  }, []);

  // Get score color based on percentage (exact copy from web app)
  const getScoreColor = useCallback((percentage: number) => {
    if (percentage >= 80) return { text: '#166534', bg: '#dcfce7' }; // text-green-800, bg-green-100
    if (percentage >= 60) return { text: '#92400e', bg: '#fef3c7' }; // text-yellow-800, bg-yellow-100
    return { text: '#991b1b', bg: '#fecaca' }; // text-red-800, bg-red-100
  }, []);

  if (!results || results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No results available</Text>
      </View>
    );
  }

  const displayResults = showAll ? results : results.slice(0, maxInitial);

  return (
    <View style={styles.container}>
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Test Results</Text>
        </View>
      )}
      
      <View style={styles.resultsList}>
        {displayResults.map((result, index) => {
          const { score, maxScore, percentage } = getDisplayScores(result);
          const scoreColor = getScoreColor(percentage);
          const subjectAbbr = getSubjectAbbreviation(result.subject);

          return (
            <View key={index} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={styles.subjectContainer}>
                  <View style={[styles.subjectBadge, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[styles.subjectText, { color: '#1e40af' }]}>
                      {subjectAbbr}
                    </Text>
                  </View>
                  <Text style={styles.testName}>{result.test_name}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: scoreColor.bg }]}>
                  <Text style={[styles.scoreText, { color: scoreColor.text }]}>
                    {percentage}%
                  </Text>
                </View>
              </View>
              
              <View style={styles.resultDetails}>
                <Text style={styles.teacherText}>
                  {result.teacher_name || 'Unknown'}
                </Text>
                <Text style={styles.dateText}>
                  {new Date(result.submitted_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Show expand/collapse button if there are more than maxInitial results */}
      {results.length > maxInitial && onToggleShowAll && (
        <View style={styles.expandContainer}>
          <TouchableOpacity onPress={onToggleShowAll} style={styles.expandButton}>
            <Text style={styles.expandText}>
              {showAll ? 'Show Less' : `Show ${results.length - maxInitial} More`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  tableContainer: {
    minWidth: 600, // Ensure horizontal scrolling on smaller screens
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: '#374151',
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  retestText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  expandContainer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expandButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  expandText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  // New card-based styles
  resultsList: {
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
    flex: 1,
  },
  resultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teacherText: {
    fontSize: 12,
    color: '#6b7280',
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
});
