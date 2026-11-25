// Datum v hlavičce
document.getElementById("todayDate").textContent = new Date().toLocaleDateString("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Přepínání tmavého / světlého režimu
const root = document.documentElement;
const savedTheme = localStorage.getItem("il_theme") || "dark";
root.setAttribute("data-theme", savedTheme);

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("il_theme", next);
});

// Ukázková lokální data (později napojíme na databázi)
const defaultItems = [
  { id: 1, module: "rozvoz", title: "Objednávka #104 – Dvořákova 12 (hotově 340 Kč)", status: "urgent" },
  { id: 2, module: "eshop", title: "Balík #58 – Zásilkovna k odeslání", status: "progress" },
  { id: 3, module: "play", title: "Kontrola nové verze PWA na Google Play", status: "progress" },
  { id: 4, module: "ostatni", title: "Podklady pro fakturaci – tento týden", status: "urgent" }
];

let items = JSON.parse(localStorage.getItem("il_items")) || defaultItems;
let currentFilter = "all";

const moduleLabels = {
  rozvoz: "Rozvoz jídla",
  eshop: "E-shop",
  play: "PWA Google Play",
  ostatni: "Další podnikání"
};

function saveAndRender() {
  localStorage.setItem("il_items", JSON.stringify(items));
  render();
}

function render() {
  const list = document.getElementById("itemsList");
  const filtered = currentFilter === "all"
    ? items
    : items.filter((i) => i.module === currentFilter);

  document.getElementById("kpiDelivery").textContent =
    items.filter((i) => i.module === "rozvoz" && i.status !== "done").length + " aktivních";
  document.getElementById("kpiEshop").textContent =
    items.filter((i) => (i.module === "eshop" || i.module === "play") && i.status !== "done").length + " aktivních";
  document.getElementById("kpiOther").textContent =
    items.filter((i) => i.module === "ostatni" && i.status !== "done").length + " úkolů";

  if (!filtered.length) {
    list.innerHTML = `<div class="task-row"><span class="task-meta">Žádné záznamy v této kategorii.</span></div>`;
    return;
  }

  list.innerHTML = filtered.map((item) => `
    <div class="task-row">
      <div>
        <div><span class="status-dot st-${item.status}"></span><strong>${item.title}</strong></div>
        <div class="task-meta">${moduleLabels[item.module]}</div>
      </div>
      <button data-action="cycle" data-id="${item.id}">
        ${item.status === "urgent" ? "Převzít" : item.status === "progress" ? "Dokončit" : "Hotovo ✓"}
      </button>
    </div>
  `).join("");
}

document.getElementById("itemsList").addEventListener("click", (e) => {
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

// Filtry
document.querySelectorAll(".filter-btn, .module-card").forEach((el) => {
  el.addEventListener("click", () => {
    currentFilter = el.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === currentFilter)
    );
    render();
  });
});

// Modal
const modal = document.getElementById("newModal");
document.getElementById("openNewModal").addEventListener("click", () => modal.showModal());
document.getElementById("closeModal").addEventListener("click", () => modal.close());

document.getElementById("newItemForm").addEventListener("submit", (e) => {
  e.preventDefault();
  items.unshift({
    id: Date.now(),
    module: document.getElementById("itemModule").value,
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
