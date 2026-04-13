import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Zap, AlertTriangle, TrendingUp } from "lucide-react";

const riskLevelConfig = {
  low: { color: "bg-green-100 text-green-800", label: "Low Risk" },
  medium: { color: "bg-yellow-100 text-yellow-800", label: "Medium Risk" },
  high: { color: "bg-orange-100 text-orange-800", label: "High Risk" },
  critical: { color: "bg-red-100 text-red-800", label: "Critical Risk" },
};

const severityConfig = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
  critical: "🔴🔴",
};

export function StrategyRecommendationsFeed() {
  const recommendationsQuery = trpc.analytics.getStrategyRecommendations.useQuery();
  const generateMutation = trpc.analytics.generateRecommendations.useMutation();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      recommendationsQuery.refetch();
    } catch (error) {
      console.error("Failed to generate recommendations:", error);
    }
  };

  if (recommendationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const recommendations = recommendationsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Strategy Recommendations</h2>
        <Button onClick={handleGenerate} disabled={generateMutation.isPending} size="sm">
          {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Generate New
        </Button>
      </div>

      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No recommendations available. Generate new ones to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{rec.strategyName}</h3>
                        <Badge className={riskLevelConfig[rec.riskLevel as keyof typeof riskLevelConfig].color}>
                          {riskLevelConfig[rec.riskLevel as keyof typeof riskLevelConfig].label}
                        </Badge>
                        <Badge variant="outline">Rank #{rec.rank}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-3xl font-bold text-blue-600">{rec.confidenceScore}%</div>
                      <p className="text-xs text-gray-500">Confidence</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm text-gray-700">{rec.reasoning}</p>
                  </div>

                  {rec.expectedReturn && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Expected Return:</span>
                      <span className="font-semibold text-green-600">{rec.expectedReturn}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskHeatmap() {
  const heatmapQuery = trpc.analytics.getRiskHeatmap.useQuery();
  const riskEventsQuery = trpc.risk.getUnacknowledgedEvents.useQuery();

  if (heatmapQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const heatmap = heatmapQuery.data || {};
  const riskEvents = riskEventsQuery.data || [];

  const chainColors = {
    low: "bg-green-100 text-green-800 border-green-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    high: "bg-orange-100 text-orange-800 border-orange-300",
    critical: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Cross-Chain Risk Heatmap</h2>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Risk Distribution</CardTitle>
          <CardDescription>Risk levels across supported blockchain networks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(heatmap).map(([chain, risk]: [string, any]) => (
              <div
                key={chain}
                className={`p-4 rounded-lg border-2 text-center transition-all hover:shadow-md ${
                  chainColors[risk.level as keyof typeof chainColors]
                }`}
              >
                <p className="font-semibold capitalize text-sm mb-1">{chain}</p>
                <p className="text-2xl font-bold">{risk.level.toUpperCase()}</p>
                <p className="text-xs mt-1">{risk.events} event{risk.events !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {riskEvents.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Active Risk Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-2 bg-white rounded">
                  <span className="text-lg">{severityConfig[event.severity as keyof typeof severityConfig]}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.eventType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-600">{event.description}</p>
                    {event.affectedChains && (
                      <p className="text-xs text-gray-500 mt-1">Chains: {event.affectedChains}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function PredictiveAnalyticsPanel() {
  const predictionsQuery = trpc.analytics.getPredictions.useQuery();
  const generateMutation = trpc.analytics.generatePredictions.useMutation();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      predictionsQuery.refetch();
    } catch (error) {
      console.error("Failed to generate predictions:", error);
    }
  };

  if (predictionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const predictions = (predictionsQuery.data || []).map((p: any) => ({
    ...p,
    prediction: typeof p.prediction === 'string' ? JSON.parse(p.prediction) : p.prediction,
  }));

  const trendEmoji = {
    bullish: "📈",
    bearish: "📉",
    neutral: "➡️",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Market Trend Forecasting</h2>
        <Button onClick={handleGenerate} disabled={generateMutation.isPending} size="sm">
          {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Generate Predictions
        </Button>
      </div>

      {predictions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Zap className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No predictions available. Generate new ones to see market forecasts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {predictions.map((pred: any) => {
            const predData = pred.prediction;
            return (
              <Card key={pred.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{pred.asset}</h3>
                      <span className="text-3xl">{trendEmoji[predData.trend as keyof typeof trendEmoji]}</span>
                    </div>

                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm font-medium capitalize mb-1">{predData.trend} Trend</p>
                      <p className="text-xs text-gray-600">{predData.reasoning}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${predData.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold">{predData.confidence}%</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">Timeframe: {pred.timeframe}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
