(function () {
  function readJson(key, fallback) {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      return Array.isArray(raw) ? raw : fallback;
    } catch {
      return fallback;
    }
  }

  function formatCzk(num) {
    return `${Math.round(Number(num) || 0).toLocaleString("cs-CZ")} Kč`;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render({ approvals = [], formatCzk: fmtFn } = {}) {
    const fmt = fmtFn || formatCzk;
    const container = document.getElementById("view-prehled");
    if (!container) return;

    const branches = readJson("il_odvetvi_seznam", []);
    const stockItems = readJson("il_sklad_polozky_v1", []);
    const txItems = readJson("il_finance_transakce_v1", []);
    const prjItems = readJson("il_projekty_seznam_v1", []);
    const mktItems = readJson("il_marketing_aktivity_v1", []);
    const pplItems = readJson("il_lide_seznam_v1", []);
    const katItems = readJson("il_kartoteka_seznam_v1", []);

    // Finance souhrn
    const incomeTotal = txItems
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expenseTotal = txItems
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const netBalance = incomeTotal - expenseTotal;
    const marginPct =
      incomeTotal > 0 ? Math.round((netBalance / incomeTotal) * 100) : 0;

    document.getElementById("kpiRevenue").textContent =
      `${netBalance > 0 ? "+" : ""}${fmt(netBalance)}`;
    document.getElementById("kpiFinMarginBadge").textContent = `Marže ${marginPct} %`;
    document.getElementById("ovFinIncome").textContent = `+${fmt(incomeTotal)}`;
    document.getElementById("ovFinExpense").textContent = `-${fmt(expenseTotal)}`;

    // Sklad souhrn
    const lowStock = stockItems.filter(
      (i) => Number(i.qty || 0) <= Number(i.minQty || 0)
    );
    const stockValue = stockItems.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.price || 0),
      0
    );
    document.getElementById("kpiOverviewStockVal").textContent = fmt(stockValue);
    document.getElementById("kpiStockAlertsBadge").textContent =
      lowStock.length === 0 ? "Vše v pořádku" : `${lowStock.length} pod limitem`;

    // Projekty & Marketing souhrn
    const activePrj = prjItems.filter(
      (p) => p.status === "v-realizaci" || p.status === "v-planu"
    );
    const runningPrj = prjItems.filter((p) => p.status === "v-realizaci");
    const activeMkt = mktItems.filter((m) => m.status === "aktivni");

    document.getElementById("kpiActiveWork").textContent =
      `${runningPrj.length} / ${activeMkt.length}`;
    document.getElementById("kpiActiveWorkBadge").textContent =
      runningPrj.length + activeMkt.length > 0 ? "V chodu" : "Bez běžících";

    // Ke schválení
    const pendingCount = approvals.length;
    document.getElementById("kpiPending").textContent = pendingCount;
    document.getElementById("kpiPendingBadge").textContent =
      pendingCount === 1 ? "1 položka" : `${pendingCount} položek`;

    // Action Radar — co vyžaduje pozornost
    const radarSignals = [];

    lowStock.slice(0, 4).forEach((item) => {
      const out = Number(item.qty || 0) <= 0;
      radarSignals.push({
        badgeClass: out ? "ov-badge-danger" : "ov-badge-warn",
        badgeText: out ? "Vyprodáno" : "Pod limitem",
        title: `${item.name} (${Number(item.qty || 0)} ${item.unit || "ks"})`,
        sub: `Sklad • ${item.branch || "Skupinové"} • Min. limit: ${Number(item.minQty || 0)} ${item.unit || "ks"}`,
        jump: "sklad"
      });
    });

    const now = new Date();
    const soonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    prjItems
      .filter((p) => p.status === "v-realizaci")
      .forEach((p) => {
        const lowProg = Number(p.progress || 0) <= 20;
        const dueSoon = p.deadline && new Date(p.deadline) <= soonLimit;
        if (lowProg || dueSoon) {
          radarSignals.push({
            badgeClass: "ov-badge-info",
            badgeText: dueSoon ? "Blíží se termín" : `Postup ${p.progress || 0} %`,
            title: p.name,
            sub: `Projekt • ${p.branch || "Skupinové"}${p.deadline ? ` • Termín: ${p.deadline}` : ""}`,
            jump: "projekty"
          });
        }
      });

    const radarEl = document.getElementById("ovRadarList");
    const radarBadge = document.getElementById("ovRadarBadge");
    if (radarBadge) {
      radarBadge.textContent =
        radarSignals.length === 0 ? "V klidu" : `${radarSignals.length} podnětů`;
    }

    if (radarEl) {
      if (!radarSignals.length) {
        radarEl.innerHTML = `
          <div class="ov-empty">
            <p class="muted">Žádné kritické provozní signály. Sklad i rozjeté projekty jsou aktuálně v pořádku.</p>
          </div>
        `;
      } else {
        radarEl.innerHTML = radarSignals
          .map(
            (s) => `
          <div class="ov-radar-item">
            <div class="ov-radar-main">
              <div class="ov-radar-top">
                <span class="ov-radar-badge ${s.badgeClass}">${escapeHtml(s.badgeText)}</span>
                <span class="ov-radar-title">${escapeHtml(s.title)}</span>
              </div>
              <div class="ov-radar-sub">${escapeHtml(s.sub)}</div>
            </div>
            <div class="ov-radar-actions">
              <button class="btn-sm" data-jump="${escapeHtml(s.jump)}">Přejít →</button>
            </div>
          </div>
        `
          )
          .join("");
      }
    }

    // Ke schválení vedením
    const appList = document.getElementById("approvalsList");
    if (appList) {
      if (!approvals.length) {
        appList.innerHTML = `<div class="approval-item"><span class="muted">Žádné otevřené položky ke schválení.</span></div>`;
      } else {
        appList.innerHTML = approvals
          .map(
            (a) => `
          <div class="approval-item">
            <div class="approval-meta">
              <span>${escapeHtml(a.division)}</span>
              <span>${escapeHtml(a.time)}</span>
            </div>
            <div class="approval-title">${escapeHtml(a.title)}</div>
            <div class="approval-actions">
              <button class="btn-approve" data-app-action="approve" data-id="${a.id}">Schválit</button>
              <button class="btn-reject" data-app-action="reject" data-id="${a.id}">Zamítnout</button>
            </div>
          </div>
        `
          )
          .join("");
      }
    }

    // Odvětví z Podnikání v kostce
    const bizEl = document.getElementById("ovBizList");
    const bizBadge = document.getElementById("ovBizBadge");
    if (bizBadge) {
      bizBadge.textContent =
        branches.length === 1 ? "1 odvětví" : `${branches.length} odvětví`;
    }

    if (bizEl) {
      if (!branches.length) {
        bizEl.innerHTML = `
          <div class="ov-empty">
            <p class="muted">Zatím nemáš přidané žádné odvětví v modulu Podnikání.</p>
            <button class="btn-primary" style="margin-top:0.65rem" data-quick-jump="podnikani" data-focus="bizNazevInput">+ Přidat první odvětví</button>
          </div>
        `;
      } else {
        bizEl.innerHTML = branches
          .map((b) => {
            const name = b.nazev || b;
            const status = b.stav || "aktivni";
            const bTx = txItems.filter((t) => t.branch === name);
            const bIn = bTx
              .filter((t) => t.type === "income")
              .reduce((s, t) => s + Number(t.amount || 0), 0);
            const bOut = bTx
              .filter((t) => t.type === "expense")
              .reduce((s, t) => s + Number(t.amount || 0), 0);
            const bNet = bIn - bOut;
            const bPrj = prjItems.filter(
              (p) => p.branch === name && p.status !== "dokonceno"
            ).length;
            const bMkt = mktItems.filter(
              (m) => m.branch === name && m.status === "aktivni"
            ).length;

            const netClass =
              bNet > 0 ? "ov-net-pos" : bNet < 0 ? "ov-net-neg" : "";

            return `
              <div class="ov-biz-row" data-jump="podnikani">
                <div>
                  <div class="ov-biz-name">${escapeHtml(name)}</div>
                  <div class="ov-biz-meta">Stav: ${escapeHtml(status)} • Otevřené projekty: ${bPrj} • Aktivní kampaně: ${bMkt}</div>
                </div>
                <div class="ov-biz-right">
                  <div class="ov-biz-net ${netClass}">${bNet > 0 ? "+" : ""}${fmt(bNet)}</div>
                  <div class="ov-biz-meta">Bilance v odvětví</div>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    // Rychlý puls organizace
    const activePeople = pplItems.filter((p) => p.status === "aktivni").length;
    const activeKat = katItems.filter((k) => k.status === "aktivni").length;

    const pulseEl = document.getElementById("ovPulseGrid");
    if (pulseEl) {
      pulseEl.innerHTML = `
        <div class="ov-pulse-box" data-jump="lide">
          <div class="ov-pulse-num">${activePeople} / ${pplItems.length}</div>
          <div class="ov-pulse-lbl">Aktivní lidé v evidenci</div>
        </div>
        <div class="ov-pulse-box" data-jump="kartoteka">
          <div class="ov-pulse-num">${activeKat} / ${katItems.length}</div>
          <div class="ov-pulse-lbl">Aktivní položky v kartotéce</div>
        </div>
        <div class="ov-pulse-box" data-jump="projekty">
          <div class="ov-pulse-num">${activePrj.length}</div>
          <div class="ov-pulse-lbl">Rozpracované projekty</div>
        </div>
        <div class="ov-pulse-box" data-jump="marketing">
          <div class="ov-pulse-num">${activeMkt.length}</div>
          <div class="ov-pulse-lbl">Běžící marketingové kampaně</div>
        </div>
      `;
    }
  }

  window.PrehledModule = {
    render
  };
})();
