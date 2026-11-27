(function () {
  const STORAGE_KEY = "il_odvetvi_seznam";

  const TAG_LABELS = {
    "aktivni": "Aktivní",
    "pripravuje-se": "Připravuje se",
    "pauza": "Pauza"
  };

  let odvetvi = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uloz() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(odvetvi));
    render();
  }

  function render() {
    const container = document.getElementById("bizOdvetviList");
    const countEl = document.getElementById("bizCountBadge");
    if (!container) return;

    if (countEl) {
      countEl.textContent =
        odvetvi.length === 1 ? "1 odvětví" : `${odvetvi.length} odvětví`;
    }

    if (odvetvi.length === 0) {
      container.innerHTML = `
        <div class="biz-empty">
          <p class="muted">Seznam je zatím prázdný. Přidej první odvětví pomocí formuláře nahoře.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = odvetvi
      .map((item) => {
        const tagText = TAG_LABELS[item.stav] || item.stav;
        return `
          <div class="biz-row" data-id="${item.id}">
            <div class="biz-info">
              <div class="biz-name">${escapeHtml(item.nazev)}</div>
              ${item.poznamka ? `<div class="muted">${escapeHtml(item.poznamka)}</div>` : ""}
            </div>
            <div class="biz-controls">
              <span class="biz-tag tag-${escapeHtml(item.stav)}">${escapeHtml(tagText)}</span>
              <select class="biz-status-select" data-action="zmenit-stav" data-id="${item.id}" aria-label="Změnit stav">
                <option value="aktivni" ${item.stav === "aktivni" ? "selected" : ""}>Aktivní</option>
                <option value="pripravuje-se" ${item.stav === "pripravuje-se" ? "selected" : ""}>Připravuje se</option>
                <option value="pauza" ${item.stav === "pauza" ? "selected" : ""}>Pauza</option>
              </select>
              <button class="btn-sm" data-action="smazat" data-id="${item.id}">Smazat</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function pridejOdvetvi(nazev, stav, poznamka) {
    odvetvi.unshift({
      id: Date.now(),
      nazev,
      stav,
      poznamka
    });
    uloz();
  }

  function navazUdalosti() {
    const form = document.getElementById("bizAddForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nazevInput = document.getElementById("bizNazevInput");
        const stavSelect = document.getElementById("bizStavSelect");
        const poznamkaInput = document.getElementById("bizPoznamkaInput");

        const nazev = nazevInput ? nazevInput.value.trim() : "";
        const stav = stavSelect ? stavSelect.value : "aktivni";
        const poznamka = poznamkaInput ? poznamkaInput.value.trim() : "";

        if (!nazev) return;
        pridejOdvetvi(nazev, stav, poznamka);
        form.reset();
        if (stavSelect) stavSelect.value = "aktivni";
        if (nazevInput) nazevInput.focus();
      });
    }

    const container = document.getElementById("bizOdvetviList");
    if (container) {
      container.addEventListener("change", (e) => {
        const sel = e.target.closest('select[data-action="zmenit-stav"]');
        if (!sel) return;
        const id = Number(sel.dataset.id);
        const novyStav = sel.value;
        odvetvi = odvetvi.map((item) =>
          item.id === id ? { ...item, stav: novyStav } : item
        );
        uloz();
      });

      container.addEventListener("click", (e) => {
        const btn = e.target.closest('button[data-action="smazat"]');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        odvetvi = odvetvi.filter((item) => item.id !== id);
        uloz();
      });
    }
  }

  navazUdalosti();
  render();

  window.PodnikaniModule = {
    render
  };
})();
