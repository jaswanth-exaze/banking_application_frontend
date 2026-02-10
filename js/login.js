/**
 * Login page logic.
 * Handles credential submission, response messaging, and role-based redirect.
 */

// Authenticates the user and routes them to the correct dashboard.
async function login() {
  // Read input values from login form.
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");

  // Show immediate feedback so user knows request is in progress.
  msg.innerText = "Logging in...";
  msg.style.color = "#374151";

  // Send credentials to backend auth endpoint.
  const res = await fetch(getApiUrl("auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  // Parse backend response (success payload or error payload).
  const data = await res.json();

  // If login failed, show backend message and stop.
  if (!res.ok) {
    msg.style.color = "red";
    msg.innerText = data.message;
    return;
  }

  // Save auth session data for protected pages.
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);

  // Redirect based on role returned by backend.
  if (data.role === "CUSTOMER")
    window.location.href = "../dashboards/customer.html";
  else if (data.role === "EMPLOYEE")
    window.location.href = "../dashboards/employee.html";
  else
    window.location.href = "../dashboards/manager.html";
}


// Shows a one-time message when a previous session expired.
(function showSessionExpiredMessage() {
  // Read message written by auth interceptor before redirect.
  const msgText = localStorage.getItem("sessionExpiredMessage");
  if (!msgText) return;

  const msg = document.getElementById("loginMsg");
  if (msg) {
    msg.style.color = "#b45309";
    msg.innerText = msgText;
  }

  // Remove it so it does not show again on next refresh.
  localStorage.removeItem("sessionExpiredMessage");
})();
