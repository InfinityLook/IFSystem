const sectionInfo = {
  prehled: { title: "Přehled", desc: "Ředitelský přehled výkonnosti a divizí" },
  podnikani: { title: "Podnikání", desc: "Seznam odvětví a druhů podnikání" },
  sklad: { title: "Sklad", desc: "Přehledné menu zásob podle odvětví" },
  finance: { title: "Finance", desc: "Příjmy, výdaje, bilance po odvětvích a finanční přehled" },
  projekty: { title: "Projekty", desc: "Správa projektů, postupu, rozpočtů a termínů podle odvětví" },
  marketing: { title: "Marketing", desc: "Kampaně, kanály, nápady, rozpočty a výsledky podle odvětví" },
  lide: { title: "Lidé", desc: "Organizační struktura, role, směny a kurýři" },
  kartoteka: { title: "Kartotéka", desc: "Evidence dodavatelů, partnerů a smluvních vztahů" },
  nastaveni: { title: "Nastavení", desc: "Systémová konfigurace, oprávnění a integrace" }
};

document.getElementById("todayDate").textContent = new Date().toLocaleDateString("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

const root = document.documentElement;
const savedTheme = localStorage.getItem("il_theme") || "dark";
root.setAttribute("data-theme", savedTheme);

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("il_theme", next);
});

const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("sidebarBackdrop");

function closeMobileMenu() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

document.getElementById("openSidebar").addEventListener("click", () => {
  sidebar.classList.add("open");
  backdrop.classList.add("show");
});

document.getElementById("closeSidebar").addEventListener("click", closeMobileMenu);
backdrop.addEventListener("click", closeMobileMenu);

const divisionsData = [
  {
    name: "Rozvoz jídla",
    sub: "Gastronomie & Logistika",
    status: "V provozu",
    statusType: "ok",
    owner: "Provozní dispečink",
    metric: "14 200 Kč",
    deviation: "+11 % vs. průměr"
  },
  {
    name: "E-shop",
    sub: "Online prodej & Expedice",
    status: "V provozu",
    statusType: "ok",
    owner: "Expedice & Sklad",
    metric: "7 450 Kč",
    deviation: "Bez odchylky"
  },
  {
    name: "PWA Google Play",
    sub: "Digitální produkt / Aplikace",
    status: "Aktivní",
    statusType: "ok",
    owner: "Produktový vývoj",
    metric: "1 900 Kč",
    deviation: "+4 % aktivních"
  },
  {
    name: "Další podnikání",
    sub: "Ostatní obchodní aktivity",
    status: "Kontrola",
    statusType: "warn",
    owner: "Vedení divize",
    metric: "1 300 Kč",
    deviation: "Čeká na uzávěrku"
  }
];

const defaultApprovals = [
  { id: 101, division: "Rozvoz jídla", title: "Doplnění obalového materiálu (6 400 Kč)", time: "Dnes" },
  { id: 102, division: "PWA Google Play", title: "Vydání nové produkční verze aplikace", time: "Dnes" }
];

const defaultItems = [];

let approvals = JSON.parse(localStorage.getItem("il_exec_approvals")) || defaultApprovals;
let items = JSON.parse(localStorage.getItem("il_ops_items")) || defaultItems;
let activeSection = "prehled";

function formatCzk(num) {
  return `${Math.round(num).toLocaleString("cs-CZ")} Kč`;
}

function saveAll() {
  localStorage.setItem("il_exec_approvals", JSON.stringify(approvals));
  localStorage.setItem("il_ops_items", JSON.stringify(items));
  render();
}

function renderOverview() {
  const pendingCount = approvals.length;
  document.getElementById("kpiPending").textContent = pendingCount;
  document.getElementById("kpiPendingBadge").textContent =
    pendingCount === 1 ? "1 položka" : `${pendingCount} položek`;

  if (window.FinanceModule && typeof window.FinanceModule.getSummary === "function") {
    const finSummary = window.FinanceModule.getSummary();
    const sign = finSummary.net > 0 ? "+" : "";
    document.getElementById("kpiRevenue").textContent = `${sign}${formatCzk(finSummary.net)}`;
    document.getElementById("kpiFinMarginBadge").textContent = `Marže ${finSummary.marginPct} %`;
  }

  if (window.SkladModule && typeof window.SkladModule.getSummary === "function") {
    const stockSummary = window.SkladModule.getSummary();
    document.getElementById("kpiOverviewStockVal").textContent = formatCzk(stockSummary.totalValue);
    document.getElementById("kpiStockAlertsBadge").textContent =
      stockSummary.lowCount === 0 ? "Vše v pořádku" : `${stockSummary.lowCount} pod limitem`;
  }

  const tbody = document.getElementById("divisionsTableBody");
  tbody.innerHTML = divisionsData
    .map(
      (d) => `
    <tr data-jump="podnikani">
      <td>
        <span class="div-name">${d.name}</span>
        <span class="div-sub">${d.sub}</span>
      </td>
      <td>
        <span class="status-pill ${d.statusType === "ok" ? "pill-ok" : "pill-warn"}">● ${d.status}</span>
      </td>
      <td>${d.owner}</td>
      <td><strong>${d.metric}</strong></td>
      <td class="muted">${d.deviation}</td>
    </tr>
  `
    )
    .join("");

  const appList = document.getElementById("approvalsList");
  if (!approvals.length) {
    appList.innerHTML = `<div class="approval-item"><span class="muted">Žádné otevřené položky ke schválení.</span></div>`;
    return;
  }

  appList.innerHTML = approvals
    .map(
      (a) => `
    <div class="approval-item">
      <div class="approval-meta">
        <span>${a.division}</span>
        <span>${a.time}</span>
      </div>
      <div class="approval-title">${a.title}</div>
      <div class="approval-actions">
        <button class="btn-approve" data-app-action="approve" data-id="${a.id}">Schválit</button>
        <button class="btn-reject" data-app-action="reject" data-id="${a.id}">Zamítnout</button>
      </div>
    </div>
  `
    )
    .join("");
}

function renderDetail() {
  const detailList = document.getElementById("detailList");
  const secItems = items.filter((i) => i.section === activeSection);

  if (!secItems.length) {
    detailList.innerHTML = `<div class="task-row"><span class="muted">V sekci ${sectionInfo[activeSection].title} zatím nejsou žádné záznamy.</span></div>`;
    return;
  }

  detailList.innerHTML = secItems
    .map((item) => {
      const tagText = item.tag ? ` • ${item.tag}` : "";
      const btnText =
        item.status === "urgent" ? "Převzít" : item.status === "progress" ? "Uzavřít" : "Uzavřeno ✓";
      return `
      <div class="task-row">
        <div>
          <div><span class="status-dot st-${item.status}"></span><strong>${item.title}</strong></div>
          <div class="muted">${sectionInfo[item.section].title}${tagText}</div>
        </div>
        <button data-action="cycle" data-id="${item.id}">${btnText}</button>
      </div>
    `;
    })
    .join("");
}

function render() {
  renderOverview();
  if (activeSection === "sklad" && window.SkladModule) {
    window.SkladModule.render();
  } else if (activeSection === "podnikani" && window.PodnikaniModule) {
    window.PodnikaniModule.render();
  } else if (activeSection === "finance" && window.FinanceModule) {
    window.FinanceModule.render();
  } else if (activeSection === "projekty" && window.ProjektyModule) {
    window.ProjektyModule.render();
  } else if (activeSection === "marketing" && window.MarketingModule) {
    window.MarketingModule.render();
  } else if (activeSection !== "prehled") {
    renderDetail();
  }
}

function switchSection(section) {
  activeSection = section;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === section);
  });

  const info = sectionInfo[section];
  document.getElementById("pageTitle").textContent = info.title;
  document.getElementById("crumbCurrent").textContent = info.title;

  const isCustomModule =
    section === "podnikani" ||
    section === "sklad" ||
    section === "finance" ||
    section === "projekty" ||
    section === "marketing";
  document.getElementById("view-prehled").classList.toggle("hidden", section !== "prehled");
  document.getElementById("view-podnikani").classList.toggle("hidden", section !== "podnikani");
  document.getElementById("view-sklad").classList.toggle("hidden", section !== "sklad");
  document.getElementById("view-finance").classList.toggle("hidden", section !== "finance");
  document.getElementById("view-projekty").classList.toggle("hidden", section !== "projekty");
  document.getElementById("view-marketing").classList.toggle("hidden", section !== "marketing");
  document.getElementById("view-detail").classList.toggle("hidden", section === "prehled" || isCustomModule);

  if (section !== "prehled" && !isCustomModule) {
    document.getElementById("detailHeading").textContent = info.title;
    document.getElementById("detailSubheading").textContent = info.desc;
  }

  closeMobileMenu();
  render();
}

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

document.getElementById("mainContent").addEventListener("click", (e) => {
  const jumpEl = e.target.closest("[data-jump]");
  if (jumpEl) {
    switchSection(jumpEl.dataset.jump);
    return;
  }

  const appBtn = e.target.closest("[data-app-action]");
  if (appBtn) {
    const id = Number(appBtn.dataset.id);
    approvals = approvals.filter((a) => a.id !== id);
    saveAll();
    return;
  }

  const cycleBtn = e.target.closest('button[data-action="cycle"]');
  if (cycleBtn) {
    const id = Number(cycleBtn.dataset.id);
    const order = ["urgent", "progress", "done"];
    items = items.map((item) => {
      if (item.id !== id) return item;
      return { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] };
    });
    saveAll();
  }
});

const modal = document.getElementById("newModal");

function openModalWithSection(defaultSec) {
  if (
    defaultSec &&
    defaultSec !== "prehled" &&
    defaultSec !== "podnikani" &&
    defaultSec !== "sklad" &&
    defaultSec !== "finance" &&
    defaultSec !== "projekty" &&
    defaultSec !== "marketing"
  ) {
    document.getElementById("itemSection").value = defaultSec;
  }
  modal.showModal();
}

document.getElementById("openNewModal").addEventListener("click", () => openModalWithSection(activeSection));
document.getElementById("detailAddBtn").addEventListener("click", () => openModalWithSection(activeSection));
document.getElementById("closeModal").addEventListener("click", () => modal.close());

document.getElementById("newItemForm").addEventListener("submit", (e) => {
  e.preventDefault();
  items.unshift({
    id: Date.now(),
    section: document.getElementById("itemSection").value,
    tag: document.getElementById("itemTag").value.trim(),
    title: document.getElementById("itemTitle").value.trim(),
    status: document.getElementById("itemStatus").value
  });
  e.target.reset();
  modal.close();
  saveAll();
});

const appModal = document.getElementById("approvalModal");
document.getElementById("openApprovalModal").addEventListener("click", () => appModal.showModal());
document.getElementById("closeApprovalModal").addEventListener("click", () => appModal.close());

document.getElementById("approvalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  approvals.unshift({
    id: Date.now(),
    division: document.getElementById("appDivision").value,
    title: document.getElementById("appTitle").value.trim(),
    time: "Právě teď"
  });
  e.target.reset();
  appModal.close();
  saveAll();
});

window.PortalApp = {
  onDataChanged: () => renderOverview(),
  addApproval: ({ division, title, time }) => {
    approvals.unshift({ id: Date.now(), division, title, time: time || "Právě teď" });
    saveAll();
  }
};

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
