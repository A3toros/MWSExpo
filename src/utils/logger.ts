import AsyncStorage from '@react-native-async-storage/async-storage';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  category: string;
  metadata?: any;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByCategory: Record<string, number>;
  lastFlush: string;
  storageSize: number;
}

const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  maxEntries: 1000,
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  batchSize: 50,
  flushInterval: 30000, // 30 seconds
};

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.startFlushTimer();
  }

  // Set user context
  setUserContext(userId: string, sessionId: string): void {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  // Clear user context
  clearUserContext(): void {
    this.userId = null;
    this.sessionId = null;
  }

  // Log debug message
  debug(message: string, category: string = 'general', metadata?: any): void {
    this.log(LogLevel.DEBUG, message, category, metadata);
  }

  // Log info message
  info(message: string, category: string = 'general', metadata?: any): void {
    this.log(LogLevel.INFO, message, category, metadata);
  }

  // Log warning message
  warn(message: string, category: string = 'general', metadata?: any): void {
    this.log(LogLevel.WARN, message, category, metadata);
  }

  // Log error message
  error(message: string, category: string = 'general', metadata?: any, error?: Error): void {
    this.log(LogLevel.ERROR, message, category, metadata, error);
  }

  // Log fatal message
  fatal(message: string, category: string = 'general', metadata?: any, error?: Error): void {
    this.log(LogLevel.FATAL, message, category, metadata, error);
  }

  // Core logging method
  private log(
    level: LogLevel,
    message: string,
    category: string,
    metadata?: any,
    error?: Error
  ): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateId(),
      level,
      message,
      timestamp: new Date().toISOString(),
      category,
      metadata,
      stack: error?.stack,
      userId: this.userId || undefined,
      sessionId: this.sessionId || undefined,
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Remove old logs if exceeding max entries
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Storage
    if (this.config.enableStorage) {
      this.logToStorage(logEntry);
    }

    // Remote logging
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(logEntry);
    }
  }

  // Log to console
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelName}] [${entry.category}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.metadata);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.metadata);
        break;
      case LogLevel.ERROR:
        console.error(prefix, entry.message, entry.metadata, entry.stack);
        break;
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.metadata, entry.stack);
        break;
    }
  }

  // Log to storage
  private async logToStorage(entry: LogEntry): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('app_logs');
      const logs = stored ? JSON.parse(stored) : [];
      logs.push(entry);
      
      // Keep only recent logs
      const recentLogs = logs.slice(-this.config.maxEntries);
      await AsyncStorage.setItem('app_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Failed to store log entry:', error);
    }
  }

  // Log to remote endpoint
  private async logToRemote(entry: LogEntry): Promise<void> {
    try {
      // This would be implemented with actual API call
      // await fetch(this.config.remoteEndpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry),
      // });
    } catch (error) {
      console.error('Failed to send log to remote:', error);
    }
  }

  // Start flush timer
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  // Flush logs
  async flush(): Promise<void> {
    if (this.logs.length === 0) {
      return;
    }

    try {
      // Send logs to remote endpoint
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        const batches = this.chunkArray(this.logs, this.config.batchSize);
        for (const batch of batches) {
          await this.sendBatchToRemote(batch);
        }
      }

      // Clear logs after successful flush
      this.logs = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  // Send batch to remote
  private async sendBatchToRemote(batch: LogEntry[]): Promise<void> {
    try {
      // This would be implemented with actual API call
      // await fetch(this.config.remoteEndpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ logs: batch }),
      // });
    } catch (error) {
      console.error('Failed to send log batch to remote:', error);
    }
  }

  // Get logs
  async getLogs(filters?: {
    level?: LogLevel;
    category?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    try {
      const stored = await AsyncStorage.getItem('app_logs');
      if (!stored) {
        return [];
      }

      let logs: LogEntry[] = JSON.parse(stored);

      // Apply filters
      if (filters) {
        if (filters.level !== undefined) {
          logs = logs.filter(log => log.level === filters.level);
        }
        if (filters.category) {
          logs = logs.filter(log => log.category === filters.category);
        }
        if (filters.fromDate) {
          logs = logs.filter(log => log.timestamp >= filters.fromDate!);
        }
        if (filters.toDate) {
          logs = logs.filter(log => log.timestamp <= filters.toDate!);
        }
        if (filters.limit) {
          logs = logs.slice(-filters.limit);
        }
      }

      return logs;
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  // Get log statistics
  async getLogStats(): Promise<LogStats> {
    try {
      const stored = await AsyncStorage.getItem('app_logs');
      if (!stored) {
        return {
          totalLogs: 0,
          logsByLevel: {},
          logsByCategory: {},
          lastFlush: new Date().toISOString(),
          storageSize: 0,
        };
      }

      const logs: LogEntry[] = JSON.parse(stored);
      const stats: LogStats = {
        totalLogs: logs.length,
        logsByLevel: {},
        logsByCategory: {},
        lastFlush: new Date().toISOString(),
        storageSize: stored.length,
      };

      // Count by level
      logs.forEach(log => {
        const levelName = LogLevel[log.level];
        stats.logsByLevel[levelName] = (stats.logsByLevel[levelName] || 0) + 1;
      });

      // Count by category
      logs.forEach(log => {
        stats.logsByCategory[log.category] = (stats.logsByCategory[log.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return {
        totalLogs: 0,
        logsByLevel: {},
        logsByCategory: {},
        lastFlush: new Date().toISOString(),
        storageSize: 0,
      };
    }
  }

  // Clear logs
  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem('app_logs');
      this.logs = [];
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  // Export logs
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const logs = await this.getLogs();
      
      if (format === 'csv') {
        const headers = ['timestamp', 'level', 'category', 'message', 'metadata'];
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
          const row = [
            log.timestamp,
            LogLevel[log.level],
            log.category,
            `"${log.message.replace(/"/g, '""')}"`,
            log.metadata ? `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"` : '',
          ];
          csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
      } else {
        return JSON.stringify(logs, null, 2);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
      return '';
    }
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Update configuration
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.startFlushTimer();
  }

  // Get configuration
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Create singleton instance
export const logger = new Logger();

// Utility functions
export const logUtils = {
  // Create logger with specific configuration
  createLogger: (config: Partial<LoggerConfig>) => new Logger(config),
  
  // Format log level
  formatLevel: (level: LogLevel): string => LogLevel[level],
  
  // Parse log level
  parseLevel: (level: string): LogLevel => {
    const levels = Object.keys(LogLevel).filter(key => isNaN(Number(key)));
    const index = levels.indexOf(level.toUpperCase());
    return index >= 0 ? index as LogLevel : LogLevel.INFO;
  },
  
  // Format log entry
  formatLogEntry: (entry: LogEntry): string => {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const level = LogLevel[entry.level];
    return `[${timestamp}] [${level}] [${entry.category}] ${entry.message}`;
  },
  
  // Filter logs by date range
  filterByDateRange: (logs: LogEntry[], fromDate: string, toDate: string): LogEntry[] => {
    return logs.filter(log => log.timestamp >= fromDate && log.timestamp <= toDate);
  },
  
  // Filter logs by level
  filterByLevel: (logs: LogEntry[], level: LogLevel): LogEntry[] => {
    return logs.filter(log => log.level === level);
  },
  
  // Filter logs by category
  filterByCategory: (logs: LogEntry[], category: string): LogEntry[] => {
    return logs.filter(log => log.category === category);
  },
};
