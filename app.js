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
  feedback: document.querySelector("#feedback")
};

let posts = loadPosts();

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
  elements.submitText.textContent = "Publish post";
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
  const selectedDate = new Date(`${elements.date.value}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    elements.date.focus();
    showFeedback("Please enter a valid date.", true);
    return false;
  }
  return true;
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
  elements.postList.innerHTML = visiblePosts.length ? visiblePosts.map(postTemplate).join("") : `
    <div class="empty-state"><strong>No posts found</strong>Try changing your search or filters, or publish a new report.</div>`;
}

function postTemplate(post) {
  return `
    <article class="post-card ${post.status === "Resolved" ? "resolved" : ""}">
      <div class="post-top">
        <span class="tag ${post.type.toLowerCase()}">${post.type.toUpperCase()}</span>
        <span class="post-date">${formatDate(post.date)}${post.status === "Resolved" ? " · Resolved" : ""}</span>
      </div>
      <h3>${escapeHtml(post.item)}</h3>
      <p>${escapeHtml(post.description)}</p>
      <div class="post-meta">
        <span class="location">${escapeHtml(post.location)}</span>
        <span class="contact">${escapeHtml(post.contact)}</span>
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
});

elements.cancelEdit.addEventListener("click", resetForm);
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
    if (!window.confirm(`Delete the post for "${post.item}"?`)) return;
    posts = posts.filter((entry) => entry.id !== post.id);
    savePosts();
    showFeedback("The post was deleted.");
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
