// ── Samples ─────────────────────────────────────────────────────────────────
const JSON_SAMPLE = JSON.stringify({
  store: {
    name: "Book Emporium",
    open: true,
    rating: 4.8,
    address: { street: "123 Main St", city: "Metropolis", zip: "10001" },
    books: [
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald", price: 9.99, inStock: true },
      { title: "1984", author: "George Orwell", price: 7.49, inStock: false },
      { title: "To Kill a Mockingbird", author: "Harper Lee", price: 8.99, inStock: true }
    ],
    tags: ["fiction", "classics", "literature"],
    manager: null
  }
}, null, 2);

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<store name="Book Emporium" open="true" rating="4.8">
  <!-- Main inventory -->
  <address>
    <street>123 Main St</street>
    <city>Metropolis</city>
    <zip>10001</zip>
  </address>
  <books>
    <book inStock="true">
      <title>The Great Gatsby</title>
      <author>F. Scott Fitzgerald</author>
      <price>9.99</price>
    </book>
    <book inStock="false">
      <title>1984</title>
      <author>George Orwell</author>
      <price>7.49</price>
    </book>
  </books>
  <tags>
    <tag>fiction</tag>
    <tag>classics</tag>
  </tags>
</store>`;

// ── PNR / Order-ID history (persists across parses) ──────────────────────────
let pnrHistory = [];
(function () {
  try {
    const s = localStorage.getItem('parser-pnr-history');
    if (s) {
      pnrHistory = JSON.parse(s);
      // Migrate old format { pnr, orderId } → { bookingId, orderId, iataNumber }
      pnrHistory = pnrHistory.map(h => h.bookingId !== undefined ? h : { bookingId: h.pnr || null, orderId: h.orderId || null, iataNumber: null });
    }
  } catch {}
})();
function pnrHistSave() { localStorage.setItem('parser-pnr-history', JSON.stringify(pnrHistory)); }
function pnrHistAdd(bookingId, orderId, iataNumber) {
  if (!bookingId) return;
  if (pnrHistory.some(h => h.bookingId === bookingId)) return; // no duplicates
  pnrHistory.unshift({ bookingId, orderId: orderId || null, iataNumber: iataNumber || null });
  if (pnrHistory.length > 10) pnrHistory.length = 10;
  pnrHistSave();
  renderFvPnrHistory();
}
function pnrHistRemove(bookingId) {
  pnrHistory = pnrHistory.filter(h => h.bookingId !== bookingId);
  pnrHistSave();
  renderFvPnrHistory();
}
function renderFvPnrHistory() {
  const row = document.getElementById('fv-pnr-history-row');
  if (!row) return;
  row.innerHTML = '';
  if (!pnrHistory.length) { row.style.display = 'none'; return; }
  row.style.display = 'flex';

  const lbl = document.createElement('span');
  lbl.className = 'fv-hist-label';
  lbl.textContent = 'Copied PNRs';
  row.appendChild(lbl);

  const chips = document.createElement('div');
  chips.className = 'fv-hist-chips';
  pnrHistory.forEach(h => {
    const chip = document.createElement('div');
    chip.className = 'fv-hist-chip';

    function mkField(label, val) {
      const f = document.createElement('div');
      f.className = 'fv-hist-field';
      const lbl = document.createElement('span');
      lbl.className = 'fv-hist-field-lbl';
      lbl.textContent = label;
      const v = document.createElement('span');
      v.className = 'fv-hist-field-val' + (val ? '' : ' fv-hist-null');
      v.textContent = val || '—';
      f.appendChild(lbl); f.appendChild(v);
      if (val) {
        f.title = 'Click to copy ' + val;
        f.addEventListener('click', () => {
          navigator.clipboard.writeText(val).then(() => {
            const orig = v.textContent;
            v.textContent = '✓';
            setTimeout(() => v.textContent = orig, 1100);
          });
        });
      }
      return f;
    }

    chip.appendChild(mkField('BKG', h.bookingId));
    chip.appendChild(mkField('ORD', h.orderId));
    chip.appendChild(mkField('IATA', h.iataNumber));

    const del = document.createElement('button');
    del.className = 'fv-hist-del';
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', () => pnrHistRemove(h.bookingId));
    chip.appendChild(del);

    chips.appendChild(chip);
  });
  row.appendChild(chips);

  const copyAllBtn = document.createElement('button');
  copyAllBtn.className = 'fv-hist-copy-all';
  copyAllBtn.textContent = 'Copy all (' + pnrHistory.length + ')';
  copyAllBtn.addEventListener('click', () => {
    const text = pnrHistory.map(h =>
      [h.bookingId, h.orderId, h.iataNumber].filter(Boolean).join('\t')
    ).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      copyAllBtn.classList.add('copied');
      copyAllBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyAllBtn.classList.remove('copied');
        copyAllBtn.textContent = 'Copy all (' + pnrHistory.length + ')';
      }, 1400);
    });
  });
  row.appendChild(copyAllBtn);
}

// ── Flight view tag configuration ────────────────────────────────────────────
// Edit the arrays below to match your airline's XML field names.
// Use "Parent/Child" slash-notation for nested paths, or plain tag names for direct matches.
// These are the hardcoded defaults; the UI "Update Script" button regenerates this block.
const FV_TAG_CONFIG = {
  "pnr":                 ["BookingRef/BookingID","BookingID","BookingReferences/BookingReference/ID","RecordLocator","BookingRef","PNR","ConfirmationNumber","LocatorCode","BookingCode","GDS_BookingReference","BookingReference","ReservationID","PNRCode"],
  "orderId":             ["OrderID","OrderReference","OrderNumber"],
  "segmentContainers":   ["DatedMarketingSegment","FlightSegment","Segment","AirSegment","Leg","FlightLeg"],
  "depAirport":          ["Dep/IATA_LocationCode","Departure/AirportCode","Dep/AirportCode","DepartureAirport","DepartureStation","OriginCode","BoardPointCode","DepAirportCode","FromAirportCode","OriginAirportCode","Origin"],
  "arrAirport":          ["Arrival/IATA_LocationCode","Arrival/AirportCode","Arr/AirportCode","ArrivalAirport","ArrivalStation","DestinationCode","OffPointCode","ArrAirportCode","ToAirportCode","DestinationAirportCode","Destination"],
  "depDate":             ["Departure/Date","DepartureDate","DepDate"],
  "depTime":             ["Departure/Time","DepartureTime","DepTime","STD"],
  "depDateTime":         ["Dep/AircraftScheduledDateTime","DepartureDateTime","DepDateTime"],
  "arrDate":             ["Arrival/Date","ArrivalDate","ArrDate"],
  "arrTime":             ["Arrival/Time","ArrivalTime","ArrTime","STA"],
  "arrDateTime":         ["Arrival/AircraftScheduledDateTime","ArrivalDateTime","ArrDateTime"],
  "flightNumber":        ["MarketingCarrierFlightNumberText","MarketingCarrier/FlightNumber","FlightNumber","FlightNo","FltNum","MarketingFlightNumber","FlightNum"],
  "carrier":             ["CarrierDesigCode","MarketingCarrier/AirlineID","CarrierCode","AirlineCode","MarketingAirlineCode","OperatingAirlineCode","ValidatingCarrier","Carrier"],
  "passengerContainers": ["Passenger","Pax","Traveler","TravelerInfo","Individual"],
  "surname":             ["Individual/Surname","Name/Surname","Surname","LastName","FamilyName"],
  "given":               ["Individual/GivenName","Name/Given","Given","GivenName","FirstName","Firstname"],
  "ptc":                 ["PTC","PassengerType","PaxType","TypeCode"],
  "orderItemContainers": ["OrderItem","OfferItem","BookingItem"],
  "itemPrice":           ["FareDetail/Price/TotalAmount","Price/TotalAmount","TotalPrice","TotalAmount","Fare","Price","Amount"],
  "itemCurrency":        ["CurrencyCode","Currency"],
  "itemRefs":            ["FlightRefs","SegmentRefs","OfferItemRefs"],
  "ticketContainers":    ["TicketDocInfo","Ticket","ETicket","TicketingInfo","TicketDocument"],
  "ticketNumber":        ["Number","TicketNumber","DocumentNumber","ETicketNumber","TicketNum"],
  "ticketPassengerRef":  ["PassengerReference","PaxRef","TravelerRef"],
  "ticketType":          ["Type"],
  "iataNumber":          ["OrgID","IATANumber","AgencyCode","IATA_Code","AgencyID","AgencyNum"]
}; // __END_FV_TAG_CONFIG__

// ── Layout constants ─────────────────────────────────────────────────────────
const CW          = 224;  // card width  (matches CSS)
const CH          = 72;   // card height (matches CSS .fcard min-height)
const LEVEL_GAP   = 60;   // vertical gap: parent bottom → children top
const SIBLING_GAP = 20;   // horizontal gap between sibling cards
const PAD         = 32;   // canvas padding

// ── Type maps ────────────────────────────────────────────────────────────────
const T_COLOR = {
  object: '#4f8eff', array: '#8b5cf6',
  string: '#34d399', number: '#f97316', boolean: '#ec4899', null: '#f87171',
  element: '#22d3ee', text: '#8892a4', comment: '#475569', cdata: '#f97316'
};

const T_COLOR_LIGHT = {
  object: '#2563eb', array: '#7c3aed',
  string: '#059669', number: '#c2410c', boolean: '#be185d', null: '#b91c1c',
  element: '#0e7490', text: '#64748b', comment: '#6b7280', cdata: '#c2410c'
};

const T_BADGE = {
  object: 'tb-obj', array: 'tb-arr',
  string: 'tb-str', number: 'tb-num', boolean: 'tb-bool', null: 'tb-null',
  element: 'tb-xml', text: 'tb-txt', comment: 'tb-cmt', cdata: 'tb-num'
};

const T_LABEL = {
  object: 'obj', array: 'arr',
  string: 'str', number: 'num', boolean: 'bool', null: 'null',
  element: 'xml', text: 'text', comment: 'cmt', cdata: 'cdata'
};

const tc = t => (document.documentElement.dataset.theme === 'light'
  ? T_COLOR_LIGHT[t] : T_COLOR[t]) || '#8892a4';

// ── Node factory ─────────────────────────────────────────────────────────────
let _nid = 0;
function mkNode(key, type, value, children) {
  return {
    id: _nid++, key, type, value,
    children: children || [],
    collapsed: true,
    x: 0, y: 0, totalH: 0,
    _attrs: null, _leaf: false
  };
}

// ── JSON → tree ──────────────────────────────────────────────────────────────
function jsonToTree(val, key, depth) {
  depth = depth || 0;
  if (val === null)             return mkNode(key, 'null',    null, []);
  if (typeof val === 'boolean') return mkNode(key, 'boolean', val,  []);
  if (typeof val === 'number')  return mkNode(key, 'number',  val,  []);
  if (typeof val === 'string')  return mkNode(key, 'string',  val,  []);

  const isArr = Array.isArray(val);
  const entries = isArr ? val.map((v, i) => [i, v]) : Object.entries(val);
  const n = mkNode(key, isArr ? 'array' : 'object', null,
    entries.map(([k, v]) => jsonToTree(v, k, depth + 1))
  );
  n.collapsed = (depth > 0);
  return n;
}

// ── XML → tree ───────────────────────────────────────────────────────────────
function xmlToTree(xn, depth) {
  depth = depth || 0;
  if (xn.nodeType === 8) return mkNode(null, 'comment', xn.nodeValue.trim(), []);
  if (xn.nodeType === 4) return mkNode(null, 'cdata',   xn.nodeValue,        []);
  if (xn.nodeType === 3) {
    const t = xn.nodeValue.trim();
    return t ? mkNode(null, 'text', t, []) : null;
  }

  const tag   = xn.nodeName;
  const attrs = Array.from(xn.attributes || []);
  const kids  = Array.from(xn.childNodes)
    .filter(c => !(c.nodeType === 3 && !c.nodeValue.trim()));

  // Single text child → leaf
  if (kids.length === 1 && kids[0].nodeType === 3) {
    const n = mkNode(tag, 'element', kids[0].nodeValue.trim(), []);
    n._attrs = attrs; n._leaf = true;
    return n;
  }

  // Self-closing
  if (kids.length === 0) {
    const n = mkNode(tag, 'element', null, []);
    n._attrs = attrs; n._leaf = true;
    return n;
  }

  const children = kids.map(c => xmlToTree(c, depth + 1)).filter(Boolean);
  const n = mkNode(tag, 'element', null, children);
  n._attrs = attrs;
  n.collapsed = (depth > 0);
  return n;
}

// ── Compound node helpers ─────────────────────────────────────────────────────
const ROW_H = 22; // px per inline key:value row inside a compound card

// An XML element whose children are ALL simple leaf elements → show inline.
function isCompound(n) {
  return n.type === 'element' && !n._leaf
    && n.children.length > 0
    && n.children.every(c => c._leaf && c.type === 'element');
}

// Actual rendered height of a card (compound cards grow with row count).
function nodeHeight(n) {
  if (isCompound(n)) return 44 + n.children.length * ROW_H;
  return CH;
}

// ── Layout algorithm ─────────────────────────────────────────────────────────
// Vertical tree: root at top, children spread horizontally below, centered.
function layout(n, startX, y) {
  const vis = (n.collapsed || !n.children.length || isCompound(n)) ? [] : n.children;

  if (!vis.length) {
    n.x = startX; n.y = y; n.totalW = CW;
    return CW;
  }

  let span = 0;
  vis.forEach((c, i) => {
    if (i > 0) span += SIBLING_GAP;
    span += layout(c, startX + span, y + nodeHeight(n) + LEVEL_GAP);
  });

  n.x = startX + Math.max(0, (span - CW) / 2);
  n.y = y;
  n.totalW = Math.max(CW, span);
  return n.totalW;
}

function canvasSize(n) {
  let maxX = 0, maxY = 0;
  function walk(nd) {
    maxX = Math.max(maxX, nd.x + CW);
    maxY = Math.max(maxY, nd.y + nodeHeight(nd));
    if (!nd.collapsed && !isCompound(nd)) nd.children.forEach(walk);
  }
  walk(n);
  return [maxX + PAD, maxY + PAD];
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const canvasArea  = document.getElementById('canvas-area');
const canvasInner = document.getElementById('canvas-inner');
const svgEl       = document.getElementById('svg-lines');
const emptyState  = document.getElementById('empty-state');
const inputEl     = document.getElementById('input-area');
const sBadge      = document.getElementById('s-badge');
const sMsgEl      = document.getElementById('s-msg');

let treeRoot = null;
let activeRenderRoot = null; // when set, doRender() uses this root instead of treeRoot

// ── Render ───────────────────────────────────────────────────────────────────
let viewMode = 'graph'; // 'graph' | 'tree'
let appMode  = 'parser'; // 'parser' | 'flight'

// ── Bookmarks ─────────────────────────────────────────────────────────────────
let bookmarks = [];
(function () {
  try { const s = localStorage.getItem('parser-bookmarks'); if (s) bookmarks = JSON.parse(s); } catch {}
})();
function bmSave()    { localStorage.setItem('parser-bookmarks', JSON.stringify(bookmarks)); }
function bmKey(pp)   { return pp.join('\0'); }
function bmIsMarked(pathKey) { return bookmarks.some(b => b.pathKey === pathKey); }
function bmAdd(bm)   { if (!bmIsMarked(bm.pathKey)) { bookmarks.push(bm); bmSave(); updateBmBadge(); } }
function bmRemove(pk){ bookmarks = bookmarks.filter(b => b.pathKey !== pk); bmSave(); updateBmBadge(); }
function bmToggle(bm){ bmIsMarked(bm.pathKey) ? bmRemove(bm.pathKey) : bmAdd(bm); }
function updateBmBadge() {
  const badge = document.getElementById('bm-badge');
  if (!badge) return;
  badge.style.display = bookmarks.length ? 'flex' : 'none';
  badge.textContent   = bookmarks.length;
}
function _bmNodeObj(n, pathParts) {
  const pathKey = bmKey(pathParts);
  return {
    pathKey,
    pathParts: [...pathParts],
    label: (n.key !== null && n.key !== undefined) ? String(n.key) : n.type,
    type:  n.type,
    value: (n.value !== null && n.value !== undefined) ? String(n.value).slice(0, 80) : null
  };
}
function _bmStarBtn(cls, pathKey) {
  const btn = document.createElement('button');
  btn.className = cls + (bmIsMarked(pathKey) ? ' active' : '');
  btn.setAttribute('data-pathkey', pathKey);
  btn.title = bmIsMarked(pathKey) ? 'Remove bookmark' : 'Add bookmark';
  btn.textContent = '★';
  return btn;
}
function _bmHandleClick(btn, bm) {
  bmToggle(bm);
  const marked = bmIsMarked(bm.pathKey);
  btn.classList.toggle('active', marked);
  btn.title = marked ? 'Remove bookmark' : 'Add bookmark';
  const panelBody = document.getElementById('bm-panel-body');
  if (panelBody && document.getElementById('bm-panel').classList.contains('bm-open')) renderBmPanel();
}

function doRender() {
  const root = activeRenderRoot || treeRoot;
  if (!root) return;
  if (viewMode === 'tree') renderClassicTree(root);
  else                     renderGraph(root);
}

function renderGraph(root) {
  root = root || treeRoot;
  canvasArea.classList.remove('tree-mode');
  layout(root, PAD, PAD);
  const [w, h] = canvasSize(root);

  canvasInner.style.width  = w + 'px';
  canvasInner.style.height = h + 'px';
  svgEl.setAttribute('width',  w);
  svgEl.setAttribute('height', h);
  svgEl.innerHTML = '';

  canvasInner.querySelectorAll('.fcard, .tree-view').forEach(e => e.remove());
  emptyState.style.display = 'none';

  const _rootSeg = (root.key !== null && root.key !== undefined) ? String(root.key) : root.type;
  renderNode(root, null, [_rootSeg]);
}

function renderClassicTree(root) {
  canvasArea.classList.add('tree-mode');
  svgEl.innerHTML = '';
  canvasInner.querySelectorAll('.fcard, .tree-view').forEach(e => e.remove());
  canvasInner.style.width  = '';
  canvasInner.style.height = '';
  svgEl.setAttribute('width', 0);
  svgEl.setAttribute('height', 0);
  emptyState.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'tree-view';
  const _tvRootSeg = (root.key !== null && root.key !== undefined) ? String(root.key) : root.type;
  buildTreeNode(root, 0, wrap, [_tvRootSeg]);
  canvasInner.appendChild(wrap);
}

function buildTreeNode(n, depth, container, pathParts = []) {
  const hasKids = n.children && n.children.length > 0;
  const nodeEl  = document.createElement('div');
  nodeEl.className = 'tv-node';

  const row = document.createElement('div');
  row.className = 'tv-row' + (hasKids ? ' has-kids' : '');
  row.dataset.nid = n.id;

  // Error / warning highlighting
  const ERR_RE = /\b(error|err|warn|warning|exception|fail|failed|failure|fault)\b/i;
  const _kStr = (n.key !== null && n.key !== undefined) ? String(n.key) : '';
  const _vStr = (n.value !== null && n.value !== undefined) ? String(n.value) : '';
  if (ERR_RE.test(_kStr) || (!hasKids && ERR_RE.test(_vStr))) row.classList.add('tv-err');

  // Toggle chevron
  let togBtn = null;
  if (hasKids) {
    togBtn = document.createElement('button');
    togBtn.className = 'tv-togbtn' + (n.collapsed ? '' : ' open');
    togBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    row.appendChild(togBtn);
  } else {
    const sp = document.createElement('span');
    sp.className = 'tv-spacer';
    row.appendChild(sp);
  }

  // Key
  const keyEl = document.createElement('span');
  keyEl.className = 'tv-key';
  if (n.key === null || n.key === undefined) {
    keyEl.classList.add('tv-key-root');
    keyEl.textContent = n.type === 'element' ? (n.key || 'root') : n.type;
  } else if (typeof n.key === 'number') {
    keyEl.classList.add('tv-key-idx');
    keyEl.textContent = `[${n.key}]`;
  } else if (n.type === 'element') {
    keyEl.classList.add('tv-key-tag');
    keyEl.textContent = String(n.key);
  } else {
    keyEl.classList.add('tv-key-str');
    keyEl.textContent = `"${String(n.key)}"`;
  }
  row.appendChild(keyEl);

  if (!hasKids) {
    // Leaf value
    const sep = document.createElement('span');
    sep.className = 'tv-sep';
    sep.textContent = ':';
    row.appendChild(sep);

    const valEl = document.createElement('span');
    valEl.className = 'tv-val';
    switch (n.type) {
      case 'string':  valEl.classList.add('tv-str');  valEl.textContent = `"${String(n.value ?? '')}"`; break;
      case 'number':  valEl.classList.add('tv-num');  valEl.textContent = String(n.value);              break;
      case 'boolean': valEl.classList.add('tv-bool'); valEl.textContent = String(n.value);              break;
      case 'null':    valEl.classList.add('tv-null'); valEl.textContent = 'null';                       break;
      case 'element': valEl.classList.add('tv-xml');  valEl.textContent = String(n.value ?? '');        break;
      case 'text':    valEl.classList.add('tv-txt');  valEl.textContent = String(n.value ?? '');        break;
      case 'comment': valEl.classList.add('tv-cmt');  valEl.textContent = `<!-- ${n.value} -->`;        break;
      default:        valEl.textContent = String(n.value ?? '');
    }
    row.appendChild(valEl);

    if (n._attrs && n._attrs.length) {
      const attrsEl = document.createElement('div');
      attrsEl.className = 'tv-attrs';
      n._attrs.slice(0, 3).forEach(a => {
        const chip = document.createElement('span');
        chip.className = 'fc-ac';
        chip.innerHTML = `<span class="fc-ac-nm">${esc(a.name)}=</span><span class="av">"${esc(a.value)}"</span>`;
        attrsEl.appendChild(chip);
      });
      row.appendChild(attrsEl);
    }
  } else {
    // Container: child count
    const cnt = document.createElement('span');
    cnt.className = 'tv-count';
    const c = n.children.length;
    cnt.textContent = n.type === 'array'  ? `[ ${c} ]`
                    : n.type === 'object' ? `{ ${c} }`
                    :                       `( ${c} )`;
    row.appendChild(cnt);

    if (n._attrs && n._attrs.length) {
      const attrsEl = document.createElement('div');
      attrsEl.className = 'tv-attrs';
      n._attrs.slice(0, 3).forEach(a => {
        const chip = document.createElement('span');
        chip.className = 'fc-ac';
        chip.innerHTML = `<span class="fc-ac-nm">${esc(a.name)}=</span><span class="av">"${esc(a.value)}"</span>`;
        attrsEl.appendChild(chip);
      });
      row.appendChild(attrsEl);
    }
  }

  // Bookmark star button
  const _tvBmBtn = _bmStarBtn('tv-bm', bmKey(pathParts));
  _tvBmBtn.addEventListener('click', e => {
    e.stopPropagation();
    _bmHandleClick(_tvBmBtn, _bmNodeObj(n, pathParts));
  });
  row.appendChild(_tvBmBtn);

  nodeEl.appendChild(row);

  if (hasKids) {
    const childWrap  = document.createElement('div');
    childWrap.className = 'tv-children' + (n.collapsed ? '' : ' open');
    const childInner = document.createElement('div');
    childInner.className = 'tv-children-inner';

    n.children.forEach(child => {
      const _seg = (child.key !== null && child.key !== undefined)
        ? (typeof child.key === 'number' ? `[${child.key}]` : String(child.key))
        : (child.type === 'element' ? String(child.key || child.type) : child.type);
      buildTreeNode(child, depth + 1, childInner, [...pathParts, _seg]);
    });
    childWrap.appendChild(childInner);
    nodeEl.appendChild(childWrap);

    const doToggle = () => {
      n.collapsed = !n.collapsed;
      togBtn.classList.toggle('open', !n.collapsed);
      childWrap.classList.toggle('open', !n.collapsed);
    };
    togBtn.addEventListener('click', e => { e.stopPropagation(); doToggle(); });
    row.addEventListener('click', doToggle);
  }

  container.appendChild(nodeEl);
}

function renderNode(n, parent, pathParts = []) {
  if (parent) drawCurve(parent, n);
  canvasInner.appendChild(makeCard(n, pathParts));
  if (!n.collapsed && !isCompound(n)) {
    n.children.forEach(c => {
      const _seg = (c.key !== null && c.key !== undefined)
        ? (typeof c.key === 'number' ? `[${c.key}]` : String(c.key))
        : (c.type === 'element' ? String(c.key || c.type) : c.type);
      renderNode(c, n, [...pathParts, _seg]);
    });
  }
}

// ── SVG curve + port dots ────────────────────────────────────────────────────
function drawCurve(p, c) {
  const x1 = p.x + CW / 2,  y1 = p.y + nodeHeight(p);   // parent bottom-center
  const x2 = c.x + CW / 2,  y2 = c.y;         // child top-center
  const my = (y1 + y2) / 2;
  const color = tc(c.type);

  const path = svgMk('path');
  path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-opacity', '0.45');
  svgEl.appendChild(path);

  // Port dots at connection endpoints
  [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
    const dot = svgMk('circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('r',  '3.5');
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0.65');
    svgEl.appendChild(dot);
  });
}

// ── Build card element ───────────────────────────────────────────────────────
function makeCard(n, pathParts = []) {
  const cmp    = isCompound(n);
  const isExp  = !cmp && !n._leaf && n.children.length > 0;
  const color  = tc(n.type);

  const card = document.createElement('div');
  card.className = `fcard${isExp ? ' expandable' : ''}`;
  card.style.cssText = `left:${n.x}px; top:${n.y}px; --c:${color};`;
  card.dataset.nid = n.id;

  // ── Row 1 ────────────────────────────────────
  const r1 = document.createElement('div');
  r1.className = 'fc-r1';

  // Key label
  const keyEl = document.createElement('span');
  let keyCls = 'fc-key';
  if (n.key === null || n.key === undefined) keyCls += ' root';
  else if (typeof n.key === 'number')        keyCls += ' idx';
  else if (n.type === 'element')             keyCls += ' tag';
  keyEl.className = keyCls;

  if (n.key === null || n.key === undefined) {
    keyEl.textContent = n.type;
  } else if (typeof n.key === 'number') {
    keyEl.textContent = `[${n.key}]`;
  } else if (n.type === 'element') {
    keyEl.textContent = esc(String(n.key));   // no angle brackets
  } else {
    keyEl.textContent = `"${esc(String(n.key))}"`;
  }
  keyEl.title = String(n.key ?? n.type);

  r1.appendChild(keyEl);

  // Toggle button (expandable only)
  if (isExp) {
    const toggle = document.createElement('button');
    toggle.className = 'fc-toggle';
    toggle.innerHTML = n.collapsed ? plusSVG() : minusSVG();
    toggle.title = n.collapsed ? 'Expand' : 'Collapse';
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      n.collapsed = !n.collapsed;
      doRender();
    });
    r1.appendChild(toggle);
  }

  // Bookmark star button
  const _fcBmBtn = _bmStarBtn('fc-bm', bmKey(pathParts));
  _fcBmBtn.addEventListener('click', e => {
    e.stopPropagation();
    _bmHandleClick(_fcBmBtn, _bmNodeObj(n, pathParts));
  });
  r1.appendChild(_fcBmBtn);

  card.appendChild(r1);

  // ── Compound: inline key:value rows ──────────
  if (cmp) {
    const divider = document.createElement('div');
    divider.className = 'fcard-divider';
    card.appendChild(divider);

    const rowsEl = document.createElement('div');
    rowsEl.className = 'fcard-rows';
    n.children.forEach(child => {
      const row = document.createElement('div');
      row.className = 'fcard-row';

      const k = document.createElement('span');
      k.className = 'fcard-rk';
      k.textContent = String(child.key ?? '');
      k.title = String(child.key ?? '');

      const sep = document.createElement('span');
      sep.className = 'fcard-rsep';
      sep.textContent = ':';

      const v = document.createElement('span');
      v.className = 'fcard-rv';
      v.textContent = String(child.value ?? '');
      v.title = String(child.value ?? '');

      row.appendChild(k);
      row.appendChild(sep);
      row.appendChild(v);
      rowsEl.appendChild(row);
    });
    card.appendChild(rowsEl);

  } else {
    // ── Normal row 2 ─────────────────────────────
    const r2 = document.createElement('div');
    r2.className = 'fc-r2';

    if (isExp) {
      const count = n.children.length;
      const unit  = n.type === 'object' ? (count === 1 ? 'key'  : 'keys')
                  : n.type === 'array'  ? (count === 1 ? 'item' : 'items')
                  :                       (count === 1 ? 'child': 'children');
      const cntEl = document.createElement('span');
      cntEl.className = 'fc-count';
      cntEl.textContent = n.collapsed
        ? `${count} ${unit} · click to expand`
        : `${count} ${unit}`;
      r2.appendChild(cntEl);
      appendAttrs(r2, n._attrs);

    } else {
      if (n.value !== null && n.value !== undefined && n.value !== '') {
        const valEl = document.createElement('span');
        valEl.className = 'fv';
        switch (n.type) {
          case 'string':  valEl.classList.add('fv-str');  valEl.textContent = `"${String(n.value)}"`;        break;
          case 'number':  valEl.classList.add('fv-num');  valEl.textContent = String(n.value);               break;
          case 'boolean': valEl.classList.add('fv-bool'); valEl.textContent = String(n.value);               break;
          case 'null':    valEl.classList.add('fv-null'); valEl.textContent = 'null';                        break;
          case 'text':    valEl.classList.add('fv-txt');  valEl.textContent = String(n.value);               break;
          case 'comment': valEl.classList.add('fv-cmt'); valEl.textContent = `<!-- ${String(n.value)} -->`; break;
          case 'cdata':   valEl.classList.add('fv-cmt'); valEl.textContent = '<![CDATA[…]]>';               break;
          case 'element': valEl.classList.add('fv-xml');  valEl.textContent = String(n.value);               break;
          default:        valEl.textContent = String(n.value ?? '');
        }
        r2.appendChild(valEl);
      }
      if (n._attrs && n._attrs.length) {
        appendAttrs(r2, n._attrs);
      }
    }

    card.appendChild(r2);

    if (isExp) {
      card.addEventListener('click', () => {
        n.collapsed = !n.collapsed;
        doRender();
      });
    }
  }

  return card;
}

function appendAttrs(container, attrs) {
  if (!attrs || !attrs.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'fc-attrs';
  attrs.slice(0, 2).forEach(a => {
    const chip = document.createElement('span');
    chip.className = 'fc-ac';
    chip.innerHTML = `<span class="fc-ac-nm">${esc(a.name)}=</span><span class="av">"${esc(a.value)}"</span>`;
    wrap.appendChild(chip);
  });
  if (attrs.length > 2) {
    const more = document.createElement('span');
    more.className = 'fc-ac-more';
    more.textContent = `+${attrs.length - 2}`;
    wrap.appendChild(more);
  }
  container.appendChild(wrap);
}

// ── Icons ────────────────────────────────────────────────────────────────────
function plusSVG() {
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function minusSVG() {
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function svgMk(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Parse ────────────────────────────────────────────────────────────────────
function setStatus(type, badge, msg) {
  sBadge.className  = `s-badge ${type}`;
  sBadge.textContent = badge;
  sMsgEl.textContent = msg;
}

function showEmpty() {
  treeRoot = null;
  canvasInner.querySelectorAll('.fcard, .result-grid, .no-results').forEach(e => e.remove());
  svgEl.innerHTML = '';
  emptyState.style.display = 'flex';
  searchMeta.style.display = 'none';
  searchInput.value = '';
  searchActive = false;
  canvasArea.classList.remove('search-mode');
}

function detectType(src) {
  const t = src.trim();
  if (t[0] === '<')               return 'xml';
  if (t[0] === '{' || t[0] === '[') return 'json';
  return null;
}

function doParse() {
  _nid = 0;

  // Clear any active search / filter before re-parsing
  searchActive = false;
  activeHighlightPath = null;
  searchInput.value = '';
  searchMeta.style.display = 'none';
  canvasArea.classList.remove('search-mode');
  canvasInner.querySelectorAll('.result-grid, .no-results').forEach(e => e.remove());
  const _eb = document.getElementById('ss-exact-badge');
  if (_eb) _eb.remove();

  const src = inputEl.value.trim();
  if (!src) { setStatus('empty', '—', 'Waiting for input'); showEmpty(); return; }

  const type = detectType(src);
  if (!type) {
    setStatus('error', 'ERR', 'Cannot detect format — must start with < or { / [');
    showEmpty(); return;
  }

  if (type === 'json') {
    try {
      treeRoot = jsonToTree(JSON.parse(src), null, 0);
      setStatus('json', 'JSON', 'Parsed successfully');
      if (appMode === 'flight') renderFlightView();
      else compareMode && treeRootB ? showDiff() : doRender();
    } catch (e) { setStatus('error', 'ERR', e.message); showEmpty(); }
  } else {
    try {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(src, 'application/xml');
      const errEl  = doc.querySelector('parsererror');
      if (errEl) throw new Error(errEl.textContent.split('\n')[0].trim());
      treeRoot = xmlToTree(doc.documentElement, 0);
      setStatus('xml', 'XML', 'Parsed successfully');
      if (appMode === 'flight') renderFlightView();
      else compareMode && treeRootB ? showDiff() : doRender();
    } catch (e) { setStatus('error', 'ERR', e.message); showEmpty(); }
  }
}

// ── Expand / Collapse all ────────────────────────────────────────────────────
function walkAll(n, fn) { fn(n); n.children.forEach(c => walkAll(c, fn)); }

document.getElementById('btn-expand-all').addEventListener('click', () => {
  if (!treeRoot) return;
  walkAll(treeRoot, n => { if (n.children.length) n.collapsed = false; });
  doRender();
});

document.getElementById('btn-collapse-all').addEventListener('click', () => {
  if (!treeRoot) return;
  walkAll(treeRoot, n => { if (n.children.length) n.collapsed = true; });
  treeRoot.collapsed = false; // always keep root open
  doRender();
});

// ── Button events ─────────────────────────────────────────────────────────────
document.getElementById('btn-parse').addEventListener('click', doParse);
document.getElementById('btn-clear').addEventListener('click', () => {
  inputEl.value = '';
  setStatus('empty', '—', 'Waiting for input');
  showEmpty();
});
document.getElementById('btn-json').addEventListener('click', () => { inputEl.value = JSON_SAMPLE; doParse(); });
document.getElementById('btn-xml').addEventListener('click',  () => { inputEl.value = XML_SAMPLE;  doParse(); });

inputEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doParse(); }
});

// ── Search ───────────────────────────────────────────────────────────────────
const searchInput  = document.getElementById('search-input');
const searchMeta   = document.getElementById('search-meta');
const ssCount      = document.getElementById('ss-count');
let   searchActive = false;
let   activeHighlightPath = null;

// ── Priority field scoring ────────────────────────────────────────────────────
const PRIORITY_EXACT = ['id','_id','uuid','guid','no','number','num','code','name','title',
                        'status','state','type','kind','ref','key','label','description'];

function fieldPriority(key) {
  const k = String(key).toLowerCase();
  const idx = PRIORITY_EXACT.indexOf(k);
  if (idx !== -1) return idx;
  if (k.endsWith('id') || k.endsWith('_id'))                        return 20;
  if (k.endsWith('name') || k.endsWith('code') || k.endsWith('no')) return 22;
  if (k.endsWith('status') || k.endsWith('type') || k.endsWith('number')) return 24;
  if (k.includes('id') || k.includes('name') || k.includes('code')) return 28;
  return 999;
}

function sortForCard(children) {
  return [...children].sort((a, b) => {
    const pa = fieldPriority(String(a.key ?? ''));
    const pb = fieldPriority(String(b.key ?? ''));
    if (pa !== pb) return pa - pb;
    // At same priority: leaves before complex nodes
    const la = (!a.children || !a.children.length || a._leaf) ? 0 : 1;
    const lb = (!b.children || !b.children.length || b._leaf) ? 0 : 1;
    return la - lb;
  });
}

// ── Sync expand across all cards ─────────────────────────────────────────────
function syncExpand(keypath, open) {
  const escaped = keypath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  document.querySelectorAll(`.rc-row-wrap[data-keypath="${escaped}"]`).forEach(wrap => {
    const nested = wrap.querySelector(':scope > .rc-nested');
    const chev   = wrap.querySelector(':scope > .rc-row > .rc-row-chev');
    const v      = wrap.querySelector(':scope > .rc-row > .rc-v');
    if (!nested) return;
    nested.classList.toggle('open', open);
    if (chev) chev.classList.toggle('open', open);
    if (v) {
      const type = wrap.dataset.nodetype;
      const cnt  = parseInt(wrap.dataset.nodecount || '0', 10);
      if (open) {
        v.textContent = '';
      } else {
        v.textContent = type === 'array'
          ? `[ ${cnt} ${cnt === 1 ? 'item' : 'items'} ]`
          : `{ ${cnt} ${type === 'object' ? (cnt === 1 ? 'key' : 'keys') : 'children'} }`;
      }
    }
  });
}

// ── Sync highlight across all cards ──────────────────────────────────────────
function syncHighlight(keypath) {
  const clearAll = () => {
    document.querySelectorAll('.row-highlight').forEach(el => el.classList.remove('row-highlight'));
    document.querySelectorAll('.col-highlight').forEach(el => el.classList.remove('col-highlight'));
  };
  // Toggle off if clicking the same path
  if (activeHighlightPath === keypath) {
    clearAll();
    activeHighlightPath = null;
    return;
  }
  clearAll();
  activeHighlightPath = keypath;
  const escaped = keypath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  document.querySelectorAll(`.rc-row-wrap[data-keypath="${escaped}"]`).forEach(wrap => {
    const row = wrap.querySelector(':scope > .rc-row');
    if (row) row.classList.add('row-highlight');
    const v = row && row.querySelector('.rc-v');
    if (v) v.classList.add('col-highlight');
  });
}

function doSearch(query, exact) {
  exact = !!exact;
  const q = query.trim().toLowerCase();
  if (!q) { exitSearch(); return; }
  if (!treeRoot) return;

  // Walk entire tree, collecting key/value matches with ancestor chain + path strings
  const matched = [];
  function walk(n, ancestors, parts) {
    const k = (n.key !== null && n.key !== undefined) ? String(n.key).toLowerCase() : '';
    const v = (n.value !== null && n.value !== undefined) ? String(n.value).toLowerCase() : '';
    const keyHit = exact ? (k === q) : (k && (k === q || k.includes(q)));
    const valHit = !exact && v && v.includes(q);
    if (keyHit || valHit) {
      const matchKind = keyHit && valHit ? 'both' : keyHit ? 'key' : 'value';
      matched.push({ node: n, ancestors: [...ancestors], pathParts: [...parts], matchKind });
    }
    n.children.forEach(child => {
      const seg = child.key !== null && child.key !== undefined
        ? (typeof child.key === 'number' ? `[${child.key}]` : String(child.key))
        : (child.type === 'element' ? String(child.key || child.type) : child.type);
      walk(child, [...ancestors, n], [...parts, seg]);
    });
  }
  const rootSeg = treeRoot.key !== null && treeRoot.key !== undefined ? String(treeRoot.key) : treeRoot.type;
  walk(treeRoot, [], [rootSeg]);

  // Expand arrays into individual items; keep objects/leaves as-is
  const items = [];
  matched.forEach(({ node: n, ancestors, pathParts, matchKind }) => {
    if (n.type === 'array' && n.children.length) {
      n.children.forEach((child, idx) => items.push({
        node: child, parentKey: String(n.key), idx,
        ancestors: [...ancestors, n], pathParts: [...pathParts, `[${idx}]`], matchKind
      }));
    } else {
      items.push({ node: n, parentKey: null, idx: null, ancestors, pathParts, matchKind });
    }
  });

  renderSearchResults(items, query, exact);
}

function renderSearchResults(items, query, exact) {
  searchActive = true;
  canvasArea.classList.add('search-mode');

  // Clear tree view
  canvasInner.querySelectorAll('.fcard, .result-grid, .no-results').forEach(e => e.remove());
  svgEl.innerHTML = '';
  emptyState.style.display = 'none';
  canvasInner.style.width  = '';
  canvasInner.style.height = '';

  // Update count badge
  searchMeta.style.display = 'flex';
  const exactBadgeId = 'ss-exact-badge';
  let existingBadge = document.getElementById(exactBadgeId);
  if (exact) {
    if (!existingBadge) {
      const b = document.createElement('span');
      b.id = exactBadgeId;
      b.style.cssText = 'font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 7px;border-radius:99px;background:rgba(139,92,246,.12);color:#8b5cf6;border:1px solid rgba(139,92,246,.25);flex-shrink:0;';
      b.textContent = 'exact';
      ssCount.after(b);
    }
  } else {
    if (existingBadge) existingBadge.remove();
  }
  ssCount.textContent = `${items.length} result${items.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    const msg = document.createElement('div');
    msg.className = 'no-results';
    msg.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>No nodes found for "<strong>${esc(query)}</strong>"</span>`;
    canvasInner.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'result-grid';
  items.forEach((item, i) => {
    const card = buildResultCard(item);
    card.style.animationDelay = Math.min(i * 30, 300) + 'ms';
    grid.appendChild(card);
  });
  canvasInner.appendChild(grid);
}

function buildResultCard(item) {
  const { node, parentKey, idx, ancestors = [], pathParts = [], matchKind = 'key' } = item;
  const color = tc(node.type);

  const card = document.createElement('div');
  card.className = 'result-card';
  card.style.setProperty('--c', color);

  // ── Header (click to collapse card) ──────
  const header = document.createElement('div');
  header.className = 'rc-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'rc-name';
  const displayName = parentKey
    ? parentKey
    : (node.key !== null && node.key !== undefined ? String(node.key) : node.type);
  nameEl.textContent = displayName;
  nameEl.title = 'Click to filter exact matches for "' + displayName + '"';
  nameEl.addEventListener('click', e => {
    e.stopPropagation(); // don't collapse the card
    searchInput.value = displayName;
    doSearch(displayName, true);
  });
  header.appendChild(nameEl);

  if (idx !== null) {
    const idxEl = document.createElement('span');
    idxEl.className = 'rc-idx';
    idxEl.textContent = `[${idx}]`;
    header.appendChild(idxEl);
  }

  const badge = document.createElement('span');
  badge.className = `fbadge ${T_BADGE[node.type] || 'tb-txt'}`;
  badge.textContent = T_LABEL[node.type] || node.type;
  header.appendChild(badge);

  if (matchKind !== 'key') {
    const valBadge = document.createElement('span');
    valBadge.className = 'rc-val-badge';
    valBadge.textContent = matchKind === 'both' ? 'key+val' : 'val';
    header.appendChild(valBadge);
  }

  // Bookmark star button
  const _rcBmBtn = _bmStarBtn('fc-bm', bmKey(pathParts));
  _rcBmBtn.addEventListener('click', e => {
    e.stopPropagation();
    _bmHandleClick(_rcBmBtn, _bmNodeObj(node, pathParts));
  });
  header.appendChild(_rcBmBtn);

  const cardChev = document.createElement('span');
  cardChev.className = 'rc-card-chev';
  cardChev.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  header.appendChild(cardChev);

  card.appendChild(header);

  // ── Path bar ──────────────────────────────
  if (pathParts.length) {
    const pathBar  = document.createElement('div');
    pathBar.className = 'rc-path';

    const pathText = document.createElement('span');
    pathText.className = 'rc-path-text';
    pathText.textContent = pathParts.join(' › ');
    pathText.title = pathParts.join(' > ');
    pathBar.appendChild(pathText);

    // Copy path button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'rc-path-btn';
    copyBtn.title = 'Copy path';
    copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(pathParts.join(' > ')).then(() => {
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 1400);
      });
    });
    pathBar.appendChild(copyBtn);

    // Navigate-to-node button
    const navBtn = document.createElement('button');
    navBtn.className = 'rc-path-btn nav';
    navBtn.title = 'Go to node in tree / graph view';
    navBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    navBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigateToNode(node, ancestors);
    });
    pathBar.appendChild(navBtn);

    card.appendChild(pathBar);
  }

  // ── Body (animated collapse) ──────────────
  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'rc-body-wrap';

  const body = document.createElement('div');
  body.className = 'rc-body';

  const isRecord = (node.type === 'object' || (node.type === 'element' && !node._leaf)) && node.children.length;

  if (isRecord) {
    const sorted  = sortForCard(node.children);
    const pinned  = sorted.filter(c => fieldPriority(String(c.key ?? '')) < 999);
    const regular = sorted.filter(c => fieldPriority(String(c.key ?? '')) >= 999);
    pinned.forEach(child => body.appendChild(buildExpandableRow(child, 0, '')));
    if (pinned.length && regular.length) {
      const divider = document.createElement('div');
      divider.className = 'rc-section-sep';
      body.appendChild(divider);
    }
    regular.forEach(child => body.appendChild(buildExpandableRow(child, 0, '')));
  } else if (node.type === 'array' && node.children.length) {
    node.children.forEach((child, i) => {
      const keyed = Object.assign(Object.create(Object.getPrototypeOf(child)), child, { key: i });
      body.appendChild(buildExpandableRow(keyed, 0, ''));
    });
  } else {
    // Plain leaf card
    const row = document.createElement('div');
    row.className = 'rc-row';
    const indent = document.createElement('span');
    indent.className = 'rc-row-indent';
    const k = document.createElement('span');
    k.className = 'rc-k';
    k.textContent = node.key !== null && node.key !== undefined ? String(node.key) : 'value';
    const sep = document.createElement('span');
    sep.className = 'rc-sep';
    sep.textContent = ':';
    row.appendChild(indent);
    row.appendChild(k);
    row.appendChild(sep);
    const _lv = leafValueEl(node);
    if (matchKind !== 'key') _lv.classList.add('rc-v-match');
    row.appendChild(_lv);
    if (node.type === 'element' && node._attrs && node._attrs.length) {
      appendAttrs(row, node._attrs);
    }
    body.appendChild(row);
  }

  bodyWrap.appendChild(body);
  card.appendChild(bodyWrap);

  // Card collapse toggle
  let collapsed = false;
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    bodyWrap.classList.toggle('collapsed', collapsed);
    cardChev.classList.toggle('collapsed', collapsed);
  });

  return card;
}

// Builds a single row — expandable if the child has nested children.
// keyPath is the dotted path from the card root (e.g. "address.city").
function buildExpandableRow(child, depth, keyPath) {
  const wrap = document.createElement('div');
  wrap.className = 'rc-row-wrap';

  const hasKids    = !child._leaf && child.children && child.children.length > 0;
  const indentLeft = 14 + depth * 18;
  const keyLabel   = child.key !== null && child.key !== undefined ? String(child.key) : child.type;
  const currentPath = keyPath ? keyPath + '.' + keyLabel : keyLabel;

  wrap.dataset.keypath = currentPath;

  const row = document.createElement('div');
  row.className = 'rc-row' + (hasKids ? ' has-children' : '');
  row.style.paddingLeft = indentLeft + 'px';

  if (hasKids) {
    wrap.dataset.nodetype  = child.type;
    wrap.dataset.nodecount = String(child.children.length);

    const chev = document.createElement('span');
    chev.className = 'rc-row-chev';
    chev.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    const k = document.createElement('span');
    k.className = 'rc-k';
    k.textContent = keyLabel;
    k.title = keyLabel;

    const sep = document.createElement('span');
    sep.className = 'rc-sep';
    sep.textContent = ':';

    const cnt = child.children.length;
    const v = document.createElement('span');
    v.className = 'rc-v';
    if (child.type === 'array') {
      v.classList.add('rv-arr');
      v.textContent = `[ ${cnt} ${cnt === 1 ? 'item' : 'items'} ]`;
    } else {
      v.classList.add('rv-obj');
      v.textContent = `{ ${cnt} ${child.type === 'object' ? (cnt === 1 ? 'key' : 'keys') : 'children'} }`;
    }

    row.appendChild(chev);
    row.appendChild(k);
    row.appendChild(sep);
    row.appendChild(v);

    // Nested section
    const nested = document.createElement('div');
    nested.className = 'rc-nested';
    const nestedInner = document.createElement('div');
    nestedInner.className = 'rc-nested-inner';

    const isArr = child.type === 'array';
    const sortedKids = isArr ? child.children : sortForCard(child.children);
    sortedKids.forEach((gc, gi) => {
      const keyed = isArr ? Object.assign(Object.create(Object.getPrototypeOf(gc)), gc, { key: gi }) : gc;
      nestedInner.appendChild(buildExpandableRow(keyed, depth + 1, currentPath));
    });

    nested.appendChild(nestedInner);

    // Click row → sync expand/collapse across ALL cards with same keypath
    row.addEventListener('click', () => {
      const willOpen = !nested.classList.contains('open');
      syncExpand(currentPath, willOpen);
    });

    wrap.appendChild(row);
    wrap.appendChild(nested);
  } else {
    // Leaf row
    const indent = document.createElement('span');
    indent.className = 'rc-row-indent';

    const k = document.createElement('span');
    k.className = 'rc-k';
    k.textContent = keyLabel;
    k.title = keyLabel;

    const sep = document.createElement('span');
    sep.className = 'rc-sep';
    sep.textContent = ':';

    const valEl = leafValueEl(child);
    valEl.style.cursor = 'pointer';
    valEl.title = 'Click to highlight across all cards';
    // Click value → sync highlight across ALL cards with same keypath
    valEl.addEventListener('click', e => {
      e.stopPropagation();
      syncHighlight(currentPath);
    });

    row.appendChild(indent);
    row.appendChild(k);
    row.appendChild(sep);
    row.appendChild(valEl);
    if (child.type === 'element' && child._attrs && child._attrs.length) {
      appendAttrs(row, child._attrs);
    }
    wrap.appendChild(row);
  }

  return wrap;
}

function leafValueEl(n) {
  const v = document.createElement('span');
  v.className = 'rc-v';
  switch (n.type) {
    case 'string':  v.classList.add('rv-str');  v.textContent = `"${String(n.value ?? '')}"`; break;
    case 'number':  v.classList.add('rv-num');  v.textContent = String(n.value);               break;
    case 'boolean': v.classList.add('rv-bool'); v.textContent = String(n.value);               break;
    case 'null':    v.classList.add('rv-null'); v.textContent = 'null';                        break;
    case 'element': v.classList.add('rv-xml');  v.textContent = String(n.value ?? '');         break;
    case 'text':    v.classList.add('rv-str');  v.textContent = String(n.value ?? '');         break;
    case 'comment': v.classList.add('rv-obj');  v.textContent = `<!-- ${String(n.value)} -->`; break;
    default:        v.textContent = String(n.value ?? '');
  }
  return v;
}

// ── Diff navigation ────────────────────────────────────────────────────────────
function updateDiffNav() {
  const prevBtn = diffView.querySelector('#diff-nav-prev');
  const nextBtn = diffView.querySelector('#diff-nav-next');
  const posEl   = diffView.querySelector('#diff-nav-pos');
  if (diffViewMode !== 'table' || !diffScrollEl) {
    diffNavRows = []; diffNavIdx = -1;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (posEl)   posEl.textContent = '—';
    return;
  }
  // Collect all visible leaf rows (non-group)
  diffNavRows = [...diffScrollEl.querySelectorAll('.diff-row:not(.is-grp)')];
  diffNavIdx  = -1;
  const has = diffNavRows.length > 0;
  if (prevBtn) prevBtn.disabled = !has;
  if (nextBtn) nextBtn.disabled = !has;
  if (posEl)   posEl.textContent = has ? `0 / ${diffNavRows.length}` : '—';
}

function navigateDiff(dir) {
  if (!diffNavRows.length) return;
  if (diffNavIdx >= 0 && diffNavRows[diffNavIdx]) diffNavRows[diffNavIdx].classList.remove('diff-nav-cur');
  diffNavIdx = (diffNavIdx + dir + diffNavRows.length) % diffNavRows.length;
  const row = diffNavRows[diffNavIdx];
  row.classList.add('diff-nav-cur');
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const posEl = diffView.querySelector('#diff-nav-pos');
  if (posEl) posEl.textContent = `${diffNavIdx + 1} / ${diffNavRows.length}`;
}

// ── View a node from the diff in tree/graph viewer ─────────────────────────────
function viewInDoc(originalNode, origRoot, docLabel) {
  // Find all ancestors of the target node
  function findAnc(n, targetId, ancs) {
    if (n.id === targetId) return ancs;
    for (const c of (n.children || [])) {
      const r = findAnc(c, targetId, [...ancs, n]);
      if (r !== null) return r;
    }
    return null;
  }
  const ancestors = findAnc(origRoot, originalNode.id, []) || [];
  ancestors.forEach(n => { if (n.children && n.children.length) n.collapsed = false; });

  // Set the render root so doRender() draws the correct tree
  activeRenderRoot = origRoot;

  // Hide diff view, show canvas
  diffView.classList.remove('active');
  diffView.innerHTML = '';
  canvasArea.style.display   = '';
  searchStrip.style.display  = '';

  // Render and show the return banner
  doRender();
  showDiffReturnBanner(docLabel);

  // Scroll to + pulse the node
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = canvasInner.querySelector(`[data-nid="${originalNode.id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('nav-highlight');
    setTimeout(() => el.classList.remove('nav-highlight'), 1900);
  }));
}

function showDiffReturnBanner(docLabel) {
  const existing = document.getElementById('diff-return-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id        = 'diff-return-banner';
  banner.className = 'diff-return-banner';
  banner.innerHTML = `
    <span class="drb-label">Viewing Doc <strong>${docLabel}</strong></span>
    <button class="drb-back" id="drb-back-btn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Back to Compare
    </button>`;
  banner.querySelector('#drb-back-btn').addEventListener('click', () => {
    activeRenderRoot = null;
    banner.remove();
    showDiff();
  });
  canvasArea.insertBefore(banner, canvasArea.firstChild);
}

function exitSearch() {
  searchActive = false;
  activeHighlightPath = null;
  canvasArea.classList.remove('search-mode');
  searchMeta.style.display = 'none';
  const eb = document.getElementById('ss-exact-badge');
  if (eb) eb.remove();
  document.querySelectorAll('.row-highlight').forEach(el => el.classList.remove('row-highlight'));
  document.querySelectorAll('.col-highlight').forEach(el => el.classList.remove('col-highlight'));
  canvasInner.querySelectorAll('.result-grid, .no-results').forEach(e => e.remove());
  if (treeRoot) doRender();
}

// Navigate to a specific node — expand ancestors, re-render, scroll + pulse-highlight
function navigateToNode(targetNode, ancestors) {
  // Expand every ancestor so the node is visible
  ancestors.forEach(n => { if (n.children && n.children.length) n.collapsed = false; });

  // Clear search state
  searchActive = false;
  activeHighlightPath = null;
  searchInput.value = '';
  searchMeta.style.display = 'none';
  canvasArea.classList.remove('search-mode');
  canvasInner.querySelectorAll('.result-grid, .no-results').forEach(e => e.remove());
  const _eb = document.getElementById('ss-exact-badge');
  if (_eb) _eb.remove();

  // Re-render the current view
  doRender();

  // After paint: find the rendered element by data-nid and scroll + highlight
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = canvasInner.querySelector(`[data-nid="${targetNode.id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('nav-highlight');
    setTimeout(() => el.classList.remove('nav-highlight'), 1900);
  }));
}

// Search events — typing always does partial match
searchInput.addEventListener('input', () => doSearch(searchInput.value, false));
document.getElementById('btn-search-clear').addEventListener('click', () => {
  searchInput.value = '';
  exitSearch();
});

// ── Comparison / Diff ────────────────────────────────────────────────────────
let treeRootB   = null;
let compareMode = false;

const docBWrap   = document.getElementById('doc-b-wrap');
const inputAreaB = document.getElementById('input-area-b');
const sBadgeB    = document.getElementById('s-badge-b');
const sMsgB      = document.getElementById('s-msg-b');
const diffView   = document.getElementById('diff-view');
const btnCompare = document.getElementById('btn-compare');
const searchStrip = document.querySelector('.search-strip');

function setStatusB(type, badge, msg) {
  sBadgeB.className  = `s-badge ${type}`;
  sBadgeB.textContent = badge;
  sMsgB.textContent  = msg;
}

// ── Diff tree helpers ─────────────────────────────────────────────────────────
function isContainer(n) {
  return n && !n._leaf && n.children && n.children.length > 0;
}

function leafStrDiff(n) {
  if (!n) return '';
  if (n.type === 'null') return 'null';
  return String(n.value ?? '');
}

function containerSummary(n) {
  const cnt = n.children.length;
  return n.type === 'array' ? `[ ${cnt} ${cnt===1?'item':'items'} ]`
                            : `{ ${cnt} ${cnt===1?'key':'keys'} }`;
}

// Detect XML "array" — multiple sibling children with the same tag name
function allSameTag(children) {
  if (children.length < 2) return false;
  const tag = String(children[0].key ?? '').toLowerCase();
  return children.every(c => String(c.key ?? '').toLowerCase() === tag);
}

function diffChildLists(childrenA, childrenB) {
  // Both are XML arrays (repeated tags) → compare by index
  if (allSameTag(childrenA) && allSameTag(childrenB)) {
    const maxLen = Math.max(childrenA.length, childrenB.length);
    return Array.from({ length: maxLen }, (_, i) =>
      makeDiffNode(`[${i}]`, childrenA[i] || null, childrenB[i] || null));
  }

  // Otherwise match children by normalized key name
  const mapA = new Map(), mapB = new Map();
  const orderA = [], orderB = [];

  childrenA.forEach(c => {
    const k = String(c.key ?? c.type).toLowerCase();
    mapA.set(k, c);
    if (!orderA.includes(k)) orderA.push(k);
  });
  childrenB.forEach(c => {
    const k = String(c.key ?? c.type).toLowerCase();
    mapB.set(k, c);
    if (!orderB.includes(k)) orderB.push(k);
  });

  // Merge: A keys first, then B-only keys
  const merged = [...orderA];
  orderB.forEach(k => { if (!merged.includes(k)) merged.push(k); });

  return merged.map(k => makeDiffNode(k, mapA.get(k) || null, mapB.get(k) || null));
}

function makeDiffNode(key, a, b) {
  const displayKey = (a ? String(a.key ?? key) : (b ? String(b.key ?? key) : key));

  if (!a) {
    if (isContainer(b)) {
      return { key: displayKey, status: 'b-only', valueA: null, valueB: containerSummary(b),
               typeA: null, typeB: b.type, children: diffChildLists([], b.children), hasChanges: true, _nodeA: a, _nodeB: b };
    }
    return { key: displayKey, status: 'b-only', valueA: null, valueB: leafStrDiff(b),
             typeA: null, typeB: b.type, children: null, _nodeA: a, _nodeB: b };
  }

  if (!b) {
    if (isContainer(a)) {
      return { key: displayKey, status: 'a-only', valueA: containerSummary(a), valueB: null,
               typeA: a.type, typeB: null, children: diffChildLists(a.children, []), hasChanges: true, _nodeA: a, _nodeB: b };
    }
    return { key: displayKey, status: 'a-only', valueA: leafStrDiff(a), valueB: null,
             typeA: a.type, typeB: null, children: null, _nodeA: a, _nodeB: b };
  }

  const aLeaf = !isContainer(a);
  const bLeaf = !isContainer(b);

  if (aLeaf && bLeaf) {
    const va = leafStrDiff(a), vb = leafStrDiff(b);
    return { key: displayKey, status: va === vb ? 'match' : 'changed',
             valueA: va, valueB: vb, typeA: a.type, typeB: b.type, children: null, _nodeA: a, _nodeB: b };
  }

  // At least one is a container → recurse
  const cA = aLeaf ? [] : a.children;
  const cB = bLeaf ? [] : b.children;
  const children = diffChildLists(cA, cB);
  const hasChanges = children.some(c => c.status !== 'match' || c.hasChanges);
  return { key: displayKey, status: 'container', hasChanges,
           valueA: aLeaf ? leafStrDiff(a) : containerSummary(a),
           valueB: bLeaf ? leafStrDiff(b) : containerSummary(b),
           typeA: a.type, typeB: b.type, children, _nodeA: a, _nodeB: b };
}

function countDiffStats(nodes) {
  let match = 0, changed = 0, aOnly = 0, bOnly = 0;
  function walk(list) {
    list.forEach(n => {
      if (n.status === 'match')        match++;
      else if (n.status === 'changed') changed++;
      else if (n.status === 'a-only')  aOnly++;
      else if (n.status === 'b-only')  bOnly++;
      if (n.children) walk(n.children);
    });
  }
  walk(nodes);
  return { match, changed, aOnly, bOnly };
}

function countLeaves(nodes) {
  let c = 0;
  nodes.forEach(n => { c += n.children ? countLeaves(n.children) : 1; });
  return c;
}

// ── Diff filter logic ─────────────────────────────────────────────────────────
let lastDiffNodes    = [];
let diffScrollEl     = null;
let diffFilterQuery  = '';
let diffNavRows = [];
let diffNavIdx  = -1;
let diffFilterStatus = 'all';
let diffViewMode     = 'table'; // 'table' | 'cards'
let hideMatches      = false;

function leafStatusMatch(node, status) {
  if (hideMatches && node.status === 'match') return false;
  switch (status) {
    case 'all':     return true;
    case 'diff':    return node.status !== 'match';
    case 'match':   return node.status === 'match';
    case 'changed': return node.status === 'changed';
    case 'a-only':  return node.status === 'a-only';
    case 'b-only':  return node.status === 'b-only';
    default:        return true;
  }
}

function containerStatusMatch(node, status) {
  if (hideMatches && !node.hasChanges) return false;
  if (status === 'all')   return true;
  if (status === 'match') return !node.hasChanges;
  return node.hasChanges;
}

function filterDiffNodes(nodes, q, status) {
  return nodes.flatMap(node => {
    const keyMatch   = !q || node.key.toLowerCase().includes(q);
    const hasKids    = node.children && node.children.length > 0;

    if (!hasKids) {
      return (keyMatch && leafStatusMatch(node, status)) ? [node] : [];
    }

    // Container: filter children first
    const filteredKids = filterDiffNodes(node.children, q, status);
    const selfMatch    = keyMatch && containerStatusMatch(node, status);

    if (!selfMatch && filteredKids.length === 0) return [];

    // If self matches with no narrowing filters → show all children
    const kids = (selfMatch && !q && status === 'all') ? node.children : filteredKids;
    return [{ ...node, children: kids }];
  });
}

function applyDiffFilter() {
  if (!diffScrollEl) return;
  const filtered = filterDiffNodes(lastDiffNodes, diffFilterQuery.toLowerCase(), diffFilterStatus);

  if (diffViewMode === 'cards') {
    renderDiffCards(filtered);
  } else {
    diffScrollEl.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'diff-inner';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'diff-empty';
      empty.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>No fields match the current filter</span>`;
      inner.appendChild(empty);
    } else {
      filtered.forEach(n => inner.appendChild(buildDiffRow(n, 0)));
    }

    diffScrollEl.appendChild(inner);
  }

  // Update count badge
  const countEl = diffView.querySelector('.diff-filter-count');
  if (countEl) {
    const total   = countLeaves(lastDiffNodes);
    const visible = countLeaves(filtered);
    countEl.textContent = visible === total
      ? `${total} field${total !== 1 ? 's' : ''}`
      : `${visible} / ${total} fields`;
  }
  updateDiffNav();
}

// ── Render diff ───────────────────────────────────────────────────────────────
function showDiff() {
  if (!treeRoot || !treeRootB) return;

  // Build diff tree (compare children of each root)
  const childrenA = isContainer(treeRoot)  ? treeRoot.children  : [];
  const childrenB = isContainer(treeRootB) ? treeRootB.children : [];
  lastDiffNodes = diffChildLists(childrenA, childrenB);

  // Reset filter state
  diffFilterQuery  = '';
  diffFilterStatus = 'all';
  diffViewMode     = 'table';
  hideMatches      = false;

  diffView.innerHTML = '';
  diffView.classList.add('active');
  canvasArea.style.display  = 'none';
  searchStrip.style.display = 'none';

  const { match, changed, aOnly, bOnly } = countDiffStats(lastDiffNodes);

  // ── Stats bar ──
  const stats = document.createElement('div');
  stats.className = 'diff-stats';
  stats.innerHTML = `<span class="diff-stats-label">Diff</span>
    <span class="dsp dsp-match">✓ ${match} match${match!==1?'es':''}</span>
    ${changed > 0 ? `<span class="dsp dsp-change">≠ ${changed} changed</span>` : ''}
    ${aOnly   > 0 ? `<span class="dsp dsp-a">A ${aOnly} only in A</span>` : ''}
    ${bOnly   > 0 ? `<span class="dsp dsp-b">B ${bOnly} only in B</span>` : ''}
    ${changed===0&&aOnly===0&&bOnly===0 ? '<span style="color:var(--green);font-size:.7rem;font-weight:700;">Identical at this level</span>' : ''}`;
  diffView.appendChild(stats);

  // ── Filter strip ──
  const filterStrip = document.createElement('div');
  filterStrip.className = 'diff-filter-strip';
  filterStrip.innerHTML = `
    <div class="diff-search-field">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);flex-shrink:0">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="diff-search-input" placeholder="Filter by field name…" autocomplete="off" />
    </div>
    <div class="diff-chips">
      <button class="diff-chip active"      data-status="all">All</button>
      <button class="diff-chip chip-diff"   data-status="diff">Differences</button>
      <button class="diff-chip chip-chg"    data-status="changed">Changed</button>
      <button class="diff-chip chip-a"      data-status="a-only">A only</button>
      <button class="diff-chip chip-b"      data-status="b-only">B only</button>
      <button class="diff-chip chip-match"  data-status="match">Match</button>
    </div>
    <button class="diff-hide-eq-btn" id="diff-hide-eq-btn" title="Toggle visibility of equal/matching fields">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      Hide equal
    </button>
    <div class="diff-view-toggle">
      <button class="dvt-btn active" data-view="table" title="Table view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <button class="dvt-btn" data-view="cards" title="Card view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
          <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
        </svg>
      </button>
    </div>
    <div class="diff-nav-strip">
      <button class="diff-nav-btn" id="diff-nav-prev" disabled title="Previous item">&#8249;</button>
      <span class="diff-nav-pos" id="diff-nav-pos">—</span>
      <button class="diff-nav-btn" id="diff-nav-next" disabled title="Next item">&#8250;</button>
    </div>
    <span class="diff-filter-count"></span>`;
  diffView.appendChild(filterStrip);

  // Wire filter strip events
  const diffSearchInput = filterStrip.querySelector('#diff-search-input');
  diffSearchInput.addEventListener('input', () => {
    diffFilterQuery = diffSearchInput.value;
    applyDiffFilter();
  });
  filterStrip.querySelectorAll('.diff-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterStrip.querySelectorAll('.diff-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      diffFilterStatus = chip.dataset.status;
      applyDiffFilter();
    });
  });

  filterStrip.querySelectorAll('.dvt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterStrip.querySelectorAll('.dvt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      diffViewMode = btn.dataset.view;
      applyDiffFilter();
    });
  });

  filterStrip.querySelector('#diff-nav-prev').addEventListener('click', () => navigateDiff(-1));
  filterStrip.querySelector('#diff-nav-next').addEventListener('click', () => navigateDiff(1));

  const hideEqBtn = filterStrip.querySelector('#diff-hide-eq-btn');
  hideEqBtn.addEventListener('click', () => {
    hideMatches = !hideMatches;
    hideEqBtn.classList.toggle('active', hideMatches);
    // If "Match" chip was active, switch back to "All" since there's nothing to show
    if (hideMatches && diffFilterStatus === 'match') {
      filterStrip.querySelectorAll('.diff-chip').forEach(c => c.classList.remove('active'));
      filterStrip.querySelector('.diff-chip[data-status="all"]').classList.add('active');
      diffFilterStatus = 'all';
    }
    hideEqBtn.querySelector('svg').outerHTML; // no-op, just reference
    hideEqBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${hideMatches
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}
      </svg>
      ${hideMatches ? 'Show equal' : 'Hide equal'}`;
    applyDiffFilter();
  });

  // ── Column headers ──
  const hdr = document.createElement('div');
  hdr.className = 'diff-header';
  hdr.innerHTML = `
    <div class="diff-hcell">Field</div>
    <div class="diff-hcell diff-ha"><span class="diff-badge-a">A</span>
      ${treeRoot.key !== null && treeRoot.key !== undefined ? String(treeRoot.key) : 'Doc A'}</div>
    <div class="diff-hcell diff-hb"><span class="diff-badge-b">B</span>
      ${treeRootB.key !== null && treeRootB.key !== undefined ? String(treeRootB.key) : 'Doc B'}</div>
    <div class="diff-hcell"></div>`;
  diffView.appendChild(hdr);

  // ── Scrollable rows ──
  const scroll = document.createElement('div');
  scroll.className = 'diff-scroll';
  diffScrollEl = scroll;

  if (!lastDiffNodes.length) {
    const empty = document.createElement('div');
    empty.className = 'diff-empty';
    empty.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted)"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18"/></svg><span>Nothing to compare — both documents appear empty at root level</span>`;
    scroll.appendChild(empty);
    diffView.appendChild(scroll);
    return;
  }

  diffView.appendChild(scroll);

  // Initial render via applyDiffFilter (renders all nodes, updates count badge)
  applyDiffFilter();
}

function buildDiffRow(entry, depth) {
  const wrapper = document.createElement('div');
  const indentLeft = 12 + depth * 20;
  const hasChildren = entry.children && entry.children.length > 0;

  // Row
  const row = document.createElement('div');
  const cls = ['diff-row'];
  if (hasChildren)              cls.push('is-grp');
  if (entry.status === 'changed') cls.push('is-changed');
  if (entry.status === 'a-only')  cls.push('is-aonly');
  if (entry.status === 'b-only')  cls.push('is-bonly');
  if (entry.status === 'container' && entry.hasChanges) cls.push('has-diff');
  row.className = cls.join(' ');

  // Field cell
  const field = document.createElement('div');
  field.className = 'diff-field';
  field.style.paddingLeft = indentLeft + 'px';

  let chev = null;
  if (hasChildren) {
    chev = document.createElement('span');
    chev.className = 'diff-chev';
    chev.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    field.appendChild(chev);
  } else {
    const sp = document.createElement('span');
    sp.className = 'diff-row-indent';
    field.appendChild(sp);
  }

  const keyEl = document.createElement('span');
  keyEl.className = 'diff-key';
  keyEl.textContent = entry.key;
  keyEl.title = entry.key;
  field.appendChild(keyEl);

  // View-in-doc button — lives in the field cell, shown on row hover only
  if (!hasChildren && (entry.status === 'a-only' || entry.status === 'b-only')) {
    const viewBtn = document.createElement('button');
    viewBtn.className = 'diff-view-doc-btn';
    viewBtn.title = entry.status === 'a-only' ? 'Open in Doc A viewer' : 'Open in Doc B viewer';
    viewBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>${entry.status === 'a-only' ? 'A' : 'B'}`;
    viewBtn.addEventListener('click', e => {
      e.stopPropagation();
      const origNode = entry.status === 'a-only' ? entry._nodeA : entry._nodeB;
      const origRoot = entry.status === 'a-only' ? treeRoot     : treeRootB;
      if (origNode && origRoot) viewInDoc(origNode, origRoot, entry.status === 'a-only' ? 'A' : 'B');
    });
    field.appendChild(viewBtn);
  }

  row.appendChild(field);

  // Value A cell
  const cellA = document.createElement('div');
  cellA.className = 'diff-cell';
  if (entry.valueA !== null && entry.valueA !== undefined) {
    cellA.appendChild(diffValEl(entry.valueA, entry.typeA));
  } else {
    const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; cellA.appendChild(m);
  }
  row.appendChild(cellA);

  // Value B cell
  const cellB = document.createElement('div');
  cellB.className = 'diff-cell';
  if (entry.valueB !== null && entry.valueB !== undefined) {
    cellB.appendChild(diffValEl(entry.valueB, entry.typeB));
  } else {
    const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; cellB.appendChild(m);
  }
  row.appendChild(cellB);

  // Status cell
  const statEl = document.createElement('div');
  statEl.className = 'diff-status';
  switch (entry.status) {
    case 'match':
      statEl.innerHTML = `<span class="si-match" title="Values match">✓</span>`; break;
    case 'changed':
      statEl.innerHTML = `<span class="si-change" title="Values differ">≠</span>`; break;
    case 'a-only':
      statEl.innerHTML = `<span class="si-a" title="Only in Doc A">A</span>`; break;
    case 'b-only':
      statEl.innerHTML = `<span class="si-b" title="Only in Doc B">B</span>`; break;
    case 'container':
      statEl.innerHTML = entry.hasChanges
        ? `<span class="si-mix" title="Contains differences">◈</span>`
        : `<span class="si-match" title="No differences inside">◇</span>`; break;
  }
  row.appendChild(statEl);
  wrapper.appendChild(row);

  // Collapsible children
  if (hasChildren) {
    const childWrap  = document.createElement('div');
    childWrap.className = 'diff-children';
    const childInner = document.createElement('div');
    childInner.className = 'diff-children-inner';
    entry.children.forEach(c => childInner.appendChild(buildDiffRow(c, depth + 1)));
    childWrap.appendChild(childInner);

    // Auto-open top level and nodes with diffs
    let open = depth < 1 || entry.hasChanges;
    if (open) { childWrap.classList.add('open'); if (chev) chev.classList.add('open'); }

    row.addEventListener('click', () => {
      open = !open;
      childWrap.classList.toggle('open', open);
      if (chev) chev.classList.toggle('open', open);
    });

    wrapper.appendChild(childWrap);
  }

  return wrapper;
}

function diffValEl(val, type) {
  const el = document.createElement('span');
  switch (type) {
    case 'string':  el.className = 'dv-str';  el.textContent = `"${val}"`; break;
    case 'number':  el.className = 'dv-num';  el.textContent = val; break;
    case 'boolean': el.className = 'dv-bool'; el.textContent = val; break;
    case 'null':    el.className = 'dv-null'; el.textContent = 'null'; break;
    case 'element': el.className = 'dv-xml';  el.textContent = val; break;
    case 'object': case 'array':
                    el.className = 'dv-cnt';  el.textContent = val; break;
    default:        el.textContent = String(val);
  }
  return el;
}

// ── Diff card view ────────────────────────────────────────────────────────────
function renderDiffCards(filtered) {
  diffScrollEl.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'diff-empty';
    empty.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>No fields match the current filter</span>`;
    diffScrollEl.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'diff-card-grid';
  filtered.forEach((entry, i) => {
    const card = buildDiffCard(entry);
    card.style.animationDelay = Math.min(i * 20, 250) + 'ms';
    grid.appendChild(card);
  });
  diffScrollEl.appendChild(grid);
}

function buildDiffCard(entry) {
  const STATUS_COLOR = {
    match:     '#34d399',
    changed:   '#f59e0b',
    'a-only':  '#f87171',
    'b-only':  '#22d3ee',
    container: entry.hasChanges ? '#8b5cf6' : '#34d399',
  };
  const color = STATUS_COLOR[entry.status] || '#4f8eff';

  const card = document.createElement('div');
  card.className = 'diff-card';
  card.style.setProperty('--dc', color);

  // Header
  const header = document.createElement('div');
  header.className = 'dc-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'dc-title';
  titleEl.textContent = entry.key;
  titleEl.title = entry.key;
  header.appendChild(titleEl);

  if (entry.typeA) {
    const bA = document.createElement('span');
    bA.className = `fbadge ${T_BADGE[entry.typeA] || 'tb-txt'}`;
    bA.textContent = 'A:' + (T_LABEL[entry.typeA] || entry.typeA);
    header.appendChild(bA);
  }
  if (entry.typeB) {
    const bB = document.createElement('span');
    bB.className = `fbadge ${T_BADGE[entry.typeB] || 'tb-txt'}`;
    bB.textContent = 'B:' + (T_LABEL[entry.typeB] || entry.typeB);
    header.appendChild(bB);
  }

  const statEl = document.createElement('span');
  statEl.className = 'dc-stat';
  switch (entry.status) {
    case 'match':     statEl.innerHTML = `<span class="si-match">✓</span>`; break;
    case 'changed':   statEl.innerHTML = `<span class="si-change">≠</span>`; break;
    case 'a-only':    statEl.innerHTML = `<span class="si-a">A</span>`; break;
    case 'b-only':    statEl.innerHTML = `<span class="si-b">B</span>`; break;
    case 'container': statEl.innerHTML = entry.hasChanges
      ? `<span class="si-mix">◈</span>` : `<span class="si-match">◇</span>`; break;
  }
  header.appendChild(statEl);
  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'dc-body';

  const hasKids = entry.children && entry.children.length > 0;

  if (hasKids) {
    // Column sub-header
    const colHdr = document.createElement('div');
    colHdr.className = 'dc-col-hdr';
    colHdr.innerHTML = `<span>Field</span><span class="lbl-a">Doc A</span><span class="lbl-b">Doc B</span><span></span>`;
    body.appendChild(colHdr);

    const MAX = 8;
    entry.children.slice(0, MAX).forEach(child => body.appendChild(buildDiffCardRow(child)));

    if (entry.children.length > MAX) {
      const more = document.createElement('div');
      more.className = 'dc-more';
      more.textContent = `+ ${entry.children.length - MAX} more…`;
      body.appendChild(more);
    }
  } else {
    body.appendChild(buildDiffCardLeaf(entry));
  }

  card.appendChild(body);
  return card;
}

function buildDiffCardRow(child, depth) {
  depth = depth || 0;
  const MAX_DEPTH = 2;
  const MAX_KIDS  = 5;
  const indentPx  = 12 + depth * 14;
  const hasKids   = child.children && child.children.length > 0;

  const wrap = document.createElement('div');

  // Status modifier class
  const statusCls = child.status === 'changed' ? 'dc-changed'
                  : child.status === 'a-only'  ? 'dc-aonly'
                  : child.status === 'b-only'  ? 'dc-bonly' : '';

  // Reusable status icon builder
  function statEl() {
    const s = document.createElement('span');
    s.className = 'dc-row-stat';
    switch (child.status) {
      case 'match':     s.innerHTML = `<span class="si-match" title="Match">✓</span>`; break;
      case 'changed':   s.innerHTML = `<span class="si-change" title="Changed">≠</span>`; break;
      case 'a-only':    s.innerHTML = `<span class="si-a" title="A only">A</span>`; break;
      case 'b-only':    s.innerHTML = `<span class="si-b" title="B only">B</span>`; break;
      case 'container': s.innerHTML = child.hasChanges
        ? `<span class="si-mix">◈</span>` : `<span class="si-match">◇</span>`; break;
    }
    return s;
  }

  if (hasKids && depth < MAX_DEPTH) {
    // ── Container: show section header row, then recurse into children ──
    const row = document.createElement('div');
    row.className = 'dc-row dc-row-section' + (statusCls ? ' ' + statusCls : '');
    row.style.paddingLeft = indentPx + 'px';

    const k = document.createElement('span');
    k.className = 'dc-rkey dc-section-key';
    k.textContent = child.key;
    k.title = child.key;

    // blank A/B cols — values live in the children rows
    const va = document.createElement('span'); va.className = 'dc-va';
    const vb = document.createElement('span'); vb.className = 'dc-vb';

    row.appendChild(k);
    row.appendChild(va);
    row.appendChild(vb);
    row.appendChild(statEl());
    wrap.appendChild(row);

    // Recurse into children
    child.children.slice(0, MAX_KIDS).forEach(gc => {
      wrap.appendChild(buildDiffCardRow(gc, depth + 1));
    });
    if (child.children.length > MAX_KIDS) {
      const more = document.createElement('div');
      more.className = 'dc-more';
      more.style.paddingLeft = (indentPx + 14) + 'px';
      more.textContent = `+ ${child.children.length - MAX_KIDS} more…`;
      wrap.appendChild(more);
    }
  } else {
    // ── Leaf (or max depth): show actual A/B values ──
    const row = document.createElement('div');
    row.className = 'dc-row' + (statusCls ? ' ' + statusCls : '');
    row.style.paddingLeft = indentPx + 'px';

    const k = document.createElement('span');
    k.className = 'dc-rkey';
    k.textContent = child.key;
    k.title = child.key;

    const va = document.createElement('span');
    va.className = 'dc-va';
    if (child.valueA !== null && child.valueA !== undefined) {
      va.appendChild(diffValEl(String(child.valueA), child.typeA));
    } else {
      const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; va.appendChild(m);
    }

    const vb = document.createElement('span');
    vb.className = 'dc-vb';
    if (child.valueB !== null && child.valueB !== undefined) {
      vb.appendChild(diffValEl(String(child.valueB), child.typeB));
    } else {
      const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; vb.appendChild(m);
    }

    row.appendChild(k);
    row.appendChild(va);
    row.appendChild(vb);
    row.appendChild(statEl());
    wrap.appendChild(row);
  }

  return wrap;
}

function buildDiffCardLeaf(entry) {
  const wrap = document.createElement('div');
  wrap.className = 'dc-leaf';

  const aLabel = document.createElement('span');
  aLabel.className = 'dc-side-label dc-a-label';
  aLabel.textContent = 'A';

  const aVal = document.createElement('span');
  aVal.className = 'dc-va';
  if (entry.valueA !== null && entry.valueA !== undefined) {
    aVal.appendChild(diffValEl(String(entry.valueA), entry.typeA));
  } else {
    const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; aVal.appendChild(m);
  }

  const bLabel = document.createElement('span');
  bLabel.className = 'dc-side-label dc-b-label';
  bLabel.textContent = 'B';

  const bVal = document.createElement('span');
  bVal.className = 'dc-vb';
  if (entry.valueB !== null && entry.valueB !== undefined) {
    bVal.appendChild(diffValEl(String(entry.valueB), entry.typeB));
  } else {
    const m = document.createElement('span'); m.className = 'dv-miss'; m.textContent = '—'; bVal.appendChild(m);
  }

  wrap.appendChild(aLabel);
  wrap.appendChild(aVal);
  wrap.appendChild(bLabel);
  wrap.appendChild(bVal);
  return wrap;
}

function exitCompare() {
  compareMode      = false;
  treeRootB        = null;
  lastDiffNodes    = [];
  diffScrollEl     = null;
  diffFilterQuery  = '';
  diffFilterStatus = 'all';
  docBWrap.classList.remove('visible');
  diffView.classList.remove('active');
  diffView.innerHTML = '';
  canvasArea.style.display  = '';
  searchStrip.style.display = '';
  btnCompare.classList.remove('compare-on');
  inputAreaB.value = '';
  setStatusB('empty', '—', 'Waiting for input');
}

// ── Flight view extraction helpers ───────────────────────────────────────────

// Runtime config — starts as FV_TAG_CONFIG defaults, overridden by localStorage
let fvConfig = JSON.parse(JSON.stringify(FV_TAG_CONFIG));
(function () {
  try {
    const saved = localStorage.getItem('parser-fv-config');
    if (saved) Object.assign(fvConfig, JSON.parse(saved));
  } catch {}
})();

// Resolve one pattern: 'Parent/Child' → nested path, 'FlatTag' → direct tag text
function fvTry(root, patterns) {
  for (const p of (patterns || [])) {
    const result = p.includes('/')
      ? fvPath(root, ...p.split('/'))
      : fvText(root, p);
    if (result) return result;
  }
  return null;
}

// Find first non-empty text from a list of tag names
function fvText(root, ...tags) {
  for (const tag of tags) {
    const els = root.getElementsByTagName(tag);
    for (let i = 0; i < els.length; i++) {
      const t = els[i].textContent.trim();
      if (t) return t;
    }
  }
  return null;
}

// Walk nested path and return leaf text: fvPath(seg, 'Departure', 'AirportCode')
function fvPath(root, ...parts) {
  let cur = root;
  for (const part of parts) {
    const found = cur.getElementsByTagName(part)[0];
    if (!found) return null;
    cur = found;
  }
  const t = cur.textContent.trim();
  return t || null;
}

// Get attribute value from first matching element
function fvAttr(root, tag, attr) {
  const el = root.getElementsByTagName(tag)[0];
  return el ? (el.getAttribute(attr) || null) : null;
}

// Collect all elements matching any of the given tag names (first non-empty set wins)
function fvAll(root, ...tags) {
  for (const tag of tags) {
    const els = root.getElementsByTagName(tag);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

// ── Flight data extractors ────────────────────────────────────────────────────

function extractFvIATANumber(root) {
  // Prefer seller's OrgID from DistributionChainLink (Amadeus NDC)
  const links = root.getElementsByTagName('DistributionChainLink');
  for (const link of links) {
    const roleEl = link.getElementsByTagName('OrgRole')[0];
    if (roleEl && roleEl.textContent.trim() === 'Seller') {
      const orgId = link.getElementsByTagName('OrgID')[0];
      if (orgId && orgId.textContent.trim()) return orgId.textContent.trim();
    }
  }
  return fvTry(root, fvConfig.iataNumber);
}

function extractFlightData(root) {
  return {
    pnr:        extractFvPNR(root),
    orderId:    extractFvOrderId(root),
    iataNumber: extractFvIATANumber(root),
    segments:   extractFvSegments(root),
    passengers: extractFvPassengers(root),
    orderItems: extractFvOrderItems(root),
    tickets:    extractFvTickets(root)
  };
}

function extractFvPNR(root) {
  const gdsRef = fvAttr(root, 'Order', 'GdsBookingRef');
  if (gdsRef) return gdsRef;
  return fvTry(root, fvConfig.pnr);
}

function extractFvOrderId(root) {
  const ndcOid = fvAttr(root, 'Order', 'OrderID');
  if (ndcOid) return ndcOid;
  return fvTry(root, fvConfig.orderId);
}

function extractFvSegments(root) {
  const segEls = fvAll(root, ...fvConfig.segmentContainers);
  return segEls.map(seg => {
    const depAirport  = fvTry(seg, fvConfig.depAirport);
    const arrAirport  = fvTry(seg, fvConfig.arrAirport);
    const depDate     = fvTry(seg, fvConfig.depDate);
    const depTime     = fvTry(seg, fvConfig.depTime);
    const depDateTime = fvTry(seg, fvConfig.depDateTime);
    const arrDate     = fvTry(seg, fvConfig.arrDate);
    const arrTime     = fvTry(seg, fvConfig.arrTime);
    const arrDateTime = fvTry(seg, fvConfig.arrDateTime);
    const flightNumber = fvTry(seg, fvConfig.flightNumber);
    const carrier     = fvTry(seg, fvConfig.carrier);

    let dDate = depDate, dTime = depTime, aDate = arrDate, aTime = arrTime;
    if (!dDate && !dTime && depDateTime) {
      const p = depDateTime.split('T');
      dDate = p[0]; dTime = p[1] ? p[1].substring(0, 5) : null;
    }
    if (!aDate && !aTime && arrDateTime) {
      const p = arrDateTime.split('T');
      aDate = p[0]; aTime = p[1] ? p[1].substring(0, 5) : null;
    }
    return { depAirport, arrAirport, depDate: dDate, depTime: dTime, arrDate: aDate, arrTime: aTime, flightNumber, carrier };
  });
}

function extractFvPassengers(root) {
  const paxEls = fvAll(root, ...fvConfig.passengerContainers);
  return paxEls.map((el, idx) => {
    const surname = fvTry(el, fvConfig.surname);
    const given   = fvTry(el, fvConfig.given);
    const ptc     = fvTry(el, fvConfig.ptc) || el.getAttribute('PTC') || el.getAttribute('Type') || el.getAttribute('PassengerType');
    const idEl    = el.getElementsByTagName('PaxID')[0] || el.getElementsByTagName('PassengerID')[0];
    const id      = (idEl && idEl.textContent.trim()) || el.getAttribute('PassengerID') || el.getAttribute('ID') || el.getAttribute('PaxID') || String(idx + 1);
    return { id, surname, given, ptc };
  });
}

function extractFvOrderItems(root) {
  const itemEls = fvAll(root, ...fvConfig.orderItemContainers);
  return itemEls.map(el => {
    const idEl     = el.getElementsByTagName('OrderItemID')[0];
    const id       = (idEl && idEl.textContent.trim()) || el.getAttribute('OrderItemID') || el.getAttribute('ID') || el.getAttribute('OfferItemID');
    const price    = fvTry(el, fvConfig.itemPrice);
    // Try CurCode attr (Amadeus NDC) then Code attr then child element
    const priceEl  = el.querySelector('TotalAmount') || el.querySelector('Price');
    const currency = (priceEl && (priceEl.getAttribute('CurCode') || priceEl.getAttribute('Code')))
                   || el.querySelector('[CurCode]')?.getAttribute('CurCode')
                   || el.querySelector('[Code]')?.getAttribute('Code')
                   || fvTry(el, fvConfig.itemCurrency);
    const refs     = fvTry(el, fvConfig.itemRefs);
    return { id, price, currency, refs };
  });
}

function extractFvTickets(root) {
  const tktEls = fvAll(root, ...fvConfig.ticketContainers);
  return tktEls.map(el => {
    const number       = fvTry(el, fvConfig.ticketNumber);
    const passengerRef = fvTry(el, fvConfig.ticketPassengerRef);
    const type         = fvTry(el, fvConfig.ticketType);
    return { number, passengerRef, type };
  });
}

// ── Flight view renderer ──────────────────────────────────────────────────────

const GEAR_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

function renderFlightView() {
  const fvEl = document.getElementById('flight-view');

  // Build persistent toolbar + content structure once
  if (!fvEl.querySelector('.fv-toolbar')) {
    const toolbar = document.createElement('div');
    toolbar.className = 'fv-toolbar';
    const lbl = document.createElement('span');
    lbl.className = 'pane-label';
    lbl.textContent = 'Flight Data';
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn';
    settingsBtn.id = 'btn-fv-settings';
    settingsBtn.innerHTML = GEAR_SVG + ' Tag Config';
    settingsBtn.style.cssText = 'display:flex;align-items:center;gap:5px;';
    settingsBtn.addEventListener('click', openFvSettings);
    toolbar.appendChild(lbl);
    toolbar.appendChild(settingsBtn);
    fvEl.appendChild(toolbar);

    const histRow = document.createElement('div');
    histRow.id = 'fv-pnr-history-row';
    fvEl.appendChild(histRow);
    renderFvPnrHistory();

    const content = document.createElement('div');
    content.className = 'fv-content';
    fvEl.appendChild(content);
  }

  const contentEl = fvEl.querySelector('.fv-content');
  contentEl.innerHTML = '';

  const src = inputEl.value.trim();
  if (!src) {
    contentEl.innerHTML = '<div class="fv-empty"><p>No input — paste XML and press ▶ Parse</p></div>';
    return;
  }

  const type = detectType(src);
  if (type !== 'xml') {
    contentEl.innerHTML = '<div class="fv-empty"><p>Flight View only supports XML responses</p></div>';
    return;
  }

  let dom;
  try {
    const p = new DOMParser();
    dom = p.parseFromString(src, 'application/xml');
    if (dom.querySelector('parsererror')) throw new Error('XML parse error');
  } catch {
    contentEl.innerHTML = '<div class="fv-empty"><p>XML parse error — check your input</p></div>';
    return;
  }

  const data = extractFlightData(dom.documentElement);

  // ── Info bar: PNR + Order ID ─────────────────────────────────────────────
  const infobar = document.createElement('div');
  infobar.className = 'fv-infobar';

  const COPY_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  function makeChip(label, value, extraCls, onCopy) {
    const chip = document.createElement('div');
    chip.className = 'fv-chip' + (extraCls ? ' ' + extraCls : '') + (!value ? ' miss' : '');
    const lbl = document.createElement('span'); lbl.className = 'fv-chip-label'; lbl.textContent = label;
    const val = document.createElement('span'); val.className = 'fv-chip-val';   val.textContent = value || '—';
    chip.appendChild(lbl); chip.appendChild(val);
    if (value && onCopy) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'fv-chip-copy';
      copyBtn.title = 'Copy ' + label;
      copyBtn.innerHTML = COPY_SVG;
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = COPY_SVG; }, 1400);
        });
        onCopy();
      });
      chip.appendChild(copyBtn);
    }
    return chip;
  }

  const _onCopy = () => pnrHistAdd(data.pnr, data.orderId, data.iataNumber);
  infobar.appendChild(makeChip('PNR', data.pnr, 'pnr', _onCopy));
  infobar.appendChild(makeChip('Order ID', data.orderId, 'oid', _onCopy));
  infobar.appendChild(makeChip('IATA', data.iataNumber, 'iata', _onCopy));
  contentEl.appendChild(infobar);

  // ── Segments ─────────────────────────────────────────────────────────────
  if (data.segments.length > 0) {
    const sec = document.createElement('div'); sec.className = 'fv-section';
    const title = document.createElement('div'); title.className = 'fv-sec-title';
    title.textContent = 'Flight Segments (' + data.segments.length + ')';
    sec.appendChild(title);

    const grid = document.createElement('div'); grid.className = 'fv-segs';
    data.segments.forEach(seg => {
      const card = document.createElement('div'); card.className = 'fv-seg-card';

      const route = document.createElement('div'); route.className = 'fv-route';
      const dep   = document.createElement('span'); dep.className = 'fv-airport'; dep.textContent = seg.depAirport || '???';
      const arrow = document.createElement('div');  arrow.className = 'fv-arrow';
      const arr   = document.createElement('span'); arr.className = 'fv-airport'; arr.textContent = seg.arrAirport || '???';
      route.appendChild(dep); route.appendChild(arrow); route.appendChild(arr);
      card.appendChild(route);

      const times = document.createElement('div'); times.className = 'fv-times';
      function timeBlock(t, d, align) {
        const block = document.createElement('div'); block.className = 'fv-time-block'; block.style.textAlign = align;
        const te = document.createElement('div'); te.className = 'fv-time'; te.textContent = t || '—';
        const de = document.createElement('div'); de.className = 'fv-date'; de.textContent = d || '';
        block.appendChild(te); block.appendChild(de);
        return block;
      }
      times.appendChild(timeBlock(seg.depTime, seg.depDate, 'left'));
      times.appendChild(timeBlock(seg.arrTime, seg.arrDate, 'right'));
      card.appendChild(times);

      if (seg.carrier || seg.flightNumber) {
        const badge = document.createElement('div'); badge.className = 'fv-flight-badge';
        badge.textContent = [seg.carrier, seg.flightNumber].filter(Boolean).join(' ');
        card.appendChild(badge);
      }
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    contentEl.appendChild(sec);
  }

  // ── Passengers ───────────────────────────────────────────────────────────
  if (data.passengers.length > 0) {
    const sec = document.createElement('div'); sec.className = 'fv-section';
    const title = document.createElement('div'); title.className = 'fv-sec-title';
    title.textContent = 'Passengers (' + data.passengers.length + ')';
    sec.appendChild(title);

    const table = document.createElement('table'); table.className = 'fv-table';
    table.innerHTML = '<thead><tr><th>#</th><th>Name</th><th>Type</th></tr></thead>';
    const tbody = document.createElement('tbody');
    data.passengers.forEach((pax, i) => {
      const tr   = document.createElement('tr');
      const name = [pax.surname, pax.given].filter(Boolean).join(', ') || '—';
      const ptcHtml = pax.ptc
        ? '<span class="fv-ptc-badge">' + esc(pax.ptc) + '</span>'
        : '<span class="fv-missing">—</span>';
      tr.innerHTML = '<td style="color:var(--text2)">' + (i + 1) + '</td><td>' + esc(name) + '</td><td>' + ptcHtml + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);
    contentEl.appendChild(sec);
  }

  // ── Order Items ───────────────────────────────────────────────────────────
  if (data.orderItems.length > 0) {
    const sec = document.createElement('div'); sec.className = 'fv-section';
    const title = document.createElement('div'); title.className = 'fv-sec-title';
    title.textContent = 'Order Items (' + data.orderItems.length + ')';
    sec.appendChild(title);

    const table = document.createElement('table'); table.className = 'fv-table';
    table.innerHTML = '<thead><tr><th>ID</th><th>Price</th><th>Refs</th></tr></thead>';
    const tbody = document.createElement('tbody');
    data.orderItems.forEach(item => {
      const tr       = document.createElement('tr');
      const priceStr = [item.price, item.currency].filter(Boolean).join(' ') || '—';
      tr.innerHTML =
        '<td style="font-family:\'Fira Code\',monospace;font-size:0.75rem">' + esc(item.id || '—') + '</td>' +
        '<td style="color:var(--orange)">' + esc(priceStr) + '</td>' +
        '<td style="color:var(--text2);font-size:0.75rem">' + esc(item.refs || '—') + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);
    contentEl.appendChild(sec);
  }

  // ── Tickets ───────────────────────────────────────────────────────────────
  if (data.tickets.length > 0) {
    const sec = document.createElement('div'); sec.className = 'fv-section';
    const title = document.createElement('div'); title.className = 'fv-sec-title';
    title.textContent = 'Tickets (' + data.tickets.length + ')';
    sec.appendChild(title);

    const table = document.createElement('table'); table.className = 'fv-table';
    table.innerHTML = '<thead><tr><th>Number</th><th>Type</th><th>Passenger Ref</th></tr></thead>';
    const tbody = document.createElement('tbody');
    data.tickets.forEach(tkt => {
      const tr       = document.createElement('tr');
      const typeStr  = tkt.type === 'T' ? 'Ticket' : tkt.type === 'EMD' ? 'EMD' : (tkt.type || '—');
      tr.innerHTML =
        '<td><span class="fv-tkt-num">' + esc(tkt.number || '—') + '</span></td>' +
        '<td><span class="fv-tkt-type">' + esc(typeStr) + '</span></td>' +
        '<td style="color:var(--text2);font-size:0.75rem">' + esc(tkt.passengerRef || '—') + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);
    contentEl.appendChild(sec);
  }

  // ── Nothing found ─────────────────────────────────────────────────────────
  const foundSomething = data.pnr || data.orderId || data.segments.length || data.passengers.length || data.tickets.length;
  if (!foundSomething) {
    const note = document.createElement('div'); note.className = 'fv-no-data';
    note.textContent = 'No recognizable flight data found. This XML may use non-standard field names.';
    contentEl.appendChild(note);
  }
}

// ── Doc B parse ───────────────────────────────────────────────────────────────
function doParseB() {
  const src = inputAreaB.value.trim();
  if (!src) { setStatusB('empty', '—', 'Waiting for input'); treeRootB = null; return; }

  const type = detectType(src);
  if (!type) { setStatusB('error', 'ERR', 'Cannot detect format — must start with < or { / ['); treeRootB = null; return; }

  if (type === 'json') {
    try {
      treeRootB = jsonToTree(JSON.parse(src), null, 0);
      setStatusB('json', 'JSON', 'Parsed successfully');
    } catch (e) { setStatusB('error', 'ERR', e.message); treeRootB = null; }
  } else {
    try {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(src, 'application/xml');
      const errEl  = doc.querySelector('parsererror');
      if (errEl) throw new Error(errEl.textContent.split('\n')[0].trim());
      treeRootB = xmlToTree(doc.documentElement, 0);
      setStatusB('xml', 'XML', 'Parsed successfully');
    } catch (e) { setStatusB('error', 'ERR', e.message); treeRootB = null; }
  }

  if (treeRoot && treeRootB) showDiff();
}

// ── Compare mode toggle ───────────────────────────────────────────────────────
btnCompare.addEventListener('click', () => {
  if (compareMode) {
    exitCompare();
  } else {
    compareMode = true;
    docBWrap.classList.add('visible');
    btnCompare.classList.add('compare-on');
    inputAreaB.focus();
    // If both already parsed, show diff immediately
    if (treeRoot && treeRootB) showDiff();
  }
});

document.getElementById('btn-b-parse').addEventListener('click', doParseB);

document.getElementById('btn-b-clear').addEventListener('click', () => {
  inputAreaB.value = '';
  setStatusB('empty', '—', 'Waiting for input');
  treeRootB = null;
  // Restore canvas if diff was shown
  if (diffView.classList.contains('active')) {
    diffView.classList.remove('active');
    diffView.innerHTML = '';
    canvasArea.style.display  = '';
    searchStrip.style.display = '';
  }
});

document.getElementById('btn-b-json').addEventListener('click', () => { inputAreaB.value = JSON_SAMPLE; doParseB(); });
document.getElementById('btn-b-xml').addEventListener('click',  () => { inputAreaB.value = XML_SAMPLE;  doParseB(); });

inputAreaB.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doParseB(); }
});

// ── View mode toggle (graph ↔ tree) ──────────────────────────────────────────
const btnViewToggle = document.getElementById('btn-view-toggle');

const VIEW_GRAPH_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="12" x2="17" y2="6.5"/><line x1="7" y1="12" x2="17" y2="17.5"/></svg> Graph`;
const VIEW_TREE_ICON  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Tree`;

btnViewToggle.innerHTML = VIEW_TREE_ICON;

btnViewToggle.addEventListener('click', () => {
  if (!treeRoot) return;
  viewMode = viewMode === 'graph' ? 'tree' : 'graph';
  const isTree = viewMode === 'tree';
  btnViewToggle.innerHTML = isTree ? VIEW_GRAPH_ICON : VIEW_TREE_ICON;
  btnViewToggle.classList.toggle('tree-active', isTree);
  doRender();
});

// ── Toggle input pane ────────────────────────────────────────────────────────
const inputPane       = document.querySelector('.input-pane');
const toggleInputBtn  = document.getElementById('toggle-input-btn');

toggleInputBtn.addEventListener('click', () => {
  const hidden = inputPane.classList.toggle('hidden');
  toggleInputBtn.classList.toggle('pane-hidden', hidden);
});

// ── Drag to pan canvas ───────────────────────────────────────────────────────
let panning = false, panX = 0, panY = 0, scrollX = 0, scrollY = 0;

canvasArea.addEventListener('mousedown', e => {
  if (e.target.closest('.fcard')) return;
  panning = true;
  panX = e.clientX; panY = e.clientY;
  scrollX = canvasArea.scrollLeft;
  scrollY = canvasArea.scrollTop;
  canvasArea.classList.add('panning');
});

window.addEventListener('mousemove', e => {
  if (!panning) return;
  canvasArea.scrollLeft = scrollX - (e.clientX - panX);
  canvasArea.scrollTop  = scrollY - (e.clientY - panY);
});

window.addEventListener('mouseup', () => {
  panning = false;
  canvasArea.classList.remove('panning');
});

// ── Flight view settings panel ───────────────────────────────────────────────

// Build the settings panel DOM once and append to body
(function () {
  const panel = document.createElement('div');
  panel.id = 'fv-settings-panel';
  panel.innerHTML =
    '<div class="fvs-header">' +
      '<span class="fvs-title">Tag Configuration</span>' +
      '<button class="fvs-close" id="btn-fvs-close" title="Close">✕</button>' +
    '</div>' +
    '<div class="fvs-body" id="fvs-body"></div>' +
    '<div class="fvs-footer">' +
      '<button class="fvs-btn-reset" id="btn-fvs-reset">↺ Reset to defaults</button>' +
      '<div class="fvs-footer-right">' +
        '<button class="fvs-btn-apply" id="btn-fvs-apply">✓ Apply</button>' +
        '<button class="fvs-btn-script" id="btn-fvs-script">⬇ Update Script</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);

  const backdrop = document.createElement('div');
  backdrop.id = 'fvs-backdrop';
  document.body.appendChild(backdrop);
})();

const FVS_GROUPS = [
  { title: 'Identifiers', fields: [
    { key: 'pnr',    label: 'PNR / Booking Reference' },
    { key: 'orderId', label: 'Order ID' },
  ]},
  { title: 'Segments', hint: 'Use Path/With/Slashes for nested tags, plain name for direct match', fields: [
    { key: 'segmentContainers', label: 'Segment container tags' },
    { key: 'depAirport',        label: 'Departure Airport Code' },
    { key: 'arrAirport',        label: 'Arrival Airport Code' },
    { key: 'depDate',           label: 'Departure Date' },
    { key: 'depTime',           label: 'Departure Time' },
    { key: 'depDateTime',       label: 'Departure DateTime (combined ISO)' },
    { key: 'arrDate',           label: 'Arrival Date' },
    { key: 'arrTime',           label: 'Arrival Time' },
    { key: 'arrDateTime',       label: 'Arrival DateTime (combined ISO)' },
    { key: 'flightNumber',      label: 'Flight Number' },
    { key: 'carrier',           label: 'Carrier / Airline Code' },
  ]},
  { title: 'Passengers', fields: [
    { key: 'passengerContainers', label: 'Passenger container tags' },
    { key: 'surname', label: 'Surname / Last Name' },
    { key: 'given',   label: 'Given / First Name' },
    { key: 'ptc',     label: 'Passenger Type (PTC)' },
  ]},
  { title: 'Order Items', fields: [
    { key: 'orderItemContainers', label: 'Order item container tags' },
    { key: 'itemPrice',    label: 'Price' },
    { key: 'itemCurrency', label: 'Currency' },
    { key: 'itemRefs',     label: 'Flight / Segment references' },
  ]},
  { title: 'Tickets', fields: [
    { key: 'ticketContainers',   label: 'Ticket container tags' },
    { key: 'ticketNumber',       label: 'Ticket Number' },
    { key: 'ticketPassengerRef', label: 'Passenger Reference' },
    { key: 'ticketType',         label: 'Ticket Type tag' },
  ]},
];

function renderFvSettings() {
  const body = document.getElementById('fvs-body');
  body.innerHTML = '';
  FVS_GROUPS.forEach(group => {
    const grp = document.createElement('div');
    grp.className = 'fvs-group';
    const gtitle = document.createElement('div');
    gtitle.className = 'fvs-group-title';
    gtitle.textContent = group.title;
    grp.appendChild(gtitle);
    if (group.hint) {
      const h = document.createElement('div'); h.className = 'fvs-hint'; h.textContent = group.hint;
      grp.appendChild(h);
    }
    group.fields.forEach(f => {
      const field = document.createElement('div'); field.className = 'fvs-field';
      const lbl = document.createElement('label'); lbl.className = 'fvs-label'; lbl.textContent = f.label;
      const ta  = document.createElement('textarea'); ta.className = 'fvs-input'; ta.dataset.key = f.key;
      ta.value = (fvConfig[f.key] || []).join(', ');
      ta.rows = Math.min(4, Math.ceil((fvConfig[f.key] || []).length / 2) + 1);
      field.appendChild(lbl); field.appendChild(ta);
      grp.appendChild(field);
    });
    body.appendChild(grp);
  });
}

function openFvSettings() {
  renderFvSettings();
  document.getElementById('fv-settings-panel').classList.add('fvs-open');
  document.getElementById('fvs-backdrop').classList.add('fvs-open');
}

function closeFvSettings() {
  document.getElementById('fv-settings-panel').classList.remove('fvs-open');
  document.getElementById('fvs-backdrop').classList.remove('fvs-open');
}

function applyFvConfig() {
  document.querySelectorAll('.fvs-input').forEach(ta => {
    fvConfig[ta.dataset.key] = ta.value.split(',').map(s => s.trim()).filter(Boolean);
  });
  localStorage.setItem('parser-fv-config', JSON.stringify(fvConfig));
  closeFvSettings();
  if (appMode === 'flight') renderFlightView();
}

async function updateFvScript() {
  // Collect current values from the open panel
  document.querySelectorAll('.fvs-input').forEach(ta => {
    fvConfig[ta.dataset.key] = ta.value.split(',').map(s => s.trim()).filter(Boolean);
  });
  localStorage.setItem('parser-fv-config', JSON.stringify(fvConfig));

  let src;
  try {
    const r = await fetch('app.js', { cache: 'no-store' });
    if (!r.ok) throw new Error('fetch failed');
    src = await r.text();
  } catch {
    alert('Could not fetch source file (common with file:// in Firefox).\n\nCopy the block below and manually replace FV_TAG_CONFIG in app.js:\n\nconst FV_TAG_CONFIG = ' + JSON.stringify(fvConfig, null, 2) + '; // __END_FV_TAG_CONFIG__');
    return;
  }

  const startTag = 'const FV_TAG_CONFIG = ';
  const endTag   = '; // __END_FV_TAG_CONFIG__';
  const si = src.indexOf(startTag);
  const ei = src.indexOf(endTag);
  if (si === -1 || ei === -1) {
    alert('Marker not found in source. Make sure app.js has not been modified externally.');
    return;
  }

  const newSrc = src.slice(0, si) + startTag + JSON.stringify(fvConfig, null, 2) + endTag + src.slice(ei + endTag.length);
  const blob = new Blob([newSrc], { type: 'text/javascript' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'app.js' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  closeFvSettings();
  if (appMode === 'flight') renderFlightView();
}

document.getElementById('btn-fvs-close').addEventListener('click', closeFvSettings);
document.getElementById('fvs-backdrop').addEventListener('click', closeFvSettings);
document.getElementById('btn-fvs-reset').addEventListener('click', () => {
  fvConfig = JSON.parse(JSON.stringify(FV_TAG_CONFIG));
  localStorage.removeItem('parser-fv-config');
  renderFvSettings();
});
document.getElementById('btn-fvs-apply').addEventListener('click', applyFvConfig);
document.getElementById('btn-fvs-script').addEventListener('click', updateFvScript);

// ── App mode (Parser ↔ Flight View) ──────────────────────────────────────────
const btnModeParser = document.getElementById('btn-mode-parser');
const btnModeFlight = document.getElementById('btn-mode-flight');
const flightViewEl  = document.getElementById('flight-view');
const outputPaneEl  = document.querySelector('.output-pane');

function setAppMode(mode) {
  appMode = mode;
  btnModeParser.classList.toggle('active', mode === 'parser');
  btnModeFlight.classList.toggle('active', mode === 'flight');
  outputPaneEl.style.display = mode === 'parser' ? '' : 'none';
  flightViewEl.classList.toggle('fv-active', mode === 'flight');
  if (mode === 'flight') renderFlightView();
  if (mode === 'parser' && treeRoot && !searchActive && !compareMode) doRender();
}

btnModeParser.addEventListener('click', () => setAppMode('parser'));
btnModeFlight.addEventListener('click', () => setAppMode('flight'));

// ── Theme & font size controls ────────────────────────────────────────────────
const htmlEl        = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');

const MOON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function applyTheme(theme) {
  htmlEl.dataset.theme = theme;
  // Sun = currently light (click to go dark); Moon = currently dark (click to go light)
  themeToggleBtn.innerHTML = theme === 'light' ? SUN_SVG : MOON_SVG;
  localStorage.setItem('parser-theme', theme);
  if (treeRoot && !searchActive && !diffView.classList.contains('active')) doRender();
  if (diffView.classList.contains('active') && treeRoot && treeRootB) showDiff();
}

function applySize(size) {
  htmlEl.dataset.size = size;
  localStorage.setItem('parser-size', size);
  document.querySelectorAll('.fs-btn').forEach(b => b.classList.toggle('active', b.dataset.size === size));
}

// Init from localStorage
applyTheme(localStorage.getItem('parser-theme') || 'dark');
applySize(localStorage.getItem('parser-size')   || 'md');

themeToggleBtn.addEventListener('click', () => {
  applyTheme(htmlEl.dataset.theme === 'dark' ? 'light' : 'dark');
});

document.querySelectorAll('.fs-btn').forEach(btn => {
  btn.addEventListener('click', () => applySize(btn.dataset.size));
});

// ── Bookmark panel ────────────────────────────────────────────────────────────
function findNodeByPath(root, pathParts) {
  if (!root || !pathParts || pathParts.length < 1) return null;
  let node = root;
  const ancestors = [];
  for (let i = 1; i < pathParts.length; i++) {
    const part = pathParts[i];
    const child = node.children && node.children.find(c => {
      const k = (c.key !== null && c.key !== undefined)
        ? (typeof c.key === 'number' ? `[${c.key}]` : String(c.key))
        : (c.type === 'element' ? String(c.key || c.type) : c.type);
      return k === part;
    });
    if (!child) return null;
    ancestors.push(node);
    node = child;
  }
  return { node, ancestors };
}

function navigateToBm(bm) {
  if (!treeRoot) return;
  const result = findNodeByPath(treeRoot, bm.pathParts);
  if (!result) {
    alert('Node not found — the document may have changed since this bookmark was saved.');
    return;
  }
  closeBmPanel();
  if (appMode !== 'parser') setAppMode('parser');
  navigateToNode(result.node, result.ancestors);
}

function renderBmPanel() {
  const body = document.getElementById('bm-panel-body');
  if (!body) return;
  body.innerHTML = '';
  if (!bookmarks.length) {
    body.innerHTML = '<div class="bm-empty">No bookmarks yet.<br>Click ★ on any node to bookmark it.</div>';
    return;
  }
  bookmarks.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'bm-item';

    const hdr = document.createElement('div');
    hdr.className = 'bm-item-header';

    const keyEl = document.createElement('span');
    keyEl.className = 'bm-item-key';
    keyEl.textContent = bm.label;
    hdr.appendChild(keyEl);

    const badgeEl = document.createElement('span');
    badgeEl.className = `fbadge ${T_BADGE[bm.type] || 'tb-txt'}`;
    badgeEl.textContent = T_LABEL[bm.type] || bm.type;
    hdr.appendChild(badgeEl);

    const actions = document.createElement('div');
    actions.className = 'bm-item-actions';

    const navBtn = document.createElement('button');
    navBtn.className = 'bm-nav-btn';
    navBtn.title = 'Go to node';
    navBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    navBtn.addEventListener('click', () => navigateToBm(bm));
    actions.appendChild(navBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'bm-del-btn';
    delBtn.title = 'Remove bookmark';
    delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.addEventListener('click', () => {
      bmRemove(bm.pathKey);
      renderBmPanel();
      // Update any visible star buttons in the current view
      document.querySelectorAll('.fc-bm, .tv-bm').forEach(btn => {
        if (btn.getAttribute('data-pathkey') === bm.pathKey) {
          btn.classList.remove('active');
          btn.title = 'Add bookmark';
        }
      });
    });
    actions.appendChild(delBtn);
    hdr.appendChild(actions);
    item.appendChild(hdr);

    const pathEl = document.createElement('div');
    pathEl.className = 'bm-item-path';
    pathEl.textContent = bm.pathParts.join(' › ');
    item.appendChild(pathEl);

    if (bm.value) {
      const valEl = document.createElement('div');
      valEl.className = 'bm-item-val';
      valEl.textContent = bm.value;
      item.appendChild(valEl);
    }

    body.appendChild(item);
  });
}

function openBmPanel() {
  renderBmPanel();
  document.getElementById('bm-panel').classList.add('bm-open');
  document.getElementById('bm-backdrop').classList.add('bm-open');
}

function closeBmPanel() {
  document.getElementById('bm-panel').classList.remove('bm-open');
  document.getElementById('bm-backdrop').classList.remove('bm-open');
}

// ── Create bookmark panel DOM ─────────────────────────────────────────────────
(function () {
  const backdrop = document.createElement('div');
  backdrop.id = 'bm-backdrop';
  backdrop.addEventListener('click', closeBmPanel);
  document.body.appendChild(backdrop);

  const panel = document.createElement('div');
  panel.id = 'bm-panel';

  const panelHdr = document.createElement('div');
  panelHdr.className = 'bm-panel-header';

  const panelTitle = document.createElement('span');
  panelTitle.className = 'bm-panel-title';
  panelTitle.textContent = '★ Bookmarks';
  panelHdr.appendChild(panelTitle);

  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'bm-clear-all';
  clearAllBtn.textContent = 'Clear all';
  clearAllBtn.addEventListener('click', () => {
    bookmarks = [];
    bmSave();
    updateBmBadge();
    renderBmPanel();
    document.querySelectorAll('.fc-bm.active, .tv-bm.active').forEach(b => {
      b.classList.remove('active');
      b.title = 'Add bookmark';
    });
  });
  panelHdr.appendChild(clearAllBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'bm-panel-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeBmPanel);
  panelHdr.appendChild(closeBtn);

  panel.appendChild(panelHdr);

  const panelBody = document.createElement('div');
  panelBody.className = 'bm-panel-body';
  panelBody.id = 'bm-panel-body';
  panel.appendChild(panelBody);

  document.body.appendChild(panel);

  document.getElementById('btn-bookmarks').addEventListener('click', openBmPanel);
  updateBmBadge();
})();
