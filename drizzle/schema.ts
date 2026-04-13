import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Governance Proposals Table
 * Stores all governance proposals with their lifecycle state
 */
export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  proposalType: mysqlEnum("proposalType", [
    "strategy_parameter",
    "configuration_change",
    "emergency_action",
    "other",
  ]).notNull(),
  status: mysqlEnum("status", [
    "draft",
    "active",
    "passed",
    "rejected",
    "executed",
  ])
    .default("draft")
    .notNull(),
  parameters: text("parameters"), // JSON string of proposed changes
  votingDeadline: timestamp("votingDeadline").notNull(),
  executedAt: timestamp("executedAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

/**
 * Votes Table
 * Records individual votes cast on proposals
 */
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  voterId: int("voterId").notNull(),
  choice: mysqlEnum("choice", ["for", "against", "abstain"]).notNull(),
  reasoning: text("reasoning"),
  votedAt: timestamp("votedAt").defaultNow().notNull(),
});

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

/**
 * Audit Log Table
 * Immutable record of all governance and parameter changes
 */
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  eventType: mysqlEnum("eventType", [
    "proposal_created",
    "proposal_activated",
    "vote_cast",
    "proposal_executed",
    "parameter_changed",
    "emergency_triggered",
  ]).notNull(),
  proposalId: int("proposalId"),
  actorId: int("actorId"),
  details: text("details"), // JSON string with event details
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;

/**
 * Performance Metrics Table
 * Snapshots of AgentV3 KPIs over time
 */
export const performanceMetrics = mysqlTable("performanceMetrics", {
  id: int("id").autoincrement().primaryKey(),
  roi: varchar("roi", { length: 50 }).notNull(), // Percentage as string
  sharpeRatio: varchar("sharpeRatio", { length: 50 }).notNull(),
  drawdown: varchar("drawdown", { length: 50 }).notNull(),
  winRate: varchar("winRate", { length: 50 }).notNull(),
  totalTrades: int("totalTrades").notNull(),
  successfulTrades: int("successfulTrades").notNull(),
  volatility: varchar("volatility", { length: 50 }).notNull(),
  maxDrawdown: varchar("maxDrawdown", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;

/**
 * Strategy Recommendations Table
 * AI-generated strategy suggestions with confidence scores
 */
export const strategyRecommendations = mysqlTable("strategyRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  strategyName: varchar("strategyName", { length: 255 }).notNull(),
  description: text("description").notNull(),
  confidenceScore: varchar("confidenceScore", { length: 50 }).notNull(), // 0-100 as string
  reasoning: text("reasoning").notNull(),
  expectedReturn: varchar("expectedReturn", { length: 50 }),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).notNull(),
  rank: int("rank").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type StrategyRecommendation = typeof strategyRecommendations.$inferSelect;
export type InsertStrategyRecommendation = typeof strategyRecommendations.$inferInsert;

/**
 * Risk Events Table
 * Tracks critical risk events for alerting
 */
export const riskEvents = mysqlTable("riskEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventType: mysqlEnum("eventType", [
    "high_volatility",
    "drawdown_warning",
    "liquidity_risk",
    "counterparty_risk",
    "emergency_revenue_triggered",
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  description: text("description").notNull(),
  affectedChains: varchar("affectedChains", { length: 500 }), // Comma-separated
  riskMetrics: text("riskMetrics"), // JSON string
  acknowledged: int("acknowledged").default(0),
  acknowledgedAt: timestamp("acknowledgedAt"),
  acknowledgedBy: int("acknowledgedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RiskEvent = typeof riskEvents.$inferSelect;
export type InsertRiskEvent = typeof riskEvents.$inferInsert;

/**
 * Notifications Table
 * Owner-facing notifications for critical events
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  notificationType: mysqlEnum("notificationType", [
    "risk_alert",
    "governance_update",
    "emergency_action",
    "performance_milestone",
  ]).notNull(),
  relatedEventId: int("relatedEventId"),
  isRead: int("isRead").default(0),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Executed Changes Table
 * Records of all executed parameter changes from proposals
 */
export const executedChanges = mysqlTable("executedChanges", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  parameterName: varchar("parameterName", { length: 255 }).notNull(),
  previousValue: text("previousValue"),
  newValue: text("newValue").notNull(),
  executedBy: int("executedBy").notNull(),
  executedAt: timestamp("executedAt").defaultNow().notNull(),
});

export type ExecutedChange = typeof executedChanges.$inferSelect;
export type InsertExecutedChange = typeof executedChanges.$inferInsert;

/**
 * Market Predictions Table
 * LLM-generated market trend forecasts
 */
export const marketPredictions = mysqlTable("marketPredictions", {
  id: int("id").autoincrement().primaryKey(),
  asset: varchar("asset", { length: 100 }).notNull(),
  timeframe: varchar("timeframe", { length: 50 }).notNull(), // e.g., "24h", "7d", "30d"
  prediction: text("prediction").notNull(), // JSON with trend, confidence, reasoning
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type MarketPrediction = typeof marketPredictions.$inferSelect;
export type InsertMarketPrediction = typeof marketPredictions.$inferInsert;