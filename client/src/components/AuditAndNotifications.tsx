import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const eventTypeConfig: Record<string, any> = {
  proposal_created: { icon: "📝", label: "Proposal Created", color: "bg-blue-100 text-blue-800" },
  proposal_activated: { icon: "🔵", label: "Proposal Activated", color: "bg-blue-100 text-blue-800" },
  vote_cast: { icon: "🗳️", label: "Vote Cast", color: "bg-purple-100 text-purple-800" },
  proposal_executed: { icon: "⚡", label: "Proposal Executed", color: "bg-green-100 text-green-800" },
  parameter_changed: { icon: "⚙️", label: "Parameter Changed", color: "bg-gray-100 text-gray-800" },
  emergency_triggered: { icon: "🚨", label: "Emergency Triggered", color: "bg-red-100 text-red-800" },
};

const notificationTypeConfig: Record<string, any> = {
  risk_alert: { icon: "⚠️", label: "Risk Alert" },
  governance_update: { icon: "📢", label: "Governance Update" },
  emergency_action: { icon: "🚨", label: "Emergency Action" },
  performance_milestone: { icon: "🎯", label: "Performance Milestone" },
};

export function AuditLog() {
  const auditQuery = trpc.audit.getAuditLog.useQuery({
    limit: 50,
    offset: 0,
  });

  if (auditQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const auditLog = auditQuery.data || [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Governance Audit Log</h2>
      <p className="text-gray-600">Timestamped, immutable record of all governance events and parameter changes</p>

      {auditLog.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No audit events recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {auditLog.map((entry: any) => {
            const config = eventTypeConfig[entry.eventType] || {
              icon: "📋",
              label: entry.eventType,
              color: "bg-gray-100 text-gray-800",
            };
            const details = entry.details ? JSON.parse(entry.details) : {};

            return (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{config.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>{config.label}</Badge>
                        {entry.proposalId && (
                          <Badge variant="outline">Proposal #{entry.proposalId}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                      {Object.keys(details).length > 0 && (
                        <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-2 rounded">
                          {Object.entries(details).map(([key, value]: [string, any]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

export function NotificationCenter() {
  const notificationsQuery = trpc.notifications.getNotifications.useQuery({});
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsReadMutation.mutateAsync({ notificationId });
      notificationsQuery.refetch();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  if (notificationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter((n: any) => n.isRead === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notification Center</h2>
        {unreadCount > 0 && (
          <Badge variant="destructive">
            <Bell className="w-3 h-3 mr-1" />
            {unreadCount} Unread
          </Badge>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification: any) => {
            const config = notificationTypeConfig[notification.notificationType] || {
              icon: "📬",
              label: "Notification",
            };

            return (
              <Card
                key={notification.id}
                className={`hover:shadow-md transition-all ${
                  notification.isRead === 0 ? "border-l-4 border-l-blue-500 bg-blue-50" : ""
                }`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{config.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold">{notification.title}</h3>
                        {notification.isRead === 0 && (
                          <Badge variant="default" className="ml-2">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.content}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                        {notification.isRead === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={markAsReadMutation.isPending}
                          >
                            {markAsReadMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            )}
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
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
