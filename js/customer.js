/* =========================
   SECTION HANDLER
========================= */
function showSection(id) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
  const map = {
    accountsSection: "accounts",
    transferSection: "transfer",
    transactionsSection: "transactions",
    profileSection: "profile",
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

/* =========================
   SHARED HELPERS
========================= */
let customerAccountsCache = [];

function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

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
function setTransferStatus(message, state) {
  const el = document.getElementById("transferMsg");
  if (!el) return;

  el.classList.remove("status-error", "status-success");
  el.innerText = message || "";

  if (state === "error") el.classList.add("status-error");
  if (state === "success") el.classList.add("status-success");
}

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

function populateFromAccounts(accounts) {
  const select = document.getElementById("fromAccount");
  if (!select) return;

  select.innerHTML = `<option value="">Select one of your accounts</option>`;

  accounts.forEach((acc) => {
    select.innerHTML += `<option value="${acc.account_id}">${acc.account_number} - ${acc.account_type}</option>`;
  });

  updateBalanceHint();
}

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

async function submitTransfer(e) {
  e.preventDefault();

  const fromId = Number(document.getElementById("fromAccount").value);
  const toId = Number(document.getElementById("toAccount").value);
  const amount = Number(document.getElementById("transferAmount").value);
  const desc = document.getElementById("transferDesc").value.trim();

  if (!fromId || !toId || !amount || amount <= 0) {
    setTransferStatus("Please fill all fields with valid values.", "error");
    return;
  }

  if (fromId === toId) {
    setTransferStatus("Sender and recipient accounts must be different.", "error");
    return;
  }

  const sourceAcc = customerAccountsCache.find(
    (acc) => Number(acc.account_id) === fromId,
  );
  if (sourceAcc && amount > Number(sourceAcc.balance)) {
    setTransferStatus("Amount exceeds available balance.", "error");
    return;
  }

  setTransferStatus("Processing transfer...");

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

    const last4 = (num) => {
      if (!num) return "----";
      const str = String(num);
      return str.slice(-4);
    };

    const formatParty = (name, accNumber, id) => {
      if (!name && !accNumber && !id) return "Cash Desk";
      const label = name || (id ? `Account ${id}` : "Account");
      return `${label}-${last4(accNumber || id)}`;
    };

    txns.forEach((t) => {
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
document.addEventListener("DOMContentLoaded", () => {
  const transferForm = document.getElementById("transferForm");
  if (transferForm) {
    transferForm.addEventListener("submit", submitTransfer);
  }

  const fromSelect = document.getElementById("fromAccount");
  if (fromSelect) {
    fromSelect.addEventListener("change", updateBalanceHint);
  }
});


