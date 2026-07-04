/* SignalConnectionDialog.js - Dialog for creating signal-level (net) connections */

class SignalConnectionDialog {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('signal-connection-modal');
        this.container = document.getElementById('signal-connection-content');
        this.setupEvents();
    }

    setupEvents() {
        this.modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        const connectBtn = document.getElementById('btn-connect-signal');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.createConnection());
        }

        const sourceCellSelect = document.getElementById('signal-source-cell');
        const targetCellSelect = document.getElementById('signal-target-cell');
        if (sourceCellSelect) {
            sourceCellSelect.addEventListener('change', () => this._populateSignalSelect('signal-source-cell', 'signal-source-signal'));
        }
        if (targetCellSelect) {
            targetCellSelect.addEventListener('change', () => this._populateSignalSelect('signal-target-cell', 'signal-target-signal'));
        }
    }

    open() {
        this._populateCellSelects();
        this.modal.classList.remove('hidden');
    }

    close() {
        this.modal.classList.add('hidden');
    }

    _populateCellSelects() {
        const design = this.app.blockDesignService.getCurrentDesign();
        const sourceSelect = document.getElementById('signal-source-cell');
        const targetSelect = document.getElementById('signal-target-cell');

        if (!design || !sourceSelect || !targetSelect) return;

        const options = design.cells.map(c => `<option value="${c.id}">${c.instance_name}</option>`).join('');
        sourceSelect.innerHTML = `<option value="">-- Select Source --</option>${options}`;
        targetSelect.innerHTML = `<option value="">-- Select Target --</option>${options}`;

        this._populateSignalSelect('signal-source-cell', 'signal-source-signal');
        this._populateSignalSelect('signal-target-cell', 'signal-target-signal');
    }

    _populateSignalSelect(cellSelectId, signalSelectId) {
        const cellSelect = document.getElementById(cellSelectId);
        const signalSelect = document.getElementById(signalSelectId);
        if (!cellSelect || !signalSelect) return;

        const cellId = cellSelect.value;
        if (!cellId) {
            signalSelect.innerHTML = '<option value="">-- Select Signal --</option>';
            return;
        }

        const signals = this._getCellSignals(cellId);
        signalSelect.innerHTML = '<option value="">-- Select Signal --</option>' +
            signals.map(s => `<option value="${s.fullName}">${s.label}</option>`).join('');
    }

    _getCellSignals(cellId) {
        const design = this.app.blockDesignService.getCurrentDesign();
        const cell = design.cells.find(c => c.id === cellId);
        if (!cell || !cell.ip_entity_id) return [];

        const ipEntity = this.app.ipCatalogService.getById(cell.ip_entity_id);
        if (!ipEntity || !ipEntity.interfaces) return [];

        const signals = [];
        for (const iface of ipEntity.interfaces) {
            for (const sig of iface.signals || []) {
                const fullName = `${iface.name}/${sig.name}`;
                signals.push({
                    fullName,
                    label: `${iface.name}/${sig.name} (${sig.direction || '?'})`,
                    interfaceName: iface.name,
                    signalName: sig.name
                });
            }
        }
        return signals;
    }

    createConnection() {
        const sourceCellId = document.getElementById('signal-source-cell')?.value;
        const targetCellId = document.getElementById('signal-target-cell')?.value;
        const sourceSignalFull = document.getElementById('signal-source-signal')?.value;
        const targetSignalFull = document.getElementById('signal-target-signal')?.value;

        if (!sourceCellId || !targetCellId || !sourceSignalFull || !targetSignalFull) {
            alert('Please select source and target cells and signals');
            return;
        }

        const sourceSignal = sourceSignalFull.split('/').pop();
        const targetSignal = targetSignalFull.split('/').pop();

        try {
            const conn = this.app.connectionService.connectSignals(sourceCellId, sourceSignal, targetCellId, targetSignal);
            if (conn) {
                this.app.canvasRenderer.render();
                this.app.updateCounts();
                this.app.updateStatus(`Signal connection: ${sourceSignal} → ${targetSignal}`);
                this.close();
            }
        } catch (error) {
            console.error('Signal connection failed:', error);
            alert('Failed to create signal connection');
        }
    }
}

export { SignalConnectionDialog };
