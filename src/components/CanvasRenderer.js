/* CanvasRenderer.js - Canvas-based Block Design renderer */

class CanvasRenderer {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('design-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper = document.getElementById('canvas-wrapper');
        this.design = null;
        this.selectedCellId = null;
        this.selectedConnectionId = null;
        this.hoveredPort = null;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.cellWidth = 180;
        this.cellHeight = 80;
        this.portSize = 10;
        this.gridSize = 20;

        // Connection creation state
        this.isConnecting = false;
        this.connectSourceCellId = null;
        this.connectSourceInterface = null;
        this.connectSourcePos = null;
        this.connectTempEndPos = null;

        // Port layout cache: cellId -> Map<interfaceName, portInfo>
        this._portPositions = new Map();

        this.resize();
        this.setupEvents();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.wrapper.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.design) this.render();
    }

    setDesign(design) {
        this.design = design;
        this.render();
    }

    selectCell(cellId) {
        this.selectedCellId = cellId;
        this.selectedConnectionId = null;
        this.render();
    }

    selectConnection(connId) {
        this.selectedConnectionId = connId;
        this.selectedCellId = null;
        this.render();
    }

    getSelectedCellId() {
        return this.selectedCellId;
    }

    getSelectedConnectionId() {
        return this.selectedConnectionId;
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Canvas drop zone for IP drag
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => this.onDrop(e));
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.panX) / this.zoom,
            y: (e.clientY - rect.top - this.panY) / this.zoom
        };
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            // Middle click or Alt+click: pan
            this.isPanning = true;
            this.panStartX = e.clientX - this.panX;
            this.panStartY = e.clientY - this.panY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0) {
            // Check if clicking on a port first
            const clickedPort = this.hitTestPort(pos.x, pos.y);
            if (clickedPort) {
                this.isConnecting = true;
                this.connectSourceCellId = clickedPort.cellId;
                this.connectSourceInterface = clickedPort.interfaceName;
                this.connectSourcePos = { x: clickedPort.x, y: clickedPort.y };
                this.connectTempEndPos = { ...pos };
                this.canvas.style.cursor = 'crosshair';
                return;
            }

            // Check if clicking on a cell
            const clickedCell = this.hitTestCell(pos.x, pos.y);
            if (clickedCell) {
                this.selectedCellId = clickedCell.id;
                this.selectedConnectionId = null;
                this.isDragging = true;
                this.dragStartX = pos.x - clickedCell.position_x;
                this.dragStartY = pos.y - clickedCell.position_y;
                this.app.selectCell(clickedCell.id);
            } else {
                // Check if clicking on a connection line
                const clickedConn = this.hitTestConnection(pos.x, pos.y);
                if (clickedConn) {
                    this.selectedConnectionId = clickedConn.id;
                    this.selectedCellId = null;
                    this.app.propertiesPanel.clear();
                } else {
                    this.selectedCellId = null;
                    this.selectedConnectionId = null;
                    this.app.propertiesPanel.clear();
                }
            }
            this.render();
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            this.panX = e.clientX - this.panStartX;
            this.panY = e.clientY - this.panStartY;
            this.render();
            return;
        }

        if (this.isConnecting) {
            const pos = this.getMousePos(e);
            this.connectTempEndPos = pos;
            // Check if hovering over a valid target port
            const hoveredPort = this.hitTestPort(pos.x, pos.y);
            if (hoveredPort && hoveredPort.cellId !== this.connectSourceCellId) {
                this.canvas.style.cursor = 'copy';
                this.hoveredPort = hoveredPort;
            } else {
                this.canvas.style.cursor = 'crosshair';
                this.hoveredPort = null;
            }
            this.render();
            return;
        }

        // Hover port detection for normal mode
        const pos = this.getMousePos(e);
        const hoveredPort = this.hitTestPort(pos.x, pos.y);
        if (hoveredPort) {
            this.canvas.style.cursor = 'crosshair';
            this.hoveredPort = hoveredPort;
        } else {
            this.canvas.style.cursor = 'default';
            this.hoveredPort = null;
        }

        if (this.isDragging && this.selectedCellId) {
            const cell = this.design.cells.find(c => c.id === this.selectedCellId);
            if (cell) {
                cell.position_x = pos.x - this.dragStartX;
                cell.position_y = pos.y - this.dragStartY;
                this.render();
            }
        }
    }

    onMouseUp(e) {
        if (this.isConnecting) {
            const pos = this.getMousePos(e);
            const targetPort = this.hitTestPort(pos.x, pos.y);
            if (targetPort && targetPort.cellId !== this.connectSourceCellId) {
                this.app.createConnection(
                    this.connectSourceCellId,
                    this.connectSourceInterface,
                    targetPort.cellId,
                    targetPort.interfaceName
                );
            }
        }

        this.isDragging = false;
        this.isPanning = false;
        this.isConnecting = false;
        this.connectSourceCellId = null;
        this.connectSourceInterface = null;
        this.connectSourcePos = null;
        this.connectTempEndPos = null;
        this.hoveredPort = null;
        this.canvas.style.cursor = 'default';
        this.render();
    }

    onDrop(e) {
        e.preventDefault();
        const ipId = e.dataTransfer.getData('ipId');
        if (ipId) {
            const pos = this.getMousePos(e);
            const ipEntity = this.app.ipCatalogService.getById(ipId);
            if (ipEntity) {
                this.app.addIPToCanvas(ipEntity, pos.x, pos.y);
            }
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.2, Math.min(5.0, this.zoom * zoomFactor));

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;

        document.getElementById('zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    hitTestCell(x, y) {
        if (!this.design) return null;
        for (let i = this.design.cells.length - 1; i >= 0; i--) {
            const cell = this.design.cells[i];
            if (x >= cell.position_x && x <= cell.position_x + this.cellWidth &&
                y >= cell.position_y && y <= cell.position_y + this.cellHeight) {
                return cell;
            }
        }
        return null;
    }

    hitTestPort(x, y) {
        for (const [cellId, cellPorts] of this._portPositions) {
            for (const [ifaceName, portInfo] of cellPorts) {
                if (x >= portInfo.hitX && x <= portInfo.hitX + portInfo.hitW &&
                    y >= portInfo.hitY && y <= portInfo.hitY + portInfo.hitH) {
                    return {
                        cellId,
                        interfaceName: ifaceName,
                        role: portInfo.role,
                        x: portInfo.x,
                        y: portInfo.y
                    };
                }
            }
        }
        return null;
    }

    hitTestConnection(x, y) {
        if (!this.design || !this.design.connections) return null;
        const threshold = 8 / this.zoom; // Detection threshold in canvas space

        for (const conn of this.design.connections) {
            const sourceCell = this.design.cells.find(c => c.id === conn.source_cell_id);
            const targetCell = this.design.cells.find(c => c.id === conn.target_cell_id);
            if (!sourceCell || !targetCell) continue;

            const sourcePort = this.getPortPosition(sourceCell.id, conn.source_interface);
            const targetPort = this.getPortPosition(targetCell.id, conn.target_interface);

            const startX = sourcePort ? sourcePort.x : sourceCell.position_x + this.cellWidth;
            const startY = sourcePort ? sourcePort.y : sourceCell.position_y + this.cellHeight / 2;
            const endX = targetPort ? targetPort.x : targetCell.position_x;
            const endY = targetPort ? targetPort.y : targetCell.position_y + this.cellHeight / 2;

            const midX = (startX + endX) / 2;
            const distance = this._pointToBezierDistance(x, y, startX, startY, midX, startY, midX, endY, endX, endY);

            if (distance < threshold) {
                return conn;
            }
        }
        return null;
    }

    _pointToBezierDistance(px, py, x1, y1, cx1, cy1, cx2, cy2, x2, y2) {
        // Approximate distance by sampling points on the bezier curve
        let minDist = Infinity;
        const steps = 20;
        for (let t = 0; t <= 1; t += 1 / steps) {
            const invT = 1 - t;
            const bx = invT * invT * invT * x1 + 3 * invT * invT * t * cx1 + 3 * invT * t * t * cx2 + t * t * t * x2;
            const by = invT * invT * invT * y1 + 3 * invT * invT * t * cy1 + 3 * invT * t * t * cy2 + t * t * t * y2;
            const dx = px - bx;
            const dy = py - by;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    }

    zoomIn() {
        this.zoom = Math.min(5.0, this.zoom * 1.2);
        document.getElementById('zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(0.2, this.zoom / 1.2);
        document.getElementById('zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    fitToScreen() {
        if (!this.design || this.design.cells.length === 0) return;

        const minX = Math.min(...this.design.cells.map(c => c.position_x));
        const minY = Math.min(...this.design.cells.map(c => c.position_y));
        const maxX = Math.max(...this.design.cells.map(c => c.position_x + this.cellWidth));
        const maxY = Math.max(...this.design.cells.map(c => c.position_y + this.cellHeight));

        const rect = this.wrapper.getBoundingClientRect();
        const padding = 50;
        const scaleX = (rect.width - padding * 2) / (maxX - minX || 1);
        const scaleY = (rect.height - padding * 2) / (maxY - minY || 1);

        this.zoom = Math.min(scaleX, scaleY, 1.0);
        this.panX = rect.width / 2 - (minX + (maxX - minX) / 2) * this.zoom;
        this.panY = rect.height / 2 - (minY + (maxY - minY) / 2) * this.zoom;

        document.getElementById('zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    _buildPortPositions() {
        this._portPositions.clear();
        if (!this.design) return;

        for (const cell of this.design.cells) {
            const ipEntity = this.app.ipCatalogService.getById(cell.ip_entity_id);
            if (!ipEntity || !ipEntity.interfaces) continue;

            const interfaces = ipEntity.interfaces;
            const leftPorts = interfaces.filter(i => i.role === 'slave');
            const rightPorts = interfaces.filter(i => i.role === 'master' || i.role === 'bidirectional');

            const cellPorts = new Map();

            // Left ports (slave)
            const leftSpacing = this.cellHeight / (leftPorts.length + 1);
            leftPorts.forEach((iface, idx) => {
                const py = cell.position_y + leftSpacing * (idx + 1);
                const px = cell.position_x - this.portSize;
                cellPorts.set(iface.name, {
                    x: cell.position_x,
                    y: py,
                    hitX: px - 2,
                    hitY: py - this.portSize / 2 - 2,
                    hitW: this.portSize + 4,
                    hitH: this.portSize + 4,
                    role: 'slave'
                });
            });

            // Right ports (master)
            const rightSpacing = this.cellHeight / (rightPorts.length + 1);
            rightPorts.forEach((iface, idx) => {
                const py = cell.position_y + rightSpacing * (idx + 1);
                const px = cell.position_x + this.cellWidth;
                cellPorts.set(iface.name, {
                    x: cell.position_x + this.cellWidth,
                    y: py,
                    hitX: px - 2,
                    hitY: py - this.portSize / 2 - 2,
                    hitW: this.portSize + 4,
                    hitH: this.portSize + 4,
                    role: 'master'
                });
            });

            this._portPositions.set(cell.id, cellPorts);
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        this.drawGrid();

        // Pre-build port positions before drawing connections
        this._buildPortPositions();

        if (this.design) {
            this.drawConnections();
            this.drawCells();
        }

        // Draw temporary connection line
        if (this.isConnecting && this.connectSourcePos && this.connectTempEndPos) {
            this.drawTempConnection(this.connectSourcePos, this.connectTempEndPos);
        }

        ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width / this.zoom;
        const h = this.canvas.height / this.zoom;
        const offsetX = -this.panX / this.zoom;
        const offsetY = -this.panY / this.zoom;

        ctx.strokeStyle = '#2d2d2d';
        ctx.lineWidth = 1 / this.zoom;

        const startX = Math.floor(offsetX / this.gridSize) * this.gridSize;
        const startY = Math.floor(offsetY / this.gridSize) * this.gridSize;

        ctx.beginPath();
        for (let x = startX; x < offsetX + w; x += this.gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, offsetY + h);
        }
        for (let y = startY; y < offsetY + h; y += this.gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(offsetX + w, y);
        }
        ctx.stroke();
    }

    drawCells() {
        for (const cell of this.design.cells) {
            this.drawCell(cell);
        }
    }

    drawCell(cell) {
        const ctx = this.ctx;
        const x = cell.position_x;
        const y = cell.position_y;
        const w = this.cellWidth;
        const h = this.cellHeight;
        const isSelected = cell.id === this.selectedCellId;

        // Cell body
        ctx.fillStyle = isSelected ? '#1e3a5f' : '#2d2d2d';
        ctx.strokeStyle = isSelected ? '#569cd6' : '#5a5a5a';
        ctx.lineWidth = isSelected ? 3 : 2;

        const radius = 6;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cell title
        ctx.fillStyle = '#cccccc';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(cell.instance_name, x + 10, y + 20);

        // Cell subtitle (IP name)
        if (cell.ip_entity_id) {
            const ipEntity = this.app.ipCatalogService.getById(cell.ip_entity_id);
            if (ipEntity) {
                ctx.fillStyle = '#858585';
                ctx.font = '10px sans-serif';
                ctx.fillText(ipEntity.name, x + 10, y + 36);
            }
        }

        // Draw interfaces (ports)
        this.drawCellInterfaces(cell);
    }

    drawCellInterfaces(cell) {
        const ctx = this.ctx;
        const ipEntity = this.app.ipCatalogService.getById(cell.ip_entity_id);
        if (!ipEntity || !ipEntity.interfaces) return;

        const interfaces = ipEntity.interfaces;
        const leftPorts = interfaces.filter(i => i.role === 'slave');
        const rightPorts = interfaces.filter(i => i.role === 'master' || i.role === 'bidirectional');

        const cellPorts = new Map();

        // Left ports (slave)
        const leftSpacing = this.cellHeight / (leftPorts.length + 1);
        leftPorts.forEach((iface, idx) => {
            const py = cell.position_y + leftSpacing * (idx + 1);
            const px = cell.position_x - this.portSize;
            const isSource = this.isConnecting && this.connectSourceCellId === cell.id && this.connectSourceInterface === iface.name;
            const isHovered = this.hoveredPort && this.hoveredPort.cellId === cell.id && this.hoveredPort.interfaceName === iface.name;
            this.drawPort(px, py - this.portSize / 2, iface, 'slave', isSource, isHovered);
            cellPorts.set(iface.name, {
                x: cell.position_x,
                y: py,
                hitX: px - 2,
                hitY: py - this.portSize / 2 - 2,
                hitW: this.portSize + 4,
                hitH: this.portSize + 4,
                role: 'slave'
            });
        });

        // Right ports (master)
        const rightSpacing = this.cellHeight / (rightPorts.length + 1);
        rightPorts.forEach((iface, idx) => {
            const py = cell.position_y + rightSpacing * (idx + 1);
            const px = cell.position_x + this.cellWidth;
            const isSource = this.isConnecting && this.connectSourceCellId === cell.id && this.connectSourceInterface === iface.name;
            const isHovered = this.hoveredPort && this.hoveredPort.cellId === cell.id && this.hoveredPort.interfaceName === iface.name;
            this.drawPort(px, py - this.portSize / 2, iface, 'master', isSource, isHovered);
            cellPorts.set(iface.name, {
                x: cell.position_x + this.cellWidth,
                y: py,
                hitX: px - 2,
                hitY: py - this.portSize / 2 - 2,
                hitW: this.portSize + 4,
                hitH: this.portSize + 4,
                role: 'master'
            });
        });

        this._portPositions.set(cell.id, cellPorts);
    }

    drawPort(x, y, iface, role, isSource = false, isHovered = false) {
        const ctx = this.ctx;

        if (isSource) {
            ctx.fillStyle = '#4ec9b0';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
        } else if (isHovered) {
            ctx.fillStyle = role === 'master' ? '#7cb8e8' : '#e8a57c';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = role === 'master' ? '#569cd6' : '#ce9178';
            ctx.strokeStyle = '#858585';
            ctx.lineWidth = 1;
        }

        ctx.fillRect(x, y, this.portSize, this.portSize);
        ctx.strokeRect(x, y, this.portSize, this.portSize);

        // Label
        ctx.fillStyle = isHovered ? '#ffffff' : '#858585';
        ctx.font = '9px sans-serif';
        if (role === 'master') {
            ctx.textAlign = 'left';
            ctx.fillText(iface.name, x + this.portSize + 4, y + this.portSize / 2 + 3);
        } else {
            ctx.textAlign = 'right';
            ctx.fillText(iface.name, x - 4, y + this.portSize / 2 + 3);
        }
    }

    getPortPosition(cellId, interfaceName) {
        const cellPorts = this._portPositions.get(cellId);
        if (!cellPorts) return null;
        return cellPorts.get(interfaceName) || null;
    }

    drawConnections() {
        for (const conn of this.design.connections) {
            this.drawConnection(conn);
        }
    }

    drawConnection(conn) {
        const ctx = this.ctx;
        const sourceCell = this.design.cells.find(c => c.id === conn.source_cell_id);
        const targetCell = this.design.cells.find(c => c.id === conn.target_cell_id);
        if (!sourceCell || !targetCell) return;

        const isSelected = conn.id === this.selectedConnectionId;
        const isValid = conn.status === 'valid';

        const sourcePort = this.getPortPosition(sourceCell.id, conn.source_interface);
        const targetPort = this.getPortPosition(targetCell.id, conn.target_interface);

        let startX, startY, endX, endY;
        if (sourcePort) {
            startX = sourcePort.x;
            startY = sourcePort.y;
        } else {
            startX = sourceCell.position_x + this.cellWidth;
            startY = sourceCell.position_y + this.cellHeight / 2;
        }

        if (targetPort) {
            endX = targetPort.x;
            endY = targetPort.y;
        } else {
            endX = targetCell.position_x;
            endY = targetCell.position_y + this.cellHeight / 2;
        }

        ctx.strokeStyle = isSelected ? '#ffffff' : (isValid ? '#4ec9b0' : '#f44747');
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.lineCap = 'round';

        // Bezier curve
        const controlOffset = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + controlOffset;
        const cp1y = startY;
        const cp2x = endX - controlOffset;
        const cp2y = endY;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();

        // Arrow at end
        this.drawArrow(endX, endY, -1);
    }

    drawTempConnection(start, end) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#569cd6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineCap = 'round';

        const controlOffset = Math.abs(end.x - start.x) * 0.5;
        const cp1x = start.x + controlOffset;
        const cp1y = start.y;
        const cp2x = end.x - controlOffset;
        const cp2y = end.y;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawArrow(x, y, direction) {
        const ctx = this.ctx;
        const arrowSize = 6;
        ctx.fillStyle = '#4ec9b0';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + direction * arrowSize, y - arrowSize / 2);
        ctx.lineTo(x + direction * arrowSize, y + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
    }
}

export { CanvasRenderer };
