(function () {
  const DATA_KEYS = [
    "il_odvetvi_seznam",
    "il_sklad_polozky_v1",
    "il_finance_transakce_v1",
    "il_projekty_seznam_v1",
    "il_marketing_aktivity_v1",
    "il_lide_seznam_v1",
    "il_kartoteka_seznam_v1",
    "il_role_ranky_v1",
    "il_exec_approvals",
    "il_ops_items"
  ];

  const ALL_BACKUP_KEYS = [...DATA_KEYS, "il_theme"];

  let lastFeedback = null; // { type: "ok" | "err", message: string }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readArray(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function setFeedback(type, message) {
    lastFeedback = { type, message };
    renderFeedback();
  }

  function renderFeedback() {
    const el = document.getElementById("setFeedback");
    if (!el) return;
    if (!lastFeedback) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.className = `set-feedback ${
      lastFeedback.type === "ok" ? "set-feedback-ok" : "set-feedback-err"
    }`;
    el.textContent = lastFeedback.message;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} kB`;
  }

  function computeStorageBytes() {
    let total = 0;
    ALL_BACKUP_KEYS.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        total += (key.length + val.length) * 2;
      }
    });
    return total;
  }

  function refreshAllModules() {
    if (window.PodnikaniModule && typeof window.PodnikaniModule.render === "function") {
      window.PodnikaniModule.render();
    }
    if (window.SkladModule && typeof window.SkladModule.render === "function") {
      window.SkladModule.render();
    }
    if (window.FinanceModule && typeof window.FinanceModule.render === "function") {
      window.FinanceModule.render();
    }
    if (window.ProjektyModule && typeof window.ProjektyModule.render === "function") {
      window.ProjektyModule.render();
    }
    if (window.MarketingModule && typeof window.MarketingModule.render === "function") {
      window.MarketingModule.render();
    }
    if (window.LideModule && typeof window.LideModule.render === "function") {
      window.LideModule.render();
    }
    if (window.KartotekaModule && typeof window.KartotekaModule.render === "function") {
      window.KartotekaModule.render();
    }
    if (window.RoleModule && typeof window.RoleModule.render === "function") {
      window.RoleModule.render();
    }
    if (window.PortalApp && typeof window.PortalApp.onDataChanged === "function") {
      window.PortalApp.onDataChanged();
    }
  }

  function exportBackup() {
    const data = {};
    ALL_BACKUP_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      } else if (key === "il_theme") {
        data[key] = document.documentElement.getAttribute("data-theme") || "dark";
      } else {
        data[key] = [];
      }
    });

    const payload = {
      app: "InfinityLook Corporate Portal",
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infinitylook-zaloha-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback("ok", `Záloha byla úspěšně exportována do souboru infinitylook-zaloha-${stamp}.json.`);
  }

  function importBackupFromFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target.result || ""));
        const source =
          parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object"
            ? parsed.data
            : parsed;

        if (!source || typeof source !== "object") {
          setFeedback("err", "Soubor nemá platnou strukturu zálohy portálu.");
          return;
        }

        let restoredCount = 0;

        DATA_KEYS.forEach((key) => {
          if (Array.isArray(source[key])) {
            localStorage.setItem(key, JSON.stringify(source[key]));
            restoredCount += source[key].length;
          }
        });

        if (source.il_theme === "dark" || source.il_theme === "light") {
          localStorage.setItem("il_theme", source.il_theme);
          document.documentElement.setAttribute("data-theme", source.il_theme);
        }

        refreshAllModules();
        render();
        setFeedback(
          "ok",
          `Data byla obnovena ze souboru „${escapeHtml(file.name)}“ (celkem ${restoredCount} záznamů v modulech).`
        );
      } catch {
        setFeedback("err", "Nepodařilo se načíst soubor. Zkontroluj, že jde o platný JSON export portálu.");
      }
    };

    reader.onerror = () => {
      setFeedback("err", "Chyba při čtení souboru z disku.");
    };

    reader.readAsText(file, "utf-8");
  }

  function resetAllData() {
    const firstConfirm = window.confirm(
      "Opravdu chceš smazat všechna data ze všech modulů (Podnikání, Sklad, Finance, Projekty, Marketing, Lidé, Kartotéka, Role & Ranky)? Doporučujeme nejdřív stáhnout zálohu."
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "Toto je nevratné smazání lokálních dat v tomto prohlížeči. Pokračovat?"
    );
    if (!secondConfirm) return;

    DATA_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });

    if (window.PortalApp && typeof window.PortalApp.resetRuntimeState === "function") {
      window.PortalApp.resetRuntimeState();
    }

    refreshAllModules();
    render();
    setFeedback("ok", "Všechna provozní data byla vymazána. Moduly jsou opět prázdné.");
  }

  function renderStats() {
    const listEl = document.getElementById("setStatsList");
    if (!listEl) return;

    const rows = [
      { label: "Odvětví (Podnikání)", val: `${readArray("il_odvetvi_seznam").length} položek` },
      { label: "Skladové položky (Sklad)", val: `${readArray("il_sklad_polozky_v1").length} položek` },
      { label: "Transakce (Finance)", val: `${readArray("il_finance_transakce_v1").length} položek` },
      { label: "Projekty", val: `${readArray("il_projekty_seznam_v1").length} položek` },
      { label: "Marketingové aktivity", val: `${readArray("il_marketing_aktivity_v1").length} položek` },
      { label: "Lidé", val: `${readArray("il_lide_seznam_v1").length} položek` },
      { label: "Kartotéka", val: `${readArray("il_kartoteka_seznam_v1").length} položek` },
      { label: "Role & Ranky", val: `${readArray("il_role_ranky_v1").length} položek` },
      { label: "Využité úložiště (localStorage)", val: formatBytes(computeStorageBytes()) }
    ];

    listEl.innerHTML = rows
      .map(
        (r) => `
      <div class="set-stat-row">
        <span>${escapeHtml(r.label)}</span>
        <span class="set-stat-val">${escapeHtml(r.val)}</span>
      </div>
    `
      )
      .join("");

    const themeBadge = document.getElementById("setCurrentThemeBadge");
    if (themeBadge) {
      const curTheme = document.documentElement.getAttribute("data-theme") || "dark";
      themeBadge.textContent = curTheme === "dark" ? "Tmavý režim" : "Světlý režim";
    }
  }

  function render() {
    renderStats();
    renderFeedback();
  }

  function bindEvents() {
    document.getElementById("setExportBtn")?.addEventListener("click", exportBackup);

    const fileInput = document.getElementById("setImportFile");
    document.getElementById("setImportBtn")?.addEventListener("click", () => {
      if (fileInput) {
        fileInput.value = "";
        fileInput.click();
      }
    });

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        importBackupFromFile(file);
      }
    });

    document.getElementById("setThemeBtn")?.addEventListener("click", () => {
      document.getElementById("themeToggle")?.click();
      renderStats();
    });

    document.getElementById("setResetBtn")?.addEventListener("click", resetAllData);
  }

  bindEvents();
  render();

  window.NastaveniModule = {
    render
  };
})();
