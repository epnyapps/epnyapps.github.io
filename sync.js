// Google Drive Sync Manager
class SyncManager {
    constructor() {
        this.accessToken = null;
        this.tokenClient = null;
        this.CLIENT_ID = '955894455124-f37m0nsetm42451rs0llred7fjemv4s2.apps.googleusercontent.com'; // You'll need to replace this
        this.API_KEY = 'AIzaSyDDtGbcFYdggmToD_QNFXCD1kliPeObdUs'; // You'll need to replace this
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.gapiInited = false;
        this.gisInited = false;
        this.ADDRESS_PARENT_FOLDER_ID = '1QRKhVOhMURPzUwMccImAsJCK9tFORRej';
    }

    async initialize() {
        console.log('Initializing Google APIs...');
        
        // Load both GAPI and GIS
        await Promise.all([
            this.initializeGapiClient(),
            this.initializeGisClient()
        ]);
        
        console.log('Both Google APIs initialized successfully');
    }

    async initializeGapiClient() {
        // Check if already initialized
        if (this.gapiInited) {
            console.log('GAPI already initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            // Check if script already exists
            if (document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
                if (typeof gapi !== 'undefined') {
                    gapi.load('client', async () => {
                        await this.initGapiClient();
                        resolve();
                    });
                } else {
                    reject(new Error('GAPI script loaded but gapi is undefined'));
                }
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                console.log('GAPI script loaded');
                gapi.load('client', async () => {
                    await this.initGapiClient();
                    resolve();
                });
            };
            script.onerror = (error) => {
                console.error('Failed to load GAPI script', error);
                reject(new Error('Failed to load GAPI script'));
            };
            document.head.appendChild(script);
        });
    }

    async initGapiClient() {
        try {
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: this.DISCOVERY_DOCS,
            });
            this.gapiInited = true;
            console.log('GAPI client initialized');
        } catch (error) {
            console.error('Error initializing GAPI client:', error);
            throw error;
        }
    }

    async initializeGisClient() {
        // Check if already initialized
        if (this.gisInited) {
            console.log('GIS already initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            // Check if script already exists
            if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
                if (typeof google !== 'undefined' && google.accounts) {
                    this.createTokenClient();
                    resolve();
                } else {
                    reject(new Error('GIS script loaded but google.accounts is undefined'));
                }
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                console.log('GIS script loaded');
                this.createTokenClient();
                resolve();
            };
            script.onerror = (error) => {
                console.error('Failed to load GIS script', error);
                reject(new Error('Failed to load GIS script'));
            };
            document.head.appendChild(script);
        });
    }

    createTokenClient() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: '', // Will be set in authenticate()
        });
        this.gisInited = true;
        console.log('GIS token client created');
    }

    async authenticate() {
        return new Promise((resolve, reject) => {
            try {
                // Set the callback for this authentication request
                this.tokenClient.callback = async (response) => {
                    if (response.error !== undefined) {
                        console.error('Authentication error:', response);
                        app.showToast('Authentication failed: ' + response.error);
                        reject(response);
                        return;
                    }
                    
                    this.accessToken = response.access_token;
                    console.log('Authentication successful, token received');
                    resolve(true);
                };

                // Check if we already have a valid token
                if (this.accessToken && gapi.client.getToken()) {
                    console.log('Using existing token');
                    resolve(true);
                    return;
                }

                // Request an access token
                if (gapi.client.getToken() === null) {
                    // Prompt the user to select a Google Account and ask for consent
                    this.tokenClient.requestAccessToken({ prompt: 'consent' });
                } else {
                    // Skip display of account chooser and consent dialog for an existing session
                    this.tokenClient.requestAccessToken({ prompt: '' });
                }
            } catch (error) {
                console.error('Authentication failed:', error);
                app.showToast('Authentication failed. Please try again.');
                reject(error);
            }
        });
    }

    async createFolder(name, parentId = null) {
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        
        if (parentId) {
            metadata.parents = [parentId];
        }

        // Set the token for this request
        gapi.client.setToken({ access_token: this.accessToken });

        const response = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id, name'
        });

        return response.result.id;
    }

    async uploadPhoto(photoData, fileName, folderId) {
        // Convert base64 to blob
        const base64Data = photoData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];

        for (let i = 0; i < byteCharacters.length; i++) {
            byteArrays.push(byteCharacters.charCodeAt(i));
        }

        const blob = new Blob([new Uint8Array(byteArrays)], { type: 'image/jpeg' });

        const metadata = {
            name: fileName,
            parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: form
        });

        const result = await response.json();
        return result.id;
    }

    async syncAll() {
        app.showToast('Starting sync...');
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.classList.add('syncing');
        syncBtn.disabled = true;

        try {
            // Validate credentials first
            if (this.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID' || this.API_KEY === 'YOUR_GOOGLE_API_KEY') {
                throw new Error('Please configure your Google API credentials in sync.js');
            }

            console.log('Step 1: Initializing Google API...');
            // Initialize Google API if not already done
            if (!this.accessToken) {
                await this.initialize();
                console.log('Step 2: Authenticating user...');
                const authenticated = await this.authenticate();
                if (!authenticated) {
                    syncBtn.classList.remove('syncing');
                    syncBtn.disabled = false;
                    return;
                }
                console.log('Step 3: Authentication successful');
            }

            console.log('Step 4: Getting unsynced data...');
            const unsyncedData = await db.getUnsyncedData();
            
            console.log('Unsynced data:', {
                addresses: unsyncedData.addresses.length,
                floors: unsyncedData.floors.length,
                rooms: unsyncedData.rooms.length,
                photos: unsyncedData.photos.length
            });

            if (unsyncedData.addresses.length === 0 && 
                unsyncedData.floors.length === 0 && 
                unsyncedData.rooms.length === 0 && 
                unsyncedData.photos.length === 0) {
                syncBtn.classList.remove('syncing');
                syncBtn.disabled = false;
                app.showToast('Everything is already synced!');
                return;
            }
            
            let syncedCount = 0;
            
            console.log('Step 5: Creating root folder...');
            // Create root folder for construction surveys if needed
            let rootFolderId = localStorage.getItem('constructionSurveyRootFolderId');
            if (!rootFolderId) {
                rootFolderId = await this.createFolder('Construction Surveys');
                localStorage.setItem('constructionSurveyRootFolderId', rootFolderId);
                console.log('Root folder created:', rootFolderId);
            } else {
                console.log('Using existing root folder:', rootFolderId);
            }

            console.log('Step 6: Syncing addresses...');
            // Sync addresses
            for (const address of unsyncedData.addresses) {
                const folderName = `${address.streetAddress}, ${address.city}`;
                console.log('Creating address folder:', folderName);
                const addressFolderId = await this.createFolder(folderName, this.ADDRESS_PARENT_FOLDER_ID);
                await db.markAsSynced('addresses', address.id, addressFolderId);
                syncedCount++;
            }

            console.log('Step 7: Syncing floors...');
            // Sync floors
            for (const floor of unsyncedData.floors) {
                const address = await db.get('addresses', floor.addressId);
                let addressFolderId = address.driveFolderId;
                
                // If address wasn't synced yet, create folder now
                if (!addressFolderId) {
                    const folderName = `${address.streetAddress}, ${address.city}`;
                    console.log('Creating address folder for floor:', folderName);
                    addressFolderId = await this.createFolder(folderName, this.ADDRESS_PARENT_FOLDER_ID);
                    await db.markAsSynced('addresses', address.id, addressFolderId);
                }
                
                console.log('Creating floor folder: Floor', floor.floorNumber);
                const floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                await db.markAsSynced('floors', floor.id, floorFolderId);
                syncedCount++;
            }

            console.log('Step 8: Syncing rooms...');
            // Sync rooms
            for (const room of unsyncedData.rooms) {
                const floor = await db.get('floors', room.floorId);
                let floorFolderId = floor.driveFolderId;
                
                // If floor wasn't synced yet, create folder now
                if (!floorFolderId) {
                    const address = await db.get('addresses', floor.addressId);
                    let addressFolderId = address.driveFolderId;
                    
                    if (!addressFolderId) {
                        const folderName = `${address.streetAddress}, ${address.city}`;
                        console.log('Creating address folder for room:', folderName);
                        addressFolderId = await this.createFolder(folderName, this.ADDRESS_PARENT_FOLDER_ID);
                        await db.markAsSynced('addresses', address.id, addressFolderId);
                    }
                    
                    console.log('Creating floor folder for room: Floor', floor.floorNumber);
                    floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                    await db.markAsSynced('floors', floor.id, floorFolderId);
                }
                
                console.log('Creating room folder:', room.roomName);
                const roomFolderId = await this.createFolder(room.roomName, floorFolderId);
                await db.markAsSynced('rooms', room.id, roomFolderId);
                syncedCount++;
            }

            console.log('Step 9: Syncing photos...');
            // Sync photos
            for (let i = 0; i < unsyncedData.photos.length; i++) {
                const photo = unsyncedData.photos[i];
                console.log(`Uploading photo ${i + 1}/${unsyncedData.photos.length}`);
                
                const room = await db.get('rooms', photo.roomId);
                let roomFolderId = room.driveFolderId;
                
                // If room wasn't synced yet, create full folder hierarchy
                if (!roomFolderId) {
                    const floor = await db.get('floors', room.floorId);
                    const address = await db.get('addresses', floor.addressId);
                    
                    let addressFolderId = address.driveFolderId;
                    if (!addressFolderId) {
                        const folderName = `${address.streetAddress}, ${address.city}`;
                        console.log('Creating address folder for photo:', folderName);
                        addressFolderId = await this.createFolder(folderName, this.ADDRESS_PARENT_FOLDER_ID);
                        await db.markAsSynced('addresses', address.id, addressFolderId);
                    }
                    
                    let floorFolderId = floor.driveFolderId;
                    if (!floorFolderId) {
                        console.log('Creating floor folder for photo: Floor', floor.floorNumber);
                        floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                        await db.markAsSynced('floors', floor.id, floorFolderId);
                    }
                    
                    console.log('Creating room folder for photo:', room.roomName);
                    roomFolderId = await this.createFolder(room.roomName, floorFolderId);
                    await db.markAsSynced('rooms', room.id, roomFolderId);
                }
                
                const fileName = `photo_${new Date(photo.capturedAt).getTime()}.jpg`;
                const fileId = await this.uploadPhoto(photo.dataUrl, fileName, roomFolderId);
                await db.markAsSynced('photos', photo.id, fileId);
                syncedCount++;
            }

            syncBtn.classList.remove('syncing');
            syncBtn.disabled = false;
            
            console.log('Sync completed successfully! Items synced:', syncedCount);
            if (syncedCount > 0) {
                document.getElementById('signOutBtn').style.display = 'inline-flex';
                app.showToast(`✅ Successfully synced ${syncedCount} items to Google Drive!`);
                // Refresh current view
                if (app.currentView === 'addressList') {
                    await app.loadAddresses();
                } else if (app.currentView === 'addressDetail') {
                    await app.loadFloors(app.currentAddressId);
                } else if (app.currentView === 'floorDetail') {
                    await app.loadRooms(app.currentFloorId);
                } else if (app.currentView === 'roomDetail') {
                    await app.loadPhotos(app.currentRoomId);
                }
            } else {
                app.showToast('Everything is already synced!');
            }

        } catch (error) {
            console.error('Sync error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                response: error.result
            });
            syncBtn.classList.remove('syncing');
            syncBtn.disabled = false;
            
            let errorMessage = 'Sync failed. ';
            if (error.message.includes('credentials')) {
                errorMessage += 'Please check your API credentials.';
            } else if (error.status === 401) {
                errorMessage += 'Authentication failed. Please try again.';
                this.accessToken = null; // Clear token to force re-auth
            } else if (error.status === 403) {
                errorMessage += 'Permission denied. Check API restrictions.';
            } else if (error.status === 400) {
                errorMessage += 'Invalid request. Check console for details.';
            } else {
                errorMessage += error.message || 'Unknown error.';
            }
            
            app.showToast(errorMessage, 5000);
        }
    }
}

const syncManager = new SyncManager();
