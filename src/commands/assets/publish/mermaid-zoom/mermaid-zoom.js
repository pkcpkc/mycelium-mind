console.log('[Mermaid Zoom] Script loaded!');

function showError(msg, err) {
  console.error('[Mermaid Zoom]', msg, err);
  const banner = document.createElement('div');
  banner.style.position = 'fixed';
  banner.style.top = '10px';
  banner.style.left = '10px';
  banner.style.right = '10px';
  banner.style.backgroundColor = '#ef4444';
  banner.style.color = 'white';
  banner.style.padding = '14px';
  banner.style.zIndex = '999999';
  banner.style.borderRadius = '8px';
  banner.style.fontFamily = 'monospace';
  banner.style.whiteSpace = 'pre-wrap';
  banner.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3)';
  banner.innerHTML = `<strong>[Mermaid Zoom Error]</strong> ${msg}<br>${err ? err.message : ''}<br>${err ? err.stack : ''}`;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.float = 'right';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'white';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.fontWeight = 'bold';
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
  
  document.body.appendChild(banner);
}

function scan() {
  try {
    // Find all mermaid containers in the page (works with closed shadow roots by targetting host element!)
    const hosts = document.querySelectorAll('.mermaid, .md-typeset__mermaid');
    
    for (const host of hosts) {
      // Ignore if already wrapped, or if inside a zoom container (which is wrapper.parent)
      if (host.dataset.zoomInitialized) continue;
      if (host.closest('.mermaid-zoom-container')) continue;
      
      // Material replaces <pre class="mermaid"> with <div class="mermaid"> after attaching shadow root.
      // Also allow <pre class="mermaid"> if it has already been processed by Mermaid.
      const isDiv = host.tagName.toLowerCase() === 'div';
      const isProcessed = host.getAttribute('data-processed') === 'true' || host.dataset.processed === 'true';
      
      if (isDiv || isProcessed) {
        setupZoomPan(host);
      }
    }
  } catch (err) {
    showError('Error during scan execution', err);
  }
}

function init() {
  scan();
  // Poll every 500ms to catch lazy rendering
  setInterval(scan, 500);
}

// Listen to custom event for instant scanning when dynamically re-rendered
document.addEventListener('mermaid-rendered', scan);

// Support both native document load and Material for MkDocs instant loading
if (typeof document$ !== 'undefined') {
  document$.subscribe(() => {
    init();
  });
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
    });
  } else {
    init();
  }
}

function setupZoomPan(wrapper) {
  try {
    wrapper.dataset.zoomInitialized = 'true';

    // Create viewport container
    const container = document.createElement('div');
    container.className = 'mermaid-zoom-container';

    // Insert viewport container before wrapper, and move wrapper inside container
    wrapper.parentNode.insertBefore(container, wrapper);
    container.appendChild(wrapper);

    // Apply viewport styling to the host wrapper to allow panning and scaling
    wrapper.style.transformOrigin = '0 0';
    wrapper.style.transition = 'transform 0.1s ease-out';
    wrapper.style.display = 'block';
    wrapper.style.width = 'max-content';
    wrapper.style.height = 'max-content';

    // Get dimensions of the host wrapper (which matches SVG dimensions)
    let svgWidth = wrapper.scrollWidth || wrapper.offsetWidth || 800;
    let svgHeight = wrapper.scrollHeight || wrapper.offsetHeight || 550;
    
    if (svgWidth <= 0) svgWidth = 800;
    if (svgHeight <= 0) svgHeight = 550;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function applyTransform() {
      if (isNaN(scale) || scale <= 0 || isNaN(panX) || isNaN(panY)) return;
      wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function reset() {
      const containerWidth = container.clientWidth || 800;
      const containerHeight = container.clientHeight || 550;
      
      const scaleX = containerWidth / svgWidth;
      const scaleY = containerHeight / svgHeight;
      scale = Math.min(scaleX, scaleY, 1.5);
      if (scale <= 0 || isNaN(scale)) scale = 1.0;
      
      panX = (containerWidth - svgWidth * scale) / 2;
      panY = (containerHeight - svgHeight * scale) / 2;
      applyTransform();
    }

    // Centered wheel zooming
    const zoomFactor = 1.15;
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const svgX = (mouseX - panX) / scale;
      const svgY = (mouseY - panY) / scale;
      
      let newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
      newScale = Math.max(0.02, Math.min(50, newScale));
      
      panX = mouseX - svgX * newScale;
      panY = mouseY - svgY * newScale;
      scale = newScale;
      
      wrapper.style.transition = 'none'; // immediate response
      applyTransform();
    }, { passive: false });

    // Drag to pan & pinch-to-zoom tracking
    const activePointers = new Map();
    let previousDistance = 0;

    container.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('.mermaid-zoom-controls')) return;

      activePointers.set(e.pointerId, e);
      wrapper.style.transition = 'none';
      container.setPointerCapture(e.pointerId);

      if (activePointers.size === 1) {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        container.style.cursor = 'grabbing';
      } else if (activePointers.size === 2) {
        isDragging = false; // Stop panning
        const [p1, p2] = Array.from(activePointers.values());
        previousDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      }
    });

    container.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, e);

      if (activePointers.size === 1 && isDragging) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
      } else if (activePointers.size === 2) {
        const [p1, p2] = Array.from(activePointers.values());
        const currentDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
        
        if (previousDistance > 0 && currentDistance > 0) {
          const ratio = currentDistance / previousDistance;
          let newScale = scale * ratio;
          newScale = Math.max(0.02, Math.min(50, newScale));

          const midX = (p1.clientX + p2.clientX) / 2;
          const midY = (p1.clientY + p2.clientY) / 2;
          const rect = container.getBoundingClientRect();
          const anchorX = midX - rect.left;
          const anchorY = midY - rect.top;

          const svgX = (anchorX - panX) / scale;
          const svgY = (anchorY - panY) / scale;

          panX = anchorX - svgX * newScale;
          panY = anchorY - svgY * newScale;
          scale = newScale;
          
          applyTransform();
        }
        previousDistance = currentDistance;
      }
    });

    const endDrag = (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        previousDistance = 0;
      }
      if (activePointers.size === 0) {
        isDragging = false;
        container.style.cursor = 'grab';
        try {
          container.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);

    // Initial setup with a slight delay to allow layout painting
    setTimeout(reset, 150);
    
    // Watch size changes to adjust centering
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        reset();
      });
      resizeObserver.observe(container);
    }

    // Glassmorphism Overlay Controls
    const controls = document.createElement('div');
    controls.className = 'mermaid-zoom-controls';

    const btnZoomIn = document.createElement('button');
    btnZoomIn.innerHTML = '+';
    btnZoomIn.title = 'Zoom In';
    btnZoomIn.addEventListener('click', () => {
      const mouseX = container.clientWidth / 2;
      const mouseY = container.clientHeight / 2;
      const svgX = (mouseX - panX) / scale;
      const svgY = (mouseY - panY) / scale;
      scale = Math.min(50, scale * 1.3);
      panX = mouseX - svgX * scale;
      panY = mouseY - svgY * scale;
      wrapper.style.transition = 'transform 0.2s ease-out';
      applyTransform();
    });

    const btnZoomOut = document.createElement('button');
    btnZoomOut.innerHTML = '-';
    btnZoomOut.title = 'Zoom Out';
    btnZoomOut.addEventListener('click', () => {
      const mouseX = container.clientWidth / 2;
      const mouseY = container.clientHeight / 2;
      const svgX = (mouseX - panX) / scale;
      const svgY = (mouseY - panY) / scale;
      scale = Math.max(0.02, scale / 1.3);
      panX = mouseX - svgX * scale;
      panY = mouseY - svgY * scale;
      wrapper.style.transition = 'transform 0.2s ease-out';
      applyTransform();
    });

    const btnReset = document.createElement('button');
    btnReset.innerHTML = '⟲';
    btnReset.title = 'Fit to Screen';
    btnReset.addEventListener('click', () => {
      wrapper.style.transition = 'transform 0.2s ease-out';
      reset();
    });

    const btnFullscreen = document.createElement('button');
    btnFullscreen.innerHTML = '⛶';
    btnFullscreen.title = 'Toggle Fullscreen';
    btnFullscreen.addEventListener('click', () => {
      const isFullscreen = container.classList.toggle('fullscreen');
      if (isFullscreen) {
        btnFullscreen.innerHTML = '✕';
        btnFullscreen.title = 'Exit Fullscreen';
        document.body.classList.add('has-fullscreen-mermaid');
      } else {
        btnFullscreen.innerHTML = '⛶';
        btnFullscreen.title = 'Toggle Fullscreen';
        document.body.classList.remove('has-fullscreen-mermaid');
      }
      setTimeout(reset, 150);
    });

    controls.appendChild(btnZoomIn);
    controls.appendChild(btnZoomOut);
    controls.appendChild(btnReset);
    controls.appendChild(btnFullscreen);
    container.appendChild(controls);

    // Hint Overlay
    const hint = document.createElement('div');
    hint.className = 'mermaid-zoom-hint';
    hint.innerHTML = 'Drag to pan | Scroll to zoom';
    container.appendChild(hint);

    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => {
        try {
          hint.remove();
        } catch (e) {}
      }, 500);
    }, 3000);
  } catch (err) {
    showError('Error in setupZoomPan', err);
  }
}
