// File Storage service - handles local JSON file I/O
class FileStorage {
    constructor() {
        this.ipCatalogPath = 'data/ip_catalog.json';
        this.interfaceTemplatesPath = 'data/interface_templates.json';
        this.designsPath = 'data/designs/';
        this.currentDirHandle = null;
    }

    async loadIPCatalog() {
        try {
            const response = await fetch(this.ipCatalogPath);
            if (!response.ok) throw new Error('Failed to load IP catalog');
            return await response.json();
        } catch (error) {
            console.error('Error loading IP catalog:', error);
            return { version: '1.0', ips: [] };
        }
    }

    async saveIPCatalog(data) {
        try {
            const jsonStr = JSON.stringify(data, null, 2);
            await this._saveToFile(this.ipCatalogPath, jsonStr);
            return true;
        } catch (error) {
            console.error('Error saving IP catalog:', error);
            return false;
        }
    }

    async loadInterfaceTemplates() {
        try {
            const response = await fetch(this.interfaceTemplatesPath);
            if (!response.ok) throw new Error('Failed to load interface templates');
            return await response.json();
        } catch (error) {
            console.error('Error loading interface templates:', error);
            return { version: '1.0', templates: [] };
        }
    }

    async loadDesign(designName) {
        try {
            const response = await fetch(`${this.designsPath}${designName}.json`);
            if (!response.ok) throw new Error(`Failed to load design ${designName}`);
            return await response.json();
        } catch (error) {
            console.error('Error loading design:', error);
            return null;
        }
    }

    async saveDesign(designData) {
        try {
            const jsonStr = JSON.stringify(designData, null, 2);
            await this._saveToFile(`${this.designsPath}${designData.name}.json`, jsonStr);
            return true;
        } catch (error) {
            console.error('Error saving design:', error);
            return false;
        }
    }

    // For File System Access API (Chrome only) - allows writing to local files
    async pickDirectory() {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                this.currentDirHandle = dirHandle;
                return dirHandle;
            } catch (error) {
                console.error('Directory picker cancelled:', error);
                return null;
            }
        }
        return null;
    }

    async writeFileToDirectory(dirHandle, fileName, content) {
        try {
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (error) {
            console.error('Error writing file:', error);
            return false;
        }
    }

    // Write a file preserving relative subdirectories under dirHandle.
    // relativePath e.g. "data/designs/design_1.json"
    async _writeFileWithPath(dirHandle, relativePath, content) {
        const parts = relativePath.split('/').filter(p => p.length > 0);
        const fileName = parts.pop();
        let currentHandle = dirHandle;
        for (const dirName of parts) {
            currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
        }
        return await this.writeFileToDirectory(currentHandle, fileName, content);
    }

    async readFileFromDirectory(dirHandle, fileName) {
        try {
            const fileHandle = await dirHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    }

    // Save content to filePath. In Chrome/Edge with a directory handle,
    // writes directly while preserving relative subdirectories.
    // Otherwise falls back to triggering a Blob download.
    // Returns true if the file was actually written or downloaded;
    // returns false only if the direct write failed unexpectedly.
    async _saveToFile(filePath, content) {
        // If we already have a directory handle, write directly
        if (this.currentDirHandle) {
            try {
                const written = await this._writeFileWithPath(this.currentDirHandle, filePath, content);
                if (!written) {
                    console.error('Direct file write failed, falling back to download');
                    this._triggerDownload(filePath, content);
                }
                return true;
            } catch (error) {
                console.error('Error writing to directory:', error);
                // Fallback to download
                this._triggerDownload(filePath, content);
                return true;
            }
        }

        // Try File System Access API if available
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await this.pickDirectory();
                if (dirHandle) {
                    const written = await this._writeFileWithPath(dirHandle, filePath, content);
                    if (!written) {
                        console.error('Direct file write failed, falling back to download');
                        this._triggerDownload(filePath, content);
                    }
                    return true;
                } else {
                    // User cancelled picker - fallback to download
                    this._triggerDownload(filePath, content);
                    return true;
                }
            } catch (error) {
                console.error('Directory picker failed:', error);
                this._triggerDownload(filePath, content);
                return true;
            }
        }

        // No API available - fallback download
        this._triggerDownload(filePath, content);
        return true;
    }

    _triggerDownload(filePath, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Export design as Tcl script (like Vivado write_bd_tcl)
    exportDesignAsTcl(design, ipCatalogService) {
        let tcl = `# Block Design: ${design.name}\n`;
        tcl += `# Generated by IP Management System\n\n`;
        tcl += `create_bd_design "${design.name}"\n\n`;
        
        // Add cells
        for (const cell of design.cells) {
            tcl += `# Add cell: ${cell.instance_name}\n`;
            if (cell.ip_entity_id && ipCatalogService) {
                const ipEntity = ipCatalogService.getById(cell.ip_entity_id);
                if (ipEntity) {
                    tcl += `create_bd_cell -type ip -vlnv ${ipEntity.vlnv} ${cell.instance_name}\n`;
                } else {
                    tcl += `# create_bd_cell -type ip -vlnv <unknown> ${cell.instance_name}\n`;
                }
            } else if (cell.module_reference) {
                tcl += `create_bd_cell -type hier -reference ${cell.module_reference} ${cell.instance_name}\n`;
            }
            tcl += `set_property location {${cell.position_x} ${cell.position_y}} [get_bd_cells ${cell.instance_name}]\n\n`;
        }
        
        // Add connections
        for (const conn of design.connections) {
            const sourceCell = design.cells.find(c => c.id === conn.source_cell_id);
            const targetCell = design.cells.find(c => c.id === conn.target_cell_id);
            if (sourceCell && targetCell && conn.connection_type === 'interface') {
                tcl += `connect_bd_intf_net [get_bd_intf_pins ${sourceCell.instance_name}/${conn.source_interface}] [get_bd_intf_pins ${targetCell.instance_name}/${conn.target_interface}]\n`;
            } else if (sourceCell && targetCell && conn.connection_type === 'signal') {
                tcl += `connect_bd_net [get_bd_pins ${sourceCell.instance_name}/${conn.source_signal}] [get_bd_pins ${targetCell.instance_name}/${conn.target_signal}]\n`;
            }
        }
        
        // Parameter overrides
        for (const cell of design.cells) {
            if (cell.parameter_overrides && Object.keys(cell.parameter_overrides).length > 0) {
                tcl += `\n# Parameters for ${cell.instance_name}\n`;
                for (const [paramName, value] of Object.entries(cell.parameter_overrides)) {
                    tcl += `set_property -dict [list CONFIG.${paramName} {${value}}] [get_bd_cells ${cell.instance_name}]\n`;
                }
            }
        }
        
        tcl += `\nvalidate_bd_design\n`;
        tcl += `save_bd_design\n`;
        
        return tcl;
    }
}

export { FileStorage };
