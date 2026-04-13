/**
 * Analytics-related types
 */

export interface AnalyticsConfig {
  enableHistoryTracking: boolean;
  maxHistorySize: number;
  calculateAdvancedMetrics: boolean;
  alertThresholds: {
    minROI: number;
    minWinRate: number;
    maxDrawdown: number;
  };
}

export interface MetricsSnapshot {
  timestamp: Date;
  strategyName: string;
  roi: number;
  winRate: number;
  successCount: number;
  failureCount: number;
  totalProfit: bigint;
}
