// =============================================================================
// COMPLETE TOUCH & MOBILE SUPPORT FOR FLOOR PLAN EDITOR
// =============================================================================

// Remove existing event listeners first
svg.removeEventListener('pointerdown', onPointerDown);
svg.removeEventListener('pointermove', onPointerMove);
svg.removeEventListener('pointerup', onPointerUp);
svg.removeEventListener('pointercancel', onPointerUp);
svg.removeEventListener('touchstart', onPointerDown);
svg.removeEventListener('touchmove', onPointerMove);
svg.removeEventListener('touchend', onPointerUp);
svg.removeEventListener('touchcancel', onPointerUp);

// =============================================================================
// TOUCH STATE MANAGEMENT
// =============================================================================

var touchState = {
  isDown: false,
  isTouching: false,
  isPinching: false,
  startTime: 0,
  startPos: null,
  currentPos: null,
  lastTapTime: 0,
  longPressTimer: null,
  pinchStartDistance: 0,
  pinchStartCenter: null,
  initialZoom: 1,
  touches: []
};

var touchConfig = {
  tapThreshold: 300,        // ms for tap detection
  moveThreshold: 15,        // pixels to detect movement
  doubleTapDelay: 400,      // ms between taps
  longPressDelay: 600,      // ms for long press
  pinchThreshold: 10,       // minimum pinch distance
  snapRadius: 30            // touch snap radius
};

// =============================================================================
// UNIFIED POINTER EVENT HANDLERS
// =============================================================================

function onPointerDown(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  
  var pos = getEventPosition(evt);
  
  // Initialize touch state
  touchState.isDown = true;
  touchState.isTouching = true;
  touchState.startTime = Date.now();
  touchState.startPos = { x: pos.x, y: pos.y };
  touchState.currentPos = { x: pos.x, y: pos.y };
  
  // Setup long press for touch devices
  if (isTouchDevice() && evt.pointerType === 'touch') {
    clearTimeout(touchState.longPressTimer);
    touchState.longPressTimer = setTimeout(function() {
      handleLongPress(pos);
    }, touchConfig.longPressDelay);
  }
  
  // Call original mousedown logic
  handleMouseDownLogic(evt, pos);
}

function onPointerMove(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  
  var pos = getEventPosition(evt);
  touchState.currentPos = { x: pos.x, y: pos.y };
  
  // Cancel long press if moved too far
  if (touchState.longPressTimer && touchState.startPos) {
    var moveDistance = calculateDistance(touchState.startPos, pos);
    if (moveDistance > touchConfig.moveThreshold) {
      clearTimeout(touchState.longPressTimer);
      touchState.longPressTimer = null;
    }
  }
  
  // Call original mousemove logic
  handleMouseMoveLogic(evt, pos);
}

function onPointerUp(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  
  var pos = getEventPosition(evt);
  var touchDuration = Date.now() - touchState.startTime;
  var moveDistance = 0;
  
  if (touchState.startPos) {
    moveDistance = calculateDistance(touchState.startPos, pos);
  }
  
  // Clear long press timer
  clearTimeout(touchState.longPressTimer);
  touchState.longPressTimer = null;
  
  // Detect tap gesture (touch without movement)
  if (isTouchDevice() && 
      touchDuration < touchConfig.tapThreshold && 
      moveDistance < touchConfig.moveThreshold) {
    handleTapGesture(pos, evt);
  }
  
  // Call original mouseup logic
  handleMouseUpLogic(evt, pos);
  
  // Reset state
  touchState.isDown = false;
  touchState.isTouching = false;
  touchState.isPinching = false;
}

// =============================================================================
// TOUCH-SPECIFIC HANDLERS (For multi-touch gestures)
// =============================================================================

function onTouchStart(evt) {
  var touches = evt.touches;
  
  // Multi-touch (pinch to zoom)
  if (touches.length === 2) {
    evt.preventDefault();
    handlePinchStart(touches);
    return;
  }
  
  // Single touch - delegate to pointer handler
  if (touches.length === 1) {
    var pointerEvt = createPointerEvent(touches[0], 'pointerdown');
    onPointerDown(pointerEvt);
  }
}

function onTouchMove(evt) {
  var touches = evt.touches;
  
  // Pinch gesture
  if (touches.length === 2 && touchState.isPinching) {
    evt.preventDefault();
    handlePinchMove(touches);
    return;
  }
  
  // Single touch - delegate to pointer handler
  if (touches.length === 1 && !touchState.isPinching) {
    var pointerEvt = createPointerEvent(touches[0], 'pointermove');
    onPointerMove(pointerEvt);
  }
}

function onTouchEnd(evt) {
  var touches = evt.changedTouches;
  
  // Reset pinch state when all touches released
  if (evt.touches.length === 0) {
    touchState.isPinching = false;
    touchState.pinchStartDistance = 0;
    touchState.pinchStartCenter = null;
  }
  
  // Single touch end - delegate to pointer handler
  if (touches.length === 1 && !touchState.isPinching) {
    var pointerEvt = createPointerEvent(touches[0], 'pointerup');
    onPointerUp(pointerEvt);
  }
}

// =============================================================================
// PINCH TO ZOOM IMPLEMENTATION
// =============================================================================

function handlePinchStart(touches) {
  touchState.isPinching = true;
  touchState.pinchStartDistance = getTouchDistance(touches[0], touches[1]);
  touchState.pinchStartCenter = getTouchCenter(touches[0], touches[1]);
  touchState.initialZoom = factor;
  
  // Clear any long press
  clearTimeout(touchState.longPressTimer);
  touchState.longPressTimer = null;
}

function handlePinchMove(touches) {
  if (!touchState.isPinching) return;
  
  var currentDistance = getTouchDistance(touches[0], touches[1]);
  var currentCenter = getTouchCenter(touches[0], touches[1]);
  
  // Calculate zoom change
  var distanceChange = currentDistance - touchState.pinchStartDistance;
  
  if (Math.abs(distanceChange) > touchConfig.pinchThreshold) {
    var zoomFactor = currentDistance / touchState.pinchStartDistance;
    
    // Apply zoom (constrain between 0.2 and 5)
    var newFactor = touchState.initialZoom * zoomFactor;
    newFactor = Math.max(0.2, Math.min(5, newFactor));
    
    // Calculate zoom center in SVG coordinates
    var rect = svg.getBoundingClientRect();
    var centerX = (currentCenter.x - rect.left) * factor + originX_viewbox;
    var centerY = (currentCenter.y - rect.top) * factor + originY_viewbox;
    
    // Adjust viewBox origin to zoom around center point
    var oldFactor = factor;
    factor = newFactor;
    
    // Update viewBox dimensions
    width_viewbox = canvasWidth * factor;
    height_viewbox = canvasHeight * factor;
    
    // Adjust origin to keep center point stable
    originX_viewbox = centerX - (currentCenter.x - rect.left) * factor;
    originY_viewbox = centerY - (currentCenter.y - rect.top) * factor;
    
    // Apply new viewBox
    svg.setAttribute('viewBox', 
      originX_viewbox + ' ' + originY_viewbox + ' ' + 
      width_viewbox + ' ' + height_viewbox
    );
    
    // Update zoom display if exists
    if (typeof updateZoomDisplay === 'function') {
      updateZoomDisplay();
    }
  }
  
  // Handle panning during pinch
  if (touchState.pinchStartCenter) {
    var deltaX = currentCenter.x - touchState.pinchStartCenter.x;
    var deltaY = currentCenter.y - touchState.pinchStartCenter.y;
    
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      applyTouchPan(deltaX, deltaY);
      touchState.pinchStartCenter = currentCenter;
    }
  }
}

function applyTouchPan(screenDeltaX, screenDeltaY) {
  // Convert screen delta to SVG coordinates
  var svgDeltaX = screenDeltaX * factor;
  var svgDeltaY = screenDeltaY * factor;
  
  // Update viewBox origin
  originX_viewbox -= svgDeltaX;
  originY_viewbox -= svgDeltaY;
  
  // Apply new viewBox
  svg.setAttribute('viewBox', 
    originX_viewbox + ' ' + originY_viewbox + ' ' + 
    width_viewbox + ' ' + height_viewbox
  );
}

// =============================================================================
// TAP GESTURE HANDLING
// =============================================================================

function handleTapGesture(pos, evt) {
  var currentTime = Date.now();
  
  // Check for double-tap
  if (currentTime - touchState.lastTapTime < touchConfig.doubleTapDelay) {
    handleDoubleTap(pos, evt);
    touchState.lastTapTime = 0; // Reset to prevent triple-tap
  } else {
    handleSingleTap(pos, evt);
    touchState.lastTapTime = currentTime;
  }
}

function handleSingleTap(pos, evt) {
  // Single tap acts like a click - use existing click logic
  // The mouseup logic will handle the tap action
  console.log('Single tap at:', pos);
}

function handleDoubleTap(pos, evt) {
  // Double-tap to zoom in on area
  if (mode === 'select_mode') {
    // Zoom in to 150%
    var zoomFactor = 1.5;
    var newFactor = factor / zoomFactor;
    newFactor = Math.max(0.2, Math.min(5, newFactor));
    
    var rect = svg.getBoundingClientRect();
    var tapX = (pos.x - originX_viewbox);
    var tapY = (pos.y - originY_viewbox);
    
    factor = newFactor;
    width_viewbox = canvasWidth * factor;
    height_viewbox = canvasHeight * factor;
    
    // Center on tap point
    originX_viewbox = pos.x - width_viewbox / 2;
    originY_viewbox = pos.y - height_viewbox / 2;
    
    svg.setAttribute('viewBox', 
      originX_viewbox + ' ' + originY_viewbox + ' ' + 
      width_viewbox + ' ' + height_viewbox
    );
    
    if (typeof updateZoomDisplay === 'function') {
      updateZoomDisplay();
    }
  }
  
  console.log('Double tap at:', pos);
}

function handleLongPress(pos) {
  // Long press for context menu (like right-click)
  if (mode === 'select_mode') {
    var wall = editor.rayCastingWall(pos);
    if (wall) {
      showTouchContextMenu(pos, wall, 'wall');
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      return;
    }
    
    // Check for objects
    var nearObj = findNearestObject(pos, touchConfig.snapRadius * factor);
    if (nearObj) {
      showTouchContextMenu(pos, nearObj, 'object');
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      return;
    }
  }
  
  console.log('Long press at:', pos);
}

// =============================================================================
// TOUCH CONTEXT MENU
// =============================================================================

function showTouchContextMenu(pos, target, type) {
  // Remove any existing menu
  closeTouchContextMenu();
  
  // Convert SVG coords to screen coords
  var rect = svg.getBoundingClientRect();
  var screenX = ((pos.x - originX_viewbox) / factor) + rect.left;
  var screenY = ((pos.y - originY_viewbox) / factor) + rect.top;
  
  var menuHTML = '<div id="touchContextMenu" style="' +
    'position: fixed;' +
    'left: ' + screenX + 'px;' +
    'top: ' + screenY + 'px;' +
    'background: white;' +
    'border: 1px solid #ddd;' +
    'border-radius: 8px;' +
    'padding: 8px 0;' +
    'box-shadow: 0 4px 20px rgba(0,0,0,0.25);' +
    'z-index: 100000;' +
    'min-width: 180px;' +
    'font-family: Arial, sans-serif;' +
    'transform: translate(-50%, -100%) translateY(-10px);' +
    '">';
  
  if (type === 'wall') {
    binder.wall = target;
    menuHTML += '<div class="touch-menu-item" data-action="splitWall">✂️ Split Wall</div>';
    
    if (target.type === 'normal') {
      menuHTML += '<div class="touch-menu-item" data-action="makeInvisible">👁️ Make Separator</div>';
    } else {
      menuHTML += '<div class="touch-menu-item" data-action="makeVisible">👁️ Make Visible</div>';
    }
    
    menuHTML += '<div class="touch-menu-item" data-action="deleteWall">🗑️ Delete Wall</div>';
  } else if (type === 'object') {
    binder.object = target;
    menuHTML += '<div class="touch-menu-item" data-action="rotateObject">🔄 Rotate</div>';
    menuHTML += '<div class="touch-menu-item" data-action="duplicateObject">📋 Duplicate</div>';
    menuHTML += '<div class="touch-menu-item" data-action="deleteObject">🗑️ Delete</div>';
  }
  
  menuHTML += '<div class="touch-menu-item touch-menu-cancel" data-action="cancel">✖️ Cancel</div>';
  menuHTML += '</div>';
  
  $('body').append(menuHTML);
  
  // Style menu items
  $('.touch-menu-item').css({
    'padding': '14px 20px',
    'cursor': 'pointer',
    'border-bottom': '1px solid #eee',
    'font-size': '16px',
    'color': '#333',
    'user-select': 'none',
    '-webkit-tap-highlight-color': 'transparent'
  }).on('touchstart click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var action = $(this).data('action');
    executeTouchMenuAction(action);
  });
  
  $('.touch-menu-cancel').css({
    'border-bottom': 'none',
    'color': '#999',
    'font-weight': 'bold'
  });
  
  // Adjust position if off-screen
  setTimeout(function() {
    var menu = $('#touchContextMenu');
    if (menu.length) {
      var menuRect = menu[0].getBoundingClientRect();
      var newLeft = screenX;
      var newTop = screenY;
      
      if (menuRect.right > window.innerWidth) {
        newLeft = window.innerWidth - menuRect.width / 2 - 10;
      }
      if (menuRect.left < 0) {
        newLeft = menuRect.width / 2 + 10;
      }
      if (menuRect.top < 0) {
        newTop = screenY + menuRect.height + 20;
        menu.css('transform', 'translate(-50%, 0) translateY(10px)');
      }
      
      menu.css({
        'left': newLeft + 'px',
        'top': newTop + 'px'
      });
    }
  }, 10);
  
  // Close menu on outside click
  setTimeout(function() {
    $(document).one('touchstart click', function(e) {
      if (!$(e.target).closest('#touchContextMenu').length) {
        closeTouchContextMenu();
      }
    });
  }, 100);
}

function executeTouchMenuAction(action) {
  closeTouchContextMenu();
  
  switch(action) {
    case 'splitWall':
      if (binder.wall) {
        editor.splitWall(binder.wall);
      }
      break;
    case 'makeInvisible':
      if (binder.wall) {
        editor.invisibleWall(binder.wall);
      }
      break;
    case 'makeVisible':
      if (binder.wall) {
        editor.visibleWall(binder.wall);
      }
      break;
    case 'deleteWall':
      if (binder.wall) {
        deleteWallAction(binder.wall);
      }
      break;
    case 'rotateObject':
      if (binder.object) {
        rotateObjectAction(binder.object);
      }
      break;
    case 'duplicateObject':
      if (binder.object) {
        duplicateObjectAction(binder.object);
      }
      break;
    case 'deleteObject':
      if (binder.object) {
        deleteObjectAction(binder.object);
      }
      break;
    case 'cancel':
      // Just close menu
      break;
  }
}

function closeTouchContextMenu() {
  $('#touchContextMenu').remove();
}

function deleteWallAction(wall) {
  // Clear objects on this wall
  var objWall = editor.objFromWall(wall);
  if (objWall.length > 0) {
    if (!confirm('This wall contains objects. Delete anyway?')) {
      return;
    }
    // Remove objects
    for (var i = objWall.length - 1; i >= 0; i--) {
      var index = OBJDATA.indexOf(objWall[i]);
      if (index > -1) {
        OBJDATA.splice(index, 1);
      }
    }
  }
  
  // Remove wall references
  for (var k in WALLS) {
    if (WALLS[k].child === wall) WALLS[k].child = null;
    if (WALLS[k].parent === wall) WALLS[k].parent = null;
  }
  
  // Remove wall
  var wallIndex = WALLS.indexOf(wall);
  if (wallIndex > -1) {
    WALLS.splice(wallIndex, 1);
  }
  
  // Rebuild
  editor.architect(WALLS);
  if (typeof save === 'function') save();
}

function rotateObjectAction(obj) {
  if (obj) {
    obj.angle = (obj.angle + 90) % 360;
    obj.update();
    if (typeof save === 'function') save();
  }
}

function duplicateObjectAction(obj) {
  if (obj) {
    var newObj = new editor.obj2D(
      obj.family, obj.class, obj.type,
      { x: obj.x + 50, y: obj.y + 50 },
      obj.angle, obj.angleSign, obj.size,
      obj.hinge, obj.thick, obj.value
    );
    OBJDATA.push(newObj);
    $('#boxobj').append(newObj.graph);
    newObj.update();
    if (typeof save === 'function') save();
  }
}

function deleteObjectAction(obj) {
  if (obj) {
    var index = OBJDATA.indexOf(obj);
    if (index > -1) {
      OBJDATA.splice(index, 1);
      obj.graph.remove();
      if (typeof save === 'function') save();
    }
  }
}

// =============================================================================
// INTEGRATION WITH EXISTING CODE
// =============================================================================

function handleMouseDownLogic(evt, pos) {
  // This is where the original mousedown code goes
  // Copy your existing mousedown event handler code here
  // Example structure:
  
  if (mode === 'wall_mode') {
    var snap = editor.nearWallNode(pos, touchConfig.snapRadius * factor);
    if (snap) {
      pos = { x: snap.x, y: snap.y };
    }
    
    if (!wallBind) {
      wallBind = pos;
      tempLine = qSVG.create('temp', 'line', {
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        stroke: colorWall,
        'stroke-width': thickness * 1.5
      });
    }
  } else if (mode === 'select_mode') {
    // Selection logic
    drag = true;
    var wall = editor.rayCastingWall(pos);
    if (wall) {
      wallBind = wall;
    }
    
    // Check for object selection
    for (var i = OBJDATA.length - 1; i >= 0; i--) {
      if (qSVG.rayCasting(pos, OBJDATA[i].realBbox)) {
        binder.object = OBJDATA[i];
        objectMode = 'move';
        break;
      }
    }
  }
}

function handleMouseMoveLogic(evt, pos) {
  // This is where the original mousemove code goes
  
  if (mode === 'wall_mode' && wallBind && tempLine) {
    var snap = editor.nearWallNode(pos, touchConfig.snapRadius * factor);
    if (snap) {
      pos = { x: snap.x, y: snap.y };
    }
    
    tempLine.setAttribute('x2', pos.x);
    tempLine.setAttribute('y2', pos.y);
  } else if (mode === 'select_mode' && drag) {
    if (binder.object && objectMode === 'move') {
      binder.object.x = pos.x;
      binder.object.y = pos.y;
      binder.object.update();
    }
  }
}

function handleMouseUpLogic(evt, pos) {
  // This is where the original mouseup code goes
  
  if (mode === 'wall_mode' && wallBind) {
    var snap = editor.nearWallNode(pos, touchConfig.snapRadius * factor);
    if (snap) {
      pos = { x: snap.x, y: snap.y };
    }
    
    var distance = qSVG.gap(wallBind, pos);
    if (distance > 5) {
      var wall = new editor.wall(wallBind, pos, "normal", thickness);
      WALLS.push(wall);
      editor.architect(WALLS);
      if (typeof save === 'function') save();
    }
    
    if (tempLine) {
      tempLine.remove();
      tempLine = null;
    }
    wallBind = null;
  }
  
  drag = false;
  objectMode = '';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getEventPosition(evt) {
  var rect = svg.getBoundingClientRect();
  var clientX, clientY;
  
  if (evt.touches && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else if (evt.changedTouches && evt.changedTouches.length > 0) {
    clientX = evt.changedTouches[0].clientX;
    clientY = evt.changedTouches[0].clientY;
  } else {
    clientX = evt.clientX;
    clientY = evt.clientY;
  }
  
  return {
    x: (clientX - rect.left) * factor + originX_viewbox,
    y: (clientY - rect.top) * factor + originY_viewbox
  };
}

function getTouchDistance(touch1, touch2) {
  var dx = touch2.clientX - touch1.clientX;
  var dy = touch2.clientY - touch1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

function calculateDistance(pos1, pos2) {
  var dx = pos2.x - pos1.x;
  var dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isTouchDevice() {
  return (('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0));
}

function createPointerEvent(touch, type) {
  return {
    preventDefault: function() {},
    stopPropagation: function() {},
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX,
    pageY: touch.pageY,
    touches: [touch],
    pointerType: 'touch',
    type: type
  };
}

function findNearestObject(pos, radius) {
  var nearest = null;
  var minDist = radius;
  
  for (var i = 0; i < OBJDATA.length; i++) {
    var dist = qSVG.gap(pos, OBJDATA[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = OBJDATA[i];
    }
  }
  
  return nearest;
}

// =============================================================================
// EVENT LISTENER REGISTRATION
// =============================================================================

// Register unified pointer events
if (window.PointerEvent) {
  svg.addEventListener('pointerdown', onPointerDown, { passive: false });
  svg.addEventListener('pointermove', onPointerMove, { passive: false });
  svg.addEventListener('pointerup', onPointerUp, { passive: false });
  svg.addEventListener('pointercancel', onPointerUp, { passive: false });
} else {
  // Fallback for older browsers
  svg.addEventListener('mousedown', onPointerDown, { passive: false });
  svg.addEventListener('mousemove', onPointerMove, { passive: false });
  svg.addEventListener('mouseup', onPointerUp, { passive: false });
}

// Always add touch handlers for multi-touch support
svg.addEventListener('touchstart', onTouchStart, { passive: false });
svg.addEventListener('touchmove', onTouchMove, { passive: false });
svg.addEventListener('touchend', onTouchEnd, { passive: false });
svg.addEventListener('touchcancel', onTouchEnd, { passive: false });

// Prevent context menu on long press
svg.addEventListener('contextmenu', function(e) {
  if (isTouchDevice()) {
    e.preventDefault();
  }
}, { passive: false });

// Configure SVG for touch
svg.style.touchAction = 'none';
svg.style.userSelect = 'none';
svg.style.webkitUserSelect = 'none';

// =============================================================================
// MOBILE UI ENHANCEMENTS
// =============================================================================

// Add mobile-specific styles
var mobileStyles = document.createElement('style');
mobileStyles.textContent = `
  /* Touch-friendly controls */
  @media (hover: none) and (pointer: coarse) {
    button, .btn, .tool-button {
      min-height: 48px !important;
      min-width: 48px !important;
      padding: 12px 16px !important;
      font-size: 16px !important;
      touch-action: manipulation;
    }
    
    input, select, textarea {
      font-size: 16px !important;
      min-height: 44px !important;
    }
    
    .panel-item, .menu-item {
      padding: 16px 20px !important;
      font-size: 17px !important;
      min-height: 52px !important;
    }
    
    /* Larger touch targets for SVG elements */
    svg circle.node {
      r: 10 !important;
    }
    
    /* Visual feedback */
    .touchable:active,
    button:active,
    .tool-button:active {
      opacity: 0.7;
      transform: scale(0.97);
      transition: all 0.1s;
    }
  }
  
  /* No text selection during drawing */
  .no-select {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  
  /* Context menu animations */
  #touchContextMenu {
    animation: menuSlideIn 0.2s ease-out;
  }
  
  @keyframes menuSlideIn {
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
    background-color: #f0f0f0 !important;
  }
`;

document.head.appendChild(mobileStyles);

// Add viewport meta tag if missing
if (!document.querySelector('meta[name="viewport"]')) {
  var viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
  document.head.appendChild(viewport);
}

// Add no-select class to SVG and canvas
svg.classList.add('no-select');

// Log initialization
console.log('✅ Touch support initialized');
console.log('📱 Touch device:', isTouchDevice());
console.log('👆 Pointer events supported:', !!window.PointerEvent);

// =============================================================================
// TOUCH GESTURE HELPERS FOR DEBUGGING
// =============================================================================

if (typeof DEBUG !== 'undefined' && DEBUG) {
  svg.addEventListener('touchstart', function(e) {
    console.log('Touch start:', e.touches.length, 'touches');
  });
  
  svg.addEventListener('touchend', function(e) {
    console.log('Touch end:', e.touches.length, 'remaining touches');
  });
}
