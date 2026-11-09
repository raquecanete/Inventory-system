/* VIEWERS — local-first construction supply inventory */
(() => {
  "use strict";

  // Demo sign-in: credentials are intentionally client-side and are not secure authentication.
  const DEMO_ACCOUNT = { username: "yardadmin", password: "Yard2026!" };
  const AUTH_KEY = "yard-ledger-demo-auth";
  let isAuthenticated = false;
  const setAuthenticated = (authenticated) => {
    isAuthenticated = authenticated;
    document.getElementById("yard-app").classList.toggle("hidden", !authenticated);
    document.getElementById("login-screen").classList.toggle("hidden", authenticated);
    if (authenticated) {
      try { sessionStorage.setItem(AUTH_KEY, "yes"); }
      catch (error) { console.error("Could not save this demo sign-in session.", error); }
    } else {
      try { sessionStorage.removeItem(AUTH_KEY); }
      catch (error) { console.error("Could not clear this demo sign-in session.", error); }
    }
  };
  document.getElementById("demo-credentials").textContent = `${DEMO_ACCOUNT.username} / ${DEMO_ACCOUNT.password}`;
  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    const error = document.getElementById("login-error");
    if (username !== DEMO_ACCOUNT.username || password !== DEMO_ACCOUNT.password) {
      error.textContent = "That username or password does not match the demo account.";
      error.classList.remove("hidden");
      form.elements.password.focus();
      return;
    }
    error.textContent = "";
    error.classList.add("hidden");
    form.reset();
    setAuthenticated(true);
    render();
    toast("Signed in to the yard desk.");
  });
  try { setAuthenticated(sessionStorage.getItem(AUTH_KEY) === "yes"); }
  catch (error) {
    console.error("Could not restore the demo sign-in session.", error);
    setAuthenticated(false);
  }

  // Store: load, persist, and reset the single local inventory state.
  const STORE_KEY = "yard-ledger-v1";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const freshState = () => ({
    items: clone(window.YARD_SEED.items),
    suppliers: clone(window.YARD_SEED.suppliers),
    movements: clone(window.YARD_SEED.movements),
    purchaseOrders: clone(window.YARD_SEED.purchaseOrders),
    staff: clone(window.YARD_SEED.staff)
  });
  let state;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    state = saved && Array.isArray(saved.items) ? saved : freshState();
  } catch (error) {
    console.error("Could not read VIEWERS inventory data from local storage.", error);
    state = freshState();
  }
  const persist = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (error) { console.error("Could not save VIEWERS inventory data.", error); toast("Could not save changes in this browser.", "error"); }
  };

  // Utilities: formatting, status, escaping, and reusable UI fragments.
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const num = (value) => Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
  const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateFmt = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dateTimeFmt = (value) => `${dateFmt(value)} · ${new Date(value).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`;
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const itemBySku = (sku) => state.items.find((item) => item.sku === sku);
  const supplierById = (id) => state.suppliers.find((supplier) => supplier.id === id);
  const stockStatus = (item) => item.qty <= 0 ? "OUT" : item.qty <= item.reorderPoint ? "LOW" : "IN STOCK";
  const statusClass = (status) => status === "OUT" ? "bg-rebar text-white" : status === "LOW" ? "bg-hazard text-asphalt" : status === "ON ORDER" ? "bg-steel text-white" : "bg-safety text-white";
  const statusTag = (status) => `<span class="hazard-tag inline-block min-w-[66px] px-2 py-1 text-center font-heading text-[11px] font-bold uppercase tracking-wider ${statusClass(status)}">${esc(status)}</span>`;
  const tape = (item) => {
    const max = Math.max(Number(item.maxStock) || Number(item.reorderPoint) || 1, 1);
    const fill = Math.min(100, Math.max(0, item.qty / max * 100));
    const mark = Math.min(100, item.reorderPoint / max * 100);
    const color = item.qty <= 0 ? "#B5472B" : item.qty <= item.reorderPoint ? "#F5B700" : "#2F7D4F";
    return `<div class="tape-track min-w-[105px]" aria-label="${num(item.qty)} ${esc(item.unit)} on hand, reorder at ${num(item.reorderPoint)}"><div class="tape-fill" style="width:${fill}%;background:${color}"></div><span class="tape-marker" style="left:${mark}%"></span></div>`;
  };
  const btn = (label, action, extra = "", icon = "") => `<button type="button" data-action="${esc(action)}" class="inline-flex min-h-11 items-center justify-center gap-2 border border-asphalt px-4 font-heading text-sm font-bold uppercase tracking-wider transition-colors ${extra}">${icon ? `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-${icon}"/></svg>` : ""}${esc(label)}</button>`;
  const primaryBtn = (label, action, icon = "plus") => btn(label, action, "bg-hazard text-asphalt hover:bg-yellow-400", icon);
  const sectionTitle = (title, aside = "") => `<div class="mb-4 flex items-end justify-between gap-3"><h2 class="font-heading text-2xl font-bold uppercase tracking-wider">${esc(title)}</h2>${aside}</div><div class="hazard-rule mb-5"></div>`;
  const emptyState = (title, text, actionLabel, action) => `<div class="border border-steel/50 bg-white px-6 py-12 text-center"><div class="mx-auto mb-4 grid h-12 w-12 place-items-center border border-steel text-steel"><svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-box"/></svg></div><h3 class="font-heading text-xl font-bold uppercase tracking-wider">${esc(title)}</h3><p class="mx-auto mt-2 max-w-md text-sm text-steel">${esc(text)}</p>${actionLabel ? `<div class="mt-5">${primaryBtn(actionLabel, action)}</div>` : ""}</div>`;
  const pageHeader = (title, subtitle, actionLabel, action, icon = "plus") => `
    <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p class="mb-1 font-mono text-[11px] uppercase tracking-[.2em] text-steel">Yard operations / ${esc(pageName())}</p><h1 class="font-heading text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">${esc(title)}</h1><p class="mt-2 text-sm text-steel">${esc(subtitle)}</p></div>
      ${primaryBtn(actionLabel, action, icon)}
    </div>`;
  const pageName = () => ({ dashboard: "Overview", inventory: "Stock ledger", movements: "Movement log", orders: "Procurement", suppliers: "Supplier directory", reports: "Reports" }[route] || "Overview");
  const lowItems = () => state.items.filter((item) => item.qty <= item.reorderPoint).sort((a, b) => (a.qty - a.reorderPoint) / Math.max(a.reorderPoint, 1) - (b.qty - b.reorderPoint) / Math.max(b.reorderPoint, 1));
  const movementLabel = (movement) => ({ IN: "Stock in", OUT: "Stock out", ADJUST: "Adjustment", TRANSFER: "Transfer" }[movement.type] || movement.type);
  const toast = (message, kind = "success", undo) => {
    const region = $("#toast-region");
    const node = document.createElement("div");
    const edge = kind === "error" ? "border-l-rebar" : kind === "warning" ? "border-l-hazard" : "border-l-safety";
    node.className = `toast-in flex min-h-14 items-center justify-between gap-3 border border-asphalt border-l-4 ${edge} bg-white px-4 py-3 shadow-yard`;
    node.innerHTML = `<span class="text-sm">${esc(message)}</span>${undo ? `<button type="button" class="shrink-0 font-heading text-xs font-bold uppercase tracking-wider underline" data-action="undo-toast" data-undo="${esc(undo.id)}">Undo</button>` : ""}`;
    region.appendChild(node);
    const timer = setTimeout(() => { if (node.isConnected) node.remove(); }, undo ? 6000 : 3600);
    if (undo) undoActions.set(undo.id, { fn: undo.fn, node, timer });
  };
  const undoActions = new Map();
  const flash = (id) => setTimeout(() => { const row = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`); if (row) row.classList.add("row-flash"); }, 20);
  const categories = () => [...new Set(state.items.map((item) => item.category))].sort();
  const navItems = [
    ["dashboard", "Dashboard", "grid"],
    ["inventory", "Inventory", "box"],
    ["movements", "Stock Movements", "move"],
    ["orders", "Purchase Orders", "clipboard"],
    ["suppliers", "Suppliers", "users"],
    ["reports", "Reports", "chart"]
  ];

  // Router and page state: hash navigation without reloading the document.
  let route = (location.hash.replace("#", "") || "dashboard");
  if (!navItems.some(([key]) => key === route)) route = "dashboard";
  let sidebarCollapsed = false;
  let inventoryPage = 1;
  let inventoryFilters = { q: "", category: "", status: "", sort: "name", dir: 1 };
  let movementFilters = { type: "", from: "", to: "", q: "" };
  let selectedItems = new Set();
  let inventoryImportRows = [];
  let importFileName = "";
  const navigate = (page) => {
    if (!navItems.some(([key]) => key === page)) return;
    route = page;
    if (location.hash !== `#${page}`) location.hash = page;
    render();
  };
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (navItems.some(([key]) => key === next)) { closeModal(); closeDrawer(); route = next; render(); }
  });
  const renderNav = () => {
    const navHTML = navItems.map(([key, label, icon]) => `<a href="#${key}" data-nav="${key}" class="group flex min-h-12 items-center gap-3 border-l-4 px-3 text-sm transition-colors ${route === key ? "border-hazard bg-white/10 font-semibold text-hazard" : "border-transparent text-concrete/75 hover:bg-white/5 hover:text-white"}"><svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-${icon}"/></svg><span class="nav-label">${label}</span></a>`).join("");
    $("#side-nav").innerHTML = navHTML;
    $("#mobile-nav").innerHTML = navItems.slice(0, 4).map(([key, label, icon]) => `<a href="#${key}" class="flex flex-col items-center justify-center gap-1 border-t-2 ${route === key ? "border-hazard text-hazard" : "border-transparent text-concrete/65"}"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-${icon}"/></svg><span class="font-heading text-[10px] font-bold uppercase tracking-wider">${key === "movements" ? "Moves" : key === "orders" ? "Orders" : label}</span></a>`).join("") + `<button data-action="mobile-more" class="flex flex-col items-center justify-center gap-1 border-t-2 border-transparent text-concrete/65"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-menu"/></svg><span class="font-heading text-[10px] font-bold uppercase tracking-wider">More</span></button>`;
    $("#low-counter").textContent = String(lowItems().length);
    $("#current-date").textContent = dateFmt(new Date());
    $("#sidebar").classList.toggle("w-20", sidebarCollapsed);
    $("#sidebar").classList.toggle("w-60", !sidebarCollapsed);
    $("#workspace").classList.toggle("md:ml-20", sidebarCollapsed);
    $("#workspace").classList.toggle("md:ml-60", !sidebarCollapsed);
    $$(".nav-label").forEach((el) => el.classList.toggle("hidden", sidebarCollapsed));
    $(".brand-copy").classList.toggle("hidden", sidebarCollapsed);
    $(".settings-label").classList.toggle("hidden", sidebarCollapsed);
    $(".logout-label").classList.toggle("hidden", sidebarCollapsed);
  };
  const render = () => {
    renderNav();
    const view = { dashboard: renderDashboard, inventory: renderInventory, movements: renderMovements, orders: renderOrders, suppliers: renderSuppliers, reports: renderReports }[route] || renderDashboard;
    $("#app").innerHTML = view();
    enhanceResponsiveTables();
  };
  const enhanceResponsiveTables = () => {
    if (route === "inventory") {
      const toolbar = $("#inventory-query")?.parentElement?.parentElement;
      if (toolbar) {
        const chips = document.createElement("div");
        chips.className = "mb-4 flex gap-2 overflow-x-auto pb-1";
        chips.innerHTML = [`All categories`, ...categories()].map((category) => `<button type="button" data-action="category-chip" data-category="${category === "All categories" ? "" : esc(category)}" class="min-h-10 shrink-0 border px-3 font-heading text-xs font-bold uppercase tracking-wider ${inventoryFilters.category === (category === "All categories" ? "" : category) ? "border-asphalt bg-hazard" : "border-steel/50 bg-white hover:bg-concrete"}">${esc(category)}</button>`).join("");
        toolbar.after(chips);
      }
    }
    $$("#app .overflow-x-auto:has(table)").forEach((tableWrap) => {
      const table = $("table", tableWrap);
      const headers = $$("thead th", table).map((cell) => cell.textContent.trim());
      const bodyRows = $$("tbody tr", table);
      if (!bodyRows.length) return;
      const cards = document.createElement("div");
      cards.className = "space-y-2 md:hidden";
      bodyRows.forEach((row) => {
        const card = document.createElement("article");
        card.className = "border border-steel/50 bg-white p-3";
        if (row.dataset.action) card.dataset.action = row.dataset.action;
        if (row.dataset.sku) card.dataset.sku = row.dataset.sku;
        if (row.dataset.rowId) card.dataset.rowId = row.dataset.rowId;
        $$("td", row).forEach((cell, index) => {
          if (!cell.innerHTML.trim()) return;
          const field = document.createElement("div");
          field.className = "flex items-start justify-between gap-3 border-b border-steel/20 py-2 last:border-0";
          if (cell.hasAttribute("data-stop-row")) field.dataset.stopRow = "";
          const label = document.createElement("span");
          label.className = "shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-steel";
          label.textContent = headers[index] || "";
          const value = document.createElement("span");
          value.className = "min-w-0 text-right text-sm";
          value.innerHTML = cell.innerHTML;
          field.append(label, value);
          card.appendChild(field);
        });
        cards.appendChild(card);
      });
      tableWrap.classList.add("hidden", "md:block");
      tableWrap.after(cards);
    });
  };

  // Dashboard: current stock position, urgent reorder cues, movement chart, activity.
  const renderDashboard = () => {
    const value = state.items.reduce((sum, item) => sum + item.qty * item.cost, 0);
    const openPOs = state.purchaseOrders.filter((po) => !["Received", "Cancelled"].includes(po.status)).length;
    const attention = lowItems();
    const recent = [...state.movements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const stats = [
      ["Total SKUs", num(state.items.length), "items on the yard", "box"],
      ["Stock value", peso(value), "at recorded unit cost", "chart"],
      ["Below reorder", num(attention.length), "need a yard check", "move"],
      ["Open POs", num(openPOs), "awaiting delivery", "clipboard"]
    ];
    return `${pageHeader("Yard overview", "Stock position, urgent replenishment, and recent yard activity.", "Add item", "add-item")}
      <div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${stats.map(([label, total, note, icon]) => `<section class="border border-asphalt bg-white p-4 shadow-yard"><div class="flex items-start justify-between"><span class="font-heading text-xs font-bold uppercase tracking-[.16em] text-steel">${label}</span><svg class="h-5 w-5 text-steel" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-${icon}"/></svg></div><div class="mt-3 font-mono text-2xl font-semibold">${total}</div><p class="mt-1 text-xs text-steel">${note}</p></section>`).join("")}</div>
      <div class="grid gap-8 xl:grid-cols-[1.05fr_.95fr]">
        <section>${sectionTitle("Needs attention", `<span class="font-mono text-xs text-steel">${attention.length} line${attention.length === 1 ? "" : "s"} at/below point</span>`)}
          ${attention.length ? `<div class="border border-steel/60 bg-white">${attention.slice(0, 7).map((item) => `<div class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-steel/25 p-3 last:border-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(110px,.9fr)_auto]"><div class="min-w-0"><button data-action="item-detail" data-sku="${esc(item.sku)}" class="block max-w-full truncate text-left font-semibold hover:underline">${esc(item.name)}</button><div class="mt-1 font-mono text-[11px] text-steel">${esc(item.sku)} · ${esc(item.bin)}</div></div><div class="col-span-2 flex items-center gap-2 sm:col-span-1">${tape(item)}<span class="whitespace-nowrap font-mono text-xs">${num(item.qty)}/${num(item.reorderPoint)}</span></div><button data-action="reorder-item" data-sku="${esc(item.sku)}" class="min-h-11 border border-asphalt bg-hazard px-3 font-heading text-xs font-bold uppercase tracking-wider hover:bg-yellow-400">Reorder</button></div>`).join("")}</div>${attention.length > 7 ? `<button data-nav="inventory" class="mt-3 font-heading text-sm font-bold uppercase tracking-wider underline">View all ${attention.length} flagged items →</button>` : ""}` : emptyState("All racks above minimum", "Everything is at or above its reorder point. Keep checking the tape after each site issue.", null, null)}
        </section>
        <section>${sectionTitle("Movement / last 14 days")}<div class="blueprint-grid border border-asphalt p-4 shadow-yard"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><p class="font-heading text-sm font-bold uppercase tracking-widest text-white">Stock in / stock out</p><div class="flex gap-4 font-mono text-[11px] text-white"><span><i class="mr-1 inline-block h-2.5 w-2.5 bg-hazard"></i>IN</span><span><i class="mr-1 inline-block h-2.5 w-2.5 bg-white"></i>OUT</span></div></div>${movementChart()}</div></section>
        <section class="xl:col-span-2">${sectionTitle("Recent yard activity", `<button data-nav="movements" class="font-heading text-sm font-bold uppercase tracking-wider underline">Full movement log →</button>`)}
          ${recent.length ? `<div class="overflow-x-auto border border-steel/60 bg-white"><table class="w-full border-collapse text-left text-sm"><thead class="bg-asphalt text-xs uppercase tracking-wider text-white"><tr><th class="p-3">Date</th><th class="p-3">Type</th><th class="p-3">Item / SKU</th><th class="p-3">Qty</th><th class="p-3">Reference</th><th class="p-3">Staff</th><th class="p-3">Note</th></tr></thead><tbody>${recent.map((move) => movementRow(move)).join("")}</tbody></table></div>` : emptyState("No movement on the sheet yet", "Log the first delivery, site issue, count correction, or rack transfer to start the activity record.", "Log a move", "quick-move")}
        </section>
      </div>`;
  };
  const movementChart = () => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (13 - i));
      const key = date.toDateString();
      const moves = state.movements.filter((m) => new Date(m.date).toDateString() === key);
      return { label: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), incoming: moves.filter((m) => m.type === "IN").reduce((n, m) => n + Math.abs(m.qty), 0), outgoing: moves.filter((m) => m.type === "OUT" || m.type === "ADJUST" && m.qty < 0).reduce((n, m) => n + Math.abs(m.qty), 0) };
    });
    const max = Math.max(20, ...days.flatMap((d) => [d.incoming, d.outgoing]));
    const width = 560; const height = 190; const chartTop = 12; const chartBottom = 148; const barW = 11;
    const bars = days.map((d, i) => {
      const x = 25 + i * 38;
      const inH = d.incoming / max * 125; const outH = d.outgoing / max * 125;
      return `<rect x="${x}" y="${chartBottom - inH}" width="${barW}" height="${Math.max(inH, 1)}" fill="#F5B700"/><rect x="${x + 13}" y="${chartBottom - outH}" width="${barW}" height="${Math.max(outH, 1)}" fill="#E7E5E0"/><text x="${x + 9}" y="168" text-anchor="middle" fill="#E7E5E0" font-size="9" font-family="IBM Plex Mono">${d.label}</text>`;
    }).join("");
    const grid = [0, 1, 2, 3].map((i) => { const y = chartTop + i * 42; return `<line x1="20" y1="${y}" x2="${width - 8}" y2="${y}" stroke="rgba(231,229,224,.22)"/><text x="0" y="${y + 3}" fill="#E7E5E0" font-size="9" font-family="IBM Plex Mono">${Math.round(max * (3 - i) / 3)}</text>`; }).join("");
    return `<svg viewBox="0 0 ${width} ${height}" class="h-52 w-full" role="img" aria-label="Bar chart of stock moved in and out over the last 14 days">${grid}${bars}</svg>`;
  };

  // Inventory: filters, sorting, paging, bulk actions, CSV and row-level controls.
  const filteredItems = () => {
    const q = inventoryFilters.q.trim().toLowerCase();
    let rows = state.items.filter((item) => (!q || [item.sku, item.name, item.category, item.supplier, item.bin].some((v) => String(v).toLowerCase().includes(q))) &&
      (!inventoryFilters.category || item.category === inventoryFilters.category) &&
      (!inventoryFilters.status || stockStatus(item) === inventoryFilters.status));
    rows.sort((a, b) => {
      const av = inventoryFilters.sort === "status" ? stockStatus(a) : a[inventoryFilters.sort];
      const bv = inventoryFilters.sort === "status" ? stockStatus(b) : b[inventoryFilters.sort];
      const cmp = typeof av === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return cmp * inventoryFilters.dir;
    });
    return rows;
  };
  const renderInventory = () => {
    const all = filteredItems(); const pages = Math.max(1, Math.ceil(all.length / 15));
    inventoryPage = Math.min(inventoryPage, pages);
    const rows = all.slice((inventoryPage - 1) * 15, inventoryPage * 15);
    const sortHead = (field, label) => `<button data-sort="${field}" class="flex items-center gap-1 font-heading text-xs font-bold uppercase tracking-wider">${label}${inventoryFilters.sort === field ? (inventoryFilters.dir > 0 ? " ↑" : " ↓") : ""}</button>`;
    return `${pageHeader("Inventory ledger", "Every rack, quantity, and reorder threshold in one place.", "Add item", "add-item")}
      <div class="mb-4 flex flex-wrap items-center gap-2 border border-steel/50 bg-white p-3">
        <label class="relative min-w-[210px] flex-1"><span class="sr-only">Search inventory</span><input id="inventory-query" type="search" value="${esc(inventoryFilters.q)}" placeholder="Find SKU, item, supplier, bin…" class="h-11 w-full border border-steel/50 pl-3 pr-3 text-sm"></label>
        <select id="category-filter" aria-label="Category filter" class="h-11 min-w-[140px] border border-steel/50 bg-white px-3 text-sm"><option value="">All categories</option>${categories().map((c) => `<option ${inventoryFilters.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <select id="status-filter" aria-label="Status filter" class="h-11 min-w-[130px] border border-steel/50 bg-white px-3 text-sm"><option value="">All stock status</option>${["IN STOCK","LOW","OUT"].map((s) => `<option ${inventoryFilters.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <button data-action="export-inventory" class="flex h-11 items-center gap-2 border border-asphalt px-3 font-heading text-xs font-bold uppercase tracking-wider hover:bg-concrete"><svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-download"/></svg>Export CSV</button>
        <button data-action="import-inventory" class="flex h-11 items-center gap-2 border border-asphalt px-3 font-heading text-xs font-bold uppercase tracking-wider hover:bg-concrete"><svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-upload"/></svg>Import CSV</button>
      </div>
      ${selectedItems.size ? `<div class="mb-3 flex flex-wrap items-center gap-2 border border-asphalt bg-hazard/30 p-3"><span class="mr-2 font-mono text-sm">${selectedItems.size} selected</span>${btn("Change category", "bulk-category", "bg-white")} ${btn("Delete selected", "bulk-delete", "bg-white text-rebar")}</div>` : ""}
      ${rows.length ? `<div class="overflow-x-auto border border-asphalt bg-white"><table class="w-full min-w-[1050px] border-collapse text-left text-sm"><thead class="border-b border-asphalt bg-concrete"><tr><th class="w-10 p-3"><input type="checkbox" aria-label="Select all visible items" data-check-all></th><th class="p-3">${sortHead("sku","SKU")}</th><th class="p-3">${sortHead("name","Item name")}</th><th class="p-3">${sortHead("category","Category")}</th><th class="p-3">${sortHead("unit","Unit")}</th><th class="p-3">${sortHead("bin","Bin")}</th><th class="min-w-[180px] p-3">${sortHead("qty","Quantity / tape")}</th><th class="p-3">${sortHead("cost","Unit cost")}</th><th class="p-3">${sortHead("status","Status")}</th></tr></thead><tbody>${rows.map((item) => `<tr data-row-id="${esc(item.sku)}" data-action="item-detail" data-sku="${esc(item.sku)}" class="cursor-pointer border-b border-steel/30 even:bg-concrete/55 hover:bg-hazard/10"><td class="p-3" data-stop-row><input type="checkbox" data-select-item="${esc(item.sku)}" aria-label="Select ${esc(item.name)}" ${selectedItems.has(item.sku) ? "checked" : ""}></td><td class="p-3 font-mono text-xs font-semibold">${esc(item.sku)}</td><td class="p-3 font-semibold">${esc(item.name)}<div class="mt-1 font-mono text-[10px] font-normal text-steel">${esc(item.supplier || "")}</div></td><td class="p-3">${esc(item.category)}</td><td class="p-3">${esc(item.unit)}</td><td class="p-3"><span class="inline-block border border-steel px-2 py-1 font-mono text-xs">${esc(item.bin)}</span></td><td class="p-3"><div class="flex items-center gap-2">${tape(item)}<span class="whitespace-nowrap font-mono text-xs">${num(item.qty)} ${esc(item.unit)}</span></div></td><td class="p-3 font-mono text-xs">${peso(item.cost)}</td><td class="p-3">${statusTag(stockStatus(item))}</td></tr>`).join("")}</tbody></table></div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><p class="font-mono text-xs text-steel">Showing ${all.length ? (inventoryPage - 1) * 15 + 1 : 0}–${Math.min(inventoryPage * 15, all.length)} of ${all.length} records</p><div class="flex items-center gap-2">${btn("Previous", "page-prev", "bg-white disabled:opacity-40")}<span class="px-2 font-mono text-sm">${inventoryPage} / ${pages}</span>${btn("Next", "page-next", "bg-white")}</div></div>`
        : emptyState("No stock matches this sheet", "Change a filter or add an item. Every item needs a unique SKU and a bin location.", "Add item", "add-item")}`;
  };
  const inventoryCSV = (items) => downloadCSV("yard-inventory.csv", ["SKU","Name","Category","Unit","Bin","Quantity","Reorder Point","Max Stock","Unit Cost","Supplier"], items.map((i) => [i.sku,i.name,i.category,i.unit,i.bin,i.qty,i.reorderPoint,i.maxStock,i.cost,i.supplier]));
  const downloadCSV = (filename, headers, rows) => {
    const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    link.download = filename; link.click(); URL.revokeObjectURL(link.href);
    toast(`${filename} exported.`, "success");
  };

  // Stock movements: searchable ledger and explicit stock-in/out/adjust/transfer.
  const movementRow = (move) => {
    const item = itemBySku(move.sku);
    const movementTone = move.type === "IN" ? "text-safety" : move.type === "OUT" ? "text-rebar" : "text-steel";
    const shownQty = move.type === "OUT" ? `−${num(Math.abs(move.qty))}` : move.type === "ADJUST" && move.qty < 0 ? `−${num(Math.abs(move.qty))}` : `+${num(move.qty)}`;
    return `<tr class="border-b border-steel/25 even:bg-concrete/55"><td class="whitespace-nowrap p-3 font-mono text-xs">${dateTimeFmt(move.date)}</td><td class="p-3 font-heading text-xs font-bold uppercase tracking-wider ${movementTone}">${esc(move.type)}</td><td class="p-3">${esc(item?.name || "Removed item")}<div class="font-mono text-[10px] text-steel">${esc(move.sku)}</div></td><td class="p-3 text-right font-mono text-xs">${shownQty}</td><td class="p-3 font-mono text-xs">${esc(move.reference || "—")}</td><td class="p-3">${esc(move.staff || "—")}</td><td class="p-3 text-steel">${esc(move.note || "—")}</td></tr>`;
  };
  const filteredMovements = () => [...state.movements].filter((m) => {
    const item = itemBySku(m.sku); const q = movementFilters.q.toLowerCase();
    return (!movementFilters.type || m.type === movementFilters.type) &&
      (!movementFilters.from || m.date.slice(0,10) >= movementFilters.from) &&
      (!movementFilters.to || m.date.slice(0,10) <= movementFilters.to) &&
      (!q || [m.reference,m.staff,m.note,m.sku,item?.name].some((x) => String(x || "").toLowerCase().includes(q)));
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
  const renderMovements = () => {
    const rows = filteredMovements();
    return `${pageHeader("Stock movements", "A signed record of every delivery, site issue, count, and rack transfer.", "Log movement", "quick-move", "move")}
      <div class="mb-4 grid gap-2 border border-steel/50 bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
        <input id="move-query" value="${esc(movementFilters.q)}" placeholder="Search project, SKU, staff…" class="h-11 border border-steel/50 px-3 text-sm">
        <select id="move-type-filter" class="h-11 border border-steel/50 bg-white px-3 text-sm" aria-label="Movement type"><option value="">All movement types</option>${["IN","OUT","ADJUST","TRANSFER"].map((x) => `<option ${movementFilters.type === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <label class="flex items-center gap-2 border border-steel/50 px-2 text-xs text-steel">From <input id="move-from" type="date" value="${esc(movementFilters.from)}" class="min-w-0 flex-1 py-2 font-mono text-sm text-asphalt"></label>
        <label class="flex items-center gap-2 border border-steel/50 px-2 text-xs text-steel">To <input id="move-to" type="date" value="${esc(movementFilters.to)}" class="min-w-0 flex-1 py-2 font-mono text-sm text-asphalt"></label>
      </div>
      ${rows.length ? `<div class="overflow-x-auto border border-asphalt bg-white"><table class="w-full min-w-[900px] border-collapse text-left text-sm"><thead class="bg-asphalt text-xs uppercase tracking-wider text-white"><tr><th class="p-3">Date</th><th class="p-3">Type</th><th class="p-3">SKU / Item</th><th class="p-3 text-right">Qty</th><th class="p-3">Reference / project</th><th class="p-3">Staff</th><th class="p-3">Note</th></tr></thead><tbody>${rows.map(movementRow).join("")}</tbody></table></div>` : emptyState("No movement on this sheet", "This filter has no matching site issues or deliveries. Clear the filters or log a new movement.", "Log a move", "quick-move")}`;
  };
  const recordMovement = ({ type, sku, qty, reference, staff, note, toBin }) => {
    const item = itemBySku(sku);
    if (!item) throw new Error("Choose a SKU that is still in the inventory ledger.");
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount < 0 || (type !== "ADJUST" && amount === 0)) throw new Error(type === "ADJUST" ? "Counted quantity cannot be negative." : "Quantity must be greater than zero.");
    if (type === "OUT" && item.qty < amount) throw new Error(`Not enough stock: ${item.name} has ${num(item.qty)} ${item.unit} available.`);
    const previousQty = item.qty;
    const previousBin = item.bin;
    if (type === "IN") item.qty += amount;
    else if (type === "OUT") item.qty -= amount;
    else if (type === "ADJUST") item.qty = amount;
    else if (type === "TRANSFER") {
      if (!toBin?.trim()) throw new Error("Enter the destination bin for this transfer.");
      item.bin = toBin.trim();
    }
    item.updatedAt = new Date().toISOString();
    const signedQty = type === "OUT" ? -amount : type === "ADJUST" ? amount - previousQty : amount;
    const movementNote = type === "TRANSFER" ? `${previousBin} → ${toBin.trim()}${note.trim() ? ` · ${note.trim()}` : ""}` : note.trim();
    state.movements.push({ id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, type, sku, qty: signedQty, reference: reference.trim(), staff: staff.trim(), note: movementNote, date: new Date().toISOString(), ...(type === "TRANSFER" ? { fromBin: previousBin, toBin: toBin.trim() } : {}) });
    persist();
  };

  // Purchase orders: supplier lines, totals, status transitions, and receiving.
  const poStatusClass = (status) => status === "Received" ? "bg-safety text-white" : status === "Cancelled" ? "bg-steel text-white" : status === "Partially Received" ? "bg-hazard text-asphalt" : "bg-asphalt text-white";
  const poTag = (status) => `<span class="hazard-tag inline-block px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wider ${poStatusClass(status)}">${esc(status)}</span>`;
  const poTotal = (po) => po.lines.reduce((sum, line) => sum + line.qty * line.cost, 0);
  const renderOrders = () => {
    const orders = [...state.purchaseOrders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `${pageHeader("Purchase orders", "Track supplier commitments from draft through receiving.", "Create purchase order", "create-po", "plus")}
      ${orders.length ? `<div class="overflow-x-auto border border-asphalt bg-white"><table class="w-full min-w-[800px] border-collapse text-left text-sm"><thead class="bg-concrete"><tr><th class="p-3 font-heading text-xs uppercase tracking-wider">PO number</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Supplier / reference</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Date</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Lines</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Total</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Status</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Actions</th></tr></thead><tbody>${orders.map((po) => `<tr class="border-t border-steel/30 even:bg-concrete/50"><td class="p-3 font-mono text-xs font-semibold">${esc(po.id)}</td><td class="p-3 font-semibold">${esc(supplierById(po.supplierId)?.name || "Supplier removed")}<div class="font-mono text-[10px] font-normal text-steel">${esc(po.reference || "")}</div></td><td class="p-3 font-mono text-xs">${dateFmt(po.createdAt)}</td><td class="p-3 font-mono text-xs">${po.lines.length}</td><td class="p-3 font-mono text-xs">${peso(poTotal(po))}</td><td class="p-3">${poTag(po.status)}</td><td class="p-3"><div class="flex flex-wrap gap-1">${btn("View / print", `po-view:${po.id}`, "min-h-9 bg-white px-2 text-[10px]")}${po.status === "Draft" ? btn("Send", `po-send:${po.id}`, "min-h-9 bg-hazard px-2 text-[10px]") : ""}${["Sent","Partially Received"].includes(po.status) ? btn("Receive", `po-receive:${po.id}`, "min-h-9 bg-safety px-2 text-[10px] text-white") : ""}${!["Received","Cancelled"].includes(po.status) ? btn("Cancel", `po-cancel:${po.id}`, "min-h-9 bg-white px-2 text-[10px] text-rebar") : ""}</div></td></tr>`).join("")}</tbody></table></div>` : emptyState("No purchase order has been written", "Create a draft with the supplier, item lines, and quantities. Send it when the yard is ready.", "Create purchase order", "create-po")}
      <p class="mt-4 text-xs text-steel">Receiving an order logs each delivered line as an IN movement and updates on-hand stock.</p>`;
  };
  const poMarkup = (po) => `<div class="print-area mx-auto max-w-3xl border border-asphalt bg-white p-6 sm:p-10"><div class="flex flex-wrap items-start justify-between gap-4 border-b-2 border-asphalt pb-5"><div><p class="font-mono text-xs uppercase tracking-widest text-steel">VIEWERS · Purchase order</p><h2 class="mt-2 font-heading text-4xl font-bold uppercase">${esc(po.id)}</h2></div><div class="text-right">${poTag(po.status)}<p class="mt-2 font-mono text-xs">${dateFmt(po.createdAt)}</p></div></div><div class="grid gap-4 py-5 sm:grid-cols-2"><div><p class="font-heading text-xs font-bold uppercase tracking-wider text-steel">Supplier</p><p class="mt-1 font-semibold">${esc(supplierById(po.supplierId)?.name || "Supplier removed")}</p></div><div><p class="font-heading text-xs font-bold uppercase tracking-wider text-steel">Reference</p><p class="mt-1">${esc(po.reference || "—")}</p></div></div><div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead class="bg-asphalt text-left text-white"><tr><th class="p-3">SKU / item</th><th class="p-3 text-right">Qty</th><th class="p-3 text-right">Received</th><th class="p-3 text-right">Unit cost</th><th class="p-3 text-right">Line total</th></tr></thead><tbody>${po.lines.map((line) => `<tr class="border-b border-steel/30"><td class="p-3">${esc(itemBySku(line.sku)?.name || "Removed item")}<div class="font-mono text-xs text-steel">${esc(line.sku)}</div></td><td class="p-3 text-right font-mono">${num(line.qty)}</td><td class="p-3 text-right font-mono">${num(line.received || 0)}</td><td class="p-3 text-right font-mono">${peso(line.cost)}</td><td class="p-3 text-right font-mono">${peso(line.qty * line.cost)}</td></tr>`).join("")}</tbody></table></div><div class="mt-5 flex justify-end"><p class="font-heading text-xl font-bold uppercase">Total <span class="ml-4 font-mono">${peso(poTotal(po))}</span></p></div></div>`;

  // Suppliers: maintained contact directory and linked item list.
  const renderSuppliers = () => `${pageHeader("Supplier directory", "Keep current contacts and lead times close to the receiving desk.", "Add supplier", "add-supplier")}
    ${state.suppliers.length ? `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${state.suppliers.map((supplier) => {
      const supplied = state.items.filter((i) => i.supplier === supplier.name);
      return `<article data-row-id="${esc(supplier.id)}" class="border border-asphalt bg-white p-5 shadow-yard"><div class="flex items-start justify-between gap-3"><div><h2 class="font-heading text-2xl font-bold uppercase tracking-wide">${esc(supplier.name)}</h2><p class="mt-1 font-mono text-xs text-steel">${esc(supplier.id)} · ${num(supplier.leadTime)} day average lead</p></div><div class="flex gap-1">${btn("Edit", `supplier-edit:${supplier.id}`, "min-h-9 bg-white px-2 text-[10px]")}${btn("Delete", `supplier-delete:${supplier.id}`, "min-h-9 bg-white px-2 text-[10px] text-rebar")}</div></div><div class="hazard-rule my-4"></div><p class="text-sm"><strong>Contact:</strong> ${esc(supplier.contact)}</p><p class="mt-1 text-sm"><strong>Phone:</strong> <a class="underline" href="tel:${esc(supplier.phone)}">${esc(supplier.phone)}</a></p><p class="mt-1 break-all text-sm"><strong>Email:</strong> <a class="underline" href="mailto:${esc(supplier.email)}">${esc(supplier.email)}</a></p><p class="mt-3 text-xs text-steel">${esc(supplier.items || "No item categories listed")} · ${supplied.length} SKUs in yard</p></article>`;
    }).join("")}</div>` : emptyState("No supplier contacts yet", "Add the vendors that keep the yard running, with a direct contact and realistic lead time.", "Add supplier", "add-supplier")}`;

  // Reports: category valuation, 30-day mover pace, and low-stock export.
  const renderReports = () => {
    const categoryRows = categories().map((category) => {
      const items = state.items.filter((item) => item.category === category);
      return { category, skus: items.length, qty: items.reduce((s, i) => s + i.qty, 0), value: items.reduce((s, i) => s + i.qty * i.cost, 0) };
    }).sort((a,b) => b.value - a.value);
    const since = Date.now() - 30 * 86400000;
    const movementCount = (sku) => state.movements.filter((m) => m.sku === sku && new Date(m.date).getTime() >= since && m.type === "OUT").reduce((n,m) => n + Math.abs(m.qty), 0);
    const moverRows = [...state.items].map((item) => ({ item, moved: movementCount(item.sku) })).sort((a,b) => b.moved - a.moved);
    const low = lowItems();
    if (!state.items.length) return `${pageHeader("Yard reports", "Valuation and movement signals for the last 30 days.", "Add item", "add-item")} ${emptyState("Nothing on the ledger to report", "Add the first yard item to build category valuation, movement pace, and low-stock reports.", "Add item", "add-item")}`;
    return `${pageHeader("Yard reports", "Valuation and movement signals for the last 30 days.", "Print report", "print-report", "printer")}
      <section class="mb-8">${sectionTitle("Inventory valuation by category", `<button data-action="export-report:valuation" class="font-heading text-xs font-bold uppercase tracking-wider underline">Export CSV</button>`)}
        <div class="overflow-x-auto border border-asphalt bg-white"><table class="w-full border-collapse text-left text-sm"><thead class="bg-concrete"><tr><th class="p-3 font-heading text-xs uppercase tracking-wider">Category</th><th class="p-3 font-heading text-xs uppercase tracking-wider">SKUs</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Units on hand</th><th class="p-3 text-right font-heading text-xs uppercase tracking-wider">Stock value</th></tr></thead><tbody>${categoryRows.map((r) => `<tr class="border-t border-steel/25 even:bg-concrete/50"><td class="p-3 font-semibold">${esc(r.category)}</td><td class="p-3 font-mono">${num(r.skus)}</td><td class="p-3 font-mono">${num(r.qty)}</td><td class="p-3 text-right font-mono">${peso(r.value)}</td></tr>`).join("")}</tbody><tfoot class="border-t-2 border-asphalt bg-concrete font-semibold"><tr><td class="p-3">Total</td><td class="p-3 font-mono">${num(state.items.length)}</td><td class="p-3 font-mono">${num(state.items.reduce((s,i) => s+i.qty,0))}</td><td class="p-3 text-right font-mono">${peso(state.items.reduce((s,i) => s+i.qty*i.cost,0))}</td></tr></tfoot></table></div>
      </section>
      <section class="mb-8">${sectionTitle("Fast & slow movers", `<span class="font-mono text-xs text-steel">Site issues · trailing 30 days</span>`)}
        <div class="grid gap-5 lg:grid-cols-2"><div class="border border-steel/50 bg-white p-4"><h3 class="mb-3 font-heading text-lg font-bold uppercase tracking-wider">Fast movers</h3>${moverRows.slice(0,5).map((r,i) => `<div class="flex justify-between gap-3 border-t border-steel/20 py-2 text-sm"><span><span class="mr-2 font-mono text-xs text-steel">0${i+1}</span>${esc(r.item.name)}</span><strong class="font-mono">${num(r.moved)}</strong></div>`).join("")}</div><div class="border border-steel/50 bg-white p-4"><h3 class="mb-3 font-heading text-lg font-bold uppercase tracking-wider">Slow / no movement</h3>${moverRows.slice(-5).reverse().map((r,i) => `<div class="flex justify-between gap-3 border-t border-steel/20 py-2 text-sm"><span>${esc(r.item.name)}</span><strong class="font-mono">${num(r.moved)}</strong></div>`).join("")}</div></div>
      </section>
      <section>${sectionTitle("Low-stock report", `<button data-action="export-report:low" class="font-heading text-xs font-bold uppercase tracking-wider underline">Export CSV</button>`)}
        ${low.length ? `<div class="overflow-x-auto border border-asphalt bg-white"><table class="w-full min-w-[620px] border-collapse text-left text-sm"><thead class="bg-concrete"><tr><th class="p-3 font-heading text-xs uppercase tracking-wider">SKU / item</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Bin</th><th class="p-3 font-heading text-xs uppercase tracking-wider">On hand</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Reorder at</th><th class="p-3 font-heading text-xs uppercase tracking-wider">Supplier</th><th class="p-3"></th></tr></thead><tbody>${low.map((i) => `<tr class="border-t border-steel/25 even:bg-concrete/50"><td class="p-3">${esc(i.name)}<div class="font-mono text-[10px] text-steel">${esc(i.sku)}</div></td><td class="p-3 font-mono">${esc(i.bin)}</td><td class="p-3 font-mono">${num(i.qty)} ${esc(i.unit)}</td><td class="p-3 font-mono">${num(i.reorderPoint)}</td><td class="p-3">${esc(i.supplier)}</td><td class="p-3"><button data-action="reorder-item" data-sku="${esc(i.sku)}" class="font-heading text-xs font-bold uppercase underline">Reorder</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("No stock below minimum", "The low-stock report is clear. Items below their reorder point will show here.", null, null)}
      </section>`;
  };

  // Drawers and modals: forms validate before any state is committed.
  const openDrawer = (title, content, wide = false) => {
    $("#drawer-root").innerHTML = `<div class="drawer-backdrop fixed inset-0 z-50 bg-asphalt/45" data-action="close-drawer"><aside role="dialog" aria-modal="true" aria-labelledby="drawer-heading" class="drawer-panel open absolute inset-y-0 right-0 flex w-full flex-col border-l border-asphalt bg-concrete ${wide ? "max-w-3xl" : "max-w-xl"}" data-panel><div class="flex min-h-[72px] items-center justify-between border-b border-asphalt px-5"><div><p class="font-mono text-[10px] uppercase tracking-[.2em] text-steel">VIEWERS / edit panel</p><h2 id="drawer-heading" class="font-heading text-2xl font-bold uppercase tracking-wider">${esc(title)}</h2></div><button data-action="close-drawer" class="grid h-11 w-11 place-items-center border border-asphalt bg-white" aria-label="Close drawer"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-close"/></svg></button></div><div class="min-h-0 flex-1 overflow-y-auto p-5">${content}</div></aside></div>`;
  };
  const closeDrawer = () => { $("#drawer-root").innerHTML = ""; };
  const openModal = (title, content, wide = false) => {
    $("#modal-root").innerHTML = `<div class="modal-backdrop fixed inset-0 z-[60] grid place-items-center bg-asphalt/55 p-3 sm:p-6" data-action="close-modal"><section role="dialog" aria-modal="true" aria-labelledby="modal-heading" class="modal-surface max-h-[92vh] w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-y-auto border border-asphalt shadow-yard" data-panel><div class="flex items-center justify-between border-b border-asphalt bg-white px-5 py-4"><h2 id="modal-heading" class="font-heading text-2xl font-bold uppercase tracking-wider">${esc(title)}</h2><button data-action="close-modal" class="grid h-11 w-11 place-items-center border border-asphalt bg-white" aria-label="Close dialog"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-close"/></svg></button></div><div class="bg-white p-5">${content}</div></section></div>`;
  };
  const closeModal = () => { $("#modal-root").innerHTML = ""; };
  const field = (label, name, value = "", type = "text", required = false, hint = "") => `<label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">${esc(label)}${required ? " *" : ""}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${required ? "required" : ""} class="min-h-11 w-full border border-steel/60 bg-white px-3 text-sm" ${type === "number" ? 'step="any"' : ""}>${hint ? `<span class="mt-1 block text-[11px] text-steel">${esc(hint)}</span>` : ""}</label>`;
  const selectField = (label, name, choices, value, required = true) => `<label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">${esc(label)}${required ? " *" : ""}</span><select name="${esc(name)}" ${required ? "required" : ""} class="min-h-11 w-full border border-steel/60 bg-white px-3 text-sm">${choices.map((choice) => `<option value="${esc(choice)}" ${choice === value ? "selected" : ""}>${esc(choice)}</option>`).join("")}</select></label>`;
  const showFormError = (form, message) => {
    let element = $("[data-form-error]", form);
    if (!element) { element = document.createElement("p"); element.dataset.formError = ""; element.className = "border-l-4 border-rebar bg-rebar/10 px-3 py-2 text-sm text-rebar"; form.prepend(element); }
    element.textContent = message;
    form.closest("[data-panel]")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const itemForm = (item = {}) => {
    const editing = Boolean(item.sku);
    const unitChoices = ["bag","pc","m","kg","bundle","sheet","roll","pair","box"];
    return `<form data-form="${editing ? "edit-item" : "new-item"}" data-original-sku="${esc(item.sku || "")}" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">${field("SKU","sku",item.sku || "", "text", true, "Must be unique.")}${field("Item name","name",item.name || "", "text", true)}
      ${field("Category","category",item.category || "", "text", true)}${selectField("Unit","unit",unitChoices,item.unit || "pc")}
      ${field("Bin location","bin",item.bin || "", "text", true)}${field("Quantity on hand","qty",item.qty ?? 0, "number", true)}
      ${field("Reorder point","reorderPoint",item.reorderPoint ?? 1, "number", true)}${field("Maximum stock","maxStock",item.maxStock ?? 100, "number", true)}
      ${field("Unit cost (₱)","cost",item.cost ?? 0, "number", true)}${field("Supplier","supplier",item.supplier || "", "text", true)}</div>
      <div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-drawer","bg-white") }<button class="min-h-11 border border-asphalt bg-hazard px-5 font-heading text-sm font-bold uppercase tracking-wider">${editing ? "Save item" : "Add to ledger"}</button></div></form>`;
  };
  const showItemForm = (item) => openDrawer(item ? "Edit inventory item" : "Add inventory item", itemForm(item));
  const showItemDetail = (sku) => {
    const item = itemBySku(sku); if (!item) return;
    const moves = [...state.movements].filter((m) => m.sku === sku).sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,12);
    openDrawer(item.name, `<div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">${[["SKU",item.sku],["Category",item.category],["Unit",item.unit],["Bin",item.bin]].map(([k,v]) => `<div class="border border-steel/50 bg-white p-3"><p class="font-heading text-[10px] font-bold uppercase tracking-widest text-steel">${esc(k)}</p><p class="mt-1 font-mono text-sm">${esc(v)}</p></div>`).join("")}</div>
      <div class="mb-5 border border-asphalt bg-white p-4 shadow-yard"><div class="flex items-center justify-between gap-3"><div><p class="font-heading text-xs font-bold uppercase tracking-wider text-steel">On hand</p><p class="mt-1 font-mono text-3xl">${num(item.qty)} <span class="text-sm">${esc(item.unit)}</span></p></div>${statusTag(stockStatus(item))}</div><div class="mt-4">${tape(item)}</div><div class="mt-2 flex justify-between font-mono text-[10px] text-steel"><span>0</span><span>REORDER ${num(item.reorderPoint)}</span><span>MAX ${num(item.maxStock)}</span></div></div>
      <div class="grid grid-cols-2 gap-3">${btn("Stock in",`detail-move:IN:${sku}`,"bg-safety text-white")} ${btn("Stock out",`detail-move:OUT:${sku}`,"bg-white")} ${btn("Adjust count",`detail-move:ADJUST:${sku}`,"bg-white")} ${btn("Edit item",`detail-edit:${sku}`,"bg-hazard")}</div>
      <div class="mt-7">${sectionTitle("Movement history", `<span class="font-mono text-xs text-steel">${moves.length} recent</span>`)}${moves.length ? `<div class="space-y-2">${moves.map((m) => `<div class="border border-steel/40 bg-white p-3"><div class="flex justify-between gap-3"><span class="font-heading text-xs font-bold uppercase tracking-wider">${esc(m.type)} · ${esc(m.reference || "No reference")}</span><span class="font-mono text-xs">${m.type === "OUT" ? "−" : "+"}${num(Math.abs(m.qty))}</span></div><p class="mt-1 text-xs text-steel">${dateTimeFmt(m.date)} · ${esc(m.staff || "—")} · ${esc(m.note || "—")}</p></div>`).join("")}</div>` : `<p class="border border-steel/40 bg-white p-4 text-sm text-steel">No movements recorded for this item yet.</p>`}</div>
      <div class="mt-6 flex justify-between gap-2 border-t border-steel/40 pt-4"><button data-action="delete-item" data-sku="${esc(sku)}" class="min-h-11 border border-asphalt bg-white px-4 font-heading text-sm font-bold uppercase text-rebar">Delete item</button><button data-action="edit-item" data-sku="${esc(sku)}" class="min-h-11 border border-asphalt bg-hazard px-4 font-heading text-sm font-bold uppercase tracking-wider">Edit details</button></div>`);
  };
  const confirmDelete = (kind, id, label) => openModal("Confirm yard record deletion", `<p class="mb-5 text-sm">Remove <strong>${esc(label)}</strong> from the ledger? This can be undone for 6 seconds.</p><div class="flex justify-end gap-2">${btn("Keep record","close-modal","bg-white")}<button data-action="confirm-delete:${esc(kind)}:${esc(id)}" class="min-h-11 border border-asphalt bg-rebar px-4 font-heading text-sm font-bold uppercase text-white">Delete record</button></div>`);
  const openQuickMove = (presetType = "OUT", presetSku = "") => {
    const type = ["IN","OUT","ADJUST","TRANSFER"].includes(presetType) ? presetType : "OUT";
    const options = state.items.map((item) => `<option value="${esc(item.sku)}" ${item.sku === presetSku ? "selected" : ""}>${esc(item.sku)} — ${esc(item.name)} (${num(item.qty)} ${esc(item.unit)})</option>`).join("");
    const staffOptions = state.staff.map((name) => `<option>${esc(name)}</option>`).join("");
    openModal("Quick stock move", `<form data-form="quick-move" class="space-y-4">
      <p class="border-l-4 border-hazard bg-white px-3 py-2 text-sm">A stock-out cannot exceed what the yard has on hand. All entries are added to the movement log.</p>
      ${selectField("Movement type","type",["IN","OUT","ADJUST","TRANSFER"],type)}
      <label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">Item / SKU *</span><input name="sku-search" list="sku-list" value="${esc(presetSku)}" placeholder="Type a SKU or item name" required class="min-h-11 w-full border border-steel/60 bg-white px-3 text-sm"><datalist id="sku-list">${state.items.map((i) => `<option value="${esc(i.sku)}">${esc(i.name)}</option><option value="${esc(i.name)}">${esc(i.sku)}</option>`).join("")}</datalist><input name="sku" type="hidden" value="${esc(presetSku)}"></label>
      ${field(type === "ADJUST" ? "Counted quantity" : "Quantity","qty",1,"number",true)}
      <div data-transfer-bin class="${type === "TRANSFER" ? "" : "hidden"}">${field("Destination bin","toBin","","text",type === "TRANSFER")}</div>
      ${field("Project / PO reference","reference","","text",true,"Examples: Site Alpha, PO-2026-016")}
      <label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">Staff *</span><select name="staff" required class="min-h-11 w-full border border-steel/60 bg-white px-3 text-sm">${staffOptions}</select></label>
      <label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">Note</span><textarea name="note" rows="2" class="w-full border border-steel/60 bg-white p-3 text-sm"></textarea></label>
      <div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-modal","bg-white")}<button class="min-h-11 border border-asphalt bg-hazard px-5 font-heading text-sm font-bold uppercase tracking-wider">Record movement</button></div></form>`, false);
    const form = $('[data-form="quick-move"]');
    const skuInput = $('input[name="sku-search"]', form);
    const hiddenSku = $('input[name="sku"]', form);
    const syncSku = () => {
      const match = state.items.find((i) => i.sku.toLowerCase() === skuInput.value.trim().toLowerCase() || i.name.toLowerCase() === skuInput.value.trim().toLowerCase());
      hiddenSku.value = match ? match.sku : "";
    };
    skuInput.addEventListener("input", syncSku);
    skuInput.addEventListener("change", syncSku);
    $('select[name="type"]', form).addEventListener("change", (event) => {
      const transfer = event.target.value === "TRANSFER";
      $("[data-transfer-bin]", form).classList.toggle("hidden", !transfer);
      $('input[name="toBin"]', form).required = transfer;
    });
  };
  const showSupplierForm = (supplier = {}) => {
    openDrawer(supplier.id ? "Edit supplier" : "Add supplier", `<form data-form="${supplier.id ? "edit-supplier" : "new-supplier"}" data-id="${esc(supplier.id || "")}" class="space-y-4">${field("Supplier name","name",supplier.name || "", "text",true)}${field("Contact person","contact",supplier.contact || "", "text",true)}${field("Phone","phone",supplier.phone || "", "tel",true)}${field("Email","email",supplier.email || "", "email",true)}${field("Average lead time (days)","leadTime",supplier.leadTime ?? 3,"number",true)}${field("Items supplied","items",supplier.items || "", "text",true)}<div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-drawer","bg-white")}<button class="min-h-11 border border-asphalt bg-hazard px-5 font-heading text-sm font-bold uppercase">${supplier.id ? "Save supplier" : "Add supplier"}</button></div></form>`);
  };

  // Purchase-order editor: dynamic item rows and live line totals.
  let poLineCounter = 0;
  const openPOForm = (prefillSku = "") => {
    poLineCounter = 0;
    if (!state.suppliers.length) { toast("Add a supplier before creating a purchase order.", "warning"); return; }
    const supplierOptions = state.suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    openModal("Write a purchase order", `<form data-form="new-po" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2"><label class="block"><span class="mb-1 block font-heading text-xs font-bold uppercase tracking-wider">Supplier *</span><select name="supplierId" required class="min-h-11 w-full border border-steel/60 bg-white px-3 text-sm">${supplierOptions}</select></label>${field("Reference / project","reference","","text",false)}</div>
      <div class="flex items-center justify-between"><h3 class="font-heading text-lg font-bold uppercase tracking-wider">Order lines</h3>${btn("Add line","po-add-line","bg-white","plus")}</div>
      <datalist id="po-item-list">${state.items.map((item) => `<option value="${esc(item.sku)}">${esc(item.name)}</option><option value="${esc(item.name)}">${esc(item.sku)}</option>`).join("")}</datalist>
      <div id="po-lines" class="space-y-2"></div><div class="flex justify-end border-t-2 border-asphalt pt-3"><p class="font-heading text-lg font-bold uppercase">PO total <strong id="po-grand-total" class="ml-3 font-mono">${peso(0)}</strong></p></div>
      <div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-modal","bg-white")}<button class="min-h-11 border border-asphalt bg-hazard px-5 font-heading text-sm font-bold uppercase">Save draft PO</button></div></form>`, true);
    addPOLine(prefillSku);
  };
  const addPOLine = (prefillSku = "") => {
    const id = ++poLineCounter;
    const selectedItem = itemBySku(prefillSku);
    const row = document.createElement("div");
    row.className = "grid gap-2 border border-steel/40 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto]";
    row.dataset.poLine = String(id);
    row.innerHTML = `<label class="block"><span class="mb-1 block font-heading text-[10px] font-bold uppercase tracking-wider">Item</span><input name="lineSku" list="po-item-list" value="${esc(selectedItem?.sku || "")}" placeholder="Type SKU or item name" required class="min-h-10 w-full border border-steel/40 bg-white px-2 text-xs"></label><label class="block"><span class="mb-1 block font-heading text-[10px] font-bold uppercase tracking-wider">Qty</span><input name="lineQty" type="number" min="1" value="1" class="min-h-10 w-full border border-steel/40 px-2 font-mono text-sm"></label><label class="block"><span class="mb-1 block font-heading text-[10px] font-bold uppercase tracking-wider">Unit cost</span><input name="lineCost" type="number" min="0" step="any" value="${esc(selectedItem?.cost || 0)}" class="min-h-10 w-full border border-steel/40 px-2 font-mono text-sm"></label><button type="button" data-action="po-remove-line" class="mt-5 min-h-10 border border-steel/40 px-3 text-xs text-rebar">Remove</button>`;
    $("#po-lines").appendChild(row);
    row.addEventListener("input", updatePOTotal);
    row.addEventListener("change", (event) => {
      if (event.target.name === "lineSku") {
        const query = event.target.value.trim().toLowerCase();
        const match = state.items.find((item) => item.sku.toLowerCase() === query || item.name.toLowerCase() === query);
        if (match) event.target.closest("[data-po-line]").querySelector('[name="lineCost"]').value = match.cost;
      }
      updatePOTotal();
    });
    updatePOTotal();
  };
  const updatePOTotal = () => {
    const total = $$("[data-po-line]").reduce((sum, line) => sum + Number($('[name="lineQty"]',line).value || 0) * Number($('[name="lineCost"]',line).value || 0), 0);
    const target = $("#po-grand-total"); if (target) target.textContent = peso(total);
  };
  const openReorder = (sku) => {
    const item = itemBySku(sku); if (!item) return;
    openPOForm(sku);
    const form = $('[data-form="new-po"]');
    const supplier = state.suppliers.find((s) => s.name === item.supplier);
    if (supplier && form) form.elements.supplierId.value = supplier.id;
    const row = $("[data-po-line]");
    if (row) $('[name="lineQty"]',row).value = Math.max(item.maxStock - item.qty, item.reorderPoint - item.qty, 1);
    updatePOTotal();
  };

  // CSV import: parse, validate, preview, then commit as one explicit action.
  const parseCSV = (text) => {
    const rows = []; let row = []; let cell = ""; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = "";
      } else cell += char;
    }
    row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
    return rows;
  };
  const openImport = () => {
    openModal("Import inventory CSV", `<div class="space-y-4"><p class="text-sm text-steel">Use a header row with SKU, Name, Category, Unit, Bin, Quantity, Reorder Point, Max Stock, Unit Cost, Supplier. Existing SKUs update; new SKUs are added.</p><label class="block border-2 border-dashed border-steel bg-white p-5 text-center"><span class="font-heading text-sm font-bold uppercase tracking-wider">Choose a CSV file</span><input id="csv-file" type="file" accept=".csv,text/csv" class="mt-3 block w-full text-sm"></label><div id="import-preview" class="text-sm text-steel">Select a file to validate the rows before importing.</div><div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-modal","bg-white")}<button data-action="commit-import" disabled class="min-h-11 border border-asphalt bg-hazard px-5 font-heading text-sm font-bold uppercase disabled:opacity-40">Commit import</button></div></div>`, true);
    $("#csv-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      importFileName = file.name;
      try {
        const parsed = parseCSV(await file.text());
        const headers = parsed.shift()?.map((v) => v.trim().toLowerCase().replace(/[\s_-]+/g,"")) || [];
        const indexes = ["sku","name","category","unit","bin","quantity","reorderpoint","maxstock","unitcost","supplier"];
        const column = indexes.map((name) => headers.indexOf(name));
        if (column.some((i) => i < 0)) throw new Error("Required headers are missing. Export a ledger CSV to see the exact column order.");
        const errors = [];
        const validUnits = ["bag","pc","m","kg","bundle","sheet","roll","pair","box"];
        inventoryImportRows = parsed.map((cells, index) => {
          const value = (i) => cells[column[i]]?.trim() || "";
          const candidate = { sku:value(0).toUpperCase(), name:value(1), category:value(2), unit:value(3).toLowerCase(), bin:value(4), qty:Number(value(5)), reorderPoint:Number(value(6)), maxStock:Number(value(7)), cost:Number(value(8)), supplier:value(9) };
          const missingNumber = [5,6,7,8].some((i) => value(i) === "");
          if (!candidate.sku || !candidate.name || !candidate.category || !validUnits.includes(candidate.unit) || !candidate.bin || !candidate.supplier || missingNumber || !Number.isFinite(candidate.qty) || candidate.qty < 0 || !Number.isFinite(candidate.reorderPoint) || candidate.reorderPoint < 0 || !Number.isFinite(candidate.maxStock) || candidate.maxStock < 0 || !Number.isFinite(candidate.cost) || candidate.cost < 0) errors.push(`Row ${index + 2}: required text, unit, or numeric values are invalid.`);
          return candidate;
        });
        const duplicate = inventoryImportRows.find((r,i) => inventoryImportRows.findIndex((x) => x.sku.toLowerCase() === r.sku.toLowerCase()) !== i);
        if (duplicate) errors.push(`Duplicate SKU in file: ${duplicate.sku}`);
        const preview = $("#import-preview");
        preview.innerHTML = errors.length ? `<p class="border-l-4 border-rebar bg-white p-3 text-rebar">${errors.map(esc).join("<br>")}</p>` : `<p class="border-l-4 border-safety bg-white p-3 text-asphalt">${inventoryImportRows.length} rows validated from <strong>${esc(importFileName)}</strong>. ${inventoryImportRows.filter((r) => itemBySku(r.sku)).length} will update and ${inventoryImportRows.filter((r) => !itemBySku(r.sku)).length} will be added.</p><div class="mt-3 max-h-40 overflow-auto border border-steel/40 bg-white"><table class="w-full text-left text-xs"><thead class="sticky top-0 bg-concrete"><tr><th class="p-2">SKU</th><th class="p-2">Name</th><th class="p-2">Qty</th><th class="p-2">Bin</th></tr></thead><tbody>${inventoryImportRows.slice(0,8).map((r) => `<tr class="border-t"><td class="p-2 font-mono">${esc(r.sku)}</td><td class="p-2">${esc(r.name)}</td><td class="p-2 font-mono">${num(r.qty)}</td><td class="p-2 font-mono">${esc(r.bin)}</td></tr>`).join("")}</tbody></table></div>`;
        $('[data-action="commit-import"]').disabled = Boolean(errors.length || !inventoryImportRows.length);
      } catch (error) {
        inventoryImportRows = [];
        $("#import-preview").innerHTML = `<p class="border-l-4 border-rebar bg-white p-3 text-rebar">${esc(error.message)}</p>`;
        $('[data-action="commit-import"]').disabled = true;
      }
    });
  };

  // Events: delegated page actions, form submissions, and keyboard shortcuts.
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) { event.preventDefault(); closeModal(); closeDrawer(); navigate(nav.dataset.nav); return; }
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      if (inventoryFilters.sort === sort.dataset.sort) inventoryFilters.dir *= -1;
      else { inventoryFilters.sort = sort.dataset.sort; inventoryFilters.dir = 1; }
      inventoryPage = 1; render(); return;
    }
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    if (event.target.closest("[data-stop-row]") && actionEl.dataset.action === "item-detail") return;
    const action = actionEl.dataset.action;
    if (action.startsWith("po-view:")) {
      const po = state.purchaseOrders.find((p) => p.id === action.slice(8)); if (po) openModal(`PO ${po.id}`, `${poMarkup(po)}<div class="no-print flex justify-end gap-2 p-4">${btn("Close","close-modal","bg-white")}<button data-action="print-po" class="min-h-11 border border-asphalt bg-hazard px-4 font-heading text-sm font-bold uppercase">Print PO</button></div>`, true);
    } else if (action.startsWith("po-send:")) {
      const po = state.purchaseOrders.find((p) => p.id === action.slice(8)); if (po) { po.status = "Sent"; po.sentAt = new Date().toISOString(); persist(); render(); toast(`${po.id} marked sent.`); }
    } else if (action.startsWith("po-receive:")) {
      const po = state.purchaseOrders.find((p) => p.id === action.slice(11)); if (po) openReceivePO(po);
    } else if (action.startsWith("po-cancel:")) {
      const po = state.purchaseOrders.find((p) => p.id === action.slice(10)); if (po) { po.status = "Cancelled"; persist(); render(); toast(`${po.id} cancelled.`, "warning"); }
    } else if (action.startsWith("supplier-edit:")) {
      showSupplierForm(supplierById(action.slice(14)));
    } else if (action.startsWith("supplier-delete:")) {
      const id = action.slice(16); const supplier = supplierById(id); if (supplier) confirmDelete("supplier", id, supplier.name);
    } else if (action.startsWith("detail-move:")) {
      const [,type,sku] = action.split(":"); closeDrawer(); openQuickMove(type,sku);
    } else if (action.startsWith("detail-edit:")) {
      const sku = action.slice(12); showItemForm(itemBySku(sku));
    } else if (action.startsWith("reorder-item:")) {
      openReorder(action.slice(13));
    } else if (action.startsWith("export-report:")) {
      const type = action.slice(14);
      if (type === "low") inventoryCSV(lowItems());
      else downloadCSV("yard-valuation.csv",["Category","SKUs","Units on hand","Stock value"],categories().map((c) => { const xs=state.items.filter(i=>i.category===c); return [c,xs.length,xs.reduce((n,i)=>n+i.qty,0),xs.reduce((n,i)=>n+i.qty*i.cost,0)]; }));
    } else if (action.startsWith("confirm-delete:")) {
      const [,kind,id] = action.split(":"); performDelete(kind,id); closeModal(); closeDrawer();
    } else if (action === "undo-toast") {
      const entry = undoActions.get(actionEl.dataset.undo); if (entry) { clearTimeout(entry.timer); entry.fn(); entry.node.remove(); undoActions.delete(actionEl.dataset.undo); persist(); render(); toast("Record restored."); }
    } else if (action === "quick-move") openQuickMove();
    else if (action === "add-item") showItemForm();
    else if (action === "edit-item") showItemForm(itemBySku(actionEl.dataset.sku || $("[data-form]")?.dataset.originalSku || ""));
    else if (action === "item-detail") showItemDetail(actionEl.dataset.sku);
    else if (action === "add-supplier") showSupplierForm();
    else if (action === "create-po") openPOForm();
    else if (action === "reorder-item") openReorder(actionEl.dataset.sku);
    else if (action === "po-add-line") addPOLine();
    else if (action === "po-remove-line") { actionEl.closest("[data-po-line]")?.remove(); updatePOTotal(); }
    else if (action === "close-modal") { if (event.target === actionEl || actionEl.closest("[data-panel]")) closeModal(); }
    else if (action === "close-drawer") { if (event.target === actionEl || actionEl.closest("[data-panel]")) closeDrawer(); }
    else if (action === "page-prev") { inventoryPage = Math.max(1, inventoryPage - 1); render(); }
    else if (action === "page-next") { inventoryPage = Math.min(Math.ceil(filteredItems().length / 15), inventoryPage + 1); render(); }
    else if (action === "export-inventory") inventoryCSV(filteredItems());
    else if (action === "import-inventory") openImport();
    else if (action === "commit-import") commitImport();
    else if (action === "bulk-delete") confirmDelete("bulk", [...selectedItems].join(","), `${selectedItems.size} selected item(s)`);
    else if (action === "bulk-category") openModal("Change category", `<form data-form="bulk-category" class="space-y-4">${field("New category","category","","text",true)}<p class="text-xs text-steel">Applies to ${selectedItems.size} selected item(s).</p><div class="flex justify-end gap-2">${btn("Cancel","close-modal","bg-white")}<button class="min-h-11 bg-hazard px-4 font-heading text-sm font-bold uppercase">Apply category</button></div></form>`);
    else if (action === "delete-item") { const item = itemBySku(actionEl.dataset.sku); if (item) confirmDelete("item",item.sku,item.name); }
    else if (action === "settings") openSettings();
    else if (action === "logout") { closeModal(); closeDrawer(); setAuthenticated(false); $("#login-error").classList.add("hidden"); $("#login-form").reset(); $("#login-form").elements.username.focus(); }
    else if (action === "collapse-sidebar") { sidebarCollapsed = !sidebarCollapsed; renderNav(); }
    else if (action === "shortcuts") { const popover = $("#shortcuts"); const toggle = $(".shortcut-toggle"); popover.classList.toggle("hidden"); toggle.classList.toggle("hidden", !popover.classList.contains("hidden")); }
    else if (action === "close-shortcuts") { $("#shortcuts").classList.add("hidden"); $(".shortcut-toggle").classList.remove("hidden"); }
    else if (action === "print-report") window.print();
    else if (action === "print-po") {
      document.body.classList.add("printing-po");
      window.addEventListener("afterprint", () => document.body.classList.remove("printing-po"), { once: true });
      window.print();
    }
    else if (action === "category-chip") { inventoryFilters.category = actionEl.dataset.category || ""; inventoryPage = 1; render(); }
    else if (action === "mobile-more") openModal("VIEWERS pages", `<div class="grid gap-2 sm:grid-cols-2">${navItems.slice(4).map(([key,label,icon]) => `<a href="#${key}" data-nav="${key}" class="flex min-h-12 items-center gap-3 border border-asphalt bg-white px-3 font-heading font-bold uppercase tracking-wider"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-${icon}"/></svg>${label}</a>`).join("")}<button data-action="settings" class="flex min-h-12 items-center gap-3 border border-asphalt bg-white px-3 font-heading font-bold uppercase tracking-wider"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-settings"/></svg>Settings &amp; data</button><button data-action="logout" class="flex min-h-12 items-center gap-3 border border-asphalt bg-white px-3 font-heading font-bold uppercase tracking-wider"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-close"/></svg>Sign out</button></div>`);
  });
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "category-filter") { inventoryFilters.category = target.value; inventoryPage = 1; render(); }
    else if (target.id === "status-filter") { inventoryFilters.status = target.value; inventoryPage = 1; render(); }
    else if (target.id === "move-type-filter") { movementFilters.type = target.value; render(); }
    else if (target.id === "move-from") { movementFilters.from = target.value; render(); }
    else if (target.id === "move-to") { movementFilters.to = target.value; render(); }
    else if (target.matches("[data-check-all]")) {
      const visible = filteredItems().slice((inventoryPage-1)*15,inventoryPage*15);
      if (target.checked) visible.forEach((i) => selectedItems.add(i.sku)); else visible.forEach((i) => selectedItems.delete(i.sku));
      render();
    } else if (target.matches("[data-select-item]")) {
      if (target.checked) selectedItems.add(target.dataset.selectItem); else selectedItems.delete(target.dataset.selectItem);
      render();
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "inventory-query") { inventoryFilters.q = target.value; inventoryPage = 1; render(); const input=$("#inventory-query"); input?.focus(); input?.setSelectionRange(target.value.length,target.value.length); }
    else if (target.id === "move-query") { movementFilters.q = target.value; render(); const input=$("#move-query"); input?.focus(); input?.setSelectionRange(target.value.length,target.value.length); }
    else if (target.id === "global-search") showGlobalSearch(target.value);
  });
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]"); if (!form) return;
    event.preventDefault();
    const data = new FormData(form); const values = Object.fromEntries(data.entries());
    try {
      if (form.dataset.form === "new-item" || form.dataset.form === "edit-item") saveItem(values, form.dataset.originalSku);
      else if (form.dataset.form === "quick-move") {
        const sku = values.sku || state.items.find((i) => i.name.toLowerCase() === values["sku-search"].toLowerCase())?.sku;
        recordMovement({ type:values.type, sku, qty:values.qty, reference:values.reference, staff:values.staff, note:values.note || "", toBin:values.toBin });
        closeModal(); render(); flash(sku); toast(`${movementLabel({type:values.type})} recorded for ${sku}.`);
      } else if (form.dataset.form === "new-supplier" || form.dataset.form === "edit-supplier") saveSupplier(values, form.dataset.id);
      else if (form.dataset.form === "new-po") savePO(values);
      else if (form.dataset.form === "bulk-category") {
        selectedItems.forEach((sku) => { const item = itemBySku(sku); if (item) item.category = values.category.trim(); });
        selectedItems.clear(); persist(); closeModal(); render(); toast("Selected items recategorized.");
      } else if (form.dataset.form === "receive-po") receivePO(form, values);
    } catch (error) { showFormError(form, error.message || "Could not save this record."); }
  });
  document.addEventListener("keydown", (event) => {
    if (!isAuthenticated) return;
    if (event.key === "Escape") { closeModal(); closeDrawer(); $("#search-results").classList.add("hidden"); $("#shortcuts").classList.add("hidden"); $(".shortcut-toggle").classList.remove("hidden"); }
    if (event.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); $("#global-search").focus(); }
    if ((event.key === "n" || event.key === "N") && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName) && !event.ctrlKey && !event.metaKey) openQuickMove();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#global-search") && !event.target.closest("#search-results")) $("#search-results").classList.add("hidden");
  });
  $("#global-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = $("#search-results [data-search-sku]");
      if (first) { event.preventDefault(); showItemDetail(first.dataset.searchSku); $("#search-results").classList.add("hidden"); }
      else { inventoryFilters.q = event.target.value; navigate("inventory"); }
    }
  });

  // State mutations and their checks.
  const saveItem = (values, originalSku) => {
    const sku = values.sku.trim().toUpperCase();
    const numeric = ["qty","reorderPoint","maxStock","cost"];
    for (const key of numeric) if (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0) throw new Error(`${key === "qty" ? "Quantity" : key === "reorderPoint" ? "Reorder point" : key === "maxStock" ? "Maximum stock" : "Unit cost"} must be zero or greater.`);
    if (state.items.some((i) => i.sku.toLowerCase() === sku.toLowerCase() && i.sku !== originalSku)) throw new Error(`SKU ${sku} is already in the ledger.`);
    if (!values.name.trim() || !values.category.trim() || !values.bin.trim() || !values.supplier.trim()) throw new Error("Complete all required fields before saving.");
    const record = { sku, name:values.name.trim(), category:values.category.trim(), unit:values.unit, bin:values.bin.trim(), qty:Number(values.qty), reorderPoint:Number(values.reorderPoint), maxStock:Number(values.maxStock), cost:Number(values.cost), supplier:values.supplier.trim(), updatedAt:new Date().toISOString() };
    if (originalSku) {
      const index = state.items.findIndex((i) => i.sku === originalSku);
      if (index < 0) throw new Error("This item was removed before the edit could be saved.");
      state.items[index] = record;
      if (originalSku !== sku) state.movements.filter((m) => m.sku === originalSku).forEach((m) => { m.sku = sku; });
      toast(`${sku} updated.`);
    } else { state.items.push(record); toast(`${sku} added to inventory.`); }
    persist(); closeDrawer(); render(); flash(sku);
  };
  const saveSupplier = (values, id) => {
    const name = values.name.trim();
    if (!name || !values.contact.trim() || !values.phone.trim() || !values.email.trim() || !values.items.trim()) throw new Error("Complete all required supplier details.");
    if (!Number.isFinite(Number(values.leadTime)) || Number(values.leadTime) < 0) throw new Error("Lead time must be zero or greater.");
    const existing = id ? supplierById(id) : null;
    if (!existing && state.suppliers.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new Error("A supplier with this name is already in the directory.");
    const supplier = { id:existing?.id || `SUP-${Date.now()}`, name, contact:values.contact.trim(), phone:values.phone.trim(), email:values.email.trim(), leadTime:Number(values.leadTime), items:values.items.trim() };
    if (existing) {
      const oldName = existing.name; Object.assign(existing,supplier);
      state.items.filter((i) => i.supplier === oldName).forEach((i) => { i.supplier = name; });
    } else state.suppliers.push(supplier);
    persist(); closeDrawer(); render(); toast(`${name} saved.`);
  };
  const savePO = (values) => {
    const lines = $$("[data-po-line]").map((row) => {
      const query = $('[name="lineSku"]',row).value.trim().toLowerCase();
      const item = state.items.find((candidate) => candidate.sku.toLowerCase() === query || candidate.name.toLowerCase() === query);
      return { sku:item?.sku || "", qty:Number($('[name="lineQty"]',row).value), received:0, cost:Number($('[name="lineCost"]',row).value) };
    });
    if (!lines.length || lines.some((line) => !itemBySku(line.sku) || !Number.isFinite(line.qty) || line.qty <= 0 || !Number.isFinite(line.cost) || line.cost < 0)) throw new Error("Each PO line needs a valid inventory item, positive quantity, and non-negative cost.");
    const id = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    state.purchaseOrders.unshift({ id, supplierId:values.supplierId, createdAt:new Date().toISOString(), status:"Draft", lines, reference:(values.reference || "").trim() });
    persist(); closeModal(); navigate("orders"); toast(`${id} saved as a draft.`);
  };
  const openReceivePO = (po) => {
    openModal(`Receive ${po.id}`, `<form data-form="receive-po" data-po-id="${esc(po.id)}" class="space-y-4"><p class="text-sm text-steel">Enter the quantities arriving now. Received quantities create IN movements immediately.</p>${po.lines.map((line,index) => `<label class="block border border-steel/40 bg-white p-3"><span class="mb-2 block font-semibold">${esc(itemBySku(line.sku)?.name || line.sku)} <span class="font-mono text-xs text-steel">${esc(line.sku)}</span></span><span class="flex items-center gap-3 text-xs text-steel">Outstanding ${num(line.qty-(line.received||0))}<input name="received-${index}" type="number" min="0" max="${line.qty-(line.received||0)}" value="${line.qty-(line.received||0)}" class="min-h-11 w-32 border border-steel/50 px-2 font-mono text-sm text-asphalt"></span></label>`).join("")}<div class="flex justify-end gap-2 border-t border-steel/40 pt-4">${btn("Cancel","close-modal","bg-white")}<button class="min-h-11 bg-hazard px-5 font-heading text-sm font-bold uppercase">Post receipt</button></div></form>`);
  };
  const receivePO = (form, values) => {
    const po = state.purchaseOrders.find((p) => p.id === form.dataset.poId); if (!po) throw new Error("Purchase order no longer exists.");
    let posted = 0;
    po.lines.forEach((line,index) => {
      const amount = Number(values[`received-${index}`] || 0);
      const remaining = line.qty - (line.received || 0);
      if (!Number.isFinite(amount) || amount < 0 || amount > remaining) throw new Error("Receipt quantities must be between zero and the outstanding quantity.");
      if (amount > 0) {
        const item = itemBySku(line.sku); if (!item) throw new Error(`${line.sku} is no longer in inventory.`);
        item.qty += amount; line.received = (line.received || 0) + amount; item.updatedAt = new Date().toISOString();
        state.movements.push({ id:`MOV-${Date.now()}-${index}`, type:"IN", sku:line.sku, qty:amount, reference:po.id, staff:state.staff[0] || "Yard staff", note:"Purchase order receipt", date:new Date().toISOString() }); posted += amount;
      }
    });
    const total = po.lines.reduce((sum,line) => sum + (line.received || 0),0);
    const ordered = po.lines.reduce((sum,line) => sum + line.qty,0);
    po.status = total >= ordered ? "Received" : total > 0 ? "Partially Received" : po.status;
    persist(); closeModal(); render(); toast(posted ? `${num(posted)} units received against ${po.id}.` : "No quantities received.", posted ? "success" : "warning");
  };
  const performDelete = (kind,id) => {
    const snapshot = kind === "bulk" ? state.items.filter((i) => id.split(",").includes(i.sku)) : kind === "item" ? state.items.filter((i) => i.sku === id) : state.suppliers.filter((s) => s.id === id);
    if (!snapshot.length) return;
    if (kind === "bulk" || kind === "item") state.items = state.items.filter((i) => !snapshot.some((gone) => gone.sku === i.sku));
    else state.suppliers = state.suppliers.filter((s) => s.id !== id);
    persist(); render();
    const key = `undo-${Date.now()}`;
    toast(`${snapshot.length === 1 ? snapshot[0].name || snapshot[0].sku : `${snapshot.length} items`} deleted.`, "warning", { id:key, fn:() => {
      if (kind === "supplier") state.suppliers.push(...snapshot);
      else state.items.push(...snapshot);
      selectedItems.clear();
    }});
  };
  const commitImport = () => {
    if (!inventoryImportRows.length) return;
    const now = new Date().toISOString();
    inventoryImportRows.forEach((row) => {
      const match = itemBySku(row.sku);
      if (match) Object.assign(match,row,{updatedAt:now});
      else state.items.push({...row,updatedAt:now});
    });
    const count = inventoryImportRows.length; inventoryImportRows = [];
    persist(); closeModal(); render(); toast(`${count} inventory row${count === 1 ? "" : "s"} imported.`);
  };
  const openSettings = () => openModal("Settings & local data", `<div class="space-y-4"><p class="text-sm">VIEWERS stores this inventory in this browser only. Export a CSV before clearing data if you need a separate copy.</p><div class="border border-steel/40 bg-white p-4"><p class="font-heading text-sm font-bold uppercase tracking-wider">Keyboard shortcuts</p><p class="mt-2 text-sm">Press <kbd class="border px-1 font-mono">/</kbd> to search, <kbd class="border px-1 font-mono">N</kbd> for a quick move, and <kbd class="border px-1 font-mono">Esc</kbd> to close a panel.</p></div><div class="border-l-4 border-rebar bg-white p-4"><p class="font-heading text-sm font-bold uppercase tracking-wider">Reset demo data</p><p class="mt-1 text-sm text-steel">Replace this browser's ledger with the original 40-item demonstration yard.</p><button data-action="reset-data" class="mt-3 min-h-11 border border-rebar px-4 font-heading text-sm font-bold uppercase text-rebar">Reset demo data</button></div><div class="flex justify-end">${btn("Done","close-modal","bg-hazard")}</div></div>`);

  // Global search: SKU/name/supplier/bin matches surfaced as direct item records.
  const showGlobalSearch = (query) => {
    const panel = $("#search-results"); const q = query.trim().toLowerCase();
    if (!q) { panel.classList.add("hidden"); panel.innerHTML = ""; return; }
    const matches = state.items.filter((i) => [i.sku,i.name,i.supplier,i.bin].some((v) => String(v).toLowerCase().includes(q))).slice(0,7);
    panel.innerHTML = matches.length ? matches.map((i) => `<button data-search-sku="${esc(i.sku)}" class="flex min-h-12 w-full items-center justify-between gap-3 border-b border-steel/20 px-3 text-left hover:bg-concrete"><span><strong>${esc(i.name)}</strong><small class="block font-mono text-[10px] text-steel">${esc(i.sku)} · ${esc(i.bin)} · ${esc(i.supplier)}</small></span><span class="font-mono text-xs">${num(i.qty)} ${esc(i.unit)}</span></button>`).join("") : `<p class="p-4 text-sm text-steel">No item matches. Press Enter to search the full inventory ledger.</p>`;
    panel.classList.remove("hidden");
  };
  document.addEventListener("click", (event) => {
    const result = event.target.closest("[data-search-sku]");
    if (result) { showItemDetail(result.dataset.searchSku); $("#search-results").classList.add("hidden"); }
    if (event.target.closest('[data-action="reset-data"]')) {
      openModal("Reset demo data?", `<p class="mb-5 text-sm">This replaces the current inventory, movements, suppliers, and purchase orders in this browser with the original demo yard.</p><div class="flex justify-end gap-2">${btn("Keep current data","close-modal","bg-white")}<button data-action="confirm-reset" class="min-h-11 border border-rebar bg-rebar px-4 font-heading text-sm font-bold uppercase text-white">Reset demo data</button></div>`);
    } else if (event.target.closest('[data-action="confirm-reset"]')) {
      state = freshState(); persist(); closeModal(); closeDrawer(); selectedItems.clear(); render(); toast("Demo data restored in this browser.");
    }
  });

  render();
  if (!isAuthenticated) document.getElementById("login-form").elements.username.focus();
})();
