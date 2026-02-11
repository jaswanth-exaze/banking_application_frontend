/**
 * Employee dashboard script.
 * Handles branch operations: onboarding, cash desk, transactions, and loan reviews.
 */

/* =========================================================
   EMPLOYEE DASHBOARD SCRIPT
   ========================================================= */

/* =========================================================
   BASIC HELPERS
========================================================= */

// This function hides all sections, shows one requested section,
// and also updates the active nav item for that section.
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach((sec) => {
    sec.classList.add("hidden");
  });
  document.getElementById(sectionId).classList.remove("hidden");
  const map = {
    dashboardSection: "dashboard",
    customersSection: "customers",
    transactionsSection: "transactions",
    loansSection: "loans",
    cashSection: "cash",
    onboardSection: "onboard",
    profileSection: "profile",
  };
  setActiveNav(map[sectionId] || sectionId);
}

// This function removes active class from all nav buttons
// and then enables it only for the selected section key.
function setActiveNav(key) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const target = document.querySelector(`.nav-item[data-section="${key}"]`);
  if (target) target.classList.add("active");
}

// Returns authorization header used in every protected API call.
function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

/* =========================================================
   DATE & TIME
========================================================= */

// Updates the live date/time text shown on the dashboard header.
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

  document.getElementById("welcomeTime").innerText = `${date} • ${time}`;
}

/* =========================================================
   DASHBOARD INITIAL LOAD
========================================================= */

// Initial employee dashboard setup:
// open default section, start clock, and load summary/profile data.
function initEmployeeDashboard() {
  showSection("dashboardSection");
  updateDateTime();
  setInterval(updateDateTime, 60000);

  loadEmployeeProfile();
  loadBranchSummary();
}

/* =========================================================
   EMPLOYEE PROFILE
========================================================= */

// Loads employee profile details and fills both greeting + profile panel fields.
async function loadEmployeeProfile() {
  try {
    const res = await fetch(getApiUrl("employee/profile"), {
      headers: getAuthHeader(),
    });

    if (!res.ok) throw new Error("Profile fetch failed");

    const emp = await res.json();

    // Choose greeting text based on current local time.
    const hour = new Date().getHours();
    let greeting = "Good Evening";
    if (hour < 12) greeting = "Good Morning";
    else if (hour < 18) greeting = "Good Afternoon";

    document.getElementById("welcomeText").innerText =
      `${greeting}, ${emp.first_name}`;

    document.getElementById("branchText").innerText =
      `${emp.branch_name} Branch • ${emp.branch_code}`;

    /* Profile Section */
    document.getElementById("empUsername").innerText =
      `${emp.first_name} ${emp.last_name}`;

    document.getElementById("empDesignation").innerText = emp.designation;

    document.getElementById("empEmail").innerText = emp.email;

    document.getElementById("empPhone").innerText = emp.phone;

    document.getElementById("empGender").innerText = emp.gender;

    document.getElementById("empJoined").innerText = emp.joined_date;

    document.getElementById("empBranch").innerText =
      `${emp.branch_name} (${emp.branch_code})`;
  } catch (err) {
    console.error("Employee profile error:", err);
  }
}

/* =========================================================
   BRANCH SUMMARY
========================================================= */

// Fetches branch summary metrics and renders dashboard stat cards.
async function loadBranchSummary() {
  try {
    const res = await fetch(
      getApiUrl("employee/dashboard-summary"),
      { headers: getAuthHeader() },
    );

    if (!res.ok) throw new Error("Summary fetch failed");

    const data = await res.json();

    document.getElementById("totalCustomers").innerText = data.totalCustomers;

    document.getElementById("branchBalance").innerText =
      `₹ ${Number(data.branchBalance).toLocaleString("en-IN")}`;
  } catch (err) {
    console.error("Branch summary error:", err);
  }
}

/* =========================================================
   VIEW CUSTOMERS
========================================================= */

// Opens customer section and renders branch customers in table form.
async function openCustomers() {
  showSection("customersSection");

  const tbody = document.getElementById("customerTable");
  tbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

  try {
    const res = await fetch(getApiUrl("employee/customers"), {
      headers: getAuthHeader(),
    });

    if (!res.ok) throw new Error("Customer fetch failed");

    const customers = await res.json();
    tbody.innerHTML = "";

    if (customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
          No customers found
        </td></tr>`;
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
    console.error("Customer list error:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
        Failed to load customers
      </td></tr>`;
  }
}

/* =========================================================
   TRANSACTIONS (BRANCH LEVEL)
========================================================= */
const TXN_PAGE_SIZE = 15;
// Current pagination state for the branch transaction table.
let txnState = { page: 1, total: 0 };

// Opens transactions section and loads first page.
function openTransactions() {
  showSection("transactionsSection");
  loadTransactions(1);
}

// Builds display label for sender/receiver with safe fallbacks.
function formatParty(name, accountNumber, customerId, userId) {
  if (!name && !accountNumber && !customerId && !userId) return "—";
  const trimmed = name ? name.trim() : "";
  const label = trimmed
    || (customerId ? `Customer ${customerId}` : userId ? `User ${userId}` : "Account");
  const suffix = accountNumber && !label.includes(accountNumber) ? ` • ${accountNumber}` : "";
  return `${label}${suffix}`;
}

// Renders transactions array into table rows.
function renderTransactions(txns) {
  const tbody = document.getElementById("txnTable");
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

// Updates pager text and previous/next button disabled state.
function updateTxnPager() {
  const meta = document.getElementById("txnPageMeta");
  const prev = document.getElementById("txnPrevBtn");
  const next = document.getElementById("txnNextBtn");

  const totalPages = txnState.total
    ? Math.max(1, Math.ceil(txnState.total / TXN_PAGE_SIZE))
    : txnState.page;

  if (meta) meta.innerText = `Page ${txnState.page}${txnState.total ? ` / ${totalPages}` : ""}`;
  if (prev) prev.disabled = txnState.page <= 1;
  if (next) next.disabled = txnState.page >= totalPages;
}

// Loads transactions with pagination + optional customer/user filters.
async function loadTransactions(page = 1) {
  const tbody = document.getElementById("txnTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="loader"></td></tr>`;
  }

  // Read optional filter values from search inputs.
  const customerId = document.getElementById("txnCustomerId")?.value.trim();
  const userId = document.getElementById("txnUserId")?.value.trim();

  // Build query string sent to backend.
  const params = new URLSearchParams({
    page: page.toString(),
    limit: TXN_PAGE_SIZE.toString(),
  });
  if (customerId) params.append("customerId", customerId);
  if (userId) params.append("userId", userId);

  // Fetch branch transactions from API.
  try {
    const res = await fetch(getApiUrl(`employee/transactions?${params.toString()}`), {
      headers: getAuthHeader(),
    });

    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || "Failed to load transactions");
console.log(payload)
    txnState = {
      page: payload.page || page,
      total: payload.total || 0,
    };

    renderTransactions(payload.data || []);
    updateTxnPager();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message || "Failed to load transactions"}</td></tr>`;
    }
  }
}

/* =========================================================
   CASH DESK (DEPOSIT & WITHDRAWAL)
========================================================= */

// Reusable helper to show success/error message in cash desk forms.
function setCashStatus(targetId, message, state) {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.classList.remove("status-error", "status-success");
  el.innerText = message || "";

  if (state === "error") el.classList.add("status-error");
  if (state === "success") el.classList.add("status-success");
}

// Opens cash section and clears stale status messages.
function openCashDesk() {
  showSection("cashSection");
  setCashStatus("depositMsg", "");
  setCashStatus("withdrawMsg", "");
}

// Validates and submits cash deposit request.
async function submitDeposit(e) {
  e.preventDefault();

  const accountId = Number(document.getElementById("depositAccountId").value);
  const amount = Number(document.getElementById("depositAmount").value);
  const desc = document.getElementById("depositDesc").value.trim();

  // Client-side validation before sending request.
  if (!accountId || accountId <= 0 || !amount || amount <= 0) {
    setCashStatus("depositMsg", "Enter a valid account ID and amount.", "error");
    return;
  }

  setCashStatus("depositMsg", "Processing deposit...");

  // Call deposit API endpoint.
  try {
    const res = await fetch(getApiUrl("employee/deposit"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        toId: accountId,
        amount,
        desc: desc || "Cash deposit",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Deposit failed");

    setCashStatus(
      "depositMsg",
      data.message || "Amount deposited successfully",
      "success",
    );
    e.target.reset();
  } catch (err) {
    setCashStatus(
      "depositMsg",
      err.message || "Failed to deposit amount",
      "error",
    );
  }
}

// Validates and submits cash withdrawal request.
async function submitWithdrawal(e) {
  e.preventDefault();

  const accountId = Number(
    document.getElementById("withdrawAccountId").value,
  );
  const amount = Number(document.getElementById("withdrawAmount").value);
  const desc = document.getElementById("withdrawDesc").value.trim();

  // Client-side validation before sending request.
  if (!accountId || accountId <= 0 || !amount || amount <= 0) {
    setCashStatus(
      "withdrawMsg",
      "Enter a valid account ID and amount.",
      "error",
    );
    return;
  }

  setCashStatus("withdrawMsg", "Processing withdrawal...");

  // Call withdrawal API endpoint.
  try {
    const res = await fetch(getApiUrl("employee/withdrawal"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        fromId: accountId,
        amount,
        desc: desc || "Cash withdrawal",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Withdrawal failed");

    setCashStatus(
      "withdrawMsg",
      data.message || "Amount withdrawn successfully",
      "success",
    );
    e.target.reset();
  } catch (err) {
    setCashStatus(
      "withdrawMsg",
      err.message || "Failed to withdraw amount",
      "error",
    );
  }
}

/* =========================================================
   PROFILE OPEN
========================================================= */

// Opens profile section in the dashboard.
function openProfile() {
  showSection("profileSection");
}

/* =========================================================
   ONBOARD CUSTOMER (MERGED FLOW)
========================================================= */

// Handles onboarding form submit:
// creates customer user + customer profile + optional opening account.
async function onboardCustomer(e) {
  e.preventDefault();

  const msg = document.getElementById("onboardMsg");

  // Construct request payload from onboarding form fields.
  const payload = {
    username: obUsername.value.trim(),
    password: obPassword.value,
    first_name: obFirstName.value.trim(),
    last_name: obLastName.value.trim(),
    email: obEmail.value.trim(),
    phone: obPhone.value.trim(),
    create_account: createAccountChk.checked,
    account_type: obAccType.value,
    opening_balance: Number(obOpeningBalance.value || 0),
  };

  msg.innerText = "Processing...";
  msg.style.color = "#333";

  // Submit onboarding request to backend.
  try {
    const res = await fetch(getApiUrl("employee/onboard-customer"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    msg.style.color = "green";
    msg.innerText = "Customer onboarded successfully";

    e.target.reset();
  } catch (err) {
    msg.style.color = "red";
    msg.innerText = err.message || "Failed to onboard customer";
  }
}

/* =========================================================
   INIT
========================================================= */

// Register page event listeners once the DOM is fully loaded.
document.addEventListener("DOMContentLoaded", () => {
  initEmployeeDashboard();

  const form = document.getElementById("onboardForm");
  if (form) {
    form.addEventListener("submit", onboardCustomer);
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutEmployee);
  }

  const depositForm = document.getElementById("depositForm");
  if (depositForm) {
    depositForm.addEventListener("submit", submitDeposit);
  }

  const withdrawForm = document.getElementById("withdrawForm");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", submitWithdrawal);
  }

  const txnFilterForm = document.getElementById("txnFilterForm");
  if (txnFilterForm) {
    txnFilterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loadTransactions(1);
    });
  }

  const txnClearBtn = document.getElementById("txnClearBtn");
  if (txnClearBtn) {
    txnClearBtn.addEventListener("click", () => {
      const custInput = document.getElementById("txnCustomerId");
      const userInput = document.getElementById("txnUserId");
      if (custInput) custInput.value = "";
      if (userInput) userInput.value = "";
      loadTransactions(1);
    });
  }

  const txnPrevBtn = document.getElementById("txnPrevBtn");
  if (txnPrevBtn) {
    txnPrevBtn.addEventListener("click", () => {
      if (txnState.page > 1) {
        loadTransactions(txnState.page - 1);
      }
    });
  }

  const txnNextBtn = document.getElementById("txnNextBtn");
  if (txnNextBtn) {
    txnNextBtn.addEventListener("click", () => {
      const totalPages = txnState.total
        ? Math.ceil(txnState.total / TXN_PAGE_SIZE)
        : txnState.page + 1;
      if (txnState.page < totalPages) {
        loadTransactions(txnState.page + 1);
      }
    });
  }

  const loanTable = document.getElementById("empLoanTable");
  if (loanTable) {
    loanTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      handleEmployeeLoanDecision(btn.dataset.loanId, btn.dataset.action);
    });
  }
});

// Clears auth data and redirects employee back to the login screen.
function logoutEmployee() {
  logout();
}

/* =========================================================
   LOANS QUEUE
========================================================= */
// Shows queue-level status messages for loan actions.
function setEmployeeLoanMsg(text, state) {
  const el = document.getElementById("empLoanMsg");
  if (!el) return;
  el.classList.remove("status-success", "status-error");
  el.innerText = text || "";
  if (state === "success") el.classList.add("status-success");
  if (state === "error") el.classList.add("status-error");
}

// Opens pending loans section and fetches latest queue.
function openLoanQueue() {
  showSection("loansSection");
  loadEmployeeLoans();
}

// Renders pending loans list with inline action buttons.
function renderEmployeeLoans(loans = []) {
  const tbody = document.getElementById("empLoanTable");
  if (!tbody) return;

  if (!loans.length) {
    tbody.innerHTML =
      `<tr><td colspan="8" class="empty-state">No pending loans</td></tr>`;
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

// Fetches pending loans that need employee decision.
async function loadEmployeeLoans() {
  const tbody = document.getElementById("empLoanTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="loader"></td></tr>`;
  }
  setEmployeeLoanMsg("Fetching pending loans...");

  try {
    const res = await fetch(getApiUrl("employee/pendingLoans"), {
      headers: getAuthHeader(),
    });

    const loans = await res.json();
    if (!res.ok) throw new Error(loans.message || "Failed to load loans");

    renderEmployeeLoans(loans || []);
    setEmployeeLoanMsg(
      loans?.length
        ? `${loans.length} loan${loans.length > 1 ? "s" : ""} waiting for your decision`
        : "All caught up. No pending loans.",
      loans?.length ? undefined : "success",
    );
  } catch (err) {
    setEmployeeLoanMsg(err.message || "Unable to load loans", "error");
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="8" class="empty-state">Could not load loans</td></tr>`;
    }
  }
}

// Sends employee approve/reject action for selected loan.
async function handleEmployeeLoanDecision(loanId, action) {
  if (!loanId || !action) return;

  const commentInput = document.querySelector(
    `.loan-comment[data-loan-id="${loanId}"]`,
  );
  const comment = commentInput ? commentInput.value.trim() : "";

  setEmployeeLoanMsg(
    `${action === "APPROVE" ? "Approving" : "Rejecting"} loan #${loanId}...`,
  );

  try {
    const res = await fetch(getApiUrl(`employee/${loanId}/decision`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ action, comment }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update loan");

    setEmployeeLoanMsg(data.message || "Decision saved", "success");
    loadEmployeeLoans();
  } catch (err) {
    setEmployeeLoanMsg(err.message || "Unable to update loan", "error");
  }
}


