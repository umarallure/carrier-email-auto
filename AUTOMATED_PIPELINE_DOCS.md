# Automated Email Processing Pipeline Documentation

## Overview
This automated pipeline processes insurance carrier emails every 15 minutes by running a complete workflow: Gmail sync → Email categorization → Carrier-specific analysis.

## 🚀 **System Architecture**

### Core Functions
1. **`email-pipeline-orchestrator`** - Main orchestration function
2. **`pipeline-cron-trigger`** - Batch processing for all users
3. **`test-pipeline`** - Manual testing and debugging

### Pipeline Flow
```
Cron Trigger (Every 15 minutes)
    ↓
Pipeline Cron Trigger
    ↓ (For each user with Gmail token)
Email Pipeline Orchestrator
    ↓
Step 1: Gmail Sync (fetch new emails)
    ↓
Step 2: Categorize Emails (AI carrier detection)
    ↓
Step 3: Analyze Emails (carrier-specific processing)
    ↓
Results logged to pipeline_logs table
```

## 📋 **Function Details**

### 1. Email Pipeline Orchestrator
**Endpoint**: `/functions/v1/email-pipeline-orchestrator`
**Method**: POST
**Authentication**: Bearer token (user-specific)

**Request Body**:
```json
{
  "skip_gmail_sync": false,
  "force_recategorize": false,
  "batch_size": 50,
  "analysis_batch_size": 25
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pipeline completed successfully in 45.23 seconds",
  "metrics": {
    "start_time": "2025-01-25T10:00:00Z",
    "end_time": "2025-01-25T10:00:45Z",
    "status": "completed",
    "emails_synced": 15,
    "emails_categorized": 50,
    "emails_analyzed": 25,
    "errors": [],
    "step": "email-analysis"
  },
  "carrier_breakdown": {
    "ANAM": 8,
    "COREBRIDGE": 12,
    "MUTUAL OF OMAHA": 5
  },
  "errors": []
}
```

### 2. Pipeline Cron Trigger
**Endpoint**: `/functions/v1/pipeline-cron-trigger`
**Method**: POST
**Authentication**: Service role key
**Trigger**: Cron job every 15 minutes

**Response**:
```json
{
  "success": true,
  "message": "Cron execution completed: 3 successful, 0 failed",
  "total_users": 3,
  "successful_users": 3,
  "failed_users": 0,
  "execution_time": "2025-01-25T10:00:00Z",
  "results": [...]
}
```

### 3. Test Pipeline
**Endpoint**: `/functions/v1/test-pipeline`
**Method**: POST
**Authentication**: Bearer token (user-specific)
**Purpose**: Manual testing and debugging

## ⚙️ **Configuration**

### Supported Carriers
The pipeline supports the following insurance carriers:
- ANAM → `analyze-email-anam`
- COREBRIDGE → `analyze-email-corebridge`
- ROYAL_NEIGHBORS → `analyze-email-royal-neighbors`
- MUTUAL OF OMAHA → `analyze-email-mutual-omaha`
- SBLI → `analyze-email-sbli`
- GUARANTEE TRUST → `analyze-email-guarantee-trust`
- AETNA → `analyze-email-aetna`
- TRANSAMERICA → `analyze-email-transamerica`
- LIBERTY BANKERS → `analyze-email-liberty-bankers`
- Unknown carriers → `analyze-email-generic`

### Batch Sizes
- **Gmail Sync**: 25 messages per batch (prevents timeout)
- **Email Categorization**: 50 emails per batch
- **Email Analysis**: 20-25 emails per user, 5 emails per carrier batch

### Timing Configuration
- **Cron Schedule**: `*/15 * * * *` (every 15 minutes)
- **User Processing Delay**: 2 seconds between users
- **Batch Processing Delay**: 1 second between batches

## 🏗️ **Database Schema**

### pipeline_logs Table
```sql
CREATE TABLE pipeline_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  pipeline_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds NUMERIC,
  metrics JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### app_settings Table
```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🧪 **Testing**

### Manual Pipeline Test
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/test-pipeline \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skip_gmail_sync": false,
    "force_recategorize": false,
    "batch_size": 10,
    "analysis_batch_size": 5,
    "test_mode": true
  }'
```

### Check Pipeline Logs
```sql
SELECT 
  pipeline_type,
  status,
  start_time,
  end_time,
  duration_seconds,
  metrics->>'emails_synced' as emails_synced,
  metrics->>'emails_categorized' as emails_categorized,
  metrics->>'emails_analyzed' as emails_analyzed
FROM pipeline_logs 
ORDER BY start_time DESC 
LIMIT 10;
```

### Monitor Cron Job Status
```sql
SELECT jobname, schedule, command, active 
FROM cron.job 
WHERE jobname = 'email-pipeline-automation';
```

## 📊 **Monitoring & Logging**

### Pipeline Metrics
Each pipeline execution logs:
- Start and end timestamps
- Number of emails synced, categorized, and analyzed
- Processing duration
- Error count and details
- Carrier-specific breakdown

### Error Handling
- **Gmail Sync Failures**: Continue with existing emails
- **Categorization Failures**: Stop pipeline execution
- **Analysis Failures**: Log individual email failures, continue processing
- **Network Timeouts**: Automatic retry with smaller batches

### Logging Levels
- **INFO**: Normal pipeline progress
- **WARNING**: Individual email processing failures
- **ERROR**: Critical pipeline failures

## 🛠️ **Troubleshooting**

### Common Issues

1. **No Gmail Token**
   - Error: "No Gmail access token found"
   - Solution: User needs to authenticate with Gmail first

2. **Timeout Errors**
   - Error: "504 Gateway Timeout"
   - Solution: Reduce batch sizes in configuration

3. **Analysis Function Not Found**
   - Error: "Function not found"
   - Solution: Deploy missing carrier analysis function

4. **Cron Job Not Running**
   - Check: `SELECT * FROM cron.job WHERE jobname = 'email-pipeline-automation'`
   - Solution: Ensure pg_cron extension is enabled

### Debug Commands
```sql
-- Check recent pipeline executions
SELECT * FROM pipeline_logs ORDER BY created_at DESC LIMIT 5;

-- Check users with Gmail tokens
SELECT user_id, token_type, created_at 
FROM secure_tokens 
WHERE token_type = 'gmail_access_token';

-- Check cron job configuration
SELECT * FROM app_settings WHERE key LIKE 'pipeline%';
```

## 🚦 **Pipeline Status Monitoring**

### Success Indicators
- ✅ `status = 'completed'`
- ✅ `emails_synced > 0` (if new emails expected)
- ✅ `emails_categorized > 0`
- ✅ `emails_analyzed > 0`
- ✅ `errors` array is empty or contains only minor warnings

### Failure Indicators
- ❌ `status = 'failed'`
- ❌ `error_message` is not null
- ❌ Pipeline hasn't run in >20 minutes
- ❌ Multiple consecutive failures for same user

### Performance Benchmarks
- **Small batch (≤10 emails)**: ~15-30 seconds
- **Medium batch (11-50 emails)**: ~45-90 seconds
- **Large batch (51-100 emails)**: ~2-4 minutes
- **Multi-user cron**: ~1-2 minutes per user

## 🔧 **Configuration Updates**

### Modify Cron Schedule
```sql
-- Change to run every 30 minutes
SELECT cron.alter_job('email-pipeline-automation', schedule := '*/30 * * * *');

-- Disable cron job
SELECT cron.unschedule('email-pipeline-automation');
```

### Update Batch Sizes
```sql
-- Update app settings for default batch sizes
UPDATE app_settings 
SET value = '100' 
WHERE key = 'default_batch_size';
```

### Enable/Disable Pipeline
```sql
-- Disable pipeline
UPDATE app_settings 
SET value = 'false' 
WHERE key = 'pipeline_cron_enabled';
```

## 📈 **Performance Optimization**

### Recommended Settings
- **Gmail Sync**: Process 25 messages per API call
- **Email Categorization**: 50 emails per batch
- **Analysis**: 5 emails per carrier batch, 2s delay between batches
- **User Processing**: 2s delay between users

### Scaling Considerations
- **High-volume users**: Consider user-specific batch size limits
- **Many users**: Implement priority queuing system
- **Complex analysis**: Split analysis into async background tasks
- **Peak times**: Implement rate limiting and load balancing

---

## 🎯 **Quick Start Guide**

1. **Deploy Functions**: All three pipeline functions are deployed
2. **Configure Cron**: 15-minute cron job is active
3. **Test Manual**: Use `/test-pipeline` endpoint for verification
4. **Monitor Logs**: Check `pipeline_logs` table for execution history
5. **Review Metrics**: Analyze performance and error patterns

The pipeline is now running automatically every 15 minutes and will process emails for all users with valid Gmail tokens!