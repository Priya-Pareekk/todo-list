const isLocalFile = window.location.protocol === "file:";
const defaultApiBaseUrl = isLocalFile
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;

window.APP_CONFIG = {
  API_BASE_URL: defaultApiBaseUrl
};
