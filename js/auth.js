/**
 * Frontend auth helpers.
 * Centralizes token access, session-expiry handling, and route protection.
 */

// Returns the JWT saved after login.
function getToken() {
  return localStorage.getItem("token");
}

// Storage key used to show an expiry message on the login page.
const SESSION_EXPIRED_KEY = "sessionExpiredMessage";

// Persists a one-time message that is displayed after redirect.
function setSessionExpiredMessage(message) {
  if (message) {
    localStorage.setItem(SESSION_EXPIRED_KEY, message);
  }
}

// Clears any previously stored session-expiry message.
function clearSessionExpiredMessage() {
  localStorage.removeItem(SESSION_EXPIRED_KEY);
}

// Clears auth state and redirects to the login page.
function redirectToLogin(message) {
  setSessionExpiredMessage(message || "Login session expired. Please log in again.");
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/login.html";
}

// Installs a single global fetch interceptor to catch 401 responses.
function installAuthInterceptor() {
  // Prevent duplicate wrapping if this file is loaded more than once.
  if (window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  // Keep original fetch, then wrap it with auth-expiry handling.
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);

    // Any 401 means session is invalid/expired; redirect user to login.
    if (res && res.status === 401) {
      let message = "Login session expired. Please log in again.";
      try {
        // Try reading backend error message for better UX.
        const data = await res.clone().json();
        if (data && data.message) message = data.message;
      } catch (err) {
        // Ignore parse errors, use default message
      }
      redirectToLogin(message);
    }

    return res;
  };
}

// Enable interceptor as soon as this script loads.
installAuthInterceptor();

// Protects dashboard pages by validating token presence and expected role.
function protectPage(role) {
  const token = getToken();
  const userRole = localStorage.getItem("role");

  if (!token || userRole !== role) {
    clearSessionExpiredMessage();
    window.location.href = "/login.html";
  }
}

// Performs a full client-side logout and redirects to login.
function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}
