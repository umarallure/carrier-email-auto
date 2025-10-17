/**
 * Carrier Web Scraper Utilities
 * Provides scraping functionality for insurance carrier portals
 */

export interface ScraperConfig {
  carrier_name: string;
  login_url: string;
  portal_url: string;
  username: string;
  password: string;
  username_selector: string;
  password_selector: string;
  login_button_selector: string;
  policy_table_selector: string;
  policy_row_selector: string;
  pagination_next_selector?: string;
  headers?: Record<string, string>;
  max_pages?: number;
  rate_limit_ms?: number;
}

export interface PolicyData {
  policy_number: string;
  applicant_name?: string;
  plan_name?: string;
  coverage_amount?: string;
  status?: string;
  issue_date?: string;
  application_date?: string;
  premium?: string;
  state?: string;
  agent_name?: string;
  agent_number?: string;
  plan_code?: string;
  date_of_birth?: string;
  gender?: string;
  age?: number;
  notes?: string;
  last_updated?: string;
  raw_data?: Record<string, any>;
}

export interface ScraperJob {
  id?: string;
  carrier_name: string;
  job_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_records?: number;
  scraped_records?: number;
  error_message?: string;
  config: ScraperConfig;
  started_at?: Date;
  completed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Carrier-specific scraper configurations
 * Add new carriers here by providing their portal URLs and selectors
 */
export const CARRIER_CONFIGS: Record<string, ScraperConfig> = {
  GTL: {
    carrier_name: 'GTL',
    login_url: 'https://yourgtlportal.com/login',
    portal_url: 'https://yourgtlportal.com/MyBusiness',
    username: process.env.GTL_USERNAME || '',
    password: process.env.GTL_PASSWORD || '',
    username_selector: '[name="username"]',
    password_selector: '[name="password"]',
    login_button_selector: 'button[type="submit"]',
    policy_table_selector: '.DivTable',
    policy_row_selector: '.DivTableRow',
    pagination_next_selector: 'a[href*="page="]',
    max_pages: 18,
    rate_limit_ms: 1000,
  },
  ANAM: {
    carrier_name: 'ANAM',
    login_url: 'https://anamportal.com/login',
    portal_url: 'https://anamportal.com/policies',
    username: process.env.ANAM_USERNAME || '',
    password: process.env.ANAM_PASSWORD || '',
    username_selector: '[name="email"]',
    password_selector: '[name="password"]',
    login_button_selector: '[type="submit"]',
    policy_table_selector: 'table.policies-table',
    policy_row_selector: 'tbody tr',
    max_pages: 10,
    rate_limit_ms: 800,
  },
  AETNA: {
    carrier_name: 'AETNA',
    login_url: 'https://aetnaseniorproducts.com/login',
    portal_url: 'https://aetnaseniorproducts.com/agent-portal',
    username: process.env.AETNA_USERNAME || '',
    password: process.env.AETNA_PASSWORD || '',
    username_selector: '[name="user"]',
    password_selector: '[name="password"]',
    login_button_selector: '.login-btn',
    policy_table_selector: '.policies-grid',
    policy_row_selector: '.policy-card',
    max_pages: 15,
    rate_limit_ms: 1200,
  },
};

/**
 * Helper function to extract date from various formats
 */
export function parseDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Helper function to clean currency values
 */
export function parseCurrency(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/[$,]/g, '').trim();
}

/**
 * Format policy data for database insertion
 */
export function formatPolicyData(rawData: Record<string, any>): PolicyData {
  return {
    policy_number: rawData.policy_number || rawData.policyNumber || '',
    applicant_name: rawData.applicant_name || rawData.applicantName || rawData.insured || '',
    plan_name: rawData.plan_name || rawData.planName || rawData.plan || '',
    coverage_amount: parseCurrency(rawData.coverage_amount || rawData.amount || rawData.coverageAmount),
    status: rawData.status?.trim() || '',
    issue_date: parseDate(rawData.issue_date || rawData.issueDate),
    application_date: parseDate(rawData.application_date || rawData.appDate || rawData.applicationDate),
    premium: rawData.premium || rawData.Premium || '',
    state: rawData.state?.toUpperCase() || '',
    agent_name: rawData.agent_name || rawData.agent || rawData.agentName || '',
    agent_number: rawData.agent_number || rawData.agentNum || rawData.agentNumber || '',
    plan_code: rawData.plan_code || rawData.planCode || '',
    date_of_birth: parseDate(rawData.date_of_birth || rawData.dob || rawData.DOB),
    gender: rawData.gender?.charAt(0).toUpperCase() || '',
    age: parseInt(rawData.age || '0') || undefined,
    notes: rawData.notes?.trim() || '',
    last_updated: new Date().toISOString(),
    raw_data: rawData,
  };
}

/**
 * Validate scraper configuration
 */
export function validateConfig(config: ScraperConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.carrier_name) errors.push('Carrier name is required');
  if (!config.login_url) errors.push('Login URL is required');
  if (!config.portal_url) errors.push('Portal URL is required');
  if (!config.username) errors.push('Username is required');
  if (!config.password) errors.push('Password is required');
  if (!config.username_selector) errors.push('Username selector is required');
  if (!config.password_selector) errors.push('Password selector is required');
  if (!config.login_button_selector) errors.push('Login button selector is required');
  if (!config.policy_table_selector) errors.push('Policy table selector is required');
  if (!config.policy_row_selector) errors.push('Policy row selector is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate scraping statistics
 */
export function calculateStats(policies: PolicyData[], totalTime: number) {
  return {
    total_policies: policies.length,
    time_seconds: (totalTime / 1000).toFixed(2),
    policies_per_second: (policies.length / (totalTime / 1000)).toFixed(2),
    timestamp: new Date().toISOString(),
  };
}
