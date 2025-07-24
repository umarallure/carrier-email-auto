// Simple monitoring utility to track API calls
// Add this to your dashboard to monitor when and why API calls are being made

let apiCallCount = 0;
let lastApiCall = '';

export const trackApiCall = (endpoint: string, reason: string) => {
  apiCallCount++;
  lastApiCall = `${new Date().toLocaleTimeString()} - ${endpoint} (${reason})`;
  console.log(`API Call #${apiCallCount}: ${lastApiCall}`);
};

export const getApiStats = () => ({
  totalCalls: apiCallCount,
  lastCall: lastApiCall
});

// Use this in your fetchEmails function:
// trackApiCall('emails + analysis', 'Dashboard load');
