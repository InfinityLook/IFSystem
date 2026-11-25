const sectionInfo = {
  prehled: { title: "Přehled", desc: "Hlavní velitelský přehled všech činností" },
  podnikani: { title: "Podnikání", desc: "Rozvoz jídla, e-shop, PWA Google Play a další živnosti" },
  sklad: { title: "Sklad", desc: "Zásoby, suroviny, obaly a expedice zboží" },
  finance: { title: "Finance", desc: "Tržby, denní uzávěrky, faktury a náklady" },
  projekty: { title: "Projekty", desc: "Rozvojové úkoly, nové funkce a interní plány" },
  marketing: { title: "Marketing", desc: "Kampaně, sociální sítě, promo akce a Google Play" },
  lide: { title: "Lidé", desc: "Kurýři, směny, výpomoc a interní role" },
  kartoteka: { title: "Kartotéka", desc: "Dodavatelé, partneři, důležité kontakty a smlouvy" },
  nastaveni: { title: "Nastavení", desc: "Konfigurace systému, oprávnění a napojení" }
};

// Datum v horní liště
document.getElementById("todayDate").textContent = new Date().toLocaleDateString("cs-CZ", {
  weekday: "long",
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

// Ukázková data
const defaultItems = [
  { id: 1, section: "podnikani", tag: "Rozvoz jídla", title: "Objednávka #104 – Dvořákova 12 (hotově 340 Kč)", status: "urgent" },
  { id: 2, section: "podnikani", tag: "E-shop", title: "Balík #58 – Zásilkovna k odeslání", status: "progress" },
  { id: 3, section: "sklad", tag: "Obaly", title: "Doobjednat menuboxy a tašky pro rozvoz", status: "urgent" },
  { id: 4, section: "finance", tag: "Uzávěrka", title: "Kontrola denních tržeb a dokladů", status: "progress" },
  { id: 5, section: "projekty", tag: "PWA Google Play", title: "Příprava aktualizace aplikace", status: "progress" }
];

let items = JSON.parse(localStorage.getItem("il_ops_items")) || defaultItems;
let activeSection = "prehled";
let overviewFilter = "all";
let searchQuery = "";

function saveAndRender() {
  localStorage.setItem("il_ops_items", JSON.stringify(items));
  render();
}

function renderRow(item) {
  const secLabel = sectionInfo[item.section]?.title || item.section;
  const tagText = item.tag ? ` • ${item.tag}` : "";
  const btnText = item.status === "urgent" ? "Převzít" : item.status === "progress" ? "Dokončit" : "Hotovo ✓";

  return `
    <div class="task-row">
      <div>
        <div><span class="status-dot st-${item.status}"></span><strong>${item.title}</strong></div>
        <div class="task-meta">${secLabel}${tagText}</div>
      </div>
      <button data-action="cycle" data-id="${item.id}">${btnText}</button>
    </div>
  `;
}

function render() {
  // KPI karty
  document.getElementById("kpiOps").textContent =
    items.filter((i) => i.section === "podnikani" && i.status !== "done").length;
  document.getElementById("kpiStock").textContent =
    items.filter((i) => i.section === "sklad" && i.status !== "done").length;
  document.getElementById("kpiFinance").textContent =
    items.filter((i) => i.section === "finance" && i.status !== "done").length;
  document.getElementById("kpiProjects").textContent =
    items.filter((i) => i.section === "projekty" && i.status !== "done").length;

  // Vyhledávání
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.tag && item.tag.toLowerCase().includes(q));
  };

  // Přehled (hlavní stránka)
  const overviewList = document.getElementById("overviewList");
  const overviewItems = items.filter((i) => {
    const secOk = overviewFilter === "all" || i.section === overviewFilter;
    return secOk && matchesSearch(i);
  });

  overviewList.innerHTML = overviewItems.length
    ? overviewItems.map(renderRow).join("")
    : `<div class="task-row"><span class="task-meta">Žádné záznamy neodpovídají výběru.</span></div>`;

  // Detail sekce
  if (activeSection !== "prehled") {
    const detailList = document.getElementById("detailList");
    const secItems = items.filter((i) => i.section === activeSection && matchesSearch(i));
    detailList.innerHTML = secItems.length
      ? secItems.map(renderRow).join("")
      : `<div class="task-row"><span class="task-meta">V sekci ${sectionInfo[activeSection].title} zatím nejsou žádné záznamy.</span></div>`;
  }
}

function switchSection(section) {
  activeSection = section;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === section);
  });

  const info = sectionInfo[section];
  document.getElementById("pageTitle").textContent = info.title;

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

// Klikání na menu
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

// Proklik z karet pilířů na Přehledu
document.querySelectorAll(".pillar-card").forEach((card) => {
  card.addEventListener("click", () => switchSection(card.dataset.jump));
});

// Filtry na Přehledu
document.querySelectorAll("#overviewFilters .filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    overviewFilter = btn.dataset.filter;
    document.querySelectorAll("#overviewFilters .filter-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === overviewFilter)
    );
    render();
  });
});

// Vyhledávání
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  render();
});

// Změna stavu řádku
document.getElementById("mainContent").addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="cycle"]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const order = ["urgent", "progress", "done"];

  items = items.map((item) => {
    if (item.id !== id) return item;
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    return { ...item, status: next };
  });

  saveAndRender();
});

// Modal pro nový záznam
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
  saveAndRender();
});

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
      }
