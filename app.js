// Global Error Logger for UI diagnostics
window.onerror = function(message, source, lineno, colno, error) {
    const errBox = document.getElementById('debugErrorLog');
    if (errBox) {
        errBox.textContent = `JS Error: ${message} (Línea ${lineno}:${colno})`;
        errBox.style.display = 'block';
    }
    return false;
};
window.onunhandledrejection = function(event) {
    const errBox = document.getElementById('debugErrorLog');
    if (errBox) {
        errBox.textContent = `Promise Reject: ${event.reason}`;
        errBox.style.display = 'block';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Safe Lucide Icons creator
    function safeCreateIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            try {
                lucide.createIcons();
            } catch (e) {
                console.warn('Lucide icons creation failed:', e);
            }
        }
    }

    // Initialize Lucide Icons
    safeCreateIcons();

    /* ==========================================
       GLOBAL STATE & CONFIG
       ========================================== */
    let canvasElements = [];
    let selectedElementId = null;
    let currentTool = 'select'; // select, rect, circle, triangle, star, text, pencil
    let activeCodeFormat = 'css'; // css, svg, json
    
    // Accessibility Hub State
    let micActive = false;
    let hoverReaderActive = false;
    let demoActive = false;
    let cameraActive = false;
    let webcamStream = null;
    let micInterval = null;
    let signTimeout = null;
    let hoverTimeout = null;
    let hoverSpeechTimeout = null;
    
    // UI Selectors
    const navTabs = document.querySelectorAll('.nav-tab');
    const workspaceTabs = document.querySelectorAll('.workspace-tab');
    const artboard = document.getElementById('artboard');
    const canvasContainer = document.getElementById('canvasContainer');
    const canvasPlaceholder = document.getElementById('canvasPlaceholder');
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const toolBtns = document.querySelectorAll('.tool-btn');
    
    // Inspector Selectors
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    const inspectorProperties = document.getElementById('inspectorProperties');
    const shapeX = document.getElementById('shapeX');
    const shapeY = document.getElementById('shapeY');
    const shapeW = document.getElementById('shapeW');
    const shapeH = document.getElementById('shapeH');
    const shapeFill = document.getElementById('shapeFill');
    const shapeFillHex = document.getElementById('shapeFillHex');
    const shapeRadius = document.getElementById('shapeRadius');
    const radiusVal = document.getElementById('radiusVal');
    const propRadiusGroup = document.getElementById('propRadiusGroup');
    const propTextGroup = document.getElementById('propTextGroup');
    const shapeText = document.getElementById('shapeText');
    const deleteSelectedBtn = document.getElementById('deleteSelected');
    const contrastBadge = document.getElementById('contrastBadge');
    
    // Gradient, Opacity, and Stroke Selectors
    const useGradient = document.getElementById('useGradient');
    const propColor2Group = document.getElementById('propColor2Group');
    const shapeFill2 = document.getElementById('shapeFill2');
    const shapeFill2Hex = document.getElementById('shapeFill2Hex');
    const shapeOpacity = document.getElementById('shapeOpacity');
    const opacityVal = document.getElementById('opacityVal');
    const propStrokeGroup = document.getElementById('propStrokeGroup');
    const shapeStroke = document.getElementById('shapeStroke');
    const strokeVal = document.getElementById('strokeVal');
    const propRadiusGroupLabel = document.getElementById('propRadiusGroup');
    const propGradientToggleGroup = document.getElementById('propGradientToggleGroup');
    const svgDrawLayer = document.getElementById('svgDrawLayer');
    const presetColors = document.querySelectorAll('.preset-color');
    
    // Code Exporter Selectors
    const drawerTabs = document.querySelectorAll('.drawer-tab');
    const codeOutput = document.getElementById('codeOutput');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    
    // Toast Notification
    const toastNotification = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');

    // Dismiss Hero Banner
    const heroBanner = document.getElementById('heroBanner');
    const closeHeroBtn = document.getElementById('closeHero');
    if (closeHeroBtn && heroBanner) {
        closeHeroBtn.addEventListener('click', () => {
            heroBanner.style.opacity = '0';
            setTimeout(() => {
                heroBanner.style.display = 'none';
            }, 300);
        });
    }

    /* ==========================================
       TOAST UTILITY
       ========================================== */
    function showToast(message) {
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    }

    /* ==========================================
       TAB SYSTEM
       ========================================== */
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            navTabs.forEach(t => t.classList.remove('active'));
            workspaceTabs.forEach(w => w.classList.remove('active-workspace'));
            
            tab.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) {
                targetEl.classList.add('active-workspace');
            }
            
            // Re-draw lucide icons inside dynamically shown components
            safeCreateIcons();
            
            // Update code output just in case
            if (targetTab === 'canvas-tab') {
                updateCodeOutput();
            }
        });
    });

    /* ==========================================
       DESIGN CANVAS TOOLBAR
       ========================================== */
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            if (!tool) return; // Ignore buttons like clear canvas
            
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = tool;
        });
    });

    /* ==========================================
       WCAG CONTRAST RATING CALCULATIONS
       ========================================== */
    function hexToRgb(hex) {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function calculateContrastRatio(hex1, hex2) {
        const rgb1 = hexToRgb(hex1);
        const rgb2 = hexToRgb(hex2);
        if (!rgb1 || !rgb2) return 1;
        
        const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
        
        const brightest = Math.max(l1, l2);
        const darkest = Math.min(l1, l2);
        
        return (brightest + 0.05) / (darkest + 0.05);
    }

    function checkContrastAccessibility(hexColor) {
        // Evaluate contrast against canvas background (#121018)
        const bgHex = '#121018';
        const ratio = calculateContrastRatio(hexColor, bgHex);
        
        contrastBadge.textContent = `${ratio.toFixed(1)}:1`;
        
        if (ratio >= 4.5) {
            contrastBadge.className = 'contrast-badge pass';
            contrastBadge.title = 'Pasa WCAG AA para texto normal y AAA para texto grande.';
        } else if (ratio >= 3) {
            contrastBadge.className = 'contrast-badge pass';
            contrastBadge.style.borderColor = 'var(--accent-orange)';
            contrastBadge.style.color = 'var(--accent-orange)';
            contrastBadge.style.backgroundColor = 'rgba(249, 115, 22, 0.1)';
            contrastBadge.title = 'Pasa WCAG AA únicamente para texto grande.';
        } else {
            contrastBadge.className = 'contrast-badge fail';
            contrastBadge.title = 'No cumple con las pautas WCAG de accesibilidad en pantallas oscuras.';
        }
    }

    /* ==========================================
       DESIGN CANVAS STATE & RENDERING
       ========================================== */
    function createShape(type, x, y) {
        const newShape = {
            id: `shape-${Date.now()}`,
            type: type, // rect, circle, triangle, star, text
            x: x,
            y: y,
            w: type === 'text' ? 200 : 100,
            h: type === 'text' ? 60 : 100,
            fill: type === 'text' ? '#f8fafc' : getRandomBrandColor(),
            fill2: '#a855f7',
            useGradient: false,
            opacity: 100,
            radius: type === 'rect' ? 8 : 0,
            text: type === 'text' ? 'Texto Editable' : ''
        };
        
        canvasElements.push(newShape);
        renderShapes();
        selectShape(newShape.id);
        
        // Reset tool back to select
        currentTool = 'select';
        toolBtns.forEach(btn => {
            if (btn.getAttribute('data-tool') === 'select') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Push activity log
        logCollaborationActivity('Tú', `creó un elemento ${type}`);
    }

    function getRandomBrandColor() {
        const colors = ['#f43f5e', '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#f97316'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function selectShape(id) {
        selectedElementId = id;
        
        // Remove selection style from all shapes and paths
        const domShapes = document.querySelectorAll('.canvas-shape');
        domShapes.forEach(s => s.classList.remove('selected'));
        
        const domPaths = svgDrawLayer.querySelectorAll('path');
        domPaths.forEach(p => p.classList.remove('selected'));
        
        if (id === null) {
            noSelectionMsg.style.display = 'block';
            inspectorProperties.style.display = 'none';
            return;
        }
        
        const shape = canvasElements.find(el => el.id === id);
        if (!shape) return;
        
        // Highlight active DOM element (Div or Path)
        if (shape.type === 'path') {
            const activePathDom = svgDrawLayer.querySelector(`[id="${id}"]`);
            if (activePathDom) activePathDom.classList.add('selected');
        } else {
            const activeDom = document.getElementById(id);
            if (activeDom) activeDom.classList.add('selected');
        }
        
        // Show inspector & update properties
        noSelectionMsg.style.display = 'none';
        inspectorProperties.style.display = 'block';
        
        shapeX.value = Math.round(shape.x);
        shapeY.value = Math.round(shape.y);
        shapeW.value = Math.round(shape.w);
        shapeH.value = Math.round(shape.h);
        shapeFill.value = shape.fill || '#000000';
        shapeFillHex.value = shape.fill || '#000000';
        shapeOpacity.value = shape.opacity !== undefined ? shape.opacity : 100;
        opacityVal.textContent = `${shapeOpacity.value}%`;
        
        // Handle Paths (pencil strokes)
        if (shape.type === 'path') {
            propStrokeGroup.style.display = 'block';
            shapeStroke.value = shape.strokeWidth || 4;
            strokeVal.textContent = `${shapeStroke.value}px`;
            
            // Hide standard geometry properties
            propRadiusGroup.style.display = 'none';
            propGradientToggleGroup.style.display = 'none';
            propColor2Group.style.display = 'none';
            propTextGroup.style.display = 'none';
            propColorGroup.querySelector('label').textContent = 'Color de Línea';
        } else {
            propStrokeGroup.style.display = 'none';
            propGradientToggleGroup.style.display = 'block';
            
            // Set up gradients configuration
            useGradient.checked = shape.useGradient || false;
            if (shape.useGradient) {
                propColor2Group.style.display = 'block';
                shapeFill2.value = shape.fill2 || '#a855f7';
                shapeFill2Hex.value = shape.fill2 || '#a855f7';
            } else {
                propColor2Group.style.display = 'none';
            }
            
            // Shape conditional fields
            if (shape.type === 'rect') {
                propRadiusGroup.style.display = 'block';
                shapeRadius.value = shape.radius;
                radiusVal.textContent = `${shape.radius}px`;
            } else {
                propRadiusGroup.style.display = 'none';
            }
            
            if (shape.type === 'text') {
                propTextGroup.style.display = 'block';
                shapeText.value = shape.text;
                propColorGroup.querySelector('label').textContent = 'Color de Texto';
                propGradientToggleGroup.style.display = 'none'; // Text gradient not supported in CSS simple
            } else {
                propTextGroup.style.display = 'none';
                propColorGroup.querySelector('label').textContent = 'Color de Relleno';
            }
        }
        
        if (shape.type !== 'path') {
            checkContrastAccessibility(shape.fill);
        } else {
            checkContrastAccessibility(shape.stroke);
        }
        updateCodeOutput();
    }

    function renderShapes() {
        // Clear old rendered shapes except placeholder
        const shapes = document.querySelectorAll('.canvas-shape');
        shapes.forEach(s => s.remove());
        
        // Clear the SVG drawing layer paths
        svgDrawLayer.innerHTML = '';
        
        if (canvasElements.length === 0) {
            canvasPlaceholder.style.display = 'flex';
            selectShape(null);
            return;
        }
        
        canvasPlaceholder.style.display = 'none';
        
        canvasElements.forEach(shape => {
            // Render path vectors inside the SVG layer overlay
            if (shape.type === 'path') {
                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('id', shape.id);
                pathEl.setAttribute('d', shape.d);
                pathEl.setAttribute('stroke', shape.stroke);
                pathEl.setAttribute('stroke-width', shape.strokeWidth);
                pathEl.setAttribute('stroke-linecap', 'round');
                pathEl.setAttribute('stroke-linejoin', 'round');
                pathEl.setAttribute('opacity', (shape.opacity || 100) / 100);
                
                // If translation offsets exist, apply translate transform
                if (shape.startX !== undefined && shape.startY !== undefined) {
                    const tx = shape.x - shape.startX;
                    const ty = shape.y - shape.startY;
                    pathEl.setAttribute('transform', `translate(${tx}, ${ty})`);
                }
                
                // Mousedown handler to select and drag paths
                pathEl.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    selectShape(shape.id);
                    
                    if (currentTool !== 'select') return;
                    
                    const startMouseX = e.clientX;
                    const startMouseY = e.clientY;
                    const originalShapeX = shape.x;
                    const originalShapeY = shape.y;
                    
                    function onMouseMove(moveEvent) {
                        const dx = moveEvent.clientX - startMouseX;
                        const dy = moveEvent.clientY - startMouseY;
                        
                        shape.x = originalShapeX + dx;
                        shape.y = originalShapeY + dy;
                        
                        // Update SVG translation directly
                        const tx = shape.x - shape.startX;
                        const ty = shape.y - shape.startY;
                        pathEl.setAttribute('transform', `translate(${tx}, ${ty})`);
                        
                        shapeX.value = Math.round(shape.x);
                        shapeY.value = Math.round(shape.y);
                        updateCodeOutput();
                    }
                    
                    function onMouseUp() {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    }
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
                
                svgDrawLayer.appendChild(pathEl);
                return;
            }
            
            // Standard geometric elements (Divs)
            const el = document.createElement('div');
            el.className = `canvas-shape shape-${shape.type}`;
            el.id = shape.id;
            
            // Set styles
            el.style.left = `${shape.x}px`;
            el.style.top = `${shape.y}px`;
            el.style.width = `${shape.w}px`;
            el.style.height = `${shape.h}px`;
            el.style.opacity = `${(shape.opacity || 100) / 100}`;
            el.style.zIndex = '50';
            
            // Apply fill and gradient styling
            if (shape.type === 'rect') {
                if (shape.useGradient) {
                    el.style.background = `linear-gradient(135deg, ${shape.fill}, ${shape.fill2})`;
                } else {
                    el.style.background = shape.fill;
                }
                el.style.borderRadius = `${shape.radius}px`;
            } else if (shape.type === 'circle') {
                if (shape.useGradient) {
                    el.style.background = `radial-gradient(circle, ${shape.fill}, ${shape.fill2})`;
                } else {
                    el.style.background = shape.fill;
                }
                el.style.borderRadius = '50%';
            } else if (shape.type === 'triangle' || shape.type === 'star') {
                if (shape.useGradient) {
                    el.style.background = `linear-gradient(135deg, ${shape.fill}, ${shape.fill2})`;
                } else {
                    el.style.background = shape.fill;
                }
            } else if (shape.type === 'text') {
                el.style.color = shape.fill;
                el.style.fontSize = '1.2rem';
                el.style.fontWeight = '700';
                
                const textDiv = document.createElement('div');
                textDiv.className = 'text-element-content';
                textDiv.textContent = shape.text;
                el.appendChild(textDiv);
            }
            
            // Set up dragging listener
            el.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                selectShape(shape.id);
                
                if (currentTool !== 'select') return;
                
                const startX = e.clientX - el.offsetLeft;
                const startY = e.clientY - el.offsetTop;
                
                function onMouseMove(moveEvent) {
                    let newX = moveEvent.clientX - startX;
                    let newY = moveEvent.clientY - startY;
                    
                    // Boundary checking
                    newX = Math.max(0, Math.min(newX, 1400 - shape.w));
                    newY = Math.max(0, Math.min(newY, 900 - shape.h));
                    
                    el.style.left = `${newX}px`;
                    el.style.top = `${newY}px`;
                    
                    shape.x = newX;
                    shape.y = newY;
                    
                    shapeX.value = Math.round(newX);
                    shapeY.value = Math.round(newY);
                    
                    updateCodeOutput();
                }
                
                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            
            // Double click to edit text directly on canvas
            if (shape.type === 'text') {
                el.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    const textDiv = el.querySelector('.text-element-content');
                    if (!textDiv) return;
                    
                    const textarea = document.createElement('textarea');
                    textarea.value = shape.text;
                    textarea.style.width = '100%';
                    textarea.style.height = '100%';
                    textarea.style.background = 'rgba(0,0,0,0.4)';
                    textarea.style.color = shape.fill;
                    textarea.style.border = '1px solid var(--accent-cyan)';
                    textarea.style.fontFamily = 'inherit';
                    textarea.style.fontSize = 'inherit';
                    textarea.style.fontWeight = 'inherit';
                    textarea.style.padding = '8px';
                    
                    el.replaceChild(textarea, textDiv);
                    textarea.focus();
                    
                    function finishEditing() {
                        shape.text = textarea.value;
                        shapeText.value = textarea.value;
                        renderShapes();
                        selectShape(shape.id);
                    }
                    
                    textarea.addEventListener('blur', finishEditing);
                    textarea.addEventListener('keydown', (keyEv) => {
                        if (keyEv.key === 'Enter' && !keyEv.shiftKey) {
                            keyEv.preventDefault();
                            finishEditing();
                        }
                    });
                });
            }
            
            artboard.appendChild(el);
        });
        
        // Re-highlight selection if active
        if (selectedElementId) {
            const selEl = document.getElementById(selectedElementId) || svgDrawLayer.querySelector(`[id="${selectedElementId}"]`);
            if (selEl) selEl.classList.add('selected');
        }
        
        // Re-bind hover listeners if the accessibility hover reader is active
        if (hoverReaderActive) {
            enableHoverListeners();
        }
    }

    // Artboard click to create items (for shapes click-triggers)
    artboard.addEventListener('click', (e) => {
        if (currentTool === 'select' || currentTool === 'pencil') {
            if (currentTool === 'select') selectShape(null);
            return;
        }
        
        const rect = artboard.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        createShape(currentTool, clickX - 50, clickY - 50);
    });

    // FREEHAND DRAWING (PENCIL TOOL) MOUSE DRAG EVENT SYSTEM
    canvasContainer.addEventListener('mousedown', (e) => {
        if (currentTool !== 'pencil') return;
        e.preventDefault();
        selectShape(null);
        
        const rect = canvasContainer.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        
        const strokeColor = shapeFill.value;
        const strokeThickness = parseInt(shapeStroke.value) || 4;
        const op = parseInt(shapeOpacity.value) || 100;
        
        let points = [{x: startX, y: startY}];
        let dPath = `M ${startX} ${startY}`;
        
        // Create active path preview
        const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        activePath.setAttribute('d', dPath);
        activePath.setAttribute('stroke', strokeColor);
        activePath.setAttribute('stroke-width', strokeThickness);
        activePath.setAttribute('stroke-linecap', 'round');
        activePath.setAttribute('stroke-linejoin', 'round');
        activePath.setAttribute('opacity', op / 100);
        svgDrawLayer.appendChild(activePath);
        
        function onMouseMove(moveEvent) {
            const nx = moveEvent.clientX - rect.left;
            const ny = moveEvent.clientY - rect.top;
            points.push({x: nx, y: ny});
            dPath += ` L ${nx} ${ny}`;
            activePath.setAttribute('d', dPath);
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Remove temp path preview
            activePath.remove();
            
            if (points.length > 1) {
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                
                const newPath = {
                    id: `path-${Date.now()}`,
                    type: 'path',
                    points: points,
                    d: dPath,
                    fill: 'none',
                    stroke: strokeColor,
                    strokeWidth: strokeThickness,
                    opacity: op,
                    x: minX,
                    y: minY,
                    startX: minX,
                    startY: minY,
                    w: (maxX - minX) || 4,
                    h: (maxY - minY) || 4
                };
                
                canvasElements.push(newPath);
                renderShapes();
                selectShape(newPath.id);
                logCollaborationActivity('Tú', 'dibujó un trazo libre');
            }
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Inspector input event listeners
    function updateSelectedShapeProperty(prop, value) {
        if (!selectedElementId) return;
        const shape = canvasElements.find(el => el.id === selectedElementId);
        if (!shape) return;
        
        shape[prop] = value;
        renderShapes();
        updateCodeOutput();
    }

    shapeX.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        updateSelectedShapeProperty('x', Math.max(0, Math.min(val, 1400)));
    });

    shapeY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        updateSelectedShapeProperty('y', Math.max(0, Math.min(val, 900)));
    });

    shapeW.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 10;
        updateSelectedShapeProperty('w', Math.max(10, Math.min(val, 1400)));
    });

    shapeH.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 10;
        updateSelectedShapeProperty('h', Math.max(10, Math.min(val, 900)));
    });

    function updateColor(colorHex) {
        const shape = canvasElements.find(el => el.id === selectedElementId);
        if (shape && shape.type === 'path') {
            updateSelectedShapeProperty('stroke', colorHex);
        } else {
            updateSelectedShapeProperty('fill', colorHex);
        }
        shapeFill.value = colorHex;
        shapeFillHex.value = colorHex;
        checkContrastAccessibility(colorHex);
    }

    shapeFill.addEventListener('input', (e) => updateColor(e.target.value));
    shapeFillHex.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            updateColor(val);
        }
    });

    // Secondary color picker handlers
    function updateColor2(colorHex) {
        updateSelectedShapeProperty('fill2', colorHex);
        shapeFill2.value = colorHex;
        shapeFill2Hex.value = colorHex;
    }
    
    shapeFill2.addEventListener('input', (e) => updateColor2(e.target.value));
    shapeFill2Hex.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            updateColor2(val);
        }
    });

    useGradient.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        propColor2Group.style.display = isChecked ? 'block' : 'none';
        updateSelectedShapeProperty('useGradient', isChecked);
    });

    shapeOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        opacityVal.textContent = `${val}%`;
        updateSelectedShapeProperty('opacity', val);
    });

    shapeStroke.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        strokeVal.textContent = `${val}px`;
        updateSelectedShapeProperty('strokeWidth', val);
    });

    // Preset color quick selectors
    presetColors.forEach(preset => {
        preset.addEventListener('click', () => {
            const val = preset.getAttribute('data-preset');
            updateColor(val);
        });
    });

    shapeRadius.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        radiusVal.textContent = `${val}px`;
        updateSelectedShapeProperty('radius', val);
    });

    shapeText.addEventListener('input', (e) => {
        updateSelectedShapeProperty('text', e.target.value);
    });

    deleteSelectedBtn.addEventListener('click', () => {
        if (!selectedElementId) return;
        
        const shape = canvasElements.find(el => el.id === selectedElementId);
        if (shape) {
            logCollaborationActivity('Tú', `eliminó un elemento ${shape.type}`);
        }
        
        canvasElements = canvasElements.filter(el => el.id !== selectedElementId);
        selectedElementId = null;
        renderShapes();
        showToast('Elemento eliminado del canvas.');
    });

    clearCanvasBtn.addEventListener('click', () => {
        if (canvasElements.length === 0) return;
        
        if (confirm('¿Estás seguro de que deseas limpiar el lienzo?')) {
            canvasElements = [];
            selectedElementId = null;
            renderShapes();
            updateCodeOutput();
            showToast('Lienzo limpio.');
            logCollaborationActivity('Tú', 'limpió todo el lienzo');
        }
    });

    /* ==========================================
       CODE EXPORTER GENERATORS
       ========================================== */
    function updateCodeOutput() {
        if (canvasElements.length === 0) {
            codeOutput.textContent = '/* Dibuja o selecciona un elemento para inspeccionar su código correspondiente */';
            return;
        }
        
        if (activeCodeFormat === 'css') {
            let htmlStr = '<!-- Estructura HTML de los Prototipos -->\n<div class="canvas-artboard">\n';
            let cssStr = '\n/* Estilos CSS Flex/Absolute */\n.canvas-artboard {\n  position: relative;\n  width: 1400px;\n  height: 900px;\n  background-color: #121018;\n}\n';
            
            // Add SVG wrapper for drawn vector paths if paths exist
            const hasPaths = canvasElements.some(el => el.type === 'path');
            if (hasPaths) {
                htmlStr += '  <svg class="canvas-svg-layer" viewBox="0 0 1400 900" width="100%" height="100%" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none; z-index: 15;">\n';
            }
            
            canvasElements.forEach((shape, index) => {
                const className = `shape-item-${index + 1}`;
                const opacityStr = shape.opacity !== undefined && shape.opacity !== 100 ? `  opacity: ${shape.opacity / 100};\n` : '';
                
                if (shape.type === 'path') {
                    const tx = shape.x - shape.startX;
                    const ty = shape.y - shape.startY;
                    const transformStr = (tx !== 0 || ty !== 0) ? ` transform="translate(${tx}, ${ty})"` : '';
                    htmlStr += `    <path d="${shape.d}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${(shape.opacity || 100)/100}"${transformStr} />\n`;
                } else if (shape.type === 'rect') {
                    htmlStr += `  <div class="shape ${className}"></div>\n`;
                    let bgStr = `  background-color: ${shape.fill};\n`;
                    if (shape.useGradient) {
                        bgStr = `  background: linear-gradient(135deg, ${shape.fill}, ${shape.fill2});\n`;
                    }
                    cssStr += `.${className} {\n  position: absolute;\n  left: ${shape.x}px;\n  top: ${shape.y}px;\n  width: ${shape.w}px;\n  height: ${shape.h}px;\n${bgStr}${opacityStr}  border-radius: ${shape.radius}px;\n}\n`;
                } else if (shape.type === 'circle') {
                    htmlStr += `  <div class="shape ${className}"></div>\n`;
                    let bgStr = `  background-color: ${shape.fill};\n`;
                    if (shape.useGradient) {
                        bgStr = `  background: radial-gradient(circle, ${shape.fill}, ${shape.fill2});\n`;
                    }
                    cssStr += `.${className} {\n  position: absolute;\n  left: ${shape.x}px;\n  top: ${shape.y}px;\n  width: ${shape.w}px;\n  height: ${shape.h}px;\n${bgStr}${opacityStr}  border-radius: 50%;\n}\n`;
                } else if (shape.type === 'triangle') {
                    htmlStr += `  <div class="shape ${className}"></div>\n`;
                    let bgStr = `  background-color: ${shape.fill};\n`;
                    if (shape.useGradient) {
                        bgStr = `  background: linear-gradient(135deg, ${shape.fill}, ${shape.fill2});\n`;
                    }
                    cssStr += `.${className} {\n  position: absolute;\n  left: ${shape.x}px;\n  top: ${shape.y}px;\n  width: ${shape.w}px;\n  height: ${shape.h}px;\n${bgStr}${opacityStr}  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);\n}\n`;
                } else if (shape.type === 'star') {
                    htmlStr += `  <div class="shape ${className}"></div>\n`;
                    let bgStr = `  background-color: ${shape.fill};\n`;
                    if (shape.useGradient) {
                        bgStr = `  background: linear-gradient(135deg, ${shape.fill}, ${shape.fill2});\n`;
                    }
                    cssStr += `.${className} {\n  position: absolute;\n  left: ${shape.x}px;\n  top: ${shape.y}px;\n  width: ${shape.w}px;\n  height: ${shape.h}px;\n${bgStr}${opacityStr}  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);\n}\n`;
                } else if (shape.type === 'text') {
                    htmlStr += `  <h3 class="shape ${className}">${escapeHtml(shape.text)}</h3>\n`;
                    cssStr += `.${className} {\n  position: absolute;\n  left: ${shape.x}px;\n  top: ${shape.y}px;\n  width: ${shape.w}px;\n  height: ${shape.h}px;\n  color: ${shape.fill};\n${opacityStr}  font-size: 1.2rem;\n  font-weight: 700;\n}\n`;
                }
            });
            
            if (hasPaths) {
                htmlStr += '  </svg>\n';
            }
            
            htmlStr += '</div>\n';
            codeOutput.textContent = htmlStr + cssStr;
            codeOutput.className = 'language-css';
        } else if (activeCodeFormat === 'svg') {
            // Build linearGradient defs
            let defsStr = '  <defs>\n';
            let hasGradients = false;
            
            canvasElements.forEach((shape, index) => {
                if (shape.useGradient && shape.type !== 'path' && shape.type !== 'text') {
                    hasGradients = true;
                    if (shape.type === 'circle') {
                        defsStr += `    <radialGradient id="grad-${shape.id}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">\n      <stop offset="0%" stop-color="${shape.fill}" />\n      <stop offset="100%" stop-color="${shape.fill2}" />\n    </radialGradient>\n`;
                    } else {
                        defsStr += `    <linearGradient id="grad-${shape.id}" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" stop-color="${shape.fill}" />\n      <stop offset="100%" stop-color="${shape.fill2}" />\n    </linearGradient>\n`;
                    }
                }
            });
            defsStr += '  </defs>\n';
            
            let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" width="100%" height="100%">\n`;
            if (hasGradients) {
                svgStr += defsStr;
            }
            svgStr += `  <!-- Fondo de Artboard -->\n  <rect width="1400" height="900" fill="#121018" />\n`;
            
            canvasElements.forEach(shape => {
                const fillVal = shape.useGradient ? `url(#grad-${shape.id})` : shape.fill;
                const opAttr = shape.opacity !== undefined && shape.opacity !== 100 ? ` opacity="${shape.opacity/100}"` : '';
                
                if (shape.type === 'path') {
                    const tx = shape.x - shape.startX;
                    const ty = shape.y - shape.startY;
                    const transformStr = (tx !== 0 || ty !== 0) ? ` transform="translate(${tx}, ${ty})"` : '';
                    svgStr += `  <path d="${shape.d}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opAttr}${transformStr} />\n`;
                } else if (shape.type === 'rect') {
                    svgStr += `  <rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.radius}" fill="${fillVal}"${opAttr} />\n`;
                } else if (shape.type === 'circle') {
                    const r = shape.w / 2;
                    const cx = shape.x + r;
                    const cy = shape.y + (shape.h / 2);
                    svgStr += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillVal}"${opAttr} />\n`;
                } else if (shape.type === 'triangle') {
                    const x1 = shape.x + shape.w/2;
                    const y1 = shape.y;
                    const x2 = shape.x;
                    const y2 = shape.y + shape.h;
                    const x3 = shape.x + shape.w;
                    const y3 = shape.y + shape.h;
                    svgStr += `  <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${fillVal}"${opAttr} />\n`;
                } else if (shape.type === 'star') {
                    // Approximate star coordinates based on width/height scale
                    const x = shape.x;
                    const y = shape.y;
                    const w = shape.w;
                    const h = shape.h;
                    const pts = [
                        `${x + w*0.5},${y}`,
                        `${x + w*0.61},${y + h*0.35}`,
                        `${x + w*0.98},${y + h*0.35}`,
                        `${x + w*0.68},${y + h*0.57}`,
                        `${x + w*0.79},${y + h*0.91}`,
                        `${x + w*0.5},${y + h*0.7}`,
                        `${x + w*0.21},${y + h*0.91}`,
                        `${x + w*0.32},${y + h*0.57}`,
                        `${x + w*0.02},${y + h*0.35}`,
                        `${x + w*0.39},${y + h*0.35}`
                    ].join(' ');
                    svgStr += `  <polygon points="${pts}" fill="${fillVal}"${opAttr} />\n`;
                } else if (shape.type === 'text') {
                    svgStr += `  <text x="${shape.x}" y="${shape.y + 24}" fill="${shape.fill}" font-family="system-ui, sans-serif" font-size="20" font-weight="bold"${opAttr}>${escapeHtml(shape.text)}</text>\n`;
                }
            });
            
            svgStr += '</svg>';
            codeOutput.textContent = svgStr;
            codeOutput.className = 'language-markup';
        } else if (activeCodeFormat === 'json') {
            codeOutput.textContent = JSON.stringify(canvasElements, null, 2);
            codeOutput.className = 'language-json';
        }
    }

    function escapeHtml(string) {
        return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    drawerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            drawerTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCodeFormat = tab.getAttribute('data-code-format');
            updateCodeOutput();
        });
    });

    copyCodeBtn.addEventListener('click', () => {
        const textToCopy = codeOutput.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Código copiado al portapapeles.');
        }).catch(err => {
            showToast('Error al copiar el código.');
            console.error(err);
        });
    });

    /* ==========================================
       SIMULATED REAL-TIME PEERS (LIVE MOTION)
       ========================================== */
    const cursorElena = document.getElementById('cursorElena');
    const cursorAlex = document.getElementById('cursorAlex');
    const feed = document.getElementById('activityFeed');
    
    function logCollaborationActivity(user, message) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const item = document.createElement('div');
        item.className = 'feed-item';
        
        let color = 'var(--primary)';
        if (user === 'Elena') color = 'var(--accent-pink)';
        if (user === 'Alex') color = 'var(--accent-cyan)';
        
        item.innerHTML = `
            <div class="feed-marker" style="background-color: ${color};"></div>
            <div class="feed-info">
                <p><strong>${user}</strong> ${message}</p>
                <span class="feed-time">Hoy a las ${time}</span>
            </div>
        `;
        
        feed.prepend(item);
        
        // Cap list items to prevent overflow in layout
        const items = feed.querySelectorAll('.feed-item');
        if (items.length > 5) {
            items[items.length - 1].remove();
        }
    }

    function moveSimulatedCursors() {
        if (!cursorElena || !cursorAlex) return;
        
        // Random coords inside standard bounds
        const elenaX = Math.floor(Math.random() * 800) + 100;
        const elenaY = Math.floor(Math.random() * 500) + 100;
        const alexX = Math.floor(Math.random() * 800) + 100;
        const alexY = Math.floor(Math.random() * 500) + 100;
        
        cursorElena.style.transform = `translate(${elenaX}px, ${elenaY}px)`;
        cursorAlex.style.transform = `translate(${alexX}px, ${alexY}px)`;
        
        // Occasionally trigger a visual simulation action
        const rand = Math.random();
        if (rand < 0.20) {
            const actions = [
                'redimensionó rectángulo base',
                'ajustó color de acento de cabecera',
                'comprobó contraste de tipografía',
                'añadió nota de prototipo móvil'
            ];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            logCollaborationActivity('Elena', randomAction);
        } else if (rand < 0.40) {
            const actions = [
                'creó un mock-up de tarjeta',
                'cambió alineación de layouts',
                'validó estándar SVG de activos',
                'guardó versión del lienzo en Taiga'
            ];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            logCollaborationActivity('Alex', randomAction);
        }
    }

    // Start movement loop
    setInterval(moveSimulatedCursors, 4000);
    moveSimulatedCursors(); // First call

    /* ==========================================
       TAIGA KANBAN SYSTEM (DRAG-AND-DROP)
       ========================================== */
    const kanbanBoard = document.getElementById('kanbanBoard');
    const columns = document.querySelectorAll('.kanban-column');
    const deviceMockup = document.getElementById('deviceMockup');
    const deviceBtns = document.querySelectorAll('.device-btn');
    
    // Modal Selectors
    const taskModal = document.getElementById('taskModal');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const taskForm = document.getElementById('taskForm');

    // Drag events
    function addDragEvents(card) {
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
            e.dataTransfer.effectAllowed = 'move';
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
    }

    const cards = document.querySelectorAll('.kanban-card');
    cards.forEach(card => addDragEvents(card));

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('drag-over');
        });

        column.addEventListener('dragenter', (e) => {
            e.preventDefault();
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const draggedCard = document.querySelector(`[data-task-id="${taskId}"]`);
            
            if (draggedCard) {
                const targetColumnCards = column.querySelector('.column-cards');
                targetColumnCards.appendChild(draggedCard);
                
                // Recalculate columns lengths
                recalculateColumnCounts();
                
                const taskTitle = draggedCard.querySelector('h4').textContent;
                const columnTitle = column.querySelector('h3').textContent;
                showToast(`Tarea moved a columna "${columnTitle}"`);
                logCollaborationActivity('Tú', `movió "${taskTitle}" a ${columnTitle}`);
            }
        });
    });

    function recalculateColumnCounts() {
        columns.forEach(col => {
            const count = col.querySelectorAll('.kanban-card').length;
            const status = col.getAttribute('data-status');
            const counterEl = document.getElementById(`count-${status}`);
            if (counterEl) {
                counterEl.textContent = count;
            }
        });
    }

    // Modal tasks management
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            taskModal.style.display = 'flex';
        });
    }

    function closeModal() {
        taskModal.style.display = 'none';
        taskForm.reset();
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeModal);

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('taskTitle').value;
        const desc = document.getElementById('taskDesc').value;
        const tag = document.getElementById('taskTag').value;
        const priority = document.getElementById('taskPriority').value;
        
        const taskId = `task-${Date.now()}`;
        
        // Create new DOM card
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-task-id', taskId);
        
        let tagClass = 'tag-purple';
        if (tag === 'Código') tagClass = 'tag-orange';
        if (tag === 'UX') tagClass = 'tag-cyan';
        if (tag === 'A11y') tagClass = 'tag-green';
        
        card.innerHTML = `
            <div class="card-tags">
                <span class="card-tag ${tagClass}">${tag}</span>
            </div>
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(desc)}</p>
            <div class="card-meta">
                <div class="card-assignee current-user">Tú</div>
                <span class="card-priority priority-${priority.toLowerCase() === 'baja' ? 'low' : priority.toLowerCase() === 'media' ? 'medium' : 'high'}">${priority}</span>
            </div>
        `;
        
        // Append dragging logic
        addDragEvents(card);
        
        // Append to To Do
        document.getElementById('column-todo').appendChild(card);
        
        // Update
        recalculateColumnCounts();
        closeModal();
        showToast('Tarea añadida con éxito.');
        logCollaborationActivity('Tú', `creó la tarea "${title}"`);
    });

    // Multi-device simulator controls
    deviceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            deviceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const device = btn.getAttribute('data-device');
            deviceMockup.className = 'device-mockup-wrapper';
            
            if (device === 'desktop') {
                deviceMockup.classList.add('desktop-mode');
            } else if (device === 'tablet') {
                deviceMockup.classList.add('tablet-mode');
            } else if (device === 'mobile') {
                deviceMockup.classList.add('mobile-mode');
            }
        });
    });

    /* ==========================================
       SYSTEM THEME CUSTOMIZER & WCAG PREVIEW
       ========================================== */
    const themeBg = document.getElementById('themeBg');
    const themePrimary = document.getElementById('themePrimary');
    const themeAccent = document.getElementById('themeAccent');
    const themeText = document.getElementById('themeText');
    const resetThemeBtn = document.getElementById('resetThemeBtn');
    
    const testPreviewBox = document.getElementById('testPreviewBox');
    const testAccentText = document.getElementById('testAccentText');
    const testBodyText = document.getElementById('testBodyText');
    const testBtnSample = document.getElementById('testBtnSample');
    const contrastRatioVal = document.getElementById('contrastRatioVal');
    
    const wcagNormalAA = document.getElementById('wcagNormalAA');
    const wcagNormalAAA = document.getElementById('wcagNormalAAA');
    const wcagLargeAA = document.getElementById('wcagLargeAA');
    const wcagLargeAAA = document.getElementById('wcagLargeAAA');

    function updateAccessibilityTester() {
        const bgVal = themeBg.value;
        const textVal = themeText.value;
        const priVal = themePrimary.value;
        const accVal = themeAccent.value;
        
        // Apply color styles dynamically to Sample Box
        testPreviewBox.style.backgroundColor = bgVal;
        testBodyText.style.color = textVal;
        testAccentText.style.color = accVal;
        testBtnSample.style.backgroundColor = priVal;
        
        // Compute contrast ratio (Text vs Background)
        const ratio = calculateContrastRatio(textVal, bgVal);
        contrastRatioVal.textContent = `${ratio.toFixed(2)}:1`;
        
        // Evaluate accessibility rules
        // Normal text (less than 18pt): AA requires 4.5:1, AAA requires 7:1
        // Large text (18pt or larger, or bold 14pt or larger): AA requires 3:1, AAA requires 4.5:1
        
        updateWCAGIndicator(wcagNormalAA, ratio >= 4.5);
        updateWCAGIndicator(wcagNormalAAA, ratio >= 7.0);
        updateWCAGIndicator(wcagLargeAA, ratio >= 3.0);
        updateWCAGIndicator(wcagLargeAAA, ratio >= 4.5);
    }

    function updateWCAGIndicator(element, passes) {
        if (passes) {
            element.textContent = 'Cumple';
            element.className = 'indicator-status status-pass';
        } else {
            element.textContent = 'Falla';
            element.className = 'indicator-status status-fail';
        }
    }

    function applyThemeColors() {
        const root = document.documentElement;
        root.style.setProperty('--bg-dark', themeBg.value);
        root.style.setProperty('--primary', themePrimary.value);
        root.style.setProperty('--accent-cyan', themeAccent.value);
        root.style.setProperty('--text-primary', themeText.value);
        
        updateAccessibilityTester();
    }

    themeBg.addEventListener('input', applyThemeColors);
    themePrimary.addEventListener('input', applyThemeColors);
    themeAccent.addEventListener('input', applyThemeColors);
    themeText.addEventListener('input', applyThemeColors);

    resetThemeBtn.addEventListener('click', () => {
        themeBg.value = '#110f18';
        themePrimary.value = '#f43f5e';
        themeAccent.value = '#06b6d4';
        themeText.value = '#f8fafc';
        
        applyThemeColors();
        showToast('Tema del sistema restablecido.');
    });

    // Run initial checker
    updateAccessibilityTester();

    /* ==========================================
       EVENTS TICKETS REGISTRATIONS
       ========================================== */
    const joinEventBtns = document.querySelectorAll('.join-event-btn');
    const applyAmbassadorBtn = document.getElementById('applyAmbassadorBtn');

    joinEventBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const eventName = btn.getAttribute('data-event');
            
            if (btn.classList.contains('btn-accent')) {
                // Registering
                btn.classList.remove('btn-accent');
                btn.classList.add('btn-secondary');
                btn.innerHTML = '<i data-lucide="check"></i> <span>¡Registrado! ✓</span>';
                
                const countContainer = btn.parentElement.querySelector('.attendees-info');
                if (countContainer && countContainer.textContent.includes('registrándose')) {
                    const currentCount = parseInt(countContainer.textContent) || 0;
                    countContainer.innerHTML = `<i data-lucide="check"></i> ${currentCount + 1} registrándose`;
                }
                
                showToast(`¡Te has registrado con éxito en ${eventName}!`);
                safeCreateIcons();
            } else {
                // Cancel registration
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-accent');
                btn.innerHTML = 'Registrarse Gratis';
                
                const countContainer = btn.parentElement.querySelector('.attendees-info');
                if (countContainer && countContainer.textContent.includes('registrándose')) {
                    const currentCount = parseInt(countContainer.textContent) || 0;
                    countContainer.innerHTML = `<i data-lucide="check"></i> ${currentCount - 1} registrándose`;
                }
                
                showToast(`Registro cancelado para ${eventName}.`);
                safeCreateIcons();
            }
        });
    });

    if (applyAmbassadorBtn) {
        applyAmbassadorBtn.addEventListener('click', () => {
            const email = prompt('Por favor, introduce tu correo electrónico para enviarte los detalles del Programa de Embajadores Kaleidos:');
            if (email && email.trim() !== '') {
                showToast('¡Solicitud enviada! Nos pondremos en contacto contigo en las próximas 48 horas.');
            }
        });
    }

    // Share Button Event Listener (Web Share API with Clipboard Fallback)
    const shareBtn = document.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareData = {
                title: 'Kaleidos — Open Source Prototyping Hub',
                text: '¡Mira este prototipo interactivo de herramientas de diseño colaborativo multiplataforma!',
                url: window.location.href.includes('localhost') ? window.location.href : 'http://localhost:8000'
            };
            
            if (navigator.share) {
                navigator.share(shareData)
                    .then(() => showToast('¡Qué bien! Gracias por compartir Kaleidos. 🎉✨'))
                    .catch((err) => console.log('Error al compartir:', err));
            } else {
                navigator.clipboard.writeText(shareData.url)
                    .then(() => {
                        showToast('¡Enlace de Kaleidos copiado al portapapeles! Compártelo con tu equipo. 🚀🌟');
                    })
                    .catch((err) => {
                        showToast('¡Ups! No pudimos copiar el enlace.');
                        console.error(err);
                    });
            }
        });
    }

    // Default Seed Shape
    createShape('rect', 150, 150);
    createShape('circle', 500, 200);
    createShape('text', 400, 450);
    canvasElements[0].w = 200;
    canvasElements[0].h = 120;
    canvasElements[0].radius = 16;
    canvasElements[1].w = 150;
    canvasElements[1].h = 150;
    canvasElements[2].text = 'Prototipo Colaborativo\n(Doble clic para editar)';
    canvasElements[2].w = 320;
    canvasElements[2].h = 80;
    
    renderShapes();
    selectShape(null); // Clear selection on start

    /* ==========================================================================
       ACCESSIBILITY HUB (SIGN LANGUAGE & BRAILLE TRANSLATOR SYSTEM)
       ========================================================================== */
    // Braille character mapping dictionary (Spanish Standard)
    const brailleMap = {
        'a': '⠁', 'b': '⠃', 'c': '⠉', 'd': '⠙', 'e': '⠑', 'f': '⠋', 'g': '⠛', 'h': '⠓', 'i': '⠊', 'j': '⠚',
        'k': '⠅', 'l': '⠇', 'm': '⠍', 'n': '⠝', 'o': '⠕', 'p': '⠏', 'q': '⠟', 'r': '⠗', 's': '⠎', 't': '⠞',
        'u': '⠥', 'v': '⠧', 'w': '⠺', 'x': '⠭', 'y': '⠽', 'z': '⠵',
        'á': '⠷', 'é': '⠿', 'í': '⠮', 'ó': '⠬', 'ú': '⠾', 'ñ': '⠻',
        ' ': '⠀', '1': '⠼⠁', '2': '⠼⠃', '3': '⠼⠉', '4': '⠼⠙', '5': '⠼⠑', '6': '⠼⠋', '7': '⠼⠛', '8': '⠼⠓', '9': '⠼⠊', '0': '⠼⠚',
        ',': '⠂', '.': '⠄', '!': '⠮', '?': '⠦', '-': '⠤', '(': '⠦', ')': '⠴'
    };

    function translateToBraille(text) {
        if (!text) return '⠀';
        return text.toLowerCase().split('').map(char => {
            const isUpper = char !== char.toLowerCase();
            const lower = char.toLowerCase();
            const brailleChar = brailleMap[lower] || '⠀';
            return isUpper ? '⠠' + brailleChar : brailleChar;
        }).join('');
    }

    // Selectors
    const accessibilityHub = document.getElementById('accessibilityHub');
    const hubHeader = document.getElementById('hubHeader');
    const minimizeHub = document.getElementById('minimizeHub');
    const hubTabBtns = document.querySelectorAll('.hub-tab-btn');
    const hubTabContents = document.querySelectorAll('.hub-tab-content');
    const speechTranscript = document.getElementById('speechTranscript');
    const signGloss = document.getElementById('signGloss');
    const brailleTextDots = document.getElementById('brailleTextDots');
    const brailleInputText = document.getElementById('brailleInputText');
    const brailleLivePreview = document.getElementById('brailleLivePreview');
    const micToggleBtn = document.getElementById('micToggleBtn');
    const hoverReaderToggle = document.getElementById('hoverReaderToggle');
    const cameraToggleBtn = document.getElementById('cameraToggleBtn');
    const webcamVideo = document.getElementById('webcamVideo');
    const interpreterSvg = document.getElementById('interpreterSvg');

    // Simulated speech scripts representing collaborative design discussion
    const speechScripts = [
        {
            es: "¡Hola! Bienvenidos a Kaleidos. Probemos las nuevas herramientas de accesibilidad.",
            en: "Hello! Welcome to Kaleidos. Let's try the new accessibility tools.",
            gloss: "HOLA WELCOME KALEIDOS ACCESSIBILITY TOOLS TRY"
        },
        {
            es: "Acabo de dibujar una estrella de cinco puntas con el lápiz libre.",
            en: "I just drew a five-point star with the freehand pencil.",
            gloss: "STAR FIVE POINTS PENCIL FREE DRAW JUST"
        },
        {
            es: "El ratio de contraste de color cumple con los estándares AA de WCAG.",
            en: "The color contrast ratio complies with WCAG AA standards.",
            gloss: "COLOR CONTRAST WCAG AA STANDARDS COMPLY"
        },
        {
            es: "Podemos sincronizar esta tarea con el tablero Kanban en Taiga.",
            en: "We can sync this task with the Kanban board in Taiga.",
            gloss: "TASK TAIGA KANBAN BOARD SYNC CAN"
        },
        {
            es: "¡Perfecto! Todo el equipo puede ver los vectores SVG en tiempo real.",
            en: "Perfect! The whole team can see the SVG vectors in real-time.",
            gloss: "PERFECT TEAM ALL SVG VECTORS REAL-TIME SEE"
        }
    ];

    let scriptIndex = 0;

    // Minimize Toggle
    if (hubHeader && accessibilityHub) {
        hubHeader.addEventListener('click', () => {
            accessibilityHub.classList.toggle('minimized');
            if (accessibilityHub.classList.contains('minimized')) {
                minimizeHub.innerHTML = '<i data-lucide="chevron-up"></i>';
            } else {
                minimizeHub.innerHTML = '<i data-lucide="chevron-down"></i>';
            }
            lucide.createIcons();
        });
    }

    // Tabs Switcher
    hubTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetTab = btn.getAttribute('data-hub-tab');
            
            hubTabBtns.forEach(b => b.classList.remove('active'));
            hubTabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    let recognition = null;

    function playWavBeep(frequency = 440, duration = 0.2) {
        try {
            const sampleRate = 8000;
            const numSamples = Math.floor(sampleRate * duration);
            const buffer = new Uint8Array(44 + numSamples);
            
            // RIFF header
            buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46; // "RIFF"
            const fileSize = 36 + numSamples;
            buffer[4] = fileSize & 0xff;
            buffer[5] = (fileSize >> 8) & 0xff;
            buffer[6] = (fileSize >> 16) & 0xff;
            buffer[7] = (fileSize >> 24) & 0xff;
            
            buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45; // "WAVE"
            buffer[12] = 0x66; buffer[13] = 0x6d; buffer[14] = 0x74; buffer[15] = 0x20; // "fmt "
            
            buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0; // Subchunk1Size = 16
            buffer[20] = 1; buffer[21] = 0; // AudioFormat = 1 (PCM)
            buffer[22] = 1; buffer[23] = 0; // NumChannels = 1
            
            // SampleRate = 8000
            buffer[24] = sampleRate & 0xff;
            buffer[25] = (sampleRate >> 8) & 0xff;
            buffer[26] = (sampleRate >> 16) & 0xff;
            buffer[27] = (sampleRate >> 24) & 0xff;
            
            // ByteRate = 8000
            buffer[28] = sampleRate & 0xff;
            buffer[29] = (sampleRate >> 8) & 0xff;
            buffer[30] = (sampleRate >> 16) & 0xff;
            buffer[31] = (sampleRate >> 24) & 0xff;
            
            buffer[32] = 1; buffer[33] = 0; // BlockAlign = 1
            buffer[34] = 8; buffer[35] = 0; // BitsPerSample = 8
            
            buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61; // "data"
            
            // Subchunk2Size = numSamples
            buffer[40] = numSamples & 0xff;
            buffer[41] = (numSamples >> 8) & 0xff;
            buffer[42] = (numSamples >> 16) & 0xff;
            buffer[43] = (numSamples >> 24) & 0xff;
            
            // Generate PCM sine wave data with volume envelope to prevent clicks
            for (let i = 0; i < numSamples; i++) {
                const angle = (2 * Math.PI * frequency * i) / sampleRate;
                const volume = (numSamples - i) / numSamples;
                const sample = Math.round(128 + 120 * Math.sin(angle) * volume);
                buffer[44 + i] = sample;
            }
            
            const blob = new Blob([buffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 0.2;
            audio.play().catch(e => console.warn('Audio play failed:', e));
        } catch (e) {
            console.error('PCM generation failed:', e);
        }
    }

    function playBeep(frequency = 440, type = 'sine', duration = 0.1) {
        // High compatibility PCM wave synthesis fallback
        playWavBeep(frequency, duration);
    }

    function playActiveChime() {
        playBeep(520, 'sine', 0.15);
        setTimeout(() => playBeep(660, 'sine', 0.2), 80);
    }

    function playDeactiveChime() {
        playBeep(660, 'sine', 0.15);
        setTimeout(() => playBeep(440, 'sine', 0.2), 80);
    }

    // Cheerfulness voice finder
    function getCheerfulVoice(lang) {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices();
        let preferred = [];
        if (lang.startsWith('es')) {
            preferred = ['google español', 'helena', 'monica', 'sabina', 'spanish', 'espanol'];
        } else {
            preferred = ['google us english', 'zira', 'samantha', 'karen', 'english', 'en-us'];
        }
        
        for (let pref of preferred) {
            const found = voices.find(v => v.name.toLowerCase().includes(pref) && v.lang.toLowerCase().startsWith(lang.split('-')[0]));
            if (found) return found;
        }
        return voices.find(v => v.lang.toLowerCase().startsWith(lang.split('-')[0])) || null;
    }

    // Fixed SpeechSynthesis wrapper (prevents GC and Chrome cancel deadlock bug, preserves user click gesture context)
    function speakText(text, lang = 'es-ES') {
        if ('speechSynthesis' in window) {
            // Only cancel if speaking to prevent Chrome deadlock bug
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }
            
            // Warm-up or skip empty texts
            if (!text || text.trim() === '') return;
            
            // Retain reference globally to avoid GC garbage collection cut-offs
            window.activeUtterances = window.activeUtterances || [];
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            
            // Set high cheerfulness: higher pitch, standard rate
            utterance.pitch = 1.3; 
            utterance.rate = 1.0;
            
            const voice = getCheerfulVoice(lang);
            if (voice) {
                utterance.voice = voice;
            }
            
            window.activeUtterances.push(utterance);
            if (window.activeUtterances.length > 30) {
                window.activeUtterances.shift();
            }
            
            window.speechSynthesis.speak(utterance);
        }
    }

    // Speech Recognition API Integration (Browser Native)
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = true;
            recognition.interimResults = true;
            
            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                const activeText = finalTranscript || interimTranscript;
                if (activeText.trim() !== '') {
                    speechTranscript.textContent = activeText;
                    brailleTextDots.textContent = translateToBraille(activeText);
                    
                    // Trigger interpreter gesturing
                    accessibilityHub.classList.add('signing');
                    
                    // Map speech keywords to signs
                    const words = activeText.toLowerCase().split(' ');
                    const glossWords = words.map(w => {
                        const match = Object.keys(hoverTranslations).find(k => hoverTranslations[k].es.toLowerCase().includes(w));
                        return match ? hoverTranslations[match].gloss : w.toUpperCase();
                    });
                    signGloss.textContent = glossWords.join(' ');
                    
                    if (finalTranscript && micActive) {
                        let englishTrans = finalTranscript;
                        Object.keys(hoverTranslations).forEach(k => {
                            const esRegex = new RegExp(hoverTranslations[k].es, 'gi');
                            englishTrans = englishTrans.replace(esRegex, hoverTranslations[k].en);
                        });
                        
                        englishTrans = englishTrans
                            .replace(/hola/gi, 'hello')
                            .replace(/diseño/gi, 'design')
                            .replace(/color/gi, 'color')
                            .replace(/lienzo/gi, 'canvas')
                            .replace(/dibujo/gi, 'drawing')
                            .replace(/borrar/gi, 'clear')
                            .replace(/compartir/gi, 'share');
                            
                        // Speak translation aloud (simultaneous translation)
                        speakText(englishTrans, 'en-US');
                        
                        setTimeout(() => {
                            if (!interimTranscript) {
                                accessibilityHub.classList.remove('signing');
                            }
                        }, 2500);
                    }
                }
            };
            
            recognition.onerror = (event) => {
                console.warn('Speech recognition warning:', event.error);
                if (micActive && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
                    showToast('Acceso a micrófono denegado. Iniciando simulación automática... 📢');
                    startDemoFallbackFromMic();
                }
            };
            
            recognition.onend = () => {
                if (micActive) {
                    try { recognition.start(); } catch (e) {}
                }
            };
        }
    } catch (e) {
        console.warn('SpeechRecognition initialization failed:', e);
    }

    // Mic Toggle Event (Voice Input Real-time)
    if (micToggleBtn) {
        micToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Turn off demo if active
            if (demoActive) {
                stopDemoSimulation();
            }
            
            micActive = !micActive;
            
            if (micActive) {
                // Play active chime
                playActiveChime();
                
                // Warm up speech synthesis
                speakText(' ', 'es-ES');
                
                micToggleBtn.classList.add('active');
                micToggleBtn.innerHTML = '<i data-lucide="mic-off"></i><span>Silenciar Micrófono</span>';
                accessibilityHub.classList.add('listening');
                
                const welcomeExplanation = "Bienvenidos a esta página web que nos permite crear diseños de interfaces de usuario y a través de ella podemos incorporar diferentes figuras como se puede ver, escribir o añadir texto. Es un proyecto de código abierto y abajo del todo se puede ver la estructura del código en CSS, HTML y JSON. También podemos ver en el apartado de Taiga las tareas que hemos realizado, las tareas en proceso y las pendientes de finalizar. En la pestaña de System Themes podemos cambiar los colores de la interfaz y probar su accesibilidad, y en el Events Hub podemos ver y apuntarnos a eventos de diseño. ¡El micrófono está activo y listo para traducir tu voz!";
                
                speechTranscript.textContent = welcomeExplanation;
                brailleTextDots.textContent = translateToBraille(welcomeExplanation);
                
                // Map speech keywords to signs
                const explanationWords = welcomeExplanation.toLowerCase().split(' ');
                const glossWords = explanationWords.map(w => {
                    const match = Object.keys(hoverTranslations).find(k => hoverTranslations[k].es.toLowerCase().includes(w));
                    return match ? hoverTranslations[match].gloss : w.toUpperCase();
                });
                signGloss.textContent = glossWords.slice(0, 10).join(' ') + '...';
                
                // Trigger interpreter gesturing
                accessibilityHub.classList.add('signing');
                
                speakText(welcomeExplanation, "es-ES");
                
                // Reset to standard idling state when welcome speech completes (approx 28 seconds)
                if (window.micExplanationTimeout) clearTimeout(window.micExplanationTimeout);
                window.micExplanationTimeout = setTimeout(() => {
                    if (micActive) {
                        accessibilityHub.classList.remove('signing');
                        speechTranscript.textContent = 'Escuchando tu voz... Habla ahora.';
                        signGloss.textContent = '---';
                        brailleTextDots.textContent = '⠀';
                    }
                }, 28000);
                
                if (recognition) {
                    try {
                        recognition.start();
                        showToast('¡Micrófono activo! Habla para traducir tu voz en tiempo real. 🎙️✨');
                    } catch (err) {
                        console.log('Recognition start failed, starting simulation fallback...');
                        showToast('Error al iniciar micrófono. Activando simulación... 📢');
                        startDemoFallbackFromMic();
                    }
                } else {
                    showToast('Micrófono no soportado. Activando simulación automática... 📢');
                    startDemoFallbackFromMic();
                }
            } else {
                stopMicCapture();
            }
            safeCreateIcons();
        });
    }

    function startDemoFallbackFromMic() {
        // Change UI state to match simulation
        micActive = false;
        micToggleBtn.classList.remove('active');
        micToggleBtn.innerHTML = '<i data-lucide="mic"></i><span>Micrófono</span>';
        
        demoActive = true;
        if (demoToggleBtn) {
            demoToggleBtn.classList.add('active');
            demoToggleBtn.innerHTML = '<i data-lucide="square"></i><span>Parar Demo</span>';
        }
        
        simulateSpeechStream();
    }

    function stopMicCapture() {
        if (window.micExplanationTimeout) {
            clearTimeout(window.micExplanationTimeout);
        }
        if (micActive) {
            playDeactiveChime();
        }
        micActive = false;
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        micToggleBtn.classList.remove('active');
        micToggleBtn.innerHTML = '<i data-lucide="mic"></i><span>Micrófono</span>';
        accessibilityHub.classList.remove('listening');
        accessibilityHub.classList.remove('signing');
        
        speechTranscript.textContent = 'Idling... Activa el micrófono para iniciar traducción simultánea o inicia la Demo.';
        signGloss.textContent = '---';
        brailleTextDots.textContent = '⠠⠇⠊⠎⠞⠕⠠⠠';
        showToast('Micrófono desactivado.');
    }

    // Camera Toggle Event (Live Webcam Stream)
    if (cameraToggleBtn) {
        cameraToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraActive = !cameraActive;
            
            if (cameraActive) {
                playActiveChime();
                cameraToggleBtn.classList.add('active');
                cameraToggleBtn.innerHTML = '<i data-lucide="video-off"></i><span>Apagar Cámara</span>';
                
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true })
                        .then((stream) => {
                            webcamStream = stream;
                            webcamVideo.srcObject = stream;
                            webcamVideo.style.display = 'block';
                            interpreterSvg.style.display = 'none';
                            showToast('¡Cámara web en vivo activada! 🎥✨');
                        })
                        .catch((err) => {
                            console.error('Error accessing webcam:', err);
                            showToast('No se pudo acceder a la cámara web. 🎥❌');
                            stopWebcam();
                        });
                } else {
                    showToast('Cámara web no soportada en este navegador. 🎥❌');
                    stopWebcam();
                }
            } else {
                stopWebcam();
            }
            safeCreateIcons();
        });
    }

    function stopWebcam() {
        if (cameraActive) {
            playDeactiveChime();
        }
        cameraActive = false;
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        webcamVideo.srcObject = null;
        webcamVideo.style.display = 'none';
        interpreterSvg.style.display = 'block';
        if (cameraToggleBtn) {
            cameraToggleBtn.classList.remove('active');
            cameraToggleBtn.innerHTML = '<i data-lucide="video"></i><span>Cámara</span>';
        }
        showToast('Cámara desactivada.');
    }

    // Simulated Demo Toggle Button
    const demoToggleBtn = document.getElementById('demoToggleBtn');
    if (demoToggleBtn) {
        demoToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Turn off mic if active
            if (micActive) {
                stopMicCapture();
            }
            
            demoActive = !demoActive;
            
            if (demoActive) {
                playActiveChime();
                
                // Warm up speech synthesis
                speakText(' ', 'es-ES');
                
                demoToggleBtn.classList.add('active');
                demoToggleBtn.innerHTML = '<i data-lucide="square"></i><span>Parar Demo</span>';
                accessibilityHub.classList.add('listening');
                
                showToast('Iniciando simulación de voz y traducción de diseño... 📢✨');
                speakText("Iniciando demostración automatizada.", "es-ES");
                
                simulateSpeechStream();
            } else {
                stopDemoSimulation();
            }
            safeCreateIcons();
        });
    }

    function simulateSpeechStream() {
        if (micInterval) clearInterval(micInterval);
        
        scriptIndex = 0;
        runSpeechIndex();
        
        micInterval = setInterval(() => {
            scriptIndex = (scriptIndex + 1) % speechScripts.length;
            runSpeechIndex();
        }, 7500);
    }

    function runSpeechIndex() {
        const item = speechScripts[scriptIndex];
        
        // Speak Spanish text aloud (Presenter speaks)
        speakText(item.es, 'es-ES');
        
        // Start signing animation
        accessibilityHub.classList.add('signing');
        
        // Stream text word-by-word
        const words = item.es.split(' ');
        let currentWordIndex = 0;
        speechTranscript.textContent = '';
        signGloss.textContent = '';
        brailleTextDots.textContent = '';
        
        if (signTimeout) clearInterval(signTimeout);
        
        signTimeout = setInterval(() => {
            if (currentWordIndex < words.length) {
                speechTranscript.textContent += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
                
                const ratio = Math.ceil((currentWordIndex + 1) / words.length * item.gloss.split(' ').length);
                signGloss.textContent = item.gloss.split(' ').slice(0, ratio).join(' ');
                brailleTextDots.textContent = translateToBraille(speechTranscript.textContent);
                
                // Play quick soft beep for word streaming sound feedback
                playBeep(400 + (currentWordIndex * 20), 'sine', 0.04);
                
                currentWordIndex++;
            } else {
                clearInterval(signTimeout);
                
                // Speak English translation aloud when Spanish text finishes (Interpreter speaks)
                setTimeout(() => {
                    if (demoActive) {
                        speakText(item.en, 'en-US');
                    }
                }, 600);
                
                // Pause arms gesturing briefly when phrase ends
                setTimeout(() => {
                    if (demoActive && currentWordIndex >= words.length) {
                        accessibilityHub.classList.remove('signing');
                    }
                }, 2800);
            }
        }, 320);
    }

    function stopDemoSimulation() {
        if (demoActive) {
            playDeactiveChime();
        }
        demoActive = false;
        if (micInterval) clearInterval(micInterval);
        if (signTimeout) clearInterval(signTimeout);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        if (demoToggleBtn) {
            demoToggleBtn.classList.remove('active');
            demoToggleBtn.innerHTML = '<i data-lucide="play"></i><span>Simular Demo</span>';
        }
        accessibilityHub.classList.remove('listening');
        accessibilityHub.classList.remove('signing');
        
        speechTranscript.textContent = 'Idling... Activa el micrófono para iniciar traducción simultánea o inicia la Demo.';
        signGloss.textContent = '---';
        brailleTextDots.textContent = '⠠⠇⠊⠎⠞⠕⠠⠠';
        showToast('Demostración finalizada.');
    }

    // Hover Reader Logic
    if (hoverReaderToggle) {
        hoverReaderToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            hoverReaderActive = !hoverReaderActive;
            
            if (hoverReaderActive) {
                playActiveChime();
                hoverReaderToggle.classList.add('active');
                hoverReaderToggle.innerHTML = '<i data-lucide="eye-off"></i><span>Lector: On</span>';
                showToast('¡Lector Hover activo! Pasa el cursor sobre elementos o formas para traducirlos. 👁️🤟');
                
                // Warm up voice
                speakText(' ', 'es-ES');
                speakText("Lector activado.", "es-ES");
                
                enableHoverListeners();
            } else {
                playDeactiveChime();
                hoverReaderToggle.classList.remove('active');
                hoverReaderToggle.innerHTML = '<i data-lucide="eye"></i><span>Lector: Off</span>';
                showToast('Lector Hover desactivado.');
                disableHoverListeners();
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
            }
            safeCreateIcons();
        });
    }

    // Mapping details for elements translation
    const hoverTranslations = {
        'rect': { es: 'Rectángulo', en: 'Rectangle', gloss: 'RECTANGLE SHAPE' },
        'circle': { es: 'Círculo', en: 'Circle', gloss: 'CIRCLE SHAPE' },
        'triangle': { es: 'Triángulo', en: 'Triangle', gloss: 'TRIANGLE SHAPE' },
        'star': { es: 'Estrella', en: 'Star', gloss: 'STAR SHAPE' },
        'text': { es: 'Caja de Texto', en: 'Text Box', gloss: 'TEXT BOX WRITE' },
        'path': { es: 'Trazo Libre de Lápiz', en: 'Freehand Line Stroke', gloss: 'PENCIL LINE DRAW' },
        'select': { es: 'Herramienta Puntero Selección', en: 'Pointer Selector Tool', gloss: 'POINTER SELECT TOOL' },
        'pencil': { es: 'Herramienta Lápiz Dibujar', en: 'Pencil Draw Tool', gloss: 'PENCIL DRAW TOOL' },
        'clear': { es: 'Limpiar Todo el Lienzo', en: 'Clear Entire Canvas', gloss: 'CANVAS TRASH CLEAN ALL' },
        'share': { es: 'Compartir Proyecto Colaborativo', en: 'Share Collaborative Project', gloss: 'SHARE LINK TEAM' }
    };

    function handleHoverEnter(e) {
        if (!hoverReaderActive) return;
        
        let type = '';
        if (e.currentTarget.classList.contains('tool-btn')) {
            type = e.currentTarget.getAttribute('data-tool');
            if (e.currentTarget.id === 'clearCanvas') type = 'clear';
        } else if (e.currentTarget.classList.contains('share-btn')) {
            type = 'share';
        } else if (e.currentTarget.classList.contains('canvas-shape')) {
            const classes = e.currentTarget.className;
            if (classes.includes('shape-rect')) type = 'rect';
            else if (classes.includes('shape-circle')) type = 'circle';
            else if (classes.includes('shape-triangle')) type = 'triangle';
            else if (classes.includes('shape-star')) type = 'star';
            else if (classes.includes('shape-text')) type = 'text';
        } else if (e.currentTarget.tagName.toLowerCase() === 'path' || e.currentTarget.id.startsWith('path-')) {
            type = 'path';
        }

        const data = hoverTranslations[type];
        if (data) {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hoverSpeechTimeout) clearTimeout(hoverSpeechTimeout);
            
            // Trigger interpreter gesturing
            accessibilityHub.classList.add('signing');
            
            speechTranscript.textContent = `[Lectura] ${data.es} (${data.en})`;
            signGloss.textContent = data.gloss;
            brailleTextDots.textContent = translateToBraille(data.es);
            
            // Speak Spanish aloud immediately
            speakText(data.es, 'es-ES');
            
            // Speak English translation aloud after a short delay
            hoverSpeechTimeout = setTimeout(() => {
                if (hoverReaderActive) {
                    speakText(data.en, 'en-US');
                }
            }, 1200);
        }
    }

    function handleHoverLeave() {
        if (!hoverReaderActive) return;
        
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (hoverSpeechTimeout) clearTimeout(hoverSpeechTimeout);
        
        hoverTimeout = setTimeout(() => {
            if (!micActive && !demoActive) {
                accessibilityHub.classList.remove('signing');
                speechTranscript.textContent = 'Pasa el cursor sobre un elemento para leer...';
                signGloss.textContent = '---';
                brailleTextDots.textContent = '⠀';
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
            }
        }, 1000);
    }

    function enableHoverListeners() {
        // Toolbar buttons
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.addEventListener('mouseenter', handleHoverEnter);
            b.addEventListener('mouseleave', handleHoverLeave);
        });
        
        // Share btn
        const share = document.querySelector('.share-btn');
        if (share) {
            share.addEventListener('mouseenter', handleHoverEnter);
            share.addEventListener('mouseleave', handleHoverLeave);
        }
        
        // Shape elements
        document.querySelectorAll('.canvas-shape').forEach(s => {
            s.addEventListener('mouseenter', handleHoverEnter);
            s.addEventListener('mouseleave', handleHoverLeave);
        });

        // Paths in SVG
        document.querySelectorAll('.canvas-svg-layer path').forEach(p => {
            p.addEventListener('mouseenter', handleHoverEnter);
            p.addEventListener('mouseleave', handleHoverLeave);
        });
    }

    function disableHoverListeners() {
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.removeEventListener('mouseenter', handleHoverEnter);
            b.removeEventListener('mouseleave', handleHoverLeave);
        });
        const share = document.querySelector('.share-btn');
        if (share) {
            share.removeEventListener('mouseenter', handleHoverEnter);
            share.removeEventListener('mouseleave', handleHoverLeave);
        }
        document.querySelectorAll('.canvas-shape').forEach(s => {
            s.removeEventListener('mouseenter', handleHoverEnter);
            s.removeEventListener('mouseleave', handleHoverLeave);
        });
        document.querySelectorAll('.canvas-svg-layer path').forEach(p => {
            p.removeEventListener('mouseenter', handleHoverEnter);
            p.removeEventListener('mouseleave', handleHoverLeave);
        });
    }

    // Manual Braille Input Translator Listener
    if (brailleInputText) {
        brailleInputText.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.trim() === '') {
                brailleLivePreview.textContent = '---';
            } else {
                brailleLivePreview.textContent = translateToBraille(val);
            }
        });
    }

    // ==========================================
    // FONT SIZE ADJUSTMENT FOR ACCESSIBILITY
    // ==========================================
    const fontDecBtn = document.getElementById('fontDecBtn');
    const fontIncBtn = document.getElementById('fontIncBtn');
    const fontResetBtn = document.getElementById('fontResetBtn');
    const fontSizeVal = document.getElementById('fontSizeVal');
    
    let fontScale = 100;
    const fontScaleKey = 'kaleidos-font-scale';
    
    function applyFontScale(scale) {
        document.documentElement.style.fontSize = scale + '%';
        if (fontSizeVal) {
            fontSizeVal.textContent = scale + '%';
        }
        localStorage.setItem(fontScaleKey, scale);
    }
    
    // Load from localStorage if present
    const savedScale = localStorage.getItem(fontScaleKey);
    if (savedScale) {
        const parsed = parseInt(savedScale, 10);
        if (!isNaN(parsed) && parsed >= 70 && parsed <= 200) {
            fontScale = parsed;
            applyFontScale(fontScale);
        }
    }
    
    if (fontDecBtn) {
        fontDecBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fontScale > 70) {
                fontScale = Math.max(70, fontScale - 10);
                applyFontScale(fontScale);
                if (typeof showToast === 'function') {
                    showToast(`Tamaño de letra reducido al ${fontScale}% 🔍`);
                }
            }
        });
    }
    
    if (fontIncBtn) {
        fontIncBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fontScale < 200) {
                fontScale = Math.min(200, fontScale + 10);
                applyFontScale(fontScale);
                if (typeof showToast === 'function') {
                    showToast(`Tamaño de letra aumentado al ${fontScale}% 🔍`);
                }
            }
        });
    }
    
    if (fontResetBtn) {
        fontResetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fontScale = 100;
            applyFontScale(fontScale);
            if (typeof showToast === 'function') {
                showToast('Tamaño de letra restablecido al 100% 🔍');
            }
        });
    }
    
    // Initial display sync
    if (fontSizeVal) {
        fontSizeVal.textContent = fontScale + '%';
    }
});
