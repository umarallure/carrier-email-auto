/**
 * GTL Scraper Wizard Component
 * 
 * Step-by-step interface for team members to:
 * 1. Start browser session
 * 2. Manually login to GTL portal
 * 3. Confirm ready
 * 4. Start automated scraping
 * 5. Download results
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Download, 
  RefreshCw,
  ExternalLink,
  PlayCircle,
  StopCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ScraperSession {
  id: string;
  job_id: string;
  status: 'initializing' | 'waiting_for_login' | 'ready' | 'scraping' | 'completed' | 'failed';
  browser_url?: string;
  current_page?: number;
  total_pages?: number;
  scraped_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export default function GTLScraperWizard() {
  const { user, session: authSession } = useAuth();
  const [jobName, setJobName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [session, setSession] = useState<ScraperSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [steps, setSteps] = useState<WizardStep[]>([
    { id: 1, title: 'Start Browser Session', description: 'Initialize GoLogin browser', status: 'active' },
    { id: 2, title: 'Manual Login', description: 'Login to GTL portal manually', status: 'pending' },
    { id: 3, title: 'Confirm Ready', description: 'Confirm you are logged in', status: 'pending' },
    { id: 4, title: 'Start Scraping', description: 'Automated data extraction', status: 'pending' },
    { id: 5, title: 'Download Results', description: 'Export scraped data', status: 'pending' },
  ]);

  // Poll session status
  useEffect(() => {
    if (!sessionId) return;

    const pollStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('gtl_scraper_sessions' as any)
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) throw error;
        if (data) {
          setSession(data);
          // Update steps based on session status
          updateStepsFromSession(data);
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [sessionId]);

  const updateStepsFromSession = (sess: ScraperSession) => {
    const newSteps = [...steps];

    switch (sess.status) {
      case 'initializing':
        newSteps[0].status = 'active';
        break;
      case 'waiting_for_login':
        newSteps[0].status = 'completed';
        newSteps[1].status = 'active';
        setCurrentStep(1);
        break;
      case 'ready':
        newSteps[0].status = 'completed';
        newSteps[1].status = 'completed';
        newSteps[2].status = 'completed';
        newSteps[3].status = 'active';
        setCurrentStep(3);
        break;
      case 'scraping':
        newSteps[0].status = 'completed';
        newSteps[1].status = 'completed';
        newSteps[2].status = 'completed';
        newSteps[3].status = 'active';
        setCurrentStep(3);
        break;
      case 'completed':
        newSteps.forEach((step, idx) => {
          if (idx < 4) step.status = 'completed';
        });
        newSteps[4].status = 'active';
        setCurrentStep(4);
        break;
      case 'failed':
        newSteps[currentStep].status = 'error';
        break;
    }

    setSteps(newSteps);
  };

  // Step 1: Start browser session
  const startSession = async () => {
    if (!jobName.trim()) {
      setError('Please enter a job name');
      return;
    }

    if (!user) {
      setError('You must be logged in to start a session');
      return;
    }

    if (!authSession?.access_token) {
      setError('Authentication session expired. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gtl-scraper-session/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            job_name: jobName,
            user_email: user?.email,
          }),
        }
      );

      // Get response text first to check if it's empty
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to start session';
        try {
          const errorData = responseText ? JSON.parse(responseText) : {};
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Parse the successful response
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(responseText);
      
      if (!data.session_id || !data.job_id) {
        throw new Error('Invalid response: missing session_id or job_id');
      }

      setSessionId(data.session_id);
      setJobId(data.job_id);
      
      // Move to step 2
      const newSteps = [...steps];
      newSteps[0].status = 'completed';
      newSteps[1].status = 'active';
      setSteps(newSteps);
      setCurrentStep(1);

    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      const newSteps = [...steps];
      newSteps[0].status = 'error';
      setSteps(newSteps);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Confirm ready
  const confirmReady = async () => {
    if (!sessionId) return;

    if (!authSession?.access_token) {
      setError('Authentication session expired. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gtl-scraper-session/confirm-ready`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );

      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to confirm ready';
        try {
          const errorData = responseText ? JSON.parse(responseText) : {};
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Move to step 4
      const newSteps = [...steps];
      newSteps[2].status = 'completed';
      newSteps[3].status = 'active';
      setSteps(newSteps);
      setCurrentStep(3);

    } catch (err) {
      console.error('Error confirming ready:', err);
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Start scraping
  const startScraping = async () => {
    if (!sessionId) return;

    if (!authSession?.access_token) {
      setError('Authentication session expired. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gtl-scraper-session/scrape`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );

      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to start scraping';
        try {
          const errorData = responseText ? JSON.parse(responseText) : {};
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

    } catch (err) {
      console.error('Error starting scraping:', err);
      setError(err instanceof Error ? err.message : 'Failed to start scraping');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Download CSV
  const downloadCSV = async () => {
    if (!jobId) return;

    try {
      const { data: policies, error } = await supabase
        .from('gtl_scraped_policies' as any)
        .select('*')
        .eq('job_id', jobId);

      if (error) throw error;

      if (!policies || policies.length === 0) {
        setError('No policies found to export');
        return;
      }

      // Convert to CSV
      const headers = Object.keys(policies[0]);
      const csvContent = [
        headers.join(','),
        ...policies.map((p: any) =>
          headers.map(h => {
            const value = p[h];
            if (value === null || value === undefined) return '';
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        ),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtl-policies-${jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to download');
    }
  };

  // Stop session
  const stopSession = async () => {
    if (!sessionId) return;

    if (!authSession?.access_token) {
      console.error('No auth session available');
      return;
    }

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gtl-scraper-session/stop/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authSession.access_token}`,
          },
        }
      );

      // Reset
      setSessionId(null);
      setJobId(null);
      setSession(null);
      setCurrentStep(0);
      setSteps([
        { id: 1, title: 'Start Browser Session', description: 'Initialize GoLogin browser', status: 'active' },
        { id: 2, title: 'Manual Login', description: 'Login to GTL portal manually', status: 'pending' },
        { id: 3, title: 'Confirm Ready', description: 'Confirm you are logged in', status: 'pending' },
        { id: 4, title: 'Start Scraping', description: 'Automated data extraction', status: 'pending' },
        { id: 5, title: 'Download Results', description: 'Export scraped data', status: 'pending' },
      ]);
    } catch (err) {
      console.error('Error stopping session:', err);
    }
  };

  // Complete job
  const completeJob = async () => {
    if (!sessionId || !jobId) return;

    if (!authSession?.access_token) {
      console.error('No auth session available');
      return;
    }

    try {
      // Update session status to completed
      const { error: sessionError } = await supabase
        .from('gtl_scraper_sessions' as any)
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Update job status to completed
      const { error: jobError } = await supabase
        .from('scraper_jobs' as any)
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobError) throw jobError;

      // Reset UI state
      setSessionId(null);
      setJobId(null);
      setSession(null);
      setCurrentStep(0);
      setSteps([
        { id: 1, title: 'Start Browser Session', description: 'Initialize GoLogin browser', status: 'active' },
        { id: 2, title: 'Manual Login', description: 'Login to GTL portal manually', status: 'pending' },
        { id: 3, title: 'Confirm Ready', description: 'Confirm you are logged in', status: 'pending' },
        { id: 4, title: 'Start Scraping', description: 'Automated data extraction', status: 'pending' },
        { id: 5, title: 'Download Results', description: 'Export scraped data', status: 'pending' },
      ]);

    } catch (err) {
      console.error('Error completing job:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete job');
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'active':
        return <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Circle className="h-6 w-6 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-2xl">GTL Portal Scraper</CardTitle>
          <CardDescription className="text-slate-400">
            Follow the steps below to scrape policy data from GTL portal
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Steps */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {getStepIcon(step.status)}
                  {idx < steps.length - 1 && (
                    <div className="w-0.5 h-12 bg-slate-600 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <h3 className="font-semibold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-400">{step.description}</p>
                  
                  {/* Step 1: Start Session */}
                  {step.id === 1 && step.status === 'active' && !sessionId && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="jobName" className="text-white">Job Name</Label>
                        <Input
                          id="jobName"
                          placeholder="e.g., Weekly GTL Sync - Oct 17"
                          value={jobName}
                          onChange={(e) => setJobName(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <Button
                        onClick={startSession}
                        disabled={loading || !jobName.trim()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? 'Starting...' : 'Start Session'}
                      </Button>
                    </div>
                  )}

                  {/* Step 2: Manual Login */}
                  {step.id === 2 && step.status === 'active' && (
                    <div className="mt-4 space-y-4">
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription className="text-blue-800">
                          <strong>Instructions:</strong>
                          <ol className="list-decimal ml-4 mt-2 space-y-1">
                            <li><strong>Start Worker:</strong> Make sure the scraper worker is running: <code className="bg-blue-100 px-1 rounded">node scripts/gtl-scraper-worker.js</code></li>
                            <li><strong>Click "I'm Ready":</strong> The worker will automatically start the GoLogin browser and navigate to GTL</li>
                            <li><strong>Login if Needed:</strong> If a login page appears, enter your GTL credentials</li>
                            <li><strong>Wait for Data:</strong> Wait for the page to fully load with policy data</li>
                            <li><strong>Monitor Progress:</strong> The scraper will automatically extract all policies</li>
                          </ol>
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <strong>Important:</strong> The GoLogin browser will open automatically when you click "I'm Ready". Do not close it while scraping is in progress.
                          </div>
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                            <strong>Worker Status:</strong> Make sure the GTL scraper worker is running in a terminal: <code className="bg-blue-100 px-1 rounded">node scripts/gtl-scraper-worker.js</code>
                          </div>
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={confirmReady}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          I'm Ready
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.open('https://gtlink.gtlic.com/MyBusiness', '_blank')}
                          className="text-white border-slate-600"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open GTL Portal
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.open('https://app.gologin.com/', '_blank')}
                          className="text-white border-slate-600"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open GoLogin App
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Scraping */}
                  {step.id === 4 && step.status === 'active' && (
                    <div className="mt-4 space-y-4">
                      {session?.status === 'ready' && (
                        <Button
                          onClick={startScraping}
                          disabled={loading}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start Scraping
                        </Button>
                      )}
                      
                      {session?.status === 'scraping' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-slate-300">
                            <span>
                              Page {session.current_page || 0} of {session.total_pages || 19}
                            </span>
                            <span>{session.scraped_count || 0} policies scraped</span>
                          </div>
                          <Progress
                            value={((session.current_page || 0) / (session.total_pages || 19)) * 100}
                            className="h-2 bg-slate-600"
                          />
                          <Alert className="bg-yellow-50 border-yellow-200 mt-4">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800">
                              Scraping in progress... This may take 2-3 minutes for all 19 pages.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 5: Download */}
                  {step.id === 5 && step.status === 'active' && session?.status === 'completed' && (
                    <div className="mt-4 space-y-4">
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          ✓ Scraping completed! {session.scraped_count} policies extracted.
                        </AlertDescription>
                      </Alert>
                      <Button
                        onClick={downloadCSV}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV File
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Controls */}
      {sessionId && session?.status !== 'completed' && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-400">Session ID: {sessionId}</p>
                <p className="text-sm text-slate-400">Status: {session?.status || 'Unknown'}</p>
              </div>
              <div className="flex gap-2">
                {(session?.status === 'ready' || session?.status === 'scraping' || session?.status === 'completed') && (
                  <Button
                    onClick={completeJob}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Job
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={stopSession}
                  className="text-red-400 border-red-600 hover:bg-red-900"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancel Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
