/**
 * Auto Wall Fix System - Touch to Highlight RED & Auto-Align
 * Simple touch-based wall correction system
 */

var AutoWallFix = (function() {
    'use strict';
    
    const config = {
        snapThreshold: 15,
        highlightColor: '#ff0000',
        normalColor: '#4a4a4a',
        highlightDuration: 1500, // milliseconds
        activeStrokeWidth: 18,
        normalStrokeWidth: 12
    };

    let processingWalls = new Set();

    // Initialize
    function init() {
        console.log('🔧 Auto Wall Fix System Initialized');
        attachPointerEvents();
    }

    // Attach pointer events to SVG
    function attachPointerEvents() {
        const svg = document.getElementById('lin');
        if (!svg) {
            console.error('❌ SVG element #lin not found');
            return;
        }

        // Use pointerdown for all devices (mouse, touch, pen)
        svg.addEventListener('pointerdown', handleWallTouch, { passive: false });
        
        console.log('✅ Touch events ready on SVG');
    }

    // Get SVG coordinates
    function getSVGPoint(evt) {
        const svg = document.getElementById('lin');
        const CTM = svg.getScreenCTM();
        
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    // Check if touch is near wall path
    function isTouchingWall(point, pathElement, threshold = 25) {
        if (!pathElement || !pathElement.getTotalLength) return false;
        
        const pathLength = pathElement.getTotalLength();
        const precision = 40;
        
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

    // Highlight wall in RED
    function highlightWall(wallElement) {
        if (!wallElement) return;
        
        // Visual feedback
        wallElement.style.stroke = config.highlightColor;
        wallElement.style.strokeWidth = config.activeStrokeWidth;
        wallElement.style.filter = 'drop-shadow(0 0 10px rgba(255, 0, 0, 0.8))';
        wallElement.style.transition = 'all 0.3s ease';
        
        // Add pulsing animation
        wallElement.style.animation = 'wallPulse 0.5s ease-in-out 2';
        
        console.log('🔴 Wall highlighted RED');
        
        // Update info box
        const infoBox = document.getElementById('boxinfo');
        if (infoBox) {
            infoBox.innerHTML = '<i class="fa fa-magic" style="color:#ff0000"></i> Fixing wall alignment...';
            infoBox.style.color = '#ff0000';
            infoBox.style.fontWeight = 'bold';
        }
    }

    // Remove highlight
    function removeHighlight(wallElement) {
        if (!wallElement) return;
        
        wallElement.style.stroke = config.normalColor;
        wallElement.style.strokeWidth = config.normalStrokeWidth;
        wallElement.style.filter = 'none';
        wallElement.style.animation = 'none';
        
        console.log('✅ Wall fixed and highlight removed');
    }

    // Auto-fix wall alignment
    function autoFixWall(wallElement) {
        if (!wallElement) return;
        
        const pathData = wallElement.getAttribute('d');
        if (!pathData) return;
        
        // Parse path commands
        const pathCommands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);
        if (!pathCommands) return;
        
        let newPath = '';
        let prevX = 0, prevY = 0;
        
        pathCommands.forEach((cmd, index) => {
            const command = cmd[0];
            const values = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            
            switch(command.toUpperCase()) {
                case 'M':
                case 'L':
                    if (values.length >= 2) {
                        let x = values[0];
                        let y = values[1];
                        
                        // Snap to grid or nearby coordinates
                        x = snapToGrid(x);
                        y = snapToGrid(y);
                        
                        // Check for near-horizontal or near-vertical alignment
                        if (index > 0) {
                            // If nearly horizontal, make it perfectly horizontal
                            if (Math.abs(y - prevY) < config.snapThreshold) {
                                y = prevY;
                            }
                            // If nearly vertical, make it perfectly vertical
                            if (Math.abs(x - prevX) < config.snapThreshold) {
                                x = prevX;
                            }
                        }
                        
                        newPath += `${command}${x},${y} `;
                        prevX = x;
                        prevY = y;
                    }
                    break;
                    
                case 'H':
                    if (values.length >= 1) {
                        let x = snapToGrid(values[0]);
                        newPath += `${command}${x} `;
                        prevX = x;
                    }
                    break;
                    
                case 'V':
                    if (values.length >= 1) {
                        let y = snapToGrid(values[0]);
                        newPath += `${command}${y} `;
                        prevY = y;
                    }
                    break;
                    
                case 'Z':
                    newPath += 'Z ';
                    break;
                    
                default:
                    newPath += cmd + ' ';
            }
        });
        
        // Update path with fixed coordinates
        wallElement.setAttribute('d', newPath.trim());
        
        console.log('🔧 Wall coordinates auto-corrected');
    }

    // Snap to grid (50px intervals)
    function snapToGrid(value) {
        const gridSize = 50;
        const snapped = Math.round(value / gridSize) * gridSize;
        
        // Only snap if close enough
        if (Math.abs(value - snapped) < config.snapThreshold * 2) {
            return snapped;
        }
        
        return Math.round(value);
    }

    // Find nearby walls and align to them
    function alignToNearbyWalls(wallElement) {
        const boxwall = document.getElementById('boxwall');
        if (!boxwall) return;
        
        const allWalls = boxwall.querySelectorAll('path');
        const currentPath = wallElement.getAttribute('d');
        
        // Get current wall endpoints
        const coords = extractCoordinates(currentPath);
        if (!coords) return;
        
        // Check each other wall
        allWalls.forEach(otherWall => {
            if (otherWall === wallElement) return;
            
            const otherPath = otherWall.getAttribute('d');
            const otherCoords = extractCoordinates(otherPath);
            if (!otherCoords) return;
            
            // Snap endpoints if they're close
            coords.forEach(point => {
                otherCoords.forEach(otherPoint => {
                    const distance = Math.sqrt(
                        Math.pow(point.x - otherPoint.x, 2) + 
                        Math.pow(point.y - otherPoint.y, 2)
                    );
                    
                    if (distance < config.snapThreshold) {
                        // Snap this point to the other point
                        point.x = otherPoint.x;
                        point.y = otherPoint.y;
                    }
                });
            });
        });
        
        // Rebuild path with aligned coordinates
        rebuildPath(wallElement, coords);
    }

    // Extract coordinates from path
    function extractCoordinates(pathData) {
        const coords = [];
        const pathCommands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);
        
        if (!pathCommands) return null;
        
        pathCommands.forEach(cmd => {
            const command = cmd[0].toUpperCase();
            const values = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            
            if ((command === 'M' || command === 'L') && values.length >= 2) {
                coords.push({ x: values[0], y: values[1] });
            }
        });
        
        return coords;
    }

    // Rebuild path from coordinates
    function rebuildPath(wallElement, coords) {
        if (!coords || coords.length === 0) return;
        
        let newPath = `M${coords[0].x},${coords[0].y} `;
        
        for (let i = 1; i < coords.length; i++) {
            newPath += `L${coords[i].x},${coords[i].y} `;
        }
        
        wallElement.setAttribute('d', newPath.trim());
    }

    // Main touch handler
    function handleWallTouch(evt) {
        const target = evt.target;
        const boxwall = document.getElementById('boxwall');
        
        // Check if touch is on a wall path
        if (!boxwall || !boxwall.contains(target)) return;
        if (target.tagName !== 'path') return;
        
        // Prevent multiple processing of same wall
        if (processingWalls.has(target)) return;
        processingWalls.add(target);
        
        evt.preventDefault();
        
        const touchPoint = getSVGPoint(evt);
        
        // Verify touch is actually on the wall
        if (!isTouchingWall(touchPoint, target)) {
            processingWalls.delete(target);
            return;
        }
        
        console.log('👆 Wall touched - Starting auto-fix...');
        
        // Step 1: Highlight RED
        highlightWall(target);
        
        // Step 2: Auto-fix alignment after short delay (visual feedback)
        setTimeout(() => {
            autoFixWall(target);
            alignToNearbyWalls(target);
            
            // Update measurements and rooms
            if (typeof rib === 'function') rib();
            if (typeof room === 'function') room();
            
            // Save to history
            if (typeof saveHistory === 'function') saveHistory();
            
            // Step 3: Show success message
            const infoBox = document.getElementById('boxinfo');
            if (infoBox) {
                infoBox.innerHTML = '<i class="fa fa-check-circle" style="color:#28a745"></i> Wall alignment fixed!';
                infoBox.style.color = '#28a745';
            }
            
            // Step 4: Remove highlight after duration
            setTimeout(() => {
                removeHighlight(target);
                processingWalls.delete(target);
                
                if (infoBox) {
                    infoBox.innerHTML = '';
                }
            }, config.highlightDuration);
            
        }, 300); // Short delay for visual feedback
    }

    // Public API
    return {
        init: init,
        setSnapThreshold: function(value) { config.snapThreshold = value; },
        setHighlightDuration: function(ms) { config.highlightDuration = ms; }
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        AutoWallFix.init();
    });
} else {
    AutoWallFix.init();
}
