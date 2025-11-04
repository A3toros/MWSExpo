export interface QuestionScore {
  question_id: string;
  points_earned: number;
  points_possible: number;
  percentage: number;
  is_correct: boolean;
  time_spent: number;
  attempts: number;
}

export interface TestScore {
  total_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  pass_threshold: number;
  question_scores: QuestionScore[];
  time_spent: number;
  attempts: number;
  submitted_at: string;
}

export interface ScoreBreakdown {
  by_question_type: Record<string, {
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
  }>;
  by_difficulty: Record<string, {
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
  }>;
  by_subject: Record<string, {
    total_questions: number;
    correct_answers: number;
    accuracy_rate: number;
    average_time: number;
  }>;
}

export interface ScoreComparison {
  current_score: TestScore;
  previous_score?: TestScore;
  improvement: number;
  trend: 'up' | 'down' | 'stable';
  percentile_rank: number;
  class_average: number;
  school_average: number;
}

export interface ScoreAnalytics {
  overall_performance: TestScore;
  breakdown: ScoreBreakdown;
  comparison: ScoreComparison;
  insights: string[];
  recommendations: string[];
}

export class ScoreCalculator {
  private static readonly DEFAULT_PASS_THRESHOLD = 60;
  private static readonly TIME_PENALTY_THRESHOLD = 300; // 5 minutes
  private static readonly TIME_PENALTY_RATE = 0.1; // 10% penalty per threshold

  // Calculate score for a single question
  static calculateQuestionScore(
    question: {
      id: string;
      type: string;
      points: number;
      correct_answer: any;
      student_answer: any;
      time_spent: number;
      attempts: number;
    }
  ): QuestionScore {
    const isCorrect = this.isAnswerCorrect(question.correct_answer, question.student_answer, question.type);
    const baseScore = isCorrect ? question.points : 0;
    
    // Apply time penalty if applicable
    const timePenalty = this.calculateTimePenalty(question.time_spent, question.points);
    const finalScore = Math.max(0, baseScore - timePenalty);
    
    return {
      question_id: question.id,
      points_earned: finalScore,
      points_possible: question.points,
      percentage: (finalScore / question.points) * 100,
      is_correct: isCorrect,
      time_spent: question.time_spent,
      attempts: question.attempts,
    };
  }

  // Calculate total test score
  static calculateTestScore(
    questions: Array<{
      id: string;
      type: string;
      points: number;
      correct_answer: any;
      student_answer: any;
      time_spent: number;
      attempts: number;
    }>,
    passThreshold: number = this.DEFAULT_PASS_THRESHOLD
  ): TestScore {
    const questionScores = questions.map(q => this.calculateQuestionScore(q));
    const totalScore = questionScores.reduce((sum, qs) => sum + qs.points_earned, 0);
    const maxScore = questionScores.reduce((sum, qs) => sum + qs.points_possible, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const totalTimeSpent = questionScores.reduce((sum, qs) => sum + qs.time_spent, 0);
    const totalAttempts = questionScores.reduce((sum, qs) => sum + qs.attempts, 0);

    return {
      total_score: totalScore,
      max_score: maxScore,
      percentage: Math.round(percentage * 100) / 100,
      passed: percentage >= passThreshold,
      pass_threshold: passThreshold,
      question_scores: questionScores,
      time_spent: totalTimeSpent,
      attempts: totalAttempts,
      submitted_at: new Date().toISOString(),
    };
  }

  // Check if answer is correct
  private static isAnswerCorrect(correctAnswer: any, studentAnswer: any, questionType: string): boolean {
    if (studentAnswer === null || studentAnswer === undefined) {
      return false;
    }

    switch (questionType) {
      case 'true_false':
        return correctAnswer === studentAnswer;
      
      case 'multiple_choice':
        return correctAnswer === studentAnswer;
      
      case 'input':
        if (Array.isArray(correctAnswer)) {
          return correctAnswer.some(answer => {
            const normalizedCorrect = this.normalizeAnswer(answer);
            const normalizedStudent = this.normalizeAnswer(studentAnswer);
            
            // First check for exact match (backward compatibility)
            if (normalizedStudent === normalizedCorrect) {
              return true;
            }
            
            // Then check if trimmed correct answer is present in trimmed student answer
            // This accepts answers with extra letters/numbers (e.g., "Paris123" contains "Paris")
            if (normalizedCorrect && normalizedStudent.includes(normalizedCorrect)) {
              // For single character answers, only match if at start/end (to avoid false positives like "a" in "cat")
              // For multi-character answers, accept any substring match
              if (normalizedCorrect.length === 1) {
                // Single character: must be at start or end of answer
                return normalizedStudent.startsWith(normalizedCorrect) || 
                       normalizedStudent.endsWith(normalizedCorrect);
              } else {
                // Multi-character: accept substring match
                return true;
              }
            }
            
            return false;
          });
        } else {
          const normalizedCorrect = this.normalizeAnswer(correctAnswer);
          const normalizedStudent = this.normalizeAnswer(studentAnswer);
          
          // First check for exact match (backward compatibility)
          if (normalizedStudent === normalizedCorrect) {
            return true;
          }
          
          // Then check if trimmed correct answer is present in trimmed student answer
          // This accepts answers with extra letters/numbers (e.g., "Paris123" contains "Paris")
          if (normalizedCorrect && normalizedStudent.includes(normalizedCorrect)) {
            // For single character answers, only match if at start/end (to avoid false positives like "a" in "cat")
            // For multi-character answers, accept any substring match
            if (normalizedCorrect.length === 1) {
              // Single character: must be at start or end of answer
              return normalizedStudent.startsWith(normalizedCorrect) || 
                     normalizedStudent.endsWith(normalizedCorrect);
            } else {
              // Multi-character: accept substring match
              return true;
            }
          }
          
          return false;
        }
      
      case 'fill_blanks':
        if (Array.isArray(correctAnswer) && Array.isArray(studentAnswer)) {
          return correctAnswer.every((answer, index) => 
            this.normalizeAnswer(answer) === this.normalizeAnswer(studentAnswer[index])
          );
        }
        return this.normalizeAnswer(correctAnswer) === this.normalizeAnswer(studentAnswer);
      
      case 'matching':
        if (Array.isArray(correctAnswer) && Array.isArray(studentAnswer)) {
          return correctAnswer.every((match, index) => 
            match.left === studentAnswer[index]?.left && 
            match.right === studentAnswer[index]?.right
          );
        }
        return false;
      
      case 'word_matching':
        if (Array.isArray(correctAnswer) && Array.isArray(studentAnswer)) {
          return correctAnswer.every((match, index) => 
            match.word === studentAnswer[index]?.word && 
            match.definition === studentAnswer[index]?.definition
          );
        }
        return false;
      
      case 'speaking':
        // For speaking questions, we might have AI evaluation
        if (typeof correctAnswer === 'object' && correctAnswer.score) {
          return correctAnswer.score >= 0.7; // 70% confidence threshold
        }
        return false;
      
      case 'drawing':
        // For drawing questions, we might have AI evaluation
        if (typeof correctAnswer === 'object' && correctAnswer.score) {
          return correctAnswer.score >= 0.7; // 70% confidence threshold
        }
        return false;
      
      default:
        return false;
    }
  }

  // Normalize answer for comparison
  private static normalizeAnswer(answer: any): string {
    if (typeof answer === 'string') {
      return answer.toLowerCase().trim();
    }
    if (typeof answer === 'number') {
      return answer.toString();
    }
    if (typeof answer === 'boolean') {
      return answer.toString();
    }
    return String(answer).toLowerCase().trim();
  }

  // Calculate time penalty
  private static calculateTimePenalty(timeSpent: number, points: number): number {
    if (timeSpent <= this.TIME_PENALTY_THRESHOLD) {
      return 0;
    }
    
    const excessTime = timeSpent - this.TIME_PENALTY_THRESHOLD;
    const penaltyMultiplier = Math.floor(excessTime / this.TIME_PENALTY_THRESHOLD);
    return points * this.TIME_PENALTY_RATE * penaltyMultiplier;
  }

  // Calculate score breakdown
  static calculateScoreBreakdown(
    testScore: TestScore,
    questions: Array<{
      id: string;
      type: string;
      difficulty: string;
      subject: string;
      time_spent: number;
    }>
  ): ScoreBreakdown {
    const breakdown: ScoreBreakdown = {
      by_question_type: {},
      by_difficulty: {},
      by_subject: {},
    };

    // Group by question type
    questions.forEach((q, index) => {
      const questionScore = testScore.question_scores[index];
      if (!breakdown.by_question_type[q.type]) {
        breakdown.by_question_type[q.type] = {
          total_questions: 0,
          correct_answers: 0,
          accuracy_rate: 0,
          average_time: 0,
        };
      }
      
      const typeStats = breakdown.by_question_type[q.type];
      typeStats.total_questions++;
      if (questionScore.is_correct) {
        typeStats.correct_answers++;
      }
      typeStats.average_time += q.time_spent;
    });

    // Calculate averages for question types
    Object.keys(breakdown.by_question_type).forEach(type => {
      const stats = breakdown.by_question_type[type];
      stats.accuracy_rate = (stats.correct_answers / stats.total_questions) * 100;
      stats.average_time = stats.average_time / stats.total_questions;
    });

    // Similar logic for difficulty and subject
    questions.forEach((q, index) => {
      const questionScore = testScore.question_scores[index];
      
      // By difficulty
      if (!breakdown.by_difficulty[q.difficulty]) {
        breakdown.by_difficulty[q.difficulty] = {
          total_questions: 0,
          correct_answers: 0,
          accuracy_rate: 0,
          average_time: 0,
        };
      }
      
      const diffStats = breakdown.by_difficulty[q.difficulty];
      diffStats.total_questions++;
      if (questionScore.is_correct) {
        diffStats.correct_answers++;
      }
      diffStats.average_time += q.time_spent;
    });

    // Calculate averages for difficulty
    Object.keys(breakdown.by_difficulty).forEach(difficulty => {
      const stats = breakdown.by_difficulty[difficulty];
      stats.accuracy_rate = (stats.correct_answers / stats.total_questions) * 100;
      stats.average_time = stats.average_time / stats.total_questions;
    });

    // By subject
    questions.forEach((q, index) => {
      const questionScore = testScore.question_scores[index];
      
      if (!breakdown.by_subject[q.subject]) {
        breakdown.by_subject[q.subject] = {
          total_questions: 0,
          correct_answers: 0,
          accuracy_rate: 0,
          average_time: 0,
        };
      }
      
      const subjectStats = breakdown.by_subject[q.subject];
      subjectStats.total_questions++;
      if (questionScore.is_correct) {
        subjectStats.correct_answers++;
      }
      subjectStats.average_time += q.time_spent;
    });

    // Calculate averages for subject
    Object.keys(breakdown.by_subject).forEach(subject => {
      const stats = breakdown.by_subject[subject];
      stats.accuracy_rate = (stats.correct_answers / stats.total_questions) * 100;
      stats.average_time = stats.average_time / stats.total_questions;
    });

    return breakdown;
  }

  // Calculate score comparison
  static calculateScoreComparison(
    currentScore: TestScore,
    previousScore?: TestScore,
    classAverage?: number,
    schoolAverage?: number
  ): ScoreComparison {
    const improvement = previousScore ? currentScore.percentage - previousScore.percentage : 0;
    const trend = improvement > 5 ? 'up' : improvement < -5 ? 'down' : 'stable';
    
    // Calculate percentile rank (simplified)
    const percentileRank = classAverage ? 
      (currentScore.percentage / classAverage) * 100 : 50;

    return {
      current_score: currentScore,
      previous_score: previousScore,
      improvement,
      trend,
      percentile_rank: Math.min(100, Math.max(0, percentileRank)),
      class_average: classAverage || 0,
      school_average: schoolAverage || 0,
    };
  }

  // Generate score insights
  static generateScoreInsights(
    testScore: TestScore,
    breakdown: ScoreBreakdown,
    comparison: ScoreComparison
  ): string[] {
    const insights: string[] = [];

    // Overall performance insights
    if (testScore.percentage >= 90) {
      insights.push('Excellent performance! You scored above 90%.');
    } else if (testScore.percentage >= 80) {
      insights.push('Great job! You scored above 80%.');
    } else if (testScore.percentage >= 70) {
      insights.push('Good work! You scored above 70%.');
    } else if (testScore.percentage >= 60) {
      insights.push('You passed! Consider reviewing areas for improvement.');
    } else {
      insights.push('You need to improve. Consider retaking this test.');
    }

    // Improvement insights
    if (comparison.improvement > 10) {
      insights.push(`Great improvement! You improved by ${comparison.improvement.toFixed(1)}% from your last attempt.`);
    } else if (comparison.improvement < -10) {
      insights.push(`Your score decreased by ${Math.abs(comparison.improvement).toFixed(1)}% from your last attempt.`);
    }

    // Question type insights
    Object.entries(breakdown.by_question_type).forEach(([type, stats]) => {
      if (stats.accuracy_rate < 50) {
        insights.push(`You struggled with ${type} questions (${stats.accuracy_rate.toFixed(1)}% accuracy).`);
      } else if (stats.accuracy_rate > 90) {
        insights.push(`You excelled at ${type} questions (${stats.accuracy_rate.toFixed(1)}% accuracy).`);
      }
    });

    // Time insights
    if (testScore.time_spent > 3600) { // More than 1 hour
      insights.push('You spent a significant amount of time on this test. Consider time management strategies.');
    }

    return insights;
  }

  // Generate recommendations
  static generateRecommendations(
    testScore: TestScore,
    breakdown: ScoreBreakdown,
    comparison: ScoreComparison
  ): string[] {
    const recommendations: string[] = [];

    // Overall recommendations
    if (testScore.percentage < 60) {
      recommendations.push('Consider retaking this test after additional study.');
      recommendations.push('Review the material covered in this test.');
    }

    // Question type recommendations
    Object.entries(breakdown.by_question_type).forEach(([type, stats]) => {
      if (stats.accuracy_rate < 60) {
        recommendations.push(`Practice more ${type} questions to improve your accuracy.`);
      }
    });

    // Time management recommendations
    if (testScore.time_spent > 3600) {
      recommendations.push('Practice time management techniques for future tests.');
    }

    // Improvement recommendations
    if (comparison.trend === 'down') {
      recommendations.push('Review your study methods and consider seeking help.');
    }

    return recommendations;
  }

  // Calculate comprehensive score analytics
  static calculateScoreAnalytics(
    testScore: TestScore,
    questions: Array<{
      id: string;
      type: string;
      difficulty: string;
      subject: string;
      time_spent: number;
    }>,
    previousScore?: TestScore,
    classAverage?: number,
    schoolAverage?: number
  ): ScoreAnalytics {
    const breakdown = this.calculateScoreBreakdown(testScore, questions);
    const comparison = this.calculateScoreComparison(testScore, previousScore, classAverage, schoolAverage);
    const insights = this.generateScoreInsights(testScore, breakdown, comparison);
    const recommendations = this.generateRecommendations(testScore, breakdown, comparison);

    return {
      overall_performance: testScore,
      breakdown,
      comparison,
      insights,
      recommendations,
    };
  }
}
