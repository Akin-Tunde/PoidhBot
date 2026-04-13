# POIDH Unified Codebase (Phases 1-7 + PoidhBot)

This repository consolidates all development phases of the POIDH (Pics Or It Didn't Happen) project into a single source base.

## Project Structure

- **client/**: React frontend (Phase 7) - Governance Dashboard, Analytics, and Performance Monitoring.
- **server/**: Express/tRPC backend (Phase 7) - Handles database, auth, and API.
  - **server/agent/**: Core Agent Logic (Phase 6 - AgentV3).
  - **server/core/**: Orchestration, Analytics, and Wallet management (Phases 1-5).
  - **server/strategies/**: Trading and DeFi strategies (Phases 2-4).
  - **server/bot/**: PoidhBot logic for autonomous bounty management.
  - **server/config/**: Configuration management for the agent.
- **docs/**: Consolidated documentation from all phases.
- **drizzle/**: Database schema and migrations (Phase 7).

## How to Run

1. **Install Dependencies**: `pnpm install`
2. **Setup Database**: Use the SQL migrations in `drizzle/` or `phase7_migration.sql`.
3. **Environment Variables**: Configure `.env` based on `.env.example`.
4. **Start Development**: `pnpm dev`

## Connectivity

All components are now in one place. The Phase 7 full-stack application serves as the primary interface for managing the autonomous agent (AgentV3) and monitoring the PoidhBot.

For detailed history and implementation details of each phase, please refer to the `docs/` directory.
