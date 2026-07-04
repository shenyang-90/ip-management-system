// IP Management System - Main Entry Point
// Mode 1: Local File Web Page

import { IPEntity } from './models/IPEntity.js';
import { BlockDesign } from './models/BlockDesign.js';
import { FileStorage } from './services/FileStorage.js';
import { IPCatalogService } from './services/IPCatalogService.js';
import { BlockDesignService, ConnectionService } from './services/BlockDesignService.js';
import { CanvasRenderer } from './components/CanvasRenderer.js';
import { IPCatalogPanel } from './components/IPCatalogPanel.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { PackageIPWizard } from './components/PackageIPWizard.js';
import { ValidationReportPanel } from './components/ValidationReportPanel.js';
import { SignalConnectionDialog } from './components/SignalConnectionDialog.js';

class App {
    constructor() {
        this.fileStorage = new FileStorage();
        this.ipCatalogService = new IPCatalogService(this.fileStorage);
        this.blockDesignService = new BlockDesignService(this.fileStorage, this.ipCatalogService);
        this.connectionService = new ConnectionService(this.blockDesignService);
        this.canvasRenderer = null;
        this.ipCatalogPanel = null;
        this.propertiesPanel = null;
        this.packageIPWizard = null;
        this.currentDesign = null;
    }

    async initialize() {
        // Initialize IP Catalog
        await this.ipCatalogService.initialize();
        
        // Initialize UI Components
        this.ipCatalogPanel = new IPCatalogPanel(this.ipCatalogService, this);
        this.propertiesPanel = new PropertiesPanel(this);
        this.canvasRenderer = new CanvasRenderer(this);
        this.packageIPWizard = new PackageIPWizard(this);
        this.validationReportPanel = new ValidationReportPanel(this);
        this.signalConnectionDialog = new SignalConnectionDialog(this);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render IP Catalog
        this.ipCatalogPanel.render();
        
        // Try to load default design
        await this.loadDefaultDesign();
        
        this.updateStatus('Ready');
        
        // Expose for debugging and allow the page to detect successful init
        window.app = this;
        window._appInitialized = true;
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('btn-new-design').addEventListener('click', () => this.showNewDesignModal());
        document.getElementById('btn-open-design').addEventListener('click', () => this.openDesign());
        document.getElementById('btn-save-design').addEventListener('click', () => this.saveDesign());
        document.getElementById('btn-export-tcl').addEventListener('click', () => this.exportTcl());
        document.getElementById('btn-validate').addEventListener('click', () => this.validateDesign());
        document.getElementById('btn-signal-connect').addEventListener('click', () => this.signalConnectionDialog.open());
        document.getElementById('btn-auto-connect').addEventListener('click', () => this.autoConnect());

        // Canvas controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.canvasRenderer.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.canvasRenderer.zoomOut());
        document.getElementById('btn-fit').addEventListener('click', () => this.canvasRenderer.fitToScreen());

        // New design modal
        document.getElementById('btn-create-design').addEventListener('click', () => this.createNewDesign());

        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });
    }

    async loadDefaultDesign() {
        try {
            const design = await this.blockDesignService.loadDesign('design_1');
            if (design) {
                this.currentDesign = design;
                this.canvasRenderer.setDesign(design);
                this.updateStatus(`Loaded design: ${design.name}`);
                this.updateCounts();
                this.propertiesPanel.renderDesignProperties(design);
            }
        } catch (error) {
            console.warn('No default design found, creating empty design');
            this.currentDesign = this.blockDesignService.create('design_1', 'New Block Design');
            this.canvasRenderer.setDesign(this.currentDesign);
        }
    }

    showNewDesignModal() {
        document.getElementById('new-design-modal').classList.remove('hidden');
    }

    createNewDesign() {
        const name = document.getElementById('new-design-name').value.trim();
        const desc = document.getElementById('new-design-desc').value.trim();
        
        if (!name) {
            alert('Please enter a design name');
            return;
        }
        
        this.currentDesign = this.blockDesignService.create(name, desc);
        this.canvasRenderer.setDesign(this.currentDesign);
        this.updateStatus(`Created new design: ${name}`);
        this.updateCounts();
        this.propertiesPanel.renderDesignProperties(this.currentDesign);
        
        this.closeModal(document.getElementById('new-design-modal'));
    }

    async openDesign() {
        // For File System Access API (Chrome)
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await this.fileStorage.pickDirectory();
                if (!dirHandle) return;
                
                // Look for design files in the directory
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const file = await entry.getFile();
                        const text = await file.text();
                        const designData = JSON.parse(text);
                        if (designData.cells && designData.connections) {
                            this.currentDesign = BlockDesign.fromJSON(designData);
                            this.blockDesignService.currentDesign = this.currentDesign;
                            this.canvasRenderer.setDesign(this.currentDesign);
                            this.updateStatus(`Loaded design: ${this.currentDesign.name}`);
                            this.updateCounts();
                            this.propertiesPanel.renderDesignProperties(this.currentDesign);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error('Error opening design:', error);
                this.updateStatus('Error opening design');
            }
        } else {
            // Fallback: use file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const designData = JSON.parse(text);
                    this.currentDesign = BlockDesign.fromJSON(designData);
                    this.blockDesignService.currentDesign = this.currentDesign;
                    this.canvasRenderer.setDesign(this.currentDesign);
                    this.updateStatus(`Loaded design: ${this.currentDesign.name}`);
                    this.updateCounts();
                    this.propertiesPanel.renderDesignProperties(this.currentDesign);
                } catch (error) {
                    console.error('Error parsing design file:', error);
                    alert('Invalid design file');
                }
            };
            input.click();
        }
    }

    async saveDesign() {
        if (!this.currentDesign) {
            alert('No design to save');
            return;
        }
        
        const success = await this.blockDesignService.save();
        if (success) {
            this.updateStatus(`Saved design: ${this.currentDesign.name}`);
        } else {
            this.updateStatus('Error saving design');
        }
    }

    async exportTcl() {
        if (!this.currentDesign) {
            alert('No design to export');
            return;
        }
        
        const tcl = this.fileStorage.exportDesignAsTcl(this.currentDesign.toJSON(), this.ipCatalogService);
        
        // Download as file
        const blob = new Blob([tcl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentDesign.name}.tcl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus(`Exported Tcl: ${this.currentDesign.name}.tcl`);
    }

    validateDesign() {
        if (!this.currentDesign) return;
        this.validationReportPanel.runValidation();
    }

    addIPToCanvas(ipEntity, x, y) {
        if (!this.currentDesign) {
            alert('Please create a new design first');
            return;
        }
        
        const instanceName = this.generateUniqueInstanceName(ipEntity.name);
        const cell = this.blockDesignService.addIPInstance(
            ipEntity.id,
            instanceName,
            x,
            y,
            {},
            {}
        );
        
        if (cell) {
            this.canvasRenderer.render();
            this.updateCounts();
            this.selectCell(cell.id);
            this.updateStatus(`Added ${ipEntity.name} as ${instanceName}`);
        }
    }

    generateUniqueInstanceName(baseName) {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return `${baseName}_0`;
        
        let index = 0;
        let name = `${baseName}_0`;
        while (design.cells.some(c => c.instance_name === name)) {
            index++;
            name = `${baseName}_${index}`;
        }
        return name;
    }

    selectCell(cellId) {
        this.canvasRenderer.selectCell(cellId);
        const cell = this.blockDesignService.getCell(cellId);
        if (cell) {
            this.propertiesPanel.renderCellProperties(cell, this.ipCatalogService);
        }
    }

    deleteSelectedCell() {
        const selectedId = this.canvasRenderer.getSelectedCellId();
        if (!selectedId) return;
        
        if (confirm('Delete this cell and its connections?')) {
            this.blockDesignService.removeCell(selectedId);
            this.canvasRenderer.selectCell(null);
            this.canvasRenderer.render();
            this.updateCounts();
            this.propertiesPanel.clear();
        }
    }

    deleteSelectedConnection() {
        const selectedId = this.canvasRenderer.getSelectedConnectionId();
        if (!selectedId) return;
        
        if (confirm('Delete this connection?')) {
            this.connectionService.disconnect(selectedId);
            this.canvasRenderer.selectConnection(null);
            this.canvasRenderer.render();
            this.updateCounts();
            this.propertiesPanel.clear();
        }
    }

    createConnection(sourceCellId, sourceInterface, targetCellId, targetInterface) {
        if (!this.currentDesign) return;
        try {
            const conn = this.connectionService.connectInterfaces(
                sourceCellId, sourceInterface,
                targetCellId, targetInterface
            );
            if (conn) {
                this.canvasRenderer.render();
                this.updateCounts();
                this.updateStatus(`Connected: ${sourceInterface} → ${targetInterface}`);
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus(`Connection failed: ${error.message}`);
        }
    }

    autoConnect() {
        if (!this.currentDesign) return;
        const selectedId = this.canvasRenderer.getSelectedCellId();
        if (selectedId) {
            let totalConnections = 0;
            for (const otherCell of this.currentDesign.cells) {
                if (otherCell.id === selectedId) continue;
                const connections = this.connectionService.autoConnect(selectedId, otherCell.id);
                totalConnections += connections.length;
            }
            if (totalConnections > 0) {
                this.canvasRenderer.render();
                this.updateCounts();
                this.updateStatus(`Auto-connected ${totalConnections} interface(s)`);
            } else {
                this.updateStatus('No compatible interfaces found for auto-connect');
            }
        } else {
            alert('Please select a cell first, then click Auto-Connect');
        }
    }

    updateStatus(text) {
        document.getElementById('status-text').textContent = text;
    }

    updateCounts() {
        const design = this.blockDesignService.getCurrentDesign();
        if (!design) return;
        
        document.getElementById('cell-count').textContent = `Cells: ${design.cells.length}`;
        document.getElementById('connection-count').textContent = `Connections: ${design.connections.length}`;
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Initialize app when DOM is ready
async function init() {
    const app = new App();
    await app.initialize();
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            if (app.canvasRenderer.getSelectedConnectionId()) {
                app.deleteSelectedConnection();
            } else if (app.canvasRenderer.getSelectedCellId()) {
                app.deleteSelectedCell();
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { App };
