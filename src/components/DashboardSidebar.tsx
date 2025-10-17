import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutDashboard, 
  Mail, 
  Users, 
  BarChart3, 
  FolderOpen, 
  Settings,
  HelpCircle,
  Search,
  Plus,
  MoreHorizontal,
  Inbox,
  TestTube,
  ChevronLeft,
  ChevronRight,
  Globe
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage?: string;
  onPageChange?: (page: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const sidebarItems = [
  {
    title: "Home",
    icon: LayoutDashboard,
    page: "home"
  },
  {
    title: "Inbox",
    icon: Inbox,
    page: "inbox"
  },
  {
    title: "Carrier Folders",
    icon: FolderOpen,
    page: "folders"
  },
  {
    title: "Email Actions",
    icon: Users,
    page: "actions"
  },
  {
    title: "Gmail Setup",
    icon: Mail,
    page: "gmail-setup"
  },
  {
    title: "Portal Scraper",
    icon: Globe,
    page: "scraper"
  },
  {
    title: "Analytics",
    icon: BarChart3,
    page: "analytics"
  },
  {
    title: "Testing",
    icon: TestTube,
    page: "testing"
  }
];

const documentsItems = [
  {
    title: "Email Archive",
    icon: FolderOpen,
    href: "/email-archive"
  },
  {
    title: "Processing Reports",
    icon: BarChart3,
    href: "/reports"
  },
  {
    title: "AI Assistant",
    icon: HelpCircle,
    href: "/ai-assistant"
  }
];

export function DashboardSidebar({ className, currentPage, onPageChange, collapsed = false, onCollapsedChange }: SidebarProps) {

  return (
    <div className={cn(
      "pb-12 min-h-screen transition-all duration-300 ease-in-out",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Collapse Toggle Button */}
      <div className="flex justify-end p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Button variant="secondary" className={cn(
              "w-full justify-start transition-all duration-300",
              collapsed ? "px-2" : ""
            )}>
              <Plus className="mr-2 h-4 w-4" />
              {!collapsed && "Quick Create"}
            </Button>
          </div>
        </div>
        
        <div className="px-3 py-2">
          {!collapsed && (
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Navigation
            </h2>
          )}
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.page}
                variant={currentPage === item.page ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-300",
                  collapsed ? "px-2" : ""
                )}
                onClick={() => onPageChange?.(item.page)}
                title={collapsed ? item.title : undefined}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {!collapsed && item.title}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="px-3 py-2">
          {!collapsed && (
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Email Management
            </h2>
          )}
          <div className="space-y-1">
            {documentsItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "w-full justify-start transition-all duration-300",
                  collapsed ? "px-2" : ""
                )}
                title={collapsed ? item.title : undefined}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {!collapsed && item.title}
              </Button>
            ))}
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start transition-all duration-300",
                collapsed ? "px-2" : ""
              )}
              title={collapsed ? "More" : undefined}
            >
              <MoreHorizontal className="mr-2 h-4 w-4" />
              {!collapsed && "More"}
            </Button>
          </div>
        </div>
        
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start transition-all duration-300",
                collapsed ? "px-2" : ""
              )}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="mr-2 h-4 w-4" />
              {!collapsed && "Settings"}
            </Button>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start transition-all duration-300",
                collapsed ? "px-2" : ""
              )}
              title={collapsed ? "Get help" : undefined}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              {!collapsed && "Get help"}
            </Button>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start transition-all duration-300",
                collapsed ? "px-2" : ""
              )}
              title={collapsed ? "Search" : undefined}
            >
              <Search className="mr-2 h-4 w-4" />
              {!collapsed && "Search"}
            </Button>
          </div>
        </div>
        
        {!collapsed && (
          <div className="px-3 py-2">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">CA</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Unlimited Insurance Carrier Updates Portal</p>
                  <p className="text-xs text-muted-foreground">admin@carrier.com</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
