import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Clock, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GTLScraperWizard from './GTLScraperWizard';

interface ScraperJob {
  id: string;
  carrier_name: string;
  job_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_records?: number;
  scraped_records?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface ScrapedPolicy {
  id: string;
  policy_number: string;
  applicant_name?: string;
  plan_name?: string;
  plan_code?: string;
  face_amount?: string;
  premium?: string;
  status?: string;
  updated_date?: string;
  issue_date?: string;
  application_date?: string;
  dob?: string;
  gender?: string;
  age?: string;
  state?: string;
  agent_name?: string;
  agent_number?: string;
  notes?: string;
  created_at: string;
}

export default function ScraperPage() {
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [policies, setPolicies] = useState<ScrapedPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  // Fetch scraper jobs
  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('scraper_jobs' as any)
        .select('*')
        .eq('carrier_name', 'GTL')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setJobs(data as any || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    }
  };

  // Fetch policies for selected job
  const fetchPolicies = async (jobId: string) => {
    try {
      const { data, error} = await supabase
        .from('gtl_scraped_policies' as any)
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setPolicies(data as any || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching policies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    }
  };

  // Download scraped data as CSV
  const downloadCSV = async (jobId: string) => {
    try {
      const response = await fetch(`https://olxlunpsizvfulumdxkl.supabase.co/functions/v1/scraper-api/export/${jobId}?format=csv`);
      if (!response.ok) throw new Error('Failed to download');

      const blob = await response.blob();
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

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchPolicies(selectedJob);
    }
  }, [selectedJob]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getProgressPercent = (job: ScraperJob): number => {
    if (!job.total_records || job.total_records === 0) return 0;
    return Math.round(((job.scraped_records || 0) / job.total_records) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Carrier Web Scraper</h1>
          <p className="text-slate-400">Automate data extraction from insurance carrier portals</p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="wizard" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="wizard" className="text-white">
              New Scraping Job
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-white">
              Job History
            </TabsTrigger>
            <TabsTrigger value="results" className="text-white">
              Results
            </TabsTrigger>
          </TabsList>

          {/* Wizard Tab */}
          <TabsContent value="wizard">
            <GTLScraperWizard />
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Scraping Jobs</CardTitle>
                <CardDescription className="text-slate-400">
                  Monitor and manage your scraping jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No scraping jobs yet</p>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-600 transition"
                        onClick={() => {
                          setSelectedJob(job.id);
                          const resultsTab = document.querySelector('[value="results"]') as HTMLElement;
                          if (resultsTab) resultsTab.click();
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(job.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-white">{job.job_name}</h3>
                                <span className="text-xs px-2 py-1 bg-slate-600 text-slate-300 rounded">
                                  {job.carrier_name}
                                </span>
                                <span className="text-xs px-2 py-1 bg-slate-600 text-slate-300 rounded">
                                  {job.status}
                                </span>
                              </div>
                              {job.status === 'in_progress' && job.total_records && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex justify-between text-xs text-slate-400">
                                    <span>
                                      {job.scraped_records || 0} / {job.total_records} records
                                    </span>
                                    <span>{getProgressPercent(job)}%</span>
                                  </div>
                                  <Progress
                                    value={getProgressPercent(job)}
                                    className="h-1.5 bg-slate-600"
                                  />
                                </div>
                              )}
                              {job.status === 'completed' && (
                                <p className="text-xs text-green-400 mt-1">
                                  ✓ Completed with {job.scraped_records} records
                                </p>
                              )}
                              {job.error_message && (
                                <p className="text-xs text-red-400 mt-1">Error: {job.error_message}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-2">
                                {new Date(job.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {job.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCSV(job.id);
                              }}
                              className="text-white border-slate-600 hover:bg-slate-700"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Scraped Results</CardTitle>
                <CardDescription className="text-slate-400">
                  {selectedJob ? `Showing data from job: ${selectedJob}` : 'Select a job to view results'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedJob ? (
                  <p className="text-slate-400 text-center py-8">Select a job from the Jobs tab to view results</p>
                ) : policies.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No policies found for this job</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="px-4 py-2 text-left">Policy #</th>
                          <th className="px-4 py-2 text-left">Applicant</th>
                          <th className="px-4 py-2 text-left">Plan</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Agent</th>
                          <th className="px-4 py-2 text-left">Imported</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((policy) => (
                          <tr key={policy.id} className="border-b border-slate-600 hover:bg-slate-700">
                            <td className="px-4 py-2">{policy.policy_number}</td>
                            <td className="px-4 py-2">{policy.applicant_name || '-'}</td>
                            <td className="px-4 py-2">{policy.plan_name || '-'}</td>
                            <td className="px-4 py-2">{policy.status || '-'}</td>
                            <td className="px-4 py-2">{policy.agent_name || '-'}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">
                              {new Date(policy.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
