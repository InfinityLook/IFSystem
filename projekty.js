(function () {
  const STORAGE_KEY = "il_projekty_seznam_v1";
  const BIZ_STORAGE_KEY = "il_odvetvi_seznam";

  const STATUS_LABELS = {
    "v-planu": "V plánu",
    "v-realizaci": "V realizaci",
    "pozastaveno": "Pozastaveno",
    "dokonceno": "Dokončeno"
  };

  // Prázdný výchozí stav — projekty si vytváříš sám na webu
  let projects = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

  function formatCzk(num) {
    return `${Math.round(Number(num) || 0).toLocaleString("cs-CZ")} Kč`;
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
    const total = projects.length;
    const active = projects.filter((p) => p.status === "v-realizaci").length;
    const done = projects.filter((p) => p.status === "dokonceno").length;
    const budgetSum = projects
      .filter((p) => p.status !== "dokonceno")
      .reduce((sum, p) => sum + Number(p.budget || 0), 0);

    return { total, active, done, budgetSum };
  }

  function persistAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    render();
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function syncBranchSelects() {
    const branches = getBranches();
    const baseOptions = ["Skupinové", ...branches];
    const usedBranches = projects.map((p) => p.branch).filter(Boolean);
    const allOptions = [...new Set([...baseOptions, ...usedBranches])];

    const addSelect = document.getElementById("prjBranchInput");
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

    const filterSelect = document.getElementById("prjBranchFilter");
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
    const listEl = document.getElementById("prjList");
    if (!listEl) return;

    syncBranchSelects();

    const summary = getSummary();
    document.getElementById("prjKpiTotal").textContent = summary.total;
    document.getElementById("prjKpiActive").textContent = summary.active;
    document.getElementById("prjKpiDone").textContent = summary.done;
    document.getElementById("prjKpiBudget").textContent = formatCzk(summary.budgetSum);

    const badgeEl = document.getElementById("prjCountBadge");
    const filtered = projects.filter((p) => {
      const stOk = statusFilter === "all" || p.status === statusFilter;
      const brOk = branchFilter === "all" || p.branch === branchFilter;
      const q = searchQuery.toLowerCase();
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.branch.toLowerCase().includes(q);
      return stOk && brOk && qOk;
    });

    if (badgeEl) {
      badgeEl.textContent =
        filtered.length === 1 ? "1 projekt" : `${filtered.length} projektů`;
    }

    if (projects.length === 0) {
      listEl.innerHTML = `
        <div class="prj-empty">
          <p class="muted">Zatím nemáš zapsaný žádný projekt. Přidej první položku formulářem nahoře.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="prj-empty">
          <p class="muted">Zvolenému filtru neodpovídají žádné projekty.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((p) => {
        const statusLabel = STATUS_LABELS[p.status] || p.status;
        const pct = Math.min(100, Math.max(0, Number(p.progress || 0)));
        const metaParts = [];
        if (Number(p.budget) > 0) metaParts.push(`Rozpočet: ${formatCzk(p.budget)}`);
        if (p.deadline) metaParts.push(`Termín: ${formatDateDisplay(p.deadline)}`);

        return `
          <div class="prj-row" data-id="${p.id}">
            <div class="prj-main">
              <div class="prj-title-line">
                <span class="prj-name">${escapeHtml(p.name)}</span>
                <span class="prj-branch-badge">${escapeHtml(p.branch || "Skupinové")}</span>
                <span class="prj-tag tag-${escapeHtml(p.status)}">${escapeHtml(statusLabel)}</span>
              </div>
              ${metaParts.length ? `<div class="muted">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
            </div>

            <div class="prj-progress-box">
              <div class="prj-progress-head">
                <span>Postup</span>
                <span>${pct} %</span>
              </div>
              <div class="prj-progress-track">
                <div class="prj-progress-fill ${p.status === "dokonceno" ? "done" : ""}" style="width: ${pct}%"></div>
              </div>
            </div>

            <div class="prj-controls">
              <button class="btn-sm" data-prj-step="-10" data-id="${p.id}" title="Snížit postup o 10 %">-10 %</button>
              <button class="btn-sm" data-prj-step="10" data-id="${p.id}" title="Zvýšit postup o 10 %">+10 %</button>
              <select class="prj-status-select" data-prj-status="${p.id}" aria-label="Změnit stav projektu">
                <option value="v-planu" ${p.status === "v-planu" ? "selected" : ""}>V plánu</option>
                <option value="v-realizaci" ${p.status === "v-realizaci" ? "selected" : ""}>V realizaci</option>
                <option value="pozastaveno" ${p.status === "pozastaveno" ? "selected" : ""}>Pozastaveno</option>
                <option value="dokonceno" ${p.status === "dokonceno" ? "selected" : ""}>Dokončeno</option>
              </select>
              <button class="btn-sm" data-prj-approve="${p.id}">Ke schválení</button>
              <button class="btn-sm" data-prj-del="${p.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    const form = document.getElementById("prjAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("prjNameInput");
        const branchEl = document.getElementById("prjBranchInput");
        const statusEl = document.getElementById("prjStatusInput");
        const budgetEl = document.getElementById("prjBudgetInput");
        const deadlineEl = document.getElementById("prjDeadlineInput");

        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return;

        const chosenBranch = branchEl ? branchEl.value : "Skupinové";
        const chosenStatus = statusEl ? statusEl.value : "v-planu";
        const initialProgress = chosenStatus === "dokonceno" ? 100 : 0;

        projects.unshift({
          id: Date.now(),
          name,
          branch: chosenBranch,
          status: chosenStatus,
          budget: Math.max(0, Number(budgetEl ? budgetEl.value : 0) || 0),
          deadline: deadlineEl ? deadlineEl.value : "",
          progress: initialProgress
        });

        form.reset();
        if (branchEl) branchEl.value = chosenBranch;
        if (statusEl) statusEl.value = chosenStatus;
        if (nameEl) nameEl.focus();

        persistAndNotify();
      });
    }

    document.getElementById("prjStatusFilter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });

    document.getElementById("prjBranchFilter")?.addEventListener("change", (e) => {
      branchFilter = e.target.value;
      render();
    });

    document.getElementById("prjSearch")?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    const listEl = document.getElementById("prjList");
    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const stepBtn = e.target.closest("[data-prj-step]");
        if (stepBtn) {
          const id = Number(stepBtn.dataset.id);
          const delta = Number(stepBtn.dataset.prjStep);
          projects = projects.map((p) => {
            if (p.id !== id) return p;
            const nextProg = Math.min(100, Math.max(0, Number(p.progress || 0) + delta));
            const nextStatus =
              nextProg === 100
                ? "dokonceno"
                : p.status === "dokonceno"
                ? "v-realizaci"
                : p.status;
            return { ...p, progress: nextProg, status: nextStatus };
          });
          persistAndNotify();
          return;
        }

        const appBtn = e.target.closest("[data-prj-approve]");
        if (appBtn) {
          const id = Number(appBtn.dataset.prjApprove);
          const target = projects.find((p) => p.id === id);
          if (target && window.PortalApp && typeof window.PortalApp.addApproval === "function") {
            const budgetSuffix = Number(target.budget) > 0 ? ` (${formatCzk(target.budget)})` : "";
            window.PortalApp.addApproval({
              division: target.branch || "Projekty",
              title: `Projekt ke schválení: ${target.name}${budgetSuffix}`,
              time: "Z projektů"
            });
          }
          return;
        }

        const delBtn = e.target.closest("[data-prj-del]");
        if (delBtn) {
          const id = Number(delBtn.dataset.id);
          projects = projects.filter((p) => p.id !== id);
          persistAndNotify();
        }
      });

      listEl.addEventListener("change", (e) => {
        const stSel = e.target.closest("[data-prj-status]");
        if (!stSel) return;
        const id = Number(stSel.dataset.prjStatus);
        const nextStatus = stSel.value;
        projects = projects.map((p) => {
          if (p.id !== id) return p;
          const nextProg = nextStatus === "dokonceno" ? 100 : p.progress;
          return { ...p, status: nextStatus, progress: nextProg };
        });
        persistAndNotify();
      });
    }
  }

  bindEvents();
  render();

  window.ProjektyModule = {
    render,
    getSummary
  };
})();
