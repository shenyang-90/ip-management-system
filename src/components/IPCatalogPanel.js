/* IPCatalogPanel.js - IP Catalog side panel UI */

import { XCIParser } from '../parsers/XCIParser.js';
import { IPXACTParser } from '../parsers/IPXACTParser.js';

class IPCatalogPanel {
    constructor(ipCatalogService, app) {
        this.ipCatalogService = ipCatalogService;
        this.app = app;
        this.container = document.getElementById('ip-list');
        this.searchInput = document.getElementById('ip-search');
        this.categoryFilter = document.getElementById('category-filter');
        this.selectedIPId = null;
        
        this.setupEvents();
    }

    setupEvents() {
        this.searchInput.addEventListener('input', () => this.filter());
        this.categoryFilter.addEventListener('change', () => this.filter());
        
        document.getElementById('btn-import-ip').addEventListener('click', () => this.importIP());
    }

    render() {
        // Populate category filter
        const categories = this.ipCatalogService.getCategories();
        this.categoryFilter.innerHTML = '<option value="">All Categories</option>';
        for (const cat of categories) {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categoryFilter.appendChild(option);
        }
        
        this.filter();
    }

    filter() {
        const query = this.searchInput.value.trim();
        const category = this.categoryFilter.value;
        const ips = this.ipCatalogService.search(query, category || null, 'active');
        this.renderIPList(ips);
    }

    renderIPList(ips) {
        this.container.innerHTML = '';
        
        if (ips.length === 0) {
            this.container.innerHTML = '<div class="placeholder-text">No IP found</div>';
            return;
        }
        
        for (const ip of ips) {
            const item = document.createElement('div');
            item.className = 'ip-item' + (ip.id === this.selectedIPId ? ' selected' : '');
            item.draggable = true;
            item.dataset.ipId = ip.id;
            
            item.innerHTML = `
                <div class="ip-item-name">${ip.display_name || ip.name}</div>
                <div class="ip-item-vlnv">${ip.vlnv}</div>
                <div class="ip-item-category">${ip.category || 'Uncategorized'}</div>
            `;
            
            // Click to select
            item.addEventListener('click', () => {
                this.selectedIPId = ip.id;
                this.renderIPList(ips); // Re-render to update selection
                this.showIPDetail(ip);
            });
            
            // Double click to add to canvas
            item.addEventListener('dblclick', () => {
                this.app.addIPToCanvas(ip, 100, 100);
            });
            
            // Drag to canvas
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('ipId', ip.id);
            });
            
            this.container.appendChild(item);
        }
    }

    importIP() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.xci,.xml';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const ext = file.name.split('.').pop().toLowerCase();
                
                let data;
                
                if (ext === 'json') {
                    data = JSON.parse(text);
                    // Validate IP format
                    if (!data.name || !data.vendor || !data.library || !data.version) {
                        alert('Invalid IP JSON: missing required fields (name, vendor, library, version)');
                        return;
                    }
                } else if (ext === 'xci') {
                    const parser = new XCIParser();
                    data = parser.parse(text);
                    if (!data.name || !data.vendor || !data.library || !data.version) {
                        alert('Invalid XCI file: missing required fields (name, vendor, library, version)');
                        return;
                    }
                } else if (ext === 'xml') {
                    // Try IP-XACT first, then fallback to XCI
                    try {
                        const parser = new IPXACTParser();
                        data = parser.parse(text);
                    } catch (ipxactError) {
                        // Fallback to XCI parser
                        try {
                            const parser = new XCIParser();
                            data = parser.parse(text);
                        } catch (xciError) {
                            alert('Failed to parse XML: neither valid IP-XACT nor XCI format.\nIP-XACT: ' + ipxactError.message + '\nXCI: ' + xciError.message);
                            return;
                        }
                    }
                    if (!data.name || !data.vendor || !data.library || !data.version) {
                        alert('Invalid IP-XACT/XCI file: missing required fields (name, vendor, library, version)');
                        return;
                    }
                } else {
                    alert('Unsupported file format: ' + ext);
                    return;
                }
                
                // Check for duplicate VLNV
                const existing = this.ipCatalogService.getByVLNV(data.vendor, data.library, data.name, data.version);
                if (existing) {
                    if (!confirm(`IP ${data.vendor}:${data.library}:${data.name}:${data.version} already exists. Overwrite?`)) {
                        return;
                    }
                    this.ipCatalogService.delete(existing.id);
                }
                
                // Create IP
                const ip = this.ipCatalogService.create(data);
                await this.ipCatalogService.save();
                this.render();
                this.app.updateStatus(`Imported IP: ${ip.vlnv} (${ext.toUpperCase()})`);
            } catch (error) {
                console.error('Error importing IP:', error);
                alert('Failed to import IP: ' + error.message);
            }
        };
        input.click();
    }

    showIPDetail(ip) {
        const modal = document.getElementById('ip-detail-modal');
        const title = document.getElementById('modal-ip-name');
        const content = document.getElementById('modal-ip-content');
        
        title.textContent = ip.display_name || ip.name;
        
        let html = `
            <div class="properties-group">
                <h4>Basic Info</h4>
                <div class="property-row"><span class="property-label">VLNV:</span><span class="property-value">${ip.vlnv}</span></div>
                <div class="property-row"><span class="property-label">Version:</span><span class="property-value">${ip.version}</span></div>
                <div class="property-row"><span class="property-label">Status:</span><span class="property-value">${ip.status}</span></div>
                <div class="property-row"><span class="property-label">Category:</span><span class="property-value">${ip.category || '-'}</span></div>
            </div>
        `;
        
        if (ip.description) {
            html += `<div class="properties-group"><h4>Description</h4><p style="font-size:12px;color:#ccc;padding:0 8px;">${ip.description}</p></div>`;
        }
        
        if (ip.interfaces && ip.interfaces.length > 0) {
            html += `<div class="properties-group"><h4>Interfaces (${ip.interfaces.length})</h4>`;
            for (const iface of ip.interfaces) {
                html += `<div class="property-row"><span class="property-label">${iface.name}</span><span class="property-value">${iface.type} (${iface.role})</span></div>`;
            }
            html += '</div>';
        }
        
        if (ip.parameters && ip.parameters.length > 0) {
            html += `<div class="properties-group"><h4>Parameters (${ip.parameters.length})</h4>`;
            for (const param of ip.parameters) {
                html += `<div class="property-row"><span class="property-label">${param.display_name || param.name}</span><span class="property-value">${param.type} = ${param.default}</span></div>`;
            }
            html += '</div>';
        }
        
        if (ip.register_map && ip.register_map.registers && ip.register_map.registers.length > 0) {
            html += `<div class="properties-group"><h4>Registers (${ip.register_map.registers.length})</h4>`;
            html += `<table class="register-table"><thead><tr><th>Name</th><th>Offset</th><th>Width</th><th>Access</th></tr></thead><tbody>`;
            for (const reg of ip.register_map.registers) {
                html += `<tr><td>${reg.name}</td><td>${reg.offset}</td><td>${reg.width}</td><td>${reg.access}</td></tr>`;
            }
            html += '</tbody></table></div>';
        }
        
        content.innerHTML = html;
        modal.classList.remove('hidden');
    }
}

export { IPCatalogPanel };
