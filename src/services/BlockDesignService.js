import { BlockDesign, BDCell, BDConnection, AddressRegion } from '../models/BlockDesign.js';

// Block Design Service - manages canvas design
class BlockDesignService {
    constructor(fileStorage, ipCatalogService) {
        this.fileStorage = fileStorage;
        this.ipCatalogService = ipCatalogService;
        this.currentDesign = null;
    }

    async loadDesign(name) {
        const data = await this.fileStorage.loadDesign(name);
        if (!data) return null;
        this.currentDesign = BlockDesign.fromJSON(data);
        return this.currentDesign;
    }

    create(name, description = '') {
        this.currentDesign = new BlockDesign({
            name,
            description,
            status: 'editing'
        });
        return this.currentDesign;
    }

    getCurrentDesign() {
        return this.currentDesign;
    }

    addIPInstance(ipEntityId, instanceName, x = 0, y = 0, parameterOverrides = {}, registerAddressMap = {}) {
        if (!this.currentDesign) return null;
        
        const ipEntity = this.ipCatalogService.getById(ipEntityId);
        if (!ipEntity) return null;
        
        const cell = new BDCell({
            ip_entity_id: ipEntityId,
            cell_type: 'ip_instance',
            instance_name: instanceName,
            position_x: x,
            position_y: y,
            parameter_overrides: parameterOverrides,
            register_address_map: registerAddressMap
        });
        
        this.currentDesign.cells.push(cell);
        return cell;
    }

    addModuleReference(instanceName, modulePath, x = 0, y = 0) {
        if (!this.currentDesign) return null;
        
        const cell = new BDCell({
            cell_type: 'module_reference',
            instance_name: instanceName,
            module_reference: modulePath,
            position_x: x,
            position_y: y
        });
        
        this.currentDesign.cells.push(cell);
        return cell;
    }

    removeCell(cellId) {
        if (!this.currentDesign) return false;
        
        const index = this.currentDesign.cells.findIndex(c => c.id === cellId);
        if (index === -1) return false;
        
        // Remove associated connections
        this.currentDesign.connections = this.currentDesign.connections.filter(
            c => c.source_cell_id !== cellId && c.target_cell_id !== cellId
        );
        
        // Remove associated address regions
        this.currentDesign.address_regions = this.currentDesign.address_regions.filter(
            a => a.cell_id !== cellId
        );
        
        this.currentDesign.cells.splice(index, 1);
        return true;
    }

    moveCell(cellId, x, y) {
        if (!this.currentDesign) return null;
        const cell = this.currentDesign.cells.find(c => c.id === cellId);
        if (!cell) return null;
        cell.position_x = x;
        cell.position_y = y;
        return cell;
    }

    getCell(cellId) {
        if (!this.currentDesign) return null;
        return this.currentDesign.cells.find(c => c.id === cellId) || null;
    }

    getCells() {
        if (!this.currentDesign) return [];
        return this.currentDesign.cells;
    }

    getCellByName(name) {
        if (!this.currentDesign) return null;
        return this.currentDesign.cells.find(c => c.instance_name === name) || null;
    }

    async save() {
        if (!this.currentDesign) return false;
        return await this.fileStorage.saveDesign(this.currentDesign.toJSON());
    }

    validateAddressRegions() {
        if (!this.currentDesign) return { valid: true, errors: [] };
        
        const errors = [];
        const regions = this.currentDesign.address_regions;
        
        // Check for overlapping address regions
        for (let i = 0; i < regions.length; i++) {
            for (let j = i + 1; j < regions.length; j++) {
                const r1 = regions[i];
                const r2 = regions[j];
                
                // Overlap condition
                if (r1.base_address <= r2.high_address && r1.high_address >= r2.base_address) {
                    const cell1 = this.currentDesign.cells.find(c => c.id === r1.cell_id);
                    const cell2 = this.currentDesign.cells.find(c => c.id === r2.cell_id);
                    const name1 = cell1 ? cell1.instance_name : r1.cell_id;
                    const name2 = cell2 ? cell2.instance_name : r2.cell_id;
                    
                    errors.push({
                        type: 'error',
                        category: 'address_conflict',
                        message: `Address conflict: ${name1} [0x${r1.base_address.toString(16).toUpperCase()} - 0x${r1.high_address.toString(16).toUpperCase()}] overlaps with ${name2} [0x${r2.base_address.toString(16).toUpperCase()} - 0x${r2.high_address.toString(16).toUpperCase()}]`
                    });
                }
            }
        }
        
        // Check for unassigned cells with interfaces that need address mapping
        for (const cell of this.currentDesign.cells) {
            const interfaces = this.getCellInterfaces(cell.id);
            for (const iface of interfaces) {
                if (iface.role === 'slave' && iface.type === 'axi4_lite') {
                    const hasRegion = regions.some(r => r.cell_id === cell.id && r.interface_name === iface.name);
                    if (!hasRegion) {
                        errors.push({
                            type: 'warning',
                            category: 'missing_address_region',
                            message: `Missing address region for ${cell.instance_name}/${iface.name}`
                        });
                    }
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }

    addAddressRegion(cellId, interfaceName, baseAddress, size) {
        if (!this.currentDesign) return { success: false, error: 'No design' };

        const base = this._parseAddress(baseAddress);
        const regionSize = parseInt(size, 10);
        if (isNaN(base) || isNaN(regionSize) || regionSize <= 0) {
            return { success: false, error: 'Invalid base address or size' };
        }

        const high = base + regionSize - 1;

        // Check for conflicts before adding
        const tempRegions = [...this.currentDesign.address_regions];
        const cell = this.getCell(cellId);
        const cellName = cell ? cell.instance_name : cellId;
        const newRegion = new AddressRegion({
            cell_id: cellId,
            interface_name: interfaceName,
            base_address: base,
            high_address: high,
            size: regionSize,
            address_space: 'Data'
        });
        tempRegions.push(newRegion);

        // Validate using temp regions
        const originalRegions = this.currentDesign.address_regions;
        this.currentDesign.address_regions = tempRegions;
        const validation = this.validateAddressRegions();
        this.currentDesign.address_regions = originalRegions;

        if (validation.errors.some(e => e.type === 'error')) {
            return { success: false, error: validation.errors.find(e => e.type === 'error').message };
        }

        // Build register map with absolute addresses
        const ipEntity = cell ? this.ipCatalogService.getById(cell.ip_entity_id) : null;
        if (ipEntity && ipEntity.register_map && ipEntity.register_map.registers) {
            const registers = [];
            for (const reg of ipEntity.register_map.registers) {
                const offset = this._parseAddress(reg.offset);
                registers.push({
                    ...reg,
                    absolute_address: base + offset
                });
            }
            newRegion.register_map = { registers };

            // Update cell register_address_map
            if (!cell.register_address_map) cell.register_address_map = {};
            for (const reg of registers) {
                cell.register_address_map[reg.name] = reg.absolute_address;
            }
        }

        this.currentDesign.address_regions.push(newRegion);
        return { success: true, region: newRegion };
    }

    updateAddressRegion(regionId, baseAddress, size) {
        if (!this.currentDesign) return { success: false, error: 'No design' };

        const regionIndex = this.currentDesign.address_regions.findIndex(r => r.id === regionId);
        if (regionIndex === -1) return { success: false, error: 'Region not found' };

        const base = this._parseAddress(baseAddress);
        const regionSize = parseInt(size, 10);
        if (isNaN(base) || isNaN(regionSize) || regionSize <= 0) {
            return { success: false, error: 'Invalid base address or size' };
        }

        const high = base + regionSize - 1;
        const region = this.currentDesign.address_regions[regionIndex];

        // Check conflicts with temporary update
        const tempRegions = [...this.currentDesign.address_regions];
        tempRegions[regionIndex] = new AddressRegion({
            ...region,
            base_address: base,
            high_address: high,
            size: regionSize
        });
        const originalRegions = this.currentDesign.address_regions;
        this.currentDesign.address_regions = tempRegions;
        const validation = this.validateAddressRegions();
        this.currentDesign.address_regions = originalRegions;

        if (validation.errors.some(e => e.type === 'error')) {
            return { success: false, error: validation.errors.find(e => e.type === 'error').message };
        }

        region.base_address = base;
        region.high_address = high;
        region.size = regionSize;

        // Rebuild register map
        const cell = this.getCell(region.cell_id);
        const ipEntity = cell ? this.ipCatalogService.getById(cell.ip_entity_id) : null;
        if (ipEntity && ipEntity.register_map && ipEntity.register_map.registers) {
            const registers = [];
            for (const reg of ipEntity.register_map.registers) {
                const offset = this._parseAddress(reg.offset);
                registers.push({
                    ...reg,
                    absolute_address: base + offset
                });
            }
            region.register_map = { registers };

            if (!cell.register_address_map) cell.register_address_map = {};
            for (const reg of registers) {
                cell.register_address_map[reg.name] = reg.absolute_address;
            }
        }

        return { success: true, region };
    }

    removeAddressRegion(regionId) {
        if (!this.currentDesign) return false;
        const index = this.currentDesign.address_regions.findIndex(r => r.id === regionId);
        if (index === -1) return false;
        this.currentDesign.address_regions.splice(index, 1);
        return true;
    }

    getAddressRegionsForCell(cellId) {
        if (!this.currentDesign) return [];
        return this.currentDesign.address_regions.filter(r => r.cell_id === cellId);
    }

    _parseAddress(value) {
        if (!value) return 0;
        const trimmed = String(value).trim();
        if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
            return parseInt(trimmed, 16);
        }
        return parseInt(trimmed, 10) || 0;
    }

    updateStatus(status) {
        if (!this.currentDesign) return null;
        this.currentDesign.status = status;
        return this.currentDesign;
    }

    // Get all interfaces of a cell (from IP entity definition)
    getCellInterfaces(cellId) {
        const cell = this.getCell(cellId);
        if (!cell || !cell.ip_entity_id) return [];
        
        const ipEntity = this.ipCatalogService.getById(cell.ip_entity_id);
        if (!ipEntity) return [];
        
        return ipEntity.interfaces || [];
    }

    // Get available interfaces for connection (matching role compatibility)
    getAvailableInterfaces(cellId, role = null) {
        const interfaces = this.getCellInterfaces(cellId);
        if (!role) return interfaces;
        return interfaces.filter(i => i.role === role);
    }
}

// Connection Service - manages connections in Block Design
class ConnectionService {
    constructor(blockDesignService) {
        this.blockDesignService = blockDesignService;
    }

    connectInterfaces(sourceCellId, sourceInterface, targetCellId, targetInterface) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return null;
        
        const sourceCell = this.blockDesignService.getCell(sourceCellId);
        const targetCell = this.blockDesignService.getCell(targetCellId);
        if (!sourceCell || !targetCell) {
            throw new Error('Source or target cell not found');
        }
        
        const conn = new BDConnection({
            source_cell_id: sourceCellId,
            source_interface: sourceInterface,
            target_cell_id: targetCellId,
            target_interface: targetInterface,
            connection_type: 'interface',
            status: 'valid'
        });
        
        design.connections.push(conn);
        return conn;
    }

    connectSignals(sourceCellId, sourceSignal, targetCellId, targetSignal) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return null;
        
        const conn = new BDConnection({
            source_cell_id: sourceCellId,
            source_signal: sourceSignal,
            target_cell_id: targetCellId,
            target_signal: targetSignal,
            connection_type: 'signal',
            status: 'valid'
        });
        
        design.connections.push(conn);
        return conn;
    }

    disconnect(connectionId) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return false;
        
        const index = design.connections.findIndex(c => c.id === connectionId);
        if (index === -1) return false;
        design.connections.splice(index, 1);
        return true;
    }

    getConnections() {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return [];
        return design.connections;
    }

    getCellConnections(cellId) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return [];
        return design.connections.filter(
            c => c.source_cell_id === cellId || c.target_cell_id === cellId
        );
    }

    // Auto-connect compatible interfaces between two cells
    autoConnect(sourceCellId, targetCellId) {
        const sourceInterfaces = this.blockDesignService.getAvailableInterfaces(sourceCellId, 'master');
        const targetInterfaces = this.blockDesignService.getAvailableInterfaces(targetCellId, 'slave');
        
        const connections = [];
        
        for (const srcIf of sourceInterfaces) {
            for (const tgtIf of targetInterfaces) {
                if (this._isCompatible(srcIf, tgtIf)) {
                    const conn = this.connectInterfaces(
                        sourceCellId, srcIf.name,
                        targetCellId, tgtIf.name
                    );
                    connections.push(conn);
                }
            }
        }
        
        return connections;
    }

    _isCompatible(srcIf, tgtIf) {
        // Check if interfaces are compatible for connection
        // Roles must be complementary (master/slave)
        if (srcIf.role === 'master' && tgtIf.role !== 'slave') return false;
        if (srcIf.role === 'slave' && tgtIf.role !== 'master') return false;

        // Types must either match or be in an allowed protocol-downgrade pair.
        // AXI4 master can drive AXI4-Lite slave (e.g. through an interconnect).
        const compatibleTypes = {
            'axi4': ['axi4', 'axi4_lite'],
            'axi4_lite': ['axi4_lite'],
            'axi4_stream': ['axi4_stream'],
            'clock': ['clock'],
            'reset': ['reset']
        };
        const allowedTargets = compatibleTypes[srcIf.type];
        return allowedTargets ? allowedTargets.includes(tgtIf.type) : srcIf.type === tgtIf.type;
    }

    validateConnection(connectionId) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return null;
        
        const conn = design.connections.find(c => c.id === connectionId);
        if (!conn) return null;
        
        const messages = [];
        
        // Check if cells exist
        const sourceCell = this.blockDesignService.getCell(conn.source_cell_id);
        const targetCell = this.blockDesignService.getCell(conn.target_cell_id);
        if (!sourceCell) messages.push({ type: 'error', message: 'Source cell not found' });
        if (!targetCell) messages.push({ type: 'error', message: 'Target cell not found' });
        
        // Check interface compatibility
        if (sourceCell && targetCell && conn.connection_type === 'interface') {
            const sourceIf = this.blockDesignService.getCellInterfaces(conn.source_cell_id)
                .find(i => i.name === conn.source_interface);
            const targetIf = this.blockDesignService.getCellInterfaces(conn.target_cell_id)
                .find(i => i.name === conn.target_interface);
            
            if (!sourceIf) messages.push({ type: 'error', message: 'Source interface not found' });
            if (!targetIf) messages.push({ type: 'error', message: 'Target interface not found' });
            if (sourceIf && targetIf && !this._isCompatible(sourceIf, targetIf)) {
                messages.push({ type: 'error', message: 'Incompatible interfaces' });
            }
        }
        
        conn.status = messages.length === 0 ? 'valid' : 'invalid';
        conn.validation_messages = messages;
        return conn;
    }

    validateAll() {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return [];
        return design.connections.map(c => this.validateConnection(c.id));
    }
}

export { BlockDesignService, ConnectionService };
