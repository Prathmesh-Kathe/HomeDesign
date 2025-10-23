// =============================================================================
// TOUCH SCREEN ONLY HANDLER
// Only activates on touch devices, leaves mouse events untouched
// =============================================================================

(function() {
  'use strict';

  // Check if this is a touch device
  const isTouchDevice = ('ontouchstart' in window) || 
                        (navigator.maxTouchPoints > 0) || 
                        (navigator.msMaxTouchPoints > 0);

  if (!isTouchDevice) {
    console.log('⏭️ Not a touch device - skipping touch handler');
    return; // Exit completely on non-touch devices
  }

  const svg = document.querySelector('#lin');
  if (!svg) {
    console.error('❌ SVG #lin not found');
    return;
  }

  console.log('📱 Touch device detected - loading touch handler');

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  const config = {
    doubleTapDelay: 400,        // ms between taps for double-tap
    longPressDelay: 600,        // ms for long-press
    moveThreshold: 15,          // pixels before canceling long-press
    pinchThreshold: 10          // minimum pinch distance change
  };

  // =============================================================================
  // STATE
  // =============================================================================

  let touchState = {
    isDown: false,
    isPinching: false,
    lastTapTime: 0,
    longPressTimer: null,
    startPos: null,
    startTime: 0,
    initialZoom: 1,
    pinchStartDist: 0,
    pinchStartCenter: null
  };

  let rafId = null;
  let pendingZoom = null;

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  function getPosition(touch) {
    const rect = svg.getBoundingClientRect();
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    return {
      x: (clientX - rect.left) * factor + originX_viewbox,
      y: (clientY - rect.top) * factor + originY_viewbox,
      clientX: clientX,
      clientY: clientY,
      pageX: touch.pageX || clientX,
      pageY: touch.pageY || clientY
    };
  }

  function getTouchDistance(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(t1, t2) {
    return {
      clientX: (t1.clientX + t2.clientX) / 2,
      clientY: (t1.clientY + t2.clientY) / 2
    };
  }

  function createMouseEvent(pos, type) {
    return {
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: pos.clientX,
      clientY: pos.clientY,
      pageX: pos.pageX,
      pageY: pos.pageY,
      target: svg,
      currentTarget: svg,
      type: type,
      button: 0,
      buttons: 1,
      which: 1
    };
  }

  function cleanup() {
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer);
      touchState.longPressTimer = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    touchState.isDown = false;
    touchState.isPinching = false;
    pendingZoom = null;
  }

  // =============================================================================
  // TOUCH EVENT HANDLERS
  // =============================================================================

  function onTouchStart(evt) {
    const touches = evt.touches;

    // TWO FINGER PINCH
    if (touches.length === 2) {
      evt.preventDefault();
      touchState.isPinching = true;
      touchState.pinchStartDist = getTouchDistance(touches[0], touches[1]);
      touchState.pinchStartCenter = getTouchCenter(touches[0], touches[1]);
      touchState.initialZoom = factor;
      
      // Cancel any long press
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer);
        touchState.longPressTimer = null;
      }
      return;
    }

    // SINGLE FINGER TOUCH
    if (touches.length === 1) {
      evt.preventDefault();
      
      const pos = getPosition(touches[0]);
      touchState.isDown = true;
      touchState.startPos = { x: pos.x, y: pos.y };
      touchState.startTime = Date.now();

      // Start long-press timer
      touchState.longPressTimer = setTimeout(() => {
        handleLongPress(pos);
      }, config.longPressDelay);

      // Trigger your existing MOUSEDOWN
      const mouseEvt = createMouseEvent(pos, 'mousedown');
      if (typeof MOUSEDOWN === 'function') {
        MOUSEDOWN(mouseEvt);
      }
    }
  }

  function onTouchMove(evt) {
    const touches = evt.touches;

    // PINCH ZOOM
    if (touches.length === 2 && touchState.isPinching) {
      evt.preventDefault();
      handlePinchZoom(touches);
      return;
    }

    // SINGLE FINGER MOVE
    if (touches.length === 1 && touchState.isDown && !touchState.isPinching) {
      const pos = getPosition(touches[0]);

      // Cancel long-press if moved too far
      if (touchState.longPressTimer && touchState.startPos) {
        const dx = Math.abs(pos.x - touchState.startPos.x);
        const dy = Math.abs(pos.y - touchState.startPos.y);
        
        if (dx > config.moveThreshold || dy > config.moveThreshold) {
          clearTimeout(touchState.longPressTimer);
          touchState.longPressTimer = null;
        }
      }

      // Trigger your existing MOUSEMOVE
      const mouseEvt = createMouseEvent(pos, 'mousemove');
      if (typeof MOUSEMOVE === 'function') {
        MOUSEMOVE(mouseEvt);
      }
    }
  }

  function onTouchEnd(evt) {
    const changedTouches = evt.changedTouches;

    // Reset pinch state
    if (evt.touches.length === 0) {
      touchState.isPinching = false;
      touchState.pinchStartDist = 0;
      touchState.pinchStartCenter = null;
    }

    // SINGLE FINGER RELEASE
    if (changedTouches.length === 1 && touchState.isDown) {
      const pos = getPosition(changedTouches[0]);
      const duration = Date.now() - touchState.startTime;
      
      let moved = 0;
      if (touchState.startPos) {
        moved = Math.abs(pos.x - touchState.startPos.x) + 
                Math.abs(pos.y - touchState.startPos.y);
      }

      // Clear long-press timer
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer);
        touchState.longPressTimer = null;
      }

      // Check for TAP (quick touch without movement)
      if (duration < 300 && moved < config.moveThreshold) {
        handleTap(pos);
      }

      // Trigger your existing MOUSEUP
      const mouseEvt = createMouseEvent(pos, 'mouseup');
      if (typeof MOUSEUP === 'function') {
        MOUSEUP(mouseEvt);
      }

      touchState.isDown = false;
    }
  }

  // =============================================================================
  // PINCH ZOOM
  // =============================================================================

  function handlePinchZoom(touches) {
    if (!touchState.isPinching) return;

    const currentDist = getTouchDistance(touches[0], touches[1]);
    const currentCenter = getTouchCenter(touches[0], touches[1]);
    const distChange = currentDist - touchState.pinchStartDist;

    if (Math.abs(distChange) > config.pinchThreshold) {
      const zoomRatio = currentDist / touchState.pinchStartDist;
      const newFactor = touchState.initialZoom * zoomRatio;

      pendingZoom = {
        factor: Math.max(0.2, Math.min(5, newFactor)),
        center: currentCenter
      };

      if (!rafId) {
        rafId = requestAnimationFrame(applyPinchZoom);
      }
    }

    // Pan during pinch
    if (touchState.pinchStartCenter) {
      const deltaX = (currentCenter.clientX - touchState.pinchStartCenter.clientX) * factor;
      const deltaY = (currentCenter.clientY - touchState.pinchStartCenter.clientY) * factor;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        originX_viewbox -= deltaX;
        originY_viewbox -= deltaY;
        touchState.pinchStartCenter = currentCenter;
      }
    }
  }

  function applyPinchZoom() {
    rafId = null;
    if (!pendingZoom) return;

    const zoom = pendingZoom;
    pendingZoom = null;

    const rect = svg.getBoundingClientRect();
    const centerX = (zoom.center.clientX - rect.left) * factor + originX_viewbox;
    const centerY = (zoom.center.clientY - rect.top) * factor + originY_viewbox;

    factor = zoom.factor;
    width_viewbox = canvasWidth * factor;
    height_viewbox = canvasHeight * factor;

    originX_viewbox = centerX - (zoom.center.clientX - rect.left) * factor;
    originY_viewbox = centerY - (zoom.center.clientY - rect.top) * factor;

    svg.setAttribute('viewBox',
      `${originX_viewbox} ${originY_viewbox} ${width_viewbox} ${height_viewbox}`
    );

    if (typeof updateZoomDisplay === 'function') {
      updateZoomDisplay();
    }
  }

  // =============================================================================
  // GESTURE HANDLERS
  // =============================================================================

  function handleTap(pos) {
    const now = Date.now();

    // DOUBLE TAP
    if (now - touchState.lastTapTime < config.doubleTapDelay) {
      if (typeof mode !== 'undefined' && mode === 'select_mode') {
        // Zoom in to center
        factor = Math.max(0.2, Math.min(5, factor / 1.5));
        width_viewbox = canvasWidth * factor;
        height_viewbox = canvasHeight * factor;
        originX_viewbox = pos.x - width_viewbox / 2;
        originY_viewbox = pos.y - height_viewbox / 2;

        svg.setAttribute('viewBox',
          `${originX_viewbox} ${originY_viewbox} ${width_viewbox} ${height_viewbox}`
        );

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }

        if (typeof updateZoomDisplay === 'function') {
          updateZoomDisplay();
        }
      }
      touchState.lastTapTime = 0;
    } else {
      // SINGLE TAP
      touchState.lastTapTime = now;
    }
  }

  function handleLongPress(pos) {
    if (typeof mode === 'undefined' || mode !== 'select_mode') return;

    // Check for wall under touch
    if (typeof editor !== 'undefined' && editor.rayCastingWall) {
      const wall = editor.rayCastingWall(pos);
      if (wall) {
        showContextMenu(pos, wall, 'wall');
        if (navigator.vibrate) {
          navigator.vibrate(50); // Strong haptic feedback
        }
        return;
      }
    }

    // Check for object under touch
    if (typeof OBJDATA !== 'undefined') {
      for (let i = OBJDATA.length - 1; i >= 0; i--) {
        if (typeof qSVG !== 'undefined' && qSVG.rayCasting && OBJDATA[i].realBbox) {
          if (qSVG.rayCasting(pos, OBJDATA[i].realBbox)) {
            showContextMenu(pos, OBJDATA[i], 'object');
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
            return;
          }
        }
      }
    }
  }

  // =============================================================================
  // CONTEXT MENU
  // =============================================================================

  function showContextMenu(pos, target, type) {
    closeContextMenu();

    const rect = svg.getBoundingClientRect();
    const screenX = ((pos.x - originX_viewbox) / factor) + rect.left;
    const screenY = ((pos.y - originY_viewbox) / factor) + rect.top;

    const menu = document.createElement('div');
    menu.id = 'touchContextMenu';
    menu.style.cssText = `
      position: fixed;
      left: ${screenX}px;
      top: ${screenY}px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 99999;
      min-width: 200px;
      overflow: hidden;
      transform: translate(-50%, -100%) translateY(-10px);
      animation: menuFadeIn 0.2s ease;
    `;

    const items = [];

    if (type === 'wall' && typeof binder !== 'undefined') {
      binder.wall = target;
      
      if (typeof editor !== 'undefined') {
        if (editor.splitWall) {
          items.push({ text: '✂️ Split Wall', action: () => editor.splitWall(target) });
        }
        if (editor.invisibleWall && target.type === 'normal') {
          items.push({ text: '👁️ Make Separator', action: () => editor.invisibleWall(target) });
        }
        if (editor.visibleWall && target.type !== 'normal') {
          items.push({ text: '👁️ Make Visible', action: () => editor.visibleWall(target) });
        }
      }
      
      items.push({ text: '🗑️ Delete Wall', action: () => deleteWall(target) });
      
    } else if (type === 'object' && typeof binder !== 'undefined') {
      binder.object = target;
      items.push(
        { text: '🔄 Rotate', action: () => rotateObject(target) },
        { text: '📋 Duplicate', action: () => duplicateObject(target) },
        { text: '🗑️ Delete', action: () => deleteObject(target) }
      );
    }

    // Add menu items
    items.forEach(item => {
      const btn = document.createElement('div');
      btn.className = 'touch-menu-item';
      btn.textContent = item.text;
      btn.style.cssText = `
        padding: 16px 20px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        font-size: 16px;
        color: #333;
      `;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.style.background = '#f0f0f0';
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        item.action();
        closeContextMenu();
      });
      menu.appendChild(btn);
    });

    // Cancel button
    const cancel = document.createElement('div');
    cancel.className = 'touch-menu-item';
    cancel.textContent = '✖️ Cancel';
    cancel.style.cssText = `
      padding: 16px 20px;
      cursor: pointer;
      color: #999;
      font-size: 16px;
      font-weight: bold;
    `;
    cancel.addEventListener('touchend', (e) => {
      e.preventDefault();
      closeContextMenu();
    });
    menu.appendChild(cancel);

    document.body.appendChild(menu);

    // Auto-adjust if off-screen
    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - menuRect.width / 2 - 10) + 'px';
      }
      if (menuRect.left < 0) {
        menu.style.left = (menuRect.width / 2 + 10) + 'px';
      }
      if (menuRect.top < 0) {
        menu.style.top = (screenY + menuRect.height + 20) + 'px';
        menu.style.transform = 'translate(-50%, 0) translateY(10px)';
      }
    });

    // Close on outside touch
    setTimeout(() => {
      document.addEventListener('touchstart', function closeOnOutside(e) {
        if (!e.target.closest('#touchContextMenu')) {
          closeContextMenu();
          document.removeEventListener('touchstart', closeOnOutside);
        }
      }, { once: true });
    }, 100);
  }

  function closeContextMenu() {
    const menu = document.getElementById('touchContextMenu');
    if (menu) menu.remove();
  }

  // =============================================================================
  // MENU ACTIONS
  // =============================================================================

  function deleteWall(wall) {
    if (typeof WALLS === 'undefined' || typeof editor === 'undefined') return;

    const objWall = editor.objFromWall ? editor.objFromWall(wall) : [];
    if (objWall.length > 0) {
      if (!confirm('This wall has objects attached. Delete anyway?')) {
        return;
      }
      objWall.forEach(obj => {
        const idx = OBJDATA.indexOf(obj);
        if (idx > -1) OBJDATA.splice(idx, 1);
      });
    }

    WALLS.forEach(w => {
      if (w.child === wall) w.child = null;
      if (w.parent === wall) w.parent = null;
    });

    const idx = WALLS.indexOf(wall);
    if (idx > -1) WALLS.splice(idx, 1);

    editor.architect(WALLS);
    if (typeof save === 'function') save();
  }

  function rotateObject(obj) {
    if (!obj || !obj.update) return;
    obj.angle = (obj.angle + 90) % 360;
    obj.update();
    if (typeof save === 'function') save();
  }

  function duplicateObject(obj) {
    if (!obj || typeof editor === 'undefined' || !editor.obj2D) return;

    const newObj = new editor.obj2D(
      obj.family, obj.class, obj.type,
      { x: obj.x + 50, y: obj.y + 50 },
      obj.angle, obj.angleSign, obj.size,
      obj.hinge, obj.thick, obj.value
    );
    
    OBJDATA.push(newObj);
    
    const container = document.getElementById('boxobj') || 
                     document.getElementById('boxEnergy') || 
                     document.getElementById('boxFurniture');
    if (container && newObj.graph) {
      container.appendChild(newObj.graph);
    }
    
    newObj.update();
    if (typeof save === 'function') save();
  }

  function deleteObject(obj) {
    if (typeof OBJDATA === 'undefined') return;

    const idx = OBJDATA.indexOf(obj);
    if (idx > -1) {
      OBJDATA.splice(idx, 1);
      if (obj.graph) obj.graph.remove();
      if (typeof save === 'function') save();
    }
  }

  // =============================================================================
  // REGISTER TOUCH EVENTS ONLY
  // =============================================================================

  svg.addEventListener('touchstart', onTouchStart, { passive: false });
  svg.addEventListener('touchmove', onTouchMove, { passive: false });
  svg.addEventListener('touchend', onTouchEnd, { passive: false });
  svg.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Prevent context menu on long press
  svg.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });

  // Configure SVG for touch
  svg.style.touchAction = 'none';
  svg.style.userSelect = 'none';
  svg.style.webkitUserSelect = 'none';

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  // =============================================================================
  // STYLES
  // =============================================================================

  const style = document.createElement('style');
  style.textContent = `
    @keyframes menuFadeIn {
      from { 
        opacity: 0; 
        transform: translate(-50%, -100%) translateY(-20px) scale(0.95); 
      }
      to { 
        opacity: 1; 
        transform: translate(-50%, -100%) translateY(-10px) scale(1); 
      }
    }

    .touch-menu-item:active {
      background: #f0f0f0 !important;
    }

    @media (hover: none) and (pointer: coarse) {
      button, .btn {
        min-height: 48px !important;
        min-width: 48px !important;
        padding: 12px !important;
      }
      
      input, select, textarea {
        font-size: 16px !important;
      }
    }
  `;
  document.head.appendChild(style);

  console.log('✅ Touch handler active');
  console.log('👆 Gestures: Single tap, Double tap, Long press, Pinch zoom');

})();
