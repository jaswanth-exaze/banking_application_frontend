function getToken() {
  return localStorage.getItem("token");
}

function protectPage(role) {
  const token = getToken();
  const userRole = localStorage.getItem("role");

  if (!token || userRole !== role) {
    window.location.href = "/login.html";
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}
