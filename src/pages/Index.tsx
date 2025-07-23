import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/components/auth/AuthPage";
import Dashboard from "./Dashboard";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Checking authentication status</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthPage />;
};

export default Index;
