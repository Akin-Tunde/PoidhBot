import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import { GovernanceDashboard } from "./components/GovernanceDashboard";
import { PerformanceDashboard } from "./components/PerformanceDashboard";
import { StrategyRecommendationsFeed, RiskHeatmap, PredictiveAnalyticsPanel } from "./components/AnalyticsPanel";
import { AuditLog, NotificationCenter } from "./components/AuditAndNotifications";
import Phase7Documentation from "./pages/Phase7Documentation";
import { Card, CardContent } from "@/components/ui/card";

function DashboardRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard/governance" component={GovernanceDashboard} />
        <Route path="/dashboard/performance" component={PerformanceDashboard} />
        <Route
          path="/dashboard/analytics"
          component={() => (
            <div className="space-y-8">
              <PredictiveAnalyticsPanel />
              <StrategyRecommendationsFeed />
            </div>
          )}
        />
        <Route
          path="/dashboard/risk"
          component={() => (
            <div className="space-y-8">
              <RiskHeatmap />
            </div>
          )}
        />
        <Route path="/dashboard/audit" component={AuditLog} />
        <Route path="/dashboard/notifications" component={NotificationCenter} />
        <Route path="/dashboard/documentation" component={Phase7Documentation} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard/*" component={DashboardRouter} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
