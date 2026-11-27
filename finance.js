(function () {
  const STORAGE_KEY = "il_finance_transakce_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  // Prázdný výchozí seznam — transakce si zadáváš sám na webu
  let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let typeFilter = "all";
  let branchFilter = "all";
  let searchQuery = "";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCzk(num) {
    const rounded = Math.round(Number(num) || 0);
    return `${rounded.toLocaleString("cs-CZ")} Kč`;
  }

  function formatDateDisplay(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
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

  function getSummary() {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const net = income - expense;
    const marginPct = income > 0 ? Math.round((net / income) * 1000) / 10 : 0;

    return {
      income,
      expense,
      net,
      marginPct,
      count: transactions.length
    };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncSelects() {
    const branches = getBranches();
    const baseOptions = ["Obecné finance", ...branches];
    const usedInTx = transactions.map((t) => t.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedInTx])];

    const addSelect = document.getElementById("finBranchInput");
    if (addSelect) {
      const prev = addSelect.value;
      addSelect.innerHTML = allOptions
        .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        .join("");
      if (prev && allOptions.includes(prev)) {
        addSelect.value = prev;
      } else {
        addSelect.value = "Obecné finance";
      }
    }

    const filterSelect = document.getElementById("finBranchFilter");
    if (filterSelect) {
      filterSelect.innerHTML =
        `<option value="all">Všechna odvětví</option>` +
        allOptions
          .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
          .join("");
      if (branchFilter === "all" || allOptions.includes(branchFilter)) {
        filterSelect.value = branchFilter;
      } else {
        branchFilter = "all";
        filterSelect.value = "all";
      }
    }
  }

  function renderKpis() {
    const summary = getSummary();
    const elIncome = document.getElementById("finKpiIncome");
    if (!elIncome) return;

    elIncome.textContent = formatCzk(summary.income);
    document.getElementById("finKpiExpense").textContent = formatCzk(summary.expense);

    const netEl = document.getElementById("finKpiNet");
    const sign = summary.net > 0 ? "+" : "";
    netEl.textContent = `${sign}${formatCzk(summary.net)}`;
    netEl.className = `kpi-value ${summary.net >= 0 ? "fin-net-pos" : "fin-net-neg"}`;

    const marginEl = document.getElementById("finKpiMargin");
    marginEl.textContent = summary.income > 0 ? `${summary.marginPct} %` : "0 %";

    const stockHintEl = document.getElementById("finStockValueHint");
    if (stockHintEl && window.SkladModule && typeof window.SkladModule.getSummary === "function") {
      const st = window.SkladModule.getSummary();
      stockHintEl.textContent = `Hodnota zásob ve skladu: ${formatCzk(st.totalValue)}`;
    }
  }

  function renderTransactions() {
    const listEl = document.getElementById("finTransactionsList");
    const countBadge = document.getElementById("finTxCountBadge");
    if (!listEl) return;

    const filtered = transactions.filter((t) => {
      const typeOk = typeFilter === "all" || t.type === typeFilter;
      const brOk = branchFilter === "all" || t.branch === branchFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.branch && t.branch.toLowerCase().includes(q));
      return typeOk && brOk && qOk;
    });

    if (countBadge) {
      countBadge.textContent =
        filtered.length === 1 ? "1 položka" : `${filtered.length} položek`;
    }

    if (transactions.length === 0) {
      listEl.innerHTML = `
        <div class="fin-empty">
          <p class="muted">Zatím nemáš zapsanou žádnou finanční transakci. Přidej první příjem nebo výdaj nahoře.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="fin-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné transakce.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((t) => {
        const isIncome = t.type === "income";
        const amountCls = isIncome ? "fin-amount-in" : "fin-amount-out";
        const prefix = isIncome ? "+" : "-";
        const metaParts = [
          isIncome ? "Příjem" : "Výdaj",
          t.category || null,
          t.date ? formatDateDisplay(t.date) : null
        ].filter(Boolean);

        return `
          <div class="fin-tx-row" data-id="${t.id}">
            <div class="fin-tx-main">
              <div class="fin-tx-title">
                <span>${escapeHtml(t.title)}</span>
                <span class="fin-branch-badge">${escapeHtml(t.branch || "Obecné finance")}</span>
              </div>
              <div class="muted">${escapeHtml(metaParts.join(" • "))}</div>
            </div>

            <div class="fin-tx-side">
              <span class="${amountCls}">${prefix}${formatCzk(t.amount)}</span>
              <button class="btn-sm" data-fin-del="${t.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderBranchBreakdown() {
    const box = document.getElementById("finBranchBreakdown");
    if (!box) return;

    const branches = getBranches();
    const usedBranches = transactions.map((t) => t.branch).filter(Boolean);
    const activeNames = [...new Set([...branches, ...usedBranches, "Obecné finance"])];

    const stats = activeNames
      .map((name) => {
        const items = transactions.filter((t) => (t.branch || "Obecné finance") === name);
        const inc = items
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const exp = items
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        return {
          name,
          inc,
          exp,
          net: inc - exp,
          txCount: items.length
        };
      })
      .filter((row) => branches.includes(row.name) || row.txCount > 0);

    if (stats.length === 0) {
      box.innerHTML = `<p class="muted">Zatím nejsou k dispozici žádná data po odvětvích.</p>`;
      return;
    }

    box.innerHTML = stats
      .map((row) => {
        const netCls = row.net >= 0 ? "fin-net-pos" : "fin-net-neg";
        const sign = row.net > 0 ? "+" : "";
        return `
          <div class="fin-branch-card">
            <div class="fin-branch-top">
              <strong>${escapeHtml(row.name)}</strong>
              <span class="${netCls}">${sign}${formatCzk(row.net)}</span>
            </div>
            <div class="fin-branch-sub">
              <span>Příjmy: ${formatCzk(row.inc)}</span>
              <span>Výdaje: ${formatCzk(row.exp)}</span>
              <span>Položek: ${row.txCount}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function render() {
    if (!document.getElementById("view-finance")) return;
    syncSelects();
    renderKpis();
    renderTransactions();
    renderBranchBreakdown();
  }

  function bindEvents() {
    const dateInput = document.getElementById("finDateInput");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    const form = document.getElementById("finAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const typeEl = document.getElementById("finTypeInput");
        const amountEl = document.getElementById("finAmountInput");
        const branchEl = document.getElementById("finBranchInput");
        const categoryEl = document.getElementById("finCategoryInput");
        const titleEl = document.getElementById("finTitleInput");
        const dateEl = document.getElementById("finDateInput");

        const amount = Number(amountEl ? amountEl.value : 0);
        const title = titleEl ? titleEl.value.trim() : "";
        if (!title || !(amount > 0)) return;

        const chosenType = typeEl ? typeEl.value : "income";
        const chosenBranch = branchEl ? branchEl.value : "Obecné finance";
        const chosenDate = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().slice(0, 10);

        transactions.unshift({
          id: Date.now(),
          type: chosenType,
          amount,
          branch: chosenBranch,
          category: categoryEl ? categoryEl.value.trim() : "",
          title,
          date: chosenDate
        });

        form.reset();
        if (typeEl) typeEl.value = chosenType;
        if (branchEl) branchEl.value = chosenBranch;
        if (dateEl) dateEl.value = chosenDate;
        if (titleEl) titleEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("finTypeFilter")?.addEventListener("change", (e) => {
      typeFilter = e.target.value;
      renderTransactions();
    });

    document.getElementById("finBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      renderTransactions();
    });

    document.getElementById("finSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderTransactions();
    });

    document.getElementById("finTransactionsList")?.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-fin-del]");
      if (!delBtn) return;
      const id = Number(delBtn.dataset.finDel);
      transactions = transactions.filter((t) => t.id !== id);
      persistAndNotify();
    });
  }

  bindEvents();
  render();

  window.FinanceModule = {
    render,
    getSummary
  };
})();
