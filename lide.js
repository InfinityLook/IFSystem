(function () {
  const STORAGE_KEY = "il_lide_seznam_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";
  const ROLE_STORAGE_KEY = "il_role_ranky_v1";

  const STATUS_LABELS = {
    "aktivni": "Aktivní",
    "volno": "Volno / Dovolená",
    "externi": "Externě / Spolupráce",
    "neaktivni": "Neaktivní"
  };

  // Prázdný výchozí seznam — lidi a spolupracovníky si přidáváš sám na webu
  let people = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let statusFilter = "all";
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
    if (window.RoleModule && typeof window.RoleModule.getRoles === "function") {
      return window.RoleModule.getRoles();
    }
    try {
      const raw = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY)) || [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function getSummary() {
    const total = people.length;
    const active = people.filter((p) => p.status === "aktivni").length;
    const onLeave = people.filter((p) => p.status === "volno").length;
    const external = people.filter((p) => p.status === "externi").length;

    return { total, active, onLeave, external };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncSelects() {
    const branches = getBranches();
    const baseOptions = ["Skupinové", ...branches];
    const usedBranches = people.map((p) => p.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedBranches])];

    const addSelect = document.getElementById("pplBranchInput");
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

    const filterSelect = document.getElementById("pplBranchFilter");
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

    const roleOptions = getRoles().map((r) => r.name).filter(Boolean);
    const usedRoles = people.map((p) => p.rank).filter(Boolean);
    const allRoles = [...new Set([...roleOptions, ...usedRoles])];

    const rankInput = document.getElementById("pplRankInput");
    if (rankInput) {
      const prevRank = rankInput.value;
      rankInput.innerHTML =
        `<option value="">Bez ranku / role</option>` +
        allRoles
          .map((rl) => `<option value="${escapeHtml(rl)}">${escapeHtml(rl)}</option>`)
          .join("");
      if (prevRank && allRoles.includes(prevRank)) {
        rankInput.value = prevRank;
      }
    }
  }

  function render() {
    const listEl = document.getElementById("pplList");
    if (!listEl) return;

    syncSelects();

    const summary = getSummary();
    document.getElementById("pplKpiTotal").textContent = summary.total;
    document.getElementById("pplKpiActive").textContent = summary.active;
    document.getElementById("pplKpiLeave").textContent = summary.onLeave;
    document.getElementById("pplKpiExternal").textContent = summary.external;

    const roleOptions = getRoles().map((r) => r.name).filter(Boolean);

    const badgeEl = document.getElementById("pplCountBadge");
    const filtered = people.filter((p) => {
      const stOk = statusFilter === "all" || p.status === statusFilter;
      const brOk = branchFilter === "all" || p.branch === branchFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.rank && p.rank.toLowerCase().includes(q)) ||
        (p.role && p.role.toLowerCase().includes(q)) ||
        (p.branch && p.branch.toLowerCase().includes(q)) ||
        (p.contact && p.contact.toLowerCase().includes(q));
      return stOk && brOk && qOk;
    });

    if (badgeEl) {
      badgeEl.textContent =
        filtered.length === 1 ? "1 člověk" : `${filtered.length} lidí`;
    }

    if (people.length === 0) {
      listEl.innerHTML = `
        <div class="ppl-empty">
          <p class="muted">Seznam lidí je zatím prázdný. Přidej prvního člena týmu nebo spolupracovníka nahoře.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="ppl-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné záznamy.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((p) => {
        const statusLabel = STATUS_LABELS[p.status] || p.status;
        const metaParts = [];
        if (p.contact) metaParts.push(`Kontakt / poznámka: ${p.contact}`);

        const rowRoleChoices = [...new Set([...roleOptions, ...(p.rank ? [p.rank] : [])])];

        return `
          <div class="ppl-row" data-id="${p.id}">
            <div class="ppl-main">
              <div class="ppl-title-line">
                <span class="ppl-name">${escapeHtml(p.name)}</span>
                ${p.rank ? `<span class="ppl-rank-badge">${escapeHtml(p.rank)}</span>` : ""}
                ${p.role ? `<span class="ppl-role-badge">${escapeHtml(p.role)}</span>` : ""}
                <span class="ppl-branch-badge">${escapeHtml(p.branch || "Skupinové")}</span>
                <span class="ppl-tag tag-${escapeHtml(p.status)}">${escapeHtml(statusLabel)}</span>
              </div>
              ${metaParts.length ? `<div class="muted ppl-meta-line">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
            </div>

            <div class="ppl-controls">
              <select class="ppl-rank-select" data-ppl-rank="${p.id}" aria-label="Přiřadit roli nebo rank">
                <option value="">Bez ranku</option>
                ${rowRoleChoices
                  .map(
                    (rl) =>
                      `<option value="${escapeHtml(rl)}" ${p.rank === rl ? "selected" : ""}>${escapeHtml(rl)}</option>`
                  )
                  .join("")}
              </select>
              <select class="ppl-status-select" data-ppl-status="${p.id}" aria-label="Změnit stav člověka">
                <option value="aktivni" ${p.status === "aktivni" ? "selected" : ""}>Aktivní</option>
                <option value="volno" ${p.status === "volno" ? "selected" : ""}>Volno / Dovolená</option>
                <option value="externi" ${p.status === "externi" ? "selected" : ""}>Externě / Spolupráce</option>
                <option value="neaktivni" ${p.status === "neaktivni" ? "selected" : ""}>Neaktivní</option>
              </select>
              <button class="btn-sm" data-ppl-contact="${p.id}">Kontakt / poznámka</button>
              <button class="btn-sm" data-ppl-del="${p.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("pplAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("pplNameInput");
        const rankEl = document.getElementById("pplRankInput");
        const roleEl = document.getElementById("pplRoleInput");
        const branchEl = document.getElementById("pplBranchInput");
        const statusEl = document.getElementById("pplStatusInput");
        const contactEl = document.getElementById("pplContactInput");

        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return;

        const chosenRank = rankEl ? rankEl.value : "";
        const chosenBranch = branchEl ? branchEl.value : "Skupinové";
        const chosenStatus = statusEl ? statusEl.value : "aktivni";

        people.unshift({
          id: Date.now(),
          name,
          rank: chosenRank,
          role: roleEl ? roleEl.value.trim() : "",
          branch: chosenBranch,
          status: chosenStatus,
          contact: contactEl ? contactEl.value.trim() : ""
        });

        form.reset();
        if (rankEl) rankEl.value = chosenRank;
        if (branchEl) branchEl.value = chosenBranch;
        if (statusEl) statusEl.value = chosenStatus;
        if (nameEl) nameEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("pplStatusFilter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });

    document.getElementById("pplBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      render();
    });

    document.getElementById("pplSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const listEl = document.getElementById("pplList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const contactBtn = e.target.closest("[data-ppl-contact]");
        if (contactBtn) {
          const id = Number(contactBtn.dataset.pplContact);
          const target = people.find((p) => p.id === id);
          if (!target) return;
          const updated = window.prompt("Kontakt nebo poznámka:", target.contact || "");
          if (updated === null) return;
          people = people.map((p) =>
            p.id === id ? { ...p, contact: updated.trim() } : p
          );
          persistAndNotify();
          return;
        }

        const delBtn = e.target.closest("[data-ppl-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.pplDel);
          people = people.filter((p) => p.id !== id);
          persistAndNotify();
        }
      });

      listEl.addEventListener("change", (e) => {
        const rkSel = e.target.closest("[data-ppl-rank]");
        if (rkSel) {
          const id = Number(rkSel.dataset.pplRank);
          const nextRank = rkSel.value;
          people = people.map((p) =>
            p.id === id ? { ...p, rank: nextRank } : p
          );
          persistAndNotify();
          return;
        }

        const stSel = e.target.closest("[data-ppl-status]");
        if (!stSel) return;
        const id = Number(stSel.dataset.pplStatus);
        const nextStatus = stSel.value;
        people = people.map((p) =>
          p.id === id ? { ...p, status: nextStatus } : p
        );
        persistAndNotify();
      });
    }
  }

  bindEvents();
  render();

  window.LideModule = {
    render,
    getSummary
  };
})();
                            
