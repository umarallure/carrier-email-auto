import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { DashboardChart } from "@/components/DashboardChart";
import { DashboardTable } from "@/components/DashboardTable";
import { InboxPage } from "@/components/InboxPage";
import { FolderEmailPage } from "@/components/FolderEmailPage";
import { EmailActionsPage } from "@/components/EmailActionsPage";
import { GmailSetupPage } from "@/components/GmailSetupPage";
import { AnalyticsPage } from "@/components/AnalyticsPage";
import { TestingPage } from "@/components/TestingPage";
import ScraperPage from "@/components/ScraperPage";

const ModernDashboard = () => {
  const [currentPage, setCurrentPage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                  Welcome to your insurance carrier email automation portal
                </p>
              </div>
            </div>
            
            {/* Metrics Cards */}
            <DashboardMetrics 
              totalEmails={1250}
              newEmails={234}
              activeAccounts={45678}
              processingRate={4.5}
            />
            
            {/* Chart and Activity */}
            <DashboardChart />
            
            {/* Table */}
            <DashboardTable />
          </div>
        );
      case "inbox":
        return <InboxPage />;
      case "folders":
        return <FolderEmailPage />;
      case "actions":
        return <EmailActionsPage />;
      case "gmail-setup":
        return <GmailSetupPage />;
      case "scraper":
        return <ScraperPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "testing":
        return <TestingPage />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Page not found</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar 
          className="hidden lg:block border-r" 
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        
        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-0' : ''}`}>
          <div className="container mx-auto py-6 px-4">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernDashboard;
