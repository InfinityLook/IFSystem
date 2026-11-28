(function () {
  const STORAGE_KEY = "il_role_ranky_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  const TIER_LABELS = {
    "vedeni": "Vedení",
    "provoz": "Provoz",
    "specialista": "Specialista",
    "spoluprace": "Spolupráce"
  };

  // Prázdný výchozí seznam — role a ranky si definuješ sám na webu
  let roles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let tierFilter = "all";
  let branchFilter = "all";
  let searchQuery = "";

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function getRoles() {
    return roles.slice();
  }

  function getSummary() {
    const total = roles.length;
    const leadership = roles.filter((r) => r.tier === "vedeni").length;
    const operations = roles.filter((r) => r.tier === "provoz").length;
    const specialists = roles.filter(
      (r) => r.tier === "specialista" || r.tier === "spoluprace"
    ).length;

    return { total, leadership, operations, specialists };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
    render();
    if (window.LideModule && typeof window.LideModule.render === "function") {
      window.LideModule.render();
    }
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncSelects() {
    const branches = getBranches();
    const baseOptions = ["Skupinové", ...branches];
    const usedBranches = roles.map((r) => r.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedBranches])];

    const addSelect = document.getElementById("rnkBranchInput");
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

    const filterSelect = document.getElementById("rnkBranchFilter");
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
    const listEl = document.getElementById("rnkList");
    if (!listEl) return;

    syncSelects();

    const summary = getSummary();
    document.getElementById("rnkKpiTotal").textContent = summary.total;
    document.getElementById("rnkKpiLeadership").textContent = summary.leadership;
    document.getElementById("rnkKpiOperations").textContent = summary.operations;
    document.getElementById("rnkKpiSpecialists").textContent = summary.specialists;

    const badgeEl = document.getElementById("rnkCountBadge");
    const filtered = roles.filter((r) => {
      const trOk = tierFilter === "all" || r.tier === tierFilter;
      const brOk = branchFilter === "all" || r.branch === branchFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.branch && r.branch.toLowerCase().includes(q)) ||
        (r.desc && r.desc.toLowerCase().includes(q));
      return trOk && brOk && qOk;
    });

    if (badgeEl) {
      badgeEl.textContent =
        filtered.length === 1 ? "1 role / rank" : `${filtered.length} rolí / ranků`;
    }

    if (roles.length === 0) {
      listEl.innerHTML = `
        <div class="rnk-empty">
          <p class="muted">Katalog rolí a ranků je zatím prázdný. Přidej první roli nebo rank nahoře a pak ho přiřaď lidem v sekci Lidé.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="rnk-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné role ani ranky.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((r) => {
        const tierLabel = TIER_LABELS[r.tier] || r.tier;
        return `
          <div class="rnk-row" data-id="${r.id}">
            <div class="rnk-main">
              <div class="rnk-title-line">
                <span class="rnk-name">${escapeHtml(r.name)}</span>
                <span class="rnk-tier-badge tier-${escapeHtml(r.tier)}">${escapeHtml(tierLabel)}</span>
                <span class="rnk-branch-badge">${escapeHtml(r.branch || "Skupinové")}</span>
              </div>
              ${r.desc ? `<div class="muted rnk-meta-line">${escapeHtml(r.desc)}</div>` : ""}
            </div>

            <div class="rnk-controls">
              <button class="btn-sm" data-rnk-desc="${r.id}">Popis</button>
              <button class="btn-sm" data-rnk-del="${r.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("rnkAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("rnkNameInput");
        const tierEl = document.getElementById("rnkTierInput");
        const branchEl = document.getElementById("rnkBranchInput");
        const descEl = document.getElementById("rnkDescInput");

        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return;

        const chosenTier = tierEl ? tierEl.value : "provoz";
        const chosenBranch = branchEl ? branchEl.value : "Skupinové";

        roles.unshift({
          id: Date.now(),
          name,
          tier: chosenTier,
          branch: chosenBranch,
          desc: descEl ? descEl.value.trim() : ""
        });

        form.reset();
        if (tierEl) tierEl.value = chosenTier;
        if (branchEl) branchEl.value = chosenBranch;
        if (nameEl) nameEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("rnkTierFilter")?.addEventListener("change", (e) => {
      tierFilter = e.target.value;
      render();
    });

    document.getElementById("rnkBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      render();
    });

    document.getElementById("rnkSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const listEl = document.getElementById("rnkList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const descBtn = e.target.closest("[data-rnk-desc]");
        if (descBtn) {
          const id = Number(descBtn.dataset.rnkDesc);
          const target = roles.find((r) => r.id === id);
          if (!target) return;
          const updated = window.prompt("Popis role / ranku / pravomoci:", target.desc || "");
          if (updated === null) return;
          roles = roles.map((r) =>
            r.id === id ? { ...r, desc: updated.trim() } : r
          );
          persistAndNotify();
          return;
        }

        const delBtn = e.target.closest("[data-rnk-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.rnkDel);
          roles = roles.filter((r) => r.id !== id);
          persistAndNotify();
        }
      });
    }
  }

  bindEvents();
  render();

  window.RoleModule = {
    render,
    getRoles,
    getSummary
  };
})();
