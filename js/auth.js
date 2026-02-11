/**
 * Frontend auth helpers.
 * Centralizes token access, session-expiry handling, and route protection.
 */

const SESSION_EXPIRED_KEY = "sessionExpiredMessage";
const AUTH_ROUTE_PATTERN = /^\/auth\/(login|refresh|logout)\/?$/;
let refreshInFlight = null;
let redirectInProgress = false;

// Returns the JWT saved after login.
function getToken() {
  return localStorage.getItem("token");
}

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

// Removes client-side auth state.
function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

// Clears auth state and redirects to the login page.
function redirectToLogin(message) {
  if (redirectInProgress) return;
  redirectInProgress = true;

  setSessionExpiredMessage(message || "Login session expired. Please log in again.");
  clearAuthState();
  window.location.href = "/login.html";
}

// Builds normalized request URL from any fetch input type.
function getRequestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input || "");
}

// Determines whether request points to backend API and auth routes.
function getRequestMeta(url) {
  try {
    const requestUrl = new URL(url, window.location.origin);
    const apiBase = new URL(window.API_BASE_URL);

    return {
      isApiRequest: requestUrl.origin === apiBase.origin,
      isAuthRoute: AUTH_ROUTE_PATTERN.test(requestUrl.pathname),
    };
  } catch (err) {
    return { isApiRequest: false, isAuthRoute: false };
  }
}

// Applies API defaults (credentials + latest Authorization header).
function buildApiInit(input, init = {}, tokenOverride) {
  const options = { ...init, credentials: "include" };
  const headers = new Headers(
    options.headers || (input instanceof Request ? input.headers : {}),
  );
  const token = tokenOverride || getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  options.headers = headers;
  return options;
}

// Reads a user-friendly message from error payload when available.
async function getErrorMessage(res) {
  try {
    const data = await res.clone().json();
    if (data?.message) return data.message;
  } catch (err) {
    // Fall back to default message when response is not JSON.
  }

  return "Login session expired. Please log in again.";
}

// Requests a fresh access token using refresh-token cookie.
async function refreshAccessToken(originalFetch) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await originalFetch(getApiUrl("auth/refresh"), {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (!data?.token) return false;

      localStorage.setItem("token", data.token);
      if (data.role) {
        localStorage.setItem("role", data.role);
      }
      return true;
    } catch (err) {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// Installs a single global fetch interceptor to catch 401 responses.
function installAuthInterceptor() {
  // Prevent duplicate wrapping if this file is loaded more than once.
  if (window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  // Keep original fetch, then wrap it with auth-expiry handling.
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = getRequestUrl(input);
    const { isApiRequest, isAuthRoute } = getRequestMeta(url);

    const requestInit = isApiRequest ? buildApiInit(input, init) : init;
    if (isApiRequest && isAuthRoute) {
      const authHeaders = new Headers(requestInit.headers || {});
      authHeaders.delete("Authorization");
      requestInit.headers = authHeaders;
    }

    const res = await originalFetch(input, requestInit);

    if (!isApiRequest || res.status !== 401) {
      return res;
    }

    if (isAuthRoute) {
      return res;
    }

    const didRefresh = await refreshAccessToken(originalFetch);
    if (didRefresh) {
      const retryInit = buildApiInit(input, requestInit, getToken());
      return originalFetch(input, retryInit);
    }

    const message = await getErrorMessage(res);
    redirectToLogin(message);
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
    clearAuthState();
    window.location.href = "/login.html";
  }
}

// Performs a full client-side logout and redirects to login.
async function logout() {
  try {
    await fetch(getApiUrl("auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    // Ignore backend logout failures and proceed with local cleanup.
  }

  clearSessionExpiredMessage();
  clearAuthState();
  window.location.href = "/login.html";
}
