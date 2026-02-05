/* =========================================================
   EMPLOYEE DASHBOARD SCRIPT
   ========================================================= */

/* =========================================================
   BASIC HELPERS
========================================================= */

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach((sec) => {
    sec.classList.add("hidden");
  });
  document.getElementById(sectionId).classList.remove("hidden");
  const map = {
    dashboardSection: "dashboard",
    customersSection: "customers",
    onboardSection: "onboard",
    profileSection: "profile",
  };
  setActiveNav(map[sectionId] || sectionId);
}

function setActiveNav(key) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const target = document.querySelector(`.nav-item[data-section="${key}"]`);
  if (target) target.classList.add("active");
}

function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

/* =========================================================
   DATE & TIME
========================================================= */

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

async function loadEmployeeProfile() {
  try {
    const res = await fetch(getApiUrl("employee/profile"), {
      headers: getAuthHeader(),
    });

    if (!res.ok) throw new Error("Profile fetch failed");

    const emp = await res.json();

    /* Greeting */
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
   CASH DESK (DEPOSIT & WITHDRAWAL)
========================================================= */

function setCashStatus(targetId, message, state) {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.classList.remove("status-error", "status-success");
  el.innerText = message || "";

  if (state === "error") el.classList.add("status-error");
  if (state === "success") el.classList.add("status-success");
}

function openCashDesk() {
  showSection("cashSection");
  setCashStatus("depositMsg", "");
  setCashStatus("withdrawMsg", "");
}

async function submitDeposit(e) {
  e.preventDefault();

  const accountId = Number(document.getElementById("depositAccountId").value);
  const amount = Number(document.getElementById("depositAmount").value);
  const desc = document.getElementById("depositDesc").value.trim();

  if (!accountId || accountId <= 0 || !amount || amount <= 0) {
    setCashStatus("depositMsg", "Enter a valid account ID and amount.", "error");
    return;
  }

  setCashStatus("depositMsg", "Processing deposit...");

  try {
    const res = await fetch(getApiUrl("employee/deposite"), {
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

async function submitWithdrawal(e) {
  e.preventDefault();

  const accountId = Number(
    document.getElementById("withdrawAccountId").value,
  );
  const amount = Number(document.getElementById("withdrawAmount").value);
  const desc = document.getElementById("withdrawDesc").value.trim();

  if (!accountId || accountId <= 0 || !amount || amount <= 0) {
    setCashStatus(
      "withdrawMsg",
      "Enter a valid account ID and amount.",
      "error",
    );
    return;
  }

  setCashStatus("withdrawMsg", "Processing withdrawal...");

  try {
    const res = await fetch(getApiUrl("employee/withdrawl"), {
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

function openProfile() {
  showSection("profileSection");
}

/* =========================================================
   ONBOARD CUSTOMER (MERGED FLOW)
========================================================= */

async function onboardCustomer(e) {
  e.preventDefault();

  const msg = document.getElementById("onboardMsg");

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
});

function logoutEmployee() {
  // Clear auth data
  localStorage.removeItem("token");

  // Optional: clear other stored data
  localStorage.removeItem("user");

  // Redirect to login page
  window.location.href = "/login.html";
  // 👆 adjust path if your login page is different
}
