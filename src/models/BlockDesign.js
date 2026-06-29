import { generateUUID } from '../utils/uuid.js';

// Block Design model
class BlockDesign {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.name = data.name || "unnamed_design";
        this.description = data.description || "";
        this.status = data.status || "editing";
        this.canvas_data = data.canvas_data || {
            viewport: { x: 0, y: 0, zoom: 1.0 },
            grid: true
        };
        this.cells = (data.cells || []).map(c => new BDCell(c));
        this.connections = (data.connections || []).map(c => new BDConnection(c));
        this.address_regions = (data.address_regions || []).map(a => new AddressRegion(a));
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.status,
            canvas_data: this.canvas_data,
            cells: this.cells.map(c => c.toJSON()),
            connections: this.connections.map(c => c.toJSON()),
            address_regions: this.address_regions.map(a => a.toJSON())
        };
    }

    static fromJSON(json) {
        return new BlockDesign(json);
    }
}

class BDCell {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.ip_entity_id = data.ip_entity_id || null;
        this.cell_type = data.cell_type || "ip_instance";
        this.instance_name = data.instance_name || "";
        this.position_x = data.position_x !== undefined ? data.position_x : 0;
        this.position_y = data.position_y !== undefined ? data.position_y : 0;
        this.parameter_overrides = data.parameter_overrides || {};
        this.register_address_map = data.register_address_map || {};
        this.module_reference = data.module_reference || null;
    }

    toJSON() {
        return {
            id: this.id,
            ip_entity_id: this.ip_entity_id,
            cell_type: this.cell_type,
            instance_name: this.instance_name,
            position_x: this.position_x,
            position_y: this.position_y,
            parameter_overrides: this.parameter_overrides,
            register_address_map: this.register_address_map,
            module_reference: this.module_reference
        };
    }

    static fromJSON(json) {
        return new BDCell(json);
    }
}

class BDConnection {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.source_cell_id = data.source_cell_id || "";
        this.source_interface = data.source_interface || null;
        this.source_signal = data.source_signal || null;
        this.target_cell_id = data.target_cell_id || "";
        this.target_interface = data.target_interface || null;
        this.target_signal = data.target_signal || null;
        this.connection_type = data.connection_type || "interface";
        this.status = data.status || "pending";
        this.validation_messages = data.validation_messages || [];
        this.metadata = data.metadata || {};
    }

    toJSON() {
        return {
            id: this.id,
            source_cell_id: this.source_cell_id,
            source_interface: this.source_interface,
            source_signal: this.source_signal,
            target_cell_id: this.target_cell_id,
            target_interface: this.target_interface,
            target_signal: this.target_signal,
            connection_type: this.connection_type,
            status: this.status,
            validation_messages: this.validation_messages,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        return new BDConnection(json);
    }
}

class AddressRegion {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.cell_id = data.cell_id || "";
        this.interface_name = data.interface_name || "";
        this.base_address = data.base_address !== undefined ? data.base_address : 0;
        this.high_address = data.high_address !== undefined ? data.high_address : 0;
        this.size = data.size !== undefined ? data.size : 0;
        this.address_space = data.address_space || null;
        this.register_map = data.register_map || null;
    }

    toJSON() {
        return {
            id: this.id,
            cell_id: this.cell_id,
            interface_name: this.interface_name,
            base_address: this.base_address,
            high_address: this.high_address,
            size: this.size,
            address_space: this.address_space,
            register_map: this.register_map
        };
    }

    static fromJSON(json) {
        return new AddressRegion(json);
    }
}

export { BlockDesign, BDCell, BDConnection, AddressRegion };
