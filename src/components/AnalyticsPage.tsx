import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, TrendingUp, Mail, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface EmailStats {
  total_emails: number;
  processed_emails: number;
  unprocessed_emails: number;
  failed_emails: number;
  carriers: { [key: string]: number };
  categories: { [key: string]: number };
  daily_counts: { date: string; count: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmailStats>({
    total_emails: 0,
    processed_emails: 0,
    unprocessed_emails: 0,
    failed_emails: 0,
    carriers: {},
    categories: {},
    daily_counts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch email counts
      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('id, status, carrier_label, received_date')
        .eq('user_id', user?.id);

      if (emailsError) throw emailsError;

      // Fetch analysis results
      const { data: analysis, error: analysisError } = await supabase
        .from('email_analysis_results')
        .select('category, email_id')
        .in('email_id', emails?.map(e => e.id) || []);

      if (analysisError) throw analysisError;

      // Process statistics
      const totalEmails = emails?.length || 0;
      const processedEmails = emails?.filter(e => e.status === 'completed').length || 0;
      const unprocessedEmails = emails?.filter(e => e.status === 'unprocessed').length || 0;
      const failedEmails = emails?.filter(e => e.status === 'failed').length || 0;

      // Carrier distribution
      const carriers: { [key: string]: number } = {};
      emails?.forEach(email => {
        carriers[email.carrier_label] = (carriers[email.carrier_label] || 0) + 1;
      });

      // Category distribution
      const categories: { [key: string]: number } = {};
      analysis?.forEach(result => {
        if (result.category) {
          categories[result.category] = (categories[result.category] || 0) + 1;
        }
      });

      // Daily counts (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const dailyCounts = last7Days.map(date => {
        const count = emails?.filter(email => 
          email.received_date.startsWith(date)
        ).length || 0;
        return { date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count };
      });

      setStats({
        total_emails: totalEmails,
        processed_emails: processedEmails,
        unprocessed_emails: unprocessedEmails,
        failed_emails: failedEmails,
        carriers,
        categories,
        daily_counts: dailyCounts
      });

    } catch (error: any) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const carrierChartData = Object.entries(stats.carriers).map(([name, value]) => ({ name, value }));
  const categoryChartData = Object.entries(stats.categories).map(([name, value]) => ({ name, value }));

  const processingRate = stats.total_emails > 0 ? Math.round((stats.processed_emails / stats.total_emails) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Monitor email processing performance and insights
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_emails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time email count
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingRate}%</div>
            <p className="text-xs text-muted-foreground">
              Successfully processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unprocessed_emails}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed_emails}</div>
            <p className="text-xs text-muted-foreground">
              Processing errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Email Volume</CardTitle>
            <CardDescription>
              Email volume over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.daily_counts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs fill-muted-foreground"
                />
                <YAxis className="text-xs fill-muted-foreground" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Carrier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Carrier Distribution</CardTitle>
            <CardDescription>
              Email volume by carrier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={carrierChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {carrierChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Category Analysis</CardTitle>
          <CardDescription>
            Email categorization breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-xs fill-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Carrier Details */}
        <Card>
          <CardHeader>
            <CardTitle>Carrier Breakdown</CardTitle>
            <CardDescription>
              Detailed carrier statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.carriers).map(([carrier, count]) => (
                <div key={carrier} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{carrier}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{count} emails</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.total_emails > 0 ? Math.round((count / stats.total_emails) * 100) : 0}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Details */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>
              Detailed category statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.categories).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      category === "Failed payment" ? "destructive" :
                      category === "Cancelled policy" ? "destructive" :
                      category === "Pending" ? "secondary" : "default"
                    }>
                      {category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{count} emails</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.processed_emails > 0 ? Math.round((count / stats.processed_emails) * 100) : 0}% of processed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
