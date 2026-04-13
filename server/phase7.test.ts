import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for testing
function createMockContext(userId: number = 1, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

describe("Phase 7 - Governance & Analytics", () => {
  describe("Governance Router", () => {
    it("should create a new proposal", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.governance.createProposal({
        title: "Increase Risk Tolerance",
        description: "Proposal to increase agent risk tolerance to 0.8",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
        parameters: JSON.stringify({ riskTolerance: 0.8 }),
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Increase Risk Tolerance");
      expect(result.status).toBe("draft");
      expect(result.createdBy).toBe(ctx.user.id);
    });

    it("should list proposals with filtering", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const proposals = await caller.governance.listProposals({
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(proposals)).toBe(true);
    });

    it("should get proposal with voting results", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Create a proposal first
      const proposal = await caller.governance.createProposal({
        title: "Test Proposal",
        description: "Test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
      });

      // Get the proposal
      const result = await caller.governance.getProposal({ id: proposal.id });

      expect(result).toBeDefined();
      expect(result.title).toBe("Test Proposal");
      expect(result.votes).toBeDefined();
      expect(result.votes.total).toBe(0);
    });

    it("should cast a vote on proposal", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Create a proposal
      const proposal = await caller.governance.createProposal({
        title: "Vote Test",
        description: "Test voting",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
      });

      // Cast a vote
      const vote = await caller.governance.castVote({
        proposalId: proposal.id,
        choice: "for",
        reasoning: "Good proposal",
      });

      expect(vote).toBeDefined();
      expect(vote.choice).toBe("for");
      expect(vote.voterId).toBe(ctx.user.id);
    });

    it("should prevent duplicate votes", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Create a proposal
      const proposal = await caller.governance.createProposal({
        title: "Duplicate Vote Test",
        description: "Test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
      });

      // Cast first vote
      await caller.governance.castVote({
        proposalId: proposal.id,
        choice: "for",
      });

      // Try to cast second vote
      try {
        await caller.governance.castVote({
          proposalId: proposal.id,
          choice: "against",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("already voted");
      }
    });

    it("should execute proposal as admin", async () => {
      const ctx = createMockContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      // Create a proposal
      const proposal = await caller.governance.createProposal({
        title: "Execute Test",
        description: "Test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
        parameters: JSON.stringify({ param1: "value1" }),
      });

      // Execute proposal
      const result = await caller.governance.executeProposal({
        proposalId: proposal.id,
      });

      expect(result.success).toBe(true);
    });

    it("should prevent non-admin from executing proposal", async () => {
      const ctx = createMockContext(1, "user");
      const caller = appRouter.createCaller(ctx);

      // Create a proposal
      const proposal = await caller.governance.createProposal({
        title: "Admin Test",
        description: "Test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
      });

      // Try to execute as non-admin
      try {
        await caller.governance.executeProposal({
          proposalId: proposal.id,
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("admin");
      }
    });
  });

  describe("Analytics Router", () => {
    it("should get performance metrics", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const metrics = await caller.analytics.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.latest).toBeDefined();
      expect(metrics.history).toBeDefined();
      expect(Array.isArray(metrics.history)).toBe(true);
    });

    it("should record performance metrics", async () => {
      const ctx = createMockContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.analytics.recordMetrics({
        roi: "15.5",
        sharpeRatio: "1.8",
        drawdown: "8.2",
        winRate: "62.5",
        totalTrades: 100,
        successfulTrades: 62,
        volatility: "12.3",
        maxDrawdown: "8.2",
      });

      expect(result).toBeDefined();
      expect(result.roi).toBe("15.5");
      expect(result.sharpeRatio).toBe("1.8");
    });

    it("should get strategy recommendations", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.analytics.getStrategyRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("should generate predictions as admin", async () => {
      const ctx = createMockContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      const predictions = await caller.analytics.generatePredictions();

      expect(Array.isArray(predictions)).toBe(true);
      if (predictions.length > 0) {
        expect(predictions[0]).toHaveProperty("asset");
        expect(predictions[0]).toHaveProperty("trend");
        expect(predictions[0]).toHaveProperty("confidence");
      }
    });

    it("should get risk heatmap", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const heatmap = await caller.analytics.getRiskHeatmap();

      expect(heatmap).toBeDefined();
      expect(typeof heatmap).toBe("object");
    });

    it("should get predictions", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const predictions = await caller.analytics.getPredictions();

      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe("Audit Router", () => {
    it("should get audit log", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const auditLog = await caller.audit.getAuditLog({
        limit: 50,
        offset: 0,
      });

      expect(Array.isArray(auditLog)).toBe(true);
    });

    it("should filter audit log by event type", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Create a proposal to generate an event
      await caller.governance.createProposal({
        title: "Audit Test",
        description: "Test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
      });

      // Query audit log
      const auditLog = await caller.audit.getAuditLog({
        eventType: "proposal_created",
        limit: 50,
        offset: 0,
      });

      expect(Array.isArray(auditLog)).toBe(true);
      if (auditLog.length > 0) {
        expect(auditLog[0].eventType).toBe("proposal_created");
      }
    });
  });

  describe("Notifications Router", () => {
    it("should get user notifications", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const notifications = await caller.notifications.getNotifications({});

      expect(Array.isArray(notifications)).toBe(true);
    });

    it("should mark notification as read", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Get notifications
      const notifications = await caller.notifications.getNotifications({});

      if (notifications.length > 0) {
        const result = await caller.notifications.markAsRead({
          notificationId: notifications[0].id,
        });

        expect(result.success).toBe(true);
      }
    });

    it("should create risk alert as admin", async () => {
      const ctx = createMockContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      const riskEvent = await caller.notifications.createRiskAlert({
        eventType: "high_volatility",
        severity: "high",
        description: "High volatility detected in portfolio",
        affectedChains: "ethereum,polygon",
      });

      expect(riskEvent).toBeDefined();
      expect(riskEvent.eventType).toBe("high_volatility");
      expect(riskEvent.severity).toBe("high");
    });

    it("should prevent non-admin from creating risk alert", async () => {
      const ctx = createMockContext(1, "user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.notifications.createRiskAlert({
          eventType: "high_volatility",
          severity: "high",
          description: "Test",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("admin");
      }
    });
  });

  describe("Risk Router", () => {
    it("should get unacknowledged risk events", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const riskEvents = await caller.risk.getUnacknowledgedEvents();

      expect(Array.isArray(riskEvents)).toBe(true);
    });
  });

  describe("Authentication Router", () => {
    it("should get current user", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();

      expect(user).toBeDefined();
      expect(user.id).toBe(ctx.user.id);
      expect(user.openId).toBe(ctx.user.openId);
    });

    it("should logout user", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result.success).toBe(true);
      expect(ctx.res.clearCookie).toHaveBeenCalled();
    });
  });

  describe("Integration Tests", () => {
    it("should complete full proposal lifecycle", async () => {
      const adminCtx = createMockContext(1, "admin");
      const userCtx = createMockContext(2, "user");
      const adminCaller = appRouter.createCaller(adminCtx);
      const userCaller = appRouter.createCaller(userCtx);

      // 1. Create proposal
      const proposal = await adminCaller.governance.createProposal({
        title: "Integration Test Proposal",
        description: "Full lifecycle test",
        proposalType: "strategy_parameter",
        votingDeadlineHours: 48,
        parameters: JSON.stringify({ testParam: "testValue" }),
      });

      expect(proposal.status).toBe("draft");

      // 2. Get proposal
      const retrieved = await userCaller.governance.getProposal({
        id: proposal.id,
      });

      expect(retrieved.title).toBe("Integration Test Proposal");

      // 3. Cast votes
      const vote1 = await adminCaller.governance.castVote({
        proposalId: proposal.id,
        choice: "for",
        reasoning: "Admin supports",
      });

      expect(vote1.choice).toBe("for");

      const vote2 = await userCaller.governance.castVote({
        proposalId: proposal.id,
        choice: "for",
        reasoning: "User supports",
      });

      expect(vote2.choice).toBe("for");

      // 4. Get voting history
      const votes = await userCaller.governance.getVotingHistory({
        proposalId: proposal.id,
      });

      expect(votes.length).toBe(2);

      // 5. Execute proposal
      const execution = await adminCaller.governance.executeProposal({
        proposalId: proposal.id,
      });

      expect(execution.success).toBe(true);

      // 6. Check audit log
      const auditLog = await userCaller.audit.getAuditLog({
        proposalId: proposal.id,
        limit: 50,
      });

      expect(auditLog.length).toBeGreaterThan(0);
      const eventTypes = auditLog.map((e) => e.eventType);
      expect(eventTypes).toContain("proposal_created");
      expect(eventTypes).toContain("vote_cast");
      expect(eventTypes).toContain("proposal_executed");
    });

    it("should track performance metrics over time", async () => {
      const ctx = createMockContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      // Record multiple metrics
      await caller.analytics.recordMetrics({
        roi: "10.0",
        sharpeRatio: "1.5",
        drawdown: "5.0",
        winRate: "60.0",
        totalTrades: 50,
        successfulTrades: 30,
        volatility: "10.0",
        maxDrawdown: "5.0",
      });

      await caller.analytics.recordMetrics({
        roi: "15.0",
        sharpeRatio: "1.8",
        drawdown: "4.5",
        winRate: "65.0",
        totalTrades: 100,
        successfulTrades: 65,
        volatility: "9.5",
        maxDrawdown: "4.5",
      });

      // Get metrics
      const metrics = await caller.analytics.getPerformanceMetrics();

      expect(metrics.history.length).toBeGreaterThan(0);
      expect(metrics.latest).toBeDefined();
    });
  });
});
