(function () {
  const STORAGE_KEY = "il_marketing_aktivity_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  const STATUS_LABELS = {
    "napad": "Nápad",
    "aktivni": "Aktivní",
    "pozastaveno": "Pozastaveno",
    "ukonceno": "Ukončeno"
  };

  // Prázdný výchozí seznam — aktivity a kampaně si přidáváš sám na webu
  let campaigns = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let statusFilter = "all";
  let branchFilter = "all";
  let channelFilter = "all";
  let searchQuery = "";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCzk(num) {
    return `${Math.round(Number(num) || 0).toLocaleString("cs-CZ")} Kč`;
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
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === "aktivni").length;
    const ideas = campaigns.filter((c) => c.status === "napad").length;
    const activeBudget = campaigns
      .filter((c) => c.status === "aktivni")
      .reduce((sum, c) => sum + Number(c.budget || 0), 0);

    return { total, active, ideas, activeBudget };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncSelects() {
    const branches = getBranches();
    const baseOptions = ["Skupinové", ...branches];
    const usedBranches = campaigns.map((c) => c.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedBranches])];

    const addSelect = document.getElementById("mktBranchInput");
    if (addSelect) {
      const prev = addSelect.value;
      addSelect.innerHTML = allOptions
        .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        .join("");
      if (prev && allOptions.includes(prev)) {
        addSelect.value = prev;
      } else {
        addSelect.value = "Skupinové";
      }
    }

    const filterSelect = document.getElementById("mktBranchFilter");
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

  function render() {
    const listEl = document.getElementById("mktList");
    if (!listEl) return;

    syncSelects();

    const summary = getSummary();
    document.getElementById("mktKpiActive").textContent = summary.active;
    document.getElementById("mktKpiBudget").textContent = formatCzk(summary.activeBudget);
    document.getElementById("mktKpiIdeas").textContent = summary.ideas;
    document.getElementById("mktKpiTotal").textContent = summary.total;

    const badgeEl = document.getElementById("mktCountBadge");
    const filtered = campaigns.filter((c) => {
      const stOk = statusFilter === "all" || c.status === statusFilter;
      const brOk = branchFilter === "all" || c.branch === branchFilter;
      const chOk = channelFilter === "all" || c.channel === channelFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.branch.toLowerCase().includes(q) ||
        c.channel.toLowerCase().includes(q) ||
        (c.note && c.note.toLowerCase().includes(q));
      return stOk && brOk && chOk && qOk;
    });

    if (badgeEl) {
      badgeEl.textContent =
        filtered.length === 1 ? "1 aktivita" : `${filtered.length} aktivit`;
    }

    if (campaigns.length === 0) {
      listEl.innerHTML = `
        <div class="mkt-empty">
          <p class="muted">Zatím nemáš zapsanou žádnou marketingovou aktivitu ani nápad. Přidej první položku nahoře.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="mkt-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné marketingové položky.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((c) => {
        const statusLabel = STATUS_LABELS[c.status] || c.status;
        const metaParts = [];
        if (Number(c.budget) > 0) metaParts.push(`Rozpočet: ${formatCzk(c.budget)}`);
        if (c.note) metaParts.push(`Poznámka / výsledek: ${c.note}`);

        return `
          <div class="mkt-row" data-id="${c.id}">
            <div class="mkt-main">
              <div class="mkt-title-line">
                <span class="mkt-name">${escapeHtml(c.name)}</span>
                <span class="mkt-branch-badge">${escapeHtml(c.branch || "Skupinové")}</span>
                <span class="mkt-channel-badge">${escapeHtml(c.channel || "Jiný kanál")}</span>
                <span class="mkt-tag tag-${escapeHtml(c.status)}">${escapeHtml(statusLabel)}</span>
              </div>
              ${metaParts.length ? `<div class="muted mkt-meta-line">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
            </div>

            <div class="mkt-controls">
              <select class="mkt-status-select" data-mkt-status="${c.id}" aria-label="Změnit stav aktivity">
                <option value="napad" ${c.status === "napad" ? "selected" : ""}>Nápad</option>
                <option value="aktivni" ${c.status === "aktivni" ? "selected" : ""}>Aktivní</option>
                <option value="pozastaveno" ${c.status === "pozastaveno" ? "selected" : ""}>Pozastaveno</option>
                <option value="ukonceno" ${c.status === "ukonceno" ? "selected" : ""}>Ukončeno</option>
              </select>
              <button class="btn-sm" data-mkt-note="${c.id}">Poznámka</button>
              <button class="btn-sm" data-mkt-approve="${c.id}">Ke schválení</button>
              <button class="btn-sm" data-mkt-del="${c.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("mktAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("mktNameInput");
        const branchEl = document.getElementById("mktBranchInput");
        const channelEl = document.getElementById("mktChannelInput");
        const statusEl = document.getElementById("mktStatusInput");
        const budgetEl = document.getElementById("mktBudgetInput");
        const noteEl = document.getElementById("mktNoteInput");

        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return;

        const chosenBranch = branchEl ? branchEl.value : "Skupinové";
        const chosenChannel = channelEl ? channelEl.value : "Sociální sítě";
        const chosenStatus = statusEl ? statusEl.value : "napad";

        campaigns.unshift({
          id: Date.now(),
          name,
          branch: chosenBranch,
          channel: chosenChannel,
          status: chosenStatus,
          budget: Math.max(0, Number(budgetEl ? budgetEl.value : 0) || 0),
          note: noteEl ? noteEl.value.trim() : ""
        });

        form.reset();
        if (branchEl) branchEl.value = chosenBranch;
        if (channelEl) channelEl.value = chosenChannel;
        if (statusEl) statusEl.value = chosenStatus;
        if (nameEl) nameEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("mktStatusFilter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });

    document.getElementById("mktBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      render();
    });

    document.getElementById("mktChannelFilter")?.addEventListener("change", (e) => {
      channelFilter = e.target.value;
      render();
    });

    document.getElementById("mktSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const listEl = document.getElementById("mktList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const noteBtn = e.target.closest("[data-mkt-note]");
        if (noteBtn) {
          const id = Number(noteBtn.dataset.id);
          const target = campaigns.find((c) => c.id === id);
          if (!target) return;
          const updated = window.prompt("Poznámka / výsledek kampaně:", target.note || "");
          if (updated === null) return;
          campaigns = campaigns.map((c) =>
            c.id === id ? { ...c, note: updated.trim() } : c
          );
          persistAndNotify();
          return;
        }

        const appBtn = e.target.closest("[data-mkt-approve]");
        if (appBtn) {
          const id = Number(appBtn.dataset.id);
          const target = campaigns.find((c) => c.id === id);
          if (target && window.PortalApp && typeof window.PortalApp.addApproval === "function") {
            const budgetSuffix = Number(target.budget) > 0 ? ` (${formatCzk(target.budget)})` : "";
            window.PortalApp.addApproval({
              division: target.branch || "Marketing",
              title: `Kampaň ke schválení: ${target.name} [${target.channel}]${budgetSuffix}`,
              time: "Z marketingu"
            });
          }
          return;
        }

        const delBtn = e.target.closest("[data-mkt-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.id);
          campaigns = campaigns.filter((c) => c.id !== id);
          persistAndNotify();
        }
      });

      listEl.addEventListener("change", (e) => {
        const stSel = e.target.closest("[data-mkt-status]");
        if (!stSel) return;
        const id = Number(stSel.dataset.mktStatus);
        const nextStatus = stSel.value;
        campaigns = campaigns.map((c) =>
          c.id === id ? { ...c, status: nextStatus } : c
        );
        persistAndNotify();
      });
    }
  }

  bindEvents();
  render();

  window.MarketingModule = {
    render,
    getSummary
  };
})();
