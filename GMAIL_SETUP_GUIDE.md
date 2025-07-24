# Gmail API Setup Guide

## Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Click "New Project" 
3. Name your project (e.g., "Carrier Email Automation")
4. Click "Create"

## Step 2: Enable Gmail API
1. In your Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and click "Enable"

## Step 3: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - http://localhost:8080/auth/callback (for development)
   - https://yourdomain.com/auth/callback (for production)
5. Download the credentials JSON file

## Step 4: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - App name: "Carrier Email Automation"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - https://www.googleapis.com/auth/gmail.readonly
   - https://www.googleapis.com/auth/gmail.modify (if you need to modify emails)
5. Add test users (your email address)

## Step 5: Get Refresh Token
You'll need to implement OAuth flow to get a refresh token for accessing Gmail.
