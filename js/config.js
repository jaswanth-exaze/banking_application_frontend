/**
 * Frontend API configuration.
 * Exposes a single URL builder so all fetch calls stay consistent.
 */

// Resolves the backend origin for both local and deployed usage.
const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1"
    ? "https://bankingapplication-production.up.railway.app"
    : "https://bankingapplication-production.up.railway.app");

// Makes the resolved base URL available globally.
window.API_BASE_URL = API_BASE_URL;

// Builds a full API URL while safely handling leading slashes.
function getApiUrl(endpoint) {
  // Normalize endpoint so `/auth/login` and `auth/login` both work.
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;

  // Return absolute URL used by fetch calls.
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
