/* PackageIPWizard.js - IP Packager Wizard for creating custom IPs */

import { IPEntity } from '../models/IPEntity.js';

class PackageIPWizard {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('ip-packager-modal');
        this.container = document.getElementById('ip-packager-content');
        this.currentStep = 1;
        this.totalSteps = 6;
        
        // Package data accumulator
        this.packageData = {
            vendor: 'user.com',
            library: 'user',
            name: '',
            version: '1.0',
            display_name: '',
            description: '',
            category: 'User',
            tags: [],
            status: 'active',
            compatibility: { device_families: [] },
            interfaces: [],
            parameters: [],
            file_groups: [],
            register_map: { registers: [] }
        };
        
        this.interfaceTemplates = [];
        this.loadInterfaceTemplates();
        
        this.setupEvents();
    }
    
    async loadInterfaceTemplates() {
        try {
            const response = await fetch('data/interface_templates.json');
            if (!response.ok) throw new Error('Failed to load interface templates');
            const data = await response.json();
            this.interfaceTemplates = data.templates || [];
        } catch (error) {
            console.warn('Could not load interface templates:', error);
            this.interfaceTemplates = [];
        }
    }
    
    setupEvents() {
        document.getElementById('btn-package-ip').addEventListener('click', () => this.open());
        
        this.modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });
        
        // Close on click outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        // Wizard navigation
        document.getElementById('wizard-prev').addEventListener('click', () => this.prevStep());
        document.getElementById('wizard-next').addEventListener('click', () => this.nextStep());
        document.getElementById('wizard-finish').addEventListener('click', () => this.finish());
    }
    
    open() {
        this.currentStep = 1;
        this.resetData();
        this.renderStep();
        this.updateNavButtons();
        this.modal.classList.remove('hidden');
    }
    
    close() {
        this.modal.classList.add('hidden');
    }
    
    resetData() {
        this.packageData = {
            vendor: 'user.com',
            library: 'user',
            name: '',
            version: '1.0',
            display_name: '',
            description: '',
            category: 'User',
            tags: [],
            status: 'active',
            compatibility: { device_families: [] },
            interfaces: [],
            parameters: [],
            file_groups: [],
            register_map: { registers: [] }
        };
    }
    
    prevStep() {
        if (this.currentStep > 1) {
            this.collectCurrentStepData();
            this.currentStep--;
            this.renderStep();
            this.updateNavButtons();
        }
    }
    
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            if (!this.validateCurrentStep()) return;
            this.collectCurrentStepData();
            this.currentStep++;
            this.renderStep();
            this.updateNavButtons();
        }
    }
    
    updateNavButtons() {
        const prevBtn = document.getElementById('wizard-prev');
        const nextBtn = document.getElementById('wizard-next');
        const finishBtn = document.getElementById('wizard-finish');
        
        prevBtn.disabled = this.currentStep === 1;
        prevBtn.style.display = this.currentStep === 1 ? 'none' : 'inline-block';
        
        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            finishBtn.style.display = 'none';
        }
        
        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach((el, idx) => {
            el.classList.remove('active', 'completed');
            if (idx + 1 < this.currentStep) el.classList.add('completed');
            else if (idx + 1 === this.currentStep) el.classList.add('active');
        });
    }
    
    validateCurrentStep() {
        if (this.currentStep === 1) {
            const name = document.getElementById('pkg-name').value.trim();
            if (!name) {
                alert('IP Name is required');
                return false;
            }
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
                alert('IP Name must start with a letter and contain only letters, numbers, and underscores');
                return false;
            }
        }
        return true;
    }
    
    collectCurrentStepData() {
        if (this.currentStep === 1) {
            this.packageData.vendor = document.getElementById('pkg-vendor').value.trim() || 'user.com';
            this.packageData.library = document.getElementById('pkg-library').value.trim() || 'user';
            this.packageData.name = document.getElementById('pkg-name').value.trim();
            this.packageData.version = document.getElementById('pkg-version').value.trim() || '1.0';
            this.packageData.display_name = document.getElementById('pkg-display-name').value.trim() || this.packageData.name;
            this.packageData.description = document.getElementById('pkg-description').value.trim();
            this.packageData.category = document.getElementById('pkg-category').value.trim() || 'User';
            this.packageData.tags = document.getElementById('pkg-tags').value.trim().split(/[,\s]+/).filter(t => t);
        } else if (this.currentStep === 2) {
            // Collect file groups from DOM
            const fileGroups = [];
            this.container.querySelectorAll('.file-row').forEach(row => {
                const type = row.querySelector('.file-type-select')?.value || 'synthesis';
                const filesStr = row.querySelector('.file-path-input')?.value || '';
                const files = filesStr.split(',').map(f => f.trim()).filter(f => f);
                if (files.length > 0) {
                    fileGroups.push({ type, files });
                }
            });
            this.packageData.file_groups = fileGroups;
        } else if (this.currentStep === 3) {
            // Collect interfaces from DOM
            const interfaces = [];
            this.container.querySelectorAll('.interface-card').forEach(card => {
                const name = card.querySelector('.iface-name-input')?.value.trim();
                if (name) {
                    const type = card.querySelector('.iface-type-select')?.value || 'custom';
                    const role = card.querySelector('.iface-role-select')?.value || 'master';
                    const signals = [];
                    card.querySelectorAll('.signal-table tbody tr').forEach(row => {
                        const sigName = row.querySelector('.sig-name')?.value.trim();
                        if (sigName) {
                            signals.push({
                                name: sigName,
                                direction: row.querySelector('.sig-dir')?.value || 'input',
                                width: parseInt(row.querySelector('.sig-width')?.value || '1', 10)
                            });
                        }
                    });
                    interfaces.push({ name, type, role, signals });
                }
            });
            this.packageData.interfaces = interfaces;
        } else if (this.currentStep === 4) {
            // Collect parameters from DOM
            const params = [];
            this.container.querySelectorAll('.param-table tbody tr').forEach(row => {
                const name = row.querySelector('.param-name')?.value.trim();
                if (name) {
                    const p = {
                        name,
                        display_name: row.querySelector('.param-display')?.value.trim() || name,
                        type: row.querySelector('.param-type')?.value || 'long',
                        default: row.querySelector('.param-default')?.value || '0'
                    };
                    const minVal = row.querySelector('.param-min')?.value;
                    const maxVal = row.querySelector('.param-max')?.value;
                    if (minVal || maxVal) {
                        p.range = {};
                        if (minVal) p.range.min = parseInt(minVal, 10);
                        if (maxVal) p.range.max = parseInt(maxVal, 10);
                    }
                    if (p.type === 'bool') {
                        p.default = p.default === 'true' || p.default === true;
                    } else if (p.type === 'long' || p.type === 'int') {
                        const parsed = parseInt(p.default, 10);
                        p.default = isNaN(parsed) ? 0 : parsed;
                    }
                    params.push(p);
                }
            });
            this.packageData.parameters = params;
        } else if (this.currentStep === 5) {
            // Collect registers from DOM
            const regs = [];
            this.container.querySelectorAll('.register-card').forEach(card => {
                const name = card.querySelector('.reg-name')?.value.trim();
                if (name) {
                    const reg = {
                        name,
                        offset: card.querySelector('.reg-offset')?.value.trim() || '0x0000',
                        width: parseInt(card.querySelector('.reg-width')?.value || '32', 10),
                        access: card.querySelector('.reg-access')?.value || 'RW',
                        reset_value: card.querySelector('.reg-reset')?.value.trim() || '0x00000000',
                        description: card.querySelector('.reg-desc')?.value.trim() || ''
                    };
                    const fields = [];
                    card.querySelectorAll('.field-table tbody tr').forEach(row => {
                        const fname = row.querySelector('.field-name')?.value.trim();
                        if (fname) {
                            const bitsStr = row.querySelector('.field-bits')?.value.trim() || '0:0';
                            const bits = bitsStr.split(':').map(b => parseInt(b.trim(), 10));
                            fields.push({
                                name: fname,
                                bit_range: bits.length === 2 ? bits : [0, 0],
                                access: row.querySelector('.field-access')?.value || 'RW',
                                description: row.querySelector('.field-desc')?.value.trim() || ''
                            });
                        }
                    });
                    reg.fields = fields;
                    regs.push(reg);
                }
            });
            this.packageData.register_map = { registers: regs };
        }
    }
    
    renderStep() {
        const content = this.container;
        content.innerHTML = '';
        
        switch (this.currentStep) {
            case 1: this.renderStep1(content); break;
            case 2: this.renderStep2(content); break;
            case 3: this.renderStep3(content); break;
            case 4: this.renderStep4(content); break;
            case 5: this.renderStep5(content); break;
            case 6: this.renderStep6(content); break;
        }
    }
    
    // Step 1: Basic Info
    renderStep1(container) {
        // Check for existing IPs with same vendor:library:name
        const versionWarning = this.checkVersionConflict();
        
        container.innerHTML = `
            <div class="wizard-section">
                <h4>Basic Information</h4>
                <p class="wizard-hint">Define the VLNV (Vendor:Library:Name:Version) identity of your IP.</p>
                
                ${versionWarning}
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Vendor *</label>
                        <input type="text" id="pkg-vendor" value="${this.packageData.vendor}" placeholder="e.g., user.com">
                    </div>
                    <div class="form-group">
                        <label>Library *</label>
                        <input type="text" id="pkg-library" value="${this.packageData.library}" placeholder="e.g., user">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" id="pkg-name" value="${this.packageData.name}" placeholder="e.g., my_custom_ip">
                    </div>
                    <div class="form-group">
                        <label>Version</label>
                        <input type="text" id="pkg-version" value="${this.packageData.version}" placeholder="e.g., 1.0">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" id="pkg-display-name" value="${this.packageData.display_name}" placeholder="Human-readable name">
                </div>
                
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="pkg-description" rows="3" placeholder="Brief description of the IP functionality">${this.packageData.description}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Category</label>
                        <input type="text" id="pkg-category" value="${this.packageData.category}" placeholder="e.g., User, Custom Logic">
                    </div>
                    <div class="form-group">
                        <label>Tags (comma-separated)</label>
                        <input type="text" id="pkg-tags" value="${this.packageData.tags.join(', ')}" placeholder="e.g., custom, axi, gpio">
                    </div>
                </div>
            </div>
        `;
        
        // Attach real-time version conflict detection
        const nameInput = document.getElementById('pkg-name');
        const vendorInput = document.getElementById('pkg-vendor');
        const libraryInput = document.getElementById('pkg-library');
        const versionInput = document.getElementById('pkg-version');
        
        [nameInput, vendorInput, libraryInput, versionInput].forEach(el => {
            if (el) el.addEventListener('input', () => this.refreshVersionWarning());
        });
    }
    
    checkVersionConflict() {
        if (!this.packageData.name || !this.packageData.vendor || !this.packageData.library) return '';
        
        const existingSameVLNV = this.app.ipCatalogService.getByVLNV(
            this.packageData.vendor, this.packageData.library, this.packageData.name, this.packageData.version
        );
        
        if (existingSameVLNV) {
            return `<div class="version-exists-warning">Warning: IP with VLNV ${this.packageData.vendor}:${this.packageData.library}:${this.packageData.name}:${this.packageData.version} already exists. Clicking Finish will overwrite the existing IP.</div>`;
        }
        
        // Check for same name but different version
        const allIPs = this.app.ipCatalogService.getAll();
        const sameNameIPs = allIPs.filter(ip => 
            ip.vendor === this.packageData.vendor &&
            ip.library === this.packageData.library &&
            ip.name === this.packageData.name
        );
        
        if (sameNameIPs.length > 0) {
            const versions = sameNameIPs.map(ip => ip.version).join(', ');
            return `<div class="version-exists-info">Note: Existing versions found for this IP: ${versions}. This will create a new version ${this.packageData.version}.</div>`;
        }
        
        return '';
    }
    
    refreshVersionWarning() {
        const vendor = document.getElementById('pkg-vendor')?.value.trim() || 'user.com';
        const library = document.getElementById('pkg-library')?.value.trim() || 'user';
        const name = document.getElementById('pkg-name')?.value.trim() || '';
        const version = document.getElementById('pkg-version')?.value.trim() || '1.0';
        
        this.packageData.vendor = vendor;
        this.packageData.library = library;
        this.packageData.name = name;
        this.packageData.version = version;
        
        const warningHtml = this.checkVersionConflict();
        const warningEl = this.container.querySelector('.version-exists-warning, .version-exists-info');
        if (warningEl) {
            warningEl.outerHTML = warningHtml || '';
        } else if (warningHtml) {
            const section = this.container.querySelector('.wizard-section');
            if (section) {
                const hint = section.querySelector('.wizard-hint');
                if (hint) {
                    hint.insertAdjacentHTML('afterend', warningHtml);
                }
            }
        }
    }
    
    // Step 2: File Groups
    renderStep2(container) {
        container.innerHTML = `
            <div class="wizard-section">
                <h4>HDL Source Files</h4>
                <p class="wizard-hint">Add the source files for your IP. Paths are relative to the project directory.</p>
                
                <div class="list-toolbar">
                    <button id="btn-add-file" class="btn-small">+ Add File</button>
                    <button id="btn-check-syntax" class="btn-small" style="margin-left:8px;">Basic Check</button>
                </div>
                
                <div id="syntax-check-results" class="syntax-check-results"></div>
                
                <div id="file-list-container" class="item-list">
                    ${this.renderFileList()}
                </div>
            </div>
        `;
        
        document.getElementById('btn-add-file').addEventListener('click', () => this.addFile());
        document.getElementById('btn-check-syntax').addEventListener('click', () => this.checkHDLFiles());
    }
    
    checkHDLFiles() {
        const resultsContainer = document.getElementById('syntax-check-results');
        resultsContainer.innerHTML = '';
        
        let hasChecked = false;
        
        for (const fg of this.packageData.file_groups) {
            for (const filePath of fg.files) {
                if (!filePath) continue;
                if (!filePath.endsWith('.v') && !filePath.endsWith('.sv')) continue;
                
                hasChecked = true;
                this.fetchAndCheckFile(filePath, resultsContainer);
            }
        }
        
        if (!hasChecked) {
            resultsContainer.innerHTML = '<div class="syntax-check-result invalid">No Verilog (.v/.sv) files to check. Add files first.</div>';
        }
    }
    
    async fetchAndCheckFile(filePath, resultsContainer) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'syntax-check-result';
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                resultDiv.className += ' invalid';
                resultDiv.innerHTML = `<strong>${filePath}</strong>: Cannot read file (CORS or file not found)`;
                resultsContainer.appendChild(resultDiv);
                return;
            }
            
            const content = await response.text();
            const errors = this.checkVerilogSyntax(content);
            
            if (errors.length === 0) {
                resultDiv.className += ' valid';
                resultDiv.innerHTML = `<strong>${filePath}</strong>: Syntax OK`;
            } else {
                resultDiv.className += ' invalid';
                resultDiv.innerHTML = `<strong>${filePath}</strong>: ${errors.length} error(s) found`;
                for (const err of errors) {
                    resultDiv.innerHTML += `<div class="error-line">Line ${err.line}: ${err.message}</div>`;
                }
            }
        } catch (error) {
            resultDiv.className += ' invalid';
            resultDiv.innerHTML = `<strong>${filePath}</strong>: Error reading file - ${error.message}`;
        }
        
        resultsContainer.appendChild(resultDiv);
    }
    
    checkVerilogSyntax(content) {
        const errors = [];
        const lines = content.split('\n');
        
        let inModule = false;
        let moduleParenBalance = 0;
        let hasModuleDeclaration = false;
        let hasEndmodule = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('//') || line.startsWith('/*')) continue;
            
            // Check module declaration
            if (/\bmodule\s+\w+/.test(line)) {
                hasModuleDeclaration = true;
                inModule = true;
                const match = line.match(/\bmodule\s+(\w+)/);
                if (!match) {
                    errors.push({ line: i + 1, message: 'Module declaration missing module name' });
                }
            }
            
            // Check for endmodule
            if (/\bendmodule\b/.test(line)) {
                hasEndmodule = true;
                inModule = false;
            }
            
            // Track parentheses balance in module declaration
            if (inModule) {
                for (const ch of line) {
                    if (ch === '(') moduleParenBalance++;
                    else if (ch === ')') moduleParenBalance--;
                }
            }
            
            // Check basic syntax issues
            if (line.includes('module') && !line.match(/\bmodule\s/)) {
                if (!line.startsWith('//') && !line.includes('endmodule')) {
                    errors.push({ line: i + 1, message: 'Possible malformed module keyword' });
                }
            }
            
            // Check for unclosed strings
            const quoteCount = (line.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                errors.push({ line: i + 1, message: 'Unclosed string literal' });
            }
            
            // Check for unclosed block comments
            if (line.includes('/*') && !line.includes('*/')) {
                errors.push({ line: i + 1, message: 'Unclosed block comment (/* without */)' });
            }
        }
        
        if (!hasModuleDeclaration) {
            errors.push({ line: 1, message: 'No module declaration found (expected "module <name>" keyword)' });
        }
        if (hasModuleDeclaration && !hasEndmodule) {
            errors.push({ line: lines.length, message: 'Missing "endmodule" keyword' });
        }
        if (moduleParenBalance !== 0) {
            errors.push({ line: 1, message: `Unbalanced parentheses in module port list (${moduleParenBalance} unmatched)` });
        }
        
        return errors;
    }
    
    renderFileList() {
        if (!this.packageData.file_groups || this.packageData.file_groups.length === 0) {
            return '<div class="placeholder-text">No files added yet</div>';
        }
        
        let html = '';
        for (let i = 0; i < this.packageData.file_groups.length; i++) {
            const fg = this.packageData.file_groups[i];
            html += `
                <div class="file-row" data-idx="${i}">
                    <select class="file-type-select" data-idx="${i}">
                        <option value="synthesis" ${fg.type === 'synthesis' ? 'selected' : ''}>Synthesis</option>
                        <option value="simulation" ${fg.type === 'simulation' ? 'selected' : ''}>Simulation</option>
                        <option value="testbench" ${fg.type === 'testbench' ? 'selected' : ''}>Testbench</option>
                    </select>
                    <input type="text" class="file-path-input" value="${fg.files.join(', ')}" placeholder="file.v" data-idx="${i}">
                    <button class="btn-remove-item" data-idx="${i}">&times;</button>
                </div>
            `;
        }
        return html;
    }
    
    addFile() {
        this.packageData.file_groups.push({ type: 'synthesis', files: [''] });
        this.renderStep2(this.container);
    }
    
    removeFile(idx) {
        this.packageData.file_groups.splice(idx, 1);
        this.renderStep2(this.container);
    }
    
    // Step 3: Interface Definitions
    renderStep3(container) {
        const templateOptions = this.interfaceTemplates.map(t => 
            `<option value="${t.id}">${t.name} (${t.role})</option>`
        ).join('');
        
        container.innerHTML = `
            <div class="wizard-section">
                <h4>Interface Definitions</h4>
                <p class="wizard-hint">Define the external interfaces of your IP (e.g., AXI, Clock, Reset).</p>
                
                ${this.interfaceTemplates.length > 0 ? `
                <div class="template-selector">
                    <label>Template:</label>
                    <select id="iface-template-select" class="filter-select" style="width:200px;display:inline-block;">
                        <option value="">-- Select Template --</option>
                        ${templateOptions}
                    </select>
                    <button id="btn-add-from-template" class="btn-small">Add from Template</button>
                </div>
                ` : ''}
                
                <div class="list-toolbar">
                    <button id="btn-add-interface" class="btn-small">+ Add Interface</button>
                </div>
                
                <div id="interface-list-container" class="item-list">
                    ${this.renderInterfaceList()}
                </div>
            </div>
        `;
        
        document.getElementById('btn-add-interface').addEventListener('click', () => this.addInterface());
        
        const templateBtn = document.getElementById('btn-add-from-template');
        if (templateBtn) {
            templateBtn.addEventListener('click', () => this.addInterfaceFromTemplate());
        }
        
        // Attach remove listeners
        container.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => this.removeInterface(parseInt(btn.dataset.idx)));
        });
        
        // Attach signal toggle listeners
        container.querySelectorAll('.btn-toggle-signals').forEach(btn => {
            btn.addEventListener('click', () => {
                const el = document.getElementById(`signal-editor-${btn.dataset.idx}`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        });
        
        // Attach add signal listeners
        container.querySelectorAll('.btn-add-signal').forEach(btn => {
            btn.addEventListener('click', () => this.addSignal(parseInt(btn.dataset.idx)));
        });
        
        // Attach remove signal listeners
        container.querySelectorAll('.btn-remove-signal').forEach(btn => {
            btn.addEventListener('click', () => this.removeSignal(parseInt(btn.dataset.ifaceIdx), parseInt(btn.dataset.sigIdx)));
        });
    }
    
    addInterfaceFromTemplate() {
        const select = document.getElementById('iface-template-select');
        if (!select || !select.value) return;
        
        const template = this.interfaceTemplates.find(t => t.id === select.value);
        if (!template) return;
        
        // Count existing interfaces of this type to generate unique name
        const existingCount = this.packageData.interfaces.filter(i => i.type === template.interface_type).length;
        const name = template.name.replace(/\s+/g, '_') + (existingCount > 0 ? `_${existingCount}` : '');
        
        this.packageData.interfaces.push({
            name: name,
            type: template.interface_type,
            role: template.role,
            signals: template.signals.map(s => ({...s}))
        });
        
        this.renderStep3(this.container);
    }
    
    renderInterfaceList() {
        if (!this.packageData.interfaces || this.packageData.interfaces.length === 0) {
            return '<div class="placeholder-text">No interfaces defined yet</div>';
        }
        
        let html = '';
        for (let i = 0; i < this.packageData.interfaces.length; i++) {
            const iface = this.packageData.interfaces[i];
            html += `
                <div class="interface-card" data-idx="${i}">
                    <div class="interface-header">
                        <input type="text" class="iface-name-input" value="${iface.name}" placeholder="Interface Name" data-idx="${i}">
                        <select class="iface-type-select" data-idx="${i}">
                            <option value="axi4" ${iface.type === 'axi4' ? 'selected' : ''}>AXI4</option>
                            <option value="axi4_lite" ${iface.type === 'axi4_lite' ? 'selected' : ''}>AXI4-Lite</option>
                            <option value="axi4_stream" ${iface.type === 'axi4_stream' ? 'selected' : ''}>AXI4-Stream</option>
                            <option value="clock" ${iface.type === 'clock' ? 'selected' : ''}>Clock</option>
                            <option value="reset" ${iface.type === 'reset' ? 'selected' : ''}>Reset</option>
                            <option value="interrupt" ${iface.type === 'interrupt' ? 'selected' : ''}>Interrupt</option>
                            <option value="custom" ${iface.type === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                        <select class="iface-role-select" data-idx="${i}">
                            <option value="master" ${iface.role === 'master' ? 'selected' : ''}>Master</option>
                            <option value="slave" ${iface.role === 'slave' ? 'selected' : ''}>Slave</option>
                            <option value="bidirectional" ${iface.role === 'bidirectional' ? 'selected' : ''}>Bidirectional</option>
                        </select>
                        <button class="btn-toggle-signals" data-idx="${i}">Signals</button>
                        <button class="btn-remove-item" data-idx="${i}">&times;</button>
                    </div>
                    <div id="signal-editor-${i}" class="signal-editor" style="display:none;">
                        <div class="signal-list">
                            ${this.renderSignalList(i, iface.signals || [])}
                        </div>
                        <button class="btn-add-signal btn-small" data-idx="${i}">+ Add Signal</button>
                    </div>
                </div>
            `;
        }
        return html;
    }
    
    renderSignalList(ifaceIdx, signals) {
        if (!signals || signals.length === 0) return '<div class="placeholder-text">No signals</div>';
        
        let html = '<table class="signal-table"><thead><tr><th>Name</th><th>Dir</th><th>Width</th><th></th></tr></thead><tbody>';
        for (let j = 0; j < signals.length; j++) {
            const sig = signals[j];
            html += `<tr>
                <td><input type="text" value="${sig.name}" placeholder="signal_name" class="sig-name" data-iface="${ifaceIdx}" data-sig="${j}"></td>
                <td>
                    <select class="sig-dir" data-iface="${ifaceIdx}" data-sig="${j}">
                        <option value="input" ${sig.direction === 'input' ? 'selected' : ''}>IN</option>
                        <option value="output" ${sig.direction === 'output' ? 'selected' : ''}>OUT</option>
                        <option value="inout" ${sig.direction === 'inout' ? 'selected' : ''}>INOUT</option>
                    </select>
                </td>
                <td><input type="number" value="${sig.width}" class="sig-width" data-iface="${ifaceIdx}" data-sig="${j}" style="width:60px;"></td>
                <td><button class="btn-remove-signal" data-iface-idx="${ifaceIdx}" data-sig-idx="${j}">&times;</button></td>
            </tr>`;
        }
        html += '</tbody></table>';
        return html;
    }
    
    addInterface() {
        this.packageData.interfaces.push({
            name: 'New_Interface',
            type: 'custom',
            role: 'master',
            signals: []
        });
        this.renderStep3(this.container);
    }
    
    removeInterface(idx) {
        this.packageData.interfaces.splice(idx, 1);
        this.renderStep3(this.container);
    }
    
    addSignal(ifaceIdx) {
        this.packageData.interfaces[ifaceIdx].signals.push({
            name: 'new_signal',
            direction: 'input',
            width: 1
        });
        this.renderStep3(this.container);
    }
    
    removeSignal(ifaceIdx, sigIdx) {
        this.packageData.interfaces[ifaceIdx].signals.splice(sigIdx, 1);
        this.renderStep3(this.container);
    }
    
    // Step 4: Parameters
    renderStep4(container) {
        container.innerHTML = `
            <div class="wizard-section">
                <h4>Parameters</h4>
                <p class="wizard-hint">Define configurable parameters for your IP.</p>
                
                <div class="list-toolbar">
                    <button id="btn-add-param" class="btn-small">+ Add Parameter</button>
                </div>
                
                <div id="param-list-container" class="item-list">
                    ${this.renderParameterList()}
                </div>
            </div>
        `;
        
        document.getElementById('btn-add-param').addEventListener('click', () => this.addParameter());
        container.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => this.removeParameter(parseInt(btn.dataset.idx)));
        });
    }
    
    renderParameterList() {
        if (!this.packageData.parameters || this.packageData.parameters.length === 0) {
            return '<div class="placeholder-text">No parameters defined</div>';
        }
        
        let html = '<table class="param-table"><thead><tr><th>Name</th><th>Display Name</th><th>Type</th><th>Default</th><th>Min</th><th>Max</th><th></th></tr></thead><tbody>';
        for (let i = 0; i < this.packageData.parameters.length; i++) {
            const p = this.packageData.parameters[i];
            html += `<tr>
                <td><input type="text" value="${p.name}" class="param-name" data-idx="${i}" placeholder="C_PARAM_NAME"></td>
                <td><input type="text" value="${p.display_name || ''}" class="param-display" data-idx="${i}" placeholder="Display Name"></td>
                <td>
                    <select class="param-type" data-idx="${i}">
                        <option value="bool" ${p.type === 'bool' ? 'selected' : ''}>bool</option>
                        <option value="long" ${p.type === 'long' ? 'selected' : ''}>long</option>
                        <option value="int" ${p.type === 'int' ? 'selected' : ''}>int</option>
                        <option value="string" ${p.type === 'string' ? 'selected' : ''}>string</option>
                    </select>
                </td>
                <td><input type="text" value="${p.default !== undefined ? p.default : ''}" class="param-default" data-idx="${i}" style="width:80px;"></td>
                <td><input type="number" value="${p.range ? p.range.min : ''}" class="param-min" data-idx="${i}" style="width:60px;"></td>
                <td><input type="number" value="${p.range ? p.range.max : ''}" class="param-max" data-idx="${i}" style="width:60px;"></td>
                <td><button class="btn-remove-item" data-idx="${i}">&times;</button></td>
            </tr>`;
        }
        html += '</tbody></table>';
        return html;
    }
    
    addParameter() {
        this.packageData.parameters.push({
            name: 'C_NEW_PARAM',
            display_name: 'New Parameter',
            type: 'long',
            default: 0
        });
        this.renderStep4(this.container);
    }
    
    removeParameter(idx) {
        this.packageData.parameters.splice(idx, 1);
        this.renderStep4(this.container);
    }
    
    // Step 5: Register Map
    renderStep5(container) {
        container.innerHTML = `
            <div class="wizard-section">
                <h4>Register Map</h4>
                <p class="wizard-hint">Define the memory-mapped registers for your IP (for AXI4-Lite slave interfaces).</p>
                
                <div class="list-toolbar">
                    <button id="btn-add-register" class="btn-small">+ Add Register</button>
                </div>
                
                <div id="register-list-container" class="item-list">
                    ${this.renderRegisterList()}
                </div>
            </div>
        `;
        
        document.getElementById('btn-add-register').addEventListener('click', () => this.addRegister());
        container.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => this.removeRegister(parseInt(btn.dataset.idx)));
        });
        container.querySelectorAll('.btn-toggle-fields').forEach(btn => {
            btn.addEventListener('click', () => {
                const el = document.getElementById(`field-editor-${btn.dataset.idx}`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        });
        container.querySelectorAll('.btn-add-field').forEach(btn => {
            btn.addEventListener('click', () => this.addField(parseInt(btn.dataset.idx)));
        });
        container.querySelectorAll('.btn-remove-field').forEach(btn => {
            btn.addEventListener('click', () => this.removeField(parseInt(btn.dataset.regIdx), parseInt(btn.dataset.fieldIdx)));
        });
    }
    
    renderRegisterList() {
        const regs = this.packageData.register_map.registers;
        if (!regs || regs.length === 0) {
            return '<div class="placeholder-text">No registers defined</div>';
        }
        
        let html = '';
        for (let i = 0; i < regs.length; i++) {
            const reg = regs[i];
            html += `
                <div class="register-card" data-idx="${i}">
                    <div class="register-header">
                        <input type="text" class="reg-name" value="${reg.name}" placeholder="Register Name" data-idx="${i}">
                        <input type="text" class="reg-offset" value="${reg.offset || '0x0000'}" placeholder="0x0000" data-idx="${i}" style="width:80px;">
                        <input type="number" class="reg-width" value="${reg.width || 32}" placeholder="32" data-idx="${i}" style="width:60px;">
                        <select class="reg-access" data-idx="${i}">
                            <option value="RW" ${reg.access === 'RW' ? 'selected' : ''}>RW</option>
                            <option value="RO" ${reg.access === 'RO' ? 'selected' : ''}>RO</option>
                            <option value="WO" ${reg.access === 'WO' ? 'selected' : ''}>WO</option>
                            <option value="RWC" ${reg.access === 'RWC' ? 'selected' : ''}>RWC</option>
                        </select>
                        <input type="text" class="reg-reset" value="${reg.reset_value || '0x00000000'}" placeholder="Reset" data-idx="${i}" style="width:100px;">
                        <button class="btn-toggle-fields" data-idx="${i}">Fields</button>
                        <button class="btn-remove-item" data-idx="${i}">&times;</button>
                    </div>
                    <div class="reg-desc-row">
                        <input type="text" class="reg-desc" value="${reg.description || ''}" placeholder="Description" data-idx="${i}" style="width:100%;">
                    </div>
                    <div id="field-editor-${i}" class="field-editor" style="display:none;">
                        ${this.renderFieldList(i, reg.fields || [])}
                        <button class="btn-add-field btn-small" data-idx="${i}">+ Add Field</button>
                    </div>
                </div>
            `;
        }
        return html;
    }
    
    renderFieldList(regIdx, fields) {
        if (!fields || fields.length === 0) return '<div class="placeholder-text">No bit fields</div>';
        
        let html = '<table class="field-table"><thead><tr><th>Name</th><th>Bits</th><th>Access</th><th>Description</th><th></th></tr></thead><tbody>';
        for (let j = 0; j < fields.length; j++) {
            const f = fields[j];
            const bitRange = Array.isArray(f.bit_range) ? `${f.bit_range[0]}:${f.bit_range[1]}` : '';
            html += `<tr>
                <td><input type="text" value="${f.name}" class="field-name" data-reg="${regIdx}" data-field="${j}" placeholder="field_name"></td>
                <td><input type="text" value="${bitRange}" class="field-bits" data-reg="${regIdx}" data-field="${j}" placeholder="7:0" style="width:50px;"></td>
                <td>
                    <select class="field-access" data-reg="${regIdx}" data-field="${j}">
                        <option value="RW" ${f.access === 'RW' ? 'selected' : ''}>RW</option>
                        <option value="RO" ${f.access === 'RO' ? 'selected' : ''}>RO</option>
                        <option value="WO" ${f.access === 'WO' ? 'selected' : ''}>WO</option>
                    </select>
                </td>
                <td><input type="text" value="${f.description || ''}" class="field-desc" data-reg="${regIdx}" data-field="${j}" placeholder="Description"></td>
                <td><button class="btn-remove-field" data-reg-idx="${regIdx}" data-field-idx="${j}">&times;</button></td>
            </tr>`;
        }
        html += '</tbody></table>';
        return html;
    }
    
    addRegister() {
        this.packageData.register_map.registers.push({
            name: 'REG_' + this.packageData.register_map.registers.length,
            offset: '0x' + (this.packageData.register_map.registers.length * 4).toString(16).padStart(4, '0'),
            width: 32,
            access: 'RW',
            reset_value: '0x00000000',
            description: '',
            fields: []
        });
        this.renderStep5(this.container);
    }
    
    removeRegister(idx) {
        this.packageData.register_map.registers.splice(idx, 1);
        this.renderStep5(this.container);
    }
    
    addField(regIdx) {
        this.packageData.register_map.registers[regIdx].fields.push({
            name: 'FIELD',
            bit_range: [0, 0],
            access: 'RW',
            description: ''
        });
        this.renderStep5(this.container);
    }
    
    removeField(regIdx, fieldIdx) {
        this.packageData.register_map.registers[regIdx].fields.splice(fieldIdx, 1);
        this.renderStep5(this.container);
    }
    
    // Step 6: Preview & Generate
    renderStep6(container) {
        // Don't collect from DOM - data already collected in this.packageData via collectCurrentStepData on each step
        const ipEntity = new IPEntity(this.packageData);
        const json = JSON.stringify(ipEntity.toJSON(), null, 2);
        
        container.innerHTML = `
            <div class="wizard-section">
                <h4>Preview</h4>
                <p class="wizard-hint">Review your IP definition before adding to the catalog.</p>
                
                <div class="preview-info">
                    <div class="property-row"><span class="property-label">VLNV:</span><span class="property-value">${ipEntity.vlnv}</span></div>
                    <div class="property-row"><span class="property-label">Interfaces:</span><span class="property-value">${ipEntity.interfaces.length}</span></div>
                    <div class="property-row"><span class="property-label">Parameters:</span><span class="property-value">${ipEntity.parameters.length}</span></div>
                    <div class="property-row"><span class="property-label">Registers:</span><span class="property-value">${ipEntity.register_map.registers.length}</span></div>
                </div>
                
                <h4>JSON Output</h4>
                <pre class="json-preview">${this.escapeHtml(json)}</pre>
            </div>
        `;
    }
    
    collectAllStepData() {
        // Step 1: collect from DOM only if elements exist (user is on Step 1)
        const vendorEl = document.getElementById('pkg-vendor');
        if (vendorEl) this.packageData.vendor = vendorEl.value.trim() || 'user.com';
        
        const libraryEl = document.getElementById('pkg-library');
        if (libraryEl) this.packageData.library = libraryEl.value.trim() || 'user';
        
        const nameEl = document.getElementById('pkg-name');
        if (nameEl) this.packageData.name = nameEl.value.trim();
        
        const versionEl = document.getElementById('pkg-version');
        if (versionEl) this.packageData.version = versionEl.value.trim() || '1.0';
        
        const displayNameEl = document.getElementById('pkg-display-name');
        if (displayNameEl) this.packageData.display_name = displayNameEl.value.trim() || this.packageData.name;
        
        const descEl = document.getElementById('pkg-description');
        if (descEl) this.packageData.description = descEl.value.trim();
        
        const categoryEl = document.getElementById('pkg-category');
        if (categoryEl) this.packageData.category = categoryEl.value.trim() || 'User';
        
        const tagsEl = document.getElementById('pkg-tags');
        if (tagsEl) this.packageData.tags = tagsEl.value.trim().split(/[,\s]+/).filter(t => t);
        
        // Step 2: File groups from container DOM if available
        const fileRows = this.container.querySelectorAll('.file-row');
        if (fileRows.length > 0) {
            const fileGroups = [];
            fileRows.forEach(row => {
                const type = row.querySelector('.file-type-select')?.value || 'synthesis';
                const filesStr = row.querySelector('.file-path-input')?.value || '';
                const files = filesStr.split(',').map(f => f.trim()).filter(f => f);
                if (files.length > 0) {
                    fileGroups.push({ type, files });
                }
            });
            this.packageData.file_groups = fileGroups;
        }
        
        // Step 3: Interfaces from container DOM if available
        const interfaceCards = this.container.querySelectorAll('.interface-card');
        if (interfaceCards.length > 0) {
            const interfaces = [];
            interfaceCards.forEach(card => {
                const name = card.querySelector('.iface-name-input')?.value.trim();
                if (name) {
                    const type = card.querySelector('.iface-type-select')?.value || 'custom';
                    const role = card.querySelector('.iface-role-select')?.value || 'master';
                    const signals = [];
                    card.querySelectorAll('.signal-table tbody tr').forEach(row => {
                        const sigName = row.querySelector('.sig-name')?.value.trim();
                        if (sigName) {
                            signals.push({
                                name: sigName,
                                direction: row.querySelector('.sig-dir')?.value || 'input',
                                width: parseInt(row.querySelector('.sig-width')?.value || '1', 10)
                            });
                        }
                    });
                    interfaces.push({ name, type, role, signals });
                }
            });
            this.packageData.interfaces = interfaces;
        }
        
        // Step 4: Parameters from container DOM if available
        const paramRows = this.container.querySelectorAll('.param-table tbody tr');
        if (paramRows.length > 0) {
            const params = [];
            paramRows.forEach(row => {
                const name = row.querySelector('.param-name')?.value.trim();
                if (name) {
                    const p = {
                        name,
                        display_name: row.querySelector('.param-display')?.value.trim() || name,
                        type: row.querySelector('.param-type')?.value || 'long',
                        default: row.querySelector('.param-default')?.value || '0'
                    };
                    const minVal = row.querySelector('.param-min')?.value;
                    const maxVal = row.querySelector('.param-max')?.value;
                    if (minVal || maxVal) {
                        p.range = {};
                        if (minVal) p.range.min = parseInt(minVal, 10);
                        if (maxVal) p.range.max = parseInt(maxVal, 10);
                    }
                    if (p.type === 'bool') {
                        p.default = p.default === 'true' || p.default === true;
                    } else if (p.type === 'long' || p.type === 'int') {
                        const parsed = parseInt(p.default, 10);
                        p.default = isNaN(parsed) ? 0 : parsed;
                    }
                    params.push(p);
                }
            });
            this.packageData.parameters = params;
        }
        
        // Step 5: Registers from container DOM if available
        const registerCards = this.container.querySelectorAll('.register-card');
        if (registerCards.length > 0) {
            const regs = [];
            registerCards.forEach(card => {
                const name = card.querySelector('.reg-name')?.value.trim();
                if (name) {
                    const reg = {
                        name,
                        offset: card.querySelector('.reg-offset')?.value.trim() || '0x0000',
                        width: parseInt(card.querySelector('.reg-width')?.value || '32', 10),
                        access: card.querySelector('.reg-access')?.value || 'RW',
                        reset_value: card.querySelector('.reg-reset')?.value.trim() || '0x00000000',
                        description: card.querySelector('.reg-desc')?.value.trim() || ''
                    };
                    const fields = [];
                    card.querySelectorAll('.field-table tbody tr').forEach(row => {
                        const fname = row.querySelector('.field-name')?.value.trim();
                        if (fname) {
                            const bitsStr = row.querySelector('.field-bits')?.value.trim() || '0:0';
                            const bits = bitsStr.split(':').map(b => parseInt(b.trim(), 10));
                            fields.push({
                                name: fname,
                                bit_range: bits.length === 2 ? bits : [0, 0],
                                access: row.querySelector('.field-access')?.value || 'RW',
                                description: row.querySelector('.field-desc')?.value.trim() || ''
                            });
                        }
                    });
                    reg.fields = fields;
                    regs.push(reg);
                }
            });
            this.packageData.register_map = { registers: regs };
        }
    }
    
    finish() {
        // Data is already collected via collectCurrentStepData on each step transition
        // Don't call collectAllStepData which may overwrite with stale data
        
        // Validate
        if (!this.packageData.name) {
            alert('IP Name is required');
            this.currentStep = 1;
            this.renderStep();
            this.updateNavButtons();
            return;
        }
        
        // Check for duplicate VLNV
        const existing = this.app.ipCatalogService.getByVLNV(
            this.packageData.vendor,
            this.packageData.library,
            this.packageData.name,
            this.packageData.version
        );
        if (existing) {
            if (!confirm(`An IP with VLNV ${this.packageData.vendor}:${this.packageData.library}:${this.packageData.name}:${this.packageData.version} already exists. Overwrite?`)) {
                return;
            }
            // Remove existing
            this.app.ipCatalogService.delete(existing.id);
        }
        
        // Create and add to catalog
        const ipEntity = this.app.ipCatalogService.create(this.packageData);
        
        // Save catalog
        this.app.ipCatalogService.save().then(success => {
            if (success) {
                this.app.ipCatalogPanel.render();
                this.app.updateStatus(`Packaged IP: ${ipEntity.vlnv}`);
                this.close();
            } else {
                // Fallback: download as JSON file
                const json = JSON.stringify(ipEntity.toJSON(), null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${ipEntity.name}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.app.ipCatalogPanel.render();
                this.app.updateStatus(`Packaged IP: ${ipEntity.vlnv} (downloaded as JSON)`);
                this.close();
            }
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { PackageIPWizard };
