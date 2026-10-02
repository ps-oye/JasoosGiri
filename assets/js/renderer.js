export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderValue(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `<p class="content-paragraph">${escapeHtml(value)}</p>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `<p class="muted">No information available.</p>`;
    return `<ul class="content-list">${value.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`;
  }

  if (value && typeof value === "object") {
    return `<div class="content-object">${Object.entries(value).map(([key, item]) => `
      <div class="object-row"><span>${escapeHtml(key)}</span><div>${renderInline(item)}</div></div>
    `).join("")}</div>`;
  }

  return `<p class="muted">—</p>`;
}

function renderInline(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return escapeHtml(value);
  if (Array.isArray(value)) return value.map(renderInline).join(", ");
  if (value && typeof value === "object") return Object.entries(value).map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${renderInline(v)}`).join(" · ");
  return "—";
}

export function renderSections(caseJson, target, { compact = false } = {}) {
  target.innerHTML = "";
  const sections = Array.isArray(caseJson?.sections) ? caseJson.sections : [];

  sections.forEach((section, index) => {
    const article = document.createElement("article");
    article.className = `investigation-section section-type-${escapeHtml(section.type || "default")} ${compact ? "compact" : ""}`;
    article.style.animationDelay = `${Math.min(index * 45, 500)}ms`;
    article.innerHTML = `
      <div class="section-kicker">${String(index + 1).padStart(2, "0")}</div>
      <div class="section-body">
        <h3>${escapeHtml(section.name)}</h3>
        ${renderValue(section.description)}
      </div>
    `;
    target.appendChild(article);
  });

  if (!sections.length) {
    target.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><p>No sections found.</p></div>`;
  }
}

export function renderPreviewHeader(meta, target, imageUrl = "") {
  target.innerHTML = `
    ${imageUrl ? `<div class="case-hero-image"><img src="${escapeHtml(imageUrl)}" alt="Crime scene for ${escapeHtml(meta.title || "case")}" loading="lazy"></div>` : ""}
    <div class="case-title-block">
      <div class="case-number">CASE #${escapeHtml(String(meta.case_number ?? "—").padStart(3, "0"))}</div>
      <h1>${escapeHtml(meta.title || "Untitled case")}</h1>
      <div class="case-meta-line">
        <span>${escapeHtml(meta.difficulty || "medium").toUpperCase()}</span>
        <span>•</span>
        <span>${escapeHtml(meta.status || "draft").toUpperCase()}</span>
      </div>
    </div>
  `;
}
