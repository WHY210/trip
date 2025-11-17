// =========================================================
// Local Storage Key
// =========================================================
const STORAGE_KEY = "familyTripData_v2";

// =========================================================
// 全域資料結構
// =========================================================
let data = {
  trip: { title: "", date: "", location: "", note: "" },
  members: [],        // {name, count, phone, note, color}
  expenses: [],       // {name, amount, payer, members[]}
  days: []            // [{ title: "Day 1", activities: [ {time,title,location,link, attendees:{memberIndex:true/false}} ] }]
};

// =========================================================
// DOM
// =========================================================
const tripForm = document.getElementById("trip-form");
const tripDisplay = document.getElementById("trip-display");

const memberForm = document.getElementById("member-form");
const memberTableBody = document.querySelector("#member-table tbody");
const totalMembersSpan = document.getElementById("total-members");

const daySelect = document.getElementById("day-select");
const daysContainer = document.getElementById("days-container");

const expForm = document.getElementById("expense-form");
const expPayerSelect = document.getElementById("exp-payer");
const expMembersBox = document.getElementById("exp-members");

const exportBtn = document.getElementById("export-json");
const importInput = document.getElementById("import-json");
const clearBtn = document.getElementById("clear-data");

// =========================================================
// Utils
// =========================================================
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Load failed", e);
  }
}

// Escape for safety
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

// 取得姓名縮寫（第一個字母）
function initial(name) {
  if (!name) return "?";
  return name.trim()[0].toUpperCase();
}

// =========================================================
// 渲染：行程資訊
// =========================================================
function renderTrip() {
  const t = data.trip;

  document.getElementById("trip-title").value = t.title;
  document.getElementById("trip-date").value = t.date;
  document.getElementById("trip-location").value = t.location;
  document.getElementById("trip-note").value = t.note;

  if (!t.title && !t.date && !t.location && !t.note) {
    tripDisplay.innerHTML = `<span class="hint">尚未設定行程。</span>`;
    return;
  }

  tripDisplay.innerHTML = `
    <strong>行程摘要：</strong><br>
    ${t.title ? `💡<b>${esc(t.title)}</b><br>` : ""}
    ${t.date ? `📅 ${esc(t.date)}<br>` : ""}
    ${t.location ? `📍 ${esc(t.location)}<br>` : ""}
    ${t.note ? `📝 ${esc(t.note).replace(/\n/g, "<br>")}` : ""}
  `;
}

// =========================================================
// 渲染：家族成員
// =========================================================
function renderMembers() {
  memberTableBody.innerHTML = "";
  let total = 0;

  data.members.forEach((m, idx) => {
    total += Number(m.count || 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${esc(m.name)}</td>
      <td>${m.count}</td>
      <td><div style="width:16px;height:16px;border-radius:50%;background:${m.color};"></div></td>
      <td>${esc(m.phone)}</td>
      <td>${esc(m.note)}</td>
      <td>
        <button class="btn small secondary" data-edit="${idx}">編輯</button>
        <button class="btn small danger" data-del="${idx}">刪除</button>
      </td>
    `;
    memberTableBody.appendChild(tr);
  });

  totalMembersSpan.textContent = `總人數：${total} 人`;

  renderExpenseMembers();
  renderAllDays(); // 成員變動，行程參加者顯示要重畫
}

// =========================================================
// 渲染：記帳用成員
// =========================================================
function renderExpenseMembers() {
  expPayerSelect.innerHTML = "";
  expMembersBox.innerHTML = "";

  data.members.forEach((m, idx) => {
    let op = document.createElement("option");
    op.value = idx;
    op.textContent = m.name;
    expPayerSelect.appendChild(op);

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = idx;

    label.appendChild(cb);
    label.append(" " + m.name);

    expMembersBox.appendChild(label);
  });
}

// =========================================================
// 成員新增 / 編輯 / 刪除
// =========================================================
memberForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("member-name").value.trim();
  if (!name) return;

  const m = {
    name,
    count: Number(document.getElementById("member-count").value || 1),
    color: document.getElementById("member-color").value || "#888",
    phone: document.getElementById("member-phone").value,
    note: document.getElementById("member-note").value
  };

  data.members.push(m);
  save();
  renderMembers();
  memberForm.reset();
  document.getElementById("member-count").value = 1;
});

memberTableBody.addEventListener("click", (e) => {
  const editIdx = e.target.getAttribute("data-edit");
  const delIdx = e.target.getAttribute("data-del");

  // 編輯
  if (editIdx !== null) {
    const m = data.members[editIdx];

    const newName = prompt("姓名", m.name);
    if (newName === null) return;

    const newColor = prompt("顏色（#FF8800 或任何字串）", m.color);
    if (newColor === null) return;

    m.name = newName;
    m.color = newColor;

    save();
    renderMembers();
  }

  // 刪除
  if (delIdx !== null) {
    if (confirm("確定刪除？")) {
      data.members.splice(delIdx, 1);
      save();
      renderMembers();
    }
  }
});

// =========================================================
// Trip Form
// =========================================================
tripForm.addEventListener("submit", (e) => {
  e.preventDefault();
  data.trip.title = document.getElementById("trip-title").value;
  data.trip.date = document.getElementById("trip-date").value;
  data.trip.location = document.getElementById("trip-location").value;
  data.trip.note = document.getElementById("trip-note").value;

  save();
  renderTrip();
  alert("已儲存！");
});

// =========================================================
// 多日行程：Day 管理
// =========================================================
function renderDaySelect() {
  daySelect.innerHTML = "";
  data.days.forEach((d, idx) => {
    const op = document.createElement("option");
    op.value = idx;
    op.textContent = d.title;
    daySelect.appendChild(op);
  });
}

document.getElementById("new-day").addEventListener("click", () => {
  const title = `Day ${data.days.length + 1}`;
  data.days.push({ title, activities: [] });
  save();
  renderDaySelect();
  renderAllDays();
});

// =========================================================
// 新增活動
// =========================================================
document.getElementById("add-activity").addEventListener("click", () => {
  const dayIdx = Number(daySelect.value);
  if (isNaN(dayIdx)) return alert("請先新增一天行程");

  const time = document.getElementById("act-time").value;
  const title = document.getElementById("act-title").value.trim();
  const location = document.getElementById("act-location").value.trim();
  const link = document.getElementById("act-link").value.trim();

  if (!title) return alert("請輸入行程名稱");

  const attendees = {};
  data.members.forEach((m, idx) => attendees[idx] = false);

  data.days[dayIdx].activities.push({
    time, title, location, link, attendees
  });

  save();
  renderAllDays();

  document.getElementById("act-title").value = "";
  document.getElementById("act-time").value = "";
  document.getElementById("act-location").value = "";
  document.getElementById("act-link").value = "";
});

// =========================================================
// 渲染全部日程
// =========================================================
function renderAllDays() {
  daysContainer.innerHTML = "";

  data.days.forEach((d, dayIdx) => {
    const card = document.createElement("div");
    card.className = "day-card";

    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = d.title;

    const content = document.createElement("div");
    content.className = "day-content";

    // 每個活動
    d.activities.forEach((a, actIdx) => {
      const div = document.createElement("div");
      div.className = "activity";

      div.innerHTML = `
        <div class="activity-time">${esc(a.time)}</div>
        <div class="activity-title">${esc(a.title)}</div>
        <div class="activity-location">${esc(a.location)}</div>
        ${a.link ? `<a href="${esc(a.link)}" target="_blank">🔗 地圖</a>` : ""}
      `;

      // 參加者
      const attendeeBox = document.createElement("div");
      attendeeBox.className = "attendees";

      data.members.forEach((m, memIdx) => {
        const dot = document.createElement("div");
        dot.className = "dot " + (a.attendees[memIdx] ? "" : "off");
        dot.style.background = m.color || "#999";
        dot.textContent = initial(m.name);

        dot.addEventListener("click", () => {
          a.attendees[memIdx] = !a.attendees[memIdx];
          save();
          renderAllDays();
        });

        attendeeBox.appendChild(dot);
      });

      div.appendChild(attendeeBox);
      content.appendChild(div);
    });

    header.addEventListener("click", () => {
      content.classList.toggle("open");
    });

    card.appendChild(header);
    card.appendChild(content);
    daysContainer.appendChild(card);
  });

  renderDaySelect();
}

// =========================================================
// 記帳功能
// =========================================================
expForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("exp-name").value.trim();
  const amount = Number(document.getElementById("exp-amount").value);
  const payer = Number(expPayerSelect.value);

  const members = Array.from(
    expMembersBox.querySelectorAll("input:checked")
  ).map(cb => Number(cb.value));

  if (!name) return alert("請輸入消費名稱");
  if (!members.length) return alert("至少要 1 位參與者");

  data.expenses.push({ name, amount, payer, members });
  save();
  renderExpenses();
  renderSettlement();

  expForm.reset();
  renderExpenseMembers();
});

function renderExpenses() {
  const tbody = document.querySelector("#expense-table tbody");
  tbody.innerHTML = "";

  data.expenses.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(e.name)}</td>
      <td>${e.amount}</td>
      <td>${esc(data.members[e.payer]?.name || "已刪除")}</td>
      <td>${e.members.map(i => esc(data.members[i]?.name || "已刪除")).join(", ")}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSettlement() {
  const list = document.getElementById("settlement-list");
  list.innerHTML = "";

  const balance = {};
  data.members.forEach((_, idx) => balance[idx] = 0);

  data.expenses.forEach((e) => {
    const share = e.amount / e.members.length;
    e.members.forEach((i) => {
      if (i === e.payer) return;
      balance[i] -= share;
      balance[e.payer] += share;
    });
  });

  data.members.forEach((m, idx) => {
    if (Math.abs(balance[idx]) > 1) {
      const li = document.createElement("li");
      li.textContent = `${m.name}：${balance[idx] > 0 ? "應收" : "應付"} ${Math.abs(balance[idx]).toFixed(0)} 元`;
      list.appendChild(li);
    }
  });
}

// =========================================================
// 匯入 / 匯出 / 清除
// =========================================================
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "family_trip.json";
  a.click();
});

importInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      data = JSON.parse(ev.target.result);
      save();
      initialize();
      alert("匯入成功！");
    } catch (err) {
      alert("匯入失敗");
    }
  };
  reader.readAsText(f, "utf-8");
});

clearBtn.addEventListener("click", () => {
  if (confirm("確定清除所有資料？")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

// =========================================================
// 初始化
// =========================================================
function initialize() {
  load();
  renderTrip();
  renderMembers();
  renderExpenseMembers();
  renderExpenses();
  renderSettlement();
  renderAllDays();
}
initialize();
