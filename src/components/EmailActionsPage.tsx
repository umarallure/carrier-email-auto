import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Textarea,
} from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  FileText,
  Calendar,
  Tag,
  Edit,
  Save,
  X,
} from 'lucide-react';

interface EmailAction {
  id: string;
  email_id: string;
  analysis_id: string;
  customer_name: string;
  policy_id: string | null;
  email_subject: string;
  email_received_date: string;
  carrier: string;
  carrier_label: string;
  email_update_date: string | null;
  summary: string | null;
  suggested_action: string | null;
  category: string | null;
  subcategory: string | null;
  action_code: string | null;
  ghl_note: string | null;
  ghl_stage_change: string | null;
  action_status: string | null;
  priority: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_processed: boolean | null;
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
  external_reference: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export const EmailActionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [actions, setActions] = useState<EmailAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<EmailAction | null>(null);
  const [editingAction, setEditingAction] = useState<EmailAction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActions, setTotalActions] = useState(0);
  
  const ACTIONS_PER_PAGE = 50;

  useEffect(() => {
    if (user) {
      fetchActions();
    }
  }, [user, currentPage, searchQuery, statusFilter, priorityFilter, carrierFilter]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('email_actions')
        .select(`
          *,
          emails!inner(user_id)
        `, { count: 'exact' })
        .eq('emails.user_id', user?.id);

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('action_status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (carrierFilter !== 'all') {
        query = query.eq('carrier', carrierFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,policy_id.ilike.%${searchQuery}%,email_subject.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * ACTIONS_PER_PAGE;
      const to = from + ACTIONS_PER_PAGE - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setActions(data || []);
      setTotalActions(count || 0);
      
    } catch (error: any) {
      toast({
        title: 'Error fetching actions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAction = async (actionId: string, updates: Partial<EmailAction>) => {
    try {
      const { error } = await supabase
        .from('email_actions')
        .update(updates)
        .eq('id', actionId);

      if (error) throw error;

      toast({
        title: 'Action Updated',
        description: 'The action has been successfully updated.',
      });

      fetchActions();
      setEditingAction(null);
      
    } catch (error: any) {
      toast({
        title: 'Error updating action',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'on_hold': return 'outline';
      case 'pending':
      default: return 'secondary';
    }
  };

  const getPriorityBadgeVariant = (priority: string | null) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'on_hold': return <AlertCircle className="h-4 w-4" />;
      case 'pending':
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const totalPages = Math.ceil(totalActions / ACTIONS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Actions</h1>
          <p className="text-muted-foreground">
            Manage customer action items from analyzed emails
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="text-sm">
            {totalActions} total actions
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, policy ID, subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={(value) => {
              setPriorityFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Carrier Filter */}
            <Select value={carrierFilter} onValueChange={(value) => {
              setCarrierFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                <SelectItem value="AETNA">Aetna</SelectItem>
                <SelectItem value="ANAM">ANAM</SelectItem>
                <SelectItem value="COREBRIDGE">Corebridge</SelectItem>
                <SelectItem value="SBLI">SBLI</SelectItem>
                <SelectItem value="MUTUAL OF OMAHA">Mutual of Omaha</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || carrierFilter !== 'all') && (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCarrierFilter('all');
                  setCurrentPage(1);
                }}
                variant="ghost"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
          <CardDescription>
            Customer action items generated from email analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading actions...</p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Policy ID</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Action Code</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(action.action_status)}
                          <Badge variant={getStatusBadgeVariant(action.action_status)}>
                            {action.action_status || 'pending'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {action.customer_name}
                      </TableCell>
                      <TableCell>
                        {action.policy_id || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{action.carrier}</Badge>
                      </TableCell>
                      <TableCell>
                        {action.category || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityBadgeVariant(action.priority)}>
                          {action.priority || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {action.action_code || '-'}
                      </TableCell>
                      <TableCell>
                        {action.due_date ? new Date(action.due_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedAction(action)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Action Details</DialogTitle>
                                <DialogDescription>
                                  {action.customer_name} - {action.email_subject}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedAction && (
                                <Tabs defaultValue="details" className="w-full">
                                  <TabsList>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="email">Email Info</TabsTrigger>
                                    <TabsTrigger value="ghl">GHL Integration</TabsTrigger>
                                  </TabsList>
                                  
                                  <TabsContent value="details" className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Customer Name</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.customer_name}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Policy ID</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.policy_id || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Status</label>
                                        <Badge variant={getStatusBadgeVariant(selectedAction.action_status)}>
                                          {selectedAction.action_status || 'pending'}
                                        </Badge>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Priority</label>
                                        <Badge variant={getPriorityBadgeVariant(selectedAction.priority)}>
                                          {selectedAction.priority || 'medium'}
                                        </Badge>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Action Code</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.action_code || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Due Date</label>
                                        <p className="text-sm text-muted-foreground">
                                          {selectedAction.due_date ? new Date(selectedAction.due_date).toLocaleDateString() : 'N/A'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {selectedAction.summary && (
                                      <div>
                                        <label className="text-sm font-medium">Summary</label>
                                        <p className="text-sm text-muted-foreground mt-1">{selectedAction.summary}</p>
                                      </div>
                                    )}
                                    
                                    {selectedAction.suggested_action && (
                                      <div>
                                        <label className="text-sm font-medium">Suggested Action</label>
                                        <p className="text-sm text-muted-foreground mt-1">{selectedAction.suggested_action}</p>
                                      </div>
                                    )}
                                    
                                    {selectedAction.notes && (
                                      <div>
                                        <label className="text-sm font-medium">Notes</label>
                                        <p className="text-sm text-muted-foreground mt-1">{selectedAction.notes}</p>
                                      </div>
                                    )}
                                  </TabsContent>
                                  
                                  <TabsContent value="email" className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Subject</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.email_subject}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Received Date</label>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(selectedAction.email_received_date).toLocaleString()}
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Carrier</label>
                                        <Badge variant="outline">{selectedAction.carrier}</Badge>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Category</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.category || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Subcategory</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.subcategory || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </TabsContent>
                                  
                                  <TabsContent value="ghl" className="space-y-4">
                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-sm font-medium">GHL Note</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.ghl_note || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">GHL Stage Change</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.ghl_stage_change || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">External Reference</label>
                                        <p className="text-sm text-muted-foreground">{selectedAction.external_reference || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingAction(action)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * ACTIONS_PER_PAGE + 1, totalActions)} - {Math.min(currentPage * ACTIONS_PER_PAGE, totalActions)} of {totalActions} actions
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingAction && (
        <Dialog open={!!editingAction} onOpenChange={() => setEditingAction(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Action</DialogTitle>
              <DialogDescription>
                Update the action details and status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editingAction.action_status || 'pending'}
                    onValueChange={(value) => setEditingAction({...editingAction, action_status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={editingAction.priority || 'medium'}
                    onValueChange={(value) => setEditingAction({...editingAction, priority: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Action Code</label>
                <Input
                  value={editingAction.action_code || ''}
                  onChange={(e) => setEditingAction({...editingAction, action_code: e.target.value})}
                  placeholder="Enter action code"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">GHL Note</label>
                <Textarea
                  value={editingAction.ghl_note || ''}
                  onChange={(e) => setEditingAction({...editingAction, ghl_note: e.target.value})}
                  placeholder="Enter GHL note"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">GHL Stage Change</label>
                <Input
                  value={editingAction.ghl_stage_change || ''}
                  onChange={(e) => setEditingAction({...editingAction, ghl_stage_change: e.target.value})}
                  placeholder="Enter GHL stage change"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={editingAction.notes || ''}
                  onChange={(e) => setEditingAction({...editingAction, notes: e.target.value})}
                  placeholder="Enter additional notes"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingAction(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updateAction(editingAction.id, editingAction)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};