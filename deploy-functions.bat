@echo off
echo Deploying all Supabase Edge Functions...

echo.
echo Deploying gmail-token function...
npx supabase functions deploy gmail-token

echo.
echo Deploying gmail-sync function...
npx supabase functions deploy gmail-sync

echo.
echo Deploying analyze-email function...
npx supabase functions deploy analyze-email

echo.
echo Deploying batch-analyze function...
npx supabase functions deploy batch-analyze

echo.
echo Deploying gtl-scraper-session function...
npx supabase functions deploy gtl-scraper-session

echo.
echo All functions deployed successfully!
pause
