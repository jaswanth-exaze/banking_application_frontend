/**
 * Frontend auth helpers.
 * Basic token/session handling with simple refresh-on-401 behavior.
 */

const SESSION_EXPIRED_KEY = "sessionExpiredMessage";
let alreadyRedirected = false;

// Returns the JWT saved after login.
function getToken() {
  return localStorage.getItem("token");
}

// Saves one-time message shown on login page after redirect.
function saveSessionMessage(message) {
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

// Clears auth state and sends user to login page.
function redirectToLogin(message) {
  if (alreadyRedirected) return;
  alreadyRedirected = true;

  saveSessionMessage(message || "Login session expired. Please log in again.");
  clearAuthState();
  window.location.href = "/login.html";
}

// Checks if URL is an auth endpoint where we should not attach bearer token.
function isAuthEndpoint(url) {
  return (
    url.includes("/auth/login")
    || url.includes("/auth/refresh")
    || url.includes("/auth/logout")
  );
}

// Checks if request is for backend API.
function isApiRequest(url) {
  return typeof url === "string" && url.startsWith(window.API_BASE_URL);
}

// Adds credentials and optional bearer token to request options.
function buildRequestOptions(init, addBearerToken) {
  const options = { ...(init || {}), credentials: "include" };
  const headers = new Headers(options.headers || {});

  if (addBearerToken) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } else {
    headers.delete("Authorization");
  }

  options.headers = headers;
  return options;
}

// Reads backend message from error response, if available.
async function getErrorMessage(res) {
  try {
    const data = await res.clone().json();
    if (data && data.message) return data.message;
  } catch (err) {
    // Ignore parse failure and use default message.
  }

  return "Login session expired. Please log in again.";
}

// Installs one global fetch wrapper:
// - attaches credentials + bearer token
// - if 401 happens, tries refresh once and retries original request
function installAuthWrapper() {
  if (window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const apiCall = isApiRequest(requestUrl);
    const authCall = isAuthEndpoint(requestUrl || "");

    const requestOptions = apiCall
      ? buildRequestOptions(init, !authCall)
      : init;

    let response = await originalFetch(input, requestOptions);

    if (!apiCall || response.status !== 401 || authCall) {
      return response;
    }

    // Try to refresh access token using refresh-token cookie.
    const refreshRes = await originalFetch(getApiUrl("auth/refresh"), {
      method: "POST",
      credentials: "include",
    }).catch(() => null);

    if (refreshRes && refreshRes.ok) {
      const refreshData = await refreshRes.json().catch(() => null);
      if (refreshData && refreshData.token) {
        localStorage.setItem("token", refreshData.token);
        if (refreshData.role) localStorage.setItem("role", refreshData.role);

        const retryOptions = buildRequestOptions(init, true);
        response = await originalFetch(input, retryOptions);
        return response;
      }
    }

    const message = await getErrorMessage(response);
    redirectToLogin(message);
    return response;
  };
}

// Enable wrapper as soon as this script loads.
installAuthWrapper();

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
