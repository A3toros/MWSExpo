import { TestResult } from '../types';

export interface SubjectPerformance {
  subject: string;
  averageScore: number;
  testCount: number;
  lastTestDate: string;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Calculate performance metrics for each subject
 */
export function calculateSubjectPerformance(results: TestResult[]): SubjectPerformance[] {
  if (!results || results.length === 0) {
    return [];
  }

  // Group results by subject
  const subjectGroups = results.reduce((acc, result) => {
    const subject = result.subject || 'Unknown Subject';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);

  // Calculate performance for each subject
  return Object.entries(subjectGroups).map(([subject, subjectResults]) => {
    const scores = subjectResults.map(result => {
      // Use retest score if available, otherwise use regular score
      const rawScore = result.retest_score || result.percentage || 0;
      
      // Convert to number (handles both string and number inputs)
      const score = typeof rawScore === 'string' ? parseFloat(rawScore) : rawScore;
      
      // Ensure score is a valid number
      return typeof score === 'number' && !isNaN(score) ? score : 0;
    }).filter(score => score > 0); // Filter out zero scores

    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;
    const testCount = subjectResults.length;
    
    // Get the most recent test date
    const lastTestDate = subjectResults
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
      ?.submitted_at || '';

    // Calculate trend (simplified - compare first half vs second half)
    const trend = calculateTrend(subjectResults);

    return {
      subject,
      averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimal places
      testCount,
      lastTestDate,
      trend
    };
  }).sort((a, b) => b.averageScore - a.averageScore); // Sort by performance (highest first)
}

/**
 * Calculate overall performance across all subjects
 */
export function getOverallPerformance(results: TestResult[]): number {
  if (!results || results.length === 0) {
    return 0;
  }

  const scores = results.map(result => {
    return result.retest_score || result.percentage || 0;
  });

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 100) / 100;
}

/**
 * Calculate performance trend for a subject
 */
export function getPerformanceTrend(subjectResults: TestResult[]): 'up' | 'down' | 'stable' {
  if (subjectResults.length < 2) {
    return 'stable';
  }

  // Sort by date
  const sortedResults = subjectResults
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());

  // Compare first half vs second half
  const midPoint = Math.floor(sortedResults.length / 2);
  const firstHalf = sortedResults.slice(0, midPoint);
  const secondHalf = sortedResults.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, result) => {
    return sum + (result.retest_score || result.percentage || 0);
  }, 0) / firstHalf.length;

  const secondHalfAvg = secondHalf.reduce((sum, result) => {
    return sum + (result.retest_score || result.percentage || 0);
  }, 0) / secondHalf.length;

  const difference = secondHalfAvg - firstHalfAvg;
  
  if (difference > 5) return 'up';
  if (difference < -5) return 'down';
  return 'stable';
}

/**
 * Check if there are any test results
 */
export function hasAnyTestResults(results: TestResult[]): boolean {
  return results && results.length > 0;
}

/**
 * Get list of subjects that have test results
 */
export function getSubjectsWithTests(results: TestResult[]): string[] {
  if (!results || results.length === 0) {
    return [];
  }

  const subjects = new Set<string>();
  results.forEach(result => {
    if (result.subject) {
      subjects.add(result.subject);
    }
  });

  return Array.from(subjects).sort();
}

/**
 * Calculate trend for a subject (internal helper)
 */
function calculateTrend(subjectResults: TestResult[]): 'up' | 'down' | 'stable' {
  return getPerformanceTrend(subjectResults);
}
