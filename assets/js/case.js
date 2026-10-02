import { supabase, isConfigured } from "./supabase.js";
import { escapeHtml, renderSections } from "./renderer.js";

const content = document.querySelector("#case-content");
const errorBox = document.querySelector("#case-error");
const statusBanner = document.querySelector("#case-status");
const search = document.querySelector("#case-search");

function getSlug() {
  const params = new URLSearchParams(location.search);
  return params.get("case") || "";
}

function getYouTubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "").split("/")[0] || null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || null;
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || null;
    }
  } catch (_) {}
  return null;
}

function renderGuess(caseRow, caseData) {
  const raw = Array.isArray(caseData?.guessOptions) ? caseData.guessOptions : [];
  const options = raw.map((item, index) => typeof item === "string" ? ({ id: String(index + 1), name: item }) : ({ id: item.id || String(index + 1), name: item.name }));
  const storageKey = `mystery_guess_${caseRow.id}`;
  const saved = localStorage.getItem(storageKey);

  const wrapper = document.createElement("section");
  wrapper.className = "final-guess-panel";
  wrapper.innerHTML = `
    <div class="guess-head">
      <p class="eyebrow">POINT OF NO RETURN</p>
      <h2>Make your final guess</h2>
      <p>Choose carefully. Once submitted, your guess is locked on this device and the answer video is revealed.</p>
    </div>
    <form id="guess-form" class="guess-form">
      <div class="guess-options">
        ${options.length ? options.map((option) => `
          <label class="guess-option ${saved === String(option.id) ? "selected" : ""}">
            <input type="radio" name="guess" value="${escapeHtml(option.id)}" ${saved === String(option.id) ? "checked" : ""} ${saved ? "disabled" : ""}>
            <span>${escapeHtml(option.name)}</span>
          </label>
        `).join("") : `<p class="muted">Add <code>guessOptions</code> to the case JSON to enable the final guess.</p>`}
      </div>
      ${options.length ? `<button class="primary-btn" type="submit" ${saved ? "disabled" : ""}>${saved ? "GUESS LOCKED" : "LOCK FINAL GUESS"}</button>` : ""}
    </form>
    <div id="reveal" class="answer-reveal ${saved ? "visible" : ""}"></div>
  `;

  const reveal = wrapper.querySelector("#reveal");
  const renderReveal = () => {
    const videoId = getYouTubeId(caseRow.youtube_url);
    reveal.innerHTML = `
      <div class="lock-badge">🔒 CASE LOCKED</div>
      <p>Your final guess is recorded.</p>
      ${videoId ? `
        <a class="answer-video" href="${escapeHtml(caseRow.youtube_url)}" target="_blank" rel="noopener noreferrer">
          <img src="https://img.youtube.com/vi/${escapeHtml(videoId)}/hqdefault.jpg" alt="Answer video thumbnail" loading="lazy">
          <span class="video-overlay">▶ WATCH THE ANSWER</span>
        </a>
      ` : `<p class="muted">The answer video has not been attached to this case yet.</p>`}
    `;
  };

  if (saved) renderReveal();

  wrapper.querySelector("#guess-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = wrapper.querySelector("input[name='guess']:checked");
    if (!selected) return;
    localStorage.setItem(storageKey, selected.value);
    wrapper.querySelectorAll("input[name='guess']").forEach((input) => input.disabled = true);
    const button = wrapper.querySelector("button[type='submit']");
    if (button) { button.disabled = true; button.textContent = "GUESS LOCKED"; }
    wrapper.querySelectorAll(".guess-option").forEach((el) => el.classList.remove("selected"));
    selected.closest(".guess-option")?.classList.add("selected");
    reveal.classList.add("visible");
    renderReveal();
  });

  return wrapper;
}

async function loadCase() {
  const slug = getSlug();
  if (!slug) {
    showError("No case selected.", "Return to the archive and choose an investigation.");
    return;
  }

  if (!isConfigured()) {
    showError("Supabase is not configured.", "Add the project URL and anon key in config.js.");
    return;
  }

  const { data, error } = await supabase
    .from("cases")
    .select("id,case_number,title,slug,difficulty,status,image_url,case_data,youtube_url,updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    showError("Investigation unavailable.", error?.message || "This case does not exist or is not published.");
    return;
  }

  document.title = `Case #${String(data.case_number).padStart(3, "0")} — ${data.title} | Mystery Universe`;
  statusBanner.classList.remove("hidden");
  statusBanner.innerHTML = `CASE #${escapeHtml(String(data.case_number).padStart(3, "0"))} <span>•</span> ${escapeHtml(String(data.difficulty).toUpperCase())} <span>•</span> ACTIVE INVESTIGATION`;

  content.innerHTML = `
    <article class="case-article reveal">
      ${data.image_url ? `<div class="case-hero-image"><img src="${escapeHtml(data.image_url)}" alt="Crime scene for ${escapeHtml(data.title)}" fetchpriority="high"></div>` : ""}
      <header class="case-title-block">
        <div class="case-number">CASE #${escapeHtml(String(data.case_number).padStart(3, "0"))}</div>
        <h1>${escapeHtml(data.title)}</h1>
        <p class="case-subtitle">Investigation file // connect the details before you decide who is telling the truth.</p>
      </header>
      <div id="sections" class="investigation-sections"></div>
    </article>
  `;

  renderSections(data.case_data, content.querySelector("#sections"));
  content.appendChild(renderGuess(data, data.case_data));
}

function showError(title, description) {
  errorBox.classList.remove("hidden");
  errorBox.innerHTML = `<div class="empty-icon">!</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><a class="primary-btn inline-btn" href="./index.html">Back to archive</a>`;
}

search.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const term = search.value.trim().toLowerCase();
  if (term) location.href = `./index.html?search=${encodeURIComponent(term)}`;
});

loadCase();
