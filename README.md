# Construction Survey PWA

A Progressive Web App for offline construction field data capture with Google Drive synchronization.

## Features

✅ **Offline-First Architecture**
- Works completely offline using IndexedDB
- All data stored locally on device
- No internet required for data capture

✅ **Hierarchical Data Structure**
- Address → Floor → Room → Photos
- Organized folder structure mirrors data hierarchy

✅ **Camera Integration**
- Native camera access for photo capture
- Fallback to file picker for devices without camera
- Photos stored as base64 in IndexedDB

✅ **Google Drive Sync**
- One-click sync when back online
- Automatic folder creation matching data structure
- Tracks sync status for all items

✅ **PWA Features**
- Installable on mobile and desktop
- Offline functionality via Service Worker
- App-like experience

## Setup Instructions

### 1. Set Up Google Cloud Project

To enable Google Drive sync, you need to create a Google Cloud project and obtain API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:8080` (for testing)
     - Your production domain
   - Add authorized redirect URIs:
     - `http://localhost:8080` (for testing)
     - Your production domain
   - Save and copy the Client ID

5. Create an API Key:
   - Click "Create Credentials" > "API key"
   - Restrict the key (recommended):
     - Application restrictions: HTTP referrers
     - API restrictions: Google Drive API
   - Copy the API key

### 2. Configure the App

Open `sync.js` and replace the placeholder values:

```javascript
this.CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your Client ID
this.API_KEY = 'YOUR_GOOGLE_API_KEY';     // Replace with your API Key
```

### 3. Run the App

#### Option A: Simple HTTP Server (Python)
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

#### Option B: Node.js HTTP Server
```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8080
```

#### Option C: PHP Built-in Server
```bash
php -S localhost:8080
```

Then open your browser to `http://localhost:8080`

### 4. Install as PWA

**On Mobile (Android/iOS):**
1. Open the app in Chrome/Safari
2. Look for "Add to Home Screen" prompt
3. Or use browser menu > "Add to Home Screen"

**On Desktop (Chrome):**
1. Open the app in Chrome
2. Click the install icon in the address bar
3. Or use menu > "Install Construction Survey App"

## Usage Guide

### Creating a Survey

1. **Add Address**
   - Click "New Address"
   - Enter street address, city, state, ZIP
   - Click "Create"

2. **Add Floors**
   - Click on an address
   - Click "Add Floor"
   - Enter floor number (e.g., "1", "2", "Basement")
   - Add optional notes
   - Click "Create"

3. **Add Rooms**
   - Click on a floor
   - Click "Add Room"
   - Enter room name (e.g., "Master Bedroom", "Kitchen")
   - Add optional notes
   - Click "Create"

4. **Capture Photos**
   - Click on a room
   - Click "Capture Photo"
   - Take photo with camera or choose from gallery
   - Photos are automatically saved offline

### Syncing to Google Drive

1. Connect to internet
2. Status badge will show "Online"
3. Click "Sync to Drive" button
4. Sign in to Google (first time only)
5. App will create folders and upload photos
6. Structure in Drive:
   ```
   Construction Surveys/
   ├── 123 Main St, Springfield/
   │   ├── Floor 1/
   │   │   ├── Living Room/
   │   │   │   ├── photo_1234567890.jpg
   │   │   │   └── photo_1234567891.jpg
   │   │   └── Kitchen/
   │   └── Floor 2/
   ```

## Technical Details

### Data Structure

**IndexedDB Stores:**
- `addresses`: Address records with location info
- `floors`: Floor records linked to addresses
- `rooms`: Room records linked to floors
- `photos`: Photo records with base64 data linked to rooms

**Fields:**
- All records have `id`, `createdAt`, `synced` fields
- `driveFolderId` / `driveFileId` track Google Drive IDs
- Photos include `capturedAt` timestamp and `dataUrl` (base64)

### Offline Capabilities

- **Service Worker**: Caches app shell for offline access
- **IndexedDB**: Stores all survey data locally
- **Camera API**: Works offline for photo capture
- **Sync Queue**: Tracks unsynced items for later upload

### Browser Compatibility

- **Chrome/Edge**: Full support
- **Safari**: Full support (iOS 11.3+)
- **Firefox**: Full support
- **Opera**: Full support

Requires:
- IndexedDB
- Service Workers
- Camera API (optional, file picker fallback)

## File Structure

```
construction-survey-pwa/
├── index.html          # Main HTML structure
├── styles.css          # App styling
├── app.js              # Main application logic
├── db.js               # IndexedDB wrapper
├── sync.js             # Google Drive sync logic
├── sw.js               # Service Worker
├── manifest.json       # PWA manifest
└── README.md          # This file
```

## Security Notes

1. **API Keys**: Never commit real API keys to public repositories
2. **OAuth**: Users must authenticate to access their own Drive
3. **Data**: All data stored locally is unencrypted
4. **HTTPS**: Required for PWA installation in production

## Deployment

### Production Deployment

1. Replace placeholder credentials in `sync.js`
2. Update OAuth authorized domains in Google Cloud Console
3. Deploy to HTTPS-enabled hosting (required for PWA)
4. Test installation and sync functionality

### Recommended Hosting

- **Netlify**: Drag-and-drop deployment
- **Vercel**: Git-based deployment
- **GitHub Pages**: Free static hosting
- **Firebase Hosting**: Google infrastructure

## Troubleshooting

**Camera not working:**
- Check browser permissions
- Ensure HTTPS in production
- Use file picker as fallback

**Sync failing:**
- Verify API credentials are correct
- Check Google Cloud Console quotas
- Ensure Drive API is enabled
- Check browser console for errors

**App not installing:**
- Requires HTTPS in production
- Service worker must register successfully
- Manifest must be valid

**Photos not uploading:**
- Check file size (large photos may timeout)
- Verify internet connection
- Check Drive API quotas

## Future Enhancements

Potential features to add:
- Photo compression before storage
- Batch photo upload with progress
- Export to PDF reports
- Notes and annotations on photos
- Multiple team member support
- Offline maps integration
- Voice notes
- Signature capture

## License

MIT License - Feel free to modify and use for your construction business!

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Google Cloud setup
3. Test with simple localhost setup first
4. Check network tab for API call failures
