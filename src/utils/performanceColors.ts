import { ThemeMode } from '../contexts/ThemeContext';

/**
 * Get performance color based on score and theme
 */
export function getPerformanceColor(score: number, themeMode: ThemeMode): string {
  if (score >= 80) {
    // Excellent performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#00ffd2'; // Cyberpunk cyan
      case 'dark':
        return '#10b981'; // Green
      default:
        return '#059669'; // Green
    }
  } else if (score >= 60) {
    // Good performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#f8ef02'; // Cyberpunk yellow
      case 'dark':
        return '#f59e0b'; // Amber
      default:
        return '#d97706'; // Amber
    }
  } else {
    // Needs improvement
    switch (themeMode) {
      case 'cyberpunk':
        return '#ff6b6b'; // Red
      case 'dark':
        return '#ef4444'; // Red
      default:
        return '#dc2626'; // Red
    }
  }
}

/**
 * Get performance background color based on score and theme
 */
export function getPerformanceBackgroundColor(score: number, themeMode: ThemeMode): string {
  if (score >= 80) {
    // Excellent performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#00ffd2'; // Cyberpunk cyan
      case 'dark':
        return '#10b981'; // Green
      default:
        return '#dcfce7'; // Green-100
    }
  } else if (score >= 60) {
    // Good performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#f8ef02'; // Cyberpunk yellow
      case 'dark':
        return '#f59e0b'; // Amber
      default:
        return '#fef3c7'; // Yellow-100
    }
  } else {
    // Needs improvement
    switch (themeMode) {
      case 'cyberpunk':
        return '#ff6b6b'; // Red
      case 'dark':
        return '#ef4444'; // Red
      default:
        return '#fecaca'; // Red-100
    }
  }
}

/**
 * Get performance text color based on score and theme
 */
export function getPerformanceTextColor(score: number, themeMode: ThemeMode): string {
  if (score >= 80) {
    // Excellent performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#000000'; // Black text on bright cyan
      case 'dark':
        return '#ffffff'; // White text
      default:
        return '#166534'; // Green-800
    }
  } else if (score >= 60) {
    // Good performance
    switch (themeMode) {
      case 'cyberpunk':
        return '#000000'; // Black text on bright yellow
      case 'dark':
        return '#ffffff'; // White text
      default:
        return '#92400e'; // Yellow-800
    }
  } else {
    // Needs improvement
    switch (themeMode) {
      case 'cyberpunk':
        return '#ffffff'; // White text on red
      case 'dark':
        return '#ffffff'; // White text
      default:
        return '#991b1b'; // Red-800
    }
  }
}

/**
 * Get progress ring color for circular progress
 */
export function getProgressRingColor(score: number, themeMode: ThemeMode): string {
  return getPerformanceColor(score, themeMode);
}

/**
 * Get progress bar color for cyberpunk theme
 */
export function getProgressBarColor(score: number, themeMode: ThemeMode): string {
  if (themeMode === 'cyberpunk') {
    return getPerformanceColor(score, themeMode);
  }
  return getPerformanceColor(score, themeMode);
}

/**
 * Get progress background color (for unfilled portion)
 */
export function getProgressBackgroundColor(themeMode: ThemeMode): string {
  switch (themeMode) {
    case 'cyberpunk':
      return '#1a1a1a'; // Dark background
    case 'dark':
      return '#374151'; // Gray-700
    default:
      return '#e5e7eb'; // Gray-200
  }
}

/**
 * Get performance level text
 */
export function getPerformanceLevel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  return 'Needs Improvement';
}

/**
 * Get performance emoji
 */
export function getPerformanceEmoji(score: number): string {
  return ''; // No emojis
}
