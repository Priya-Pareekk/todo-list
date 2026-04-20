const isLocalFile = window.location.protocol === "file:";
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Local frontend dev servers should call backend on :5000.
const defaultApiBaseUrl = isLocalFile || isLocalHost
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;

window.APP_CONFIG = {
  API_BASE_URL: defaultApiBaseUrl
};
