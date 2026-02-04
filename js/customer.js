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

  const token = localStorage.getItem("token");

  // Temporary placeholders
  document.getElementById("welcomeText").innerText = "Welcome —";
  document.getElementById("branchText").innerText = "—";
  document.getElementById("branchAddress").innerText = "—";

  try {
    const res = await fetch(getApiUrl("customer/profile"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

  const token = localStorage.getItem("token");
  const container = document.getElementById("accountsContainer");

  container.innerHTML = `<div class="loader"></div>`;

  try {
    const res = await fetch(getApiUrl("customer/accounts"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const accounts = await res.json();
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
   MY TRANSACTIONS (ON DEMAND)
========================= */
async function openTransactions() {
  showSection("transactionsSection");

  const token = localStorage.getItem("token");
  const tbody = document.getElementById("txnTable");

  tbody.innerHTML = `<tr><td colspan="4" class="loader"></td></tr>`;

  try {
    const res = await fetch(getApiUrl("customer/transactions"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const txns = await res.json();
    tbody.innerHTML = "";

    if (txns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No transactions found</td></tr>`;
      return;
    }

    txns.forEach((t) => {
      const type = String(t.transaction_type || "").toLowerCase();
      const typeClass =
        type === "credit" ? "txn-credit" : type === "debit" ? "txn-debit" : "";
      tbody.innerHTML += `
        <tr>
          <td>${new Date(t.created_at).toLocaleDateString("en-IN")}</td>
          <td>${t.description}</td>
          <td class="${typeClass}">${t.transaction_type}</td>
          <td class="${typeClass}">&#8377; ${Number(t.amount).toLocaleString("en-IN")}</td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Failed to load transactions</td></tr>`;
  }
}

/* =========================
   MY PROFILE (READ ONLY)
========================= */
async function openProfile() {
  showSection("profileSection");

  const token = localStorage.getItem("token");

  // Placeholder state
  document.getElementById("profName").innerText = "—";
  document.getElementById("profUsername").innerText = "—";
  document.getElementById("profEmail").innerText = "—";
  document.getElementById("profPhone").innerText = "—";
  document.getElementById("profBranch").innerText = "—";
  document.getElementById("profBranchAddress").innerText = "—";

  try {
    const res = await fetch(getApiUrl("customer/profile"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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


