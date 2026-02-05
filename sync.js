// Google Drive Sync Manager
class SyncManager {
    constructor() {
        this.accessToken = null;
        this.CLIENT_ID = '955894455124-f37m0nsetm42451rs0llred7fjemv4s2.apps.googleusercontent.com'; // You'll need to replace this
        this.API_KEY = 'AIzaSyDDtGbcFYdggmToD_QNFXCD1kliPeObdUs'; // You'll need to replace this
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
    }

    async initialize() {
        // Load Google API
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client:auth2', () => {
                    gapi.client.init({
                        apiKey: this.API_KEY,
                        clientId: this.CLIENT_ID,
                        discoveryDocs: this.DISCOVERY_DOCS,
                        scope: this.SCOPES
                    }).then(() => {
                        resolve();
                    }).catch(reject);
                });
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async authenticate() {
        try {
            const authInstance = gapi.auth2.getAuthInstance();
            
            if (!authInstance.isSignedIn.get()) {
                await authInstance.signIn();
            }
            
            const user = authInstance.currentUser.get();
            const authResponse = user.getAuthResponse();
            this.accessToken = authResponse.access_token;
            
            return true;
        } catch (error) {
            console.error('Authentication failed:', error);
            app.showToast('Authentication failed. Please try again.');
            return false;
        }
    }

    async createFolder(name, parentId = null) {
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        
        if (parentId) {
            metadata.parents = [parentId];
        }

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
            // Initialize Google API if not already done
            if (!this.accessToken) {
                await this.initialize();
                const authenticated = await this.authenticate();
                if (!authenticated) {
                    syncBtn.classList.remove('syncing');
                    syncBtn.disabled = false;
                    return;
                }
            }

            const unsyncedData = await db.getUnsyncedData();
            
            let syncedCount = 0;
            
            // Create root folder for construction surveys if needed
            let rootFolderId = localStorage.getItem('constructionSurveyRootFolderId');
            if (!rootFolderId) {
                rootFolderId = await this.createFolder('Construction Surveys');
                localStorage.setItem('constructionSurveyRootFolderId', rootFolderId);
            }

            // Sync addresses
            for (const address of unsyncedData.addresses) {
                const folderName = `${address.streetAddress}, ${address.city}`;
                const addressFolderId = await this.createFolder(folderName, rootFolderId);
                await db.markAsSynced('addresses', address.id, addressFolderId);
                syncedCount++;
            }

            // Sync floors
            for (const floor of unsyncedData.floors) {
                const address = await db.get('addresses', floor.addressId);
                let addressFolderId = address.driveFolderId;
                
                // If address wasn't synced yet, create folder now
                if (!addressFolderId) {
                    const folderName = `${address.streetAddress}, ${address.city}`;
                    addressFolderId = await this.createFolder(folderName, rootFolderId);
                    await db.markAsSynced('addresses', address.id, addressFolderId);
                }
                
                const floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                await db.markAsSynced('floors', floor.id, floorFolderId);
                syncedCount++;
            }

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
                        addressFolderId = await this.createFolder(folderName, rootFolderId);
                        await db.markAsSynced('addresses', address.id, addressFolderId);
                    }
                    
                    floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                    await db.markAsSynced('floors', floor.id, floorFolderId);
                }
                
                const roomFolderId = await this.createFolder(room.roomName, floorFolderId);
                await db.markAsSynced('rooms', room.id, roomFolderId);
                syncedCount++;
            }

            // Sync photos
            for (const photo of unsyncedData.photos) {
                const room = await db.get('rooms', photo.roomId);
                let roomFolderId = room.driveFolderId;
                
                // If room wasn't synced yet, create full folder hierarchy
                if (!roomFolderId) {
                    const floor = await db.get('floors', room.floorId);
                    const address = await db.get('addresses', floor.addressId);
                    
                    let addressFolderId = address.driveFolderId;
                    if (!addressFolderId) {
                        const folderName = `${address.streetAddress}, ${address.city}`;
                        addressFolderId = await this.createFolder(folderName, rootFolderId);
                        await db.markAsSynced('addresses', address.id, addressFolderId);
                    }
                    
                    let floorFolderId = floor.driveFolderId;
                    if (!floorFolderId) {
                        floorFolderId = await this.createFolder(`Floor ${floor.floorNumber}`, addressFolderId);
                        await db.markAsSynced('floors', floor.id, floorFolderId);
                    }
                    
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
            
            if (syncedCount > 0) {
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
            syncBtn.classList.remove('syncing');
            syncBtn.disabled = false;
            app.showToast('Sync failed. Please try again.');
        }
    }
}

const syncManager = new SyncManager();
