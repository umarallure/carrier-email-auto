import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Mail, Users, Activity } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: React.ReactNode;
}

const MetricCard = ({ title, value, description, trend, trendValue, icon }: MetricCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          {trend && trendValue && (
            <>
              {trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={trend === "up" ? "text-green-500" : "text-red-500"}>
                {trendValue}
              </span>
            </>
          )}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  );
};

interface DashboardMetricsProps {
  totalEmails: number;
  newEmails: number;
  activeAccounts: number;
  processingRate: number;
}

interface DashboardMetricsProps {
  totalEmails: number;
  newEmails: number;
  activeAccounts: number;
  processingRate: number;
}

export const DashboardMetrics = ({ totalEmails, newEmails, activeAccounts, processingRate }: DashboardMetricsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Emails"
        value={totalEmails.toLocaleString()}
        description="Down 20% this period"
        trend="down"
        trendValue="-20%"
        icon={<Mail className="h-4 w-4" />}
      />
      <MetricCard
        title="New Customers"
        value={newEmails.toLocaleString()}
        description="Acquisition rate retention"
        trend="up"
        trendValue="+20%"
        icon={<Users className="h-4 w-4" />}
      />
      <MetricCard
        title="Active Accounts"
        value={activeAccounts.toLocaleString()}
        description="Engagement record targets"
        trend="up"
        trendValue="+19.3%"
        icon={<Activity className="h-4 w-4" />}
      />
      <MetricCard
        title="Processing Rate"
        value={`${processingRate}%`}
        description="Steady performance increase"
        trend="up"
        trendValue="+4.3%"
        icon={<TrendingUp className="h-4 w-4" />}
      />
    </div>
  );
};
