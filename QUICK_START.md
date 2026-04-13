# Quick Start Guide - 5 Minutes to Running Phase 7

## TL;DR - The Fastest Way to Get Started

```bash
# 1. Extract
unzip poidh-agent-phase7-complete.zip
cd poidh-agent-phase7

# 2. Install
pnpm install

# 3. Setup Database (choose one)
# Option A: Manus Platform (automatic)
# Option B: Local MySQL
mysql -u root -p poidh_phase7 < phase7_migration.sql

# 4. Start
pnpm dev

# 5. Open browser
# http://localhost:3000
```

---

## What is Phase 7?

**Governance + Intelligence Dashboard for Autonomous Trading Agents**

In plain English:
- **Governance**: Vote on how the trading agent should behave
- **Intelligence**: AI predictions tell you what markets will do
- **Dashboard**: See agent performance, risks, and voting history
- **Audit Trail**: Complete record of all decisions

---

## 30-Second Feature Overview

| Feature | What It Does | Why It Matters |
| :--- | :--- | :--- |
| **Governance** | Create proposals, vote on changes | Democratic control of agent |
| **Performance** | See ROI, Sharpe ratio, win rate | Know if agent is working |
| **Analytics** | AI market predictions | Make informed decisions |
| **Risk Heatmap** | See risks across blockchains | Avoid disasters |
| **Audit Log** | Record of all decisions | Compliance & transparency |
| **Notifications** | Alerts for critical events | Never miss important updates |

---

## Installation (3 Steps)

### Step 1: Extract & Install Dependencies

```bash
unzip poidh-agent-phase7-complete.zip
cd poidh-agent-phase7
pnpm install
```

**Takes**: ~2 minutes  
**What it does**: Downloads all code dependencies

### Step 2: Setup Database

**For Manus Platform** (automatic):
```bash
# Nothing to do - database is set up automatically
```

**For Local MySQL**:
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE poidh_phase7;"

# Run migration
mysql -u root -p poidh_phase7 < phase7_migration.sql

# Set environment variable
export DATABASE_URL="mysql://root:password@localhost:3306/poidh_phase7"
```

**Takes**: ~1 minute  
**What it does**: Creates 9 database tables

### Step 3: Start Server

```bash
pnpm dev
```

**Takes**: ~30 seconds  
**Output**: 
```
Server running on http://localhost:3000/
```

---

## First Time Using It?

1. **Open browser**: http://localhost:3000
2. **Click "Login"**: Authenticate with Manus OAuth
3. **Explore dashboards**: 
   - `/dashboard/governance` - Create proposals
   - `/dashboard/performance` - View agent metrics
   - `/dashboard/analytics` - See AI predictions
   - `/dashboard/risk` - Check portfolio risks
   - `/dashboard/audit` - View governance history
   - `/dashboard/notifications` - See alerts

---

## Common Tasks

### Create a Proposal

```
1. Go to /dashboard/governance
2. Click "Create Proposal"
3. Fill in:
   - Title: "Increase Risk Tolerance"
   - Description: "Agent should take more risk"
   - Type: "strategy_parameter"
   - Voting Deadline: 48 hours
   - Parameters: {"riskTolerance": 0.8}
4. Click "Submit"
5. Other users vote
6. If passed, admin executes
```

### Check Performance

```
1. Go to /dashboard/performance
2. See current metrics:
   - ROI: 15.5%
   - Sharpe Ratio: 1.8
   - Drawdown: 8.2%
   - Win Rate: 62.5%
3. View 30-day trend chart
```

### View Predictions

```
1. Go to /dashboard/analytics
2. See AI predictions:
   - Bitcoin: +5-8% (85% confidence)
   - Ethereum: +2-4% (78% confidence)
3. See recommended strategies
```

### Check Risks

```
1. Go to /dashboard/risk
2. See color-coded risk heatmap:
   - Green: Low risk
   - Yellow: Medium risk
   - Orange: High risk
   - Red: Critical risk
3. Click chains for details
```

---

## Troubleshooting

### "Port 3000 already in use"
```bash
PORT=3001 pnpm dev
# Then go to http://localhost:3001
```

### "Database connection failed"
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Verify MySQL is running
mysql -u root -p -e "SELECT 1"

# Run migration
mysql -u root -p poidh_phase7 < phase7_migration.sql
```

### "Tests failing"
```bash
# Run just unit tests (don't need database)
pnpm test server/phase7.unit.test.ts

# Should see: 34 tests passing
```

### "OAuth login not working"
```bash
# Check environment variables
echo $VITE_APP_ID
echo $OAUTH_SERVER_URL

# Verify they're set correctly in .env.local
```

---

## Project Structure (What Goes Where)

```
poidh-agent-phase7/
├── client/                    # React frontend (what users see)
│   └── src/
│       ├── components/       # UI components
│       ├── pages/           # Page screens
│       └── App.tsx          # Main app
├── server/                   # Express backend (API)
│   ├── routers.ts           # API endpoints
│   ├── db.ts                # Database queries
│   └── _core/               # Framework stuff
├── drizzle/                  # Database schema
│   ├── schema.ts            # Table definitions
│   └── *.sql                # Migrations
├── INSTALLATION_GUIDE.md     # Detailed setup
├── PROJECT_OVERVIEW.md      # What this does
├── PHASE7_README.md         # Usage guide
└── phase7_migration.sql     # Database setup
```

---

## What Each Dashboard Does

### Governance Dashboard (`/dashboard/governance`)
- **Create proposals** for parameter changes
- **Vote** on proposals (for/against/abstain)
- **Track voting** with countdown timers
- **Execute** passed proposals

### Performance Dashboard (`/dashboard/performance`)
- **ROI**: Return on investment percentage
- **Sharpe Ratio**: Risk-adjusted returns
- **Drawdown**: Maximum loss percentage
- **Win Rate**: Profitable trades percentage
- **30-day trends**: Historical performance chart

### Analytics Dashboard (`/dashboard/analytics`)
- **Market predictions**: AI forecasts for BTC, ETH, SOL
- **Confidence scores**: 0-100% confidence levels
- **Strategy recommendations**: AI-suggested trades
- **Expected returns**: Projected gains

### Risk Dashboard (`/dashboard/risk`)
- **Cross-chain heatmap**: Risk per blockchain
- **Color coding**: Green (low) to Red (critical)
- **Active events**: Number of risk events per chain
- **Detailed metrics**: Hover for specifics

### Audit Dashboard (`/dashboard/audit`)
- **Governance history**: All decisions recorded
- **Timestamps**: Exact time of each event
- **Event types**: Proposals, votes, executions
- **Filtering**: Search by type or date

### Notifications (`/dashboard/notifications`)
- **Risk alerts**: Critical events
- **Governance updates**: Proposal outcomes
- **Emergency actions**: Urgent triggers
- **Performance milestones**: Achievement alerts

---

## How It Works (Simple Explanation)

### The Voting Process

```
1. Someone proposes: "Increase risk to 0.8"
   ↓
2. Proposal goes to voting for 48 hours
   ↓
3. People vote:
   - User1: FOR (thinks it's good)
   - User2: FOR (agrees)
   - User3: AGAINST (too risky)
   ↓
4. Voting ends: 2 FOR, 1 AGAINST → PASSED
   ↓
5. Admin clicks "Execute"
   ↓
6. Agent gets new parameter: riskTolerance = 0.8
   ↓
7. Everything recorded in audit log
```

### The Prediction Process

```
1. Admin clicks "Generate Predictions"
   ↓
2. AI analyzes market data
   ↓
3. AI generates predictions:
   - Bitcoin: +5-8% (85% confidence)
   - Ethereum: +2-4% (78% confidence)
   ↓
4. Predictions displayed on dashboard
   ↓
5. Predictions expire after 24 hours
```

---

## Environment Variables

**On Manus Platform**: Automatically set, no action needed

**Local Setup**: Create `.env.local`:
```env
DATABASE_URL=mysql://user:password@localhost:3306/poidh_phase7
JWT_SECRET=your-secret-key-here-min-32-chars
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://api.manus.im
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=your-api-key
```

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test server/phase7.unit.test.ts

# Watch mode
pnpm test -- --watch

# Expected: 34 tests passing
```

---

## Production Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Server runs on http://localhost:3000
```

---

## Key Files to Know

| File | Purpose |
| :--- | :--- |
| `INSTALLATION_GUIDE.md` | Detailed setup instructions |
| `PROJECT_OVERVIEW.md` | What this project does |
| `PHASE7_README.md` | Complete usage guide |
| `OPTIMIZATION_REPORT.md` | Performance & accessibility |
| `phase7_migration.sql` | Database setup |
| `server/routers.ts` | API endpoints |
| `client/src/App.tsx` | Frontend routing |
| `drizzle/schema.ts` | Database schema |

---

## Next Steps

1. ✅ Extract ZIP
2. ✅ Run `pnpm install`
3. ✅ Setup database
4. ✅ Run `pnpm dev`
5. ✅ Open http://localhost:3000
6. ✅ Login with Manus OAuth
7. ✅ Create your first proposal
8. ✅ Vote on proposals
9. ✅ Check performance dashboard
10. ✅ Review audit log

---

## Need Help?

- **Setup Issues**: See `INSTALLATION_GUIDE.md`
- **How to Use**: See `PROJECT_OVERVIEW.md`
- **Technical Details**: See `PHASE7_README.md`
- **Performance Info**: See `OPTIMIZATION_REPORT.md`
- **In-app Help**: Go to `/dashboard/documentation`

---

**You're ready! Start with `pnpm dev` and explore.** 🚀
