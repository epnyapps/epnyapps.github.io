// IndexedDB wrapper for offline storage
const DB_NAME = 'ConstructionSurveyDB';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Addresses store
                if (!db.objectStoreNames.contains('addresses')) {
                    const addressStore = db.createObjectStore('addresses', { keyPath: 'id', autoIncrement: true });
                    addressStore.createIndex('createdAt', 'createdAt', { unique: false });
                    addressStore.createIndex('synced', 'synced', { unique: false });
                }

                // Floors store
                if (!db.objectStoreNames.contains('floors')) {
                    const floorStore = db.createObjectStore('floors', { keyPath: 'id', autoIncrement: true });
                    floorStore.createIndex('addressId', 'addressId', { unique: false });
                    floorStore.createIndex('synced', 'synced', { unique: false });
                }

                // Rooms store
                if (!db.objectStoreNames.contains('rooms')) {
                    const roomStore = db.createObjectStore('rooms', { keyPath: 'id', autoIncrement: true });
                    roomStore.createIndex('floorId', 'floorId', { unique: false });
                    roomStore.createIndex('synced', 'synced', { unique: false });
                }

                // Photos store
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photoStore.createIndex('roomId', 'roomId', { unique: false });
                    photoStore.createIndex('synced', 'synced', { unique: false });
                }
            };
        });
    }

    // Generic CRUD operations
    async add(storeName, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(data);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        
        // Get all records and filter by index value in JavaScript
        // This is necessary for non-string/number key types like booleans
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const allRecords = request.result;
                const filtered = allRecords.filter(record => record[indexName] === value);
                resolve(filtered);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Specific operations for the app
    async createAddress(data) {
        const address = {
            ...data,
            createdAt: new Date().toISOString(),
            synced: false,
            driveFolderId: null
        };
        return await this.add('addresses', address);
    }

    async createFloor(data) {
        const floor = {
            ...data,
            createdAt: new Date().toISOString(),
            synced: false,
            driveFolderId: null
        };
        return await this.add('floors', floor);
    }

    async createRoom(data) {
        const room = {
            ...data,
            createdAt: new Date().toISOString(),
            synced: false,
            driveFolderId: null
        };
        return await this.add('rooms', room);
    }

    async createPhoto(data) {
        const photo = {
            ...data,
            capturedAt: new Date().toISOString(),
            synced: false,
            driveFileId: null
        };
        return await this.add('photos', photo);
    }

    async getFloorsByAddress(addressId) {
        return await this.getByIndex('floors', 'addressId', addressId);
    }

    async getRoomsByFloor(floorId) {
        return await this.getByIndex('rooms', 'floorId', floorId);
    }

    async getPhotosByRoom(roomId) {
        return await this.getByIndex('photos', 'roomId', roomId);
    }

    async getUnsyncedData() {
        const addresses = await this.getByIndex('addresses', 'synced', false);
        const floors = await this.getByIndex('floors', 'synced', false);
        const rooms = await this.getByIndex('rooms', 'synced', false);
        const photos = await this.getByIndex('photos', 'synced', false);
        
        return { addresses, floors, rooms, photos };
    }

    async markAsSynced(storeName, id, driveId) {
        const item = await this.get(storeName, id);
        if (item) {
            item.synced = true;
            if (storeName === 'photos') {
                item.driveFileId = driveId;
            } else {
                item.driveFolderId = driveId;
            }
            await this.update(storeName, item);
        }
    }

    async deletePhotoWithRelatedData(photoId) {
        await this.delete('photos', photoId);
    }

    async getAddressWithCounts(addressId) {
        const address = await this.get('addresses', addressId);
        const floors = await this.getFloorsByAddress(addressId);
        
        let roomCount = 0;
        let photoCount = 0;
        
        for (const floor of floors) {
            const rooms = await this.getRoomsByFloor(floor.id);
            roomCount += rooms.length;
            
            for (const room of rooms) {
                const photos = await this.getPhotosByRoom(room.id);
                photoCount += photos.length;
            }
        }
        
        return {
            ...address,
            floorCount: floors.length,
            roomCount,
            photoCount
        };
    }
}

// Create global database instance
const db = new Database();
