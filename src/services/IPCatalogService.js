import { IPEntity } from '../models/IPEntity.js';

// IP Catalog Service - manages IP entity catalog
class IPCatalogService {
    constructor(fileStorage) {
        this.fileStorage = fileStorage;
        this.catalog = null;
        this.ips = [];
    }

    async initialize() {
        const data = await this.fileStorage.loadIPCatalog();
        this.catalog = data;
        this.ips = data.ips.map(ip => IPEntity.fromJSON(ip));
    }

    getAll() {
        return this.ips;
    }

    getById(id) {
        return this.ips.find(ip => ip.id === id) || null;
    }

    getByVLNV(vendor, library, name, version) {
        return this.ips.find(ip => 
            ip.vendor === vendor && 
            ip.library === library && 
            ip.name === name && 
            ip.version === version
        ) || null;
    }

    search(query, category = null, status = null) {
        let results = this.ips;
        
        if (query) {
            const lowerQuery = query.toLowerCase();
            results = results.filter(ip => 
                ip.name.toLowerCase().includes(lowerQuery) ||
                ip.display_name.toLowerCase().includes(lowerQuery) ||
                ip.description.toLowerCase().includes(lowerQuery)
            );
        }
        
        if (category) {
            results = results.filter(ip => ip.category === category);
        }
        
        if (status) {
            results = results.filter(ip => ip.status === status);
        }
        
        return results;
    }

    create(data) {
        const ip = new IPEntity(data);
        this.ips.push(ip);
        return ip;
    }

    update(id, updates) {
        const ip = this.getById(id);
        if (!ip) return null;
        
        Object.keys(updates).forEach(key => {
            if (key in ip) {
                ip[key] = updates[key];
            }
        });
        
        return ip;
    }

    delete(id) {
        const index = this.ips.findIndex(ip => ip.id === id);
        if (index === -1) return false;
        this.ips.splice(index, 1);
        return true;
    }

    updateInterfaces(id, interfaces) {
        return this.update(id, { interfaces });
    }

    updateParameters(id, parameters) {
        return this.update(id, { parameters });
    }

    updateRegisterMap(id, registerMap) {
        return this.update(id, { register_map: registerMap });
    }

    getCategories() {
        const categories = new Set();
        this.ips.forEach(ip => {
            if (ip.category) categories.add(ip.category);
        });
        return Array.from(categories).sort();
    }

    async save() {
        this.catalog.ips = this.ips.map(ip => ip.toJSON());
        return await this.fileStorage.saveIPCatalog(this.catalog);
    }
}

export { IPCatalogService };
