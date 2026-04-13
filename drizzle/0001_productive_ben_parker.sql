CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('proposal_created','proposal_activated','vote_cast','proposal_executed','parameter_changed','emergency_triggered') NOT NULL,
	`proposalId` int,
	`actorId` int,
	`details` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executedChanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`parameterName` varchar(255) NOT NULL,
	`previousValue` text,
	`newValue` text NOT NULL,
	`executedBy` int NOT NULL,
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executedChanges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketPredictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asset` varchar(100) NOT NULL,
	`timeframe` varchar(50) NOT NULL,
	`prediction` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `marketPredictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`notificationType` enum('risk_alert','governance_update','emergency_action','performance_milestone') NOT NULL,
	`relatedEventId` int,
	`isRead` int DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performanceMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roi` varchar(50) NOT NULL,
	`sharpeRatio` varchar(50) NOT NULL,
	`drawdown` varchar(50) NOT NULL,
	`winRate` varchar(50) NOT NULL,
	`totalTrades` int NOT NULL,
	`successfulTrades` int NOT NULL,
	`volatility` varchar(50) NOT NULL,
	`maxDrawdown` varchar(50) NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performanceMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`proposalType` enum('strategy_parameter','configuration_change','emergency_action','other') NOT NULL,
	`status` enum('draft','active','passed','rejected','executed') NOT NULL DEFAULT 'draft',
	`parameters` text,
	`votingDeadline` timestamp NOT NULL,
	`executedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `riskEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('high_volatility','drawdown_warning','liquidity_risk','counterparty_risk','emergency_revenue_triggered') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`description` text NOT NULL,
	`affectedChains` varchar(500),
	`riskMetrics` text,
	`acknowledged` int DEFAULT 0,
	`acknowledgedAt` timestamp,
	`acknowledgedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `riskEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategyRecommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategyName` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`confidenceScore` varchar(50) NOT NULL,
	`reasoning` text NOT NULL,
	`expectedReturn` varchar(50),
	`riskLevel` enum('low','medium','high','critical') NOT NULL,
	`rank` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `strategyRecommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`voterId` int NOT NULL,
	`choice` enum('for','against','abstain') NOT NULL,
	`reasoning` text,
	`votedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`)
);
