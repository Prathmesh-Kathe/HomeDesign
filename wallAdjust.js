/**
 * Wall Adjustment System - Red Highlighting & Auto-Snap
 * Integrates with your existing floor plan editor
 */

var WallAdjustment = (function() {
    'use strict';
    
    const config = {
        snapEnabled: true,
        snapThreshold: 15,
        highlightColor: '#ff0000',
        normalColor: '#4a4a4a',
        activeStrokeWidth: 16,
        normalStrokeWidth: 12,
        gridSnapSize: 50
    };

    let selectedWall = null;
    let isDragging = false;
    let dragStartPoint = null;
    let originalWallData = null;
    let pointerHandlers = [];

    // Initialize the system
    function init() {
        console.log('🔧 Wall Adjustment System Initialized');
        setupPointerEvents();
        setupSnapSystem();
    }

    // Setup unified pointer events for wall interaction
    function setupPointerEvents() {
        const svg = document.getElementById('lin');
        if (!svg) {
            console.error('SVG element #lin not found');
            return;
        }

        // Use pointer events for cross-device compatibility
        svg.addEventListener('pointerdown', handlePointerDown, { passive: false });
        svg.addEventListener('pointermove', handlePointerMove, { passive: false });
        svg.addEventListener('pointerup', handlePointerUp, { passive: false });
        svg.addEventListener('pointercancel', handlePointerUp, { passive: false });

        console.log('✅ Pointer events attached to SVG');
    }

    // Get SVG coordinates from pointer event
    function getSVGPoint(evt) {
        const svg = document.getElementById('lin');
        const CTM = svg.getScreenCTM();
        
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    // Check if pointer is near a wall path
    function isNearWall(point, pathElement, threshold = 20) {
        if (!pathElement || !pathElement.getTotalLength) return false;
        
        const pathLength = pathElement.getTotalLength();
        const precision = 50;
        
        for (let i = 0; i <= pathLength; i += precision) {
            const pathPoint = pathElement.getPointAtLength(i);
            const distance = Math.sqrt(
                Math.pow(point.x - pathPoint.x, 2) + 
                Math.pow(point.y - pathPoint.y, 2)
            );
            
            if (distance < threshold) {
                return true;
            }
        }
        
        return false;
    }

    // Highlight wall in red
    function highlightWall(wallElement) {
        if (!wallElement) return;
        
        wallElement.style.stroke = config.highlightColor;
        wallElement.style.strokeWidth = config.activeStrokeWidth;
        wallElement.style.cursor = 'move';
        wallElement.style.filter = 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.6))';
        
        console.log('🔴 Wall highlighted:', wallElement.id || 'unnamed');
        
        // Update info box
        const infoBox = document.getElementById('boxinfo');
        if (infoBox) {
            infoBox.innerHTML = '<i class="fa fa-hand-pointer"></i> Wall selected - Drag to adjust position';
            infoBox.style.color = '#ff0000';
        }
    }

    // Remove wall highlight
    function removeHighlight(wallElement) {
        if (!wallElement) return;
        
        wallElement.style.stroke = config.normalColor;
        wallElement.style.strokeWidth = config.normalStrokeWidth;
        wallElement.style.cursor = 'pointer';
        wallElement.style.filter = 'none';
        
        console.log('⚪ Wall highlight removed');
        
        const infoBox = document.getElementById('boxinfo');
        if (infoBox) {
            infoBox.innerHTML = '';
        }
    }

    // Snap coordinate to grid or nearby walls
    function snapToGrid(value) {
        if (!config.snapEnabled) return value;
        
        const snapped = Math.round(value / config.gridSnapSize) * config.gridSnapSize;
        
        if (Math.abs(value - snapped) < config.snapThreshold) {
            return snapped;
        }
        
        return value;
    }

    // Handle pointer down
    function handlePointerDown(evt) {
        // Only handle in select mode or wall mode
        if (mode !== 'select_mode' && mode !== 'wall_adjust_mode') return;
        
        const target = evt.target;
        const svg = document.getElementById('lin');
        
        // Check if target is a wall path in boxwall
        const boxwall = document.getElementById('boxwall');
        if (!boxwall || !boxwall.contains(target)) return;
        
        if (target.tagName === 'path' && target.hasAttribute('d')) {
            evt.preventDefault();
            
            const point = getSVGPoint(evt);
            
            // Check if pointer is near the wall path
            if (isNearWall(point, target)) {
                selectedWall = target;
                isDragging = true;
                dragStartPoint = point;
                
                // Store original path data
                originalWallData = {
                    d: target.getAttribute('d'),
                    transform: target.getAttribute('transform') || ''
                };
                
                // Highlight the wall
                highlightWall(selectedWall);
                
                // Store wall index for WALLS array update
                const pathIndex = Array.from(boxwall.children).indexOf(target);
                selectedWall.dataset.wallIndex = pathIndex;
                
                console.log('👆 Pointer down on wall:', pathIndex);
            }
        }
    }

    // Handle pointer move
    function handlePointerMove(evt) {
        if (!isDragging || !selectedWall || !dragStartPoint) return;
        
        evt.preventDefault();
        
        const currentPoint = getSVGPoint(evt);
        
        // Calculate delta movement
        let deltaX = currentPoint.x - dragStartPoint.x;
        let deltaY = currentPoint.y - dragStartPoint.y;
        
        // Apply snapping
        const snappedDeltaX = snapToGrid(deltaX);
        const snappedDeltaY = snapToGrid(deltaY);
        
        // Update wall position with transform
        const currentTransform = selectedWall.getAttribute('transform') || '';
        const translateMatch = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
        
        let baseX = 0, baseY = 0;
        if (translateMatch) {
            baseX = parseFloat(translateMatch[1]);
            baseY = parseFloat(translateMatch[2]);
        }
        
        const newTransform = `translate(${baseX + snappedDeltaX}, ${baseY + snappedDeltaY})`;
        selectedWall.setAttribute('transform', newTransform);
        
        // Update coordinates display
        const infoBox = document.getElementById('boxinfo');
        if (infoBox) {
            infoBox.innerHTML = `<i class="fa fa-arrows"></i> Moving: ΔX: ${Math.round(snappedDeltaX)}px, ΔY: ${Math.round(snappedDeltaY)}px`;
        }
        
        // Update corresponding WALLS array data if exists
        updateWallsArray(selectedWall, snappedDeltaX, snappedDeltaY);
    }

    // Handle pointer up
    function handlePointerUp(evt) {
        if (!isDragging || !selectedWall) return;
        
        evt.preventDefault();
        
        console.log('👆 Pointer up - Wall adjustment complete');
        
        // Finalize wall position
        const currentTransform = selectedWall.getAttribute('transform') || '';
        const translateMatch = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
        
        if (translateMatch) {
            const deltaX = parseFloat(translateMatch[1]);
            const deltaY = parseFloat(translateMatch[2]);
            
            // Update the actual path data permanently
            updatePathData(selectedWall, deltaX, deltaY);
            
            // Reset transform
            selectedWall.removeAttribute('transform');
        }
        
        // Remove highlight
        removeHighlight(selectedWall);
        
        // Update info
        const infoBox = document.getElementById('boxinfo');
        if (infoBox) {
            infoBox.innerHTML = '<i class="fa fa-check-circle" style="color:#28a745"></i> Wall position updated';
            setTimeout(() => {
                infoBox.innerHTML = '';
            }, 2000);
        }
        
        // Recalculate rooms and measurements
        if (typeof rib === 'function') rib();
        if (typeof room === 'function') room();
        
        // Save to history
        if (typeof saveHistory === 'function') saveHistory();
        
        // Reset state
        isDragging = false;
        selectedWall = null;
        dragStartPoint = null;
        originalWallData = null;
    }

    // Update path data with delta movement
    function updatePathData(pathElement, deltaX, deltaY) {
        const currentPath = pathElement.getAttribute('d');
        const pathCommands = currentPath.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);
        
        if (!pathCommands) return;
        
        let newPath = '';
        
        pathCommands.forEach(cmd => {
            const command = cmd[0];
            const values = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            
            switch(command.toUpperCase()) {
                case 'M':
                case 'L':
                    if (values.length >= 2) {
                        newPath += `${command}${values[0] + deltaX},${values[1] + deltaY} `;
                    }
                    break;
                case 'H':
                    if (values.length >= 1) {
                        newPath += `${command}${values[0] + deltaX} `;
                    }
                    break;
                case 'V':
                    if (values.length >= 1) {
                        newPath += `${command}${values[0] + deltaY} `;
                    }
                    break;
                case 'C':
                    if (values.length >= 6) {
                        newPath += `${command}${values[0] + deltaX},${values[1] + deltaY} ${values[2] + deltaX},${values[3] + deltaY} ${values[4] + deltaX},${values[5] + deltaY} `;
                    }
                    break;
                case 'Z':
                    newPath += 'Z ';
                    break;
                default:
                    newPath += cmd + ' ';
            }
        });
        
        pathElement.setAttribute('d', newPath.trim());
        console.log('✅ Path data updated permanently');
    }

    // Update WALLS array if it exists
    function updateWallsArray(wallElement, deltaX, deltaY) {
        if (typeof WALLS === 'undefined') return;
        
        const wallIndex = parseInt(wallElement.dataset.wallIndex);
        if (isNaN(wallIndex) || !WALLS[wallIndex]) return;
        
        WALLS[wallIndex].start.x += deltaX;
        WALLS[wallIndex].start.y += deltaY;
        WALLS[wallIndex].end.x += deltaX;
        WALLS[wallIndex].end.y += deltaY;
    }

    // Setup snap system toggle
    function setupSnapSystem() {
        // Add toggle button to panel if not exists
        const panel = document.getElementById('panel');
        if (!panel) return;
        
        const snapButton = document.createElement('button');
        snapButton.className = 'btn btn-light shadow fully';
        snapButton.id = 'snap_toggle';
        snapButton.innerHTML = '<i class="fa fa-magnet"></i> SNAP: ON';
        snapButton.style.marginTop = '6px';
        snapButton.style.background = '#28a745';
        snapButton.style.color = 'white';
        
        snapButton.addEventListener('click', function() {
            config.snapEnabled = !config.snapEnabled;
            this.innerHTML = `<i class="fa fa-magnet"></i> SNAP: ${config.snapEnabled ? 'ON' : 'OFF'}`;
            this.style.background = config.snapEnabled ? '#28a745' : '#6c757d';
            console.log('🧲 Snap system:', config.snapEnabled ? 'ENABLED' : 'DISABLED');
        });
        
        // Insert after distance_mode button
        const distanceBtn = document.getElementById('distance_mode');
        if (distanceBtn && distanceBtn.parentElement) {
            distanceBtn.parentElement.insertAdjacentElement('afterend', createListItem(snapButton));
        }
    }

    // Helper to create list item
    function createListItem(button) {
        const li = document.createElement('li');
        li.appendChild(button);
        return li;
    }

    // Public API
    return {
        init: init,
        enableSnap: function() { config.snapEnabled = true; },
        disableSnap: function() { config.snapEnabled = false; },
        setSnapThreshold: function(value) { config.snapThreshold = value; },
        setGridSize: function(value) { config.gridSnapSize = value; }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        WallAdjustment.init();
    });
} else {
    WallAdjustment.init();
}
