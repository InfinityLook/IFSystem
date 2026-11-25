const sectionInfo = {
  prehled: { title: "Přehled", desc: "Ředitelský přehled výkonnosti a divizí" },
  podnikani: { title: "Podnikání", desc: "Řízení divizí: Rozvoz jídla, E-shop, PWA Google Play a další činnosti" },
  sklad: { title: "Sklad", desc: "Zásoby, suroviny, obaly a logistika" },
  finance: { title: "Finance", desc: "Výnosy, náklady, uzávěrky a schvalování rozpočtů" },
  projekty: { title: "Projekty", desc: "Strategické iniciativy a rozvojové projekty" },
  marketing: { title: "Marketing", desc: "Akvizice zákazníků, kampaně a prezentace značek" },
  lide: { title: "Lidé", desc: "Organizační struktura, role, směny a kurýři" },
  kartoteka: { title: "Kartotéka", desc: "Evidence dodavatelů, partnerů a smluvních vztahů" },
  nastaveni: { title: "Nastavení", desc: "Systémová konfigurace, oprávnění a integrace" }
};

// Datum v horní liště
document.getElementById("todayDate").textContent = new Date().toLocaleDateString("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Tmavý / světlý režim
const root = document.documentElement;
const savedTheme = localStorage.getItem("il_theme") || "dark";
root.setAttribute("data-theme", savedTheme);

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("il_theme", next);
});

// Mobilní boční menu
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

// Data divizí pro Divizní matici
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

// Položky ke schválení vedením
const defaultApprovals = [
  { id: 101, division: "Rozvoz jídla", title: "Doplnění obalového materiálu (6 400 Kč)", time: "Dnes" },
  { id: 102, division: "PWA Google Play", title: "Vydání nové produkční verze aplikace", time: "Dnes" },
  { id: 103, division: "E-shop", title: "Úprava smluvních podmínek dopravce", time: "Včera" }
];

// Záznamy pro ostatní sekce menu
const defaultItems = [
  { id: 1, section: "podnikani", tag: "Rozvoz jídla", title: "Denní provozní přehled směn a kurýrů", status: "progress" },
  { id: 2, section: "sklad", tag: "Zásoby", title: "Kontrola minimálních stavů obalů a surovin", status: "urgent" },
  { id: 3, section: "finance", tag: "Reporting", title: "Měsíční konsolidace tržeb po divizích", status: "progress" },
  { id: 4, section: "projekty", tag: "Infrastruktura", title: "Napojení interního portálu na centrální databázi", status: "progress" }
];

let approvals = JSON.parse(localStorage.getItem("il_exec_approvals")) || defaultApprovals;
let items = JSON.parse(localStorage.getItem("il_ops_items")) || defaultItems;
let activeSection = "prehled";

function saveAll() {
  localStorage.setItem("il_exec_approvals", JSON.stringify(approvals));
  localStorage.setItem("il_ops_items", JSON.stringify(items));
  render();
}

function renderOverview() {
  // Počet položek ke schválení v KPI
  const pendingCount = approvals.length;
  document.getElementById("kpiPending").textContent = pendingCount;
  document.getElementById("kpiPendingBadge").textContent =
    pendingCount === 1 ? "1 položka" : `${pendingCount} položek`;

  // Divizní matice
  const tbody = document.getElementById("divisionsTableBody");
  tbody.innerHTML = divisionsData.map((d) => `
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
  `).join("");

  // Ke schválení vedením
  const appList = document.getElementById("approvalsList");
  if (!approvals.length) {
    appList.innerHTML = `<div class="approval-item"><span class="muted">Žádné otevřené položky ke schválení.</span></div>`;
    return;
  }

  appList.innerHTML = approvals.map((a) => `
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
  `).join("");
}

function renderDetail() {
  const detailList = document.getElementById("detailList");
  const secItems = items.filter((i) => i.section === activeSection);

  if (!secItems.length) {
    detailList.innerHTML = `<div class="task-row"><span class="muted">V sekci ${sectionInfo[activeSection].title} zatím nejsou žádné záznamy.</span></div>`;
    return;
  }

  detailList.innerHTML = secItems.map((item) => {
    const tagText = item.tag ? ` • ${item.tag}` : "";
    const btnText = item.status === "urgent" ? "Převzít" : item.status === "progress" ? "Uzavřít" : "Uzavřeno ✓";
    return `
      <div class="task-row">
        <div>
          <div><span class="status-dot st-${item.status}"></span><strong>${item.title}</strong></div>
          <div class="muted">${sectionInfo[item.section].title}${tagText}</div>
        </div>
        <button data-action="cycle" data-id="${item.id}">${btnText}</button>
      </div>
    `;
  }).join("");
}

function render() {
  renderOverview();
  if (activeSection !== "prehled") {
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

  const isOverview = section === "prehled";
  document.getElementById("view-prehled").classList.toggle("hidden", !isOverview);
  document.getElementById("view-detail").classList.toggle("hidden", isOverview);

  if (!isOverview) {
    document.getElementById("detailHeading").textContent = info.title;
    document.getElementById("detailSubheading").textContent = info.desc;
  }

  closeMobileMenu();
  render();
}

// Navigace v menu
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

// Prokliky z Přehledu do divizí
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

// Modal: Nový záznam
const modal = document.getElementById("newModal");

function openModalWithSection(defaultSec) {
  if (defaultSec && defaultSec !== "prehled") {
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

// Modal: Nový bod ke schválení
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

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  }
