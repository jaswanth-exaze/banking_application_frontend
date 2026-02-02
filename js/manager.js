console.log("manager.js loaded");

/* SECTION TOGGLER */
function showSection(id) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );
  document.getElementById(id).classList.remove("hidden");
}

/* DASHBOARD */
async function loadManagerDashboard() {
  showSection("dashboard");

  const token = localStorage.getItem("token");
  const payload = JSON.parse(atob(token.split(".")[1]));

  /* Welcome + Branch */
  document.getElementById("welcomeText").innerText =
    "Welcome Branch Manager";

  document.getElementById("branchInfo").innerText =
    `Branch ID: ${payload.branch_id}`;

  /* Fetch dashboard summary */
  try {
    const res = await fetch(
      getApiUrl("manager/dashboard-summary"),
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await res.json();

    document.getElementById("empCount").innerText =
      data.total_employees;

    document.getElementById("custCount").innerText =
      data.total_customers;

    document.getElementById("accCount").innerText =
      data.total_accounts;

    document.getElementById("branchBalance").innerText =
      `₹ ${Number(data.branch_balance).toLocaleString("en-IN")}`;

  } catch (err) {
    console.error("Dashboard load error", err);
  }
}

/* EMPLOYEES */
async function openEmployees() {
  showSection("employees");
  loadEmployees();
}

async function loadEmployees() {
  const token = localStorage.getItem("token");
  const tbody = document.getElementById("employeeTable");

  tbody.innerHTML = `<tr><td colspan="4" class="loader"></td></tr>`;

  try {
    const res = await fetch(
      getApiUrl("manager/employees"),
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const employees = await res.json();
    tbody.innerHTML = "";

    if (employees.length === 0) {
      tbody.innerHTML =
        `<tr><td colspan="4" class="empty-state">No employees found</td></tr>`;
      return;
    }

    employees.forEach(e => {
      tbody.innerHTML += `
        <tr>
          <td>${e.user_id}</td>
          <td>${e.username}</td>
          <td>${e.role_name}</td>
          <td>${e.is_active ? "Active" : "Inactive"}</td>
        </tr>
      `;
    });

  } catch (err) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="empty-state">Failed to load employees</td></tr>`;
  }
}

/* CUSTOMERS */
async function openCustomers() {
  showSection("customers");
  loadCustomers();
}

async function loadCustomers() {
  const token = localStorage.getItem("token");
  const tbody = document.getElementById("customerTable");

  tbody.innerHTML = `<tr><td colspan="4" class="loader"></td></tr>`;

  try {
    const res = await fetch(
      getApiUrl("manager/customers"),
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const customers = await res.json();
    tbody.innerHTML = "";

    if (customers.length === 0) {
      tbody.innerHTML =
        `<tr><td colspan="4" class="empty-state">No customers found</td></tr>`;
      return;
    }

    customers.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td>${c.customer_id}</td>
          <td>${c.first_name} ${c.last_name}</td>
          <td>${c.email}</td>
          <td>${c.phone}</td>
        </tr>
      `;
    });

  } catch (err) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="empty-state">Failed to load customers</td></tr>`;
  }
}