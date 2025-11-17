// key for localStorage
const STORAGE_KEY = "familyTripData_v1";

const tripForm = document.getElementById("trip-form");
const memberForm = document.getElementById("member-form");
const tripDisplay = document.getElementById("trip-display");
const memberTableBody = document.querySelector("#member-table tbody");
const totalMembersSpan = document.getElementById("total-members");
const exportBtn = document.getElementById("export-json");
const importInput = document.getElementById("import-json");
const clearBtn = document.getElementById("clear-data");

let data = {
  trip: {
    title: "",
    date: "",
    location: "",
    note: ""
  },
  members: [] // {name, count, phone, diet, note}
};

// ---- 初始化：從 localStorage 讀資料 ----
function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        data = parsed;
      }
    } catch (e) {
      console.error("Failed to parse stored data", e);
    }
  }
  renderTrip();
  renderMembers();
}

// ---- 存回 localStorage ----
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---- 行程資訊顯示 ----
function renderTrip() {
  const { title, date, location, note } = data.trip;
  document.getElementById("trip-title").value = title || "";
  document.getElementById("trip-date").value = date || "";
  document.getElementById("trip-location").value = location || "";
  document.getElementById("trip-note").value = note || "";

  if (!title && !date && !location && !note) {
    tripDisplay.innerHTML = `<span class="hint">尚未設定行程資訊，主揪可以在上方填寫。</span>`;
    return;
  }

  tripDisplay.innerHTML = `
    <strong>行程摘要（可截圖分享給家人）：</strong><br>
    <div style="margin-top: .35rem; line-height: 1.5;">
      ${title ? `💡 <strong>${title}</strong><br>` : ""}
      ${date ? `📅 日期：${date}<br>` : ""}
      ${location ? `📍 集合地點：${location}<br>` : ""}
      ${note ? `📝 備註：${note.replace(/\n/g, "<br>")}<br>` : ""}
    </div>
  `;
}

// ---- 報名清單顯示 ----
function renderMembers() {
  memberTableBody.innerHTML = "";
  let total = 0;

  data.members.forEach((m, idx) => {
    total += Number(m.count || 0);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${m.count}</td>
      <td>${escapeHtml(m.phone || "")}</td>
      <td>${escapeHtml(m.diet || "")}</td>
      <td>${escapeHtml(m.note || "")}</td>
      <td>
        <button class="btn small secondary" data-edit="${idx}">編輯</button>
        <button class="btn small danger" data-delete="${idx}">刪除</button>
      </td>
    `;

    memberTableBody.appendChild(tr);
  });

  totalMembersSpan.textContent = `總人數：${total} 人`;
}

// ---- 防止 XSS，小小 escape ----
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- 表單送出：行程 ----
tripForm.addEventListener("submit", (e) => {
  e.preventDefault();
  data.trip.title = document.getElementById("trip-title").value.trim();
  data.trip.date = document.getElementById("trip-date").value.trim();
  data.trip.location = document.getElementById("trip-location").value.trim();
  data.trip.note = document.getElementById("trip-note").value.trim();
  saveToStorage();
  renderTrip();
  alert("已儲存行程資訊！");
});

// ---- 表單送出：成員 ----
memberForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("member-name").value.trim();
  const count = Number(document.getElementById("member-count").value || 1);
  const phone = document.getElementById("member-phone").value.trim();
  const diet = document.getElementById("member-diet").value.trim();
  const note = document.getElementById("member-note").value.trim();

  if (!name) {
    alert("請輸入姓名");
    return;
  }

  data.members.push({ name, count, phone, diet, note });
  saveToStorage();
  renderMembers();

  memberForm.reset();
  document.getElementById("member-count").value = 1;
});

// ---- 點擊編輯 / 刪除 ----
memberTableBody.addEventListener("click", (e) => {
  const editIdx = e.target.getAttribute("data-edit");
  const delIdx = e.target.getAttribute("data-delete");

  if (editIdx !== null) {
    const m = data.members[editIdx];
    const newName = prompt("姓名", m.name);
    if (newName === null) return;
    const newCount = prompt("人數", m.count);
    if (newCount === null) return;
    const newPhone = prompt("電話", m.phone);
    if (newPhone === null) return;
    const newDiet = prompt("飲食／住宿需求", m.diet);
    if (newDiet === null) return;
    const newNote = prompt("備註", m.note);
    if (newNote === null) return;

    data.members[editIdx] = {
      name: newName.trim(),
      count: Number(newCount || 1),
      phone: newPhone.trim(),
      diet: newDiet.trim(),
      note: newNote.trim()
    };
    saveToStorage();
    renderMembers();
  }

  if (delIdx !== null) {
    if (confirm("確定要刪除這筆報名嗎？")) {
      data.members.splice(delIdx, 1);
      saveToStorage();
      renderMembers();
    }
  }
});

// ---- 匯出 JSON ----
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const title = data.trip.title || "family_trip";
  a.download = `${title.replace(/\s+/g, "_")}_data.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---- 匯入 JSON ----
importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON");
      }
      data = parsed;
      saveToStorage();
      renderTrip();
      renderMembers();
      alert("已匯入資料！");
    } catch (err) {
      console.error(err);
      alert("匯入失敗，請確認檔案內容。");
    }
  };
  reader.readAsText(file, "utf-8");
  // reset input
  e.target.value = "";
});

// ---- 清空本機資料 ----
clearBtn.addEventListener("click", () => {
  if (confirm("確定要清空本機所有行程與報名資料嗎？（不會影響 GitHub 上的備份檔）")) {
    localStorage.removeItem(STORAGE_KEY);
    data = { trip: { title: "", date: "", location: "", note: "" }, members: [] };
    renderTrip();
    renderMembers();
  }
});
// ===============================
// 記帳資料結構
// ===============================
if (!data.expenses) data.expenses = [];

// 重新渲染付款人下拉選單 + 分帳成員 checkbox
function renderExpenseMembers() {
  const payerSelect = document.getElementById("exp-payer");
  const membersBox = document.getElementById("exp-members");

  payerSelect.innerHTML = "";
  membersBox.innerHTML = "";

  data.members.forEach((m, idx) => {
    // payer
    const option = document.createElement("option");
    option.value = idx;
    option.textContent = m.name;
    payerSelect.appendChild(option);

    // checkbox list
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = idx;

    label.appendChild(cb);
    label.append(" " + m.name);
    membersBox.appendChild(label);
  });
}

// ===============================
// 新增記帳
// ===============================
document.getElementById("expense-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("exp-name").value.trim();
  const amount = Number(document.getElementById("exp-amount").value);
  const payerIndex = Number(document.getElementById("exp-payer").value);
  
  const selectedMembers = Array.from(
    document.querySelectorAll("#exp-members input:checked")
  ).map(cb => Number(cb.value));

  if (selectedMembers.length === 0) {
    alert("請至少選擇一位需要分帳的成員");
    return;
  }

  const expense = {
    name,
    amount,
    payer: payerIndex,
    members: selectedMembers
  };

  data.expenses.push(expense);
  saveToStorage();
  renderExpenses();
  renderSettlement();

  e.target.reset();
  renderExpenseMembers();
});

// ===============================
// 顯示記帳紀錄
// ===============================
function renderExpenses() {
  const tbody = document.querySelector("#expense-table tbody");
  tbody.innerHTML = "";

  data.expenses.forEach((exp) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${exp.name}</td>
      <td>${exp.amount}</td>
      <td>${data.members[exp.payer].name}</td>
      <td>${exp.members.map(i => data.members[i].name).join(", ")}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// 結算（誰欠誰）
// ===============================
function renderSettlement() {
  const result = {}; // money[payer] + / - 
  
  // 初始化所有人
  data.members.forEach((m, i) => {
    result[i] = 0;
  });

  // 計算每筆消費
  data.expenses.forEach(exp => {
    const share = exp.amount / exp.members.length;

    exp.members.forEach(i => {
      if (i === exp.payer) return;  
      result[i] -= share;
      result[exp.payer] += share;
    });
  });

  // 顯示
  const list = document.getElementById("settlement-list");
  list.innerHTML = "";

  data.members.forEach((m, i) => {
    if (Math.abs(result[i]) > 1) {
      const li = document.createElement("li");
      li.textContent = `${m.name}：${result[i] > 0 ? "應收" : "應付"} ${Math.abs(result[i]).toFixed(0)} 元`;
      list.appendChild(li);
    }
  });
}

// ===============================
// 初始化：順序很重要！！！
// ===============================
loadFromStorage();        // 1. 先載入所有舊資料（members, expenses）

renderExpenseMembers();   // 2. 再渲染付款人選單 & checkbox
renderExpenses();         // 3. 渲染記帳紀錄
renderSettlement();       // 4. 渲染自動結算
