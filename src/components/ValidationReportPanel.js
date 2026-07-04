/* ValidationReportPanel.js - Design Rule Checking (DRC) report panel */

class ValidationReportPanel {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('validation-report-modal');
        this.container = document.getElementById('validation-report-content');
        this.summaryEl = document.getElementById('validation-report-summary');
        this.currentReport = null;
        this.setupEvents();
    }

    setupEvents() {
        this.modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        const revalidateBtn = document.getElementById('btn-revalidate');
        if (revalidateBtn) {
            revalidateBtn.addEventListener('click', () => this.runValidation());
        }
    }

    open() {
        this.modal.classList.remove('hidden');
    }

    close() {
        this.modal.classList.add('hidden');
        this.app.canvasRenderer.clearValidationHighlights();
    }

    runValidation() {
        const design = this.app.blockDesignService.getCurrentDesign();
        if (!design) {
            this.showEmptyReport('No design loaded');
            this.open();
            return;
        }

        const connResults = this.app.connectionService.validateAll();
        const addrResult = this.app.blockDesignService.validateAddressRegions();

        this.currentReport = this._buildReport(design, connResults, addrResult);
        this._renderReport();
        this._applyHighlights();
        this.open();

        // Update status bar
        const { errors, warnings } = this.currentReport.summary;
        this.app.updateStatus(`Validation: ${errors} error(s), ${warnings} warning(s)`);
    }

    _buildReport(design, connResults, addrResult) {
        const items = [];

        for (const conn of connResults) {
            if (conn.status === 'valid') continue;
            const sourceCell = design.cells.find(c => c.id === conn.source_cell_id);
            const targetCell = design.cells.find(c => c.id === conn.target_cell_id);
            const sourceName = sourceCell ? sourceCell.instance_name : conn.source_cell_id;
            const targetName = targetCell ? targetCell.instance_name : conn.target_cell_id;

            for (const msg of conn.validation_messages) {
                items.push({
                    id: conn.id,
                    type: 'connection',
                    level: msg.type || 'error',
                    category: 'connection',
                    message: `${sourceName}/${conn.source_interface || conn.source_signal} → ${targetName}/${conn.target_interface || conn.target_signal}: ${msg.message}`,
                    target: { connectionId: conn.id }
                });
            }
        }

        for (const err of addrResult.errors) {
            items.push({
                id: `addr-${items.length}`,
                type: 'address',
                level: err.type || 'error',
                category: err.category,
                message: err.message,
                target: this._parseAddressTarget(err.message, design)
            });
        }

        const errors = items.filter(i => i.level === 'error').length;
        const warnings = items.filter(i => i.level === 'warning').length;

        return {
            valid: errors === 0,
            summary: { errors, warnings, total: items.length },
            items
        };
    }

    _parseAddressTarget(message, design) {
        // Try to extract cell instance name from messages like
        // "Address conflict: ps_0 [...] overlaps with gpio_0 [...]"
        // "Missing address region for gpio_0/S_AXI"
        const match = message.match(/(?:for\s+|n)\s*([a-zA-Z0-9_]+)(?:\s*\[|\/|$)/);
        if (match) {
            const cell = design.cells.find(c => c.instance_name === match[1]);
            if (cell) return { cellId: cell.id };
        }
        return {};
    }

    _renderReport() {
        const { summary, items } = this.currentReport;

        this.summaryEl.innerHTML = `
            <span class="validation-summary ${summary.errors > 0 ? 'has-errors' : ''}">
                ${summary.errors} error(s), ${summary.warnings} warning(s)
            </span>
            <span class="validation-status">${summary.errors === 0 ? '✓ Validation Passed' : '✗ Validation Failed'}</span>
        `;

        if (items.length === 0) {
            this.container.innerHTML = '<div class="placeholder-text">No issues found. Design is valid.</div>';
            return;
        }

        let html = '<ul class="validation-list">';
        for (const item of items) {
            const icon = item.level === 'error' ? '⚠' : 'ℹ';
            html += `
                <li class="validation-item ${item.level}" data-id="${item.id}" data-type="${item.type}">
                    <span class="validation-icon">${icon}</span>
                    <span class="validation-message">${this._escapeHtml(item.message)}</span>
                    <button class="btn-locate" data-target="${this._escapeHtml(JSON.stringify(item.target))}">Locate</button>
                </li>
            `;
        }
        html += '</ul>';
        this.container.innerHTML = html;

        this.container.querySelectorAll('.btn-locate').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = JSON.parse(btn.dataset.target);
                this._locateTarget(target);
            });
        });
    }

    _applyHighlights() {
        const connectionIds = this.currentReport.items
            .filter(i => i.target.connectionId)
            .map(i => i.target.connectionId);
        const cellIds = this.currentReport.items
            .filter(i => i.target.cellId)
            .map(i => i.target.cellId);

        this.app.canvasRenderer.highlightValidationIssues(connectionIds, cellIds);
    }

    _locateTarget(target) {
        if (target.connectionId) {
            this.app.canvasRenderer.selectConnection(target.connectionId);
        } else if (target.cellId) {
            this.app.selectCell(target.cellId);
        }
        this.app.canvasRenderer.render();
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { ValidationReportPanel };
