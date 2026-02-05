function getToken() {
  return localStorage.getItem("token");
}


const SESSION_EXPIRED_KEY = "sessionExpiredMessage";

function setSessionExpiredMessage(message) {
  if (message) {
    localStorage.setItem(SESSION_EXPIRED_KEY, message);
  }
}

function clearSessionExpiredMessage() {
  localStorage.removeItem(SESSION_EXPIRED_KEY);
}

function redirectToLogin(message) {
  setSessionExpiredMessage(message || "Login session expired. Please log in again.");
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/login.html";
}

function installAuthInterceptor() {
  if (window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);

    if (res && res.status === 401) {
      let message = "Login session expired. Please log in again.";
      try {
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

installAuthInterceptor();
function protectPage(role) {
  const token = getToken();
  const userRole = localStorage.getItem("role");

  if (!token || userRole !== role) {
    clearSessionExpiredMessage();
    window.location.href = "/login.html";
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}
