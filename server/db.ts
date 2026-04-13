import { eq, desc, and, gte, lte, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  proposals,
  votes,
  auditLog,
  performanceMetrics,
  strategyRecommendations,
  riskEvents,
  notifications,
  executedChanges,
  marketPredictions,
  Proposal,
  Vote,
  AuditLogEntry,
  PerformanceMetric,
  StrategyRecommendation,
  RiskEvent,
  Notification,
  ExecutedChange,
  MarketPrediction,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ GOVERNANCE QUERIES ============

export async function createProposal(data: {
  title: string;
  description: string;
  proposalType: "strategy_parameter" | "configuration_change" | "emergency_action" | "other";
  parameters?: string;
  votingDeadline: Date;
  createdBy: number;
}): Promise<Proposal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(proposals).values(data);
  const id = result[0].insertId;
  const inserted = await db.select().from(proposals).where(eq(proposals.id, id as number)).limit(1);
  return inserted[0];
}

export async function getProposalById(id: number): Promise<Proposal | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return result[0];
}

export async function listProposals(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Proposal[]> {
  const db = await getDb();
  if (!db) return [];

  let query = filters?.status
    ? db.select().from(proposals).where(eq(proposals.status, filters.status as any))
    : db.select().from(proposals);

  query = (query as any).orderBy(desc(proposals.createdAt));

  if (filters?.limit) {
    query = (query as any).limit(filters.limit);
  }
  if (filters?.offset) {
    query = (query as any).offset(filters.offset);
  }

  return query as any;
}

export async function updateProposalStatus(
  id: number,
  status: "draft" | "active" | "passed" | "rejected" | "executed"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(proposals).set({ status }).where(eq(proposals.id, id));
}

// ============ VOTING QUERIES ============

export async function castVote(data: {
  proposalId: number;
  voterId: number;
  choice: "for" | "against" | "abstain";
  reasoning?: string;
}): Promise<Vote> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(votes).values(data);
  const id = result[0].insertId;
  const inserted = await db.select().from(votes).where(eq(votes.id, id as number)).limit(1);
  return inserted[0];
}

export async function getVotesByProposal(proposalId: number): Promise<Vote[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(votes).where(eq(votes.proposalId, proposalId));
}

export async function getUserVoteOnProposal(proposalId: number, voterId: number): Promise<Vote | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(votes)
    .where(and(eq(votes.proposalId, proposalId), eq(votes.voterId, voterId)))
    .limit(1);

  return result[0];
}

// ============ AUDIT LOG QUERIES ============

export async function createAuditLogEntry(data: {
  eventType:
    | "proposal_created"
    | "proposal_activated"
    | "vote_cast"
    | "proposal_executed"
    | "parameter_changed"
    | "emergency_triggered";
  proposalId?: number;
  actorId?: number;
  details?: string;
}): Promise<AuditLogEntry> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(auditLog).values(data);
  const id = result[0].insertId;
  const inserted = await db.select().from(auditLog).where(eq(auditLog.id, id as number)).limit(1);
  return inserted[0];
}

export async function getAuditLog(filters?: {
  eventType?: string;
  proposalId?: number;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (filters?.eventType) {
    conditions.push(eq(auditLog.eventType, filters.eventType as any));
  }
  if (filters?.proposalId) {
    conditions.push(eq(auditLog.proposalId, filters.proposalId));
  }

  let query = conditions.length > 0
    ? db.select().from(auditLog).where(and(...conditions))
    : db.select().from(auditLog);

  query = (query as any).orderBy(desc(auditLog.timestamp));

  if (filters?.limit) {
    query = (query as any).limit(filters.limit);
  }
  if (filters?.offset) {
    query = (query as any).offset(filters.offset);
  }

  return query as any;
}

// ============ PERFORMANCE METRICS QUERIES ============

export async function recordPerformanceMetrics(data: {
  roi: string;
  sharpeRatio: string;
  drawdown: string;
  winRate: string;
  totalTrades: number;
  successfulTrades: number;
  volatility: string;
  maxDrawdown: string;
}): Promise<PerformanceMetric> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(performanceMetrics).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(performanceMetrics)
    .where(eq(performanceMetrics.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getLatestPerformanceMetrics(): Promise<PerformanceMetric | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(performanceMetrics)
    .orderBy(desc(performanceMetrics.timestamp))
    .limit(1);

  return result[0];
}

export async function getPerformanceMetricsHistory(limit: number = 100): Promise<PerformanceMetric[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(performanceMetrics).orderBy(desc(performanceMetrics.timestamp)).limit(limit);
}

// ============ STRATEGY RECOMMENDATIONS QUERIES ============

export async function createStrategyRecommendation(data: {
  strategyName: string;
  description: string;
  confidenceScore: string;
  reasoning: string;
  expectedReturn?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  rank: number;
  expiresAt: Date;
}): Promise<StrategyRecommendation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(strategyRecommendations).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(strategyRecommendations)
    .where(eq(strategyRecommendations.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getActiveStrategyRecommendations(): Promise<StrategyRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(strategyRecommendations)
    .where(gte(strategyRecommendations.expiresAt, new Date()))
    .orderBy(strategyRecommendations.rank);
}

// ============ RISK EVENTS QUERIES ============

export async function createRiskEvent(data: {
  eventType: "high_volatility" | "drawdown_warning" | "liquidity_risk" | "counterparty_risk" | "emergency_revenue_triggered";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedChains?: string;
  riskMetrics?: string;
}): Promise<RiskEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(riskEvents).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(riskEvents)
    .where(eq(riskEvents.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getUnacknowledgedRiskEvents(): Promise<RiskEvent[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(riskEvents)
    .where(eq(riskEvents.acknowledged, 0))
    .orderBy(desc(riskEvents.createdAt));
}

export async function acknowledgeRiskEvent(id: number, acknowledgedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(riskEvents)
    .set({
      acknowledged: 1,
      acknowledgedAt: new Date(),
      acknowledgedBy,
    })
    .where(eq(riskEvents.id, id));
}

// ============ NOTIFICATIONS QUERIES ============

export async function createNotification(data: {
  userId: number;
  title: string;
  content: string;
  notificationType: "risk_alert" | "governance_update" | "emergency_action" | "performance_milestone";
  relatedEventId?: number;
}): Promise<Notification> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getUserNotifications(userId: number, unreadOnly: boolean = false): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, 0));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(notifications)
    .set({
      isRead: 1,
      readAt: new Date(),
    })
    .where(eq(notifications.id, id));
}

// ============ EXECUTED CHANGES QUERIES ============

export async function recordExecutedChange(data: {
  proposalId: number;
  parameterName: string;
  previousValue?: string;
  newValue: string;
  executedBy: number;
}): Promise<ExecutedChange> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(executedChanges).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(executedChanges)
    .where(eq(executedChanges.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getExecutedChangesByProposal(proposalId: number): Promise<ExecutedChange[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(executedChanges).where(eq(executedChanges.proposalId, proposalId));
}

// ============ MARKET PREDICTIONS QUERIES ============

export async function createMarketPrediction(data: {
  asset: string;
  timeframe: string;
  prediction: string; // JSON string
  expiresAt: Date;
}): Promise<MarketPrediction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(marketPredictions).values(data);
  const id = result[0].insertId;
  const inserted = await db
    .select()
    .from(marketPredictions)
    .where(eq(marketPredictions.id, id as number))
    .limit(1);
  return inserted[0];
}

export async function getActiveMarketPredictions(): Promise<MarketPrediction[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketPredictions)
    .where(gte(marketPredictions.expiresAt, new Date()))
    .orderBy(desc(marketPredictions.generatedAt));
}
