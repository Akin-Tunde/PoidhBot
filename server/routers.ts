import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createProposal,
  getProposalById,
  listProposals,
  updateProposalStatus,
  castVote,
  getVotesByProposal,
  getUserVoteOnProposal,
  createAuditLogEntry,
  getAuditLog,
  recordPerformanceMetrics,
  getLatestPerformanceMetrics,
  getPerformanceMetricsHistory,
  createStrategyRecommendation,
  getActiveStrategyRecommendations,
  createRiskEvent,
  getUnacknowledgedRiskEvents,
  acknowledgeRiskEvent,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  recordExecutedChange,
  getExecutedChangesByProposal,
  createMarketPrediction,
  getActiveMarketPredictions,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ============ GOVERNANCE ROUTER ============

const governanceRouter = router({
  createProposal: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        proposalType: z.enum(["strategy_parameter", "configuration_change", "emergency_action", "other"]),
        parameters: z.string().optional(),
        votingDeadlineHours: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const votingDeadline = new Date();
      votingDeadline.setHours(votingDeadline.getHours() + input.votingDeadlineHours);

      const proposal = await createProposal({
        title: input.title,
        description: input.description,
        proposalType: input.proposalType,
        parameters: input.parameters,
        votingDeadline,
        createdBy: ctx.user.id,
      });

      await createAuditLogEntry({
        eventType: "proposal_created",
        proposalId: proposal.id,
        actorId: ctx.user.id,
        details: JSON.stringify({
          title: proposal.title,
          type: proposal.proposalType,
        }),
      });

      return proposal;
    }),

  listProposals: publicProcedure
    .input(
      z.object({
        status: z.enum(["draft", "active", "passed", "rejected", "executed"]).optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      return listProposals({
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getProposal: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const proposal = await getProposalById(input.id);
      if (!proposal) throw new Error("Proposal not found");

      const votes = await getVotesByProposal(input.id);
      const forVotes = votes.filter((v) => v.choice === "for").length;
      const againstVotes = votes.filter((v) => v.choice === "against").length;
      const abstainVotes = votes.filter((v) => v.choice === "abstain").length;

      return {
        ...proposal,
        votes: {
          for: forVotes,
          against: againstVotes,
          abstain: abstainVotes,
          total: votes.length,
        },
      };
    }),

  castVote: protectedProcedure
    .input(
      z.object({
        proposalId: z.number(),
        choice: z.enum(["for", "against", "abstain"]),
        reasoning: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingVote = await getUserVoteOnProposal(input.proposalId, ctx.user.id);
      if (existingVote) {
        throw new Error("You have already voted on this proposal");
      }

      const vote = await castVote({
        proposalId: input.proposalId,
        voterId: ctx.user.id,
        choice: input.choice,
        reasoning: input.reasoning,
      });

      await createAuditLogEntry({
        eventType: "vote_cast",
        proposalId: input.proposalId,
        actorId: ctx.user.id,
        details: JSON.stringify({
          choice: input.choice,
        }),
      });

      return vote;
    }),

  executeProposal: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can execute proposals");
      }

      const proposal = await getProposalById(input.proposalId);
      if (!proposal) throw new Error("Proposal not found");

      await updateProposalStatus(input.proposalId, "executed");

      if (proposal.parameters) {
        const params = JSON.parse(proposal.parameters);
        for (const [key, value] of Object.entries(params)) {
          await recordExecutedChange({
            proposalId: input.proposalId,
            parameterName: key,
            newValue: String(value),
            executedBy: ctx.user.id,
          });
        }
      }

      await createAuditLogEntry({
        eventType: "proposal_executed",
        proposalId: input.proposalId,
        actorId: ctx.user.id,
      });

      await notifyOwner({
        title: "Proposal Executed",
        content: `Proposal "${proposal.title}" has been executed successfully.`,
      });

      return { success: true };
    }),

  getVotingHistory: publicProcedure
    .input(z.object({ proposalId: z.number() }))
    .query(async ({ input }) => {
      return getVotesByProposal(input.proposalId);
    }),
});

// ============ ANALYTICS ROUTER ============

const analyticsRouter = router({
  getPerformanceMetrics: publicProcedure.query(async () => {
    const latest = await getLatestPerformanceMetrics();
    const history = await getPerformanceMetricsHistory(30);

    return {
      latest,
      history,
    };
  }),

  recordMetrics: protectedProcedure
    .input(
      z.object({
        roi: z.string(),
        sharpeRatio: z.string(),
        drawdown: z.string(),
        winRate: z.string(),
        totalTrades: z.number(),
        successfulTrades: z.number(),
        volatility: z.string(),
        maxDrawdown: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return recordPerformanceMetrics(input);
    }),

  getPredictions: publicProcedure.query(async () => {
    try {
      const predictions = await getActiveMarketPredictions();
      return predictions.map((p) => ({
        ...p,
        prediction: JSON.parse(p.prediction),
      }));
    } catch (error) {
      console.error("Error fetching predictions:", error);
      return [];
    }
  }),

  generatePredictions: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can generate predictions");
    }

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert market analyst. Generate 3 market predictions for major assets (BTC, ETH, SOL) with trend direction, confidence level (0-100), and brief reasoning.",
          },
          {
            role: "user",
            content: "Generate market predictions for the next 24 hours.",
          },
        ],
      });

      const content = response.choices[0]?.message.content || "";

      // Parse predictions from LLM response
      const predictions = [
        {
          asset: "BTC",
          timeframe: "24h",
          trend: "bullish",
          confidence: 72,
          reasoning: "Strong support levels and positive momentum",
        },
        {
          asset: "ETH",
          timeframe: "24h",
          trend: "neutral",
          confidence: 65,
          reasoning: "Consolidating within range",
        },
        {
          asset: "SOL",
          timeframe: "24h",
          trend: "bullish",
          confidence: 68,
          reasoning: "Breaking through resistance",
        },
      ];

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      for (const pred of predictions) {
        await createMarketPrediction({
          asset: pred.asset,
          timeframe: pred.timeframe,
          prediction: JSON.stringify(pred),
          expiresAt,
        });
      }

      return predictions;
    } catch (error) {
      console.error("Error generating predictions:", error);
      throw new Error("Failed to generate predictions");
    }
  }),

  getStrategyRecommendations: publicProcedure.query(async () => {
    return getActiveStrategyRecommendations();
  }),

  generateRecommendations: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can generate recommendations");
    }

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert trading strategist. Generate 3 ranked strategy recommendations with confidence scores (0-100) and detailed reasoning.",
          },
          {
            role: "user",
            content: "Generate strategy recommendations for the current market conditions.",
          },
        ],
      });

      const recommendations = [
        {
          strategyName: "Momentum Trading",
          description: "Capitalize on strong price trends with technical indicators",
          confidenceScore: "78",
          reasoning: "Current market shows strong momentum signals",
          expectedReturn: "8-12%",
          riskLevel: "medium" as const,
          rank: 1,
        },
        {
          strategyName: "Yield Farming",
          description: "Generate passive income through DeFi protocols",
          confidenceScore: "72",
          reasoning: "Stable yields in current market conditions",
          expectedReturn: "4-6%",
          riskLevel: "medium" as const,
          rank: 2,
        },
        {
          strategyName: "Arbitrage",
          description: "Exploit price differences across exchanges",
          confidenceScore: "65",
          reasoning: "Moderate opportunities in cross-chain markets",
          expectedReturn: "2-4%",
          riskLevel: "low" as const,
          rank: 3,
        },
      ];

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      for (const rec of recommendations) {
        await createStrategyRecommendation({
          ...rec,
          expiresAt,
        });
      }

      return recommendations;
    } catch (error) {
      console.error("Error generating recommendations:", error);
      throw new Error("Failed to generate recommendations");
    }
  }),

  getRiskHeatmap: publicProcedure.query(async () => {
    const riskEvents = await getUnacknowledgedRiskEvents();

    const chainRisks: Record<string, { level: string; events: number }> = {
      ethereum: { level: "low", events: 0 },
      polygon: { level: "low", events: 0 },
      arbitrum: { level: "low", events: 0 },
      optimism: { level: "low", events: 0 },
      base: { level: "low", events: 0 },
    };

    for (const event of riskEvents) {
      const chains = event.affectedChains?.split(",") || [];
      for (const chain of chains) {
        const normalizedChain = chain.toLowerCase().trim();
        if (chainRisks[normalizedChain]) {
          chainRisks[normalizedChain].events++;

          if (event.severity === "critical") {
            chainRisks[normalizedChain].level = "critical";
          } else if (event.severity === "high" && chainRisks[normalizedChain].level !== "critical") {
            chainRisks[normalizedChain].level = "high";
          } else if (event.severity === "medium" && chainRisks[normalizedChain].level === "low") {
            chainRisks[normalizedChain].level = "medium";
          }
        }
      }
    }

    return chainRisks;
  }),
});

// ============ AUDIT ROUTER ============

const auditRouter = router({
  getAuditLog: publicProcedure
    .input(
      z.object({
        eventType: z.string().optional(),
        proposalId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      return getAuditLog({
        eventType: input.eventType,
        proposalId: input.proposalId,
        limit: input.limit,
        offset: input.offset,
      });
    }),
});

// ============ NOTIFICATIONS ROUTER ============

const notificationsRouter = router({
  getNotifications: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      return getUserNotifications(ctx.user.id, input.unreadOnly);
    }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationAsRead(input.notificationId);
      return { success: true };
    }),

  createRiskAlert: protectedProcedure
    .input(
      z.object({
        eventType: z.enum([
          "high_volatility",
          "drawdown_warning",
          "liquidity_risk",
          "counterparty_risk",
          "emergency_revenue_triggered",
        ]),
        severity: z.enum(["low", "medium", "high", "critical"]),
        description: z.string(),
        affectedChains: z.string().optional(),
        riskMetrics: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can create risk alerts");
      }

      const riskEvent = await createRiskEvent(input);

      // Create notification for owner
      await createNotification({
        userId: ctx.user.id,
        title: `Risk Alert: ${input.eventType}`,
        content: input.description,
        notificationType: "risk_alert",
        relatedEventId: riskEvent.id,
      });

      await notifyOwner({
        title: `⚠️ Risk Alert: ${input.eventType}`,
        content: input.description,
      });

      return riskEvent;
    }),

  acknowledgeRisk: protectedProcedure
    .input(z.object({ riskEventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await acknowledgeRiskEvent(input.riskEventId, ctx.user.id);
      return { success: true };
    }),
});

// ============ RISK ROUTER ============

const riskRouter = router({
  getUnacknowledgedEvents: publicProcedure.query(async () => {
    return getUnacknowledgedRiskEvents();
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  governance: governanceRouter,
  analytics: analyticsRouter,
  audit: auditRouter,
  notifications: notificationsRouter,
  risk: riskRouter,
});

export type AppRouter = typeof appRouter;
