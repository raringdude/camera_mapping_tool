// Camera Mapping Tool - All-in-one JavaScript (no modules for file:// compatibility)

(function() {
    'use strict';

    // ============ DEFAULT PRICES ============
    let DEFAULT_CAMERA_PRICE = 1500;
    let DEFAULT_SWITCH_PRICE = 1600;
    let DEFAULT_NVR_PRICE = 3000;
    let defaultPinScale = 1;

    function isCameraType(type) {
        return type === 'camera' || type === 'existing-camera';
    }

    // ============ MAP MANAGER ============
    class MapManager {
        constructor(container, canvas, image) {
            this.container = container;
            this.canvas = canvas;
            this.image = image;

            this.scale = 1;
            this.translateX = 0;
            this.translateY = 0;
            this.isPanning = false;
            this.startX = 0;
            this.startY = 0;
            this.mode = 'select';

            this.imageLoaded = false;
            this.imageWidth = 0;
            this.imageHeight = 0;

            this.onPinPlacement = null;
            this.onConnectionPointPlacement = null;
            this.onMouseMove = null;
            this.onEmptyClick = null;
            this.onBuildingPointPlacement = null;
            this.onBuildingMouseMove = null;
            this.onRectBuildingDown = null;
            this.onRectBuildingMove = null;
            this.onRectBuildingUp = null;
            this.isRectDragging = false;

            this.init();
        }

        init() {
            this.container.addEventListener('wheel', (e) => this.handleWheel(e));
            this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.container.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
            this.container.addEventListener('click', (e) => this.handleClick(e));
            this.container.addEventListener('auxclick', (e) => {
                if (e.button === 1) e.preventDefault();
            });
        }

        loadImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.image.onload = () => {
                        this.imageLoaded = true;
                        this.imageWidth = this.image.naturalWidth;
                        this.imageHeight = this.image.naturalHeight;
                        this.image.classList.add('visible');
                        document.getElementById('placeholderText').style.display = 'none';
                        this.fitImageToView();
                        resolve(e.target.result);
                    };
                    this.image.onerror = reject;
                    this.image.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        loadImageFromDataURL(dataURL) {
            return new Promise((resolve, reject) => {
                this.image.onload = () => {
                    this.imageLoaded = true;
                    this.imageWidth = this.image.naturalWidth;
                    this.imageHeight = this.image.naturalHeight;
                    this.image.classList.add('visible');
                    document.getElementById('placeholderText').style.display = 'none';
                    this.fitImageToView();
                    resolve();
                };
                this.image.onerror = reject;
                this.image.src = dataURL;
            });
        }

        fitImageToView() {
            const containerRect = this.container.getBoundingClientRect();
            const scaleX = containerRect.width / this.imageWidth;
            const scaleY = containerRect.height / this.imageHeight;
            this.scale = Math.min(scaleX, scaleY, 1) * 0.9;

            this.translateX = (containerRect.width - this.imageWidth * this.scale) / 2;
            this.translateY = (containerRect.height - this.imageHeight * this.scale) / 2;

            this.applyTransform();
        }

        applyTransform() {
            this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        }

        setMode(mode) {
            this.mode = mode;
            this.container.classList.remove('pan-mode', 'add-drop-mode', 'add-camera-mode', 'add-connection-mode', 'add-switch-mode', 'add-existing-camera-mode', 'add-nvr-mode', 'add-building-mode', 'add-building-rect-mode');
            if (mode === 'pan') {
                this.container.classList.add('pan-mode');
            } else if (mode === 'add-drop') {
                this.container.classList.add('add-drop-mode');
            } else if (mode === 'add-camera') {
                this.container.classList.add('add-camera-mode');
            } else if (mode === 'add-connection') {
                this.container.classList.add('add-connection-mode');
            } else if (mode === 'add-switch') {
                this.container.classList.add('add-switch-mode');
            } else if (mode === 'add-existing-camera') {
                this.container.classList.add('add-existing-camera-mode');
            } else if (mode === 'add-nvr') {
                this.container.classList.add('add-nvr-mode');
            } else if (mode === 'add-building') {
                this.container.classList.add('add-building-mode');
            } else if (mode === 'add-building-rect') {
                this.container.classList.add('add-building-rect-mode');
            }
        }

        handleWheel(e) {
            if (!this.imageLoaded) return;
            e.preventDefault();

            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.1, Math.min(5, this.scale * delta));

            const scaleRatio = newScale / this.scale;
            this.translateX = mouseX - (mouseX - this.translateX) * scaleRatio;
            this.translateY = mouseY - (mouseY - this.translateY) * scaleRatio;
            this.scale = newScale;

            this.applyTransform();
        }

        handleMouseDown(e) {
            if (e.button === 1) {
                e.preventDefault();
                this.isPanning = true;
                this.startX = e.clientX - this.translateX;
                this.startY = e.clientY - this.translateY;
                return;
            }
            if (this.mode === 'pan' && e.button === 0) {
                this.isPanning = true;
                this.startX = e.clientX - this.translateX;
                this.startY = e.clientY - this.translateY;
            } else if (this.mode === 'add-building-rect' && e.button === 0) {
                if (!this.imageLoaded) return;
                const coords = this.screenToImageCoords(e.clientX, e.clientY);
                if (coords.x < 0 || coords.x > this.imageWidth || coords.y < 0 || coords.y > this.imageHeight) return;
                this.isRectDragging = true;
                if (this.onRectBuildingDown) this.onRectBuildingDown(coords.x, coords.y);
            }
        }

        handleMouseMove(e) {
            if (this.isPanning) {
                this.translateX = e.clientX - this.startX;
                this.translateY = e.clientY - this.startY;
                this.applyTransform();
            }

            if (this.mode === 'add-connection' && this.onMouseMove) {
                const coords = this.screenToImageCoords(e.clientX, e.clientY);
                this.onMouseMove(coords.x, coords.y);
            }

            if (this.mode === 'add-building' && this.onBuildingMouseMove) {
                const coords = this.screenToImageCoords(e.clientX, e.clientY);
                this.onBuildingMouseMove(coords.x, coords.y);
            }

            if (this.mode === 'add-building-rect' && this.isRectDragging && this.onRectBuildingMove) {
                const coords = this.screenToImageCoords(e.clientX, e.clientY);
                this.onRectBuildingMove(coords.x, coords.y);
            }
        }

        handleMouseUp(e) {
            this.isPanning = false;
            if (this.isRectDragging) {
                this.isRectDragging = false;
                const coords = this.screenToImageCoords(e.clientX, e.clientY);
                if (this.onRectBuildingUp) this.onRectBuildingUp(coords.x, coords.y);
            }
        }

        handleClick(e) {
            if (!this.imageLoaded) return;
            if (this.isPanning) return;

            const coords = this.screenToImageCoords(e.clientX, e.clientY);

            // Check if click is within image bounds
            if (coords.x < 0 || coords.x > this.imageWidth ||
                coords.y < 0 || coords.y > this.imageHeight) {
                return;
            }

            const pinModeMap = {
                'add-drop': 'drop', 'add-camera': 'camera',
                'add-switch': 'switch', 'add-existing-camera': 'existing-camera',
                'add-nvr': 'nvr'
            };
            if (pinModeMap[this.mode]) {
                if (this.onPinPlacement) {
                    this.onPinPlacement(pinModeMap[this.mode], coords.x, coords.y);
                }
            } else if (this.mode === 'add-connection') {
                if (this.onConnectionPointPlacement) {
                    this.onConnectionPointPlacement(coords.x, coords.y);
                }
            } else if (this.mode === 'add-building') {
                if (this.onBuildingPointPlacement) {
                    this.onBuildingPointPlacement(coords.x, coords.y);
                }
            } else if (this.mode === 'select') {
                if (this.onEmptyClick) this.onEmptyClick();
            }
        }

        screenToImageCoords(screenX, screenY) {
            const rect = this.container.getBoundingClientRect();
            const x = (screenX - rect.left - this.translateX) / this.scale;
            const y = (screenY - rect.top - this.translateY) / this.scale;
            return { x, y };
        }

        getState() {
            return {
                scale: this.scale,
                translateX: this.translateX,
                translateY: this.translateY
            };
        }

        setState(state) {
            this.scale = state.scale;
            this.translateX = state.translateX;
            this.translateY = state.translateY;
            this.applyTransform();
        }

        reset() {
            this.imageLoaded = false;
            this.image.classList.remove('visible');
            this.image.src = '';
            document.getElementById('placeholderText').style.display = 'block';
            this.scale = 1;
            this.translateX = 0;
            this.translateY = 0;
            this.applyTransform();
        }
    }

    // ============ CONNECTION MANAGER ============
    class ConnectionManager {
        constructor(connectionsLayer, mapManager) {
            this.connectionsLayer = connectionsLayer;
            this.mapManager = mapManager;
            this.connections = [];
            this.selectedConnection = null;
            this.connectionCounter = 0;

            // For creating new connections
            this.pendingPoint = null;
            this.previewLine = null;

            this.onConnectionSelect = null;
            this.onConnectionsChange = null;

            // Snap distance in image coordinates
            this.snapDistance = 15;

            this.init();
        }

        init() {
            // Create preview line element
            this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            this.previewLine.classList.add('connection-line', 'preview');
            this.previewLine.style.display = 'none';
            this.connectionsLayer.appendChild(this.previewLine);
        }

        // Get all unique points from all connections
        getAllPoints() {
            const points = [];
            this.connections.forEach(conn => {
                points.push({ x: conn.x1, y: conn.y1, connectionId: conn.id, endpoint: 1 });
                points.push({ x: conn.x2, y: conn.y2, connectionId: conn.id, endpoint: 2 });
            });
            return points;
        }

        // Get deduplicated antenna endpoints (unique by position)
        getUniqueAntennas() {
            const seen = new Set();
            const antennas = [];
            let counter = 0;
            this.connections.forEach(conn => {
                const key1 = `${conn.x1},${conn.y1}`;
                if (!seen.has(key1)) {
                    seen.add(key1);
                    counter++;
                    antennas.push({ x: conn.x1, y: conn.y1, name: `Antenna-${counter}` });
                }
                const key2 = `${conn.x2},${conn.y2}`;
                if (!seen.has(key2)) {
                    seen.add(key2);
                    counter++;
                    antennas.push({ x: conn.x2, y: conn.y2, name: `Antenna-${counter}` });
                }
            });
            return antennas;
        }

        // Find nearest existing point within snap distance
        findNearestPoint(x, y) {
            const points = this.getAllPoints();
            let nearest = null;
            let minDist = this.snapDistance;

            points.forEach(point => {
                const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
                if (dist < minDist) {
                    minDist = dist;
                    nearest = point;
                }
            });

            return nearest;
        }

        startConnection(x, y) {
            // Check if clicking near an existing point
            const nearestPoint = this.findNearestPoint(x, y);
            if (nearestPoint) {
                x = nearestPoint.x;
                y = nearestPoint.y;
            }

            this.pendingPoint = { x, y };
            this.previewLine.setAttribute('x1', x);
            this.previewLine.setAttribute('y1', y);
            this.previewLine.setAttribute('x2', x);
            this.previewLine.setAttribute('y2', y);
            this.previewLine.style.display = 'block';
        }

        updatePreview(x, y) {
            if (this.pendingPoint) {
                this.previewLine.setAttribute('x2', x);
                this.previewLine.setAttribute('y2', y);
            }
        }

        completeConnection(x, y) {
            if (!this.pendingPoint) return null;

            // Check if clicking near an existing point
            const nearestPoint = this.findNearestPoint(x, y);
            if (nearestPoint) {
                x = nearestPoint.x;
                y = nearestPoint.y;
            }

            // Don't create a zero-length connection
            if (x === this.pendingPoint.x && y === this.pendingPoint.y) {
                this.cancelPending();
                return null;
            }

            this.connectionCounter++;
            const connection = {
                id: `connection-${Date.now()}`,
                name: `Connection-${this.connectionCounter}`,
                x1: this.pendingPoint.x,
                y1: this.pendingPoint.y,
                x2: x,
                y2: y
            };

            this.connections.push(connection);
            this.renderConnection(connection);
            this.cancelPending();
            this.notifyChange();

            return connection;
        }

        cancelPending() {
            this.pendingPoint = null;
            this.previewLine.style.display = 'none';
        }

        hasPendingPoint() {
            return this.pendingPoint !== null;
        }

        renderConnection(connection) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.dataset.id = connection.id;

            // Line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add('connection-line');
            line.setAttribute('x1', connection.x1);
            line.setAttribute('y1', connection.y1);
            line.setAttribute('x2', connection.x2);
            line.setAttribute('y2', connection.y2);

            // End points
            const point1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            point1.classList.add('connection-point');
            point1.setAttribute('cx', connection.x1);
            point1.setAttribute('cy', connection.y1);
            point1.setAttribute('r', 6);
            point1.dataset.x = connection.x1;
            point1.dataset.y = connection.y1;

            const point2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            point2.classList.add('connection-point');
            point2.setAttribute('cx', connection.x2);
            point2.setAttribute('cy', connection.y2);
            point2.setAttribute('r', 6);
            point2.dataset.x = connection.x2;
            point2.dataset.y = connection.y2;

            group.appendChild(line);
            group.appendChild(point1);
            group.appendChild(point2);

            // Click handler for points - handle connection mode
            const handlePointClick = (e, x, y) => {
                e.stopPropagation();
                if (this.mapManager.mode === 'add-connection') {
                    if (this.hasPendingPoint()) {
                        this.completeConnection(x, y);
                    } else {
                        this.startConnection(x, y);
                    }
                } else {
                    this.selectConnection(connection.id);
                }
            };

            point1.addEventListener('click', (e) => handlePointClick(e, connection.x1, connection.y1));
            point2.addEventListener('click', (e) => handlePointClick(e, connection.x2, connection.y2));

            // Click on line to select
            line.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.mapManager.mode !== 'add-connection') {
                    this.selectConnection(connection.id);
                }
            });

            // Insert before preview line
            this.connectionsLayer.insertBefore(group, this.previewLine);
        }

        selectConnection(id) {
            // Deselect previous
            if (this.selectedConnection) {
                const prevGroup = this.getConnectionElement(this.selectedConnection.id);
                if (prevGroup) {
                    prevGroup.querySelector('.connection-line').classList.remove('selected');
                    prevGroup.querySelectorAll('.connection-point').forEach(p => p.classList.remove('selected'));
                }
            }

            this.selectedConnection = this.connections.find(c => c.id === id) || null;

            if (this.selectedConnection) {
                const group = this.getConnectionElement(this.selectedConnection.id);
                if (group) {
                    group.querySelector('.connection-line').classList.add('selected');
                    group.querySelectorAll('.connection-point').forEach(p => p.classList.add('selected'));
                }
            }

            if (this.onConnectionSelect) {
                this.onConnectionSelect(this.selectedConnection);
            }
        }

        deselectAll(silent) {
            if (this.selectedConnection) {
                const group = this.getConnectionElement(this.selectedConnection.id);
                if (group) {
                    group.querySelector('.connection-line').classList.remove('selected');
                    group.querySelectorAll('.connection-point').forEach(p => p.classList.remove('selected'));
                }
            }
            this.selectedConnection = null;

            if (!silent && this.onConnectionSelect) {
                this.onConnectionSelect(null);
            }
        }

        getConnectionElement(id) {
            return this.connectionsLayer.querySelector(`[data-id="${id}"]`);
        }

        updateConnection(id, updates) {
            const connection = this.connections.find(c => c.id === id);
            if (!connection) return;

            Object.assign(connection, updates);
            this.notifyChange();
        }

        deleteConnection(id) {
            const index = this.connections.findIndex(c => c.id === id);
            if (index === -1) return;

            this.connections.splice(index, 1);

            const element = this.getConnectionElement(id);
            if (element) element.remove();

            if (this.selectedConnection && this.selectedConnection.id === id) {
                this.selectedConnection = null;
                if (this.onConnectionSelect) {
                    this.onConnectionSelect(null);
                }
            }

            this.notifyChange();
        }

        notifyChange() {
            if (this.onConnectionsChange) {
                this.onConnectionsChange(this.connections);
            }
        }

        getState() {
            return {
                connections: JSON.parse(JSON.stringify(this.connections)),
                connectionCounter: this.connectionCounter
            };
        }

        setState(state) {
            // Clear existing connections (except preview line)
            const groups = this.connectionsLayer.querySelectorAll('g');
            groups.forEach(g => g.remove());

            this.connections = [];
            this.selectedConnection = null;

            state.connections.forEach(connData => {
                this.connections.push(connData);
                this.renderConnection(connData);
            });

            this.connectionCounter = state.connectionCounter || this.connections.length;
            this.notifyChange();
        }

        reset() {
            const groups = this.connectionsLayer.querySelectorAll('g');
            groups.forEach(g => g.remove());

            this.connections = [];
            this.selectedConnection = null;
            this.connectionCounter = 0;
            this.cancelPending();
            this.notifyChange();
        }
    }

    // ============ BUILDING MANAGER ============
    class BuildingManager {
        constructor(buildingsLayer, mapManager) {
            this.buildingsLayer = buildingsLayer;
            this.mapManager = mapManager;
            this.buildings = [];
            this.selectedBuilding = null;
            this.buildingCounter = 0;

            this.pendingPoints = [];
            this.previewGroup = null;

            this.onBuildingSelect = null;
            this.onBuildingsChange = null;

            this.snapDistance = 15;

            this.init();
        }

        init() {
            this.previewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.previewGroup.classList.add('building-preview');
            this.previewGroup.style.display = 'none';
            this.buildingsLayer.appendChild(this.previewGroup);
        }

        addPoint(x, y) {
            if (this.pendingPoints.length >= 3) {
                const first = this.pendingPoints[0];
                const dist = Math.sqrt(Math.pow(first.x - x, 2) + Math.pow(first.y - y, 2));
                if (dist < this.snapDistance) {
                    return this.completeBuilding();
                }
            }

            this.pendingPoints.push({ x, y });
            this.updatePreview();
            return null;
        }

        updatePreviewLine(x, y) {
            if (this.pendingPoints.length === 0) return;
            const previewLine = this.previewGroup.querySelector('.building-preview-line');
            if (previewLine) {
                const last = this.pendingPoints[this.pendingPoints.length - 1];
                previewLine.setAttribute('x1', last.x);
                previewLine.setAttribute('y1', last.y);
                previewLine.setAttribute('x2', x);
                previewLine.setAttribute('y2', y);
            }
        }

        updatePreview() {
            this.previewGroup.style.display = 'block';
            this.previewGroup.innerHTML = '';

            for (let i = 1; i < this.pendingPoints.length; i++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.classList.add('building-line');
                line.setAttribute('x1', this.pendingPoints[i - 1].x);
                line.setAttribute('y1', this.pendingPoints[i - 1].y);
                line.setAttribute('x2', this.pendingPoints[i].x);
                line.setAttribute('y2', this.pendingPoints[i].y);
                this.previewGroup.appendChild(line);
            }

            this.pendingPoints.forEach((pt, i) => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.classList.add('building-point');
                if (i === 0) circle.classList.add('building-close-point');
                circle.setAttribute('cx', pt.x);
                circle.setAttribute('cy', pt.y);
                circle.setAttribute('r', i === 0 ? 8 : 5);
                this.previewGroup.appendChild(circle);
            });

            if (this.pendingPoints.length > 0) {
                const last = this.pendingPoints[this.pendingPoints.length - 1];
                const previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                previewLine.classList.add('building-preview-line');
                previewLine.setAttribute('x1', last.x);
                previewLine.setAttribute('y1', last.y);
                previewLine.setAttribute('x2', last.x);
                previewLine.setAttribute('y2', last.y);
                this.previewGroup.appendChild(previewLine);
            }
        }

        completeBuilding() {
            if (this.pendingPoints.length < 3) {
                this.cancelPending();
                return null;
            }

            this.buildingCounter++;
            const building = {
                id: `building-${Date.now()}`,
                name: `Building-${this.buildingCounter}`,
                points: [...this.pendingPoints]
            };

            this.buildings.push(building);
            this.renderBuilding(building);
            this.cancelPending();
            this.notifyChange();

            return building;
        }

        cancelPending() {
            this.pendingPoints = [];
            this.previewGroup.style.display = 'none';
            this.previewGroup.innerHTML = '';
        }

        hasPendingPoints() {
            return this.pendingPoints.length > 0;
        }

        // ---- Rectangle tool ----
        startRect(x, y) {
            this.rectOrigin = { x, y };
            this.rectPreview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            this.rectPreview.classList.add('building-rect-preview');
            this.rectPreview.setAttribute('x', x);
            this.rectPreview.setAttribute('y', y);
            this.rectPreview.setAttribute('width', 0);
            this.rectPreview.setAttribute('height', 0);
            this.buildingsLayer.appendChild(this.rectPreview);
        }

        updateRect(x, y) {
            if (!this.rectOrigin || !this.rectPreview) return;
            const rx = Math.min(this.rectOrigin.x, x);
            const ry = Math.min(this.rectOrigin.y, y);
            const rw = Math.abs(x - this.rectOrigin.x);
            const rh = Math.abs(y - this.rectOrigin.y);
            this.rectPreview.setAttribute('x', rx);
            this.rectPreview.setAttribute('y', ry);
            this.rectPreview.setAttribute('width', rw);
            this.rectPreview.setAttribute('height', rh);
        }

        completeRect(x, y) {
            if (!this.rectOrigin) return null;
            const ox = this.rectOrigin.x;
            const oy = this.rectOrigin.y;

            // Remove preview
            if (this.rectPreview) {
                this.rectPreview.remove();
                this.rectPreview = null;
            }
            this.rectOrigin = null;

            // Ignore tiny rectangles (accidental clicks)
            if (Math.abs(x - ox) < 5 && Math.abs(y - oy) < 5) return null;

            const minX = Math.min(ox, x);
            const minY = Math.min(oy, y);
            const maxX = Math.max(ox, x);
            const maxY = Math.max(oy, y);

            this.pendingPoints = [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
            ];
            return this.completeBuilding();
        }

        cancelRect() {
            if (this.rectPreview) {
                this.rectPreview.remove();
                this.rectPreview = null;
            }
            this.rectOrigin = null;
        }

        renderBuilding(building) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.dataset.id = building.id;
            group.classList.add('building-group');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.classList.add('building-polygon');
            const pointsStr = building.points.map(p => `${p.x},${p.y}`).join(' ');
            polygon.setAttribute('points', pointsStr);

            const center = this.getPolygonCenter(building.points);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.classList.add('building-label');
            text.setAttribute('x', center.x);
            text.setAttribute('y', center.y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.textContent = building.name;

            group.appendChild(polygon);
            group.appendChild(text);

            this.buildingsLayer.insertBefore(group, this.previewGroup);
        }

        getPolygonCenter(points) {
            let x = 0, y = 0;
            points.forEach(p => { x += p.x; y += p.y; });
            return { x: x / points.length, y: y / points.length };
        }

        selectBuilding(id) {
            if (this.selectedBuilding) {
                const prevGroup = this.getBuildingElement(this.selectedBuilding.id);
                if (prevGroup) prevGroup.classList.remove('selected');
            }

            this.selectedBuilding = this.buildings.find(b => b.id === id) || null;

            if (this.selectedBuilding) {
                const group = this.getBuildingElement(this.selectedBuilding.id);
                if (group) group.classList.add('selected');
            }

            if (this.onBuildingSelect) {
                this.onBuildingSelect(this.selectedBuilding);
            }
        }

        deselectAll(silent) {
            if (this.selectedBuilding) {
                const group = this.getBuildingElement(this.selectedBuilding.id);
                if (group) group.classList.remove('selected');
            }
            this.selectedBuilding = null;

            if (!silent && this.onBuildingSelect) {
                this.onBuildingSelect(null);
            }
        }

        getBuildingElement(id) {
            return this.buildingsLayer.querySelector(`[data-id="${id}"]`);
        }

        updateBuilding(id, updates) {
            const building = this.buildings.find(b => b.id === id);
            if (!building) return;

            Object.assign(building, updates);

            if (updates.name !== undefined) {
                const group = this.getBuildingElement(id);
                if (group) {
                    const text = group.querySelector('.building-label');
                    if (text) text.textContent = building.name;
                }
            }

            this.notifyChange();
        }

        deleteBuilding(id) {
            const index = this.buildings.findIndex(b => b.id === id);
            if (index === -1) return;

            this.buildings.splice(index, 1);

            const element = this.getBuildingElement(id);
            if (element) element.remove();

            if (this.selectedBuilding && this.selectedBuilding.id === id) {
                this.selectedBuilding = null;
                if (this.onBuildingSelect) {
                    this.onBuildingSelect(null);
                }
            }

            this.notifyChange();
        }

        pointInPolygon(x, y, points) {
            let inside = false;
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                const xi = points[i].x, yi = points[i].y;
                const xj = points[j].x, yj = points[j].y;
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        getBuildingAtPoint(x, y) {
            return this.buildings.find(b => this.pointInPolygon(x, y, b.points)) || null;
        }

        notifyChange() {
            if (this.onBuildingsChange) {
                this.onBuildingsChange(this.buildings);
            }
        }

        getState() {
            return {
                buildings: JSON.parse(JSON.stringify(this.buildings)),
                buildingCounter: this.buildingCounter
            };
        }

        setState(state) {
            const groups = this.buildingsLayer.querySelectorAll('.building-group');
            groups.forEach(g => g.remove());

            this.buildings = [];
            this.selectedBuilding = null;

            state.buildings.forEach(data => {
                this.buildings.push(data);
                this.renderBuilding(data);
            });

            this.buildingCounter = state.buildingCounter || this.buildings.length;
            this.notifyChange();
        }

        reset() {
            const groups = this.buildingsLayer.querySelectorAll('.building-group');
            groups.forEach(g => g.remove());

            this.buildings = [];
            this.selectedBuilding = null;
            this.buildingCounter = 0;
            this.cancelPending();
            this.notifyChange();
        }
    }

    // ============ PIN MANAGER ============
    class PinManager {
        constructor(pinsLayer, mapManager) {
            this.pinsLayer = pinsLayer;
            this.mapManager = mapManager;
            this.pins = [];
            this.selectedPin = null;
            this.dropCounter = 0;
            this.cameraCounter = 0;
            this.switchCounter = 0;
            this.existingCameraCounter = 0;
            this.nvrCounter = 0;

            this.onPinSelect = null;
            this.onPinsChange = null;
            this.onPinDeleteRequest = null;

            this.dragState = {
                isDragging: false,
                pin: null,
                startX: 0,
                startY: 0,
                pinStartX: 0,
                pinStartY: 0
            };

            this.init();
        }

        init() {
            document.addEventListener('mousemove', (e) => this.handleDragMove(e));
            document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        }

        createPin(type, x, y, data = {}) {
            const id = `${type}-${Date.now()}`;
            let name;

            if (type === 'drop') {
                this.dropCounter++;
                name = data.name || `Drop-${this.dropCounter}`;
            } else if (type === 'camera') {
                this.cameraCounter++;
                name = data.name || `Camera-${this.cameraCounter}`;
            } else if (type === 'existing-camera') {
                this.existingCameraCounter++;
                name = data.name || `ExCam-${this.existingCameraCounter}`;
            } else if (type === 'switch') {
                this.switchCounter++;
                name = data.name || `Switch-${this.switchCounter}`;
            } else if (type === 'nvr') {
                this.nvrCounter++;
                name = data.name || `NVR-${this.nvrCounter}`;
            }

            const defaultPrice = type === 'existing-camera' ? 0
                : type === 'switch' ? DEFAULT_SWITCH_PRICE
                : type === 'nvr' ? DEFAULT_NVR_PRICE
                : DEFAULT_CAMERA_PRICE;

            const pin = {
                id,
                type,
                x,
                y,
                name,
                price: data.price !== undefined ? data.price : defaultPrice,
                linkedDrop: data.linkedDrop || '',
                pinScale: data.pinScale !== undefined ? data.pinScale : defaultPinScale,
                phase: data.phase || null,
                // FOV properties for cameras
                fovAngle: data.fovAngle || 0,
                fovSpread: data.fovSpread || 60,
                fovRange: data.fovRange || 100
            };

            this.pins.push(pin);
            this.renderPin(pin);
            this.notifyChange();

            return pin;
        }

        renderPin(pin) {
            const element = document.createElement('div');
            const isCamera = isCameraType(pin.type);
            if (isCamera) {
                element.className = 'pin camera-pin';
                if (pin.type === 'existing-camera') element.classList.add('existing-camera-pin');
            } else if (pin.type === 'switch') {
                element.className = 'pin switch-pin';
            } else if (pin.type === 'nvr') {
                element.className = 'pin nvr-pin';
            } else {
                element.className = 'pin';
            }
            element.dataset.id = pin.id;
            if (pin.phase) element.dataset.phase = pin.phase;
            element.style.left = `${pin.x}px`;
            element.style.top = `${pin.y}px`;
            element.style.setProperty('--pin-scale', pin.pinScale || 1);

            // Add FOV cone for cameras
            if (isCamera) {
                const fovCone = this.createFovCone(pin);
                element.appendChild(fovCone);
            }

            const icon = this.createPinIcon(pin.type);
            element.appendChild(icon);

            // Apply rotation to camera icon based on fovAngle
            if (isCamera) {
                icon.style.transform = `rotate(${pin.fovAngle - 90}deg)`;
            }

            const label = document.createElement('div');
            label.className = 'pin-label';
            label.textContent = pin.name;
            element.appendChild(label);

            element.addEventListener('mousedown', (e) => this.handlePinMouseDown(e, pin));
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectPin(pin.id);
            });

            const bounds = document.createElement('div');
            bounds.className = 'pin-bounds';
            element.appendChild(bounds);

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'pin-resize-handle';
            resizeHandle.addEventListener('mousedown', (e) => this.handleResizeDragStart(e, pin));
            element.appendChild(resizeHandle);

            this.pinsLayer.appendChild(element);
        }

        createFovCone(pin) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'fov-cone');
            svg.style.overflow = 'visible';
            svg.style.position = 'absolute';
            svg.style.left = '50%';
            svg.style.top = '50%';
            svg.style.width = '1px';
            svg.style.height = '1px';
            svg.style.pointerEvents = 'none';

            this.updateFovConeShape(svg, pin);

            return svg;
        }

        updateFovConeShape(svg, pin) {
            const range = pin.fovRange;
            const spreadRad = (pin.fovSpread / 2) * Math.PI / 180;
            const angleRad = (pin.fovAngle - 90) * Math.PI / 180; // -90 so 0 degrees points up

            // Lens origin offset: camera body front at x=18 of 24-unit viewBox in 28px pin
            // Offset from center along FOV direction = (18-12)/24 * 28 = 7 image-pixels
            const lensOffset = 7;
            const ox = lensOffset * Math.cos(angleRad);
            const oy = lensOffset * Math.sin(angleRad);

            // Calculate cone points (offset from lens position)
            const leftAngle = angleRad - spreadRad;
            const rightAngle = angleRad + spreadRad;

            const x1 = Math.cos(leftAngle) * range + ox;
            const y1 = Math.sin(leftAngle) * range + oy;
            const x2 = Math.cos(rightAngle) * range + ox;
            const y2 = Math.sin(rightAngle) * range + oy;

            // Calculate spread handle positions (at 70% of range on the edges)
            const spreadHandleRange = range * 0.7;
            const leftHandleX = Math.cos(leftAngle) * spreadHandleRange + ox;
            const leftHandleY = Math.sin(leftAngle) * spreadHandleRange + oy;
            const rightHandleX = Math.cos(rightAngle) * spreadHandleRange + ox;
            const rightHandleY = Math.sin(rightAngle) * spreadHandleRange + oy;

            // Create arc for the cone edge
            const largeArc = pin.fovSpread > 180 ? 1 : 0;

            // Store reference to this for event handlers
            const pinManager = this;

            svg.innerHTML = `
                <path class="fov-cone-shape" d="M ${ox} ${oy} L ${x1} ${y1} A ${range} ${range} 0 ${largeArc} 1 ${x2} ${y2} Z"/>
                <circle class="fov-handle fov-range-handle" cx="${Math.cos(angleRad) * range + ox}" cy="${Math.sin(angleRad) * range + oy}" r="8" data-pin-id="${pin.id}" data-handle="range"/>
                <circle class="fov-handle fov-spread-handle" cx="${leftHandleX}" cy="${leftHandleY}" r="6" data-pin-id="${pin.id}" data-handle="spread-left"/>
                <circle class="fov-handle fov-spread-handle" cx="${rightHandleX}" cy="${rightHandleY}" r="6" data-pin-id="${pin.id}" data-handle="spread-right"/>
            `;

            // Add drag handlers - need to re-add because innerHTML clears them
            const rangeHandle = svg.querySelector('.fov-range-handle');
            if (rangeHandle) {
                rangeHandle.addEventListener('mousedown', (e) => pinManager.handleFovDragStart(e, pin, 'range'));
            }

            const spreadHandles = svg.querySelectorAll('.fov-spread-handle');
            spreadHandles.forEach(handle => {
                handle.addEventListener('mousedown', (e) => pinManager.handleFovDragStart(e, pin, 'spread'));
            });
        }

        handleFovDragStart(e, pin, handleType = 'range') {
            e.preventDefault();
            e.stopPropagation();

            const handle = e.target;
            handle.classList.add('dragging');

            const pinElement = this.getPinElement(pin.id);
            if (!pinElement) return;

            const onMove = (moveEvent) => {
                const rect = pinElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // Calculate angle and distance from center to mouse
                const dx = moveEvent.clientX - centerX;
                const dy = moveEvent.clientY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy) / (this.mapManager.scale * (pin.pinScale || 1));
                let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // +90 to make 0 point up

                // Normalize to 0-360
                if (angle < 0) angle += 360;

                if (handleType === 'range') {
                    // Update both angle and range
                    pin.fovAngle = Math.round(angle);
                    pin.fovRange = Math.round(Math.max(20, Math.min(500, distance)));

                    // Also rotate the camera icon
                    const icon = pinElement.querySelector('.pin-icon');
                    if (icon) {
                        icon.style.transform = `rotate(${pin.fovAngle - 90}deg)`;
                    }

                    // Update properties panel
                    if (this.selectedPin && this.selectedPin.id === pin.id) {
                        const angleInput = document.getElementById('fovAngle');
                        const rangeInput = document.getElementById('fovRange');
                        if (angleInput) angleInput.value = pin.fovAngle;
                        if (rangeInput) rangeInput.value = pin.fovRange;
                    }
                } else if (handleType === 'spread') {
                    // Calculate angle difference from current fov angle to mouse position
                    const currentAngleRad = (pin.fovAngle - 90) * Math.PI / 180;
                    const mouseAngleRad = Math.atan2(dy, dx);

                    // Calculate the angular difference
                    let angleDiff = Math.abs(mouseAngleRad - currentAngleRad) * 180 / Math.PI;

                    // Normalize the difference
                    if (angleDiff > 180) angleDiff = 360 - angleDiff;

                    // Double it to get the full spread (since we're measuring from center to edge)
                    const newSpread = Math.round(Math.max(10, Math.min(180, angleDiff * 2)));
                    pin.fovSpread = newSpread;

                    // Update properties panel
                    if (this.selectedPin && this.selectedPin.id === pin.id) {
                        const spreadInput = document.getElementById('fovSpread');
                        if (spreadInput) spreadInput.value = pin.fovSpread;
                    }
                }

                // Update the cone visual
                const svg = pinElement.querySelector('.fov-cone');
                if (svg) {
                    this.updateFovConeShape(svg, pin);
                }
            };

            const onUp = () => {
                handle.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.notifyChange();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }

        updatePinFov(pin) {
            const element = this.getPinElement(pin.id);
            if (!element) return;

            const svg = element.querySelector('.fov-cone');
            if (svg) {
                this.updateFovConeShape(svg, pin);
            }

            // Also rotate the camera icon to match the FOV angle
            const icon = element.querySelector('.pin-icon');
            if (icon) {
                icon.style.transform = `rotate(${pin.fovAngle - 90}deg)`;
            }
        }

        handleResizeDragStart(e, pin) {
            e.preventDefault();
            e.stopPropagation();

            const element = this.getPinElement(pin.id);
            if (!element) return;

            element.classList.add('resizing');

            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const startDist = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) +
                Math.pow(e.clientY - centerY, 2)
            );
            if (startDist < 1) return;
            const startScale = pin.pinScale || 1;

            const onMove = (moveEvent) => {
                const currentDist = Math.sqrt(
                    Math.pow(moveEvent.clientX - centerX, 2) +
                    Math.pow(moveEvent.clientY - centerY, 2)
                );
                const ratio = currentDist / startDist;
                pin.pinScale = Math.max(0.3, Math.min(5, Math.round(startScale * ratio * 100) / 100));
                element.style.setProperty('--pin-scale', pin.pinScale);
                defaultPinScale = pin.pinScale;
            };

            const onUp = () => {
                element.classList.remove('resizing');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.notifyChange();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }

        createPinIcon(type) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'pin-icon');

            if (type === 'drop') {
                svg.setAttribute('viewBox', '0 0 24 32');
                svg.innerHTML = `
                    <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12z" fill="#3b82f6"/>
                    <circle cx="12" cy="12" r="6" fill="#1d4ed8"/>
                    <circle cx="12" cy="12" r="3" fill="white"/>
                `;
            } else if (type === 'existing-camera') {
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.innerHTML = `
                    <rect x="2" y="6" width="16" height="12" rx="2" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
                    <path d="M18 9 L22 7 L22 17 L18 15 Z" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
                    <circle cx="9" cy="12" r="3" fill="#16a34a"/>
                    <circle cx="9" cy="12" r="1.5" fill="#86efac"/>
                `;
            } else if (type === 'switch') {
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.innerHTML = `
                    <rect x="2" y="7" width="20" height="10" rx="2" fill="#8b5cf6" stroke="#6d28d9" stroke-width="1"/>
                    <circle cx="6" cy="12" r="1.5" fill="#a78bfa"/>
                    <circle cx="10" cy="12" r="1.5" fill="#a78bfa"/>
                    <circle cx="14" cy="12" r="1.5" fill="#a78bfa"/>
                    <circle cx="18" cy="12" r="1.5" fill="#a78bfa"/>
                `;
            } else if (type === 'nvr') {
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.innerHTML = `
                    <rect x="3" y="4" width="18" height="16" rx="2" fill="#f59e0b" stroke="#d97706" stroke-width="1"/>
                    <rect x="6" y="7" width="12" height="3" rx="1" fill="#d97706"/>
                    <rect x="6" y="12" width="12" height="3" rx="1" fill="#d97706"/>
                    <circle cx="16" cy="18" r="1.5" fill="#fbbf24"/>
                `;
            } else {
                // Camera icon
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.innerHTML = `
                    <rect x="2" y="6" width="16" height="12" rx="2" fill="#ef4444" stroke="#b91c1c" stroke-width="1"/>
                    <path d="M18 9 L22 7 L22 17 L18 15 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1"/>
                    <circle cx="9" cy="12" r="3" fill="#b91c1c"/>
                    <circle cx="9" cy="12" r="1.5" fill="#fca5a5"/>
                `;
            }

            return svg;
        }

        handlePinMouseDown(e, pin) {
            if (this.mapManager.mode !== 'select') return;
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            this.dragState = {
                isDragging: false,
                pin: pin,
                startX: e.clientX,
                startY: e.clientY,
                pinStartX: pin.x,
                pinStartY: pin.y
            };
        }

        handleDragMove(e) {
            if (!this.dragState.pin) return;

            const dx = e.clientX - this.dragState.startX;
            const dy = e.clientY - this.dragState.startY;

            if (!this.dragState.isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                this.dragState.isDragging = true;
                const element = this.getPinElement(this.dragState.pin.id);
                if (element) element.classList.add('dragging');
            }

            if (this.dragState.isDragging) {
                const scale = this.mapManager.scale;
                const newX = this.dragState.pinStartX + dx / scale;
                const newY = this.dragState.pinStartY + dy / scale;

                this.dragState.pin.x = newX;
                this.dragState.pin.y = newY;

                const element = this.getPinElement(this.dragState.pin.id);
                if (element) {
                    element.style.left = `${newX}px`;
                    element.style.top = `${newY}px`;
                }
            }
        }

        handleDragEnd(e) {
            if (this.dragState.pin) {
                const element = this.getPinElement(this.dragState.pin.id);
                if (element) element.classList.remove('dragging');

                if (this.dragState.isDragging) {
                    this.notifyChange();
                }
            }

            this.dragState = {
                isDragging: false,
                pin: null,
                startX: 0,
                startY: 0,
                pinStartX: 0,
                pinStartY: 0
            };
        }

        getPinElement(id) {
            return this.pinsLayer.querySelector(`[data-id="${id}"]`);
        }

        selectPin(id) {
            console.log('selectPin called with id:', id);

            if (this.selectedPin) {
                const prevElement = this.getPinElement(this.selectedPin.id);
                if (prevElement) prevElement.classList.remove('selected');
            }

            this.selectedPin = this.pins.find(p => p.id === id) || null;
            console.log('selectedPin:', this.selectedPin);

            if (this.selectedPin) {
                const element = this.getPinElement(this.selectedPin.id);
                if (element) element.classList.add('selected');
            }

            if (this.onPinSelect) {
                console.log('Calling onPinSelect callback');
                this.onPinSelect(this.selectedPin);
            } else {
                console.log('No onPinSelect callback set!');
            }
        }

        deselectAll(silent) {
            if (this.selectedPin) {
                const element = this.getPinElement(this.selectedPin.id);
                if (element) element.classList.remove('selected');
            }
            this.selectedPin = null;

            if (!silent && this.onPinSelect) {
                this.onPinSelect(null);
            }
        }

        updatePin(id, updates) {
            const pin = this.pins.find(p => p.id === id);
            if (!pin) return;

            Object.assign(pin, updates);

            if (updates.name !== undefined) {
                const element = this.getPinElement(id);
                if (element) {
                    const label = element.querySelector('.pin-label');
                    if (label) label.textContent = pin.name;
                }
            }

            // Update phase data attribute if changed
            if (updates.phase !== undefined) {
                const phaseEl = this.getPinElement(id);
                if (phaseEl) {
                    if (pin.phase) {
                        phaseEl.dataset.phase = pin.phase;
                    } else {
                        delete phaseEl.dataset.phase;
                    }
                }
            }

            // Update pin scale CSS variable if changed
            if (updates.pinScale !== undefined) {
                const scaleEl = this.getPinElement(id);
                if (scaleEl) scaleEl.style.setProperty('--pin-scale', pin.pinScale);
            }

            // Update FOV cone if any FOV property changed
            if (updates.fovAngle !== undefined || updates.fovSpread !== undefined || updates.fovRange !== undefined) {
                this.updatePinFov(pin);
            }

            this.notifyChange();
        }

        deletePin(id) {
            const index = this.pins.findIndex(p => p.id === id);
            if (index === -1) return;

            const pin = this.pins[index];
            this.pins.splice(index, 1);

            const element = this.getPinElement(id);
            if (element) element.remove();

            if (this.selectedPin && this.selectedPin.id === id) {
                this.selectedPin = null;
                if (this.onPinSelect) {
                    this.onPinSelect(null);
                }
            }

            if (pin.type === 'drop') {
                this.pins.forEach(p => {
                    if (isCameraType(p.type) && p.linkedDrop === id) {
                        p.linkedDrop = '';
                    }
                });
            }

            this.notifyChange();
        }

        getDrops() {
            return this.pins.filter(p => p.type === 'drop');
        }

        getCameras() {
            return this.pins.filter(p => p.type === 'camera');
        }

        notifyChange() {
            if (this.onPinsChange) {
                this.onPinsChange(this.pins);
            }
        }

        getState() {
            return {
                pins: JSON.parse(JSON.stringify(this.pins)),
                dropCounter: this.dropCounter,
                cameraCounter: this.cameraCounter,
                switchCounter: this.switchCounter,
                existingCameraCounter: this.existingCameraCounter,
                nvrCounter: this.nvrCounter,
                defaultPinScale: defaultPinScale
            };
        }

        setState(state) {
            this.pinsLayer.innerHTML = '';
            this.pins = [];
            this.selectedPin = null;

            state.pins.forEach(pinData => {
                // Backward compatibility: convert old cameraType/customPrice to new price field
                if (pinData.price === undefined && pinData.type === 'camera') {
                    if (pinData.cameraType === 'custom') {
                        pinData.price = pinData.customPrice || 0;
                    } else {
                        // Default prices for old camera types
                        const oldPrices = {
                            'basic-indoor': 150,
                            'basic-outdoor': 200,
                            'ptz-indoor': 400,
                            'ptz-outdoor': 500
                        };
                        pinData.price = oldPrices[pinData.cameraType] || DEFAULT_CAMERA_PRICE;
                    }
                }
                this.pins.push(pinData);
                this.renderPin(pinData);
            });

            this.dropCounter = state.dropCounter || this.pins.filter(p => p.type === 'drop').length;
            this.cameraCounter = state.cameraCounter || this.pins.filter(p => p.type === 'camera').length;
            this.switchCounter = state.switchCounter || this.pins.filter(p => p.type === 'switch').length;
            this.existingCameraCounter = state.existingCameraCounter || this.pins.filter(p => p.type === 'existing-camera').length;
            this.nvrCounter = state.nvrCounter || this.pins.filter(p => p.type === 'nvr').length;

            if (state.defaultPinScale !== undefined) {
                defaultPinScale = state.defaultPinScale;
            }

            this.notifyChange();
        }

        reset() {
            this.pinsLayer.innerHTML = '';
            this.pins = [];
            this.selectedPin = null;
            this.dropCounter = 0;
            this.cameraCounter = 0;
            this.switchCounter = 0;
            this.existingCameraCounter = 0;
            this.nvrCounter = 0;
            defaultPinScale = 1;
            this.notifyChange();
        }
    }

    // ============ BUDGET MANAGER ============
    class BudgetManager {
        constructor() {
            this.connectionCost = 400;
            this.taxRate = 0;
            this.pins = [];
            this.connections = [];

            this.elements = {
                cameraCount: document.getElementById('cameraCount'),
                existingCameraCount: document.getElementById('existingCameraCount'),
                switchCount: document.getElementById('switchCount'),
                nvrCount: document.getElementById('nvrCount'),
                antennaCount: document.getElementById('antennaCount'),
                budgetBreakdown: document.getElementById('budgetBreakdown'),
                equipmentSubtotal: document.getElementById('equipmentSubtotal'),
                antennaSubtotal: document.getElementById('antennaSubtotal'),
                subtotal: document.getElementById('subtotal'),
                taxRateDisplay: document.getElementById('taxRateDisplay'),
                taxAmount: document.getElementById('taxAmount'),
                totalCost: document.getElementById('totalCost'),
                defaultCameraPriceInput: document.getElementById('defaultCameraPrice'),
                defaultSwitchPriceInput: document.getElementById('defaultSwitchPrice'),
                defaultNvrPriceInput: document.getElementById('defaultNvrPrice'),
                connectionCostInput: document.getElementById('connectionCost'),
                salesTaxRateInput: document.getElementById('salesTaxRate')
            };

            this.init();
        }

        init() {
            this.elements.defaultCameraPriceInput.addEventListener('change', (e) => {
                DEFAULT_CAMERA_PRICE = parseFloat(e.target.value) || 1500;
            });

            this.elements.defaultSwitchPriceInput.addEventListener('change', (e) => {
                DEFAULT_SWITCH_PRICE = parseFloat(e.target.value) || 1600;
            });

            this.elements.defaultNvrPriceInput.addEventListener('change', (e) => {
                DEFAULT_NVR_PRICE = parseFloat(e.target.value) || 3000;
            });

            this.elements.connectionCostInput.addEventListener('change', (e) => {
                this.connectionCost = parseFloat(e.target.value) || 0;
                this.update();
            });

            this.elements.salesTaxRateInput.addEventListener('change', (e) => {
                this.taxRate = parseFloat(e.target.value) || 0;
                this.update();
            });
        }

        setPins(pins) {
            this.pins = pins;
            this.update();
        }

        setConnections(connections) {
            this.connections = connections;
            this.update();
        }

        update() {
            const cameras = this.pins.filter(p => p.type === 'camera');
            const existingCameras = this.pins.filter(p => p.type === 'existing-camera');
            const switches = this.pins.filter(p => p.type === 'switch');
            const nvrs = this.pins.filter(p => p.type === 'nvr');
            const antennaCount = this.getAntennaCount();

            let cameraTotal = 0;
            cameras.forEach(c => { cameraTotal += c.price || 0; });

            let switchTotal = 0;
            switches.forEach(s => { switchTotal += s.price || 0; });

            let nvrTotal = 0;
            nvrs.forEach(n => { nvrTotal += n.price || 0; });

            const equipmentTotal = cameraTotal + switchTotal + nvrTotal;

            this.elements.cameraCount.textContent = cameras.length;
            this.elements.existingCameraCount.textContent = existingCameras.length;
            this.elements.switchCount.textContent = switches.length;
            this.elements.nvrCount.textContent = nvrs.length;
            this.elements.antennaCount.textContent = antennaCount;

            let breakdownHTML = '';
            if (cameras.length > 0) {
                breakdownHTML += `<div class="breakdown-item"><span>New Cameras x${cameras.length}</span><span>$${cameraTotal}</span></div>`;
            }
            if (switches.length > 0) {
                breakdownHTML += `<div class="breakdown-item"><span>Switches x${switches.length}</span><span>$${switchTotal}</span></div>`;
            }
            if (nvrs.length > 0) {
                breakdownHTML += `<div class="breakdown-item"><span>NVRs x${nvrs.length}</span><span>$${nvrTotal}</span></div>`;
            }
            this.elements.budgetBreakdown.innerHTML = breakdownHTML;

            const antennaTotal = antennaCount * this.connectionCost;
            const subtotal = equipmentTotal + antennaTotal;
            const taxAmount = Math.round(subtotal * (this.taxRate / 100) * 100) / 100;
            const total = subtotal + taxAmount;

            this.elements.equipmentSubtotal.textContent = `$${equipmentTotal}`;
            this.elements.antennaSubtotal.textContent = `$${antennaTotal}`;
            this.elements.subtotal.textContent = `$${subtotal}`;
            this.elements.taxRateDisplay.textContent = this.taxRate;
            this.elements.taxAmount.textContent = `$${taxAmount}`;
            this.elements.totalCost.textContent = `$${total}`;
        }

        // Count unique antenna endpoints from connections
        getAntennaCount() {
            const seen = new Set();
            this.connections.forEach(conn => {
                seen.add(`${conn.x1},${conn.y1}`);
                seen.add(`${conn.x2},${conn.y2}`);
            });
            return seen.size;
        }

        getState() {
            return {
                defaultCameraPrice: DEFAULT_CAMERA_PRICE,
                defaultSwitchPrice: DEFAULT_SWITCH_PRICE,
                defaultNvrPrice: DEFAULT_NVR_PRICE,
                connectionCost: this.connectionCost,
                taxRate: this.taxRate
            };
        }

        setState(state) {
            DEFAULT_CAMERA_PRICE = state.defaultCameraPrice || 1500;
            DEFAULT_SWITCH_PRICE = state.defaultSwitchPrice || 1600;
            DEFAULT_NVR_PRICE = state.defaultNvrPrice || 3000;
            this.connectionCost = state.connectionCost || 400;
            this.taxRate = state.taxRate || 0;
            this.elements.defaultCameraPriceInput.value = DEFAULT_CAMERA_PRICE;
            this.elements.defaultSwitchPriceInput.value = DEFAULT_SWITCH_PRICE;
            this.elements.defaultNvrPriceInput.value = DEFAULT_NVR_PRICE;
            this.elements.connectionCostInput.value = this.connectionCost;
            this.elements.salesTaxRateInput.value = this.taxRate;
        }

        reset() {
            this.pins = [];
            this.connections = [];
            DEFAULT_CAMERA_PRICE = 1500;
            DEFAULT_SWITCH_PRICE = 1600;
            DEFAULT_NVR_PRICE = 3000;
            this.connectionCost = 400;
            this.taxRate = 0;
            this.elements.defaultCameraPriceInput.value = 1500;
            this.elements.defaultSwitchPriceInput.value = 1600;
            this.elements.defaultNvrPriceInput.value = 3000;
            this.elements.connectionCostInput.value = 400;
            this.elements.salesTaxRateInput.value = 0;
            this.update();
        }
    }

    // ============ UI MANAGER ============
    class UIManager {
        constructor(pinManager, connectionManager, buildingManager) {
            this.pinManager = pinManager;
            this.connectionManager = connectionManager;
            this.buildingManager = buildingManager;

            this.elements = {
                pinList: document.getElementById('pinList'),
                propertiesSection: document.getElementById('propertiesSection'),
                pinName: document.getElementById('pinName'),
                cameraPrice: document.getElementById('cameraPrice'),
                cameraPriceRow: document.getElementById('cameraPriceRow'),
                linkedDrop: document.getElementById('linkedDrop'),
                linkedDropRow: document.getElementById('linkedDropRow'),
                fovAngle: document.getElementById('fovAngle'),
                fovAngleRow: document.getElementById('fovAngleRow'),
                fovSpread: document.getElementById('fovSpread'),
                fovSpreadRow: document.getElementById('fovSpreadRow'),
                fovRange: document.getElementById('fovRange'),
                fovRangeRow: document.getElementById('fovRangeRow'),
                pinPhase: document.getElementById('pinPhase'),
                pinPhaseRow: document.getElementById('pinPhaseRow'),
                deletePinBtn: document.getElementById('deletePinBtn'),
                confirmModal: document.getElementById('confirmModal'),
                confirmTitle: document.getElementById('confirmTitle'),
                confirmMessage: document.getElementById('confirmMessage'),
                confirmYes: document.getElementById('confirmYes'),
                confirmNo: document.getElementById('confirmNo')
            };

            this.currentSelection = null; // { type: 'pin' | 'connection', data: ... }

            this.init();
        }

        init() {
            this.elements.pinName.addEventListener('change', () => this.handleNameChange());
            this.elements.cameraPrice.addEventListener('change', () => this.handlePriceChange());
            this.elements.linkedDrop.addEventListener('change', () => this.handleLinkedDropChange());
            this.elements.fovAngle.addEventListener('input', () => this.handleFovChange());
            this.elements.fovSpread.addEventListener('input', () => this.handleFovChange());
            this.elements.fovRange.addEventListener('input', () => this.handleFovChange());
            this.elements.pinPhase.addEventListener('change', () => this.handlePhaseChange());
            this.elements.deletePinBtn.addEventListener('click', () => this.handleDeleteClick());
            this.elements.confirmNo.addEventListener('click', () => this.hideConfirmModal());

            // Add keyboard shortcut for delete
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (this.buildingManager && this.buildingManager.hasPendingPoints()) {
                        this.buildingManager.cancelPending();
                    }
                    if (this.buildingManager && this.buildingManager.rectOrigin) {
                        this.buildingManager.cancelRect();
                    }
                    return;
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Don't trigger if user is typing in an input
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    if (this.currentSelection) {
                        e.preventDefault();
                        this.handleDeleteClick();
                    }
                }
            });
        }

        updatePinList(pins, connections) {
            const buildings = this.buildingManager ? this.buildingManager.buildings : [];
            const hasItems = pins.length > 0 || connections.length > 0 || buildings.length > 0;

            if (!hasItems) {
                this.elements.pinList.innerHTML = '<p class="empty-message">No pins added yet</p>';
                return;
            }

            const drops = pins.filter(p => p.type === 'drop');
            const cameras = pins.filter(p => p.type === 'camera');
            const existingCameras = pins.filter(p => p.type === 'existing-camera');
            const switches = pins.filter(p => p.type === 'switch');
            const nvrs = pins.filter(p => p.type === 'nvr');

            let html = '';

            if (buildings.length > 0) {
                html += '<div class="pin-group-label" style="color: #06b6d4; font-size: 0.75rem; margin-bottom: 0.25rem;">Buildings</div>';
                buildings.forEach(building => {
                    const pinsInBuilding = pins.filter(p =>
                        this.buildingManager.pointInPolygon(p.x, p.y, building.points)
                    ).length;
                    html += this.createBuildingListItem(building, pinsInBuilding);
                });
            }

            if (drops.length > 0) {
                html += '<div class="pin-group-label" style="color: #3b82f6; font-size: 0.75rem; margin-bottom: 0.25rem;">Network Drops</div>';
                drops.forEach(pin => { html += this.createPinListItem(pin); });
            }

            if (cameras.length > 0) {
                html += '<div class="pin-group-label" style="color: #ef4444; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">New Cameras</div>';
                cameras.forEach(pin => { html += this.createPinListItem(pin); });
            }

            if (existingCameras.length > 0) {
                html += '<div class="pin-group-label" style="color: #22c55e; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">Existing Cameras</div>';
                existingCameras.forEach(pin => { html += this.createPinListItem(pin); });
            }

            if (switches.length > 0) {
                html += '<div class="pin-group-label" style="color: #8b5cf6; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">Switches</div>';
                switches.forEach(pin => { html += this.createPinListItem(pin); });
            }

            if (nvrs.length > 0) {
                html += '<div class="pin-group-label" style="color: #f59e0b; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">NVRs</div>';
                nvrs.forEach(pin => { html += this.createPinListItem(pin); });
            }

            if (connections.length > 0) {
                html += '<div class="pin-group-label" style="color: #f59e0b; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">Connections</div>';
                connections.forEach(conn => { html += this.createConnectionListItem(conn); });

                const antennas = this.connectionManager.getUniqueAntennas();
                if (antennas.length > 0) {
                    html += '<div class="pin-group-label" style="color: #f97316; font-size: 0.75rem; margin-top: 0.5rem; margin-bottom: 0.25rem;">PtP Antennas</div>';
                    antennas.forEach(ant => { html += this.createAntennaListItem(ant); });
                }
            }

            this.elements.pinList.innerHTML = html;

            // Add click handlers for pins
            this.elements.pinList.querySelectorAll('.pin-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.connectionManager.deselectAll();
                    if (this.buildingManager) this.buildingManager.deselectAll();
                    this.pinManager.selectPin(item.dataset.id);
                });
            });

            // Add click handlers for connections
            this.elements.pinList.querySelectorAll('.connection-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.pinManager.deselectAll();
                    if (this.buildingManager) this.buildingManager.deselectAll();
                    this.connectionManager.selectConnection(item.dataset.id);
                });
            });

            // Add click handlers for buildings
            this.elements.pinList.querySelectorAll('.building-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.pinManager.deselectAll();
                    this.connectionManager.deselectAll();
                    this.buildingManager.selectBuilding(item.dataset.id);
                });
            });

            // Update selected state
            if (this.pinManager.selectedPin) {
                const selectedItem = this.elements.pinList.querySelector(`.pin-list-item[data-id="${this.pinManager.selectedPin.id}"]`);
                if (selectedItem) selectedItem.classList.add('selected');
            }
            if (this.connectionManager.selectedConnection) {
                const selectedItem = this.elements.pinList.querySelector(`.connection-list-item[data-id="${this.connectionManager.selectedConnection.id}"]`);
                if (selectedItem) selectedItem.classList.add('selected');
            }
            if (this.buildingManager && this.buildingManager.selectedBuilding) {
                const selectedItem = this.elements.pinList.querySelector(`.building-list-item[data-id="${this.buildingManager.selectedBuilding.id}"]`);
                if (selectedItem) selectedItem.classList.add('selected');
            }
        }

        createPinListItem(pin) {
            let typeLabel;
            if (pin.type === 'drop') typeLabel = 'Network Drop';
            else if (pin.type === 'switch') typeLabel = `Switch ($${pin.price})`;
            else if (pin.type === 'nvr') typeLabel = `NVR ($${pin.price})`;
            else if (pin.type === 'existing-camera') typeLabel = `Existing Camera ($${pin.price})`;
            else typeLabel = `Camera ($${pin.price})`;

            let iconSvg;
            if (pin.type === 'drop') {
                iconSvg = `
                    <svg viewBox="0 0 24 32" style="width: 16px; height: 16px;">
                        <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12z" fill="#3b82f6"/>
                    </svg>
                `;
            } else if (pin.type === 'existing-camera') {
                iconSvg = `
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <rect x="2" y="6" width="16" height="12" rx="2" fill="#22c55e"/>
                        <path d="M18 9 L22 7 L22 17 L18 15 Z" fill="#22c55e"/>
                    </svg>
                `;
            } else if (pin.type === 'switch') {
                iconSvg = `
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <rect x="2" y="7" width="20" height="10" rx="2" fill="#8b5cf6"/>
                    </svg>
                `;
            } else if (pin.type === 'nvr') {
                iconSvg = `
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <rect x="3" y="4" width="18" height="16" rx="2" fill="#f59e0b"/>
                    </svg>
                `;
            } else {
                iconSvg = `
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <rect x="2" y="6" width="16" height="12" rx="2" fill="#ef4444"/>
                        <path d="M18 9 L22 7 L22 17 L18 15 Z" fill="#ef4444"/>
                    </svg>
                `;
            }

            return `
                <div class="pin-list-item" data-id="${pin.id}">
                    ${iconSvg}
                    <div class="pin-info">
                        <div>${pin.name}</div>
                        <div class="pin-type">${typeLabel}</div>
                    </div>
                </div>
            `;
        }

        createConnectionListItem(conn) {
            return `
                <div class="connection-list-item" data-id="${conn.id}">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <line x1="4" y1="12" x2="20" y2="12" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
                        <circle cx="4" cy="12" r="3" fill="#f59e0b"/>
                        <circle cx="20" cy="12" r="3" fill="#f59e0b"/>
                    </svg>
                    <div class="pin-info">
                        <div>${conn.name}</div>
                        <div class="pin-type">Point-to-Point</div>
                    </div>
                </div>
            `;
        }

        createAntennaListItem(antenna) {
            return `
                <div class="antenna-list-item" style="opacity: 0.85;">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <circle cx="12" cy="12" r="5" fill="none" stroke="#f97316" stroke-width="2"/>
                        <circle cx="12" cy="12" r="2" fill="#f97316"/>
                    </svg>
                    <div class="pin-info">
                        <div>${antenna.name}</div>
                        <div class="pin-type">PtP Antenna</div>
                    </div>
                </div>
            `;
        }

        createBuildingListItem(building, pinCount) {
            return `
                <div class="building-list-item" data-id="${building.id}">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;">
                        <polygon points="4,4 20,4 20,20 4,20" fill="none" stroke="#06b6d4" stroke-width="2"/>
                    </svg>
                    <div class="pin-info">
                        <div>${building.name}</div>
                        <div class="pin-type">${pinCount} pin${pinCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        }

        showBuildingProperties(building) {
            this.currentSelection = building ? { type: 'building', data: building } : null;

            if (!building) {
                if (!this.pinManager.selectedPin && !this.connectionManager.selectedConnection) {
                    this.elements.propertiesSection.style.display = 'none';
                }
                return;
            }

            this.elements.propertiesSection.style.display = 'block';
            this.elements.pinName.value = building.name;
            this.elements.cameraPriceRow.style.display = 'none';
            this.elements.linkedDropRow.style.display = 'none';
            this.elements.fovAngleRow.style.display = 'none';
            this.elements.fovSpreadRow.style.display = 'none';
            this.elements.fovRangeRow.style.display = 'none';
            this.elements.pinPhaseRow.style.display = 'none';

            this.elements.pinList.querySelectorAll('.pin-list-item, .connection-list-item, .building-list-item').forEach(item => {
                const isSelected = item.dataset.id === building.id;
                item.classList.toggle('selected', isSelected);
                if (isSelected) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        showPinProperties(pin) {
            console.log('showPinProperties called with pin:', pin);
            this.currentSelection = pin ? { type: 'pin', data: pin } : null;

            if (!pin) {
                if (!this.connectionManager.selectedConnection) {
                    this.elements.propertiesSection.style.display = 'none';
                }
                return;
            }

            console.log('Showing properties section');
            this.elements.propertiesSection.style.display = 'block';
            this.elements.pinName.value = pin.name;

            // Phase dropdown (shown for all pin types)
            this.elements.pinPhaseRow.style.display = 'block';
            this.updatePhaseOptions(pin);

            if (isCameraType(pin.type)) {
                this.elements.cameraPriceRow.style.display = 'block';
                this.elements.linkedDropRow.style.display = 'block';
                this.elements.fovAngleRow.style.display = 'block';
                this.elements.fovSpreadRow.style.display = 'block';
                this.elements.fovRangeRow.style.display = 'block';

                this.elements.cameraPrice.value = pin.price;
                this.elements.fovAngle.value = pin.fovAngle;
                this.elements.fovSpread.value = pin.fovSpread;
                this.elements.fovRange.value = pin.fovRange;

                this.updateLinkedDropOptions(pin);
            } else if (pin.type === 'switch' || pin.type === 'nvr') {
                this.elements.cameraPriceRow.style.display = 'block';
                this.elements.cameraPrice.value = pin.price;
                this.elements.linkedDropRow.style.display = 'none';
                this.elements.fovAngleRow.style.display = 'none';
                this.elements.fovSpreadRow.style.display = 'none';
                this.elements.fovRangeRow.style.display = 'none';
            } else {
                this.elements.cameraPriceRow.style.display = 'none';
                this.elements.linkedDropRow.style.display = 'none';
                this.elements.fovAngleRow.style.display = 'none';
                this.elements.fovSpreadRow.style.display = 'none';
                this.elements.fovRangeRow.style.display = 'none';
            }

            this.elements.pinList.querySelectorAll('.pin-list-item, .connection-list-item, .building-list-item').forEach(item => {
                const isSelected = item.dataset.id === pin.id;
                item.classList.toggle('selected', isSelected);
                if (isSelected) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        showConnectionProperties(connection) {
            this.currentSelection = connection ? { type: 'connection', data: connection } : null;

            if (!connection) {
                if (!this.pinManager.selectedPin) {
                    this.elements.propertiesSection.style.display = 'none';
                }
                return;
            }

            this.elements.propertiesSection.style.display = 'block';
            this.elements.pinName.value = connection.name;
            this.elements.cameraPriceRow.style.display = 'none';
            this.elements.linkedDropRow.style.display = 'none';
            this.elements.fovAngleRow.style.display = 'none';
            this.elements.fovSpreadRow.style.display = 'none';
            this.elements.fovRangeRow.style.display = 'none';
            this.elements.pinPhaseRow.style.display = 'none';

            this.elements.pinList.querySelectorAll('.pin-list-item, .connection-list-item, .building-list-item').forEach(item => {
                const isSelected = item.dataset.id === connection.id;
                item.classList.toggle('selected', isSelected);
                if (isSelected) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        updateLinkedDropOptions(cameraPin) {
            const drops = this.pinManager.getDrops();
            let options = '<option value="">-- Select Drop --</option>';

            drops.forEach(drop => {
                const selected = cameraPin.linkedDrop === drop.id ? 'selected' : '';
                options += `<option value="${drop.id}" ${selected}>${drop.name}</option>`;
            });

            this.elements.linkedDrop.innerHTML = options;
        }

        handleNameChange() {
            if (!this.currentSelection) return;

            if (this.currentSelection.type === 'pin') {
                this.pinManager.updatePin(this.currentSelection.data.id, {
                    name: this.elements.pinName.value
                });
            } else if (this.currentSelection.type === 'connection') {
                this.connectionManager.updateConnection(this.currentSelection.data.id, {
                    name: this.elements.pinName.value
                });
            } else if (this.currentSelection.type === 'building') {
                this.buildingManager.updateBuilding(this.currentSelection.data.id, {
                    name: this.elements.pinName.value
                });
            }
        }

        handlePriceChange() {
            if (!this.currentSelection || this.currentSelection.type !== 'pin') return;
            this.pinManager.updatePin(this.currentSelection.data.id, {
                price: parseFloat(this.elements.cameraPrice.value) || 0
            });
        }

        handleLinkedDropChange() {
            if (!this.currentSelection || this.currentSelection.type !== 'pin') return;
            this.pinManager.updatePin(this.currentSelection.data.id, {
                linkedDrop: this.elements.linkedDrop.value
            });
        }

        handleFovChange() {
            if (!this.currentSelection || this.currentSelection.type !== 'pin') return;
            if (!isCameraType(this.currentSelection.data.type)) return;

            this.pinManager.updatePin(this.currentSelection.data.id, {
                fovAngle: parseFloat(this.elements.fovAngle.value) || 0,
                fovSpread: parseFloat(this.elements.fovSpread.value) || 60,
                fovRange: parseFloat(this.elements.fovRange.value) || 100
            });
        }

        updatePhaseOptions(pin) {
            const phases = window.app ? window.app.phases : [];
            let options = '<option value="">-- Unassigned --</option>';
            phases.forEach(phase => {
                const selected = pin.phase === phase ? 'selected' : '';
                options += `<option value="${phase}" ${selected}>${phase}</option>`;
            });
            this.elements.pinPhase.innerHTML = options;
        }

        handlePhaseChange() {
            if (!this.currentSelection || this.currentSelection.type !== 'pin') return;
            const value = this.elements.pinPhase.value || null;
            this.pinManager.updatePin(this.currentSelection.data.id, { phase: value });
        }

        handleDeleteClick() {
            if (!this.currentSelection) return;

            const name = this.currentSelection.data.name;
            const type = this.currentSelection.type;
            const typeLabel = type === 'connection' ? 'Connection' : type === 'building' ? 'Building' : 'Pin';

            this.showConfirmModal(
                `Delete ${typeLabel}`,
                `Are you sure you want to delete "${name}"?`,
                () => {
                    if (type === 'pin') {
                        this.pinManager.deletePin(this.currentSelection.data.id);
                    } else if (type === 'connection') {
                        this.connectionManager.deleteConnection(this.currentSelection.data.id);
                    } else if (type === 'building') {
                        this.buildingManager.deleteBuilding(this.currentSelection.data.id);
                    }
                    this.hideConfirmModal();
                }
            );
        }

        showConfirmModal(title, message, onConfirm) {
            this.elements.confirmTitle.textContent = title;
            this.elements.confirmMessage.textContent = message;
            this.elements.confirmModal.style.display = 'flex';
            this.elements.confirmYes.onclick = onConfirm;
        }

        hideConfirmModal() {
            this.elements.confirmModal.style.display = 'none';
        }

        showNewProjectConfirm(onConfirm) {
            this.showConfirmModal(
                'New Project',
                'Are you sure you want to start a new project? All unsaved changes will be lost.',
                () => {
                    onConfirm();
                    this.hideConfirmModal();
                }
            );
        }

    }

    // ============ MAIN APP ============
    class App {
        constructor() {
            this.mapManager = new MapManager(
                document.getElementById('mapContainer'),
                document.getElementById('mapCanvas'),
                document.getElementById('layoutImage')
            );

            this.connectionManager = new ConnectionManager(
                document.getElementById('connectionsLayer'),
                this.mapManager
            );

            this.pinManager = new PinManager(
                document.getElementById('pinsLayer'),
                this.mapManager
            );

            this.buildingManager = new BuildingManager(
                document.getElementById('buildingsLayer'),
                this.mapManager
            );

            this.budgetManager = new BudgetManager();
            this.uiManager = new UIManager(this.pinManager, this.connectionManager, this.buildingManager);

            this.currentMode = 'select';
            this.imageDataURL = null;
            this.phases = [];
            this.phaseFilters = {};

            this.init();
        }

        init() {
            this.setupToolbarButtons();
            this.setupCallbacks();
        }

        setupToolbarButtons() {
            const uploadBtn = document.getElementById('uploadBtn');
            const imageUpload = document.getElementById('imageUpload');

            uploadBtn.addEventListener('click', () => imageUpload.click());
            imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));

            const addDropBtn = document.getElementById('addDropBtn');
            const addCameraBtn = document.getElementById('addCameraBtn');
            const addConnectionBtn = document.getElementById('addConnectionBtn');
            const addSwitchBtn = document.getElementById('addSwitchBtn');
            const addExistingCameraBtn = document.getElementById('addExistingCameraBtn');
            const addNvrBtn = document.getElementById('addNvrBtn');
            const addBuildingBtn = document.getElementById('addBuildingBtn');
            const addBuildingRectBtn = document.getElementById('addBuildingRectBtn');
            const selectModeBtn = document.getElementById('selectModeBtn');
            const panModeBtn = document.getElementById('panModeBtn');

            addDropBtn.addEventListener('click', () => this.setMode('add-drop'));
            addCameraBtn.addEventListener('click', () => this.setMode('add-camera'));
            addConnectionBtn.addEventListener('click', () => this.setMode('add-connection'));
            addSwitchBtn.addEventListener('click', () => this.setMode('add-switch'));
            addExistingCameraBtn.addEventListener('click', () => this.setMode('add-existing-camera'));
            addNvrBtn.addEventListener('click', () => this.setMode('add-nvr'));
            addBuildingBtn.addEventListener('click', () => this.setMode('add-building'));
            addBuildingRectBtn.addEventListener('click', () => this.setMode('add-building-rect'));
            selectModeBtn.addEventListener('click', () => this.setMode('select'));
            panModeBtn.addEventListener('click', () => this.setMode('pan'));

            const newProjectBtn = document.getElementById('newProjectBtn');
            const saveProjectBtn = document.getElementById('saveProjectBtn');
            const loadProjectBtn = document.getElementById('loadProjectBtn');
            const loadProjectInput = document.getElementById('loadProjectInput');

            const exportExcelBtn = document.getElementById('exportExcelBtn');

            newProjectBtn.addEventListener('click', () => this.newProject());
            saveProjectBtn.addEventListener('click', () => this.saveProject());
            loadProjectBtn.addEventListener('click', () => loadProjectInput.click());
            loadProjectInput.addEventListener('change', (e) => this.loadProject(e));
            exportExcelBtn.addEventListener('click', () => this.exportExcel());

            // Setup filter buttons
            this.setupFilterButtons();

            // Add Phase button
            document.getElementById('addPhaseBtn').addEventListener('click', () => this.addPhase());
        }

        setupFilterButtons() {
            const pinsLayer = document.getElementById('pinsLayer');
            const connectionsLayer = document.getElementById('connectionsLayer');
            const fovLayer = document.getElementById('fovLayer');

            const filterDropsBtn = document.getElementById('filterDropsBtn');
            const filterCamerasBtn = document.getElementById('filterCamerasBtn');
            const filterExistingCamerasBtn = document.getElementById('filterExistingCamerasBtn');
            const filterSwitchesBtn = document.getElementById('filterSwitchesBtn');
            const filterNvrsBtn = document.getElementById('filterNvrsBtn');
            const filterConnectionsBtn = document.getElementById('filterConnectionsBtn');
            const filterFovBtn = document.getElementById('filterFovBtn');

            const buildingsLayer = document.getElementById('buildingsLayer');
            const filterBuildingsBtn = document.getElementById('filterBuildingsBtn');

            // Track filter states
            this.filters = {
                drops: true,
                cameras: true,
                existingCameras: true,
                switches: true,
                nvrs: true,
                connections: true,
                fov: true,
                buildings: true
            };

            filterDropsBtn.addEventListener('click', () => {
                this.filters.drops = !this.filters.drops;
                filterDropsBtn.classList.toggle('active', this.filters.drops);
                pinsLayer.classList.toggle('hide-drops', !this.filters.drops);
            });

            filterCamerasBtn.addEventListener('click', () => {
                this.filters.cameras = !this.filters.cameras;
                filterCamerasBtn.classList.toggle('active', this.filters.cameras);
                pinsLayer.classList.toggle('hide-cameras', !this.filters.cameras);
            });

            filterExistingCamerasBtn.addEventListener('click', () => {
                this.filters.existingCameras = !this.filters.existingCameras;
                filterExistingCamerasBtn.classList.toggle('active', this.filters.existingCameras);
                pinsLayer.classList.toggle('hide-existing-cameras', !this.filters.existingCameras);
            });

            filterSwitchesBtn.addEventListener('click', () => {
                this.filters.switches = !this.filters.switches;
                filterSwitchesBtn.classList.toggle('active', this.filters.switches);
                pinsLayer.classList.toggle('hide-switches', !this.filters.switches);
            });

            filterNvrsBtn.addEventListener('click', () => {
                this.filters.nvrs = !this.filters.nvrs;
                filterNvrsBtn.classList.toggle('active', this.filters.nvrs);
                pinsLayer.classList.toggle('hide-nvrs', !this.filters.nvrs);
            });

            filterConnectionsBtn.addEventListener('click', () => {
                this.filters.connections = !this.filters.connections;
                filterConnectionsBtn.classList.toggle('active', this.filters.connections);
                connectionsLayer.classList.toggle('hidden', !this.filters.connections);
            });

            filterFovBtn.addEventListener('click', () => {
                this.filters.fov = !this.filters.fov;
                filterFovBtn.classList.toggle('active', this.filters.fov);
                pinsLayer.classList.toggle('hide-fov', !this.filters.fov);
            });

            filterBuildingsBtn.addEventListener('click', () => {
                this.filters.buildings = !this.filters.buildings;
                filterBuildingsBtn.classList.toggle('active', this.filters.buildings);
                buildingsLayer.classList.toggle('hidden', !this.filters.buildings);
            });
        }

        setupCallbacks() {
            this.mapManager.onPinPlacement = (type, x, y) => {
                this.pinManager.createPin(type, x, y);
            };

            this.mapManager.onConnectionPointPlacement = (x, y) => {
                if (this.connectionManager.hasPendingPoint()) {
                    this.connectionManager.completeConnection(x, y);
                } else {
                    this.connectionManager.startConnection(x, y);
                }
            };

            this.mapManager.onBuildingPointPlacement = (x, y) => {
                this.buildingManager.addPoint(x, y);
            };

            this.mapManager.onMouseMove = (x, y) => {
                this.connectionManager.updatePreview(x, y);
            };

            this.mapManager.onBuildingMouseMove = (x, y) => {
                this.buildingManager.updatePreviewLine(x, y);
            };

            this.mapManager.onRectBuildingDown = (x, y) => {
                this.buildingManager.startRect(x, y);
            };
            this.mapManager.onRectBuildingMove = (x, y) => {
                this.buildingManager.updateRect(x, y);
            };
            this.mapManager.onRectBuildingUp = (x, y) => {
                this.buildingManager.completeRect(x, y);
            };

            this.mapManager.onEmptyClick = () => {
                this.pinManager.deselectAll();
                this.connectionManager.deselectAll();
                this.buildingManager.deselectAll();
            };

            this.pinManager.onPinSelect = (pin) => {
                this.connectionManager.deselectAll(true);
                this.buildingManager.deselectAll(true);
                this.uiManager.showPinProperties(pin);
            };

            this.connectionManager.onConnectionSelect = (connection) => {
                this.pinManager.deselectAll(true);
                this.buildingManager.deselectAll(true);
                this.uiManager.showConnectionProperties(connection);
            };

            this.buildingManager.onBuildingSelect = (building) => {
                this.pinManager.deselectAll(true);
                this.connectionManager.deselectAll(true);
                this.uiManager.showBuildingProperties(building);
            };

            this.pinManager.onPinsChange = (pins) => {
                this.uiManager.updatePinList(pins, this.connectionManager.connections);
                this.budgetManager.setPins(pins);
                this.updatePinBuildingAssociations();
                this.applyPhaseFilters();
            };

            this.connectionManager.onConnectionsChange = (connections) => {
                this.uiManager.updatePinList(this.pinManager.pins, connections);
                this.budgetManager.setConnections(connections);
            };

            this.buildingManager.onBuildingsChange = (buildings) => {
                this.uiManager.updatePinList(this.pinManager.pins, this.connectionManager.connections);
                this.updatePinBuildingAssociations();
            };
        }

        setMode(mode) {
            // Cancel pending connection if switching away from add-connection mode
            if (this.currentMode === 'add-connection' && mode !== 'add-connection') {
                this.connectionManager.cancelPending();
            }
            // Cancel pending building if switching away from add-building mode
            if (this.currentMode === 'add-building' && mode !== 'add-building') {
                this.buildingManager.cancelPending();
            }
            if (this.currentMode === 'add-building-rect' && mode !== 'add-building-rect') {
                this.buildingManager.cancelRect();
            }

            this.currentMode = mode;
            this.mapManager.setMode(mode);

            const buttons = {
                'select': document.getElementById('selectModeBtn'),
                'pan': document.getElementById('panModeBtn'),
                'add-drop': document.getElementById('addDropBtn'),
                'add-camera': document.getElementById('addCameraBtn'),
                'add-connection': document.getElementById('addConnectionBtn'),
                'add-switch': document.getElementById('addSwitchBtn'),
                'add-existing-camera': document.getElementById('addExistingCameraBtn'),
                'add-nvr': document.getElementById('addNvrBtn'),
                'add-building': document.getElementById('addBuildingBtn'),
                'add-building-rect': document.getElementById('addBuildingRectBtn')
            };

            Object.entries(buttons).forEach(([btnMode, btn]) => {
                btn.classList.toggle('active', btnMode === mode);
            });

            if (mode !== 'select') {
                this.pinManager.deselectAll();
                this.connectionManager.deselectAll();
            }
        }

        async handleImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            try {
                this.imageDataURL = await this.mapManager.loadImage(file);
                this.setMode('select');
            } catch (error) {
                console.error('Failed to load image:', error);
                alert('Failed to load image. Please try another file.');
            }

            e.target.value = '';
        }

        newProject() {
            this.uiManager.showNewProjectConfirm(() => {
                this.mapManager.reset();
                this.pinManager.reset();
                this.connectionManager.reset();
                this.buildingManager.reset();
                this.budgetManager.reset();
                this.imageDataURL = null;
                this.phases = [];
                this.phaseFilters = {};
                this.renderPhaseFilters();
                this.setMode('select');
            });
        }

        saveProject() {
            const project = {
                version: 1,
                image: this.imageDataURL,
                pins: this.pinManager.getState(),
                connections: this.connectionManager.getState(),
                buildings: this.buildingManager.getState(),
                budget: this.budgetManager.getState(),
                map: this.mapManager.getState(),
                phases: this.phases
            };

            const json = JSON.stringify(project, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `camera-project-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);
        }

        exportExcel() {
            const typeLabels = {
                'camera': 'New Camera',
                'existing-camera': 'Existing Camera',
                'switch': 'Network Switch',
                'nvr': 'NVR',
                'drop': 'Network Drop'
            };

            // Build rows: one per pin, resolve building name
            const rows = this.pinManager.pins.map(pin => {
                const building = this.buildingManager.getBuildingAtPoint(pin.x, pin.y);
                return {
                    building: building ? building.name : '',
                    type: typeLabels[pin.type] || pin.type,
                    name: pin.name,
                    cost: pin.price || 0,
                    phase: pin.phase || ''
                };
            });

            // Add unique antennas as rows (cost per antenna, not per connection)
            const antennaCost = this.budgetManager.connectionCost;
            const antennas = this.connectionManager.getUniqueAntennas();
            antennas.forEach(ant => {
                rows.push({
                    building: '',
                    type: 'PtP Antenna',
                    name: ant.name,
                    cost: antennaCost
                });
            });

            // Sort by building (empty last), then type, then name
            rows.sort((a, b) => {
                const bldgA = a.building || '\uffff';
                const bldgB = b.building || '\uffff';
                return bldgA.localeCompare(bldgB) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
            });

            // Summary: group by (building, type)
            const summary = {};
            let grandTotal = 0;
            rows.forEach(r => {
                const key = `${r.building}|||${r.type}`;
                if (!summary[key]) summary[key] = { building: r.building, type: r.type, qty: 0, total: 0 };
                summary[key].qty++;
                summary[key].total += r.cost;
                grandTotal += r.cost;
            });

            // CSV escape helper
            const esc = (v) => {
                const s = String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
            };

            const lines = [];

            // Detail section
            lines.push(['Building', 'Type', 'Name', 'Unit Cost', 'Phase'].map(esc).join(','));
            rows.forEach(r => {
                lines.push([r.building, r.type, r.name, r.cost, r.phase].map(esc).join(','));
            });

            // Blank separator
            lines.push('');
            lines.push('');

            // Summary section
            lines.push(['Building', 'Type', 'Quantity', 'Total Cost'].map(esc).join(','));
            Object.values(summary).sort((a, b) => {
                const bA = a.building || '\uffff';
                const bB = b.building || '\uffff';
                return bA.localeCompare(bB) || a.type.localeCompare(b.type);
            }).forEach(s => {
                lines.push([s.building, s.type, s.qty, s.total].map(esc).join(','));
            });

            // Tax and grand total
            const taxRate = this.budgetManager.taxRate;
            const taxAmount = Math.round(grandTotal * (taxRate / 100) * 100) / 100;
            const grandTotalWithTax = grandTotal + taxAmount;

            lines.push('');
            lines.push(['', '', 'Subtotal', grandTotal].map(esc).join(','));
            lines.push(['', '', `Sales Tax (${taxRate}%)`, taxAmount].map(esc).join(','));
            lines.push(['', '', 'Grand Total', grandTotalWithTax].map(esc).join(','));

            const csv = lines.join('\r\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `camera-project-export-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }

        addPhase() {
            const name = prompt('Enter phase name:');
            if (!name || !name.trim()) return;
            const trimmed = name.trim();
            if (this.phases.includes(trimmed)) {
                alert('Phase already exists.');
                return;
            }
            this.phases.push(trimmed);
            this.phaseFilters[trimmed] = true;
            this.renderPhaseFilters();
        }

        removePhase(phase) {
            this.phases = this.phases.filter(p => p !== phase);
            delete this.phaseFilters[phase];
            // Unassign pins that had this phase
            this.pinManager.pins.forEach(pin => {
                if (pin.phase === phase) {
                    this.pinManager.updatePin(pin.id, { phase: null });
                }
            });
            this.renderPhaseFilters();
            this.applyPhaseFilters();
        }

        renderPhaseFilters() {
            const container = document.getElementById('phaseFilters');
            container.innerHTML = '';

            // "Unassigned" toggle
            const unassignedBtn = document.createElement('button');
            unassignedBtn.className = 'toolbar-btn filter-btn' + (this.phaseFilters['__unassigned__'] !== false ? ' active' : '');
            unassignedBtn.textContent = 'Unassigned';
            unassignedBtn.addEventListener('click', () => {
                const isActive = this.phaseFilters['__unassigned__'] !== false;
                this.phaseFilters['__unassigned__'] = !isActive;
                unassignedBtn.classList.toggle('active', !isActive);
                this.applyPhaseFilters();
            });
            container.appendChild(unassignedBtn);

            this.phases.forEach(phase => {
                const btn = document.createElement('button');
                btn.className = 'toolbar-btn filter-btn' + (this.phaseFilters[phase] !== false ? ' active' : '');
                btn.textContent = phase;
                btn.addEventListener('click', () => {
                    const isActive = this.phaseFilters[phase] !== false;
                    this.phaseFilters[phase] = !isActive;
                    btn.classList.toggle('active', !isActive);
                    this.applyPhaseFilters();
                });
                btn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`Remove phase "${phase}"? Pins assigned to it will become Unassigned.`)) {
                        this.removePhase(phase);
                    }
                });
                container.appendChild(btn);
            });
        }

        applyPhaseFilters() {
            const pinsLayer = document.getElementById('pinsLayer');
            // Check if any phase filter is off
            const anyPhaseFilterOff = this.phaseFilters['__unassigned__'] === false ||
                this.phases.some(p => this.phaseFilters[p] === false);

            if (!anyPhaseFilterOff) {
                // All phase filters on — remove all phase-hide classes
                pinsLayer.querySelectorAll('.pin[data-phase-hidden]').forEach(el => {
                    el.removeAttribute('data-phase-hidden');
                });
                return;
            }

            this.pinManager.pins.forEach(pin => {
                const el = this.pinManager.getPinElement(pin.id);
                if (!el) return;
                const phase = pin.phase;
                let visible;
                if (!phase) {
                    visible = this.phaseFilters['__unassigned__'] !== false;
                } else {
                    visible = this.phaseFilters[phase] !== false;
                }
                if (visible) {
                    el.removeAttribute('data-phase-hidden');
                } else {
                    el.setAttribute('data-phase-hidden', '');
                }
            });
        }

        updatePinBuildingAssociations() {
            this.pinManager.pins.forEach(pin => {
                const el = this.pinManager.getPinElement(pin.id);
                if (!el) return;
                const building = this.buildingManager.getBuildingAtPoint(pin.x, pin.y);
                if (building) {
                    el.setAttribute('data-building', building.id);
                } else {
                    el.removeAttribute('data-building');
                }
            });
        }

        async loadProject(e) {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const project = JSON.parse(text);

                if (project.image) {
                    await this.mapManager.loadImageFromDataURL(project.image);
                    this.imageDataURL = project.image;
                }

                if (project.pins) {
                    this.pinManager.setState(project.pins);
                }

                if (project.connections) {
                    this.connectionManager.setState(project.connections);
                }

                if (project.buildings) {
                    this.buildingManager.setState(project.buildings);
                }

                if (project.budget) {
                    this.budgetManager.setState(project.budget);
                }

                if (project.map) {
                    this.mapManager.setState(project.map);
                }

                if (project.phases) {
                    this.phases = project.phases;
                    this.phaseFilters = {};
                    this.phases.forEach(p => { this.phaseFilters[p] = true; });
                    this.renderPhaseFilters();
                }

                this.setMode('select');
            } catch (error) {
                console.error('Failed to load project:', error);
                alert('Failed to load project. The file may be corrupted or invalid.');
            }

            e.target.value = '';
        }
    }

    // Initialize app when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });

})();
