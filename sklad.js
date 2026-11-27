(function () {
  const STORAGE_KEY = "il_stock_items_v2";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  // Prázdný výchozí seznam — zásoby si vytvoříš sám na webu
  let stockItems = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let branchFilter = "all";
  let statusFilter = "all";
  let searchQuery = "";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCzk(num) {
    return `${Math.round(num).toLocaleString("cs-CZ")} Kč`;
  }

  function formatQty(num) {
    return Number.isInteger(num) ? num : Number(num.toFixed(2));
  }

  function getBranches() {
    if (window.PodnikaniModule && typeof window.PodnikaniModule.getBranches === "function") {
      return window.PodnikaniModule.getBranches();
    }
    try {
      const raw = JSON.parse(localStorage.getItem(BIZ_STORAGE_KEY)) || [];
      return raw.map((item) => item.nazev).filter(Boolean);
    } catch {
      return [];
    }
  }

  function getStockStatus(item) {
    if (item.qty <= 0) return { code: "empty", label: "Vyprodáno", pillClass: "pill-danger" };
    if (item.qty < item.minQty) return { code: "low", label: "Pod minimem", pillClass: "pill-warn" };
    return { code: "ok", label: "V pořádku", pillClass: "pill-ok" };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stockItems));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function getSummary() {
    const totalValue = stockItems.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.price || 0), 0);
    const lowCount = stockItems.filter((i) => getStockStatus(i).code !== "ok").length;
    return {
      totalItems: stockItems.length,
      lowCount,
      totalValue
    };
  }

  function syncBranchSelects() {
    const branches = getBranches();
    const allOptions = ["Společný sklad", ...branches];

    const addSelect = document.getElementById("stBranchInput");
    if (addSelect) {
      const prev = addSelect.value;
      addSelect.innerHTML = allOptions
        .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        .join("");
      if (prev && allOptions.includes(prev)) addSelect.value = prev;
    }

    const filterSelect = document.getElementById("stockBranchFilter");
    if (filterSelect) {
      const usedBranches = [...new Set([...allOptions, ...stockItems.map((i) => i.branch)])];
      filterSelect.innerHTML =
        `<option value="all">Všechna odvětví</option>` +
        usedBranches
          .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
          .join("");
      if (branchFilter === "all" || usedBranches.includes(branchFilter)) {
        filterSelect.value = branchFilter;
      } else {
        branchFilter = "all";
        filterSelect.value = "all";
      }
    }
  }

  function render() {
    const listEl = document.getElementById("stockMenuList");
    if (!listEl) return;

    syncBranchSelects();

    const summary = getSummary();
    document.getElementById("stockKpiTotal").textContent = summary.totalItems;
    document.getElementById("stockKpiLow").textContent = summary.lowCount;
    document.getElementById("stockKpiValue").textContent = formatCzk(summary.totalValue);

    const branches = getBranches();
    const branchChoices = [...new Set(["Společný sklad", ...branches])];

    const filtered = stockItems.filter((item) => {
      const st = getStockStatus(item);
      const brOk = branchFilter === "all" || item.branch === branchFilter;
      const stOk =
        statusFilter === "all" ||
        (statusFilter === "low" && st.code !== "ok") ||
        (statusFilter === "ok" && st.code === "ok");
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.branch.toLowerCase().includes(q);
      return brOk && stOk && qOk;
    });

    if (stockItems.length === 0) {
      listEl.innerHTML = `
        <div class="stock-empty">
          <p class="muted">Sklad je zatím prázdný. Přidej první položku nahoře a přiřaď ji k odvětví z Podnikání.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="stock-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné skladové položky.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((item) => {
        const st = getStockStatus(item);
        const ratio =
          item.minQty > 0
            ? Math.min(100, Math.round((item.qty / item.minQty) * 100))
            : item.qty > 0
            ? 100
            : 0;
        const barClass = st.code === "empty" ? "empty" : st.code === "low" ? "low" : "";
        const itemTotal = item.qty * item.price;

        const choices = [...new Set([...branchChoices, item.branch])];
        const selectHtml = choices
          .map(
            (b) =>
              `<option value="${escapeHtml(b)}" ${b === item.branch ? "selected" : ""}>${escapeHtml(b)}</option>`
          )
          .join("");

        return `
          <div class="stock-item-row" data-id="${item.id}">
            <div class="stock-item-main">
              <div class="stock-item-title">
                <span>${escapeHtml(item.name)}</span>
                <span class="stock-branch-badge">${escapeHtml(item.branch)}</span>
              </div>
              <div class="muted">
                Min. limit: ${formatQty(item.minQty)} ${escapeHtml(item.unit)}
                ${item.price > 0 ? ` • Cena: ${formatCzk(item.price)} / ${escapeHtml(item.unit)}` : ""}
              </div>
            </div>

            <div class="stock-item-stats">
              <div class="stock-qty-box">
                <strong>${formatQty(item.qty)} ${escapeHtml(item.unit)}</strong>
                <div class="stock-bar">
                  <div class="stock-bar-fill ${barClass}" style="width: ${ratio}%"></div>
                </div>
              </div>

              <span class="status-pill ${st.pillClass}">● ${st.label}</span>

              ${item.price > 0 ? `<strong>${formatCzk(itemTotal)}</strong>` : ""}
            </div>

            <div class="stock-item-actions">
              <button class="btn-sm" data-st-step="-1" data-id="${item.id}" title="Odebrat 1">-1</button>
              <button class="btn-sm" data-st-step="1" data-id="${item.id}" title="Přidat 1">+1</button>
              <select class="stock-branch-select" data-st-branch="${item.id}" aria-label="Přiřadit odvětví">
                ${selectHtml}
              </select>
              <button class="btn-sm" data-st-del="${item.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("stockAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("stNameInput");
        const branchInput = document.getElementById("stBranchInput");
        const qtyInput = document.getElementById("stQtyInput");
        const unitInput = document.getElementById("stUnitInput");
        const minInput = document.getElementById("stMinInput");
        const priceInput = document.getElementById("stPriceInput");

        const name = nameInput ? nameInput.value.trim() : "";
        if (!name) return;

        const selectedBranch = branchInput ? branchInput.value : "Společný sklad";
        stockItems.unshift({
          id: Date.now(),
          name,
          branch: selectedBranch,
          qty: Math.max(0, Number(qtyInput.value) || 0),
          unit: unitInput ? unitInput.value : "ks",
          minQty: Math.max(0, Number(minInput.value) || 0),
          price: Math.max(0, Number(priceInput.value) || 0)
        });

        form.reset();
        if (branchInput) branchInput.value = selectedBranch;
        if (nameInput) nameInput.focus();
        persistAndNotify();
      });
    }

    document.getElementById("stockBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
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

    const listEl = document.getElementById("stockMenuList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const stepBtn = e.target.closest("[data-st-step]");
        if (stepBtn) {
          const id = Number(stepBtn.dataset.id);
          const delta = Number(stepBtn.dataset.stStep);
          stockItems = stockItems.map((item) => {
            if (item.id !== id) return item;
            const nextQty = Math.max(0, Number((item.qty + delta).toFixed(2)));
            return { ...item, qty: nextQty };
          });
          persistAndNotify();
          return;
        }

        const delBtn = e.target.closest("[data-st-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.id);
          stockItems = stockItems.filter((item) => item.id !== id);
          persistAndNotify();
        }
      });

      listEl.addEventListener("change", (e) => {
        const brSel = e.target.closest("[data-st-branch]");
        if (!brSel) return;
        const id = Number(brSel.dataset.stBranch);
        const newBranch = brSel.value;
        stockItems = stockItems.map((item) =>
          item.id === id ? { ...item, branch: newBranch } : item
        );
        persistAndNotify();
      });
    }
  }

  bindEvents();
  render();

  window.SkladModule = {
    render,
    getSummary
  };
})();
