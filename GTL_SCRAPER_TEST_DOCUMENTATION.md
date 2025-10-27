# GTL Portal Manual Scraping Test Script

## Overview

The `test-gtl-login.js` script is a comprehensive testing tool designed to validate the complete GTL (Guarantee Trust Life) portal scraping workflow. This script combines manual user interaction with automated data extraction to ensure the scraping logic works correctly across all 19 pages of policy data.

## Functional Architecture

### Core Components

1. **GoLogin Browser Integration**
   - Cloud browser profile management
   - Secure credential isolation
   - Session persistence handling

2. **Manual Login Flow**
   - User-guided authentication process
   - Portal navigation assistance
   - Readiness confirmation system

3. **Automated Data Extraction**
   - Multi-page policy scraping
   - Structured data parsing
   - CSV export functionality

4. **Error Handling & Recovery**
   - Screenshot capture on failures
   - Detailed error logging
   - Graceful cleanup procedures

## Detailed Flow Documentation

### Phase 1: Initialization & Browser Setup

```mermaid
graph TD
    A[Script Start] --> B[Load Environment Variables]
    B --> C[Validate GoLogin Credentials]
    C --> D[Initialize GoLogin Instance]
    D --> E[Start Browser Profile]
    E --> F[Connect Puppeteer to Browser]
    F --> G[Get Existing Browser Pages]
```

**Key Operations:**
- Environment variable validation (GL_API_TOKEN, GL_PROFILE_ID)
- GoLogin browser profile startup with retry logic
- Puppeteer WebSocket connection establishment
- Existing tab enumeration and management

### Phase 2: Manual User Interaction

```mermaid
graph TD
    A[Browser Ready] --> B[Display Instructions]
    B --> C[Wait for User Input]
    C --> D{User Input == 'continue'?}
    D -->|No| C
    D -->|Yes| E[Proceed to Scraping]
```

**User Instructions Provided:**
1. Browser window is now open
2. Manually login to GTL portal
3. Navigate to: `https://gtlink.gtlic.com/MyBusiness`
4. Wait for page to fully load
5. Type "continue" when ready

### Phase 3: Tab Management & Navigation

```mermaid
graph TD
    A[User Ready] --> B[Enumerate All Browser Tabs]
    B --> C[Close Blank/About:Blank Tabs]
    C --> D[Search for GTL Domain Tab]
    D --> E{GTL Tab Found?}
    E -->|Yes| F[Use GTL Tab]
    E -->|No| G[Use First Available Tab]
    F --> H[Set Active Page]
    G --> H
```

**Tab Detection Logic:**
- Scans all open browser tabs
- Identifies tabs containing `gtlink.gtlic.com`
- Automatically closes empty/placeholder tabs
- Falls back to first available tab if GTL tab not found

### Phase 4: Page Analysis & Validation

```mermaid
graph TD
    A[Active Page Set] --> B[Capture Screenshot]
    B --> C[Extract Current URL]
    C --> D{On GTL Domain?}
    D -->|Yes| E[Proceed to Scraping]
    D -->|No| F[Log Warning]
    F --> E
```

**Validation Checks:**
- Full-page screenshot capture (`test-gtl-before-scraping.png`)
- URL domain verification
- Page load status assessment
- Warning generation for non-GTL domains

### Phase 5: Multi-Page Data Extraction

```mermaid
graph TD
    A[Start Scraping Loop] --> B[Initialize Page Counter]
    B --> C{Page <= 19?}
    C -->|Yes| D[Navigate to Page URL]
    C -->|No| E[Save All Data to CSV]
    D --> F[Wait for Page Load]
    F --> G[Extract Policies from Page]
    G --> H[Add to Results Array]
    H --> I[Increment Page Counter]
    I --> C
```

**Page Navigation Strategy:**
- Page 1: Process current page (already loaded)
- Pages 2-19: Navigate using `?page=N` parameter
- 2-second delay between page loads
- 60-second timeout for page navigation

### Phase 6: Policy Data Extraction

```mermaid
graph TD
    A[Page Loaded] --> B[Find All Policy Rows]
    B --> C[For Each Policy Row]
    C --> D[Extract Main Table Data]
    D --> E[Find Detail Section]
    E --> F[Parse Additional Fields]
    F --> G[Extract Applicant Details]
    G --> H[Extract Notes]
    H --> I[Create Policy Object]
    I --> J[Add to Page Results]
    J --> K{More Rows?}
    K -->|Yes| C
    K -->|No| L[Return Page Policies]
```

**Data Fields Extracted:**

#### Main Table Fields:
- `policyNumber` - Policy number identifier
- `updated` - Last update date
- `plan` - Insurance plan name
- `insured` - Policyholder name
- `amount` - Coverage amount
- `status` - Policy status

#### Detail Section Fields:
- `issueDate` - Policy issue date (MM/DD/YY)
- `applicationDate` - Application submission date
- `premium` - Premium amount
- `state` - State code (XX)
- `agent` - Agent name
- `agentNumber` - Agent identifier
- `planCode` - Plan code

#### Applicant Details:
- `applicantName` - Full applicant name
- `ssn` - Social Security Number
- `dob` - Date of birth
- `gender` - Gender
- `age` - Age
- `notes` - Additional policy notes

### Phase 7: Data Persistence & Reporting

```mermaid
graph TD
    A[All Pages Scraped] --> B[Generate CSV Filename]
    B --> C[Extract Column Headers]
    C --> D[Format CSV Content]
    D --> E[Write to File]
    E --> F[Display Success Summary]
    F --> G[Show Sample Records]
```

**CSV Generation Process:**
- Dynamic header extraction from all data fields
- Comma and quote escaping
- Date-stamped filename format
- Comprehensive statistics reporting

## Technical Specifications

### Dependencies
- `gologin` - Cloud browser management
- `puppeteer-core` - Browser automation
- `dotenv` - Environment configuration
- `readline` - User input handling
- `fs` - File system operations

### Environment Variables Required
```bash
GL_API_TOKEN=your_gologin_api_token
GL_PROFILE_ID=your_gologin_profile_id
```

### File Outputs
- `gtl-policies-YYYY-MM-DD.csv` - Extracted policy data
- `test-gtl-before-scraping.png` - Pre-scraping screenshot
- `test-gtl-ERROR.png` - Error screenshot (on failure)

### Performance Characteristics
- **Total Pages:** 19 pages
- **Page Load Time:** ~2 seconds per page navigation
- **Extraction Time:** Variable (depends on policy count per page)
- **Total Runtime:** ~5-10 minutes for full extraction
- **Memory Usage:** Minimal (data stored in memory during extraction)

## Error Handling & Recovery

### Error Types Handled

1. **GoLogin Connection Failures**
   - API token validation
   - Profile accessibility
   - Network connectivity issues

2. **Browser Automation Errors**
   - Page navigation timeouts
   - Element selection failures
   - JavaScript execution errors

3. **Data Extraction Issues**
   - Missing DOM elements
   - Malformed data structures
   - Encoding problems

4. **File System Errors**
   - Write permission issues
   - Disk space constraints
   - Path resolution problems

### Recovery Mechanisms

- **Screenshot Capture:** Automatic error screenshots
- **Detailed Logging:** Comprehensive error messages with stack traces
- **Graceful Cleanup:** Browser and GoLogin instance cleanup
- **User Feedback:** Clear error messages and troubleshooting guidance

## Usage Instructions

### Prerequisites
1. Valid GoLogin account with API access
2. Configured browser profile with GTL credentials
3. Node.js environment with required dependencies
4. Environment variables properly configured

### Execution Steps

1. **Start the Script:**
   ```bash
   npm run test:step2
   # or
   node scripts/test-gtl-login.js
   ```

2. **Wait for Browser:**
   - Script will display "Browser started successfully!"
   - GoLogin browser window will open automatically

3. **Manual Login Process:**
   - Navigate to GTL portal login page
   - Enter credentials and authenticate
   - Navigate to My Business section
   - Wait for policy data to load

4. **Confirm Readiness:**
   - Type `continue` in the terminal
   - Press Enter to proceed

5. **Automated Scraping:**
   - Script will iterate through all 19 pages
   - Progress displayed in terminal
   - Data extracted and compiled

6. **Review Results:**
   - CSV file generated with timestamp
   - Success summary displayed
   - Sample records shown

### Troubleshooting

#### Common Issues

**"GoLogin startup failed"**
- Verify API token is valid
- Check profile ID exists
- Ensure sufficient GoLogin credits
- Check network connectivity

**"Navigation timeout"**
- Verify GTL portal is accessible
- Check VPN/proxy settings
- Ensure profile has correct proxy configuration

**"No policies found"**
- Confirm you're on the correct page
- Check if data is loaded (may need to expand rows)
- Verify login was successful

**"CSV write failed"**
- Check write permissions in current directory
- Ensure sufficient disk space
- Verify file is not locked by another process

#### Debug Mode
Enable verbose logging by modifying the script to include:
```javascript
console.log('Debug: Current URL:', page.url());
console.log('Debug: Page title:', await page.title());
console.log('Debug: Found elements:', elementCount);
```

## Data Output Format

### CSV Structure
```csv
policyNumber,updated,plan,insured,amount,status,issueDate,applicationDate,premium,state,agent,agentNumber,planCode,applicantName,ssn,dob,gender,age,notes
GTL123456,10/21/25,TERM LIFE,John Doe,$100,000.00,Active,10/15/25,10/01/25,150.00,CA,Jane Smith,12345,TL100,John Doe,123-45-6789,01/15/80,M,45,Policy notes here...
```

### Data Validation
- All fields are strings (no type coercion)
- Empty fields represented as empty strings
- Special characters properly escaped
- Dates in MM/DD/YY format
- Currency values include dollar signs and commas

## Integration Points

### Relationship to Production System

This test script validates the core scraping logic used in:
- `gtl-scraper-worker.js` - Production background worker
- `GTLScraperWizard.tsx` - Frontend user interface
- Supabase database schema for policy storage

### Data Flow Integration

```
Test Script → CSV Export
    ↓
Production Worker → Supabase Database → Frontend Display
```

### Testing Coverage

- ✅ GoLogin browser integration
- ✅ Manual login workflow
- ✅ Multi-page navigation
- ✅ Data extraction accuracy
- ✅ CSV export functionality
- ✅ Error handling robustness
- ✅ Performance under load

## Maintenance & Updates

### Version History
- **v1.0** - Initial implementation with basic scraping
- **v1.1** - Added multi-page support (19 pages)
- **v1.2** - Enhanced error handling and logging
- **v1.3** - Improved data validation and CSV formatting

### Future Enhancements
- Automated login capability
- Progress bar integration
- Database direct insertion
- Parallel page processing
- Advanced error recovery

### Monitoring & Metrics
- Execution time tracking
- Success/failure rates
- Data quality validation
- Performance benchmarking

---

**Document Version:** 1.0
**Last Updated:** October 21, 2025
**Author:** AI Assistant
**Purpose:** Comprehensive documentation for GTL portal scraping test script</content>
<parameter name="filePath">c:\Users\Z C\Desktop\Unlimited Insurance\carrier-email-auto\GTL_SCRAPER_TEST_DOCUMENTATION.md