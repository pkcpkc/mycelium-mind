// Raise Mermaid's secure limits for large diagrams (e.g. social graphs with 500+ edges).
// Material for MkDocs calls mermaid.initialize() with its own config, which resets site config,
// so we wrap initialize() to always merge our limits in. Mermaid must be loaded before this script
// (Material then reuses the global instead of fetching its own copy).
(function () {
  if (typeof mermaid === 'undefined' || typeof mermaid.initialize !== 'function') {
    console.warn('[Mermaid Config] mermaid not loaded; limits not applied');
    return;
  }
  const limits = { maxEdges: 100000, maxTextSize: 10000000 };
  const originalInitialize = mermaid.initialize.bind(mermaid);
  mermaid.initialize = function (config) {
    return originalInitialize(Object.assign({}, config, limits));
  };
  mermaid.initialize({ startOnLoad: false });
})();
