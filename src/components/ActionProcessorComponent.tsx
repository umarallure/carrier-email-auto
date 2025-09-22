import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { processAllUnprocessedAnalysis } from '@/utils/emailActionProcessor';
import { RefreshCw, CheckCircle, AlertCircle, FileText, Users } from 'lucide-react';

export const ActionProcessorComponent = () => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    success: number;
    errors: number;
    details: string[];
  } | null>(null);

  const handleProcessActions = async () => {
    try {
      setProcessing(true);
      setProgress(0);
      setResults(null);

      toast({
        title: 'Processing Started',
        description: 'Converting analyzed emails into action items...',
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await processAllUnprocessedAnalysis();

      clearInterval(progressInterval);
      setProgress(100);
      setResults(result);

      if (result.errors === 0) {
        toast({
          title: 'Processing Complete',
          description: `Successfully created ${result.success} action items.`,
        });
      } else {
        toast({
          title: 'Processing Complete with Errors',
          description: `Created ${result.success} actions, ${result.errors} errors occurred.`,
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Action Processor</span>
        </CardTitle>
        <CardDescription>
          Convert analyzed emails into actionable customer tasks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Process all unprocessed email analysis results into customer action items.
              Each customer mentioned in an email will get their own action entry.
            </p>
          </div>
          <Button
            onClick={handleProcessActions}
            disabled={processing}
            className="flex items-center space-x-2"
          >
            {processing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>Process Actions</span>
              </>
            )}
          </Button>
        </div>

        {processing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {results && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <Badge variant="default">{results.success} Created</Badge>
              </div>
              {results.errors > 0 && (
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <Badge variant="destructive">{results.errors} Errors</Badge>
                </div>
              )}
            </div>

            {results.details.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Processing Details:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.details.slice(0, 10).map((detail, index) => (
                    <p key={index} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      {detail}
                    </p>
                  ))}
                  {results.details.length > 10 && (
                    <p className="text-xs text-muted-foreground italic">
                      ...and {results.details.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};