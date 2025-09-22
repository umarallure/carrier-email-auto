import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const data = [
  { date: "Apr 2", visitors: 280, mobile: 180 },
  { date: "Apr 8", visitors: 320, mobile: 200 },
  { date: "Apr 14", visitors: 290, mobile: 170 },
  { date: "Apr 20", visitors: 350, mobile: 220 },
  { date: "Apr 26", visitors: 380, mobile: 240 },
  { date: "May 2", visitors: 420, mobile: 260 },
  { date: "May 8", visitors: 390, mobile: 250 },
  { date: "May 14", visitors: 450, mobile: 280 },
  { date: "May 20", visitors: 480, mobile: 300 },
  { date: "May 26", visitors: 520, mobile: 320 },
  { date: "Jun 2", visitors: 490, mobile: 310 },
  { date: "Jun 8", visitors: 530, mobile: 330 },
  { date: "Jun 14", visitors: 560, mobile: 350 },
  { date: "Jun 20", visitors: 590, mobile: 370 },
  { date: "Jun 26", visitors: 620, mobile: 390 },
  { date: "Jul 2", visitors: 580, mobile: 380 },
  { date: "Jul 8", visitors: 610, mobile: 400 },
];

export const DashboardChart = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Total Visitors</CardTitle>
          <CardDescription>
            Total for the last 3 months
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="flex justify-end space-x-4 mb-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Desktop</span>
              <span className="font-medium">390</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
              <span>Mobile</span>
              <span className="font-medium">290</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                className="text-xs fill-muted-foreground"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                className="text-xs fill-muted-foreground"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorVisitors)"
              />
              <Area
                type="monotone"
                dataKey="mobile"
                stroke="#93c5fd"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMobile)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest email processing activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="flex items-center">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">AIG</span>
              </div>
              <div className="ml-4 space-y-1 flex-1">
                <p className="text-sm font-medium leading-none">
                  Policy renewal processed
                </p>
                <p className="text-sm text-muted-foreground">
                  Customer: John Doe - Policy: ABC123456
                </p>
              </div>
              <div className="text-sm text-muted-foreground">2m ago</div>
            </div>
            
            <div className="flex items-center">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold text-sm">RNA</span>
              </div>
              <div className="ml-4 space-y-1 flex-1">
                <p className="text-sm font-medium leading-none">
                  Payment failed - requires attention
                </p>
                <p className="text-sm text-muted-foreground">
                  Customer: Sarah Smith - Policy: XYZ789
                </p>
              </div>
              <div className="text-sm text-muted-foreground">5m ago</div>
            </div>
            
            <div className="flex items-center">
              <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold text-sm">ANAM</span>
              </div>
              <div className="ml-4 space-y-1 flex-1">
                <p className="text-sm font-medium leading-none">
                  Underwriting approved
                </p>
                <p className="text-sm text-muted-foreground">
                  Customer: Mike Johnson - Policy: DEF456
                </p>
              </div>
              <div className="text-sm text-muted-foreground">12m ago</div>
            </div>
            
            <div className="flex items-center">
              <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-semibold text-sm">LIB</span>
              </div>
              <div className="ml-4 space-y-1 flex-1">
                <p className="text-sm font-medium leading-none">
                  Documentation requested
                </p>
                <p className="text-sm text-muted-foreground">
                  Customer: Lisa Brown - Policy: GHI789
                </p>
              </div>
              <div className="text-sm text-muted-foreground">1h ago</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
