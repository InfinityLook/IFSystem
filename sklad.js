(function () {
  const defaultStock = [
    { id: 1, sku: "ROZ-BOX-500", division: "Rozvoz jídla", name: "Termo menubox 500 ml", location: "Regál A1 • Obaly", unit: "bal.", qty: 6, minQty: 15, price: 240 },
    { id: 2, sku: "ROZ-TASKA-P", division: "Rozvoz jídla", name: "Papírová rozvozová taška", location: "Regál A2 • Obaly", unit: "ks", qty: 180, minQty: 50, price: 6.5 },
    { id: 3, sku: "ESH-KART-M", division: "E-shop", name: "Přepravní karton M", location: "Sklad B1 • Balení", unit: "ks", qty: 42, minQty: 30, price: 18 },
    { id: 4, sku: "APP-LIC-PRO", division: "PWA Google Play", name: "Kredit push notifikací / balíček", location: "Digitální • Služby", unit: "bal.", qty: 0, minQty: 2, price: 1200 },
    { id: 5, sku: "DAL-MAT-01", division: "Další podnikání", name: "Provozní spotřební materiál", location: "Regál C3 • Ostatní", unit: "ks", qty: 24, minQty: 10, price: 150 }
  ];

  const defaultMovements = [
    { id: 1, sku: "ROZ-BOX-500", name: "Termo menubox 500 ml", type: "out", delta: -9, unit: "bal.", reason: "Výdej do kuchyně / rozvoz", time: "Dnes, 14:20" },
    { id: 2, sku: "ESH-KART-M", name: "Přepravní karton M", type: "in", delta: 25, unit: "ks", reason: "Příjem od dodavatele obalů", time: "Dnes, 10:05" }
  ];

  let stockItems = JSON.parse(localStorage.getItem("il_stock_items")) || defaultStock;
  let movements = JSON.parse(localStorage.getItem("il_stock_movements")) || defaultMovements;
  let divFilter = "all";
  let statusFilter = "all";
  let searchQuery = "";

  function formatCzk(num) {
    return `${Math.round(num).toLocaleString("cs-CZ")} Kč`;
  }

  function formatQty(num) {
    return Number.isInteger(num) ? num : num.toFixed(2);
  }

  function getStockStatus(item) {
    if (item.qty <= 0) return { code: "empty", label: "Vyprodáno", pillClass: "pill-danger" };
    if (item.qty < item.minQty) return { code: "low", label: "Pod minimem", pillClass: "pill-warn" };
    return { code: "ok", label: "V pořádku", pillClass: "pill-ok" };
  }

  function persistAndNotify() {
    localStorage.setItem("il_stock_items", JSON.stringify(stockItems));
    localStorage.setItem("il_stock_movements", JSON.stringify(movements));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function addMovement(item, type, deltaQty, reason) {
    movements.unshift({
      id: Date.now() + Math.random(),
      sku: item.sku,
      name: item.name,
      type,
      delta: deltaQty,
      unit: item.unit,
      reason: reason || (deltaQty >= 0 ? "Příjem na sklad" : "Výdej / úprava zásoby"),
      time: "Právě teď"
    });
  }

  function getSummary() {
    const totalValue = stockItems.reduce((sum, i) => sum + i.qty * i.price, 0);
    const lowCount = stockItems.filter((i) => getStockStatus(i).code !== "ok").length;
    return {
      totalItems: stockItems.length,
      lowCount,
      totalValue,
      movementsCount: movements.length
    };
  }

  function render() {
    const summary = getSummary();
    const elTotal = document.getElementById("stockKpiTotal");
    if (!elTotal) return;

    elTotal.textContent = summary.totalItems;
    document.getElementById("stockKpiLow").textContent = summary.lowCount;
    document.getElementById("stockKpiValue").textContent = formatCzk(summary.totalValue);
    document.getElementById("stockKpiMovements").textContent = summary.movementsCount;

    const filtered = stockItems.filter((item) => {
      const st = getStockStatus(item);
      const divOk = divFilter === "all" || item.division === divFilter;
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "low" && st.code !== "ok") ||
        (statusFilter === "ok" && st.code === "ok");
      const q = searchQuery.toLowerCase();
      const searchOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);
      return divOk && statusOk && searchOk;
    });

    const tbody = document.getElementById("stockTableBody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Žádné skladové položky neodpovídají filtru.</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map((item) => {
        const st = getStockStatus(item);
        const ratio = item.minQty > 0 ? Math.min(100, Math.round((item.qty / item.minQty) * 100)) : 100;
        const barClass = st.code === "empty" ? "empty" : st.code === "low" ? "low" : "";

        return `
          <tr>
            <td>
              <span class="div-name">${item.name}</span>
              <span class="div-sub">${item.sku}${item.location ? ` • ${item.location}` : ""}</span>
            </td>
            <td>${item.division}</td>
            <td>
              <strong>${formatQty(item.qty)} ${item.unit}</strong>
              <span class="div-sub">Min: ${formatQty(item.minQty)} ${item.unit}</span>
              <div class="stock-bar"><div class="stock-bar-fill ${barClass}" style="width: ${ratio}%"></div></div>
            </td>
            <td><span class="status-pill ${st.pillClass}">● ${st.label}</span></td>
            <td><strong>${formatCzk(item.qty * item.price)}</strong></td>
            <td>
              <div class="row-actions">
                <button class="btn-sm" data-st-quick="dec" data-id="${item.id}" title="Výdej -1">-1</button>
                <button class="btn-sm" data-st-quick="inc" data-id="${item.id}" title="Příjem +1">+1</button>
                <button class="btn-sm" data-st-move="${item.id}">Pohyb</button>
                <button class="btn-sm" data-st-approve="${item.id}">Ke schválení</button>
                <button class="btn-sm" data-st-del="${item.id}" title="Smazat položku">✕</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    const mvList = document.getElementById("stockMovementsList");
    if (!movements.length) {
      mvList.innerHTML = `<div class="movement-item"><span class="muted">Zatím nebyly zaznamenány žádné skladové pohyby.</span></div>`;
    } else {
      mvList.innerHTML = movements.slice(0, 12).map((m) => {
        const sign = m.delta >= 0 ? "+" : "";
        const cls = m.delta >= 0 ? "mv-plus" : "mv-minus";
        const typeLabel = m.type === "in" ? "Příjem" : m.type === "waste" ? "Odpis" : "Výdej";
        return `
          <div class="movement-item">
            <div>
              <div><strong>${m.name}</strong> <span class="muted">(${m.sku})</span></div>
              <div class="muted">${typeLabel} • ${m.reason} • ${m.time}</div>
            </div>
            <div class="${cls}">${sign}${formatQty(m.delta)} ${m.unit}</div>
          </div>
        `;
      }).join("");
    }
  }

  function openMovementModalFor(selectedId) {
    if (!stockItems.length) return;
    const select = document.getElementById("mvItem");
    select.innerHTML = stockItems.map((i) =>
      `<option value="${i.id}">${i.sku} – ${i.name} (${formatQty(i.qty)} ${i.unit})</option>`
    ).join("");
    if (selectedId) select.value = String(selectedId);
    document.getElementById("movementModal").showModal();
  }

  function bindEvents() {
    document.getElementById("stockDivisionFilter")?.addEventListener("change", (e) => {
      divFilter = e.target.value;
      render();
    });

    document.getElementById("stockStatusFilter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });

    document.getElementById("stockSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const viewEl = document.getElementById("view-sklad");
    viewEl?.addEventListener("click", (e) => {
      const quickBtn = e.target.closest("[data-st-quick]");
      if (quickBtn) {
        const id = Number(quickBtn.dataset.id);
        const dir = quickBtn.dataset.stQuick === "inc" ? 1 : -1;
        stockItems = stockItems.map((item) => {
          if (item.id !== id) return item;
          const nextQty = Math.max(0, Number((item.qty + dir).toFixed(2)));
          const actualDelta = Number((nextQty - item.qty).toFixed(2));
          if (actualDelta !== 0) {
            addMovement(item, actualDelta > 0 ? "in" : "out", actualDelta, "Rychlá úprava stavu (±1)");
          }
          return { ...item, qty: nextQty };
        });
        persistAndNotify();
        return;
      }

      const moveBtn = e.target.closest("[data-st-move]");
      if (moveBtn) {
        openMovementModalFor(Number(moveBtn.dataset.stMove));
        return;
      }

      const approveBtn = e.target.closest("[data-st-approve]");
      if (approveBtn) {
        const id = Number(approveBtn.dataset.stApprove);
        const target = stockItems.find((i) => i.id === id);
        if (target && window.PortalApp && typeof window.PortalApp.addApproval === "function") {
          const suggestedQty = Math.max(target.minQty * 2 - target.qty, target.minQty || 10);
          const estCost = suggestedQty * target.price;
          window.PortalApp.addApproval({
            division: target.division,
            title: `Doplnění zásob: ${target.name} (+${formatQty(suggestedQty)} ${target.unit}, odhad ${formatCzk(estCost)})`,
            time: "Ze skladu"
          });
        }
        return;
      }

      const delBtn = e.target.closest("[data-st-del]");
      if (delBtn) {
        const id = Number(delBtn.dataset.stDel);
        stockItems = stockItems.filter((i) => i.id !== id);
        persistAndNotify();
      }
    });

    // Modal: Nová skladová položka
    const stockItemModal = document.getElementById("stockItemModal");
    document.getElementById("openStockItemModal")?.addEventListener("click", () => stockItemModal.showModal());
    document.getElementById("closeStockItemModal")?.addEventListener("click", () => stockItemModal.close());

    document.getElementById("stockItemForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const initialQty = Math.max(0, Number(document.getElementById("stQty").value) || 0);
      const newItem = {
        id: Date.now(),
        sku: document.getElementById("stSku").value.trim().toUpperCase(),
        division: document.getElementById("stDivision").value,
        name: document.getElementById("stName").value.trim(),
        location: document.getElementById("stLocation").value.trim(),
        unit: document.getElementById("stUnit").value,
        qty: initialQty,
        minQty: Math.max(0, Number(document.getElementById("stMin").value) || 0),
        price: Math.max(0, Number(document.getElementById("stPrice").value) || 0)
      };
      stockItems.unshift(newItem);
      if (initialQty > 0) {
        addMovement(newItem, "in", initialQty, "Počáteční naskladnění");
      }
      e.target.reset();
      stockItemModal.close();
      persistAndNotify();
    });

    // Modal: Pohyb zásob
    const movementModal = document.getElementById("movementModal");
    document.getElementById("openMovementModal")?.addEventListener("click", () => openMovementModalFor());
    document.getElementById("closeMovementModal")?.addEventListener("click", () => movementModal.close());

    document.getElementById("movementForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = Number(document.getElementById("mvItem").value);
      const type = document.getElementById("mvType").value;
      const rawQty = Math.max(0.01, Number(document.getElementById("mvQty").value) || 0);
      const reason = document.getElementById("mvReason").value.trim();

      stockItems = stockItems.map((item) => {
        if (item.id !== id) return item;
        const signed = type === "in" ? rawQty : -rawQty;
        const nextQty = Math.max(0, Number((item.qty + signed).toFixed(2)));
        const actualDelta = Number((nextQty - item.qty).toFixed(2));
        if (actualDelta !== 0) {
          addMovement(item, type, actualDelta, reason);
        }
        return { ...item, qty: nextQty };
      });

      e.target.reset();
      movementModal.close();
      persistAndNotify();
    });
  }

  bindEvents();
  render();

  window.SkladModule = {
    render,
    getSummary
  };
})();
