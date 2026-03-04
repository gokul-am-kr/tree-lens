# XML / JSON Parser — Project Reference

Single-file app: `index.html` (~5365 lines)
Stack: Pure HTML + CSS + vanilla JS, zero dependencies.

**Last updated:** PNR copy history added — copy button on PNR/Order ID chips, history strip up to 10 entries, Copy all, localStorage persistence (Mar 2026)

---

## CSS Variables (`:root`)

| Variable   | Value     | Role                          |
|------------|-----------|-------------------------------|
| `--bg`     | `#07080d` | Page background               |
| `--s1`     | `#0d0f18` | Surface 1 (header, toolbar)   |
| `--s2`     | `#12151f` | Surface 2 (cards, inputs)     |
| `--s3`     | `#171b28` | Surface 3 (hover states)      |
| `--b1`     | `#1e2235` | Border 1 (default borders)    |
| `--b2`     | `#28304a` | Border 2 (heavier borders)    |
| `--accent` | `#4f8eff` | Blue — JSON / objects         |
| `--purple` | `#8b5cf6` | Purple — arrays               |
| `--green`  | `#34d399` | Green — strings               |
| `--orange` | `#f97316` | Orange — numbers              |
| `--pink`   | `#ec4899` | Pink — booleans               |
| `--cyan`   | `#22d3ee` | Cyan — XML elements           |
| `--yellow` | `#f59e0b` | Yellow — XML attributes       |
| `--red`    | `#f87171` | Red — null / errors           |
| `--text`   | `#dde4f0` | Primary text                  |
| `--text2`  | `#7d8da6` | Secondary text                |
| `--muted`  | `#374162` | Muted / placeholder text      |
| `--dot-color` | `rgba(255,255,255,0.055)` | Canvas dot grid color (overridden in light mode) |

**Light mode overrides** (`[data-theme="light"]`): all 17 variables reassigned to a light palette. See CSS block after `:root {}` for full values.

---

## Font Size System

`html[data-size]` attribute controls global text scale (all `rem`-based sizes cascade):

| `data-size` | `html font-size` | Effect |
|-------------|-----------------|--------|
| `sm`        | 13px            | Compact |
| `md`        | 16px (default)  | Normal |
| `lg`        | 19px            | Large / accessible |

Preference saved to `localStorage` key `parser-size`.

## Theme System

`html[data-theme]` toggles between `"dark"` (default) and `"light"`.
- Header button: moon icon = currently dark (click → light); sun icon = currently light (click → dark)
- On theme switch, `doRender()` / `showDiff()` is called to rebuild SVG connector lines with theme-aware colors
- `T_COLOR_LIGHT` provides the light-mode hex map used by `tc()` for SVG stroke colors
- Preference saved to `localStorage` key `parser-theme`

## App Mode

Global `let appMode = 'parser'` — page-level switch between the parser canvas and the Flight View.

| Value | Description |
|-------|-------------|
| `'parser'` | Default — shows `.output-pane` (node graph / tree / diff) |
| `'flight'` | Hides `.output-pane`, shows `#flight-view` with structured airline data |

Toggle buttons: `#btn-mode-parser` / `#btn-mode-flight` in `.app-tabs` in the header.
`setAppMode(mode)` handles the switch; not persisted to localStorage (resets on reload).

---

## View Mode

Global `let viewMode = 'graph'` — controls which renderer `doRender()` dispatches to.

| Value | Renderer | Description |
|-------|----------|-------------|
| `'graph'` | `renderGraph()` | Floating cards on dot-grid canvas with SVG bezier lines; drag-to-pan |
| `'tree'` | `renderClassicTree()` | Indented classic tree list with animated expand/collapse |

Toggle button: `#btn-view-toggle` in the output pane toolbar. Adds class `.tree-active` when in tree mode. Preference is **not** persisted to localStorage (resets to graph on reload).

---

## Layout Constants (JS, top of `<script>`)

| Constant | Value | Meaning                              |
|----------|-------|--------------------------------------|
| `CW`     | 224   | Card width in px (matches `.fcard`)  |
| `CH`     | 72    | Card height in px (estimated)        |
| `HG`     | 68    | Horizontal gap: parent right → child left |
| `VG`     | 12    | Vertical gap between siblings        |
| `PAD`    | 32    | Canvas outer padding                 |

---

## Type Maps

### T_COLOR — accent color per node type
| Type      | Color     |
|-----------|-----------|
| object    | `#4f8eff` |
| array     | `#8b5cf6` |
| string    | `#34d399` |
| number    | `#f97316` |
| boolean   | `#ec4899` |
| null      | `#f87171` |
| element   | `#22d3ee` |
| text      | `#8892a4` |
| comment   | `#475569` |
| cdata     | `#f97316` |

### T_BADGE — CSS class for type badge
`tb-obj`, `tb-arr`, `tb-str`, `tb-num`, `tb-bool`, `tb-null`, `tb-xml`, `tb-txt`, `tb-cmt`

### T_LABEL — short display label
`obj`, `arr`, `str`, `num`, `bool`, `null`, `xml`, `text`, `cmt`, `cdata`

---

## Node Data Model

Every tree node produced by `mkNode()`:

```js
{
  id:        Number,          // auto-incremented global counter (_nid)
  key:       String|Number|null, // field name, array index, or null for root
  type:      String,          // see types below
  value:     Any,             // scalar value; null for containers
  children:  Node[],          // child nodes (empty for leaves)
  collapsed: Boolean,         // whether children are hidden on canvas
  x:         Number,          // canvas X position (set by layout())
  y:         Number,          // canvas Y position (set by layout())
  totalH:    Number,          // total height including all visible children
  _attrs:    Attr[]|null,     // XML DOM Attr array; null for JSON nodes
  _leaf:     Boolean          // true for XML single-text-child or self-closing elements
}
```

**Node types:** `object`, `array`, `string`, `number`, `boolean`, `null`, `element`, `text`, `comment`, `cdata`

**Key display rules in `makeCard()`:**
- `key === null` → show `n.type` (italicised, root style)
- `typeof key === 'number'` → show `[N]` (purple, idx style)
- `type === 'element'` → show `<tagName>` (cyan, tag style)
- Otherwise → show `"key"` (accent, default style)

---

## Flight View

Activated when `appMode === 'flight'`. Re-parses raw XML directly (via `DOMParser`) to run smart multi-pattern field extraction. Does **not** support JSON input.

### Extraction Helpers

| Function | Description |
|---|---|
| `fvText(root, ...tags)` | Returns first non-empty `textContent` found across tag name candidates |
| `fvPath(root, ...parts)` | Walks nested path (e.g. `fvPath(seg,'Departure','AirportCode')`) |
| `fvAttr(root, tag, attr)` | Gets attribute from first matching element |
| `fvAll(root, ...tags)` | Collects all elements matching any tag name (first non-empty set wins) |

### Data Extractors

| Function | Returns | NDC patterns | Generic / Amadeus fallbacks |
|---|---|---|---|
| `extractFvPNR(root)` | `String\|null` | `Order@GdsBookingRef`, `BookingReferences/BookingReference/ID` | `RecordLocator`, `BookingRef`, `PNR`, `ConfirmationNumber`, ... |
| `extractFvOrderId(root)` | `String\|null` | `Order@OrderID` | `OrderID`, `OrderReference` |
| `extractFvSegments(root)` | `Segment[]` | Containers: `FlightSegment` | `Segment`, `AirSegment`, `Leg`, `FlightLeg` |
| `extractFvPassengers(root)` | `Passenger[]` | Containers: `Passenger` | `Pax`, `Traveler`, `TravelerInfo`, `Individual` |
| `extractFvOrderItems(root)` | `OrderItem[]` | Containers: `OrderItem` | `OfferItem`, `BookingItem` |
| `extractFvTickets(root)` | `Ticket[]` | Containers: `TicketDocInfo` | `Ticket`, `ETicket`, `TicketingInfo`, `TicketDocument` |

**Segment fields tried per segment element:**
- `depAirport`: `Departure/AirportCode` → `Dep/AirportCode` → `DepartureAirport`, `BoardPointCode`, `OriginCode`, ...
- `arrAirport`: `Arrival/AirportCode` → `Arr/AirportCode` → `ArrivalAirport`, `OffPointCode`, `DestinationCode`, ...
- `depDate/depTime`: `Departure/Date`, `Departure/Time` → flat tags → splits `DepartureDateTime` ISO string
- `arrDate/arrTime`: same pattern for arrival
- `flightNumber`: `MarketingCarrier/FlightNumber` → `FlightNumber`, `FlightNo`, `FltNum`
- `carrier`: `MarketingCarrier/AirlineID` → `CarrierCode`, `AirlineCode`, `MarketingAirlineCode`

### Flight View CSS Classes

| Class | Role |
|---|---|
| `.app-tabs` / `.app-tab` | Header tab group; `.app-tab.active` = filled accent background |
| `#flight-view` | Full-flex column panel; `display:none` by default |
| `#flight-view.fv-active` | `display:flex` — shown in flight mode |
| `.fv-infobar` | Row of chip pills (PNR, Order ID) |
| `.fv-chip` | Info pill; variants `.pnr`, `.oid`, `.miss` |
| `.fv-chip-label` / `.fv-chip-val` | Label + monospace value inside chip |
| `.fv-section` / `.fv-sec-title` | Section container + uppercase heading with bottom border |
| `.fv-segs` | Flex-wrap grid of segment cards |
| `.fv-seg-card` | Individual segment card with hover shadow |
| `.fv-route` | Flex row: dep airport — arrow — arr airport |
| `.fv-airport` | Large monospace airport code (1.35rem, bold) |
| `.fv-arrow` | Horizontal line with `▸` pseudo-element |
| `.fv-times` / `.fv-time-block` | Times row; left = dep, right = arr |
| `.fv-time` / `.fv-date` | Accent-colored time + muted date |
| `.fv-flight-badge` | Carrier + flight number pill |
| `.fv-missing` | Italic muted placeholder |
| `.fv-table` | Rounded bordered table (passengers, order items, tickets) |
| `.fv-ptc-badge` | Passenger type chip (ADT/CHD/INF) |
| `.fv-tkt-num` / `.fv-tkt-type` | Green monospace ticket number + type label |
| `.fv-empty` / `.fv-no-data` | Empty/error state messages |

### Render Functions

| Function | Description |
|---|---|
| `fvTry(root, patterns)` | Unified resolver: `'A/B'` → `fvPath`, plain → `fvText`; tries each pattern in order |
| `renderFlightView()` | Master: builds persistent toolbar + `.fv-content` div (once), clears content, re-parses XML, renders all sections |
| `openFvSettings()` / `closeFvSettings()` | Show/hide `#fv-settings-panel` + `#fvs-backdrop` |
| `renderFvSettings()` | Populates `#fvs-body` with grouped textarea fields from `fvConfig` |
| `applyFvConfig()` | Reads textareas → updates `fvConfig` → saves to localStorage → re-renders flight view |
| `updateFvScript()` | Fetches source, replaces `FV_TAG_CONFIG` block (between markers), downloads updated `index.html` |
| `setAppMode(mode)` | Switches between `'parser'` and `'flight'`; shows/hides panels; triggers render |

### Tag Configuration System

- **`FV_TAG_CONFIG`** — `const` at top of script (line ~2160); all default tag arrays in one place; ends with `; // __END_FV_TAG_CONFIG__` marker used by `updateFvScript()`
- **`fvConfig`** — mutable `let` copy, initialized from `FV_TAG_CONFIG`, overridden by `localStorage['parser-fv-config']` on load
- All extraction functions read from `fvConfig` via `fvTry()` instead of hardcoded arrays
- **Settings panel** (`#fv-settings-panel`): fixed right-side slide-in panel, 420px wide, triggered by `⚙ Tag Config` button in flight view toolbar
- **Apply** saves to localStorage only (runtime); **Update Script** patches the `FV_TAG_CONFIG` const and downloads a new `index.html`

---

## Classic Tree View CSS Classes

All prefixed with `.tv-` (tree view):

| Class | Role |
|---|---|
| `.tree-view` | Wrapper div injected into `#canvas-inner` in tree mode |
| `.tv-node` | Column flex container per node |
| `.tv-row` | Row: border + background; `.has-kids` adds pointer cursor |
| `.tv-togbtn` | Chevron toggle button; `.open` rotates 90° + accent color |
| `.tv-spacer` | 16px placeholder when no toggle (leaf nodes) |
| `.tv-key` | Monospace key label; variants: `.tv-key-tag` (cyan), `.tv-key-str` (accent), `.tv-key-idx` (purple), `.tv-key-root` (muted italic) |
| `.tv-sep` | `:` separator between key and value |
| `.tv-val` | Monospace value; type variants: `.tv-str`, `.tv-num`, `.tv-bool`, `.tv-null`, `.tv-xml`, `.tv-txt`, `.tv-cmt` |
| `.tv-count` | Child count badge (e.g. `3 items`) |
| `.tv-attrs` | Flex row of XML attr chips |
| `.tv-children` | CSS grid collapse animation (`grid-template-rows: 0fr → 1fr`); `.open` expands |
| `.tv-children-inner` | Inner wrapper with `overflow:hidden` + left border indent |
| `.tv-row.tv-err` | Error/warning row (red background + red text) |
| `#btn-view-toggle.tree-active` | Active state for tree mode button (purple accent) |
| `.fcard-divider` | 1px horizontal rule inside compound graph cards |

---

## HTML Structure

```
<header>                        logo · "XML & JSON Parser" · "Node Explorer" pill
<div.workspace>
  <div.input-pane>              left pane (hideable, 36% width)
    <div.doc-section>           Doc A
      <div.toolbar>             JSON | XML | Clear | ▶ Parse buttons
      <textarea#input-area>     raw input
      <div.statusbar>           #s-badge · #s-msg
    <div.doc-b-wrap#doc-b-wrap> Doc B (hidden by default, compare mode)
      <div.toolbar>             JSON | XML | Clear | ▶ Parse B buttons
      <textarea#input-area-b>
      <div.statusbar>           #s-badge-b · #s-msg-b
  <div.output-pane>             right pane (flex: 1)
    <div.toolbar>               #toggle-input-btn | "Node Explorer" | Compare | Tree/Graph toggle | Expand all | Collapse all
    <div.search-strip>          #search-input · #search-meta (#ss-count · #btn-search-clear)
    <div#canvas-area>           scrollable, dot-grid background, drag-to-pan
      <div#canvas-inner>        sized by JS
        <svg#svg-lines>         bezier connector lines + port dots
        <div#empty-state>       shown when no tree rendered
        .fcard nodes            floating cards (injected by JS)
    <div#diff-view>             compare/diff panel (shown instead of canvas in compare mode)
```

---

## JavaScript Functions

### Parsing & Tree Building

| Function | Description |
|---|---|
| `mkNode(key, type, value, children)` | Creates a node; auto-increments `_nid` |
| `jsonToTree(val, key, depth)` | Recursively converts a JSON value to a tree; root is never collapsed, depth > 0 nodes are collapsed by default |
| `xmlToTree(xn, depth)` | Converts a DOM node to a tree; handles element, text (nodeType 3), comment (8), CDATA (4); single-text-child → leaf with `_leaf=true` |
| `detectType(src)` | Returns `'json'` if starts with `{`/`[`, `'xml'` if starts with `<`, else `null` |
| `doParse()` | Reads `#input-area`, detects type, parses, calls `doRender()` or `showDiff()` |
| `doParseB()` | Same for Doc B; calls `showDiff()` if both docs parsed |

### Layout & Render

| Function | Description |
|---|---|
| `layout(n, x, startY)` | Recursive horizontal tree layout; leaves get `CH` height, containers span their children vertically and center themselves |
| `canvasSize(n)` | Walks visible nodes to find max x+y, returns `[w+PAD, h+PAD]` |
| `doRender()` | Master render: dispatches to `renderGraph()` or `renderClassicTree()` based on `viewMode` |
| `renderGraph(root)` | Graph mode: calls `layout()` → sizes canvas + SVG → clears old cards → calls `renderNode()` |
| `renderClassicTree(root)` | Tree mode: clears canvas, injects `.tree-view` wrapper, calls `buildTreeNode()` on root |
| `buildTreeNode(n, depth, container)` | Builds a `.tv-node` with a `.tv-row` (key + value + toggle button) and recursive `.tv-children` container; handles expand/collapse via grid animation |
| `isCompound(n)` | Returns true if node is an XML element with only primitive-leaf children (renders as inline key:value card) |
| `nodeHeight(n)` | Returns card height: compound nodes scale by child count, others return `CH` |
| `renderNode(n, parent)` | Appends a card; draws a bezier to parent if present; recurses into children if not collapsed |
| `drawCurve(p, c)` | Draws SVG `<path>` (cubic bezier) + two `<circle>` port dots between parent and child |
| `makeCard(n)` | Builds `.fcard` DOM element with row-1 (key + badge + toggle) and row-2 (count or value + attrs); compound nodes get inline child rows |
| `appendAttrs(container, attrs)` | Appends up to 2 XML attr chips + overflow count to a container element |

### Expand / Collapse

| Function | Description |
|---|---|
| `walkAll(n, fn)` | DFS walk of entire tree, calls `fn` on every node |
| `btn-expand-all` handler | Sets `collapsed=false` on all container nodes, re-renders |
| `btn-collapse-all` handler | Sets `collapsed=true` on all containers; keeps root open |

### Search

| Function | Description |
|---|---|
| `doSearch(query, exact)` | Walks tree; collects nodes whose `key` matches query; flattens arrays into per-item entries; calls `renderSearchResults()` |
| `renderSearchResults(items, query, exact)` | Switches canvas to grid mode; shows count badge; builds `.result-grid` |
| `buildResultCard(item)` | Builds a search result card (`.result-card`) with collapsible header and sorted/expandable body rows |
| `buildExpandableRow(child, depth, keyPath)` | Builds a row in a result card; container rows expand via `syncExpand()`; leaf values highlight via `syncHighlight()` |
| `leafValueEl(n)` | Returns a typed `<span class="rc-v">` for a leaf node's value |
| `exitSearch()` | Clears search state, removes result grid, calls `doRender()` |
| `syncExpand(keypath, open)` | Toggles `.rc-nested.open` + chevron + value text on all `.rc-row-wrap[data-keypath]` matching the keypath |
| `syncHighlight(keypath)` | Adds/removes `.row-highlight` + `.col-highlight` across all matching rows; toggles off if same path clicked again |

### Priority Sort

| Function | Description |
|---|---|
| `fieldPriority(key)` | Scores a key string; lower = higher priority. Exact matches in `PRIORITY_EXACT` list score 0–18; suffix patterns score 20–28; everything else scores 999 |
| `sortForCard(children)` | Sorts children by priority then leaves-before-containers; used in result cards |

**PRIORITY_EXACT list (ordered, index = score):**
`id, _id, uuid, guid, no, number, num, code, name, title, status, state, type, kind, ref, key, label, description`

### Diff / Compare

| Function | Description |
|---|---|
| `isContainer(n)` | True if node is non-leaf with children |
| `leafStrDiff(n)` | String value of a leaf node for comparison |
| `containerSummary(n)` | `"[ N items ]"` or `"{ N keys }"` |
| `allSameTag(children)` | True if all children share the same tag (XML array detection) |
| `diffChildLists(childrenA, childrenB)` | Matches children by key name (or by index if same-tag XML array); returns list of diff nodes |
| `makeDiffNode(key, a, b)` | Creates a diff node with status: `'match'`, `'changed'`, `'a-only'`, `'b-only'`, or `'container'` |
| `countDiffStats(nodes)` | Returns `{ match, changed, aOnly, bOnly }` by walking all diff nodes recursively |
| `countLeaves(nodes)` | Counts non-container diff nodes recursively |
| `leafStatusMatch(node, status)` | Whether a leaf node passes the active filter |
| `containerStatusMatch(node, status)` | Whether a container node passes the active filter |
| `filterDiffNodes(nodes, q, status)` | Recursively filters diff nodes by field name query + status chip |
| `applyDiffFilter()` | Calls `filterDiffNodes()` then renders either table or card view |
| `showDiff()` | Builds the full diff UI: stats bar + filter strip + column headers + scrollable rows |
| `buildDiffRow(entry, depth)` | Builds a table-view diff row with collapsible children |
| `diffValEl(val, type)` | Typed value span for diff cells (`dv-str`, `dv-num`, etc.) |
| `renderDiffCards(filtered)` | Renders the card-view diff grid |
| `buildDiffCard(entry)` | Builds a diff card with header (key + type badges + status icon) + body |
| `buildDiffCardRow(child, depth)` | Row inside a diff card; recurses up to `MAX_DEPTH=2`, `MAX_KIDS=5` |
| `buildDiffCardLeaf(entry)` | Side-by-side A/B leaf layout in a diff card |
| `exitCompare()` | Clears all compare state, restores canvas view |

### UI State / Misc

| Function | Description |
|---|---|
| `setStatus(type, badge, msg)` | Updates `#s-badge` class + text + `#s-msg` text for Doc A |
| `setStatusB(type, badge, msg)` | Same for Doc B |
| `showEmpty()` | Resets to empty state: clears tree, SVG, search |
| `esc(s)` | HTML-escapes `&`, `<`, `>`, `"` |
| `plusSVG() / minusSVG()` | Returns inline SVG strings for card toggle buttons |
| `svgMk(tag)` | `document.createElementNS(svgNS, tag)` helper |

---

## Bookmarks

Allows starring any node from graph view, tree view, or search results. Persisted to `localStorage['parser-bookmarks']`.

### Data Model
Each bookmark: `{ pathKey, pathParts[], label, type, value }`.
- `pathKey` = `pathParts.join('\0')` — unique stable identifier
- `pathParts` = array of key segments from root (e.g. `['element','Order','FlightSegment','[0]']`)
- `label` = display name (node key or type)
- `value` = first 80 chars of node value (nullable)

### JS Functions

| Function | Description |
|---|---|
| `bmKey(pp)` | Join pathParts with `\0` → stable key |
| `bmIsMarked(pathKey)` | Returns `true` if pathKey is bookmarked |
| `bmAdd(bm)` | Push to bookmarks array, save, update badge |
| `bmRemove(pk)` | Filter out bookmark by pathKey, save, update badge |
| `bmToggle(bm)` | Add or remove based on current state |
| `bmSave()` | Persist `bookmarks` to `localStorage` |
| `updateBmBadge()` | Show/hide and set count on `#bm-badge` |
| `_bmNodeObj(n, pathParts)` | Build bookmark object from node + path |
| `_bmStarBtn(cls, pathKey)` | Create `<button>` with star + `data-pathkey` attr |
| `_bmHandleClick(btn, bm)` | Toggle bookmark and update button state |
| `findNodeByPath(root, pathParts)` | Walk `treeRoot` following pathParts; returns `{node, ancestors}` or `null` |
| `navigateToBm(bm)` | Find node by path, close panel, call `navigateToNode()` |
| `renderBmPanel()` | Render list of bookmarks into `#bm-panel-body` |
| `openBmPanel()` | Render + show panel + backdrop |
| `closeBmPanel()` | Hide panel + backdrop |

### CSS Classes

| Selector | Role |
|---|---|
| `.fc-bm` | Star button on graph cards (hidden until card hover) |
| `.fc-bm.active` | Star button when node is bookmarked (yellow, always visible) |
| `.tv-bm` | Star button on tree-view rows |
| `.bm-btn-wrap` | Wrapper div for toolbar Bookmarks button (holds badge) |
| `#bm-badge` | Yellow count badge on Bookmarks button |
| `#bm-panel` | Slide-in right panel (`translateX(100%)` → `translateX(0)`) |
| `#bm-backdrop` | Semi-transparent overlay behind panel |
| `.bm-panel-header` | Panel header with title, Clear all, close button |
| `.bm-panel-body` | Scrollable list area |
| `.bm-item` | Single bookmark card |
| `.bm-item-key` | Monospace label (node key/type) |
| `.bm-item-path` | Small path breadcrumb |
| `.bm-item-val` | Green value preview |
| `.bm-item-actions` | Nav + delete buttons |
| `.bm-nav-btn` | Navigate-to-node arrow button |
| `.bm-del-btn` | Remove bookmark × button |
| `.bm-pulse` | Yellow glow animation on navigated node |

### Path propagation
- `renderGraph(root)` → `renderNode(root, null, [rootSeg])`
- `renderNode(n, parent, pathParts)` → `makeCard(n, pathParts)`, recurses with `[...pathParts, childSeg]`
- `renderClassicTree(root)` → `buildTreeNode(root, 0, wrap, [rootSeg])`
- `buildTreeNode(n, depth, container, pathParts)` → adds star btn, recurses with `[...pathParts, childSeg]`
- `buildResultCard(item)` — uses `pathParts` already in item (from `doSearch`)

---

## Events / Interaction Map

| Trigger | Handler |
|---|---|
| `#btn-parse` click | `doParse()` |
| `#btn-clear` click | Clear textarea → `showEmpty()` |
| `#btn-json` click | Load `JSON_SAMPLE` → `doParse()` |
| `#btn-xml` click | Load `XML_SAMPLE` → `doParse()` |
| `#input-area` Ctrl/Cmd+Enter | `doParse()` |
| `#btn-expand-all` click | Expand all nodes, `doRender()` |
| `#btn-collapse-all` click | Collapse all (keep root), `doRender()` |
| `#search-input` input | `doSearch(value, false)` — partial match |
| `.rc-name` click (result card) | `doSearch(displayName, true)` — exact match |
| `#btn-search-clear` click | `exitSearch()` |
| `.fcard` click (expandable) | Toggle `n.collapsed`, `doRender()` |
| `.fc-toggle` button click | Toggle `n.collapsed`, `doRender()` (stops propagation) |
| Result card header click | Toggle card body collapse (local, no re-render) |
| Result `.rc-row.has-children` click | `syncExpand(keypath, open)` |
| Result leaf `.rc-v` click | `syncHighlight(keypath)` |
| `#btn-bookmarks` click | `openBmPanel()` — slide-in bookmarks panel |
| `#bm-backdrop` click | `closeBmPanel()` |
| `.bm-panel-close` click | `closeBmPanel()` |
| `.bm-clear-all` click | Clear all bookmarks, update badge, refresh panel |
| `.bm-nav-btn` click (panel item) | `navigateToBm(bm)` — close panel, switch to parser, navigate |
| `.bm-del-btn` click (panel item) | `bmRemove(pk)`, refresh panel, update visible star buttons |
| `.fc-bm` / `.tv-bm` click | `_bmHandleClick()` — toggle bookmark, update badge |
| `#btn-mode-parser` click | `setAppMode('parser')` — shows output pane, re-renders tree |
| `#btn-mode-flight` click | `setAppMode('flight')` — shows flight view, calls `renderFlightView()` |
| `#btn-view-toggle` click | Toggle `viewMode` between `'graph'` and `'tree'`; re-renders; toggles `.tree-active` class |
| `#btn-compare` click | Toggle compare mode; show/hide Doc B pane |
| `#btn-b-parse` click | `doParseB()` |
| `#btn-b-clear` click | Clear Doc B, hide diff view |
| `#btn-b-json/xml` click | Load sample into Doc B → `doParseB()` |
| `#input-area-b` Ctrl/Cmd+Enter | `doParseB()` |
| `#toggle-input-btn` click | Toggle `.input-pane.hidden` |
| `#canvas-area` mousedown (not on card) | Start drag pan |
| `window` mousemove | Pan canvas while dragging |
| `window` mouseup | End pan |
| Diff filter chips | Set `diffFilterStatus`, `applyDiffFilter()` |
| `#diff-search-input` input | Set `diffFilterQuery`, `applyDiffFilter()` |
| Diff view toggle (table/cards) | Set `diffViewMode`, `applyDiffFilter()` |
| Diff `.is-grp` row click | Toggle `.diff-children.open` + chevron |

---

## Diff Node Data Model

Produced by `makeDiffNode()`:

```js
{
  key:        String,           // display key name
  status:     String,           // 'match' | 'changed' | 'a-only' | 'b-only' | 'container'
  valueA:     String|null,      // stringified A value (or container summary)
  valueB:     String|null,      // stringified B value (or container summary)
  typeA:      String|null,      // node type from Doc A
  typeB:      String|null,      // node type from Doc B
  children:   DiffNode[]|null,  // recursive diff children (null for leaves)
  hasChanges: Boolean|undefined // true if container has any non-match descendants
}
```

**Diff status icons:**
- `✓` match (green)
- `≠` changed (yellow)
- `A` a-only (red)
- `B` b-only (cyan)
- `◈` container with diffs (purple)
- `◇` container, identical (green)

---

## Sample Data

Both `JSON_SAMPLE` and `XML_SAMPLE` represent the same "Book Emporium" store:
- Nested address object
- Books array (2–3 items with title/author/price/inStock)
- Tags array
- Root attributes: name, open, rating

Used by the JSON/XML sample buttons in both Doc A and Doc B toolbars.
