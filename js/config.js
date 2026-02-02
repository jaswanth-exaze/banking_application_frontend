// API Configuration
// Centralized API base URL handling for local + production

const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1"
    ? "https://bankingapplication-production.up.railway.app"
    : "https://bankingapplication-production.up.railway.app");

// Export API base URL
window.API_BASE_URL = API_BASE_URL;

// Helper function to build API URLs
function getApiUrl(endpoint) {

  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;

  return `${API_BASE_URL}/${cleanEndpoint}`;
}
