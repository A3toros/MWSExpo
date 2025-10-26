import { AppState, AppStateStatus } from 'react-native';
import { logger } from './logger';

export interface CheatingEvent {
  id: string;
  type: 'tab_switch' | 'copy_paste' | 'screenshot' | 'timeout' | 'rapid_click' | 'suspicious_behavior';
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  testId?: string;
  questionId?: string;
  userId?: string;
  sessionId?: string;
}

export interface AntiCheatingConfig {
  enableTabSwitchDetection: boolean;
  enableCopyPasteDetection: boolean;
  enableScreenshotDetection: boolean;
  enableTimeoutDetection: boolean;
  enableRapidClickDetection: boolean;
  enableSuspiciousBehaviorDetection: boolean;
  maxWarnings: number;
  warningThreshold: number;
  blockOnHighSeverity: boolean;
  timeoutThreshold: number; // seconds
  rapidClickThreshold: number; // clicks per second
  suspiciousBehaviorThreshold: number; // events per minute
  cooldownPeriod: number; // minutes
}

export interface AntiCheatingState {
  isMonitoring: boolean;
  isBlocked: boolean;
  warningCount: number;
  cheatingEvents: CheatingEvent[];
  lastActivity: string;
  sessionStartTime: string;
  totalTimeSpent: number;
  suspiciousActivityCount: number;
}

export interface CheatingDetection {
  isCheating: boolean;
  confidence: number;
  reasons: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const defaultConfig: AntiCheatingConfig = {
  enableTabSwitchDetection: true,
  enableCopyPasteDetection: true,
  enableScreenshotDetection: true,
  enableTimeoutDetection: true,
  enableRapidClickDetection: true,
  enableSuspiciousBehaviorDetection: true,
  maxWarnings: 3,
  warningThreshold: 2,
  blockOnHighSeverity: true,
  timeoutThreshold: 30,
  rapidClickThreshold: 5,
  suspiciousBehaviorThreshold: 10,
  cooldownPeriod: 5,
};

class AntiCheatingManager {
  private config: AntiCheatingConfig;
  private state: AntiCheatingState;
  private clickCount: number = 0;
  private clickTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private lastActivityTime: number = Date.now();
  private suspiciousActivityCount: number = 0;
  private suspiciousActivityTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AntiCheatingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.state = {
      isMonitoring: false,
      isBlocked: false,
      warningCount: 0,
      cheatingEvents: [],
      lastActivity: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
      totalTimeSpent: 0,
      suspiciousActivityCount: 0,
    };
  }

  // Start monitoring
  startMonitoring(testId: string, userId: string, sessionId: string): void {
    this.state.isMonitoring = true;
    this.state.sessionStartTime = new Date().toISOString();
    this.state.lastActivity = new Date().toISOString();
    this.lastActivityTime = Date.now();

    // Set up app state monitoring
    if (this.config.enableTabSwitchDetection) {
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    }

    // Set up activity monitoring
    this.startActivityMonitoring();

    // Set up suspicious behavior monitoring
    if (this.config.enableSuspiciousBehaviorDetection) {
      this.startSuspiciousBehaviorMonitoring();
    }

    logger.info('Anti-cheating monitoring started', 'anti-cheating', {
      testId,
      userId,
      sessionId,
      config: this.config,
    });
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.state.isMonitoring = false;
    this.state.totalTimeSpent = Date.now() - new Date(this.state.sessionStartTime).getTime();

    // Clean up timers
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.suspiciousActivityTimer) {
      clearTimeout(this.suspiciousActivityTimer);
      this.suspiciousActivityTimer = null;
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    logger.info('Anti-cheating monitoring stopped', 'anti-cheating', {
      totalTimeSpent: this.state.totalTimeSpent,
      cheatingEvents: this.state.cheatingEvents.length,
      warningCount: this.state.warningCount,
    });
  }

  // Handle app state changes
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (!this.state.isMonitoring) return;

    const now = new Date().toISOString();
    this.updateActivity();

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.addCheatingEvent({
        type: 'tab_switch',
        severity: 'high',
        details: { appState: nextAppState, timestamp: now },
      });
    }
  }

  // Handle click events
  handleClick(): void {
    if (!this.state.isMonitoring) return;

    this.clickCount++;
    this.updateActivity();

    if (this.config.enableRapidClickDetection) {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }

      this.clickTimer = setTimeout(() => {
        const clicksPerSecond = this.clickCount / 1; // 1 second window
        
        if (clicksPerSecond >= this.config.rapidClickThreshold) {
          this.addCheatingEvent({
            type: 'rapid_click',
            severity: 'medium',
            details: { clicksPerSecond, clickCount: this.clickCount },
          });
        }
        
        this.clickCount = 0;
      }, 1000);
    }
  }

  // Handle copy/paste events
  handleCopyPaste(): void {
    if (!this.state.isMonitoring || !this.config.enableCopyPasteDetection) return;

    this.addCheatingEvent({
      type: 'copy_paste',
      severity: 'medium',
      details: { timestamp: new Date().toISOString() },
    });
  }

  // Handle screenshot events
  handleScreenshot(): void {
    if (!this.state.isMonitoring || !this.config.enableScreenshotDetection) return;

    this.addCheatingEvent({
      type: 'screenshot',
      severity: 'high',
      details: { timestamp: new Date().toISOString() },
    });
  }

  // Handle timeout detection
  handleTimeout(): void {
    if (!this.state.isMonitoring || !this.config.enableTimeoutDetection) return;

    const timeSinceLastActivity = (Date.now() - this.lastActivityTime) / 1000;
    
    if (timeSinceLastActivity >= this.config.timeoutThreshold) {
      this.addCheatingEvent({
        type: 'timeout',
        severity: 'low',
        details: { timeoutSeconds: timeSinceLastActivity },
      });
    }
  }

  // Start activity monitoring
  private startActivityMonitoring(): void {
    this.activityTimer = setInterval(() => {
      this.handleTimeout();
    }, 5000); // Check every 5 seconds
  }

  // Start suspicious behavior monitoring
  private startSuspiciousBehaviorMonitoring(): void {
    this.suspiciousActivityTimer = setInterval(() => {
      if (this.suspiciousActivityCount >= this.config.suspiciousBehaviorThreshold) {
        this.addCheatingEvent({
          type: 'suspicious_behavior',
          severity: 'high',
          details: { 
            suspiciousActivityCount: this.suspiciousActivityCount,
            threshold: this.config.suspiciousBehaviorThreshold,
          },
        });
      }
      this.suspiciousActivityCount = 0;
    }, 60000); // Check every minute
  }

  // Update activity
  private updateActivity(): void {
    this.state.lastActivity = new Date().toISOString();
    this.lastActivityTime = Date.now();
  }

  // Add cheating event
  private addCheatingEvent(event: Omit<CheatingEvent, 'id' | 'timestamp'>): void {
    const cheatingEvent: CheatingEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    this.state.cheatingEvents.push(cheatingEvent);
    this.state.warningCount += this.getSeverityWeight(event.severity);
    this.suspiciousActivityCount++;

    // Check if should block
    if (this.shouldBlock(cheatingEvent)) {
      this.state.isBlocked = true;
    }

    logger.warn('Cheating event detected', 'anti-cheating', {
      event: cheatingEvent,
      warningCount: this.state.warningCount,
      isBlocked: this.state.isBlocked,
    });
  }

  // Check if should block
  private shouldBlock(event: CheatingEvent): boolean {
    if (this.state.isBlocked) return true;
    
    if (this.config.blockOnHighSeverity && event.severity === 'high') {
      return true;
    }
    
    if (this.state.warningCount >= this.config.maxWarnings) {
      return true;
    }
    
    return false;
  }

  // Get severity weight
  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 5;
      default: return 1;
    }
  }

  // Detect cheating patterns
  detectCheatingPatterns(): CheatingDetection {
    const patterns = this.analyzePatterns();
    const isCheating = patterns.length > 0;
    const confidence = this.calculateConfidence(patterns);
    const severity = this.calculateSeverity(patterns);

    return {
      isCheating,
      confidence,
      reasons: patterns,
      recommendations: this.generateRecommendations(patterns),
      severity,
    };
  }

  // Analyze patterns
  private analyzePatterns(): string[] {
    const patterns: string[] = [];
    const events = this.state.cheatingEvents;

    // Check for multiple tab switches
    const tabSwitches = events.filter(e => e.type === 'tab_switch');
    if (tabSwitches.length >= 3) {
      patterns.push('Multiple tab switches detected');
    }

    // Check for rapid clicking
    const rapidClicks = events.filter(e => e.type === 'rapid_click');
    if (rapidClicks.length >= 2) {
      patterns.push('Rapid clicking behavior detected');
    }

    // Check for screenshot attempts
    const screenshots = events.filter(e => e.type === 'screenshot');
    if (screenshots.length >= 1) {
      patterns.push('Screenshot attempts detected');
    }

    // Check for copy/paste activity
    const copyPaste = events.filter(e => e.type === 'copy_paste');
    if (copyPaste.length >= 2) {
      patterns.push('Copy/paste activity detected');
    }

    // Check for suspicious behavior
    const suspiciousBehavior = events.filter(e => e.type === 'suspicious_behavior');
    if (suspiciousBehavior.length >= 1) {
      patterns.push('Suspicious behavior patterns detected');
    }

    return patterns;
  }

  // Calculate confidence
  private calculateConfidence(patterns: string[]): number {
    if (patterns.length === 0) return 0;
    
    const baseConfidence = Math.min(patterns.length * 20, 100);
    const eventCount = this.state.cheatingEvents.length;
    const timeSpent = this.state.totalTimeSpent;
    
    // Adjust confidence based on event frequency
    const frequencyBonus = Math.min(eventCount * 5, 30);
    
    // Adjust confidence based on time spent
    const timeBonus = timeSpent > 3600000 ? 10 : 0; // 1 hour
    
    return Math.min(baseConfidence + frequencyBonus + timeBonus, 100);
  }

  // Calculate severity
  private calculateSeverity(patterns: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (patterns.length === 0) return 'low';
    
    const criticalPatterns = ['Screenshot attempts detected', 'Suspicious behavior patterns detected'];
    const highPatterns = ['Multiple tab switches detected', 'Copy/paste activity detected'];
    
    if (patterns.some(p => criticalPatterns.includes(p))) {
      return 'critical';
    }
    
    if (patterns.some(p => highPatterns.includes(p))) {
      return 'high';
    }
    
    if (patterns.length >= 2) {
      return 'medium';
    }
    
    return 'low';
  }

  // Generate recommendations
  private generateRecommendations(patterns: string[]): string[] {
    const recommendations: string[] = [];
    
    if (patterns.includes('Multiple tab switches detected')) {
      recommendations.push('Avoid switching between applications during tests');
    }
    
    if (patterns.includes('Rapid clicking behavior detected')) {
      recommendations.push('Take your time to read and answer questions carefully');
    }
    
    if (patterns.includes('Screenshot attempts detected')) {
      recommendations.push('Do not attempt to capture screenshots during tests');
    }
    
    if (patterns.includes('Copy/paste activity detected')) {
      recommendations.push('Do not copy and paste content during tests');
    }
    
    if (patterns.includes('Suspicious behavior patterns detected')) {
      recommendations.push('Follow test guidelines and maintain academic integrity');
    }
    
    return recommendations;
  }

  // Get current state
  getState(): AntiCheatingState {
    return { ...this.state };
  }

  // Get cheating events
  getCheatingEvents(): CheatingEvent[] {
    return [...this.state.cheatingEvents];
  }

  // Clear cheating events
  clearCheatingEvents(): void {
    this.state.cheatingEvents = [];
    this.state.warningCount = 0;
    this.state.isBlocked = false;
  }

  // Reset state
  reset(): void {
    this.state = {
      isMonitoring: false,
      isBlocked: false,
      warningCount: 0,
      cheatingEvents: [],
      lastActivity: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
      totalTimeSpent: 0,
      suspiciousActivityCount: 0,
    };
    this.clickCount = 0;
    this.suspiciousActivityCount = 0;
  }

  // Update configuration
  updateConfig(newConfig: Partial<AntiCheatingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get configuration
  getConfig(): AntiCheatingConfig {
    return { ...this.config };
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Create singleton instance
export const antiCheatingManager = new AntiCheatingManager();

// Utility functions
export const antiCheatingUtils = {
  // Create anti-cheating manager with specific configuration
  createManager: (config: Partial<AntiCheatingConfig>) => new AntiCheatingManager(config),
  
  // Format cheating event
  formatCheatingEvent: (event: CheatingEvent): string => {
    const timestamp = new Date(event.timestamp).toLocaleString();
    return `[${timestamp}] ${event.type.toUpperCase()} - ${event.severity.toUpperCase()}`;
  },
  
  // Get severity color
  getSeverityColor: (severity: string): string => {
    switch (severity) {
      case 'low': return '#yellow';
      case 'medium': return '#orange';
      case 'high': return '#red';
      case 'critical': return '#darkred';
      default: return '#gray';
    }
  },
  
  // Calculate risk score
  calculateRiskScore: (events: CheatingEvent[]): number => {
    let score = 0;
    events.forEach(event => {
      switch (event.severity) {
        case 'low': score += 1; break;
        case 'medium': score += 3; break;
        case 'high': score += 5; break;
        case 'critical': score += 10; break;
      }
    });
    return Math.min(score, 100);
  },
  
  // Filter events by type
  filterEventsByType: (events: CheatingEvent[], type: string): CheatingEvent[] => {
    return events.filter(event => event.type === type);
  },
  
  // Filter events by severity
  filterEventsBySeverity: (events: CheatingEvent[], severity: string): CheatingEvent[] => {
    return events.filter(event => event.severity === severity);
  },
  
  // Get event statistics
  getEventStatistics: (events: CheatingEvent[]) => {
    const stats = {
      total: events.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      riskScore: 0,
    };
    
    events.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
    });
    
    stats.riskScore = antiCheatingUtils.calculateRiskScore(events);
    
    return stats;
  },
};
