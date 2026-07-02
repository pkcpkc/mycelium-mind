document.addEventListener('DOMContentLoaded', async function() {
  const container = document.getElementById('cy') || document.getElementById('cy-fullscreen');
  if (!container) return;

  // Try to find the script element loading collections-cloud.js to get the exact relative root prefix.
  // This is highly robust as MkDocs automatically builds the correct relative path for assets.
  let rootPrefix = '';
  const scriptEl = document.querySelector('script[src*="collections-cloud.js"]');
  if (scriptEl) {
    const src = scriptEl.getAttribute('src') || '';
    const match = src.match(/^(.*)assets[/\\]js[/\\]collections-cloud\.js/);
    if (match) {
      rootPrefix = match[1];
    }
  } else {
    // Fallback: Resolve root prefix dynamically based on current page URL depth
    const pathParts = window.location.pathname.split('/');
    const nonEmptyParts = pathParts.filter(p => p.length > 0);
    const isDirectoryUrl = window.location.pathname.endsWith('/') || !nonEmptyParts[nonEmptyParts.length - 1]?.includes('.');
    const depth = isDirectoryUrl ? nonEmptyParts.length : nonEmptyParts.length - 1;
    rootPrefix = depth > 0 ? '../'.repeat(depth) : '';
  }

  console.log(`[Collections Cloud] Fetching ${rootPrefix}tags.json...`);
  let tagsData;
  try {
    const response = await fetch(rootPrefix + 'tags.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    tagsData = await response.json();
  } catch (e) {
    console.error('[Collections Cloud] Failed to fetch or parse tags.json:', e);
    container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Failed to load graph data: tags.json not found or invalid.</div>`;
    return;
  }

  const mappings = tagsData.mappings || [];
  
  // Get collection name from the container attribute (default is 'concepts')
  const collectionName = container.getAttribute('data-collection') || 'concepts';
  const prefix = `collections/${collectionName}/`;

  // Filter mappings to only include items matching this collection with at least 2 tags
  const conceptMappings = mappings.filter(m => 
    m.item && 
    m.item.url && 
    m.item.url.startsWith(prefix) && 
    m.tags && 
    m.tags.length >= 2
  );

  // Build raw nodes
  const rawNodes = conceptMappings.map((m, index) => {
    const id = `c${index + 1}`;
    const tags = (m.tags || []).map(t => String(t).trim().toLowerCase());
    return {
      data: {
        id,
        label: m.item.title,
        url: rootPrefix + m.item.url,
        tags: tags
      },
      tags: tags
    };
  });

  // Build elements based on shared tags threshold
  const thresholdSelect = document.getElementById('shared-tag-threshold');
  let currentThreshold = thresholdSelect ? parseInt(thresholdSelect.value, 10) : 2;
  if (isNaN(currentThreshold)) currentThreshold = 2;

  function buildGraphElements(minSharedTags) {
    const edges = [];
    const seenEdges = new Set();
    const connectedNodeIds = new Set();

    for (let i = 0; i < rawNodes.length; i++) {
      for (let j = i + 1; j < rawNodes.length; j++) {
        const nodeA = rawNodes[i];
        const nodeB = rawNodes[j];
        
        const shared = nodeA.tags.filter(t => nodeB.tags.includes(t));
        if (shared.length >= minSharedTags) {
          const edgeKey = [nodeA.data.id, nodeB.data.id].sort().join('-');
          if (!seenEdges.has(edgeKey)) {
            edges.push({
              data: {
                id: `${nodeA.data.id}-${nodeB.data.id}`,
                source: nodeA.data.id,
                target: nodeB.data.id,
                label: shared.join(', ')
              }
            });
            seenEdges.add(edgeKey);
            connectedNodeIds.add(nodeA.data.id);
            connectedNodeIds.add(nodeB.data.id);
          }
        }
      }
    }

    const nodes = rawNodes.filter(n => connectedNodeIds.has(n.data.id));
    return [
      ...nodes.map(n => ({ data: n.data })),
      ...edges
    ];
  }

  const initialElements = buildGraphElements(currentThreshold);

  // Set up stylesheet colors
  const lightColors = {
    nodeBg: '#6366f1',
    nodeBorder: '#4f46e5',
    nodeColor: '#1e293b',
    edgeColor: '#64748b',
    edgeLine: '#cbd5e1',
    edgeTextBg: '#ffffff',
    searchBorder: '#e11d48'
  };

  const darkColors = {
    nodeBg: '#818cf8',
    nodeBorder: '#6366f1',
    nodeColor: '#f1f5f9',
    edgeColor: '#94a3b8',
    edgeLine: '#475569',
    edgeTextBg: '#1e293b',
    searchBorder: '#fb7185'
  };

  function getCurrentThemeColors() {
    const isDark = document.body.getAttribute('data-md-color-scheme') === 'slate';
    return isDark ? darkColors : lightColors;
  }

  const currentColors = getCurrentThemeColors();

  const layoutConfig = {
    name: 'cose',
    idealEdgeLength: 120,
    nodeOverlap: 30,
    refresh: 20,
    fit: true,
    padding: 40,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: 400000,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  };

  // Initialize Cytoscape
  const cy = window.cytoscape({
    container: container,
    elements: initialElements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'color': currentColors.nodeColor,
          'background-color': currentColors.nodeBg,
          'border-color': currentColors.nodeBorder,
          'border-width': '2px',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '65px',
          'height': '65px',
          'font-size': '11px',
          'font-weight': 'bold',
          'text-wrap': 'wrap',
          'text-max-width': '55px',
          'transition-property': 'opacity, background-color, border-color, color, width, height, border-width',
          'transition-duration': '0.2s',
          'cursor': 'pointer',
          'z-index': 10
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': currentColors.edgeLine,
          'target-arrow-shape': 'none',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '9px',
          'color': currentColors.edgeColor,
          'text-background-opacity': 0.85,
          'text-background-color': currentColors.edgeTextBg,
          'text-background-padding': '3px',
          'text-background-shape': 'round',
          'transition-property': 'opacity, line-color, color',
          'transition-duration': '0.2s',
          'z-index': 1
        }
      },
      {
        selector: '.search-highlighted',
        style: {
          'border-color': currentColors.searchBorder,
          'border-width': '4px',
          'width': '75px',
          'height': '75px',
          'z-index': 5000
        }
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.15
        }
      },
      {
        selector: '.top-node',
        style: {
          'z-index': 9999
        }
      }
    ],
    layout: layoutConfig
  });

  // Tap navigation
  cy.on('tap', 'node', function(evt) {
    const node = evt.target;
    const url = node.data('url');
    if (url) {
      window.location.href = url;
    }
  });

  // Search Input and Clear Button Handler
  const searchInput = document.getElementById('graph-search');
  const searchClear = document.getElementById('search-clear');

  function updateSearchHighlights() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (query === '') {
      if (searchClear) searchClear.style.display = 'none';
      cy.elements().removeClass('search-highlighted');
      return;
    }
    
    if (searchClear) searchClear.style.display = 'block';
    
    cy.nodes().each(function(node) {
      const label = (node.data('label') || '').toLowerCase();
      const tags = node.data('tags') || [];
      const matches = label.includes(query) || tags.some(t => t.includes(query));
      
      if (matches) {
        node.addClass('search-highlighted');
      } else {
        node.removeClass('search-highlighted');
      }
    });
  }

  function updateGraph(threshold) {
    cy.elements().remove();
    cy.add(buildGraphElements(threshold));
    cy.layout(layoutConfig).run();
    updateSearchHighlights();
  }

  if (thresholdSelect) {
    thresholdSelect.addEventListener('change', function() {
      const val = parseInt(thresholdSelect.value, 10);
      if (!isNaN(val)) {
        updateGraph(val);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', updateSearchHighlights);
  }

  if (searchClear) {
    searchClear.addEventListener('click', function() {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateSearchHighlights();
    });
  }

  cy.on('mouseover', 'node', function(evt) {
    const node = evt.target;
    node.addClass('top-node');
    const neighborhood = node.neighborhood();
    cy.elements().addClass('dimmed');
    node.removeClass('dimmed');
    neighborhood.removeClass('dimmed');
  });

  cy.on('mouseout', 'node', function(evt) {
    const node = evt.target;
    node.removeClass('top-node');
    cy.elements().removeClass('dimmed');
  });

  function updateTheme() {
    const colors = getCurrentThemeColors();
    cy.style()
      .selector('node')
      .style({
        'color': colors.nodeColor,
        'background-color': colors.nodeBg,
        'border-color': colors.nodeBorder
      })
      .selector('edge')
      .style({
        'line-color': colors.edgeLine,
        'text-background-color': colors.edgeTextBg,
        'color': colors.edgeColor
      })
      .selector('.search-highlighted')
      .style({
        'border-color': colors.searchBorder
      })
      .update();
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'data-md-color-scheme') {
        updateTheme();
      }
    });
  });

  observer.observe(document.body, { attributes: true });
});
