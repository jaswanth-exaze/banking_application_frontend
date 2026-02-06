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
    transactions: "transactions",
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

/* TRANSACTIONS */
const MGR_TXN_LIMIT = 15;
let mgrTxnState = { page: 1, total: 0 };

function openTransactions() {
  showSection("transactions");
  loadManagerTransactions(1);
}

function formatParty(name, accountNumber, customerId, userId) {
  if (!name && !accountNumber && !customerId && !userId) return "—";
  const trimmed = name ? name.trim() : "";
  const label = trimmed
    || (customerId ? `Customer ${customerId}` : userId ? `User ${userId}` : "Account");
  const suffix = accountNumber && !label.includes(accountNumber) ? ` • ${accountNumber}` : "";
  return `${label}${suffix}`;
}

function renderManagerTxns(txns) {
  const tbody = document.getElementById("mgrTxnTable");
  if (!tbody) return;

  if (!txns.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions found</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  txns.forEach((t) => {
    const when = t.created_at
      ? new Date(t.created_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "—";

    const typeClass = (t.transaction_type || "").toLowerCase() === "credit"
      ? "txn-credit"
      : (t.transaction_type || "").toLowerCase() === "debit"
        ? "txn-debit"
        : "";

    tbody.innerHTML += `
      <tr>
        <td>${when}</td>
        <td>${formatParty(t.from_customer_name, t.from_account_number, t.from_customer_id, t.from_user_id)}</td>
        <td>${formatParty(t.to_customer_name, t.to_account_number, t.to_customer_id, t.to_user_id)}</td>
        <td class="${typeClass}">${t.transaction_type || "—"}</td>
        <td class="${typeClass}">&#8377; ${Number(t.amount || 0).toLocaleString("en-IN")}</td>
        <td>${t.description || "—"}</td>
      </tr>
    `;
  });
}

function updateMgrPager() {
  const meta = document.getElementById("mgrTxnPageMeta");
  const prev = document.getElementById("mgrTxnPrevBtn");
  const next = document.getElementById("mgrTxnNextBtn");

  const totalPages = mgrTxnState.total
    ? Math.max(1, Math.ceil(mgrTxnState.total / MGR_TXN_LIMIT))
    : mgrTxnState.page;

  if (meta) meta.innerText = `Page ${mgrTxnState.page}${mgrTxnState.total ? ` / ${totalPages}` : ""}`;
  if (prev) prev.disabled = mgrTxnState.page <= 1;
  if (next) next.disabled = mgrTxnState.page >= totalPages;
}

async function loadManagerTransactions(page = 1) {
  const tbody = document.getElementById("mgrTxnTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="loader"></td></tr>`;
  }

  const customerId = document.getElementById("mgrTxnCustomerId")?.value.trim();
  const userId = document.getElementById("mgrTxnUserId")?.value.trim();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: MGR_TXN_LIMIT.toString(),
  });
  if (customerId) params.append("customerId", customerId);
  if (userId) params.append("userId", userId);

  try {
    const res = await fetch(
      getApiUrl(`manager/transactions?${params.toString()}`),
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    );

    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || "Failed to load transactions");

    mgrTxnState = {
      page: payload.page || page,
      total: payload.total || 0,
    };

    renderManagerTxns(payload.data || []);
    updateMgrPager();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message || "Failed to load transactions"}</td></tr>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const filterForm = document.getElementById("mgrTxnFilterForm");
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loadManagerTransactions(1);
    });
  }

  const clearBtn = document.getElementById("mgrTxnClearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const c = document.getElementById("mgrTxnCustomerId");
      const u = document.getElementById("mgrTxnUserId");
      if (c) c.value = "";
      if (u) u.value = "";
      loadManagerTransactions(1);
    });
  }

  const prevBtn = document.getElementById("mgrTxnPrevBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (mgrTxnState.page > 1) loadManagerTransactions(mgrTxnState.page - 1);
    });
  }

  const nextBtn = document.getElementById("mgrTxnNextBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const totalPages = mgrTxnState.total
        ? Math.ceil(mgrTxnState.total / MGR_TXN_LIMIT)
        : mgrTxnState.page + 1;
      if (mgrTxnState.page < totalPages) {
        loadManagerTransactions(mgrTxnState.page + 1);
      }
    });
  }
});
