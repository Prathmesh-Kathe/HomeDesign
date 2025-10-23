// inputAdapter.js - Universal Mouse + Touch + Stylus support

(function () {
  const svg = document.getElementById('lin');
  if (!svg) return console.warn("SVG with id='lin' not found.");

  let pointers = new Map();
  let isDragging = false;
  let lastDistance = 0;

  // Helper
  const distance = (a, b) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const simulateMouse = (type, e) => {
    const rect = svg.getBoundingClientRect();
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX - rect.left,
      clientY: e.clientY - rect.top,
      buttons: e.buttons || 1,
      button: 0
    });
    svg.dispatchEvent(ev);
  };

  // --- Pointer / touch down ---
  const down = (e) => {
    const point = e.touches ? e.touches[0] : e;
    const id = e.pointerId || 1;
    pointers.set(id, point);
    if (pointers.size === 1) {
      isDragging = true;
      simulateMouse('mousedown', point);
    }
  };

  // --- Pointer / touch move ---
  const move = (e) => {
    const list = e.touches || [e];
    // Update pointers
    pointers.clear();
    for (let i = 0; i < list.length; i++) {
      pointers.set(i, list[i]);
    }

    if (pointers.size === 1 && isDragging) {
      simulateMouse('mousemove', list[0]);
    } else if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      const dist = distance(p1, p2);
      if (lastDistance) {
        const delta = (dist - lastDistance) * 0.5; // scale sensitivity
        svg.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -delta
        }));
      }
      lastDistance = dist;
    }
  };

  // --- Pointer / touch up ---
  const up = (e) => {
    const id = e.pointerId || 0;
    pointers.delete(id);
    if (isDragging) {
      const point = e.changedTouches ? e.changedTouches[0] : e;
      simulateMouse('mouseup', point);
      simulateMouse('click', point);
    }
    isDragging = false;
    lastDistance = 0;
  };

  // Attach events
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

  svg.addEventListener('touchstart', down, { passive: false });
  svg.addEventListener('touchmove', move, { passive: false });
  svg.addEventListener('touchend', up, { passive: false });
  svg.addEventListener('touchcancel', up, { passive: false });

  svg.style.touchAction = 'none';
  svg.style.userSelect = 'none';
  svg.style.webkitUserSelect = 'none';
  svg.style.msUserSelect = 'none';

  console.log("✅ inputAdapter.js loaded: touch + mouse support enabled.");
})();
