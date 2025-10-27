/**
 * Complete Text Editor - Drag to Move + Double-Click to Edit
 */
var AdvancedTextEditor = (function() {
    'use strict';
    
    let currentEditingText = null;
    let editBox = null;
    
    // Text drag state
    let textDragging = false;
    let textDragStartX = 0;
    let textDragStartY = 0;
    let textGroupStartX = 0;
    let textGroupStartY = 0;
    let draggedGroup = null;
    
    // Box drag state
    let boxDragging = false;
    let boxDragStartX = 0;
    let boxDragStartY = 0;
    let boxStartX = 0;
    let boxStartY = 0;
    
    // Click detection
    let clickCount = 0;
    let clickTimer = null;

    function init() {
        console.log('✏️ Text Editor + Dragger Initialized');
        setTimeout(() => {
            createEditBox();
            attachTextDragEvents();
            console.log('✅ Ready - Drag text to move, double-click to edit');
        }, 1000);
    }

    function createEditBox() {
        editBox = document.createElement('div');
        editBox.id = 'textEditBox';
        editBox.style.cssText = `
            display: none;
            position: fixed;
            background: white;
            border: 2px solid #4b79aa;
            border-radius: 8px;
            padding: 0;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 90vw;
            max-height: 90vh;
            overflow: hidden;
            touch-action: none;
        `;
        
        editBox.innerHTML = `
            <div id="editBoxHeader" style="
                background: linear-gradient(135deg, #4b79aa 0%, #3a5f85 100%);
                color: white;
                padding: 12px 15px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
                user-select: none;
                touch-action: none;
            ">
                <h4 style="margin: 0; font-size: 1.1em;">
                    <i class="fa fa-arrows"></i> ✏️ Edit Text
                </h4>
                <button id="textEditClose" style="background: rgba(255,255,255,0.2); border: none; font-size: 24px; cursor: pointer; color: white; padding: 0; width: 30px; height: 30px; border-radius: 4px;">×</button>
            </div>

            <div style="padding: 15px; max-height: calc(90vh - 60px); overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #555;">Text:</label>
                    <textarea id="textEditInput" style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; touch-action: manipulation;"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #555;">Font Size: <span id="fontSizeValue">16</span>px</label>
                    <input type="range" id="fontSizeSlider" min="8" max="60" value="16" step="1" style="width: 100%; touch-action: pan-x;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #555;">Color:</label>
                    <input type="color" id="customColor" value="#000000" style="width: 100%; height: 45px; cursor: pointer; border: 1px solid #ddd; border-radius: 4px; touch-action: manipulation;">
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="textEditSave" style="flex: 1; padding: 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; touch-action: manipulation;"><i class="fa fa-check"></i> Save</button>
                    <button id="textEditCancel" style="flex: 1; padding: 15px; background: #f0f0f0; color: #333; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; touch-action: manipulation;"><i class="fa fa-times"></i> Cancel</button>
                    <button id="textEditDelete" style="flex: 1; padding: 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; touch-action: manipulation;"><i class="fa fa-trash"></i> Delete</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(editBox);
        setupEventListeners();
        setupBoxDrag();
    }

    function setupBoxDrag() {
        const header = document.getElementById('editBoxHeader');
        
        header.addEventListener('pointerdown', function(e) {
            boxDragging = true;
            boxDragStartX = e.clientX;
            boxDragStartY = e.clientY;
            
            const rect = editBox.getBoundingClientRect();
            boxStartX = rect.left;
            boxStartY = rect.top;
            
            header.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('pointermove', function(e) {
            if (!boxDragging) return;
            
            const deltaX = e.clientX - boxDragStartX;
            const deltaY = e.clientY - boxDragStartY;
            
            let newX = boxStartX + deltaX;
            let newY = boxStartY + deltaY;
            
            const rect = editBox.getBoundingClientRect();
            newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
            newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));
            
            editBox.style.left = newX + 'px';
            editBox.style.top = newY + 'px';
        });

        document.addEventListener('pointerup', function() {
            if (boxDragging) {
                boxDragging = false;
                document.getElementById('editBoxHeader').style.cursor = 'move';
            }
        });
    }

    function attachTextDragEvents() {
        const svg = document.getElementById('lin');
        if (!svg) {
            console.error('❌ SVG not found');
            setTimeout(attachTextDragEvents, 500);
            return;
        }

        const boxText = document.getElementById('boxText');
        if (!boxText) {
            console.error('❌ boxText not found');
            return;
        }

        console.log('✅ Attaching text drag events');

        // Pointer down on text
        svg.addEventListener('pointerdown', function(e) {
            let target = e.target;
            
            if (target.tagName !== 'text' || !boxText.contains(target)) return;
            
            console.log('👆 Text touched:', target.textContent);
            
            // Find parent group
            let parentGroup = target.parentElement;
            while (parentGroup && parentGroup.tagName !== 'g') {
                parentGroup = parentGroup.parentElement;
            }
            
            if (!parentGroup || parentGroup === boxText) {
                parentGroup = target;
            }
            
            draggedGroup = parentGroup;
            
            // Get current transform position
            const transform = parentGroup.getAttribute('transform') || '';
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            
            if (translateMatch) {
                textGroupStartX = parseFloat(translateMatch[1]) || 0;
                textGroupStartY = parseFloat(translateMatch[2]) || 0;
            } else {
                textGroupStartX = 0;
                textGroupStartY = 0;
            }
            
            const CTM = svg.getScreenCTM();
            textDragStartX = (e.clientX - CTM.e) / CTM.a;
            textDragStartY = (e.clientY - CTM.f) / CTM.d;
            
            parentGroup.style.opacity = '0.7';
            
            // Track clicks for double-click
            clickCount++;
            if (clickCount === 1) {
                clickTimer = setTimeout(() => { clickCount = 0; }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                clickCount = 0;
                textDragging = false;
                draggedGroup = null;
                parentGroup.style.opacity = '1';
                openEditBox(target);
                console.log('✏️ Opening editor (double-click)');
            }
        });

        // Pointer move - drag text
        svg.addEventListener('pointermove', function(e) {
            if (!draggedGroup || clickCount === 2) return;
            
            textDragging = true;
            
            const CTM = svg.getScreenCTM();
            const currentX = (e.clientX - CTM.e) / CTM.a;
            const currentY = (e.clientY - CTM.f) / CTM.d;
            
            const deltaX = currentX - textDragStartX;
            const deltaY = currentY - textDragStartY;
            
            const newX = textGroupStartX + deltaX;
            const newY = textGroupStartY + deltaY;
            
            // Update transform
            const oldTransform = draggedGroup.getAttribute('transform') || '';
            let newTransform = '';
            
            if (oldTransform.includes('translate')) {
                newTransform = oldTransform.replace(/translate\([^)]+\)/, `translate(${newX},${newY})`);
            } else {
                newTransform = `translate(${newX},${newY}) ${oldTransform}`;
            }
            
            draggedGroup.setAttribute('transform', newTransform);
            console.log('🔄 Moving to:', newX, newY);
        });

        // Pointer up - stop dragging
        svg.addEventListener('pointerup', function(e) {
            if (draggedGroup) {
                draggedGroup.style.opacity = '1';
                
                if (textDragging) {
                    console.log('📍 Text moved to new position');
                    if (typeof saveHistory === 'function') saveHistory();
                }
                
                draggedGroup = null;
                textDragging = false;
            }
        });
    }

    function setupEventListeners() {
        document.getElementById('textEditSave').addEventListener('pointerdown', saveText);
        document.getElementById('textEditCancel').addEventListener('pointerdown', closeEditBox);
        document.getElementById('textEditDelete').addEventListener('pointerdown', deleteText);
        document.getElementById('textEditClose').addEventListener('pointerdown', closeEditBox);

        document.getElementById('fontSizeSlider').addEventListener('input', function() {
            document.getElementById('fontSizeValue').textContent = this.value;
            if (currentEditingText) currentEditingText.setAttribute('font-size', this.value);
        });

        document.getElementById('customColor').addEventListener('input', function() {
            if (currentEditingText) currentEditingText.setAttribute('fill', this.value);
        });

        document.getElementById('textEditInput').addEventListener('input', function() {
            if (currentEditingText) currentEditingText.textContent = this.value;
        });
    }

    function openEditBox(textElement) {
        currentEditingText = textElement;
        
        const currentText = textElement.textContent || '';
        const fontSize = parseFloat(textElement.getAttribute('font-size') || 16);
        const fill = textElement.getAttribute('fill') || '#000000';
        
        document.getElementById('textEditInput').value = currentText;
        document.getElementById('fontSizeSlider').value = fontSize;
        document.getElementById('fontSizeValue').textContent = fontSize;
        document.getElementById('customColor').value = fill;
        
        editBox.style.display = 'block';
        
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            editBox.style.left = '5vw';
            editBox.style.top = '5vh';
            editBox.style.width = '90vw';
        } else {
            const rect = textElement.getBoundingClientRect();
            editBox.style.left = Math.min(Math.max(rect.left, 10), window.innerWidth - 420) + 'px';
            editBox.style.top = Math.min(rect.bottom + 10, window.innerHeight - 600) + 'px';
            editBox.style.width = '400px';
        }
        
        document.getElementById('textEditInput').focus();
    }

    function closeEditBox() {
        editBox.style.display = 'none';
        currentEditingText = null;
    }

    function saveText() {
        if (typeof saveHistory === 'function') saveHistory();
        $('#boxinfo').html('✅ Saved!').css({color: '#28a745'});
        setTimeout(() => $('#boxinfo').html(''), 2000);
        closeEditBox();
    }

    function deleteText() {
        if (!currentEditingText) return;
        if (confirm('Delete this text?')) {
            let parentGroup = currentEditingText.parentElement;
            while (parentGroup && parentGroup.tagName !== 'g') {
                parentGroup = parentGroup.parentElement;
            }
            
            if (parentGroup && parentGroup !== document.getElementById('boxText')) {
                parentGroup.remove();
            } else {
                currentEditingText.remove();
            }
            
            if (typeof saveHistory === 'function') saveHistory();
            closeEditBox();
        }
    }

    return { init: init };
})();

// CSS
const style = document.createElement('style');
style.textContent = `
    #boxText text {
        cursor: grab !important;
        user-select: none;
        -webkit-user-select: none;
    }
    #boxText g {
        pointer-events: all;
    }
    #editBoxHeader:hover {
        background: linear-gradient(135deg, #3a5f85 0%, #2a4865 100%);
    }
`;
document.head.appendChild(style);

$(document).ready(function() {
    AdvancedTextEditor.init();
    console.log('✅ Text Editor Ready - Drag to move, Double-click to edit');
});
