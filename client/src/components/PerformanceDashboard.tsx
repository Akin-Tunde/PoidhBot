import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

function MetricCard({ label, value, unit, trend, description }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            {unit && <span className="text-sm text-gray-600">{unit}</span>}
            {trend === "up" && <TrendingUp className="w-5 h-5 text-green-500" />}
            {trend === "down" && <TrendingDown className="w-5 h-5 text-red-500" />}
          </div>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceDashboard() {
  const metricsQuery = trpc.analytics.getPerformanceMetrics.useQuery();

  if (metricsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const latest = metricsQuery.data?.latest;
  const history = metricsQuery.data?.history || [];

  // Prepare chart data
  const chartData = history
    .slice()
    .reverse()
    .map((m) => ({
      timestamp: new Date(m.timestamp).toLocaleDateString(),
      roi: parseFloat(m.roi),
      sharpeRatio: parseFloat(m.sharpeRatio),
      drawdown: parseFloat(m.drawdown),
      winRate: parseFloat(m.winRate),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AgentV3 Performance Overview</h1>
        <p className="text-gray-600 mt-1">Real-time metrics and KPIs from Phase 6 autonomous agent</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Return on Investment (ROI)"
          value={latest?.roi || "0"}
          unit="%"
          trend={parseFloat(latest?.roi || "0") > 0 ? "up" : "down"}
          description="Cumulative return since inception"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={latest?.sharpeRatio || "0"}
          description="Risk-adjusted returns"
        />
        <MetricCard
          label="Maximum Drawdown"
          value={latest?.drawdown || "0"}
          unit="%"
          trend="down"
          description="Peak-to-trough decline"
        />
        <MetricCard
          label="Win Rate"
          value={latest?.winRate || "0"}
          unit="%"
          trend={parseFloat(latest?.winRate || "0") > 50 ? "up" : "neutral"}
          description="Percentage of profitable trades"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Trades"
          value={latest?.totalTrades?.toString() || "0"}
          description="Executed strategies"
        />
        <MetricCard
          label="Successful Trades"
          value={latest?.successfulTrades?.toString() || "0"}
          description="Profitable executions"
        />
        <MetricCard
          label="Volatility"
          value={latest?.volatility || "0"}
          unit="%"
          description="Portfolio volatility"
        />
      </div>

      {/* Performance Trends */}
      {chartData.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ROI & Sharpe Ratio Trends</CardTitle>
              <CardDescription>30-day performance history</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="roi" stroke="#3b82f6" name="ROI (%)" />
                  <Line yAxisId="right" type="monotone" dataKey="sharpeRatio" stroke="#10b981" name="Sharpe Ratio" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Win Rate & Drawdown Analysis</CardTitle>
              <CardDescription>Strategy effectiveness metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="winRate" fill="#06b6d4" name="Win Rate (%)" />
                  <Bar dataKey="drawdown" fill="#ef4444" name="Drawdown (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Status Summary */}
      {latest && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle>Agent Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Last Updated</p>
                <p className="font-medium">{formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })}</p>
              </div>
              <div>
                <p className="text-gray-600">Performance Status</p>
                <p className="font-medium">
                  {parseFloat(latest.roi) > 0 ? "✅ Profitable" : "⚠️ In Loss"}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Risk Level</p>
                <p className="font-medium">
                  {parseFloat(latest.volatility) < 15 ? "🟢 Low" : parseFloat(latest.volatility) < 30 ? "🟡 Medium" : "🔴 High"}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Trade Success</p>
                <p className="font-medium">
                  {latest.totalTrades > 0
                    ? `${Math.round((latest.successfulTrades / latest.totalTrades) * 100)}% success rate`
                    : "No trades"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
