# Troubleshooting Guide - Google Drive Sync

## ✅ UPDATED: Now Using Google Identity Services (GIS)

The app has been updated to use the new Google Identity Services library (replacing the deprecated `gapi.auth2`). This fixes the `idpiframe_initialization_failed` error.

## Quick Diagnostic Steps

### Step 1: Click "Test Setup" Button
The app now has a "Test Setup" button in the header. Click it and check your browser console (F12) for detailed error messages.

### Step 2: Verify Credentials Are Configured

Open `sync.js` and check lines 6-7:

```javascript
this.CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Must be replaced!
this.API_KEY = 'YOUR_GOOGLE_API_KEY';     // Must be replaced!
```

If these still say `'YOUR_GOOGLE_CLIENT_ID'` or `'YOUR_GOOGLE_API_KEY'`, you need to replace them with your actual credentials from Google Cloud Console.

### Step 3: Check Google Cloud Console Setup

#### A. Verify OAuth Client ID Settings
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Check **Authorized JavaScript origins**:
   ```
   http://localhost:8080
   https://yourusername.github.io
   ```
5. Check **Authorized redirect URIs**:
   ```
   http://localhost:8080
   https://yourusername.github.io
   ```

#### B. Verify API Key Settings
1. In **Credentials**, click on your API Key
2. Check **Application restrictions**:
   - Set to "HTTP referrers (web sites)"
   - Add referrers:
     ```
     http://localhost:8080/*
     https://yourusername.github.io/*
     ```
3. Check **API restrictions**:
   - Restrict to: "Google Drive API"

#### C. Verify Google Drive API is Enabled
1. Navigate to: **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Make sure it shows "MANAGE" (not "ENABLE")
   - If it shows "ENABLE", click it to enable the API

## Common Error Messages & Solutions

### Error: "origin_mismatch" or "redirect_uri_mismatch"
**Cause**: Your domain isn't authorized in OAuth settings

**Solution**:
1. Check the exact URL you're accessing (including http:// or https://)
2. Add it EXACTLY to Authorized JavaScript origins in Google Cloud Console
3. For GitHub Pages, use: `https://yourusername.github.io` (no trailing slash)

### Error: "API key not valid"
**Cause**: API key restrictions don't match your domain

**Solution**:
1. Go to API Key settings in Google Cloud Console
2. Update HTTP referrers to include your domain with `/*` at the end
3. Make sure API restrictions include Google Drive API

### Error: "idpiframe_initialization_failed"
**Status**: ✅ FIXED - App now uses new Google Identity Services

If you still see this error:
1. Clear your browser cache completely
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Make sure you're using the updated sync.js file

### Error: "Cookies are not enabled in current environment"
**Cause**: Third-party cookies are blocked (needed for Google auth popup)

**Solution**:
1. **Chrome**: Settings → Privacy and security → Third-party cookies → "Allow third-party cookies"
2. **Safari**: Preferences → Privacy → Uncheck "Prevent cross-site tracking"
3. **Firefox**: Settings → Privacy & Security → Standard (not Strict)
4. Or use Incognito/Private browsing mode
5. Or allow cookies specifically for `accounts.google.com` and `*.googleapis.com`

### Error: "popup_blocked_by_client"
**Cause**: Browser blocked the authentication popup

**Solution**:
1. Click "Test Setup" again
2. Allow popups for your site in browser settings
3. Click the icon in address bar to allow popups

### Error: "popup_closed_by_user"
**Cause**: User closed the OAuth popup

**Solution**:
- Just click "Sync to Drive" again and complete the authorization

## Detailed Console Debugging

Open browser console (F12) and look for these messages:

### ✅ Good Signs:
```
Initializing Google APIs...
GAPI script loaded
GAPI client initialized
GIS script loaded  
GIS token client created
Both Google APIs initialized successfully
Authentication successful, token received
```

### ❌ Bad Signs & Fixes:

**"Failed to load GAPI script" or "Failed to load GIS script"**
- Check your internet connection
- Check if your browser blocks scripts from googleapis.com or accounts.google.com
- Try a different browser

**"Error initializing Google API client"**
- Your CLIENT_ID or API_KEY is wrong
- Copy them again from Google Cloud Console

**"Invalid API key"**
- API key restrictions don't match your domain
- Go to Google Cloud Console and update restrictions

**"Access blocked: This app's request is invalid"**
- Your OAuth consent screen isn't configured
- Go to Google Cloud Console → OAuth consent screen
- Set it to "External" (for testing) or "Internal" (for organization)

## Testing Your Setup

### Test 1: Verify Credentials Format
Your credentials should look like this:

```javascript
// CLIENT_ID - should end with .apps.googleusercontent.com
this.CLIENT_ID = '123456789-abcdefghijklmnop.apps.googleusercontent.com';

// API_KEY - should start with AIza
this.API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX';
```

### Test 2: Manual API Test
Open browser console and run:

```javascript
// This should return the gapi object
typeof gapi

// This should show your client ID
syncManager.CLIENT_ID

// This should show your API key (first 15 chars)
syncManager.API_KEY.substring(0, 15)
```

### Test 3: Initialize and Authenticate
Click the "Test Setup" button and watch the console for step-by-step results.

## Still Not Working?

### Option 1: Check Network Tab
1. Open DevTools (F12) → Network tab
2. Click "Sync to Drive"
3. Look for failed requests (red)
4. Click on them to see:
   - Request URL
   - Response body
   - Status code

### Option 2: Try OAuth Playground
Test your credentials independently:
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️)
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. Try authorizing Google Drive API
6. If this fails, your OAuth setup is wrong

### Option 3: Create New Credentials
Sometimes it's easier to start fresh:
1. Delete existing credentials in Google Cloud Console
2. Create new OAuth Client ID
3. Create new API Key
4. Update sync.js with new credentials
5. Clear browser cache and cookies

## Example Working Configuration

**Google Cloud Console - OAuth Client:**
```
Application type: Web application
Name: Construction Survey App
Authorized JavaScript origins:
  - http://localhost:8080
  - https://myusername.github.io
Authorized redirect URIs:
  - http://localhost:8080
  - https://myusername.github.io
```

**Google Cloud Console - API Key:**
```
Application restrictions: HTTP referrers
Referrers:
  - http://localhost:8080/*
  - https://myusername.github.io/*
API restrictions: Restrict key
  - Google Drive API
```

**sync.js:**
```javascript
this.CLIENT_ID = '123456789-abc123def456.apps.googleusercontent.com';
this.API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX';
```

## Need More Help?

If you're still stuck, check the console output from the "Test Setup" button and share:
1. The exact error message
2. The console logs
3. What step failed (initialization, authentication, folder creation, etc.)
