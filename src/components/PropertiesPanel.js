/* PropertiesPanel.js - Right side properties panel UI */

class PropertiesPanel {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('properties-content');
        this.editingCell = null;
        this.editingParam = null;
        this.setupModalEvents();
    }

    setupModalEvents() {
        const modal = document.getElementById('param-editor-modal');
        const saveBtn = document.getElementById('btn-save-param');
        
        saveBtn.addEventListener('click', () => this.saveParameterEdit());
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.classList.add('hidden'));
        });

        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    clear() {
        this.container.innerHTML = '<div class="placeholder-text">Select an IP instance to view properties</div>';
    }

    renderDesignProperties(design) {
        let html = `
            <div class="properties-group">
                <h4>Block Design</h4>
                <div class="property-row"><span class="property-label">Name:</span><span class="property-value">${design.name}</span></div>
                <div class="property-row"><span class="property-label">Status:</span><span class="property-value">${design.status}</span></div>
                <div class="property-row"><span class="property-label">Cells:</span><span class="property-value">${design.cells.length}</span></div>
                <div class="property-row"><span class="property-label">Connections:</span><span class="property-value">${design.connections.length}</span></div>
            </div>
        `;
        
        if (design.address_regions && design.address_regions.length > 0) {
            html += `<div class="properties-group"><h4>Address Map</h4>`;
            html += `<table class="register-table"><thead><tr><th>Cell</th><th>Interface</th><th>Base</th><th>Size</th></tr></thead><tbody>`;
            for (const region of design.address_regions) {
                const cell = design.cells.find(c => c.id === region.cell_id);
                const cellName = cell ? cell.instance_name : '?';
                html += `<tr><td>${cellName}</td><td>${region.interface_name}</td><td>0x${region.base_address.toString(16).toUpperCase()}</td><td>${region.size}</td></tr>`;
            }
            html += '</tbody></table></div>';
        }
        
        this.container.innerHTML = html;
    }

    renderCellProperties(cell, ipCatalogService) {
        this.editingCell = cell;
        const ipEntity = ipCatalogService.getById(cell.ip_entity_id);
        
        let html = `
            <div class="properties-group">
                <h4>Instance</h4>
                <div class="property-row"><span class="property-label">Name:</span><span class="property-value">${cell.instance_name}</span></div>
                <div class="property-row"><span class="property-label">Type:</span><span class="property-value">${cell.cell_type}</span></div>
                <div class="property-row"><span class="property-label">Position:</span><span class="property-value">(${cell.position_x.toFixed(0)}, ${cell.position_y.toFixed(0)})</span></div>
            </div>
        `;
        
        if (ipEntity) {
            html += `<div class="properties-group"><h4>IP Definition</h4>`;
            html += `<div class="property-row"><span class="property-label">Name:</span><span class="property-value">${ipEntity.name}</span></div>`;
            html += `<div class="property-row"><span class="property-label">VLNV:</span><span class="property-value">${ipEntity.vlnv}</span></div>`;
            html += `<div class="property-row"><span class="property-label">Category:</span><span class="property-value">${ipEntity.category || '-'}</span></div></div>`;
            
            // Parameter overrides (editable)
            if (ipEntity.parameters && ipEntity.parameters.length > 0) {
                html += `<div class="properties-group"><h4>Parameters</h4>`;
                for (const param of ipEntity.parameters) {
                    const overrideValue = cell.parameter_overrides[param.name];
                    const displayValue = overrideValue !== undefined ? overrideValue : param.default;
                    const isOverridden = overrideValue !== undefined;
                    html += `<div class="property-row param-row" data-param-name="${param.name}">`;
                    html += `<span class="property-label" style="color:${isOverridden ? '#569cd6' : '#858585'}">${param.display_name || param.name}</span>`;
                    html += `<span class="property-value param-value">${displayValue}</span>`;
                    html += `<button class="btn-edit-param" data-param-name="${param.name}" title="Edit">&#9998;</button>`;
                    html += `</div>`;
                }
                html += '</div>';
            }
            
            // Interfaces
            if (ipEntity.interfaces && ipEntity.interfaces.length > 0) {
                html += `<div class="properties-group"><h4>Interfaces</h4>`;
                for (const iface of ipEntity.interfaces) {
                    html += `<div class="property-row"><span class="property-label">${iface.name}</span><span class="property-value">${iface.type} (${iface.role})</span></div>`;
                }
                html += '</div>';
            }

            // Address Regions editor
            html += this._renderAddressRegionEditor(cell, ipEntity, ipCatalogService);

            // Connections (interface + signal)
            html += this._renderCellConnections(cell);
            
            // Register address map (instance-level)
            if (cell.register_address_map && Object.keys(cell.register_address_map).length > 0) {
                html += `<div class="properties-group"><h4>Register Addresses</h4>`;
                for (const [regName, addr] of Object.entries(cell.register_address_map)) {
                    html += `<div class="property-row"><span class="property-label">${regName}</span><span class="property-value">0x${addr.toString(16).toUpperCase()}</span></div>`;
                }
                html += '</div>';
            }
            
            // Register definitions (from IP entity)
            if (ipEntity.register_map && ipEntity.register_map.registers && ipEntity.register_map.registers.length > 0) {
                html += `<div class="properties-group"><h4>Registers</h4>`;
                html += `<table class="register-table"><thead><tr><th>Name</th><th>Offset</th><th>Access</th></tr></thead><tbody>`;
                for (const reg of ipEntity.register_map.registers) {
                    html += `<tr><td>${reg.name}</td><td>${reg.offset}</td><td>${reg.access}</td></tr>`;
                }
                html += '</tbody></table></div>';
            }
        } else if (cell.module_reference) {
            html += `<div class="properties-group"><h4>Module Reference</h4>`;
            html += `<div class="property-row"><span class="property-label">Path:</span><span class="property-value">${cell.module_reference}</span></div></div>`;
        }
        
        this.container.innerHTML = html;

        // Attach address region listeners
        this._setupAddressRegionListeners(cell);

        // Attach edit button listeners
        this.container.querySelectorAll('.btn-edit-param').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const paramName = btn.dataset.paramName;
                this.openParamEditor(cell, paramName, ipEntity);
            });
        });
    }

    _renderCellConnections(cell) {
        const design = this.app.blockDesignService.getCurrentDesign();
        if (!design) return '';

        const cellConnections = design.connections.filter(
            c => c.source_cell_id === cell.id || c.target_cell_id === cell.id
        );
        if (cellConnections.length === 0) return '';

        let html = `<div class="properties-group"><h4>Connections</h4>`;
        for (const conn of cellConnections) {
            const isSource = conn.source_cell_id === cell.id;
            const otherCellId = isSource ? conn.target_cell_id : conn.source_cell_id;
            const otherCell = design.cells.find(c => c.id === otherCellId);
            const otherName = otherCell ? otherCell.instance_name : otherCellId;

            if (conn.connection_type === 'interface') {
                const localIf = isSource ? conn.source_interface : conn.target_interface;
                const remoteIf = isSource ? conn.target_interface : conn.source_interface;
                html += `<div class="property-row"><span class="property-label">${localIf}</span><span class="property-value">→ ${otherName}/${remoteIf}</span></div>`;
            } else if (conn.connection_type === 'signal') {
                const localSig = isSource ? conn.source_signal : conn.target_signal;
                const remoteSig = isSource ? conn.target_signal : conn.source_signal;
                html += `<div class="property-row"><span class="property-label">${localSig}</span><span class="property-value">(signal) → ${otherName}/${remoteSig}</span></div>`;
            }
        }
        html += '</div>';
        return html;
    }

    _renderAddressRegionEditor(cell, ipEntity, ipCatalogService) {
        const regions = this.app.blockDesignService.getAddressRegionsForCell(cell.id);
        const slaveInterfaces = (ipEntity.interfaces || []).filter(i => i.role === 'slave');
        const hasEditableSlaves = slaveInterfaces.length > 0;

        let html = `<div class="properties-group"><h4>Address Regions</h4>`;

        if (regions.length > 0) {
            html += `<table class="register-table"><thead><tr><th>Interface</th><th>Base</th><th>High</th><th>Size</th><th></th></tr></thead><tbody>`;
            for (const region of regions) {
                html += `<tr>
                    <td>${region.interface_name}</td>
                    <td>0x${region.base_address.toString(16).toUpperCase()}</td>
                    <td>0x${region.high_address.toString(16).toUpperCase()}</td>
                    <td>${region.size}</td>
                    <td><button class="btn-remove-region btn-small" data-region-id="${region.id}">&times;</button></td>
                </tr>`;
            }
            html += '</tbody></table>';
        } else {
            html += '<div class="placeholder-text">No address regions assigned</div>';
        }

        if (hasEditableSlaves) {
            html += `<div class="address-region-form">`;
            html += `<select id="addr-region-interface" class="filter-select">`;
            for (const iface of slaveInterfaces) {
                const hasRegion = regions.some(r => r.interface_name === iface.name);
                html += `<option value="${iface.name}" ${hasRegion ? 'disabled' : ''}>${iface.name} ${hasRegion ? '(assigned)' : ''}</option>`;
            }
            html += `</select>`;
            html += `<input type="text" id="addr-region-base" placeholder="0x40000000" style="width:120px;">`;
            html += `<input type="number" id="addr-region-size" placeholder="Size" value="512" style="width:80px;">`;
            html += `<button id="btn-add-address-region" class="btn-small">Add</button>`;
            html += `<div id="addr-region-error" class="addr-region-error" style="color:#ff6b6b;font-size:12px;margin-top:4px;"></div>`;
            html += `</div>`;
        }

        html += '</div>';
        return html;
    }

    _setupAddressRegionListeners(cell) {
        const addBtn = this.container.querySelector('#btn-add-address-region');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const interfaceName = this.container.querySelector('#addr-region-interface')?.value;
                const base = this.container.querySelector('#addr-region-base')?.value;
                const size = this.container.querySelector('#addr-region-size')?.value;
                const errorEl = this.container.querySelector('#addr-region-error');
                const result = this.app.blockDesignService.addAddressRegion(cell.id, interfaceName, base, size);
                if (result.success) {
                    this.renderCellProperties(cell, this.app.ipCatalogService);
                    this.app.canvasRenderer.render();
                    this.app.updateStatus(`Added address region for ${interfaceName}`);
                } else {
                    errorEl.textContent = result.error || 'Failed to add address region';
                }
            });
        }

        this.container.querySelectorAll('.btn-remove-region').forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.blockDesignService.removeAddressRegion(btn.dataset.regionId);
                this.renderCellProperties(cell, this.app.ipCatalogService);
                this.app.canvasRenderer.render();
                this.app.updateStatus('Removed address region');
            });
        });
    }

    openParamEditor(cell, paramName, ipEntity) {
        const param = ipEntity.parameters.find(p => p.name === paramName);
        if (!param) return;

        this.editingParam = param;
        const currentValue = cell.parameter_overrides[paramName] !== undefined
            ? cell.parameter_overrides[paramName]
            : param.default;

        const modal = document.getElementById('param-editor-modal');
        const title = document.getElementById('param-editor-title');
        const label = document.getElementById('param-editor-label');
        const inputContainer = document.getElementById('param-editor-input-container');
        const rangeHint = document.getElementById('param-editor-range');

        title.textContent = `Edit: ${param.display_name || param.name}`;
        label.textContent = `Value (${param.type}):`;
        rangeHint.textContent = '';

        // Build input based on parameter type
        let inputHtml = '';
        if (param.type === 'bool') {
            inputHtml = `<select id="param-editor-input" class="filter-select">
                <option value="true" ${currentValue === true || currentValue === 'true' ? 'selected' : ''}>True</option>
                <option value="false" ${currentValue === false || currentValue === 'false' ? 'selected' : ''}>False</option>
            </select>`;
        } else if (param.type === 'long' || param.type === 'int') {
            const min = param.range ? param.range.min : '';
            const max = param.range ? param.range.max : '';
            inputHtml = `<input type="number" id="param-editor-input" value="${currentValue}" class="search-input" min="${min}" max="${max}">`;
            if (param.range) {
                rangeHint.textContent = `Range: ${param.range.min} - ${param.range.max}`;
            }
        } else if (param.type === 'string') {
            inputHtml = `<input type="text" id="param-editor-input" value="${currentValue}" class="search-input">`;
        } else if (param.type === 'enum' && param.options) {
            inputHtml = `<select id="param-editor-input" class="filter-select">`;
            for (const opt of param.options) {
                const selected = String(currentValue) === String(opt.value) ? 'selected' : '';
                inputHtml += `<option value="${opt.value}" ${selected}>${opt.label || opt.value}</option>`;
            }
            inputHtml += `</select>`;
        } else {
            inputHtml = `<input type="text" id="param-editor-input" value="${currentValue}" class="search-input">`;
        }

        inputContainer.innerHTML = inputHtml;
        modal.classList.remove('hidden');
    }

    saveParameterEdit() {
        if (!this.editingCell || !this.editingParam) return;

        const input = document.getElementById('param-editor-input');
        if (!input) return;

        let rawValue = input.value;
        const paramType = this.editingParam.type;

        // Parse value based on type
        let value;
        if (paramType === 'bool') {
            value = rawValue === 'true';
        } else if (paramType === 'long' || paramType === 'int') {
            value = parseInt(rawValue, 10);
            if (isNaN(value)) {
                alert('Invalid number');
                return;
            }
            // Validate range
            if (this.editingParam.range) {
                if (value < this.editingParam.range.min || value > this.editingParam.range.max) {
                    alert(`Value must be between ${this.editingParam.range.min} and ${this.editingParam.range.max}`);
                    return;
                }
            }
        } else if (paramType === 'enum' && this.editingParam.options) {
            const matchingOpt = this.editingParam.options.find(o => String(o.value) === rawValue);
            value = matchingOpt ? matchingOpt.value : rawValue;
        } else {
            value = rawValue;
        }

        // If value equals default, remove override
        if (value === this.editingParam.default) {
            delete this.editingCell.parameter_overrides[this.editingParam.name];
        } else {
            this.editingCell.parameter_overrides[this.editingParam.name] = value;
        }

        // Refresh panel
        this.renderCellProperties(this.editingCell, this.app.ipCatalogService);
        this.app.updateStatus(`Updated parameter: ${this.editingParam.name} = ${value}`);
        this.app.canvasRenderer.render();

        // Close modal
        document.getElementById('param-editor-modal').classList.add('hidden');
    }
}

export { PropertiesPanel };
