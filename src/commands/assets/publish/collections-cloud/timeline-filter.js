document.addEventListener('DOMContentLoaded', function() {
  const timelineSelect = document.getElementById('timeline-tag-threshold');
  if (timelineSelect) {
    initTimelineFilter(timelineSelect);
  }
});

function initTimelineFilter(timelineSelect) {
  const dataEl = document.getElementById('timeline-data');
  if (!dataEl) return;

  const rawEvents = JSON.parse(decodeURIComponent(dataEl.getAttribute('data-events') || '[]'));
  const searchInput = document.getElementById('graph-search');
  const searchClear = document.getElementById('search-clear');
  
  // Find max tags among all events
  let maxTags = 0;
  rawEvents.forEach(e => {
    const count = parseInt(e.tagCount, 10) || 0;
    if (count > maxTags) maxTags = count;
  });

  // Populate timelineSelect dropdown from 0 to maxTags
  const prevSelected = parseInt(timelineSelect.value, 10);
  const defaultVal = !isNaN(prevSelected) ? prevSelected : 0; // Default is 0!

  timelineSelect.innerHTML = '';
  for (let i = 0; i <= maxTags; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `At least ${i} tags`;
    if (i === defaultVal) {
      opt.selected = true;
    }
    timelineSelect.appendChild(opt);
  }

  function filterAndRenderTimeline() {
    const threshold = parseInt(timelineSelect.value, 10) || 0;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (searchClear) {
      searchClear.style.display = query ? 'block' : 'none';
    }

    const filteredEvents = rawEvents.filter(e => {
      const matchesTag = (parseInt(e.tagCount, 10) || 0) >= threshold;
      if (!matchesTag) return false;

      if (query) {
        const titleMatch = (e.title || '').toLowerCase().includes(query);
        const dateMatch = (e.date || '').toLowerCase().includes(query);
        const sourceMatch = (e.source || '').toLowerCase().includes(query);
        return titleMatch || dateMatch || sourceMatch;
      }
      return true;
    });

    // Group filtered events by year
    const grouped = {};
    for (const event of filteredEvents) {
      let groupKey = event.date;
      if (/^\d{4}/.test(event.date)) {
        groupKey = event.date.slice(0, 4);
      }
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(event);
    }

    const sortedKeys = Object.keys(grouped).sort();
    if (sortedKeys.length === 0) {
      grouped['No events'] = ['No events matching filters'];
      sortedKeys.push('No events');
    }

    const isDark = document.documentElement.getAttribute('data-md-color-scheme') === 'slate';
    const textColor = isDark ? '#ffffff' : '#0f172a';
    const lineColor = isDark ? '#ffffff' : '#475569';
    const customCss = `
      .titleText { fill: ${textColor} !important; font-weight: bold !important; }
      g.section text, g.task text, text.sectionTitle { fill: ${textColor} !important; }
      line { stroke: ${lineColor} !important; stroke-width: 2px !important; }
      path.line { stroke: ${lineColor} !important; stroke-width: 3px !important; }
      .axis-line, .timeline-axis, path { stroke: ${lineColor} !important; }
      marker path, .arrowhead { fill: ${lineColor} !important; stroke: ${lineColor} !important; }
    `;

    // Reconstruct mermaid syntax
    let code = '%%{init: {\n' +
      '  "theme": "base",\n' +
      '  "themeVariables": {\n' +
      '    "cScale0": "#6B75CC", "cScaleLabel0": "#ffffff",\n' +
      '    "cScale1": "#6B75CC", "cScaleLabel1": "#ffffff",\n' +
      '    "cScale2": "#6B75CC", "cScaleLabel2": "#ffffff",\n' +
      '    "cScale3": "#6B75CC", "cScaleLabel3": "#ffffff",\n' +
      '    "cScale4": "#6B75CC", "cScaleLabel4": "#ffffff",\n' +
      '    "cScale5": "#6B75CC", "cScaleLabel5": "#ffffff",\n' +
      '    "cScale6": "#6B75CC", "cScaleLabel6": "#ffffff",\n' +
      '    "cScale7": "#6B75CC", "cScaleLabel7": "#ffffff",\n' +
      '    "cScale8": "#6B75CC", "cScaleLabel8": "#ffffff",\n' +
      '    "cScale9": "#6B75CC", "cScaleLabel9": "#ffffff",\n' +
      '    "cScale10": "#6B75CC", "cScaleLabel10": "#ffffff",\n' +
      '    "cScale11": "#6B75CC", "cScaleLabel11": "#ffffff"\n' +
      '  },\n' +
      '  "themeCSS": "' + customCss.replace(/\n/g, ' ').replace(/"/g, '\\"') + '"\n' +
      '}}%%\ntimeline\n    title Timeline\n';

    for (const key of sortedKeys) {
      const yearEvents = grouped[key];
      const mermaidEvents = yearEvents.map(event => {
        if (typeof event === 'string') return event;
        const label = `${event.date} — ${event.title}`;
        const cleanLabel = label
          .replace(/:/g, ' - ')
          .replace(/"/g, "'")
          .replace(/\(/g, '#40;')
          .replace(/\)/g, '#41;')
          .replace(/\[/g, '#91;')
          .replace(/\]/g, '#93;')
          .replace(/[\r\n]+/g, ' ')
          .trim();
        return cleanLabel;
      });
      const cleanKey = key.replace(/:/g, '-');
      code += `    ${cleanKey} : ${mermaidEvents.join(' : ')}\n`;
    }

    const graphicContainer = document.getElementById('timeline-graphic-container');
    if (graphicContainer) {
      // Clear container completely to avoid overlapping elements or old zoom wrappers
      graphicContainer.innerHTML = '';

      // Create new pre element
      const pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = code;
      graphicContainer.appendChild(pre);

      triggerMermaid();
    }
  }

  function triggerMermaid() {
    function notifyRendered() {
      // Dispatch custom event to notify zoom handler
      document.dispatchEvent(new CustomEvent('mermaid-rendered'));
    }

    if (typeof mermaid !== 'undefined') {
      if (typeof mermaid.run === 'function') {
        mermaid.run({ querySelector: '#timeline-graphic-container .mermaid' })
          .then(notifyRendered)
          .catch(function(e) {
            console.error('[Timeline Filter] mermaid.run failed:', e);
            notifyRendered();
          });
      } else if (typeof mermaid.init === 'function') {
        mermaid.init(undefined, document.querySelectorAll('#timeline-graphic-container .mermaid'));
        setTimeout(notifyRendered, 100);
      }
    } else {
      // Poll every 100ms until mermaid is loaded, up to 5 seconds
      let attempts = 0;
      const interval = setInterval(function() {
        attempts++;
        if (typeof mermaid !== 'undefined') {
          clearInterval(interval);
          if (typeof mermaid.run === 'function') {
            mermaid.run({ querySelector: '#timeline-graphic-container .mermaid' })
              .then(notifyRendered)
              .catch(function(e) {
                console.error('[Timeline Filter] polled mermaid.run failed:', e);
                notifyRendered();
              });
          } else if (typeof mermaid.init === 'function') {
            mermaid.init(undefined, document.querySelectorAll('#timeline-graphic-container .mermaid'));
            setTimeout(notifyRendered, 100);
          }
        } else if (attempts >= 50) {
          clearInterval(interval);
        }
      }, 100);
    }
  }

  let renderTimeout = null;
  function scheduleRender() {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(function() {
      filterAndRenderTimeline();
    }, 150);
  }

  timelineSelect.addEventListener('change', scheduleRender);

  if (searchInput) {
    searchInput.addEventListener('input', scheduleRender);
  }

  if (searchClear) {
    searchClear.addEventListener('click', function() {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      filterAndRenderTimeline();
    });
  }

  // Run initial render to ensure theme variables are computed and zoom controls are attached
  filterAndRenderTimeline();

  // Watch for theme changes to re-render timeline with correct theme variables
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'data-md-color-scheme') {
          filterAndRenderTimeline();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
  }
}
