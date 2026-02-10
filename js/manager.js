/**
 * Manager dashboard script.
 * Handles branch overview, employee/customer views, branch transactions, and loan approvals.
 */

/* SECTION TOGGLER */
// This function hides all sections, shows only the requested section,
// and updates active nav state.
function showSection(id) {
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  const map = {
    dashboard: "dashboard",
    employees: "employees",
    customers: "customers",
    transactions: "transactions",
    loans: "loans",
  };
  setActiveNav(map[id] || id);
}

// Removes active class from all nav items and activates only selected key.
function setActiveNav(key) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const target = document.querySelector(`.nav-item[data-section="${key}"]`);
  if (target) target.classList.add("active");
}

/* DASHBOARD */
// Initial manager dashboard loader:
// opens dashboard, decodes branch id from token, and loads summary cards.
async function loadManagerDashboard() {
  showSection("dashboard");

  // Read branch id from JWT payload so we can show fallback immediately.
  const token = localStorage.getItem("token");
  let branchIdFromToken = "—";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    branchIdFromToken = payload.branch_id ?? branchIdFromToken;
  } catch (err) {
    console.warn("Failed to read branch id from token", err);
  }

  // Set placeholder/fallback header values before API data returns.
  document.getElementById("welcomeText").innerText = "Welcome Branch Manager";

  document.getElementById("branchName").innerText = "Branch —";
  document.getElementById("branchId").innerText =
    `Branch ID: ${branchIdFromToken}`;
  document.getElementById("branchAddress").innerText = "—";

  updateDateTime();
  setInterval(updateDateTime, 60000);

  // Fetch official branch metrics and replace placeholders.
  try {
    const res = await fetch(getApiUrl("manager/dashboard-summary"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
      document.getElementById("branchAddress").innerText = data.branch_address;
    }

    document.getElementById("empCount").innerText = data.total_employees;

    document.getElementById("custCount").innerText = data.total_customers;

    document.getElementById("accCount").innerText = data.total_accounts;

    document.getElementById("branchBalance").innerText =
      `₹ ${Number(data.branch_balance).toLocaleString("en-IN")}`;
  } catch (err) {
    console.error("Dashboard load error", err);
  }
}

/* DATE & TIME */
// Renders current date/time in manager welcome header.
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
// Opens employees section and loads employee table.
async function openEmployees() {
  showSection("employees");
  loadEmployees();
}

// Fetches branch employees and renders table rows.
async function loadEmployees() {
  const token = localStorage.getItem("token");
  const tbody = document.getElementById("employeeTable");

  tbody.innerHTML = `<tr><td colspan="4" class="loader"></td></tr>`;

  try {
    const res = await fetch(getApiUrl("manager/employees"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const employees = await res.json();
    tbody.innerHTML = "";

    if (employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No employees found</td></tr>`;
      return;
    }

    employees.forEach((e) => {
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
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Failed to load employees</td></tr>`;
  }
}

/* CUSTOMERS */
// Opens customers section and loads customer table.
async function openCustomers() {
  showSection("customers");
  loadCustomers();
}

// Fetches branch customers and renders table rows.
async function loadCustomers() {
  const token = localStorage.getItem("token");
  const tbody = document.getElementById("customerTable");

  tbody.innerHTML = `<tr><td colspan="4" class="loader"></td></tr>`;

  try {
    const res = await fetch(getApiUrl("manager/customers"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const customers = await res.json();
    tbody.innerHTML = "";

    if (customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No customers found</td></tr>`;
      return;
    }

    customers.forEach((c) => {
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
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Failed to load customers</td></tr>`;
  }
}

/* TRANSACTIONS */
const MGR_TXN_LIMIT = 15;
// Tracks current page and total count for manager transaction pagination.
let mgrTxnState = { page: 1, total: 0 };

// Opens transactions section and loads first page.
function openTransactions() {
  showSection("transactions");
  loadManagerTransactions(1);
}

// Formats sender/receiver label with safe fallback values.
function formatParty(name, accountNumber, customerId, userId) {
  if (!name && !accountNumber && !customerId && !userId) return "—";
  const trimmed = name ? name.trim() : "";
  const label =
    trimmed ||
    (customerId
      ? `Customer ${customerId}`
      : userId
        ? `User ${userId}`
        : "Account");
  const suffix =
    accountNumber && !label.includes(accountNumber)
      ? ` • ${accountNumber}`
      : "";
  return `${label}${suffix}`;
}

// Renders manager transaction table rows.
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

    const typeClass =
      (t.transaction_type || "").toLowerCase() === "credit"
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

// Updates pagination info and button enabled/disabled state.
function updateMgrPager() {
  const meta = document.getElementById("mgrTxnPageMeta");
  const prev = document.getElementById("mgrTxnPrevBtn");
  const next = document.getElementById("mgrTxnNextBtn");

  const totalPages = mgrTxnState.total
    ? Math.max(1, Math.ceil(mgrTxnState.total / MGR_TXN_LIMIT))
    : mgrTxnState.page;

  if (meta)
    meta.innerText = `Page ${mgrTxnState.page}${mgrTxnState.total ? ` / ${totalPages}` : ""}`;
  if (prev) prev.disabled = mgrTxnState.page <= 1;
  if (next) next.disabled = mgrTxnState.page >= totalPages;
}

// Loads manager transactions using pagination and optional filters.
async function loadManagerTransactions(page = 1) {
  const tbody = document.getElementById("mgrTxnTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="loader"></td></tr>`;
  }

  // Read optional customer/user filters from UI inputs.
  const customerId = document.getElementById("mgrTxnCustomerId")?.value.trim();
  const userId = document.getElementById("mgrTxnUserId")?.value.trim();

  // Build query params for paginated API call.
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
    if (!res.ok)
      throw new Error(payload.message || "Failed to load transactions");

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

// Register UI event listeners after DOM is ready.
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

  const loanTable = document.getElementById("mgrLoanTable");
  if (loanTable) {
    loanTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      handleManagerLoanDecision(btn.dataset.loanId, btn.dataset.action);
    });
  }
});

// Mapping used to display friendly loan status label and style.
const LOAN_STATUS_META = {
  REQUESTED: { label: "Pending employee review", cls: "waiting" },
  EMPLOYEE_APPROVED: { label: "Awaiting manager decision", cls: "info" },
  EMPLOYEE_REJECTED: { label: "Rejected by employee", cls: "danger" },
  MANAGER_APPROVED: { label: "Approved", cls: "success" },
  MANAGER_REJECTED: { label: "Rejected by manager", cls: "danger" },
};

// Converts raw status code into styled badge HTML.
function formatLoanStatus(status) {
  const meta = LOAN_STATUS_META[status] || {
    label: status || "—",
    cls: "info",
  };
  return `<span class="loan-status ${meta.cls}">${meta.label}</span>`;
}
/* LOANS */
// Displays feedback message for manager loan actions.
function setManagerLoanMsg(text, state) {
  const el = document.getElementById("mgrLoanMsg");
  if (!el) return;
  el.classList.remove("status-success", "status-error");
  el.innerText = text || "";
  if (state === "success") el.classList.add("status-success");
  if (state === "error") el.classList.add("status-error");
}

// Opens loan section and loads both pending queue + full history table.
function openManagerLoans() {
  showSection("loans");
  loadManagerLoans();
  loadAllManagerLoans();
}

// Renders pending manager-loan queue with action buttons.
function renderManagerLoans(loans = []) {
  const tbody = document.getElementById("mgrLoanTable");
  if (!tbody) return;

  if (!loans.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No loans pending manager decision</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  loans.forEach((loan) => {
    const created = loan.created_at
      ? new Date(loan.created_at).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    tbody.innerHTML += `
      <tr>
        <td>${loan.loan_id}</td>
        <td>${loan.customer_id}</td>
        <td>&#8377; ${Number(loan.amount || 0).toLocaleString("en-IN")}</td>
        <td>${loan.tenure_months} months</td>
        <td>${loan.purpose || "—"}</td>
        <td>${created}</td>
        <td>
          <input
            type="text"
            class="loan-comment"
            data-loan-id="${loan.loan_id}"
            placeholder="Optional comment"
          />
        </td>
        <td class="loan-actions">
          <button type="button" data-loan-id="${loan.loan_id}" data-action="APPROVE">Approve</button>
          <button type="button" class="ghost-btn danger-btn" data-loan-id="${loan.loan_id}" data-action="REJECT">Reject</button>
        </td>
      </tr>
    `;
  });
}

// Fetches loans waiting for manager decision.
async function loadManagerLoans() {
  const tbody = document.getElementById("mgrLoanTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="loader"></td></tr>`;
  }
  setManagerLoanMsg("Fetching pending loans...");

  try {
    const res = await fetch(getApiUrl("manager/pendingLoans"), {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    const loans = await res.json();
    if (!res.ok) throw new Error(loans.message || "Failed to load loans");

    renderManagerLoans(loans || []);
    setManagerLoanMsg(
      loans?.length
        ? `${loans.length} loan${loans.length > 1 ? "s" : ""} awaiting decision`
        : "All caught up. No pending loans.",
      loans?.length ? undefined : "success",
    );
  } catch (err) {
    setManagerLoanMsg(err.message || "Unable to load loans", "error");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Could not load loans</td></tr>`;
    }
  }
}

// Submits manager approve/reject decision for specific loan.
async function handleManagerLoanDecision(loanId, action) {
  if (!loanId || !action) return;
  const commentInput = document.querySelector(
    `.loan-comment[data-loan-id="${loanId}"]`,
  );
  const comment = commentInput ? commentInput.value.trim() : "";

  setManagerLoanMsg(
    `${action === "APPROVE" ? "Approving" : "Rejecting"} loan #${loanId}...`,
  );

  try {
    const res = await fetch(getApiUrl(`manager/${loanId}/decision`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ action, comment }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update loan");

    setManagerLoanMsg(data.message || "Decision saved", "success");
    loadManagerLoans();
  } catch (err) {
    setManagerLoanMsg(err.message || "Unable to update loan", "error");
  }
}

// Loads complete branch loan list (all statuses).
async function loadAllManagerLoans() {
  const tbody = document.getElementById("mgrAllLoanTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="loader"></td></tr>`;
  }

  try {
    const res = await fetch(getApiUrl("manager/loans"), {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    const loans = await res.json();
    if (!res.ok) throw new Error(loans.message || "Failed to load loans");

    renderAllManagerLoans(loans || []);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${err.message || "Unable to load loans"}</td></tr>`;
    }
  }
}

// Renders full branch loan history table.
function renderAllManagerLoans(loans = []) {
  const tbody = document.getElementById("mgrAllLoanTable");
  if (!tbody) return;

  if (!loans.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No loans found</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  loans.forEach((loan) => {
    const updated = loan.updated_at
      ? new Date(loan.updated_at).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const comment =
      loan.manager_comment ||
      loan.employee_comment ||
      (loan.status === "EMPLOYEE_APPROVED" ? "Pending manager decision" : "—");

    const customerName =
      `${loan.first_name || ""} ${loan.last_name || ""}`.trim() ||
      `Customer ${loan.customer_id}`;

    tbody.innerHTML += `
      <tr>
        <td>${loan.loan_id}</td>
        <td>${customerName} (ID ${loan.customer_id})</td>
        <td>&#8377; ${Number(loan.amount || 0).toLocaleString("en-IN")}</td>
        <td>${loan.tenure_months} mo</td>
        <td>${formatLoanStatus(loan.status)}</td>
        <td>${updated}</td>
        <td>${comment}</td>
      </tr>
    `;
  });
}
