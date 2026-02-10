/**
 * Customer dashboard script.
 * Manages section navigation, profile/account data, transfers, transactions, and loans.
 */

/* =========================
   SECTION HANDLER
========================= */
// This function hides all dashboard sections, shows only the requested section,
// and then updates which nav button should look active.
function showSection(id) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
  const map = {
    accountsSection: "accounts",
    transferSection: "transfer",
    transactionsSection: "transactions",
    loansSection: "loans",
    profileSection: "profile",
  };
  setActiveNav(map[id] || id);
}

// This function removes the active state from all nav buttons,
// then marks only the requested nav key as active.
function setActiveNav(key) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const target = document.querySelector(`.nav-item[data-section="${key}"]`);
  if (target) target.classList.add("active");
}

/* =========================
   SHARED HELPERS
========================= */
// In-memory cache so we do not repeatedly fetch accounts on every action.
let customerAccountsCache = [];

// Builds the Authorization header using the token saved in localStorage.
function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

// Loads customer accounts from API.
// If `force` is false and cache already exists, it returns cached data.
async function fetchCustomerAccounts(force = false) {
  if (!force && customerAccountsCache.length) return customerAccountsCache;

  const res = await fetch(getApiUrl("customer/accounts"), {
    headers: getAuthHeader(),
  });

  if (!res.ok) throw new Error("Failed to load accounts");

  const accounts = await res.json();
  customerAccountsCache = accounts || [];
  return customerAccountsCache;
}

/* =========================
   REAL-TIME DATE & TIME
========================= */
// Creates a readable date-time string and writes it into the welcome header.
function updateDateTime() {
  const now = new Date();

  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const timeEl = document.getElementById("welcomeTime");
  if (timeEl) {
    timeEl.innerText = `${dateStr} • ${timeStr}`;
  }
}

/* =========================
   INITIAL DASHBOARD LOAD
========================= */
// This is the main startup function for customer dashboard.
// It opens default section, loads profile context, and starts live time updates.
async function loadCustomerDashboard() {
  openAccounts(); // default view

  // Temporary placeholders
  document.getElementById("welcomeText").innerText = "Welcome —";
  document.getElementById("branchText").innerText = "—";
  document.getElementById("branchAddress").innerText = "—";

  try {
    const res = await fetch(getApiUrl("customer/profile"), {
      headers: getAuthHeader(),
    });

    const data = await res.json();

    /* Greeting based on time */
    const hour = new Date().getHours();
    let greeting = "Welcome";

    if (hour < 12) greeting = "Good Morning";
    else if (hour < 18) greeting = "Good Afternoon";
    else greeting = "Good Evening";

    /* Welcome Header */
    document.getElementById("welcomeText").innerText =
      `${greeting}, ${data.first_name}`;

    document.getElementById("branchText").innerText =
      `${data.branch_name} Branch • ${data.branch_code}`;

    document.getElementById("branchAddress").innerText = data.branch_address;

    /* Start live clock */
    updateDateTime();
    setInterval(updateDateTime, 60000);
  } catch (err) {
    console.error("Customer dashboard load error:", err);
  }
}

/* =========================
   MY ACCOUNTS
========================= */
// Opens Accounts section and renders all customer accounts as cards.
async function openAccounts() {
  showSection("accountsSection");

  const container = document.getElementById("accountsContainer");

  container.innerHTML = `<div class="loader"></div>`;

  try {
    const accounts = await fetchCustomerAccounts(true);
    container.innerHTML = "";

    if (accounts.length === 0) {
      container.innerHTML = `<div class="empty-state">No accounts found</div>`;
      return;
    }

    accounts.forEach((acc) => {
      container.innerHTML += `
        <div class="account-card">
          <h4>${acc.account_type} Account</h4>
          <p>Account No: ${acc.account_number}</p>
          <div class="balance">₹ ${Number(acc.balance).toLocaleString("en-IN")}</div>
        </div>
      `;
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load accounts</div>`;
  }
}

/* =========================
   TRANSFER MONEY
========================= */
// Writes transfer status messages (normal/success/error) in a single place.
function setTransferStatus(message, state) {
  const el = document.getElementById("transferMsg");
  if (!el) return;

  el.classList.remove("status-error", "status-success");
  el.innerText = message || "";

  if (state === "error") el.classList.add("status-error");
  if (state === "success") el.classList.add("status-success");
}

// Shows available balance for currently selected sender account.
function updateBalanceHint() {
  const select = document.getElementById("fromAccount");
  const hint = document.getElementById("balanceHint");
  if (!select || !hint) return;

  const selected = customerAccountsCache.find(
    (acc) => String(acc.account_id) === select.value,
  );

  if (!selected) {
    hint.innerText = "Pick an account to view available balance.";
    return;
  }

  hint.innerText = `Available balance: INR ${Number(selected.balance).toLocaleString("en-IN")}`;
}

// Populates "from account" dropdown with customer-owned accounts.
function populateFromAccounts(accounts) {
  const select = document.getElementById("fromAccount");
  if (!select) return;

  select.innerHTML = `<option value="">Select one of your accounts</option>`;

  accounts.forEach((acc) => {
    select.innerHTML += `<option value="${acc.account_id}">${acc.account_number} - ${acc.account_type}</option>`;
  });

  updateBalanceHint();
}

// Opens transfer section and prepares dropdown data.
async function openTransfer() {
  showSection("transferSection");
  setTransferStatus("");

  try {
    const accounts = await fetchCustomerAccounts();

    if (!accounts.length) {
      setTransferStatus(
        "No active accounts available for transfer.",
        "error",
      );
      return;
    }

    populateFromAccounts(accounts);
  } catch (err) {
    setTransferStatus("Unable to load accounts for transfer.", "error");
  }
}

// Validates transfer form, calls transfer API, then refreshes local account cache.
async function submitTransfer(e) {
  e.preventDefault();

  const fromId = Number(document.getElementById("fromAccount").value);
  const toId = Number(document.getElementById("toAccount").value);
  const amount = Number(document.getElementById("transferAmount").value);
  const desc = document.getElementById("transferDesc").value.trim();

  // Basic validation before API call.
  if (!fromId || !toId || !amount || amount <= 0) {
    setTransferStatus("Please fill all fields with valid values.", "error");
    return;
  }

  // Sender and receiver cannot be the same account.
  if (fromId === toId) {
    setTransferStatus("Sender and recipient accounts must be different.", "error");
    return;
  }

  // Client-side guard: prevent transfer amount greater than known balance.
  const sourceAcc = customerAccountsCache.find(
    (acc) => Number(acc.account_id) === fromId,
  );
  if (sourceAcc && amount > Number(sourceAcc.balance)) {
    setTransferStatus("Amount exceeds available balance.", "error");
    return;
  }

  setTransferStatus("Processing transfer...");

  // Make transfer request to backend.
  try {
    const res = await fetch(getApiUrl("customer/transfer"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        fromId,
        toId,
        amount,
        desc: desc || "Fund transfer",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Transfer failed");

    setTransferStatus(
      data.message || "Amount transferred successfully",
      "success",
    );
    e.target.reset();

    await fetchCustomerAccounts(true);
    populateFromAccounts(customerAccountsCache);
  } catch (err) {
    setTransferStatus(err.message || "Unable to complete transfer", "error");
  }
}

/* =========================
   MY TRANSACTIONS (ON DEMAND)
========================= */
// Opens transactions section and renders transaction table for this customer.
async function openTransactions() {
  showSection("transactionsSection");

  const tbody = document.getElementById("txnTable");

  tbody.innerHTML = `<tr><td colspan="7" class="loader"></td></tr>`;

  try {
    // Ensure accounts are loaded for mapping and balance calculations
    const accounts = await fetchCustomerAccounts();

    // Update top-right balance chip with combined balance
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance || 0),
      0,
    );
    const balanceChip = document.getElementById("currentBalanceChip");
    if (balanceChip) {
      balanceChip.innerText =
        accounts.length === 0
          ? "Balance: —"
          : `Balance: \u20b9 ${totalBalance.toLocaleString("en-IN")}`;
    }

    // Get transaction list from backend after accounts are ready.
    const res = await fetch(getApiUrl("customer/transactions"), {
      headers: getAuthHeader(),
    });

    const txns = await res.json();
    tbody.innerHTML = "";

    if (txns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No transactions found</td></tr>`;
      return;
    }

    // Build maps for quick lookup and running balances
    const accountMap = new Map(
      accounts.map((acc) => [Number(acc.account_id), acc]),
    );
    const runningBalances = new Map(
      accounts.map((acc) => [Number(acc.account_id), Number(acc.balance)]),
    );

    // Helper: masks account id/number to last 4 chars.
    const last4 = (num) => {
      if (!num) return "----";
      const str = String(num);
      return str.slice(-4);
    };

    // Helper: formats party label shown in from/to columns.
    const formatParty = (name, accNumber, id) => {
      if (!name && !accNumber && !id) return "Cash Desk";
      const label = name || (id ? `Account ${id}` : "Account");
      return `${label}-${last4(accNumber || id)}`;
    };

    txns.forEach((t) => {
      // Determine whether row is incoming or outgoing for this user.
      const userAccountId = accountMap.has(Number(t.to_account_id))
        ? Number(t.to_account_id)
        : accountMap.has(Number(t.from_account_id))
          ? Number(t.from_account_id)
          : null;

      const direction =
        t.transaction_direction ||
        (accountMap.has(Number(t.to_account_id)) ? "CREDIT" : "DEBIT");

      const amountNum = Number(t.amount);
      let balanceAfter = "—";

      // Compute running balance backwards because list is newest-first.
      if (userAccountId !== null && runningBalances.has(userAccountId)) {
        balanceAfter = runningBalances.get(userAccountId);
        const delta = direction === "CREDIT" ? amountNum : -amountNum;
        // Walk backwards in time (list is newest first)
        runningBalances.set(userAccountId, balanceAfter - delta);
      }

      const typeClass =
        direction.toLowerCase() === "credit"
          ? "txn-credit"
          : direction.toLowerCase() === "debit"
            ? "txn-debit"
            : "";

      const when = t.created_at
        ? new Date(t.created_at).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";

      tbody.innerHTML += `
        <tr>
          <td>${when}</td>
          <td>${t.description || "—"}</td>
          <td>${formatParty(t.from_customer_name, t.from_account_number, t.from_account_id)}</td>
          
          <td>${formatParty(t.to_customer_name, t.to_account_number, t.to_account_id)}</td>
          <td class="${typeClass}">${t.transaction_type}</td>
          <td class="${typeClass}">&#8377; ${amountNum.toLocaleString("en-IN")}</td>
          <td>${balanceAfter === "—" ? "—" : `&#8377; ${balanceAfter.toLocaleString("en-IN")}`}</td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Failed to load transactions</td></tr>`;
  }
}

/* =========================
   MY PROFILE (READ ONLY)
========================= */
// Opens profile section and fills all profile fields with latest API data.
async function openProfile() {
  showSection("profileSection");

  // Placeholder state
  document.getElementById("profName").innerText = "—";
  document.getElementById("profUsername").innerText = "—";
  document.getElementById("profEmail").innerText = "—";
  document.getElementById("profPhone").innerText = "—";
  document.getElementById("profBranch").innerText = "—";
  document.getElementById("profBranchAddress").innerText = "—";

  try {
    const res = await fetch(getApiUrl("customer/profile"), {
      headers: getAuthHeader(),
    });

    const data = await res.json();

    document.getElementById("profName").innerText =
      `${data.first_name} ${data.last_name}`;

    document.getElementById("profUsername").innerText = data.username;

    document.getElementById("profEmail").innerText = data.email;

    document.getElementById("profPhone").innerText = data.phone;

    document.getElementById("profBranch").innerText =
      `${data.branch_name} (${data.branch_code})`;

    document.getElementById("profBranchAddress").innerText =
      data.branch_address;
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

/* =========================
   EVENT HOOKS
========================= */
// Registers all one-time DOM event listeners after page loads.
document.addEventListener("DOMContentLoaded", () => {
  const transferForm = document.getElementById("transferForm");
  if (transferForm) {
    transferForm.addEventListener("submit", submitTransfer);
  }

  const fromSelect = document.getElementById("fromAccount");
  if (fromSelect) {
    fromSelect.addEventListener("change", updateBalanceHint);
  }

  const loanForm = document.getElementById("loanForm");
  if (loanForm) {
    loanForm.addEventListener("submit", submitLoanApplication);
  }
});


/* =========================
   LOANS
========================= */
// Status metadata used to render user-friendly label and color.
const LOAN_STATUS_META = {
  REQUESTED: { label: "Pending employee review", cls: "waiting" },
  EMPLOYEE_APPROVED: { label: "Awaiting manager decision", cls: "info" },
  EMPLOYEE_REJECTED: { label: "Rejected by employee", cls: "danger" },
  MANAGER_APPROVED: { label: "Approved", cls: "success" },
  MANAGER_REJECTED: { label: "Rejected by manager", cls: "danger" },
};

// Converts raw backend status to styled status badge HTML.
function formatLoanStatus(status) {
  const meta = LOAN_STATUS_META[status] || { label: status || "—", cls: "info" };
  return `<span class="loan-status ${meta.cls}">${meta.label}</span>`;
}

// Shows feedback message for loan form actions.
function setLoanFormMsg(text, state) {
  const el = document.getElementById("loanFormMsg");
  if (!el) return;
  el.classList.remove("status-success", "status-error");
  el.innerText = text || "";
  if (state === "success") el.classList.add("status-success");
  if (state === "error") el.classList.add("status-error");
}

// Opens Loans section and loads current loan list.
async function openLoans() {
  showSection("loansSection");
  loadLoans();
}

// Validates and submits new loan application for this customer.
async function submitLoanApplication(e) {
  e.preventDefault();

  const amount = Number(document.getElementById("loanAmount").value);
  const tenure = Number(document.getElementById("loanTenure").value);
  const purpose = document.getElementById("loanPurpose").value.trim();

  // Basic loan form validation.
  if (!amount || amount <= 0 || !tenure) {
    setLoanFormMsg("Please enter a valid amount and tenure.", "error");
    return;
  }

  setLoanFormMsg("Submitting loan request...");

  // Submit loan request.
  try {
    const res = await fetch(getApiUrl("customer/applyLoan"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        amount,
        tenure_months: tenure,
        purpose: purpose || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Loan request failed");

    setLoanFormMsg(data.message || "Loan request submitted", "success");
    e.target.reset();
    loadLoans();
  } catch (err) {
    setLoanFormMsg(err.message || "Unable to submit loan", "error");
  }
}

// Fetches customer loan list and sends it to render function.
async function loadLoans() {
  const tbody = document.getElementById("loanTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="loader"></td></tr>`;
  }

  try {
    const res = await fetch(getApiUrl("customer/getLoans"), {
      headers: getAuthHeader(),
    });
    const loans = await res.json();
    if (!res.ok) throw new Error(loans.message || "Failed to load loans");
    renderLoans(loans || []);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="7" class="empty-state">${err.message || "Unable to load loans"}</td></tr>`;
    }
  }
}

// Renders loan table rows with status badge, timestamps, and comments.
function renderLoans(loans = []) {
  const tbody = document.getElementById("loanTable");
  if (!tbody) return;

  if (!loans.length) {
    tbody.innerHTML =
      `<tr><td colspan="7" class="empty-state">No loan requests yet</td></tr>`;
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
      (loan.status === "EMPLOYEE_APPROVED"
        ? "Pending manager decision"
        : "—");

    tbody.innerHTML += `
      <tr>
        <td>${loan.loan_id}</td>
        <td>&#8377; ${Number(loan.amount || 0).toLocaleString("en-IN")}</td>
        <td>${loan.tenure_months} mo</td>
        <td>${loan.purpose || "—"}</td>
        <td>${formatLoanStatus(loan.status)}</td>
        <td>${updated}</td>
        <td>${comment}</td>
      </tr>
    `;
  });
}
