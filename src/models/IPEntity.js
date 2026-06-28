// IP Entity model
class IPEntity {
    constructor(data = {}) {
        this.id = data.id || this._generateUUID();
        this.vendor = data.vendor || "";
        this.library = data.library || "";
        this.name = data.name || "";
        this.version = data.version || "";
        this.display_name = data.display_name || "";
        this.description = data.description || "";
        this.category = data.category || "";
        this.tags = data.tags || [];
        this.status = data.status || "draft";
        this.compatibility = data.compatibility || {};
        this.interfaces = data.interfaces || [];
        this.parameters = data.parameters || [];
        this.file_groups = data.file_groups || [];
        this.register_map = data.register_map || { registers: [] };
    }

    get vlnv() {
        return `${this.vendor}:${this.library}:${this.name}:${this.version}`;
    }

    toJSON() {
        return {
            id: this.id,
            vendor: this.vendor,
            library: this.library,
            name: this.name,
            version: this.version,
            display_name: this.display_name,
            description: this.description,
            category: this.category,
            tags: this.tags,
            status: this.status,
            compatibility: this.compatibility,
            interfaces: this.interfaces,
            parameters: this.parameters,
            file_groups: this.file_groups,
            register_map: this.register_map
        };
    }

    static fromJSON(json) {
        return new IPEntity(json);
    }

    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

export { IPEntity };
