import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const documentsData = [
  {
    id: 1,
    header: "AIG Failed Payment",
    sectionType: "Email Processing",
    status: "In Progress",
    target: 15,
    limit: 5,
    reviewer: "AI Assistant"
  },
  {
    id: 2,
    header: "RNA Policy Renewal",
    sectionType: "Automated Response",
    status: "Done",
    target: 25,
    limit: 24,
    reviewer: "AI Assistant"
  },
  {
    id: 3,
    header: "ANAM Underwriting",
    sectionType: "Manual Review",
    status: "Done",
    target: 10,
    limit: 13,
    reviewer: "Eddie Lake"
  },
  {
    id: 4,
    header: "Liberty Documentation",
    sectionType: "Pending Action",
    status: "Done",
    target: 27,
    limit: 23,
    reviewer: "System Auto"
  },
  {
    id: 5,
    header: "Carrier Notification",
    sectionType: "Email Template",
    status: "In Progress",
    target: 2,
    limit: 16,
    reviewer: "AI Assistant"
  },
  {
    id: 6,
    header: "Policy Analysis",
    sectionType: "Data Extraction",
    status: "In Progress",
    target: 20,
    limit: 8,
    reviewer: "System Auto"
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Done":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Done</Badge>;
    case "In Progress":
      return <Badge variant="secondary">In Progress</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export const DashboardTable = () => {
  return (
    <div className="grid gap-4">
      <Tabs defaultValue="outline" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="outline">Processing</TabsTrigger>
            <TabsTrigger value="past-performance">Analytics</TabsTrigger>
            <TabsTrigger value="key-personnel">Carriers</TabsTrigger>
            <TabsTrigger value="focus-documents">Policies</TabsTrigger>
          </TabsList>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Customize Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Header</DropdownMenuItem>
                <DropdownMenuItem>Section Type</DropdownMenuItem>
                <DropdownMenuItem>Status</DropdownMenuItem>
                <DropdownMenuItem>Target</DropdownMenuItem>
                <DropdownMenuItem>Limit</DropdownMenuItem>
                <DropdownMenuItem>Reviewer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
        </div>
        
        <TabsContent value="outline">
          <Card>
            <CardHeader>
              <CardTitle>Email Processing Queue</CardTitle>
              <CardDescription>
                Monitor and manage carrier email processing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Header</TableHead>
                    <TableHead>Section Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.header}</TableCell>
                      <TableCell>{item.sectionType}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.target}</TableCell>
                      <TableCell>{item.limit}</TableCell>
                      <TableCell>{item.reviewer}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit section</DropdownMenuItem>
                            <DropdownMenuItem>Change reviewer</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              Delete section
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <div>0 of 68 row(s) selected.</div>
                <div className="flex items-center space-x-6">
                  <div>Rows per page: 10</div>
                  <div>Page 1 of 7</div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="past-performance">
          <Card>
            <CardHeader>
              <CardTitle>Past Performance</CardTitle>
              <CardDescription>Review historical performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Past performance content will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="key-personnel">
          <Card>
            <CardHeader>
              <CardTitle>Key Personnel</CardTitle>
              <CardDescription>Manage key team members and assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Key personnel content will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="focus-documents">
          <Card>
            <CardHeader>
              <CardTitle>Focus Documents</CardTitle>
              <CardDescription>Priority documents requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Focus documents content will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
