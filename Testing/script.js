const STORAGE_KEY = "findit-posts";

const elements = {
  form: document.querySelector("#postForm"),
  postId: document.querySelector("#postId"),
  type: document.querySelector("#type"),
  item: document.querySelector("#item"),
  description: document.querySelector("#description"),
  location: document.querySelector("#location"),
  date: document.querySelector("#date"),
  contact: document.querySelector("#contact"),
  submitText: document.querySelector("#submitText"),
  cancelEdit: document.querySelector("#cancelEdit"),
  formTitle: document.querySelector("#formTitle"),
  search: document.querySelector("#search"),
  typeFilter: document.querySelector("#typeFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sort: document.querySelector("#sort"),
  postList: document.querySelector("#postList"),
  resultCount: document.querySelector("#resultCount"),
  openCount: document.querySelector("#openCount"),
  totalCount: document.querySelector("#totalCount"),
  openLostCount: document.querySelector("#openLostCount"),
  openFoundCount: document.querySelector("#openFoundCount"),
  resolvedCount: document.querySelector("#resolvedCount"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogTitle: document.querySelector("#deleteDialogTitle"),
  deleteDialogQuestion: document.querySelector("#deleteDialogQuestion"),
  deleteDialogMessage: document.querySelector("#deleteDialogMessage"),
  cancelDelete: document.querySelector("#cancelDelete"),
  confirmDelete: document.querySelector("#confirmDelete"),
  feedback: document.querySelector("#feedback")
};

let posts = loadPosts();
let pendingDeleteId = "";
let pendingPublish = false;

function loadPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    showFeedback("Saved posts could not be loaded.", true);
    return [];
  }
}

function savePosts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch (error) {
    showFeedback("Your browser could not save this post.", true);
  }
}

function showFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback show${isError ? " error" : ""}`;
  window.clearTimeout(showFeedback.timeout);
  showFeedback.timeout = window.setTimeout(() => {
    elements.feedback.className = "feedback";
  }, 3500);
}

function resetForm() {
  elements.form.reset();
  elements.postId.value = "";
  elements.type.value = "Lost";
  elements.submitText.textContent = "Publish This Post";
  elements.formTitle.textContent = "Create a post";
  elements.cancelEdit.classList.add("hidden");
}

function validateForm() {
  const fields = [elements.item, elements.description, elements.location, elements.date, elements.contact];
  const invalid = fields.find((field) => !field.value.trim());
  if (invalid) {
    invalid.focus();
    showFeedback("Please complete every field before publishing.", true);
    return false;
  }
  const normalizedContact = normalizeContact(elements.contact.value);
  const isDuplicateContact = posts.some((post) =>
    post.id !== elements.postId.value && normalizeContact(post.contact) === normalizedContact
  );
  if (isDuplicateContact) {
    elements.contact.focus();
    showFeedback("This contact information is already used by another post.", true);
    return false;
  }
  const selectedDate = new Date(`${elements.date.value}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    elements.date.focus();
    showFeedback("Please enter a valid date.", true);
    return false;
  }
  return true;
}

function normalizeContact(value) {
  const trimmedValue = value.trim().toLowerCase();
  const digitsOnly = trimmedValue.replace(/\D/g, "");
  return digitsOnly.length >= 7 ? digitsOnly : trimmedValue.replace(/\s+/g, "");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${dateString}T00:00:00`));
}

function renderPosts() {
  const query = elements.search.value.trim().toLowerCase();
  const type = elements.typeFilter.value;
  const status = elements.statusFilter.value;
  const sortDirection = elements.sort.value === "newest" ? -1 : 1;
  const visiblePosts = posts
    .filter((post) => {
      const matchesQuery = !query || `${post.item} ${post.location}`.toLowerCase().includes(query);
      return matchesQuery && (type === "All" || post.type === type) && (status === "All" || post.status === status);
    })
    .sort((a, b) => (new Date(a.date) - new Date(b.date)) * sortDirection);

  elements.resultCount.textContent = visiblePosts.length;
  elements.openCount.textContent = posts.filter((post) => post.status === "Open").length;
  elements.totalCount.textContent = posts.length;
  elements.openLostCount.textContent = posts.filter((post) => post.status === "Open" && post.type === "Lost").length;
  elements.openFoundCount.textContent = posts.filter((post) => post.status === "Open" && post.type === "Found").length;
  elements.resolvedCount.textContent = posts.filter((post) => post.status === "Resolved").length;
  elements.postList.innerHTML = visiblePosts.length ? visiblePosts.map(postTemplate).join("") : `
    <div class="empty-state"><strong>No posts found</strong>Try changing your search or filters, or publish a new report.</div>`;
}

function postTemplate(post) {
  return `
    <article class="post-card ${post.status === "Resolved" ? "resolved" : ""}">
      <div class="post-top">
        <span class="tag ${post.type.toLowerCase()}">${post.type.toUpperCase()}</span>
        <span class="post-status">${post.status.toUpperCase()}</span>
      </div>
      <h3>${escapeHtml(post.item)}</h3>
      <p>${escapeHtml(post.description)}</p>
      <div class="post-meta">
        <div><span class="post-meta-label">Location:</span> ${escapeHtml(post.location)}</div>
        <div><span class="post-meta-label">Date:</span> ${formatDate(post.date)}</div>
        <div><span class="post-meta-label">Contact:</span> ${escapeHtml(post.contact)}</div>
      </div>
      <div class="post-actions">
        ${post.status === "Open" ? `<button class="text-button" data-action="resolve" data-id="${post.id}">Mark resolved</button>` : ""}
        <button class="text-button" data-action="edit" data-id="${post.id}">Edit</button>
        <button class="text-button delete" data-action="delete" data-id="${post.id}">Delete</button>
      </div>
    </article>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm()) return;
  if (!elements.postId.value) {
    openPublishDialog();
    return;
  }
  saveFormPost();
});

function saveFormPost() {
  const postData = {
    type: elements.type.value,
    item: elements.item.value.trim(),
    description: elements.description.value.trim(),
    location: elements.location.value.trim(),
    date: elements.date.value,
    contact: elements.contact.value.trim()
  };
  if (elements.postId.value) {
    const post = posts.find((entry) => entry.id === elements.postId.value);
    Object.assign(post, postData);
    showFeedback("Your post was updated.");
  } else {
    posts.push({ ...postData, id: crypto.randomUUID(), status: "Open" });
    showFeedback("Your post is now live on the board.");
  }
  savePosts();
  resetForm();
  renderPosts();
}

elements.cancelEdit.addEventListener("click", resetForm);
function closeDeleteDialog() {
  pendingDeleteId = "";
  pendingPublish = false;
  elements.deleteDialog.classList.add("hidden");
}

function openDeleteDialog(post) {
  pendingDeleteId = post.id;
  pendingPublish = false;
  elements.deleteDialogTitle.textContent = "Delete confirmation";
  elements.deleteDialogQuestion.textContent = "Delete this post?";
  elements.deleteDialogMessage.textContent = "This action cannot be undone.";
  elements.confirmDelete.textContent = "Delete";
  elements.deleteDialog.classList.remove("hidden");
  elements.cancelDelete.focus();
}

function openPublishDialog() {
  pendingPublish = true;
  pendingDeleteId = "";
  elements.deleteDialogTitle.textContent = "Publish confirmation";
  elements.deleteDialogQuestion.textContent = "";
  elements.deleteDialogMessage.textContent = "Are you sure you want to publish this post?";
  elements.confirmDelete.textContent = "Publish";
  elements.deleteDialog.classList.remove("hidden");
  elements.cancelDelete.focus();
}

elements.cancelDelete.addEventListener("click", closeDeleteDialog);
elements.confirmDelete.addEventListener("click", () => {
  if (pendingPublish) {
    closeDeleteDialog();
    saveFormPost();
    return;
  }
  if (!pendingDeleteId) return;
  posts = posts.filter((entry) => entry.id !== pendingDeleteId);
  savePosts();
  closeDeleteDialog();
  showFeedback("The post was deleted.");
  renderPosts();
});
elements.deleteDialog.addEventListener("click", (event) => {
  if (event.target === elements.deleteDialog) closeDeleteDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.deleteDialog.classList.contains("hidden")) {
    closeDeleteDialog();
  }
});
[elements.search, elements.typeFilter, elements.statusFilter, elements.sort].forEach((control) => {
  control.addEventListener("input", renderPosts);
  control.addEventListener("change", renderPosts);
});

elements.postList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const post = posts.find((entry) => entry.id === button.dataset.id);
  if (!post) return;
  if (button.dataset.action === "delete") {
    openDeleteDialog(post);
  } else if (button.dataset.action === "resolve") {
    post.status = "Resolved";
    savePosts();
    showFeedback("Great! This post has been marked as resolved.");
  } else if (button.dataset.action === "edit") {
    elements.postId.value = post.id;
    elements.type.value = post.type;
    elements.item.value = post.item;
    elements.description.value = post.description;
    elements.location.value = post.location;
    elements.date.value = post.date;
    elements.contact.value = post.contact;
    elements.submitText.textContent = "Save changes";
    elements.formTitle.textContent = "Edit your post";
    elements.cancelEdit.classList.remove("hidden");
    elements.item.focus();
  }
  renderPosts();
});

renderPosts();
