        class SVGEditor {
            constructor() {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.initialize());
                } else {
                    this.initialize();
                }
            }

            initialize() {
                this.init();
                this.setupEventListeners();
                this.initializeTools();
                this.history = [];
                this.historyIndex = -1;
                this.selectedElements = new Set();
                this.gridEnabled = false;
                this.snapEnabled = false;
                this.snapThreshold = 10;
                this.gridSize = 20;
                this.pathMode = false;
                this.currentPath = null;
                this.pathPoints = [];
                this.transformMode = false;
                this.selectionBox = null;
                this.selectionStart = null;
                this.tempPathSegment = null;				
                
                // Initialize SVG.js
                this.draw = SVG().addTo('#svg-container').size(800, 600);
                
                // Initial state
                this.saveState();
            }


            init() {
                this.container = document.getElementById('svg-container');
                this.workspace = document.getElementById('workspace');
                this.elementList = document.getElementById('element-list');
                this.propertiesPanel = document.getElementById('properties-panel');
                this.stylePanel = document.getElementById('style-panel');
                
                // Initialize SVG canvas
                this.initSVG();
                this.setupGrid();
                this.updateElementList();
            }

            initSVG() {
                const svgContent = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                        <defs>
                            <pattern id="grid-pattern" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
                                <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" 
                                      fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
                            </pattern>
                        </defs>
                        <g id="main-group"></g>
                    </svg>
                `;
                this.container.innerHTML = svgContent;
                this.svg = this.container.querySelector('svg');
            }
			
			
			setupGrid() {
                const grid = document.getElementById('grid');
                grid.innerHTML = `
                    <svg width="100%" height="100%">
                        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                    </svg>
                `;
                grid.style.display = this.gridEnabled ? 'block' : 'none';
            }

            setupEventListeners() {
                // Workspace pan and zoom
                this.workspace.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.handleZoom(e);
                    }
                });

                // Selection and transform events
                this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            }

            handleMouseDown(e) {
                if (this.currentTool === 'select') {
                    this.tools.select.mouseDown.call(this, e);
                } else if (this.currentTool === 'path') {
                    this.tools.path.mouseDown.call(this, e);
                } else if (this.currentTool === 'transform') {
                    this.tools.transform.mouseDown.call(this, e);
                }
            }

            handleMouseMove(e) {
                if (this.currentTool === 'select') {
                    this.tools.select.mouseMove.call(this, e);
                } else if (this.currentTool === 'path') {
                    this.tools.path.mouseMove.call(this, e);
                } else if (this.currentTool === 'transform') {
                    this.tools.transform.mouseMove.call(this, e);
                }
            }

            handleMouseUp(e) {
                if (this.currentTool === 'select') {
                    this.tools.select.mouseUp.call(this, e);
                } else if (this.currentTool === 'path') {
                    this.tools.path.mouseUp.call(this, e);
                } else if (this.currentTool === 'transform') {
                    this.tools.transform.mouseUp.call(this, e);
                }
            }



            handleKeyDown(e) {
                // Implement keyboard shortcuts here
                if (e.ctrlKey && e.key === 'z') {
                    this.undo();
                } else if (e.ctrlKey && e.key === 'y') {
                    this.redo();
                }
                // Add more shortcuts as needed
            }

            handleZoom(e) {
                // Implement zoom functionality
                const scale = e.deltaY > 0 ? 0.9 : 1.1;
                // Apply zoom to SVG viewBox or transform
            }



            updateSelection(e) {
                if (!this.selectionStart) return;

                const currentPos = this.getMousePosition(e);
                
                if (!this.selectionBox) {
                    this.selectionBox = this.draw.rect().fill('none').stroke({ color: '#00F', width: 1, dasharray: '5,5' });
                }

                const x = Math.min(this.selectionStart.x, currentPos.x);
                const y = Math.min(this.selectionStart.y, currentPos.y);
                const width = Math.abs(currentPos.x - this.selectionStart.x);
                const height = Math.abs(currentPos.y - this.selectionStart.y);

                this.selectionBox.move(x, y).size(width, height);

                // Select elements within the selection box
                this.selectedElements.clear();
                this.draw.find('*').forEach(element => {
                    if (this.elementInSelectionBox(element, x, y, width, height)) {
                        this.selectedElements.add(element);
                    }
                });

                this.updateElementList();
                console.log('Selection updated');
            }

            endSelection(e) {
                if (this.selectionBox) {
                    this.selectionBox.remove();
                    this.selectionBox = null;
                }
                this.selectionStart = null;
                this.updateTransformHandles();
                console.log('Selection ended');
            }

            previewPathSegment(e) {
                if (!this.pathMode || this.pathPoints.length === 0) return;

                const currentPos = this.getMousePosition(e);
                const lastPoint = this.pathPoints[this.pathPoints.length - 1];

                if (!this.tempPathSegment) {
                    this.tempPathSegment = this.draw.path().fill('none').stroke({ color: '#000', width: 2 });
                }

                let pathData = `M ${lastPoint.x} ${lastPoint.y} L ${currentPos.x} ${currentPos.y}`;
                this.tempPathSegment.plot(pathData);

                console.log('Path segment previewed');
            }

            completePathSegment(e) {
                if (!this.pathMode) return;

                const currentPos = this.getMousePosition(e);
                this.pathPoints.push(currentPos);

                if (this.tempPathSegment) {
                    this.tempPathSegment.remove();
                    this.tempPathSegment = null;
                }

                if (!this.currentPath) {
                    this.currentPath = this.draw.path().fill('none').stroke({ color: '#000', width: 2 });
                }

                let pathData = this.currentPath.array().toString();
                if (pathData.length === 0) {
                    pathData = `M ${currentPos.x} ${currentPos.y}`;
                } else {
                    pathData += ` L ${currentPos.x} ${currentPos.y}`;
                }

                this.currentPath.plot(pathData);

                console.log('Path segment completed');
            }

            elementInSelectionBox(element, x, y, width, height) {
                const bbox = element.bbox();
                return (
                    bbox.x >= x && bbox.x + bbox.width <= x + width &&
                    bbox.y >= y && bbox.y + bbox.height <= y + height
                );
            }
			

            // Implement missing methods
            addRect() {
                const rect = this.draw.rect(100, 50).move(50, 50).fill('#f06');
                this.saveState();
                this.updateElementList();
            }

            addCircle() {
                const circle = this.draw.circle(50).move(100, 100).fill('#0f6');
                this.saveState();
                this.updateElementList();
            }

            addText() {
                const text = this.draw.text('Hello, SVG!').move(50, 50).font({ size: 20 });
                this.saveState();
                this.updateElementList();
            }

            addEllipse() {
                const ellipse = this.draw.ellipse(150, 100).move(100, 100).fill('#4CAF50').stroke({ color: '#000', width: 2 });
                this.saveState();
                this.updateElementList();
            }

            addPolygon() {
                const polygon = this.draw.polygon('50,0 100,50 50,100 0,50').move(100, 100).fill('#9C27B0').stroke({ color: '#000', width: 2 });
                this.saveState();
                this.updateElementList();
            }

            addStar() {
                const star = this.draw.polygon('50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35').move(100, 100).fill('#FFD700').stroke({ color: '#000', width: 2 });
                this.saveState();
                this.updateElementList();
            }

            updateOpacity(value) {
                if (this.selectedElements.size === 1) {
                    const element = Array.from(this.selectedElements)[0];
                    element.opacity(value);
                    this.saveState();
                }
            }




            togglePanel(button) {
                const panel = button.closest('.panel').querySelector('.panel-content');
                panel.classList.toggle('expanded');
                button.querySelector('i').classList.toggle('fa-chevron-down');
                button.querySelector('i').classList.toggle('fa-chevron-up');
            }
			
			
			
            initializeTools() {
                this.currentTool = 'select';
                this.tools = {
                    select: {
                        mouseDown: (e) => this.startSelection(e),
                        mouseMove: (e) => this.updateSelection(e),
                        mouseUp: (e) => this.endSelection(e)
                    },
                    path: {
                        mouseDown: (e) => this.addPathPoint(e),
                        mouseMove: (e) => this.previewPathSegment(e),
                        mouseUp: (e) => this.completePathSegment(e)
                    },
                    transform: {
                        mouseDown: (e) => this.startTransform(e),
                        mouseMove: (e) => this.updateTransform(e),
                        mouseUp: (e) => this.endTransform(e)
                    }
                };
            }

            // Transform Tools Implementation
            startTransform(e) {
                if (!this.selectedElements.size) return;
                
                this.transformMode = true;
                this.transformStart = {
                    x: e.clientX,
                    y: e.clientY,
                    elements: new Map([...this.selectedElements].map(el => {
                        const transform = el.getAttribute('transform') || '';
                        return [el, { transform, bbox: el.getBBox() }];
                    }))
                };
            }

            updateTransform(e) {
                if (!this.transformMode) return;

                const dx = e.clientX - this.transformStart.x;
                const dy = e.clientY - this.transformStart.y;

                this.transformStart.elements.forEach((data, element) => {
                    const { transform, bbox } = data;
                    
                    switch (this.transformType) {
                        case 'move':
                            element.setAttribute('transform', 
                                `${transform} translate(${dx}, ${dy})`);
                            break;
                        case 'scale':
                            const sx = 1 + dx / bbox.width;
                            const sy = 1 + dy / bbox.height;
                            element.setAttribute('transform',
                                `${transform} scale(${sx}, ${sy})`);
                            break;
                        case 'rotate':
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            element.setAttribute('transform',
                                `${transform} rotate(${angle}, ${bbox.x + bbox.width/2}, ${bbox.y + bbox.height/2})`);
                            break;
                    }
                });
            }

            endTransform(e) {
                if (!this.transformMode) return;
                
                this.transformMode = false;
                this.saveState();
            }

            // Path Editing Implementation
            startPath() {
                this.currentTool = 'path';
                this.pathMode = true;
                this.pathPoints = [];
                this.currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                this.currentPath.setAttribute('fill', 'none');
                this.currentPath.setAttribute('stroke', '#000');
                this.currentPath.setAttribute('stroke-width', '2');
                this.svg.querySelector('#main-group').appendChild(this.currentPath);
            }

            addPathPoint(e) {
                if (!this.pathMode) return;

                const point = this.getMousePosition(e);
                this.pathPoints.push(point);
                this.updatePathPreview();
            }

            updatePathPreview() {
                if (this.pathPoints.length < 1) return;

                let d = `M ${this.pathPoints[0].x} ${this.pathPoints[0].y}`;
                
                for (let i = 1; i < this.pathPoints.length; i++) {
                    const p1 = this.pathPoints[i - 1];
                    const p2 = this.pathPoints[i];
                    
                    if (i === 1) {
                        d += ` L ${p2.x} ${p2.y}`;
                    } else {
                        const cp1x = p1.x + (p2.x - p1.x) / 3;
                        const cp1y = p1.y + (p2.y - p1.y) / 3;
                        const cp2x = p1.x + 2 * (p2.x - p1.x) / 3;
                        const cp2y = p1.y + 2 * (p2.y - p1.y) / 3;
                        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                    }
                }

                this.currentPath.setAttribute('d', d);
            }

            completePath() {
                if (!this.pathMode || this.pathPoints.length < 2) return;
                
                this.pathMode = false;
                this.currentPath.id = this.generateUniqueId('path');
                this.saveState();
                this.updateElementList();
            }

            // Gradient and Pattern Implementation
            addGradient(type = 'linear') {
                const defs = this.svg.querySelector('defs') || 
                            this.svg.insertBefore(document.createElementNS("http://www.w3.org/2000/svg", "defs"),
                                                this.svg.firstChild);

                const gradient = document.createElementNS("http://www.w3.org/2000/svg", 
                    type === 'linear' ? 'linearGradient' : 'radialGradient');
                
                const id = this.generateUniqueId('gradient');
                gradient.id = id;

                if (type === 'linear') {
                    gradient.setAttribute('x1', '0%');
                    gradient.setAttribute('y1', '0%');
                    gradient.setAttribute('x2', '100%');
                    gradient.setAttribute('y2', '0%');
                }

                const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop1.setAttribute('offset', '0%');
                stop1.setAttribute('stop-color', '#ffffff');

                const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop2.setAttribute('offset', '100%');
                stop2.setAttribute('stop-color', '#000000');

                gradient.appendChild(stop1);
                gradient.appendChild(stop2);
                defs.appendChild(gradient);

                return `url(#${id})`;
            }

            // Group Operations
            groupSelected() {
                if (this.selectedElements.size < 2) return;

                const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
                group.id = this.generateUniqueId('group');

                this.selectedElements.forEach(element => {
                    group.appendChild(element.cloneNode(true));
                    element.remove();
                });

                this.svg.querySelector('#main-group').appendChild(group);
                this.selectedElements.clear();
                this.selectedElements.add(group);
                
                this.saveState();
                this.updateElementList();
            }

            ungroupSelected() {
                if (this.selectedElements.size !== 1) return;
                
                const group = Array.from(this.selectedElements)[0];
                if (group.tagName.toLowerCase() !== 'g') return;

                const parent = group.parentNode;
                while (group.firstChild) {
                    const child = group.firstChild;
                    parent.appendChild(child);
                    this.selectedElements.add(child);
                }

                group.remove();
                this.selectedElements.delete(group);
                
                this.saveState();
                this.updateElementList();
            }


			deleteElement(id) {
				const element = document.getElementById(id);
				if (element) {
					this.selectedElements.delete(element);
					element.remove();
					this.saveState();
					this.updateElementList();
				}
			}

			selectElement(element) {
				if (event.ctrlKey) {
					if (this.selectedElements.has(element)) {
						this.selectedElements.delete(element);
					} else {
						this.selectedElements.add(element);
					}
				} else {
					this.selectedElements.clear();
					this.selectedElements.add(element);
				}
				
				this.updateElementList();
				this.updateTransformHandles();
				this.updateStylePanel();
			}


			updateElementList() {
				const elements = this.svg.querySelectorAll('#main-group > *');
				this.elementList.innerHTML = '';
				
				elements.forEach(element => {
					const item = document.createElement('div');
					item.className = 'element-item';
					if (this.selectedElements.has(element)) {
						item.classList.add('selected');
					}
					
					item.innerHTML = `
						<span>${element.id || element.tagName.toLowerCase()}</span>
						<div class="btn-group">
							<button class="btn btn-icon" onclick="editor.deleteElement('${element.id}')">
								<i class="fas fa-trash"></i>
							</button>
						</div>
					`;
					
					item.addEventListener('click', () => {
						this.selectElement(element);
					});
					
					this.elementList.appendChild(item);
				});
			}






            // Import/Export Functions
            importSVG() {
                const template = document.getElementById('import-dialog');
                const clone = template.content.cloneNode(true);
                document.body.appendChild(clone);
            }

            handleSVGImport() {
                const textarea = document.getElementById('svg-import');
                const svgContent = textarea.value.trim();

                if (!svgContent) return;

                try {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                    const importedSvg = svgDoc.documentElement;

                    // Clear existing content
                    const mainGroup = this.svg.querySelector('#main-group');
                    mainGroup.innerHTML = '';

                    // Import nodes
                    Array.from(importedSvg.childNodes).forEach(node => {
                        if (node.nodeType === 1 && node.tagName.toLowerCase() !== 'defs') {
                            mainGroup.appendChild(node.cloneNode(true));
                        }
                    });

                    this.saveState();
                    this.updateElementList();
                    document.querySelector('.dialog-overlay').remove();
                } catch (error) {
                    console.error('SVG import failed:', error);
                    alert('Invalid SVG content');
                }
            }

            exportSVG() {
                const svgData = new XMLSerializer().serializeToString(this.svg);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = 'drawing.svg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

// Additional Shape Tools
            addShape(type) {
                this.saveState();
                let shape;

                switch (type) {
                    case 'star':
                        shape = this.createStar();
                        break;
                    case 'polygon':
                        shape = this.createPolygon();
                        break;
                    case 'ellipse':
                        shape = this.createEllipse();
                        break;
                    default:
                        return;
                }

                shape.id = this.generateUniqueId(type);
                this.svg.querySelector('#main-group').appendChild(shape);
                this.updateElementList();
            }

            createStar(points = 5, outerRadius = 50, innerRadius = 25) {
                const center = { x: 100, y: 100 };
                let d = '';

                for (let i = 0; i < points * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI / points) * i;
                    const x = center.x + Math.cos(angle) * radius;
                    const y = center.y + Math.sin(angle) * radius;

                    d += (i === 0 ? 'M' : 'L') + `${x},${y}`;
                }
                d += 'Z';

                const star = document.createElementNS("http://www.w3.org/2000/svg", "path");
                star.setAttribute('d', d);
                star.setAttribute('fill', '#FFD700');
                star.setAttribute('stroke', '#000');
                star.setAttribute('stroke-width', '2');

                return star;
            }

            createPolygon(sides = 6, radius = 50) {
                const points = [];
                const center = { x: 100, y: 100 };

                for (let i = 0; i < sides; i++) {
                    const angle = (Math.PI * 2 * i) / sides;
                    points.push({
                        x: center.x + radius * Math.cos(angle),
                        y: center.y + radius * Math.sin(angle)
                    });
                }

                const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                polygon.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
                polygon.setAttribute('fill', '#9C27B0');
                polygon.setAttribute('stroke', '#000');
                polygon.setAttribute('stroke-width', '2');

                return polygon;
            }

            createEllipse() {
                const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                ellipse.setAttribute('cx', '100');
                ellipse.setAttribute('cy', '100');
                ellipse.setAttribute('rx', '75');
                ellipse.setAttribute('ry', '50');
                ellipse.setAttribute('fill', '#4CAF50');
                ellipse.setAttribute('stroke', '#000');
                ellipse.setAttribute('stroke-width', '2');

                return ellipse;
            }

            // Grid and Snap Functionality
            toggleGrid() {
                this.gridEnabled = !this.gridEnabled;
                document.getElementById('grid').style.display = 
                    this.gridEnabled ? 'block' : 'none';
            }

            toggleSnap() {
                this.snapEnabled = !this.snapEnabled;
                document.querySelector('[onclick="editor.toggleSnap()"]')
                    .classList.toggle('active');
            }

            snapToGrid(point) {
                if (!this.snapEnabled) return point;

                return {
                    x: Math.round(point.x / this.gridSize) * this.gridSize,
                    y: Math.round(point.y / this.gridSize) * this.gridSize
                };
            }

            findSnapPoints() {
                const snapPoints = [];
                const elements = this.svg.querySelectorAll('#main-group > *');

                elements.forEach(element => {
                    const bbox = element.getBBox();
                    snapPoints.push(
                        { x: bbox.x, y: bbox.y },                     // Top-left
                        { x: bbox.x + bbox.width, y: bbox.y },        // Top-right
                        { x: bbox.x, y: bbox.y + bbox.height },       // Bottom-left
                        { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // Bottom-right
                        { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 } // Center
                    );
                });

                return snapPoints;
            }

            // Selection and Transform Handles
            updateTransformHandles() {
                if (this.selectedElements.size !== 1) return;

                const element = Array.from(this.selectedElements)[0];
                const bbox = element.getBBox();
                const handles = document.getElementById('transform-controls');
                
                handles.innerHTML = `
                    <div class="transform-handle" style="left: ${bbox.x - 5}px; top: ${bbox.y - 5}px;" data-handle="tl"></div>
                    <div class="transform-handle" style="left: ${bbox.x + bbox.width - 5}px; top: ${bbox.y - 5}px;" data-handle="tr"></div>
                    <div class="transform-handle" style="left: ${bbox.x - 5}px; top: ${bbox.y + bbox.height - 5}px;" data-handle="bl"></div>
                    <div class="transform-handle" style="left: ${bbox.x + bbox.width - 5}px; top: ${bbox.y + bbox.height - 5}px;" data-handle="br"></div>
                    <div class="rotate-handle"></div>
                `;
            }

            // Style Panel Implementation
            updateStylePanel() {
                if (this.selectedElements.size !== 1) return;

                const element = Array.from(this.selectedElements)[0];
                const style = window.getComputedStyle(element);

                this.stylePanel.innerHTML = `
                    <div class="property-group">
                        <label class="property-label">Fill</label>
                        <div class="color-picker-wrapper" id="fill-picker"></div>
                    </div>
                    <div class="property-group">
                        <label class="property-label">Stroke</label>
                        <div class="color-picker-wrapper" id="stroke-picker"></div>
                        <input type="number" class="property-input" value="${element.getAttribute('stroke-width') || 1}"
                               onchange="editor.updateStrokeWidth(this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Opacity</label>
                        <input type="range" class="property-input" min="0" max="1" step="0.1"
                               value="${element.getAttribute('opacity') || 1}"
                               onchange="editor.updateOpacity(this.value)">
                    </div>
                `;

                this.initializeColorPickers();
            }

            initializeColorPickers() {
                const element = Array.from(this.selectedElements)[0];
                
                // Fill Color Picker
                new Pickr({
                    el: '#fill-picker',
                    theme: 'classic',
                    default: element.getAttribute('fill') || '#000000',
                    components: {
                        preview: true,
                        opacity: true,
                        hue: true,
                        interaction: {
                            hex: true,
                            rgba: true,
                            hsla: true,
                            input: true,
                            save: true
                        }
                    }
                }).on('save', (color) => {
                    this.updateFill(color.toHEXA().toString());
                });

                // Stroke Color Picker
                new Pickr({
                    el: '#stroke-picker',
                    theme: 'classic',
                    default: element.getAttribute('stroke') || '#000000',
                    components: {
                        preview: true,
                        opacity: true,
                        hue: true,
                        interaction: {
                            hex: true,
                            rgba: true,
                            hsla: true,
                            input: true,
                            save: true
                        }
                    }
                }).on('save', (color) => {
                    this.updateStroke(color.toHEXA().toString());
                });
            }

            // Utility Methods
            generateUniqueId(prefix) {
                let counter = 1;
                let id = `${prefix}-${counter}`;
                while (document.getElementById(id)) {
                    counter++;
                    id = `${prefix}-${counter}`;
                }
                return id;
            }

            getMousePosition(event) {
                const CTM = this.svg.getScreenCTM();
                return {
                    x: (event.clientX - CTM.e) / CTM.a,
                    y: (event.clientY - CTM.f) / CTM.d
                };
            }

            saveState() {
                const state = this.svg.innerHTML;
                this.history = this.history.slice(0, this.historyIndex + 1);
                this.history.push(state);
                this.historyIndex++;
            }

            undo() {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.svg.innerHTML = this.history[this.historyIndex];
                    this.selectedElements.clear();
                    this.updateElementList();
                }
            }

            redo() {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.svg.innerHTML = this.history[this.historyIndex];
                    this.selectedElements.clear();
                    this.updateElementList();
                }
            }
        }

        // Initialize the editor when the page loads
		
		let editor; // Define editor in global scope
		document.addEventListener('DOMContentLoaded', () => {
			editor = new SVGEditor();
		});
		