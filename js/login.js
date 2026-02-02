async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");

  msg.innerText = "Logging in...";
  msg.style.color = "#374151";

  const res = await fetch(getApiUrl("auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.style.color = "red";
    msg.innerText = data.message;
    return;
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);

  if (data.role === "CUSTOMER")
    window.location.href = "../dashboards/customer.html";
  else if (data.role === "EMPLOYEE")
    window.location.href = "../dashboards/employee.html";
  else
    window.location.href = "../dashboards/manager.html";
}