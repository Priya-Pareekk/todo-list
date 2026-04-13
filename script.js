const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "http://localhost:5000/api";
const USER_CONTEXT_KEY = "pulsetasks-user-context";
const TOKEN_STORAGE_KEY = "token";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const USER_STORAGE_KEY = "user";

const screens = {
  login: document.getElementById("login-screen"),
  signup: document.getElementById("signup-screen"),
  dashboard: document.getElementById("dashboard-screen"),
  profile: document.getElementById("profile-screen")
};

const state = {
  user: {
    id: "",
    name: "Guest User",
    email: "",
    role: "user",
    token: "",
    refreshToken: ""
  },
  activeProfileId: "",
  activeProfile: null,
  tasks: [],
  filters: {
    search: "",
    priority: "all",
    status: "all",
    sortBy: "created"
  },
  editingId: null
};

const refs = {
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  signupForm: document.getElementById("signup-form"),
  signupName: document.getElementById("signup-name"),
  signupEmail: document.getElementById("signup-email"),
  signupPassword: document.getElementById("signup-password"),
  signupConfirmPassword: document.getElementById("signup-confirm-password"),
  welcomeName: document.getElementById("welcome-name"),
  profileName: document.getElementById("profile-name"),
  profileEmail: document.getElementById("profile-email"),
  roleTag: document.querySelector(".role-tag"),
  statTotal: document.getElementById("stat-total"),
  statActive: document.getElementById("stat-active"),
  statCompleted: document.getElementById("stat-completed"),
  statOverdue: document.getElementById("stat-overdue"),
  showFormBtn: document.getElementById("show-form"),
  taskFormWrap: document.getElementById("task-form-wrap"),
  taskForm: document.getElementById("task-form"),
  addLauncher: document.getElementById("add-launcher"),
  cancelAdd: document.getElementById("cancel-add"),
  taskList: document.getElementById("task-list"),
  emptyState: document.getElementById("empty-state"),
  taskTemplate: document.getElementById("task-template"),
  taskTitle: document.getElementById("task-title"),
  taskDescription: document.getElementById("task-description"),
  taskPriority: document.getElementById("task-priority"),
  taskDue: document.getElementById("task-due"),
  taskCategory: document.getElementById("task-category"),
  taskTags: document.getElementById("task-tags"),
  search: document.getElementById("search"),
  filterPriority: document.getElementById("filter-priority"),
  filterStatus: document.getElementById("filter-status"),
  sortBy: document.getElementById("sort-by")
};

refs.googleLoginBtn = document.querySelector("[data-action='google-login']");

refs.loginSubmitBtn = refs.loginForm.querySelector("button[type='submit']");
refs.taskSubmitBtn = refs.taskForm.querySelector("button[type='submit']");
refs.signupSubmitBtn = refs.signupForm.querySelector("button[type='submit']");

// Shows consistent success/error messages while keeping existing UI unchanged.
function notify(type, message) {
  if (type === "error") {
    alert(message);
    console.error(`[ui:${type}] ${message}`);
    return;
  }

  console.log(`[ui:${type}] ${message}`);
}

// Disables buttons and updates labels during async actions.
function setButtonLoading(button, loading, loadingLabel, idleLabel) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingLabel : idleLabel;
}

// Handles screen switch between login, dashboard, and profile sections.
function showScreen(name) {
  const protectedScreens = new Set(["dashboard", "profile"]);
  if (protectedScreens.has(name) && !state.user.token) {
    notify("error", "Please login to continue.");
    name = "login";
  }

  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

// Persists lightweight user context for easier relogin during local development.
function saveUserContext() {
  const context = {
    userId: state.user.id,
    email: state.user.email,
    name: state.user.name,
    role: state.user.role,
    token: state.user.token,
    refreshToken: state.user.refreshToken
  };
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));

  // Explicit keys for simpler debugging and compatibility.
  localStorage.setItem(TOKEN_STORAGE_KEY, state.user.token || "");
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, state.user.refreshToken || "");
  localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      userId: state.user.id,
      name: state.user.name,
      email: state.user.email,
      role: state.user.role
    })
  );
}

// Removes local user context on logout.
function clearUserContext() {
  localStorage.removeItem(USER_CONTEXT_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

// Reads user context from localStorage safely.
function loadUserContext() {
  try {
    const rawContext = localStorage.getItem(USER_CONTEXT_KEY);
    const token = localStorage.getItem(TOKEN_STORAGE_KEY) || "";
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "";
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);

    let parsedContext = null;
    if (rawContext) {
      parsedContext = JSON.parse(rawContext);
    }

    let parsedUser = null;
    if (rawUser) {
      parsedUser = JSON.parse(rawUser);
    }

    // Merge both storage formats for backward compatibility.
    if (!parsedContext && !token && !refreshToken && !parsedUser) {
      return null;
    }

    return {
      userId: parsedContext?.userId || parsedUser?.userId || "",
      email: parsedContext?.email || parsedUser?.email || "",
      name: parsedContext?.name || parsedUser?.name || "",
      role: parsedContext?.role || parsedUser?.role || "user",
      token: parsedContext?.token || token,
      refreshToken: parsedContext?.refreshToken || refreshToken
    };
  } catch (error) {
    return null;
  }
}

// Handles token redirect from Google OAuth callback.
function consumeOAuthTokensFromUrl() {
  const url = new URL(window.location.href);
  const oauth = url.searchParams.get("oauth");
  const token = url.searchParams.get("token");
  const refreshToken = url.searchParams.get("refreshToken");

  if (oauth !== "google" || !token || !refreshToken) {
    return false;
  }

  state.user.token = token;
  state.user.refreshToken = refreshToken;
  saveUserContext();

  url.searchParams.delete("oauth");
  url.searchParams.delete("token");
  url.searchParams.delete("refreshToken");
  window.history.replaceState({}, "", url.toString());
  return true;
}

// Shared fetch helper for backend communication.
async function apiRequest(path, options = {}, requireAuth = true, allowRefreshRetry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const currentToken = state.user.token || localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  if (requireAuth && currentToken) {
    headers.authorization = `Bearer ${currentToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(
      "Cannot reach backend API. Start backend with: npm --prefix \"c:/Users/Yoga/OneDrive/Desktop/LIST/backend\" run start"
    );
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Backend returned an invalid response. Please check server logs.");
  }

  if (!response.ok || !result.success) {
    if (response.status === 401 && requireAuth && allowRefreshRetry && state.user.refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiRequest(path, options, requireAuth, false);
      }
    }

    if (response.status === 401 || response.status === 403) {
      clearUserContext();
      state.user.id = "";
      state.user.email = "";
      state.user.name = "Guest User";
      state.user.role = "user";
      state.user.token = "";
      state.user.refreshToken = "";
      state.activeProfileId = "";
      state.activeProfile = null;
      state.tasks = [];
      renderStats();
      renderTasks();
      showScreen("login");

      const authMessage = response.status === 401
        ? "Session expired or invalid. Please login again."
        : "You are not allowed to access this resource.";
      throw new Error(result.message || authMessage);
    }

    throw new Error(result.message || "API request failed");
  }

  return result.data;
}

// Exchanges refresh token for a new access token when access token expires.
async function refreshAccessToken() {
  if (!state.user.refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken: state.user.refreshToken })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return false;
    }

    state.user.token = result.data.token;
    state.user.refreshToken = result.data.refreshToken;
    if (result.data.user) {
      state.user.id = result.data.user.userId;
      state.user.name = result.data.user.name;
      state.user.email = result.data.user.email;
      state.user.role = result.data.user.role;
    }
    saveUserContext();
    return true;
  } catch (error) {
    return false;
  }
}

// Applies backend user/profile values to the existing profile UI.
function applyUserData() {
  refs.welcomeName.textContent = state.user.name || "User";
  refs.profileName.textContent = state.user.name || "User";
  refs.profileEmail.textContent = state.user.email || "-";
  refs.roleTag.textContent = state.activeProfile?.role || state.user.role || "user";
}

function toDueLabel(dateStr) {
  if (!dateStr) return "No due date";
  return `Due: ${dateStr}`;
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "completed") return false;

  const due = new Date(task.dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function getVisibleTasks() {
  const { search, priority, status, sortBy } = state.filters;

  const filtered = state.tasks.filter((task) => {
    const matchesSearch =
      !search ||
      task.title.toLowerCase().includes(search) ||
      task.description.toLowerCase().includes(search) ||
      task.category.toLowerCase().includes(search);

    const matchesPriority = priority === "all" || task.priority === priority;

    const taskStatus = task.status === "completed" ? "completed" : isOverdue(task) ? "overdue" : "active";
    const matchesStatus = status === "all" || taskStatus === status;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortBy === "due") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }

    if (sortBy === "priority") {
      const map = { high: 0, medium: 1, low: 2 };
      return map[a.priority] - map[b.priority];
    }

    return b.createdAt - a.createdAt;
  });

  return filtered;
}

function renderStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.status === "completed").length;
  const overdue = state.tasks.filter((task) => isOverdue(task)).length;
  const active = total - completed;

  refs.statTotal.textContent = String(total);
  refs.statActive.textContent = String(active);
  refs.statCompleted.textContent = String(completed);
  refs.statOverdue.textContent = String(overdue);
}

function mapTaskFromApi(task) {
  return {
    id: task._id,
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    status: task.status || "active",
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    category: task.category || "",
    tags: Array.isArray(task.tags) ? task.tags : [],
    createdAt: new Date(task.createdAt).getTime()
  };
}

// Pulls tasks for the active profile and refreshes dashboard widgets.
async function loadTasksForActiveProfile() {
  if (!state.activeProfileId) {
    state.tasks = [];
    renderStats();
    renderTasks();
    return;
  }

  const tasks = await apiRequest(`/tasks/profile/${state.activeProfileId}`);
  state.tasks = tasks.map(mapTaskFromApi);
  renderStats();
  renderTasks();
}

// Fetches one profile's latest backend data to populate profile section.
async function loadActiveProfileDetails() {
  if (!state.activeProfileId) return;
  const profile = await apiRequest(`/profiles/${state.activeProfileId}`);
  state.activeProfile = profile;
  state.user.role = profile.role || state.user.role;
  applyUserData();
}

// Ensures every user has at least one profile for task ownership.
async function ensureDefaultProfile() {
  const profiles = await apiRequest("/profiles");

  if (profiles.length === 0) {
    const created = await apiRequest(
      "/profiles",
      {
        method: "POST",
        body: JSON.stringify({
          profileName: "My Profile",
          role: "user"
        })
      }
    );

    state.activeProfileId = created._id;
    state.activeProfile = created;
    state.user.role = created.role;
    return;
  }

  state.activeProfileId = profiles[0]._id;
  state.activeProfile = profiles[0];
  state.user.role = profiles[0].role;
}

// Creates a new account from lightweight prompts, without changing the current UI.
async function signupUser(name, email, password) {
  const data = await apiRequest(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    },
    false
  );

  return data;
}

// Performs secure login and stores JWT for protected API calls.
async function loginUser(email, password) {
  const responseData = await apiRequest(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password })
    },
    false
  );

  // Support both shapes:
  // 1) already unwrapped: { token, refreshToken, user }
  // 2) nested payload: { data: { token, refreshToken, user } }
  const authData = responseData?.data ? responseData.data : responseData;

  state.user.id = authData.user.userId;
  state.user.name = authData.user.name;
  state.user.email = authData.user.email;
  state.user.role = authData.user.role;
  state.user.token = authData.token;
  state.user.refreshToken = authData.refreshToken || "";
  saveUserContext();
}

// Restores user session from backend when a token is already saved locally.
async function tryRestoreSession(savedContext) {
  if (!savedContext?.token) return false;

  state.user.token = savedContext.token;
  state.user.id = savedContext.userId || "";
  state.user.email = savedContext.email || "";
  state.user.name = savedContext.name || "Guest User";
  state.user.role = savedContext.role || "user";
  state.user.refreshToken = savedContext.refreshToken || "";

  try {
    const me = await apiRequest("/auth/me", {}, true);
    state.user.id = me.userId;
    state.user.name = me.name;
    state.user.email = me.email;
    state.user.role = me.role;
    saveUserContext();
    await hydrateDashboardData();
    showScreen("dashboard");
    return true;
  } catch (error) {
    clearUserContext();
    state.user.token = "";
    state.user.refreshToken = "";
    return false;
  }
}

// Loads all dashboard data required right after login.
async function hydrateDashboardData() {
  await ensureDefaultProfile();
  await loadActiveProfileDetails();
  await loadTasksForActiveProfile();
  applyUserData();
}

// Renders task cards and wires existing card actions.
function renderTasks() {
  const tasks = getVisibleTasks();
  refs.taskList.innerHTML = "";
  refs.emptyState.hidden = tasks.length > 0;

  tasks.forEach((task) => {
    const node = refs.taskTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;

    node.querySelector(".task-title").textContent = task.title;
    node.querySelector(".task-desc").textContent = task.description || "No description";

    const checkbox = node.querySelector(".task-check");
    checkbox.checked = task.status === "completed";
    checkbox.addEventListener("change", async () => {
      try {
        const nextStatus = checkbox.checked ? "completed" : "active";
        await apiRequest(`/tasks/${task.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus })
        });
        task.status = nextStatus;
        renderStats();
        renderTasks();
        notify("success", "Task status updated");
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        notify("error", error.message);
      }
    });

    const meta = node.querySelector(".task-meta");
    meta.appendChild(createTag(task.priority, task.priority));

    if (task.category) {
      meta.appendChild(createTag(task.category, "category"));
    }

    meta.appendChild(createTag(toDueLabel(task.dueDate), "due"));

    node.querySelector(".delete").addEventListener("click", async () => {
      try {
        await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });
        state.tasks = state.tasks.filter((x) => x.id !== task.id);
        renderStats();
        renderTasks();
        notify("success", "Task deleted");
      } catch (error) {
        notify("error", error.message);
      }
    });

    node.querySelector(".edit").addEventListener("click", () => {
      state.editingId = task.id;
      refs.taskSubmitBtn.textContent = "Update Task";
      refs.taskTitle.value = task.title;
      refs.taskDescription.value = task.description;
      refs.taskPriority.value = task.priority;
      refs.taskDue.value = task.dueDate;
      refs.taskCategory.value = task.category;
      refs.taskTags.value = task.tags.join(", ");
      refs.showFormBtn.click();
      refs.taskTitle.focus();
    });

    refs.taskList.appendChild(node);
  });
}

// Builds metadata tags with existing classes/styles.
function createTag(text, className) {
  const el = document.createElement("span");
  el.className = `tag ${className}`;
  el.textContent = text;
  return el;
}

// Opens/closes Add Task form while preserving current animation.
function showTaskForm(show) {
  refs.taskFormWrap.hidden = false;
  refs.showFormBtn.classList.toggle("is-open", show);
  refs.showFormBtn.setAttribute("aria-expanded", String(show));

  if (show) {
    requestAnimationFrame(() => {
      refs.taskFormWrap.classList.add("is-open");
    });
  } else {
    refs.taskFormWrap.classList.remove("is-open");
    window.setTimeout(() => {
      if (!refs.taskFormWrap.classList.contains("is-open")) {
        refs.taskFormWrap.hidden = true;
      }
    }, 220);
  }

  refs.addLauncher.hidden = show;
  refs.cancelAdd.hidden = !show;
}

// Clears task form after submit or cancel.
function resetForm() {
  refs.taskForm.reset();
  refs.taskPriority.value = "medium";
  refs.taskSubmitBtn.textContent = "Add Task";
  state.editingId = null;
}

// Creates/updates tasks from Add Task form and syncs dashboard data.
async function upsertTaskFromForm(event) {
  event.preventDefault();

  const title = refs.taskTitle.value.trim();
  if (!title) return;

  const payload = {
    profileId: state.activeProfileId,
    title,
    description: refs.taskDescription.value.trim(),
    priority: refs.taskPriority.value,
    dueDate: refs.taskDue.value || null,
    category: refs.taskCategory.value.trim(),
    tags: refs.taskTags.value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  };

  try {
    setButtonLoading(refs.taskSubmitBtn, true, "Saving...", state.editingId ? "Update Task" : "Add Task");

    if (state.editingId) {
      const updated = await apiRequest(`/tasks/${state.editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          dueDate: payload.dueDate,
          category: payload.category,
          tags: payload.tags
        })
      });

      state.tasks = state.tasks.map((task) => (task.id === state.editingId ? mapTaskFromApi(updated) : task));
      notify("success", "Task updated successfully");
    } else {
      const created = await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      state.tasks.unshift(mapTaskFromApi(created));
      notify("success", "Task created successfully");
    }

    resetForm();
    showTaskForm(false);
    renderStats();
    renderTasks();
  } catch (error) {
    notify("error", error.message);
  } finally {
    setButtonLoading(refs.taskSubmitBtn, false, "Saving...", state.editingId ? "Update Task" : "Add Task");
  }
}

// Connects top-level navigation/logout actions to backend-synced state.
function bindGlobalActions() {
  if (refs.googleLoginBtn) {
    refs.googleLoginBtn.addEventListener("click", () => {
      window.location.href = `${API_BASE_URL}/auth/google`;
    });
  }

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = btn.dataset.go;
      if (target === "dashboard" && state.user.id) {
        try {
          await loadTasksForActiveProfile();
        } catch (error) {
          notify("error", error.message);
        }
      }

      if (target === "profile" && state.user.id) {
        try {
          await loadActiveProfileDetails();
        } catch (error) {
          notify("error", error.message);
        }
      }

      showScreen(target);
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (state.user.refreshToken) {
        try {
          await apiRequest(
            "/auth/logout",
            {
              method: "POST",
              body: JSON.stringify({ refreshToken: state.user.refreshToken })
            },
            false,
            false
          );
        } catch (error) {
          // Continue local logout even if server-side revoke request fails.
        }
      }

      clearUserContext();
      state.user.id = "";
      state.user.email = "";
      state.user.name = "Guest User";
      state.user.role = "user";
      state.user.token = "";
      state.user.refreshToken = "";
      state.activeProfileId = "";
      state.activeProfile = null;
      state.tasks = [];
      resetForm();
      showTaskForm(false);
      renderStats();
      renderTasks();
      showScreen("login");
    });
  });

}

// Handles signup page submit with confirm password validation.
function initSignup() {
  refs.signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = refs.signupName.value.trim();
    const email = refs.signupEmail.value.trim().toLowerCase();
    const password = refs.signupPassword.value;
    const confirmPassword = refs.signupConfirmPassword.value;

    if (!name || !email || !password || !confirmPassword) {
      notify("error", "All signup fields are required.");
      return;
    }

    if (password.length < 6) {
      notify("error", "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      notify("error", "Password and confirm password do not match.");
      return;
    }

    try {
      setButtonLoading(refs.signupSubmitBtn, true, "Creating...", "Create Account");
      await signupUser(name, email, password);
      refs.signupForm.reset();
      refs.loginEmail.value = email;
      refs.loginPassword.value = "";
      showScreen("login");
      notify("success", "Signup successful. Please login.");
    } catch (error) {
      notify("error", error.message);
    } finally {
      setButtonLoading(refs.signupSubmitBtn, false, "Creating...", "Create Account");
    }
  });
}

// Wires form submit and all filter controls.
function bindFormAndFilters() {
  refs.showFormBtn.addEventListener("click", () => showTaskForm(true));

  refs.cancelAdd.addEventListener("click", () => {
    resetForm();
    showTaskForm(false);
  });

  refs.taskForm.addEventListener("submit", upsertTaskFromForm);

  refs.search.addEventListener("input", (e) => {
    state.filters.search = e.target.value.trim().toLowerCase();
    renderTasks();
  });

  refs.filterPriority.addEventListener("change", (e) => {
    state.filters.priority = e.target.value;
    renderTasks();
  });

  refs.filterStatus.addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    renderTasks();
  });

  refs.sortBy.addEventListener("change", (e) => {
    state.filters.sortBy = e.target.value;
    renderTasks();
  });
}

// Handles secure login using backend password verification.
function initAuth() {
  refs.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = refs.loginEmail.value.trim().toLowerCase();
    const password = refs.loginPassword.value;
    if (!email || !password) {
      notify("error", "Email and password are required");
      return;
    }

    try {
      setButtonLoading(refs.loginSubmitBtn, true, "Signing in...", "Login");
      await loginUser(email, password);
      await hydrateDashboardData();
      resetForm();
      showTaskForm(false);
      showScreen("dashboard");
      notify("success", "Dashboard synced with backend");
    } catch (error) {
      notify("error", error.message);
    } finally {
      setButtonLoading(refs.loginSubmitBtn, false, "Signing in...", "Login");
    }
  });
}

// Initializes app with cached context and binds all interactions.
function init() {
  const hadOAuthTokensInUrl = consumeOAuthTokensFromUrl();
  const savedContext = loadUserContext();
  if (savedContext?.email) {
    refs.loginEmail.value = savedContext.email;
  }

  applyUserData();
  bindGlobalActions();
  bindFormAndFilters();
  initAuth();
  initSignup();
  resetForm();
  showTaskForm(false);
  renderStats();
  renderTasks();
  showScreen("login");

  // Try silent session restore, otherwise stay on login screen.
  if (hadOAuthTokensInUrl || savedContext?.token) {
    tryRestoreSession(savedContext);
  }
}

init();
