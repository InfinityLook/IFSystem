(function () {
  const STORAGE_KEY = "il_kartoteka_seznam_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  const STATUS_LABELS = {
    "aktivni": "Aktivní",
    "v-jednani": "V jednání",
    "pozastaveno": "Pozastaveno",
    "ukonceno": "Ukončeno"
  };

  // Prázdný výchozí seznam — položky v kartotéce si vytváříš sám na webu
  let records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let typeFilter = "all";
  let statusFilter = "all";
  let branchFilter = "all";
  let searchQuery = "";

  function escapeHtml(str) {
    return String(str)
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

  function getSummary() {
    const total = records.length;
    const active = records.filter((r) => r.status === "aktivni").length;
    const negotiating = records.filter((r) => r.status === "v-jednani").length;
    const suppliersOrPartners = records.filter(
      (r) => r.type === "Dodavatel" || r.type === "Partner"
    ).length;

    return { total, active, negotiating, suppliersOrPartners };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncSelects() {
    const branches = getBranches();
    const baseOptions = ["Skupinové", ...branches];
    const usedBranches = records.map((r) => r.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedBranches])];

    const addSelect = document.getElementById("katBranchInput");
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

    const filterSelect = document.getElementById("katBranchFilter");
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
    const listEl = document.getElementById("katList");
    if (!listEl) return;

    syncSelects();

    const summary = getSummary();
    document.getElementById("katKpiTotal").textContent = summary.total;
    document.getElementById("katKpiActive").textContent = summary.active;
    document.getElementById("katKpiNegotiating").textContent = summary.negotiating;
    document.getElementById("katKpiPartners").textContent = summary.suppliersOrPartners;

    const badgeEl = document.getElementById("katCountBadge");
    const filtered = records.filter((r) => {
      const tpOk = typeFilter === "all" || r.type === typeFilter;
      const stOk = statusFilter === "all" || r.status === statusFilter;
      const brOk = branchFilter === "all" || r.branch === branchFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.type && r.type.toLowerCase().includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q)) ||
        (r.contact && r.contact.toLowerCase().includes(q));
      return tpOk && stOk && brOk && qOk;
    });

    if (badgeEl) {
      badgeEl.textContent =
        filtered.length === 1 ? "1 záznam" : `${filtered.length} záznamů`;
    }

    if (records.length === 0) {
      listEl.innerHTML = `
        <div class="kat-empty">
          <p class="muted">Kartotéka je zatím prázdná. Přidej prvního dodavatele, partnera, klienta nebo smlouvu nahoře.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="kat-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné záznamy v kartotéce.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((r) => {
        const statusLabel = STATUS_LABELS[r.status] || r.status;
        const metaParts = [];
        if (r.contact) metaParts.push(`Kontakt / poznámka: ${r.contact}`);

        return `
          <div class="kat-row" data-id="${r.id}">
            <div class="kat-main">
              <div class="kat-title-line">
                <span class="kat-name">${escapeHtml(r.name)}</span>
                ${r.type ? `<span class="kat-type-badge">${escapeHtml(r.type)}</span>` : ""}
                <span class="kat-branch-badge">${escapeHtml(r.branch || "Skupinové")}</span>
                <span class="kat-tag tag-${escapeHtml(r.status)}">${escapeHtml(statusLabel)}</span>
              </div>
              ${metaParts.length ? `<div class="muted kat-meta-line">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
            </div>

            <div class="kat-controls">
              <select class="kat-status-select" data-kat-status="${r.id}" aria-label="Změnit stav záznamu">
                <option value="aktivni" ${r.status === "aktivni" ? "selected" : ""}>Aktivní</option>
                <option value="v-jednani" ${r.status === "v-jednani" ? "selected" : ""}>V jednání</option>
                <option value="pozastaveno" ${r.status === "pozastaveno" ? "selected" : ""}>Pozastaveno</option>
                <option value="ukonceno" ${r.status === "ukonceno" ? "selected" : ""}>Ukončeno</option>
              </select>
              <button class="btn-sm" data-kat-contact="${r.id}">Kontakt / poznámka</button>
              <button class="btn-sm" data-kat-del="${r.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("katAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("katNameInput");
        const typeEl = document.getElementById("katTypeInput");
        const branchEl = document.getElementById("katBranchInput");
        const statusEl = document.getElementById("katStatusInput");
        const contactEl = document.getElementById("katContactInput");

        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return;

        const chosenType = typeEl ? typeEl.value : "Dodavatel";
        const chosenBranch = branchEl ? branchEl.value : "Skupinové";
        const chosenStatus = statusEl ? statusEl.value : "aktivni";

        records.unshift({
          id: Date.now(),
          name,
          type: chosenType,
          branch: chosenBranch,
          status: chosenStatus,
          contact: contactEl ? contactEl.value.trim() : ""
        });

        form.reset();
        if (typeEl) typeEl.value = chosenType;
        if (branchEl) branchEl.value = chosenBranch;
        if (statusEl) statusEl.value = chosenStatus;
        if (nameEl) nameEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("katTypeFilter")?.addEventListener("change", (e) => {
      typeFilter = e.target.value;
      render();
    });

    document.getElementById("katStatusFilter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });

    document.getElementById("katBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      render();
    });

    document.getElementById("katSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const listEl = document.getElementById("katList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const contactBtn = e.target.closest("[data-kat-contact]");
        if (contactBtn) {
          const id = Number(contactBtn.dataset.katContact);
          const target = records.find((r) => r.id === id);
          if (!target) return;
          const updated = window.prompt("Kontakt nebo poznámka:", target.contact || "");
          if (updated === null) return;
          records = records.map((r) =>
            r.id === id ? { ...r, contact: updated.trim() } : r
          );
          persistAndNotify();
          return;
        }

        const delBtn = e.target.closest("[data-kat-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.katDel);
          records = records.filter((r) => r.id !== id);
          persistAndNotify();
        }
      });

      listEl.addEventListener("change", (e) => {
        const stSel = e.target.closest("[data-kat-status]");
        if (!stSel) return;
        const id = Number(stSel.dataset.katStatus);
        const nextStatus = stSel.value;
        records = records.map((r) =>
          r.id === id ? { ...r, status: nextStatus } : r
        );
        persistAndNotify();
      });
    }
  }

  bindEvents();
  render();

  window.KartotekaModule = {
    render,
    getSummary
  };
})();
