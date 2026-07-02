---
type: "Overview"
title: "$TITLE_CAPITALIZED Relation Cloud"
description: "Interactive graph linking $FOLDER_NAME cards sharing common tags."
timestamp: "$TIMESTAMP"
hide:
  - navigation
  - toc
---
# $TITLE_CAPITALIZED Relation Cloud

<div class="graph-search-container"><div class="search-input-wrapper"><input type="text" id="graph-search" placeholder="Search $FOLDER_NAME by name or tag..." autocomplete="off"><button id="search-clear" class="search-clear-btn" type="button">&times;</button></div><div class="filter-dropdown-wrapper"><label for="shared-tag-threshold">Min. shared tags:</label><select id="shared-tag-threshold" class="filter-dropdown-select"><option value="1">At least 1</option><option value="2" selected>At least 2</option><option value="3">At least 3</option><option value="4">At least 4</option></select></div></div>

<div id="cy-fullscreen" data-collection="$FOLDER_NAME"></div>

<p class="graph-hint">💡 Note: Adjust the dropdown above to filter connections by the number of shared tags.</p>
