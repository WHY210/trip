// ========================================================
// Local Storage Key
// ========================================================
const STORAGE_KEY = "familyTripData_v1";

// ========================================================
// DOM Elements
// ========================================================
const tripForm = document.getElementById("trip-form");
const memberForm = document.getElementById("member-form");
const tripDisplay = document.getElementById("trip-display");
const memberTableBody = document.querySelector("#member-table tbody");
const totalMembersSpan = document.getElementById("total-members");
const exportBtn = document.getElementById("export-json");
const importInput = document.getElementById("import-json");
const clearBtn = document.getElementById("clear-data");

// 行程 DOM
const addDayBtn = document.getElementById("add-day-btn");
const activityForm = document.getElementById("activity-form");
const activityDaySelect = document.getElementById("activity-day");
const activityTimeInput = document.getElementById("activity-time");
const activityTitleInput = document.getElementById("activity-title");
const activityLocationInput = document.getElementById("activity-location");
const activityLinkInput = document.getElementById("activity-link");
const daysContainer = document.getElementById("days-container");

// 記帳 DOM
const expenseForm = document.getElementById("expense-form");
const expensePayerSelect = document.getElementById("exp-payer");
const expenseMembersBox = document.getElementById("exp-members");

// ========================================================
// Data Structure
// ========================================================
let data = {
  trip: { title: "", date: "", location: "", note: "" },
  members: [],        // {name, count, phone, diet, note, color}
  expenses: [],       // {name, amount, payer, members}
  days: []            // {id, label, activities: [{time,title,location,link,attendees:[]}]}
};

// ========================================================
// Helper: Default Colors
// ========================================================
const COLOR_PALETTE = [
  "#f97316", "#3b82f6", "#10b981",
  "#ec4899", "#a855f7", "#facc15",
  "#ef4444", "#0ea5e9", "#22c55e"
];

// ========================================================
// Load Data from LocalStorage
// ========================================================
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

  // 安全補齊缺的欄位
  if (!data.trip) data.trip = { title: "", date: "", location: "", note: "" };
  if (!Array.isArray(data.members)) data.members = [];
  if (!Array.isArray(data.expenses)) data.expenses = [];
  if (!Array.isArray(data.days)) data.days = [];

  // 舊資料沒有 color 的成員幫他補顏色
  let colorIndex = 0;
  data.members.forEach(m => {
    if (!m.color) {
      m.color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      colorIndex++;
    }
  });

  // 如果還沒有任何 Day，就建一個 Day 1
  if (data.days.length === 0) {
    createNewDay();
  }
}

// ========================================================
// Save Data
// ========================================================
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ========================================================
// Escape HTML
// ========================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ========================================================
// Render Trip Info
// ========================================================
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

// ========================================================
// Render Members
// ========================================================
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
      <td><span class="member-color-dot" style="background:${m.color || "#9ca3af"}"></span></td>
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

  // 成員變動 → 更新記帳 & 行程顯示
  renderExpenseMembers();
  renderDays();
}

// ========================================================
// Trip Form Submit
// ========================================================
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

// ========================================================
// Member Form Submit
// ========================================================
memberForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("member-name").value.trim();
  const count = Number(document.getElementById("member-count").value || 1);
  const phone = document.getElementById("member-phone").value.trim();
  const diet = document.getElementById("member-diet").value.trim();
  const note = document.getElementById("member-note").value.trim();
  const color = document.getElementById("member-color").value || COLOR_PALETTE[0];

  if (!name) {
    alert("請輸入姓名");
    return;
  }

  data.members.push({ name, count, phone, diet, note, color });
  saveToStorage();
  renderMembers();

  memberForm.reset();
  document.getElementById("member-count").value = 1;
  document.getElementById("member-color").value = "#f97316";
});

// ========================================================
// Edit/Delete Member
// ========================================================
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
      ...m,
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

// ========================================================
// Export / Import / Clear
// ========================================================
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const title = data.trip.title || "family_trip";
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}_data.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      data = parsed;
      // 安全補欄位
      if (!Array.isArray(data.members)) data.members = [];
      if (!Array.isArray(data.expenses)) data.expenses = [];
      if (!Array.isArray(data.days)) data.days = [];
      let idx = 0;
      data.members.forEach(m => {
        if (!m.color) {
          m.color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
          idx++;
        }
      });
      if (data.days.length === 0) createNewDay();

      saveToStorage();
      renderTrip();
      renderMembers();
      renderExpenseMembers();
      renderExpenses();
      renderSettlement();
      renderDayOptions();
      renderDays();

      alert("已匯入資料！");
    } catch (err) {
      console.error(err);
      alert("匯入失敗，請確認檔案內容。");
    }
  };
  reader.readAsText(file, "utf-8");
  e.target.value = "";
});

clearBtn.addEventListener("click", () => {
  if (confirm("確定要清空所有資料？")) {
    localStorage.removeItem(STORAGE_KEY);
    data = {
      trip: { title: "", date: "", location: "", note: "" },
      members: [],
      expenses: [],
      days: []
    };
    createNewDay();
    renderTrip();
    renderMembers();
    renderExpenseMembers();
    renderExpenses();
    renderSettlement();
    renderDayOptions();
    renderDays();
  }
});

// ========================================================
// 行程：Day 建立與渲染
// ========================================================
function createNewDay() {
  const index = data.days.length + 1;
  const day = {
    id: `day-${index}`,
    label: `Day ${index}`,
    activities: []
  };
  data.days.push(day);
  saveToStorage();
}

function renderDayOptions() {
  activityDaySelect.innerHTML = "";
  data.days.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = d.label;
    activityDaySelect.appendChild(opt);
  });
}

// 多日行程列表
function renderDays() {
  daysContainer.innerHTML = "";

  data.days.forEach((day, dayIndex) => {
    const block = document.createElement("div");
    block.className = "day-block open"; // 一開始全部展開

    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `
      <span>${day.label}</span>
      <small>共 ${day.activities.length} 個活動</small>
    `;
    header.dataset.dayIndex = dayIndex;

    const body = document.createElement("div");
    body.className = "day-body";

    const table = document.createElement("table");
    table.className = "activity-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>時間</th>
          <th>行程</th>
          <th>地點 / 連結</th>
          <th>參加成員（點彩色點勾選）</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    day.activities.forEach((act, actIndex) => {
      const tr = document.createElement("tr");

      const timeTd = document.createElement("td");
      timeTd.textContent = act.time || "";

      const titleTd = document.createElement("td");
      titleTd.textContent = act.title || "";

      const locTd = document.createElement("td");
      const lines = [];
      if (act.location) lines.push(escapeHtml(act.location));
      if (act.link) {
        lines.push(
          `<a href="${escapeHtml(act.link)}" target="_blank" rel="noopener noreferrer" class="activity-link">開啟地圖</a>`
        );
      }
      locTd.innerHTML = lines.join("<br>");

      const memberTd = document.createElement("td");
      const dotsDiv = document.createElement("div");
      dotsDiv.className = "member-dots";

      data.members.forEach((m, memIndex) => {
        const dot = document.createElement("span");
        dot.className = "member-dot";
        const joined = Array.isArray(act.attendees) && act.attendees.includes(memIndex);

        dot.style.backgroundColor = joined ? (m.color || "#9ca3af") : "transparent";
        dot.style.borderColor = m.color || "#9ca3af";
        if (!joined) dot.classList.add("inactive");

        dot.title = m.name;
        dot.dataset.dayIndex = dayIndex;
        dot.dataset.activityIndex = actIndex;
        dot.dataset.memberIndex = memIndex;

        dotsDiv.appendChild(dot);
      });

      memberTd.appendChild(dotsDiv);

      tr.appendChild(timeTd);
      tr.appendChild(titleTd);
      tr.appendChild(locTd);
      tr.appendChild(memberTd);
      tbody.appendChild(tr);
    });

    body.appendChild(table);
    block.appendChild(header);
    block.appendChild(body);
    daysContainer.appendChild(block);
  });
}

// 手風琴展開收合 + 點小圓點
daysContainer.addEventListener("click", (e) => {
  // day header toggle
  if (e.target.classList.contains("day-header") || e.target.closest(".day-header")) {
    const header = e.target.closest(".day-header");
    const block = header.parentElement;
    block.classList.toggle("open");
    return;
  }

  // 點擊小圓點
  if (e.target.classList.contains("member-dot")) {
    const dot = e.target;
    const dayIndex = Number(dot.dataset.dayIndex);
    const activityIndex = Number(dot.dataset.activityIndex);
    const memberIndex = Number(dot.dataset.memberIndex);

    const act = data.days[dayIndex].activities[activityIndex];
    if (!Array.isArray(act.attendees)) act.attendees = [];

    const idx = act.attendees.indexOf(memberIndex);
    if (idx === -1) {
      act.attendees.push(memberIndex);
    } else {
      act.attendees.splice(idx, 1);
    }

    saveToStorage();
    renderDays();
  }
});

// 新增 Day 按鈕
addDayBtn.addEventListener("click", () => {
  createNewDay();
  saveToStorage();
  renderDayOptions();
  renderDays();
});

// 新增活動
activityForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const dayIndex = Number(activityDaySelect.value);
  if (isNaN(dayIndex) || dayIndex < 0 || dayIndex >= data.days.length) {
    alert("請先建立或選擇一天行程");
    return;
  }

  const title = activityTitleInput.value.trim();
  const time = activityTimeInput.value.trim();
  const location = activityLocationInput.value.trim();
  const link = activityLinkInput.value.trim();

  if (!title) {
    alert("請輸入行程名稱");
    return;
  }

  const activity = {
    time,
    title,
    location,
    link,
    attendees: []
  };

  data.days[dayIndex].activities.push(activity);
  saveToStorage();
  renderDays();

  activityForm.reset();
  renderDayOptions();
});

// ========================================================
// 記帳：成員 Checkbox + Payer Select
// ========================================================
function renderExpenseMembers() {
  expensePayerSelect.innerHTML = "";
  expenseMembersBox.innerHTML = "";

  data.members.forEach((m, idx) => {
    // 付款人下拉
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = m.name;
    expensePayerSelect.appendChild(opt);

    // 分帳成員 checkbox
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = idx;
    lbl.appendChild(cb);
    lbl.append(" " + m.name);
    expenseMembersBox.appendChild(lbl);
  });
}

// ========================================================
// 記帳：新增消費
// ========================================================
expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("exp-name").value.trim();
  const amount = Number(document.getElementById("exp-amount").value);
  const payerIndex = Number(document.getElementById("exp-payer").value);

  const selectedMembers = Array.from(
    document.querySelectorAll("#exp-members input:checked")
  ).map(cb => Number(cb.value));

  if (!name) {
    alert("請輸入消費名稱");
    return;
  }
  if (!amount || amount <= 0) {
    alert("請輸入正確的金額");
    return;
  }
  if (selectedMembers.length === 0) {
    alert("請至少選擇一位需要分帳的成員");
    return;
  }

  const expense = { name, amount, payer: payerIndex, members: selectedMembers };
  data.expenses.push(expense);
  saveToStorage();
  renderExpenses();
  renderSettlement();

  expenseForm.reset();
  renderExpenseMembers();
});

// ========================================================
// 記帳：顯示紀錄
// ========================================================
function renderExpenses() {
  const tbody = document.querySelector("#expense-table tbody");
  tbody.innerHTML = "";

  data.expenses.forEach((exp) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${exp.name}</td>
      <td>${exp.amount}</td>
      <td>${data.members[exp.payer]?.name || "已刪除"}</td>
      <td>${exp.members.map(i => data.members[i]?.name || "已刪除").join(", ")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ========================================================
// 記帳：結算（誰欠誰）
// ========================================================
function renderSettlement() {
  const result = {};
  data.members.forEach((m, i) => (result[i] = 0));

  data.expenses.forEach(exp => {
    if (!exp.members || exp.members.length === 0) return;
    const share = exp.amount / exp.members.length;
    exp.members.forEach(i => {
      if (i === exp.payer) return;
      result[i] -= share;
      result[exp.payer] += share;
    });
  });

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

// ========================================================
// Initialization
// ========================================================
loadFromStorage();
renderTrip();
renderMembers();
renderExpenseMembers();
renderExpenses();
renderSettlement();
renderDayOptions();
renderDays();
