import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CreateProposalForm = {
  title: string;
  description: string;
  proposalType: "strategy_parameter" | "configuration_change" | "emergency_action" | "other";
  votingDeadlineHours: number;
  parameters?: string;
};

const statusConfig = {
  draft: { color: "bg-gray-100 text-gray-800", icon: "📝", label: "Draft" },
  active: { color: "bg-blue-100 text-blue-800", icon: "🔵", label: "Active Voting" },
  passed: { color: "bg-green-100 text-green-800", icon: "✅", label: "Passed" },
  rejected: { color: "bg-red-100 text-red-800", icon: "❌", label: "Rejected" },
  executed: { color: "bg-purple-100 text-purple-800", icon: "⚡", label: "Executed" },
};

const typeConfig = {
  strategy_parameter: "Strategy Parameter",
  configuration_change: "Configuration Change",
  emergency_action: "Emergency Action",
  other: "Other",
};

export function ProposalCard({ proposal, onRefresh }: { proposal: any; onRefresh: () => void }) {
  const [isVoting, setIsVoting] = useState(false);
  const castVoteMutation = trpc.governance.castVote.useMutation();

  const handleVote = async (choice: "for" | "against" | "abstain") => {
    setIsVoting(true);
    try {
      await castVoteMutation.mutateAsync({
        proposalId: proposal.id,
        choice,
      });
      onRefresh();
    } catch (error) {
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const config = statusConfig[proposal.status as keyof typeof statusConfig];
  const votingPercentage = proposal.votes?.total
    ? Math.round((proposal.votes.for / proposal.votes.total) * 100)
    : 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={config.color}>{config.label}</Badge>
              <Badge variant="outline">{typeConfig[proposal.proposalType as keyof typeof typeConfig]}</Badge>
            </div>
            <CardTitle className="text-lg">{proposal.title}</CardTitle>
            <CardDescription className="mt-2">{proposal.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal.votes && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Voting Results</span>
              <span className="text-gray-600">{proposal.votes.total} votes</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm w-16">For</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${votingPercentage}%` }} />
                </div>
                <span className="text-sm font-medium w-12 text-right">{proposal.votes.for}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm w-16">Against</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${proposal.votes.total ? Math.round((proposal.votes.against / proposal.votes.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{proposal.votes.against}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm w-16">Abstain</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-400 h-2 rounded-full"
                    style={{
                      width: `${proposal.votes.total ? Math.round((proposal.votes.abstain / proposal.votes.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{proposal.votes.abstain}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Deadline: {formatDistanceToNow(new Date(proposal.votingDeadline), { addSuffix: true })}</span>
        </div>

        {proposal.status === "active" && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => handleVote("for")}
              disabled={isVoting}
              className="flex-1"
            >
              {isVoting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Vote For
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleVote("against")}
              disabled={isVoting}
              className="flex-1"
            >
              {isVoting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Vote Against
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleVote("abstain")}
              disabled={isVoting}
              className="flex-1"
            >
              Abstain
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CreateProposalDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const createMutation = trpc.governance.createProposal.useMutation();

  const form = useForm<CreateProposalForm>({
    defaultValues: {
      title: "",
      description: "",
      proposalType: "strategy_parameter",
      votingDeadlineHours: 48,
      parameters: "",
    },
  });

  const onSubmit = async (data: CreateProposalForm) => {
    try {
      if (!data.title || !data.description) {
        alert("Please fill in all required fields");
        return;
      }
      await createMutation.mutateAsync(data);
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to create proposal:", error);
      alert("Failed to create proposal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Governance Proposal</DialogTitle>
          <DialogDescription>Submit a proposal for agent strategy parameters or configuration changes.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Increase Risk Tolerance to 0.8" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proposalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="strategy_parameter">Strategy Parameter</SelectItem>
                      <SelectItem value="configuration_change">Configuration Change</SelectItem>
                      <SelectItem value="emergency_action">Emergency Action</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detailed explanation of the proposal..." rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parameters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parameters (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='{"riskTolerance": 0.8, "maxDrawdown": 0.25}'
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Optional JSON object with parameter changes</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="votingDeadlineHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voting Deadline (hours)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="48" {...field} />
                  </FormControl>
                  <FormDescription>How long voting should remain open</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Proposal
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function GovernanceDashboard() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const proposalsQuery = trpc.governance.listProposals.useQuery({
    status: statusFilter as any,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governance Dashboard</h1>
          <p className="text-gray-600 mt-1">Create and vote on proposals for AgentV3 parameter changes</p>
        </div>
        <CreateProposalDialog onSuccess={() => proposalsQuery.refetch()} />
      </div>

      <div className="flex gap-2">
        <Button
          variant={statusFilter === undefined ? "default" : "outline"}
          onClick={() => setStatusFilter(undefined)}
        >
          All Proposals
        </Button>
        <Button
          variant={statusFilter === "active" ? "default" : "outline"}
          onClick={() => setStatusFilter("active")}
        >
          Active Voting
        </Button>
        <Button
          variant={statusFilter === "passed" ? "default" : "outline"}
          onClick={() => setStatusFilter("passed")}
        >
          Passed
        </Button>
        <Button
          variant={statusFilter === "executed" ? "default" : "outline"}
          onClick={() => setStatusFilter("executed")}
        >
          Executed
        </Button>
      </div>

      {proposalsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : proposalsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No proposals found. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proposalsQuery.data?.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onRefresh={() => proposalsQuery.refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
