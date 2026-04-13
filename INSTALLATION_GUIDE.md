# Phase 7 Installation & Setup Guide

## What is This Project?

**POIDH Autonomous AI Agent - Phase 7** is an elegant, production-ready web application that transforms AgentV3 (an autonomous trading agent) into a governed, intelligent system. It combines:

- **Democratic Governance**: Community-driven parameter decisions through proposal voting
- **AI-Powered Analytics**: Machine learning market predictions and strategy recommendations
- **Real-time Performance Monitoring**: AgentV3 KPI dashboards with historical trends
- **Risk Management**: Cross-chain portfolio risk visualization and alerting
- **Complete Audit Trail**: Immutable governance history for compliance

### Core Features

1. **Governance Dashboard** - Create and vote on proposals that change agent parameters
2. **Performance Dashboard** - Real-time metrics: ROI, Sharpe ratio, drawdown, win rate
3. **Predictive Analytics** - LLM-powered market forecasting with confidence scoring
4. **Strategy Recommendations** - AI-generated ranked trading strategies
5. **Risk Heatmap** - Cross-chain risk visualization (Ethereum, Polygon, Arbitrum, Optimism, Base)
6. **Audit Log** - Immutable timestamped record of all governance events
7. **Notification Center** - Owner alerts for critical events and governance updates
8. **In-app Documentation** - Phase 6 vs Phase 7 feature comparison

---

## System Requirements

### Minimum Requirements
- **Node.js**: 22.13.0 or higher
- **npm/pnpm**: 10.4.1 or higher
- **MySQL**: 8.0 or higher (or compatible database)
- **RAM**: 2GB minimum
- **Disk Space**: 500MB for dependencies + database

### Recommended Setup
- **Node.js**: 22.13.0 LTS
- **MySQL**: 8.0+ with InnoDB
- **RAM**: 4GB+
- **CPU**: 2+ cores
- **OS**: Linux, macOS, or Windows (WSL2)

---

## Installation Steps

### Step 1: Extract the ZIP File

```bash
unzip poidh-agent-phase7.zip
cd poidh-agent-phase7
```

### Step 2: Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install

# Or using yarn
yarn install
```

**Note**: pnpm is the package manager used in this project. If you don't have it installed:
```bash
npm install -g pnpm
```

### Step 3: Set Up Database

#### Option A: Using Manus Platform (Recommended)

If you're using Manus platform, the database is automatically provisioned:
- `DATABASE_URL` is automatically set
- All environment variables are injected
- No manual database setup required

#### Option B: Local MySQL Setup

If running locally, set up MySQL:

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE poidh_phase7;"

# Set environment variable
export DATABASE_URL="mysql://user:password@localhost:3306/poidh_phase7"
```

#### Step 4: Execute Database Migration

Create all Phase 7 tables:

```bash
# Option 1: Using MySQL CLI
mysql -u user -p poidh_phase7 < phase7_migration.sql

# Option 2: Using Node script (if available)
pnpm run db:migrate

# Option 3: Manual execution
# Copy contents of phase7_migration.sql and execute in MySQL Workbench or CLI
```

### Step 5: Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/poidh_phase7

# Authentication
JWT_SECRET=your-secret-key-here-min-32-chars
VITE_APP_ID=your-manus-oauth-app-id

# OAuth
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im

# API Keys
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=your-api-key-here
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key

# Owner Info
OWNER_NAME=Your Name
OWNER_OPEN_ID=your-open-id
```

**Note**: On Manus platform, these are automatically injected and no `.env` file is needed.

### Step 6: Verify Installation

```bash
# Check TypeScript compilation
pnpm check

# Run tests
pnpm test

# Expected output: 34 tests passing
```

---

## Starting the Application

### Development Mode

```bash
# Start development server with hot reload
pnpm dev

# Server will start on http://localhost:3000
# Frontend will be available at http://localhost:3000
```

### Production Mode

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Server will start on http://localhost:3000
```

### Docker (Optional)

```bash
# Build Docker image
docker build -t poidh-phase7 .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="..." \
  poidh-phase7
```

---

## Accessing the Application

Once the server is running:

### Web Interface
- **URL**: http://localhost:3000 (or your deployed domain)
- **Login**: Click "Login with Manus" to authenticate
- **Dashboard**: Navigate to `/dashboard/governance` or other sections

### Available Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Home/landing page |
| `/dashboard/governance` | Governance dashboard - create & vote on proposals |
| `/dashboard/performance` | Performance dashboard - AgentV3 KPIs |
| `/dashboard/analytics` | Predictive analytics - market forecasts & recommendations |
| `/dashboard/risk` | Risk heatmap - cross-chain risk visualization |
| `/dashboard/audit` | Audit log - governance history |
| `/dashboard/notifications` | Notification center - alerts & updates |
| `/dashboard/documentation` | Phase 7 documentation & feature guide |

---

## Project Structure

```
poidh-agent-phase7/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── GovernanceDashboard.tsx
│   │   │   ├── PerformanceDashboard.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   ├── AuditAndNotifications.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── pages/                  # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── Phase7Documentation.tsx
│   │   │   └── NotFound.tsx
│   │   ├── lib/
│   │   │   └── trpc.ts            # tRPC client setup
│   │   ├── App.tsx                # Main app router
│   │   └── main.tsx               # Entry point
│   ├── public/                     # Static assets
│   └── index.html
├── server/                          # Express backend
│   ├── routers.ts                 # tRPC procedures
│   ├── db.ts                      # Database queries
│   ├── phase7.test.ts             # Integration tests
│   ├── phase7.unit.test.ts        # Unit tests (34 passing)
│   └── _core/                     # Framework plumbing
│       ├── index.ts               # Server entry point
│       ├── context.ts             # tRPC context
│       ├── trpc.ts                # tRPC setup
│       ├── auth.ts                # OAuth handling
│       ├── llm.ts                 # LLM integration
│       └── ...
├── drizzle/                         # Database schema
│   ├── schema.ts                  # Table definitions
│   ├── 0001_productive_ben_parker.sql  # Migration SQL
│   └── migrations/
├── shared/                          # Shared types & constants
├── storage/                         # S3 storage helpers
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                  # Vite bundler config
├── tailwind.config.js              # Tailwind CSS config
├── PHASE7_IMPLEMENTATION.md        # Implementation guide
├── PHASE7_README.md                # Usage guide
├── OPTIMIZATION_REPORT.md          # Performance audit
├── INSTALLATION_GUIDE.md           # This file
├── phase7_migration.sql            # Database migration
└── todo.md                         # Feature checklist
```

---

## Common Tasks

### Creating a Proposal

1. Navigate to `/dashboard/governance`
2. Click "Create Proposal"
3. Fill in:
   - **Title**: Proposal name
   - **Description**: Detailed explanation
   - **Type**: Strategy parameter, configuration change, etc.
   - **Voting Deadline**: Hours until voting ends
   - **Parameters**: JSON configuration changes
4. Click "Submit"
5. Proposal enters "draft" state
6. Admin activates for voting
7. Community votes during deadline
8. If passed, admin executes changes

### Viewing Performance Metrics

1. Navigate to `/dashboard/performance`
2. View current KPIs:
   - **ROI**: Return on investment percentage
   - **Sharpe Ratio**: Risk-adjusted returns
   - **Drawdown**: Maximum peak-to-trough decline
   - **Win Rate**: Percentage of profitable trades
3. View 30-day performance trends in charts

### Checking Risk Status

1. Navigate to `/dashboard/risk`
2. View cross-chain risk heatmap
3. Check risk levels for each blockchain:
   - Green: Low risk
   - Yellow: Medium risk
   - Orange: High risk
   - Red: Critical risk
4. Click chains for detailed metrics

### Reviewing Governance History

1. Navigate to `/dashboard/audit`
2. Browse timestamped governance events
3. Filter by event type (proposals, votes, executions)
4. View complete audit trail for compliance

---

## Troubleshooting

### Database Connection Error

```
Error: Table 'database.proposals' doesn't exist
```

**Solution**: Execute the database migration:
```bash
mysql -u user -p database < phase7_migration.sql
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

**Solution**: Use a different port:
```bash
PORT=3001 pnpm dev
```

### OAuth Login Not Working

```
Error: Invalid redirect URI
```

**Solution**: 
1. Verify `VITE_APP_ID` is correct
2. Check `OAUTH_SERVER_URL` is accessible
3. Ensure redirect URI matches OAuth app configuration

### Tests Failing

```
Error: Database tables don't exist
```

**Solution**: 
1. Execute database migration first
2. Verify `DATABASE_URL` is set correctly
3. Run: `pnpm test server/phase7.unit.test.ts` (doesn't require database)

### LLM Integration Not Working

```
Error: Failed to invoke LLM
```

**Solution**:
1. Verify `BUILT_IN_FORGE_API_KEY` is set
2. Check `BUILT_IN_FORGE_API_URL` is accessible
3. Verify API key has LLM permissions

---

## Development Workflow

### Making Changes

1. **Backend**: Edit `server/routers.ts` or `server/db.ts`
2. **Frontend**: Edit components in `client/src/`
3. **Database**: Update `drizzle/schema.ts`, generate migration, apply SQL
4. **Tests**: Add tests in `server/*.test.ts`

### Running Tests

```bash
# All tests
pnpm test

# Specific test file
pnpm test server/phase7.unit.test.ts

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

### Code Quality

```bash
# Type check
pnpm check

# Format code
pnpm format

# Lint
pnpm lint
```

---

## Performance Tips

1. **Database Optimization**:
   - Use pagination for large result sets
   - Index frequently queried columns
   - Use prepared statements

2. **Frontend Optimization**:
   - Use React.lazy for route splitting
   - Memoize expensive components
   - Minimize re-renders with useCallback

3. **LLM Optimization**:
   - Cache predictions for 24 hours
   - Cache recommendations for 7 days
   - Use async generation for long operations

---

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate regularly, use least-privilege access
3. **Database**: Use strong passwords, restrict network access
4. **OAuth**: Always use HTTPS in production
5. **Audit Log**: Monitor for suspicious governance activity

---

## Deployment

### Manus Platform

1. Push code to repository
2. Platform automatically detects `package.json`
3. Dependencies installed via `pnpm install`
4. Database tables created from migration SQL
5. Environment variables injected automatically
6. Application deployed to `https://your-project.manus.space`

### Self-Hosted (VPS/Server)

1. Clone repository
2. Install Node.js 22.13.0+
3. Install MySQL 8.0+
4. Set environment variables
5. Run `pnpm install && pnpm build`
6. Run `pnpm start`
7. Configure reverse proxy (nginx/Apache)
8. Set up SSL certificate (Let's Encrypt)

### Docker Deployment

1. Build image: `docker build -t poidh-phase7 .`
2. Push to registry: `docker push your-registry/poidh-phase7`
3. Deploy with environment variables
4. Expose port 3000

---

## Support & Resources

- **Documentation**: See `PHASE7_README.md` and `PHASE7_IMPLEMENTATION.md`
- **In-app Guide**: Navigate to `/dashboard/documentation`
- **Tests**: Review `server/phase7.unit.test.ts` for usage examples
- **Performance**: See `OPTIMIZATION_REPORT.md`

---

## Next Steps

1. ✅ Extract ZIP and install dependencies
2. ✅ Set up database with migration SQL
3. ✅ Configure environment variables
4. ✅ Run `pnpm dev` to start development server
5. ✅ Navigate to http://localhost:3000
6. ✅ Login with Manus OAuth
7. ✅ Explore governance, analytics, and performance dashboards
8. ✅ Create proposals and vote
9. ✅ Review audit logs
10. ✅ Deploy to production

---

**Phase 7 is production-ready and fully documented. Happy governance!** 🚀
