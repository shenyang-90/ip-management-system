// Interface Definition model
class InterfaceDefinition {
    constructor(data = {}) {
        this.id = data.id || this._generateUUID();
        this.name = data.name || "";
        this.version = data.version || "1.0";
        this.interface_type = data.interface_type || "custom";
        this.role = data.role || null;
        this.description = data.description || "";
        this.signals = data.signals || [];
        this.metadata = data.metadata || {};
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            version: this.version,
            interface_type: this.interface_type,
            role: this.role,
            description: this.description,
            signals: this.signals,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        return new InterfaceDefinition(json);
    }

    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

export { InterfaceDefinition };
