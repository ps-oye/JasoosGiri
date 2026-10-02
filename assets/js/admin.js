import { supabase, isConfigured } from "./supabase.js";
import { CURRENT_SCHEMA_VERSION, parseAndValidateCaseJson } from "./data-contract.js";
import { escapeHtml, renderSections } from "./renderer.js";

const authView = document.querySelector("#auth-view");
const adminView = document.querySelector("#admin-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const logoutBtn = document.querySelector("#logout-btn");
const emailText = document.querySelector("#admin-user-email");
const jsonInput = document.querySelector("#case-json");
const jsonState = document.querySelector("#json-state");
const jsonErrors = document.querySelector("#json-errors");
const preview = document.querySelector("#admin-preview");
const saveMessage = document.querySelector("#save-message");
const imageInput = document.querySelector("#case-image");
const imagePreview = document.querySelector("#image-preview");

const templateText = `{
  "schemaVersion": 1,
  "sections": [
    {
      "key": "case_brief",
      "name": "The Case",
      "description": "Write a compelling summary of the mystery.",
      "type": "text"
    },
    {
      "key": "crime_scene",
      "name": "The Crime Scene",
      "description": [
        "Observation one.",
        "Observation two.",
        "Observation three."
      ],
      "type": "bullets"
    },
    {
      "key": "evidence",
      "name": "Evidence",
      "description": {
        "CCTV": "What the camera captured.",
        "Footprint": "A relevant physical clue."
      },
      "type": "evidence"
    },
    {
      "key": "mission",
      "name": "Your Mission",
      "description": "State what the detective must figure out.",
      "type": "mission"
    }
  ],
  "guessOptions": [
    { "id": "suspect-a", "name": "Suspect A" },
    { "id": "suspect-b", "name": "Suspect B" },
    { "id": "suspect-c", "name": "Suspect C" },
    { "id": "suspect-d", "name": "Suspect D" }
  ]
}`;

function $(id) { return document.getElementById(id); }

function showAdmin() {
  authView.classList.add("hidden");
  adminView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
}

function showAuth() {
  authView.classList.remove("hidden");
  adminView.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function setJsonState(result) {
  jsonState.textContent = result.valid ? `valid • v${CURRENT_SCHEMA_VERSION}` : "invalid";
  jsonState.className = `json-state ${result.valid ? "valid" : "invalid"}`;
  jsonErrors.classList.toggle("hidden", result.valid);
  jsonErrors.textContent = result.valid ? "" : result.errors.join("\n");
}

function validateCurrentJson() {
  const result = parseAndValidateCaseJson(jsonInput.value.trim());
  setJsonState(result);
  return result;
}

function previewCurrentJson() {
  const result = validateCurrentJson();
  if (!result.valid) return;
  const imageUrl = imagePreview.dataset.url || "";
  // Rebuild preview so image is included.
  preview.innerHTML = `${imageUrl ? `<div class="case-hero-image"><img src="${escapeHtml(imageUrl)}" alt="Preview image"></div>` : ""}<div class="case-title-block"><div class="case-number">CASE #${escapeHtml(String($("case-number").value || "—").padStart(3, "0"))}</div><h1>${escapeHtml($("case-title").value || "Untitled case")}</h1><div class="case-meta-line"><span>${escapeHtml($("case-difficulty").value.toUpperCase())}</span><span>•</span><span>${escapeHtml($("case-status-select").value.toUpperCase())}</span></div></div><div id="preview-sections" class="investigation-sections"></div>`;
  renderSections(result.value, preview.querySelector("#preview-sections"), { compact: true });
}

function resetForm() {
  $("edit-id").value = "";
  $("existing-image-path").value = "";
  $("case-number").value = "";
  $("case-title").value = "";
  $("case-slug").value = "";
  $("case-difficulty").value = "medium";
  $("case-status-select").value = "draft";
  $("youtube-url").value = "";
  jsonInput.value = templateText;
  imageInput.value = "";
  imagePreview.innerHTML = "";
  imagePreview.dataset.url = "";
  imagePreview.classList.add("hidden");
  setJsonState(parseAndValidateCaseJson(jsonInput.value));
  previewCurrentJson();
  saveMessage.textContent = "New case form ready.";
}

async function requireAdminUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role;
  if (role !== "admin") {
    await supabase.auth.signOut();
    loginMessage.textContent = "This account is authenticated but is not assigned the admin role in app_metadata.";
    return null;
  }
  return user;
}

async function login(event) {
  event.preventDefault();
  loginMessage.textContent = "Authenticating…";
  const { error } = await supabase.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-password").value
  });
  if (error) {
    loginMessage.textContent = error.message;
    return;
  }
  const user = await requireAdminUser();
  if (user) enterAdmin(user);
}

function enterAdmin(user) {
  showAdmin();
  emailText.textContent = user.email || "—";
  loadAdminCases();
  if (!jsonInput.value.trim()) resetForm();
}

async function compressImage(file) {
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve, reject) => canvas.toBlob(resolve, "image/webp", 0.78));
}

async function uploadCaseImage(file, slug) {
  const blob = await compressImage(file);
  if (!blob) return null;
  const safe = slugify(slug) || `case-${Date.now()}`;
  const path = `cases/${safe}-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("case-images").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from("case-images").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function deleteStoragePath(path) {
  if (!path) return;
  await supabase.storage.from("case-images").remove([path]);
}

async function saveCase() {
  saveMessage.textContent = "Validating…";
  const jsonResult = validateCurrentJson();
  if (!jsonResult.valid) {
    saveMessage.textContent = "Fix the JSON validation errors first.";
    return;
  }

  const caseNumber = Number($("case-number").value);
  const title = $("case-title").value.trim();
  const slug = slugify($("case-slug").value.trim() || title);
  if (!Number.isInteger(caseNumber) || caseNumber < 1 || !title || !slug) {
    saveMessage.textContent = "Case number, title and slug are required.";
    return;
  }

  saveMessage.textContent = "Saving…";
  let imagePath = $("existing-image-path").value || null;
  let imageUrl = imagePreview.dataset.url || $("image-preview").dataset.url || null;

  try {
    if (imageInput.files[0]) {
      const upload = await uploadCaseImage(imageInput.files[0], slug);
      if (upload) {
        const oldPath = imagePath;
        imagePath = upload.path;
        imageUrl = upload.publicUrl;
        if (oldPath) await deleteStoragePath(oldPath);
      }
    }

    const payload = {
      case_number: caseNumber,
      title,
      slug,
      difficulty: $("case-difficulty").value,
      status: $("case-status-select").value,
      image_path: imagePath,
      image_url: imageUrl,
      youtube_url: $("youtube-url").value.trim() || null,
      schema_version: jsonResult.value.schemaVersion,
      case_data: jsonResult.value
    };

    const editId = $("edit-id").value;
    const query = editId
      ? supabase.from("cases").update(payload).eq("id", editId).select("id").single()
      : supabase.from("cases").insert(payload).select("id").single();

    const { error } = await query;
    if (error) throw error;
    saveMessage.textContent = editId ? "Case updated successfully." : "Case created successfully.";
    await loadAdminCases();
  } catch (error) {
    saveMessage.textContent = `Save failed: ${error.message}`;
  }
}

async function loadAdminCases() {
  const list = $("admin-case-list");
  list.innerHTML = `<div class="muted">Loading cases…</div>`;
  const { data, error } = await supabase.from("cases").select("id,case_number,title,slug,difficulty,status,image_url,youtube_url,schema_version,case_data,image_path,updated_at").order("case_number", { ascending: false });
  if (error) {
    list.innerHTML = `<div class="setup-card"><strong>Unable to load cases.</strong><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }
  list.innerHTML = (data || []).map((item) => `
    <div class="admin-case-row">
      <div>
        <span class="case-id">#${escapeHtml(String(item.case_number).padStart(3, "0"))}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.status)} · schema v${escapeHtml(item.schema_version ?? "?")}</small>
      </div>
      <button class="ghost-btn small" type="button" data-edit-id="${escapeHtml(item.id)}">Edit</button>
    </div>
  `).join("") || `<div class="muted">No cases yet.</div>`;
  list.querySelectorAll("[data-edit-id]").forEach((button) => button.addEventListener("click", () => {
    const found = data.find((item) => item.id === button.dataset.editId);
    if (found) loadCaseIntoForm(found);
  }));
}

function loadCaseIntoForm(row) {
  $("edit-id").value = row.id;
  $("existing-image-path").value = row.image_path || "";
  $("case-number").value = row.case_number;
  $("case-title").value = row.title;
  $("case-slug").value = row.slug;
  $("case-difficulty").value = row.difficulty || "medium";
  $("case-status-select").value = row.status || "draft";
  $("youtube-url").value = row.youtube_url || "";
  jsonInput.value = JSON.stringify(row.case_data, null, 2);
  imageInput.value = "";
  imagePreview.dataset.url = row.image_url || "";
  imagePreview.innerHTML = row.image_url ? `<img src="${escapeHtml(row.image_url)}" alt="Current case image"><span>Current image</span>` : "";
  imagePreview.classList.toggle("hidden", !row.image_url);
  setJsonState(parseAndValidateCaseJson(jsonInput.value));
  previewCurrentJson();
  saveMessage.textContent = `Editing Case #${String(row.case_number).padStart(3, "0")}.`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  imagePreview.dataset.url = url;
  imagePreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Selected case image"><span>New image — will be compressed on save</span>`;
  imagePreview.classList.remove("hidden");
  previewCurrentJson();
});

$("case-title").addEventListener("input", () => {
  if (!$("edit-id").value) $("case-slug").value = slugify($("case-title").value);
});
jsonInput.addEventListener("input", () => validateCurrentJson());
$("validate-btn").addEventListener("click", validateCurrentJson);
$("preview-btn").addEventListener("click", previewCurrentJson);
$("template-btn").addEventListener("click", () => { jsonInput.value = templateText; validateCurrentJson(); previewCurrentJson(); });
$("save-btn").addEventListener("click", saveCase);
$("new-case-btn").addEventListener("click", resetForm);
loginForm.addEventListener("submit", login);
logoutBtn.addEventListener("click", async () => { await supabase.auth.signOut(); showAuth(); });

async function boot() {
  if (!isConfigured()) {
    loginMessage.textContent = "Supabase is not configured. Update config.js first.";
    return;
  }
  const user = await requireAdminUser();
  if (user) enterAdmin(user);
}

boot();
