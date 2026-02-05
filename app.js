// Main application logic
class App {
    constructor() {
        this.currentView = 'addressList';
        this.currentAddressId = null;
        this.currentFloorId = null;
        this.currentRoomId = null;
        this.cameraStream = null;
    }

    async init() {
        await db.init();
        this.setupEventListeners();
        this.updateOnlineStatus();
        this.showView('addressList');
        await this.loadAddresses();
        
        // Monitor online status
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
    }

    setupEventListeners() {
        // Address events
        document.getElementById('newAddressBtn').addEventListener('click', () => this.showModal('addressModal'));
        document.getElementById('cancelAddress').addEventListener('click', () => this.hideModal('addressModal'));
        document.getElementById('addressForm').addEventListener('submit', (e) => this.handleAddressSubmit(e));
        document.getElementById('backToAddresses').addEventListener('click', () => {
            this.showView('addressList');
            this.loadAddresses();
        });

        // Floor events
        document.getElementById('newFloorBtn').addEventListener('click', () => this.showModal('floorModal'));
        document.getElementById('cancelFloor').addEventListener('click', () => this.hideModal('floorModal'));
        document.getElementById('floorForm').addEventListener('submit', (e) => this.handleFloorSubmit(e));
        document.getElementById('backToFloors').addEventListener('click', () => {
            this.showView('addressDetail');
            this.loadFloors(this.currentAddressId);
        });

        // Room events
        document.getElementById('newRoomBtn').addEventListener('click', () => this.showModal('roomModal'));
        document.getElementById('cancelRoom').addEventListener('click', () => this.hideModal('roomModal'));
        document.getElementById('roomForm').addEventListener('submit', (e) => this.handleRoomSubmit(e));
        document.getElementById('backToRooms').addEventListener('click', () => {
            this.showView('floorDetail');
            this.loadRooms(this.currentFloorId);
        });

        // Photo events
        document.getElementById('capturePhotoBtn').addEventListener('click', () => this.openCamera());
        document.getElementById('cancelCamera').addEventListener('click', () => this.closeCamera());
        document.getElementById('captureBtn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('useFileInput').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileInput(e));

        // Sync button
        document.getElementById('syncBtn').addEventListener('click', () => this.syncToGoogleDrive());
        
        // Test credentials button
        document.getElementById('testCredsBtn').addEventListener('click', () => this.testCredentials());
        
        // Sign out button
        document.getElementById('signOutBtn').addEventListener('click', () => this.signOutGoogle());
    }

    signOutGoogle() {
        if (syncManager.accessToken) {
            // Revoke the token
            google.accounts.oauth2.revoke(syncManager.accessToken, () => {
                console.log('Token revoked');
            });
            
            syncManager.accessToken = null;
            if (typeof gapi !== 'undefined' && gapi.client) {
                gapi.client.setToken(null);
            }
            
            document.getElementById('signOutBtn').style.display = 'none';
            this.showToast('Signed out from Google');
        }
    }

    async testCredentials() {
        const toast = document.getElementById('toast');
        toast.innerHTML = 'Testing Google API setup...<br>Check console for details.';
        toast.classList.add('show');
        
        console.log('=== TESTING GOOGLE API CREDENTIALS ===');
        console.log('1. Checking if credentials are configured...');
        
        if (syncManager.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
            console.error('❌ CLIENT_ID not configured!');
            console.log('Please edit sync.js and add your Client ID');
            toast.innerHTML = '❌ CLIENT_ID not configured!<br>Check console and edit sync.js';
            setTimeout(() => toast.classList.remove('show'), 5000);
            return;
        }
        
        if (syncManager.API_KEY === 'YOUR_GOOGLE_API_KEY') {
            console.error('❌ API_KEY not configured!');
            console.log('Please edit sync.js and add your API Key');
            toast.innerHTML = '❌ API_KEY not configured!<br>Check console and edit sync.js';
            setTimeout(() => toast.classList.remove('show'), 5000);
            return;
        }
        
        console.log('✅ Credentials configured');
        console.log('   CLIENT_ID:', syncManager.CLIENT_ID.substring(0, 20) + '...');
        console.log('   API_KEY:', syncManager.API_KEY.substring(0, 15) + '...');
        
        console.log('2. Testing Google API initialization...');
        try {
            await syncManager.initialize();
            console.log('✅ Google API initialized successfully');
            
            console.log('3. Testing authentication...');
            const authenticated = await syncManager.authenticate();
            
            if (authenticated) {
                console.log('✅ Authentication successful!');
                console.log('   Access token:', syncManager.accessToken.substring(0, 20) + '...');
                document.getElementById('signOutBtn').style.display = 'inline-flex';
                toast.innerHTML = '✅ Setup verified!<br>Ready to sync to Google Drive';
                setTimeout(() => toast.classList.remove('show'), 3000);
            } else {
                console.log('❌ Authentication failed or cancelled');
                toast.innerHTML = '❌ Authentication failed<br>Check console for details';
                setTimeout(() => toast.classList.remove('show'), 5000);
            }
        } catch (error) {
            console.error('❌ Error during testing:', error);
            console.error('   Error details:', error.message);
            toast.innerHTML = '❌ Test failed: ' + error.message + '<br>Check console';
            setTimeout(() => toast.classList.remove('show'), 5000);
        }
        
        console.log('=== TEST COMPLETE ===');
    }

    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewName}View`).classList.add('active');
        this.currentView = viewName;
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Reset form
        const modal = document.getElementById(modalId);
        const form = modal.querySelector('form');
        if (form) form.reset();
    }

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    updateOnlineStatus() {
        const statusBadge = document.getElementById('onlineStatus');
        const syncBtn = document.getElementById('syncBtn');
        
        if (navigator.onLine) {
            statusBadge.textContent = 'Online';
            statusBadge.classList.remove('offline');
            statusBadge.classList.add('online');
            syncBtn.disabled = false;
        } else {
            statusBadge.textContent = 'Offline';
            statusBadge.classList.remove('online');
            statusBadge.classList.add('offline');
            syncBtn.disabled = true;
        }
    }

    // Address operations
    async loadAddresses() {
        const addresses = await db.getAll('addresses');
        const addressList = document.getElementById('addressList');
        
        if (addresses.length === 0) {
            addressList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏠</div>
                    <p>No addresses yet. Create one to get started!</p>
                </div>
            `;
            return;
        }

        // Get counts for each address
        const addressesWithCounts = await Promise.all(
            addresses.map(addr => db.getAddressWithCounts(addr.id))
        );

        addressList.innerHTML = addressesWithCounts.map(address => `
            <div class="card" onclick="app.viewAddress(${address.id})">
                <h3>${address.streetAddress}</h3>
                <p>${address.city}, ${address.state} ${address.zipCode}</p>
                <div class="card-meta">
                    <span>📁 ${address.floorCount} floors</span>
                    <span>🚪 ${address.roomCount} rooms</span>
                    <span>📷 ${address.photoCount} photos</span>
                </div>
                <div class="card-meta">
                    <span>${address.synced ? '✅ Synced' : '⏳ Not synced'}</span>
                    <span>${new Date(address.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }

    async handleAddressSubmit(e) {
        e.preventDefault();
        
        const data = {
            streetAddress: document.getElementById('streetAddress').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zipCode: document.getElementById('zipCode').value
        };

        await db.createAddress(data);
        this.hideModal('addressModal');
        this.showToast('Address created successfully!');
        await this.loadAddresses();
    }

    async viewAddress(addressId) {
        this.currentAddressId = addressId;
        const address = await db.get('addresses', addressId);
        document.getElementById('addressTitle').textContent = 
            `${address.streetAddress}, ${address.city}`;
        this.showView('addressDetail');
        await this.loadFloors(addressId);
    }

    // Floor operations
    async loadFloors(addressId) {
        const floors = await db.getFloorsByAddress(addressId);
        const floorList = document.getElementById('floorList');
        
        if (floors.length === 0) {
            floorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏢</div>
                    <p>No floors yet. Add a floor to continue!</p>
                </div>
            `;
            return;
        }

        const floorsWithCounts = await Promise.all(
            floors.map(async floor => {
                const rooms = await db.getRoomsByFloor(floor.id);
                let photoCount = 0;
                for (const room of rooms) {
                    const photos = await db.getPhotosByRoom(room.id);
                    photoCount += photos.length;
                }
                return { ...floor, roomCount: rooms.length, photoCount };
            })
        );

        floorList.innerHTML = floorsWithCounts.map(floor => `
            <div class="card" onclick="app.viewFloor(${floor.id})">
                <h3>Floor ${floor.floorNumber}</h3>
                ${floor.floorNotes ? `<p>${floor.floorNotes}</p>` : ''}
                <div class="card-meta">
                    <span>🚪 ${floor.roomCount} rooms</span>
                    <span>📷 ${floor.photoCount} photos</span>
                </div>
                <div class="card-meta">
                    <span>${floor.synced ? '✅ Synced' : '⏳ Not synced'}</span>
                </div>
            </div>
        `).join('');
    }

    async handleFloorSubmit(e) {
        e.preventDefault();
        
        const data = {
            addressId: this.currentAddressId,
            floorNumber: document.getElementById('floorNumber').value,
            floorNotes: document.getElementById('floorNotes').value
        };

        await db.createFloor(data);
        this.hideModal('floorModal');
        this.showToast('Floor created successfully!');
        await this.loadFloors(this.currentAddressId);
    }

    async viewFloor(floorId) {
        this.currentFloorId = floorId;
        const floor = await db.get('floors', floorId);
        document.getElementById('floorTitle').textContent = `Floor ${floor.floorNumber}`;
        this.showView('floorDetail');
        await this.loadRooms(floorId);
    }

    // Room operations
    async loadRooms(floorId) {
        const rooms = await db.getRoomsByFloor(floorId);
        const roomList = document.getElementById('roomList');
        
        if (rooms.length === 0) {
            roomList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚪</div>
                    <p>No rooms yet. Add a room to continue!</p>
                </div>
            `;
            return;
        }

        const roomsWithCounts = await Promise.all(
            rooms.map(async room => {
                const photos = await db.getPhotosByRoom(room.id);
                return { ...room, photoCount: photos.length };
            })
        );

        roomList.innerHTML = roomsWithCounts.map(room => `
            <div class="card" onclick="app.viewRoom(${room.id})">
                <h3>${room.roomName}</h3>
                ${room.roomNotes ? `<p>${room.roomNotes}</p>` : ''}
                <div class="card-meta">
                    <span>📷 ${room.photoCount} photos</span>
                    <span>${room.synced ? '✅ Synced' : '⏳ Not synced'}</span>
                </div>
            </div>
        `).join('');
    }

    async handleRoomSubmit(e) {
        e.preventDefault();
        
        const data = {
            floorId: this.currentFloorId,
            roomName: document.getElementById('roomName').value,
            roomNotes: document.getElementById('roomNotes').value
        };

        await db.createRoom(data);
        this.hideModal('roomModal');
        this.showToast('Room created successfully!');
        await this.loadRooms(this.currentFloorId);
    }

    async viewRoom(roomId) {
        this.currentRoomId = roomId;
        const room = await db.get('rooms', roomId);
        document.getElementById('roomTitle').textContent = room.roomName;
        this.showView('roomDetail');
        await this.loadPhotos(roomId);
    }

    // Photo operations
    async loadPhotos(roomId) {
        const photos = await db.getPhotosByRoom(roomId);
        const photoGrid = document.getElementById('photoGrid');
        
        if (photos.length === 0) {
            photoGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📷</div>
                    <p>No photos yet. Capture some photos!</p>
                </div>
            `;
            return;
        }

        photoGrid.innerHTML = photos.map(photo => `
            <div class="photo-item">
                <img src="${photo.dataUrl}" alt="Room photo">
                <div class="photo-item-overlay">
                    <span class="photo-timestamp">${new Date(photo.capturedAt).toLocaleString()}</span>
                    <button class="photo-delete" onclick="app.deletePhoto(${photo.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    async openCamera() {
        this.showModal('cameraModal');
        
        try {
            // Try to access camera
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' },
                audio: false 
            });
            
            this.cameraStream = stream;
            const video = document.getElementById('cameraVideo');
            video.srcObject = stream;
            document.getElementById('captureBtn').style.display = 'inline-flex';
        } catch (err) {
            console.log('Camera access denied or not available, using file input only');
            document.getElementById('cameraVideo').style.display = 'none';
            document.getElementById('captureBtn').style.display = 'none';
        }
    }

    closeCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const video = document.getElementById('cameraVideo');
        video.srcObject = null;
        video.style.display = 'block';
        this.hideModal('cameraModal');
    }

    async capturePhoto() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        await db.createPhoto({
            roomId: this.currentRoomId,
            dataUrl: dataUrl
        });
        
        this.closeCamera();
        this.showToast('Photo captured successfully!');
        await this.loadPhotos(this.currentRoomId);
    }

    async handleFileInput(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            await db.createPhoto({
                roomId: this.currentRoomId,
                dataUrl: event.target.result
            });
            
            this.closeCamera();
            this.showToast('Photo added successfully!');
            await this.loadPhotos(this.currentRoomId);
        };
        reader.readAsDataURL(file);
    }

    async deletePhoto(photoId) {
        if (confirm('Are you sure you want to delete this photo?')) {
            await db.deletePhotoWithRelatedData(photoId);
            this.showToast('Photo deleted');
            await this.loadPhotos(this.currentRoomId);
        }
    }

    async syncToGoogleDrive() {
        if (!navigator.onLine) {
            this.showToast('You are offline. Please connect to sync.');
            return;
        }
        
        // Call the sync module
        await syncManager.syncAll();
    }
}

// Initialize app
const app = new App();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
