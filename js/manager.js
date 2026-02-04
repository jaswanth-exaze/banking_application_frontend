/* SECTION TOGGLER */
function showSection(id) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );
  document.getElementById(id).classList.remove("hidden");
  const map = {
    dashboard: "dashboard",
    employees: "employees",
    customers: "customers",
  };
  setActiveNav(map[id] || id);
}

function setActiveNav(key) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const target = document.querySelector(`.nav-item[data-section="${key}"]`);
  if (target) target.classList.add("active");
}

/* DASHBOARD */
async function loadManagerDashboard() {
  showSection("dashboard");

  const token = localStorage.getItem("token");
  let branchIdFromToken = "—";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    branchIdFromToken = payload.branch_id ?? branchIdFromToken;
  } catch (err) {
    console.warn("Failed to read branch id from token", err);
  }

  /* Welcome + Branch */
  document.getElementById("welcomeText").innerText =
    "Welcome Branch Manager";

  document.getElementById("branchName").innerText = "Branch —";
  document.getElementById("branchId").innerText =
    `Branch ID: ${branchIdFromToken}`;
  document.getElementById("branchAddress").innerText = "—";

  updateDateTime();
  setInterval(updateDateTime, 60000);

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

    if (data.branch_name) {
      const branchLabel = data.branch_code
        ? `${data.branch_name} Branch • ${data.branch_code}`
        : `${data.branch_name} Branch`;
      document.getElementById("branchName").innerText = branchLabel;
    }

    if (data.branch_id) {
      document.getElementById("branchId").innerText =
        `Branch ID: ${data.branch_id}`;
    }

    if (data.branch_address) {
      document.getElementById("branchAddress").innerText =
        data.branch_address;
    }

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

/* DATE & TIME */
function updateDateTime() {
  const now = new Date();

  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const timeEl = document.getElementById("welcomeTime");
  if (timeEl) {
    timeEl.innerText = `${date} • ${time}`;
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
      const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      tbody.innerHTML += `
        <tr>
        <td>${e.employee_id || "—"}</td>
        <td>${e.user_id || "—"}</td>
          <td>${fullName || "—"}</td>
          <td>${e.email || "—"}</td>
          <td>${e.role_name || "—"}</td>
          <td>${e.phone || "—"}</td>
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
