import { supabase, isConfigured } from "./supabase.js";
import { escapeHtml } from "./renderer.js";

const grid = document.querySelector("#case-grid");
const empty = document.querySelector("#empty-state");
const count = document.querySelector("#result-count");
const terminalCount = document.querySelector("#terminal-count");
const search = document.querySelector("#mystery-search");

document.querySelector("#year").textContent = new Date().getFullYear();

let cases = [];

function formatCaseNumber(n) {
  return String(n ?? "").padStart(3, "0");
}

function difficultyClass(value) {
  return String(value || "medium").toLowerCase();
}

function renderCases(items) {
  grid.innerHTML = items.map((item) => `
    <a class="case-card reveal" href="./case.html?case=${encodeURIComponent(item.slug)}">
      <div class="case-card-media">
        ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : `<div class="case-placeholder"><span>?</span></div>`}
        <span class="difficulty difficulty-${difficultyClass(item.difficulty)}">${escapeHtml(item.difficulty || "medium")}</span>
        <span class="case-id">#${escapeHtml(formatCaseNumber(item.case_number))}</span>
      </div>
      <div class="case-card-body">
        <p class="eyebrow">INVESTIGATION</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-cta">Open case <span>→</span></p>
      </div>
    </a>
  `).join("");

  count.textContent = `${items.length} ${items.length === 1 ? "case" : "cases"}`;
  empty.classList.toggle("hidden", items.length > 0);
}

function filterCases(term) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return cases;
  return cases.filter((item) => {
    const number = String(item.case_number ?? "").padStart(3, "0");
    return [number, String(item.case_number ?? ""), item.title, item.slug].some((v) => String(v || "").toLowerCase().includes(normalized));
  });
}

async function loadCases() {
  if (!isConfigured()) {
    count.textContent = "Setup required";
    grid.innerHTML = `<div class="setup-card"><strong>Supabase is not configured.</strong><p>Copy your project URL and anon key into <code>config.js</code>.</p></div>`;
    terminalCount.textContent = "0";
    return;
  }

  const { data, error } = await supabase
    .from("cases")
    .select("id,case_number,title,slug,difficulty,status,image_url,updated_at")
    .eq("status", "published")
    .order("case_number", { ascending: true });

  if (error) {
    count.textContent = "Unavailable";
    grid.innerHTML = `<div class="setup-card"><strong>Could not load the archive.</strong><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  cases = data || [];
  terminalCount.textContent = String(cases.length);
  renderCases(cases);
}

search.addEventListener("input", () => renderCases(filterCases(search.value)));

const initialSearch = new URLSearchParams(location.search).get("search") || "";
search.value = initialSearch;
loadCases().then(() => {
  if (initialSearch) renderCases(filterCases(initialSearch));
});
