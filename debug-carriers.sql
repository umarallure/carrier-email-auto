-- Debug query to check what carriers are stored in the database
-- Run this in your Supabase SQL editor to see actual carrier values

SELECT 
    carrier,
    carrier_label,
    status,
    COUNT(*) as email_count
FROM emails 
GROUP BY carrier, carrier_label, status
ORDER BY carrier, status;

-- Also check some sample email records
SELECT 
    id,
    carrier,
    carrier_label,
    status,
    subject,
    created_at
FROM emails 
ORDER BY created_at DESC 
LIMIT 10;
