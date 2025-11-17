// =========================================================
// Local Storage Key
// =========================================================
const STORAGE_KEY = "familyTripV3";

// =========================================================
// 全域資料結構
// =========================================================
let data = {
  trip: { title: "", date: "", location: "", note: "" },
  members: [],     // { name, color, phone, note }
  days: [],        // [ { title, activities: [ {time,title,location,link, attendees:{index:true/false}} ] } ]
  expenses: []     // { name, amount, payer, members[] }
};

// =========================================================
// DOM 取得
// =========================================================

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const pages = document.querySelectorAll(".page");

// Trip page
const tripForm = document.getElementById("trip-form");
const tripDisplay = document.getElementById("trip-display");

// Days & activities
const newDayBtn = document.getElementById("new-day");
const daySelect = document.getElementById("day-select");
const addActivityBtn = document.getElementById("add-activity");
const daysContainer = document.getElementById("days-container");

// Members page
const memberForm = document.getElementById("member-form");
const memberTableBody = document.querySelector("#member-table tbody");
const totalMembers = document.getElementById("total-members");

// Expenses page
const expForm = document.getElementById("expense-form");
const expPayer = document.getElementById("exp-payer");
const expMembersBox = document.getElementById("exp-members");
const expTableBody = document.querySelector("#expense-table tbody");
const settlementList = document.getElementById("settlement-list");

// =========================================================
// Utils
// =========================================================
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    console.error("JSON parse error", e);
  }
}

function esc(str = "") {
  return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function initial(name) {
  return name ? name.trim()[0].toUpperCase() : "?";
}

// =========================================================
// Tab Navigation
// =========================================================
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.page).classList.add("active");

    save();
  });
});

// =========================================================
// Trip Info (基本行程資訊)
// =========================================================
function renderTrip() {
  const t = data.trip;

  document.getElementById("trip-title").value = t.title;
  document.getElementById("trip-date").value = t.date;
  document.getElementById("trip-location").value = t.location;
  document.getElementById("trip-note").value = t.note;

  if (!t.title && !t.date && !t.location && !t.note) {
    tripDisplay.innerHTML = "<span class='hint'>尚未設定行程資訊。</span>";
    return;
  }

  tripDisplay.innerHTML = `
    <strong>行程摘要：</strong><br>
    ${t.title ? `💡 <b>${esc(t.title)}</b><br>` : ""}
    ${t.date ? `📅 ${esc(t.date)}<br>` : ""}
    ${t.location ? `📍 ${esc(t.location)}<br>` : ""}
    ${t.note ? `📝 ${esc(t.note).replace(/\n/g, "<br>")}` : ""}
  `;
}

tripForm.addEventListener("submit", (e) => {
  e.preventDefault();
  data.trip.title = document.getElementById("trip-title").value;
  data.trip.date = document.getElementById("trip-date").value;
  data.trip.location = document.getElementById("trip-location").value;
  data.trip.note = document.getElementById("trip-note").value;
  save();
  renderTrip();
  alert("已儲存行程資訊！");
});

// =========================================================
// 成員管理
// =========================================================
function renderMembers() {
  memberTableBody.innerHTML = "";
  totalMembers.textContent = `總人數：${data.members.length} 人`;

  data.members.forEach((m, idx) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${esc(m.name)}</td>
      <td><div style="width:18px;height:18px;border-radius:50%;background:${m.color};"></div></td>
      <td>${esc(m.phone)}</td>
      <td>${esc(m.note)}</td>
      <td>
        <button class="btn small secondary" data-edit="${idx}">編輯</button>
        <button class="btn small danger" data-del="${idx}">刪除</button>
      </td>
    `;
    memberTableBody.appendChild(tr);
  });

  renderExpenseMembers();
  renderAllDays();
}

memberForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const m = {
    name: document.getElementById("member-name").value.trim(),
    color: document.getElementById("member-color").value.trim() || "#888",
    phone: document.getElementById("member-phone").value.trim(),
    note: document.getElementById("member-note").value.trim()
  };

  if (!m.name) return alert("請輸入姓名");

  data.members.push(m);
  save();
  renderMembers();
  memberForm.reset();
});

memberTableBody.addEventListener("click", (e) => {
  const del = e.target.getAttribute("data-del");
  const edit = e.target.getAttribute("data-edit");

  if (del !== null) {
    if (confirm("確定刪除？")) {
      data.members.splice(del, 1);
      save();
      renderMembers();
    }
  }

  if (edit !== null) {
    const m = data.members[edit];
    const newName = prompt("姓名", m.name);
    if (newName === null) return;
    const newColor = prompt("顏色（#ff8800）", m.color);
    if (newColor === null) return;
    m.name = newName;
    m.color = newColor;
    save();
    renderMembers();
  }
});

// =========================================================
// 新增天數 Day
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

newDayBtn.addEventListener("click", () => {
  const title = `Day ${data.days.length + 1}`;
  data.days.push({ title, activities: [] });
  save();
  renderDaySelect();
  renderAllDays();
});

// =========================================================
// 新增活動 Activity
// =========================================================
addActivityBtn.addEventListener("click", () => {
  const dayIdx = Number(daySelect.value);
  if (isNaN(dayIdx)) return alert("請先新增一天 Day");

  const time = document.getElementById("act-time").value;
  const title = document.getElementById("act-title").value.trim();
  const location = document.getElementById("act-location").value.trim();
  const link = document.getElementById("act-link").value.trim();

  if (!title) return alert("請輸入活動名稱");

  const attendees = {};
  data.members.forEach((_, i) => attendees[i] = false);

  data.days[dayIdx].activities.push({ time, title, location, link, attendees });

  save();
  renderAllDays();

  document.getElementById("act-title").value = "";
  document.getElementById("act-time").value = "";
  document.getElementById("act-location").value = "";
  document.getElementById("act-link").value = "";
});

// =========================================================
// 顯示全部 Day + Activity
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

    // 活動列表
    d.activities.forEach((a, actIdx) => {
      const act = document.createElement("div");
      act.className = "activity";

      act.innerHTML = `
        <div class="activity-time">${esc(a.time)}</div>
        <div class="activity-title">${esc(a.title)}</div>
        <div class="activity-location">${esc(a.location)}</div>
        ${
          a.link
          ? `<a href="${esc(a.link)}" target="_blank">🔗 地圖</a>`
          : ""
        }
      `;

      // 參加者 dots
      const box = document.createElement("div");
      box.className = "attendees";

      data.members.forEach((m, memIdx) => {
        const dot = document.createElement("div");
        dot.className = "dot " + (a.attendees[memIdx] ? "" : "off");
        dot.style.background = m.color;
        dot.textContent = initial(m.name);

        dot.addEventListener("click", () => {
          a.attendees[memIdx] = !a.attendees[memIdx];
          save();
          renderAllDays();
        });

        box.appendChild(dot);
      });

      act.appendChild(box);
      content.appendChild(act);
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
// 記帳（Expenses）
// =========================================================
function renderExpenseMembers() {
  expPayer.innerHTML = "";
  expMembersBox.innerHTML = "";

  data.members.forEach((m, idx) => {
    const op = document.createElement("option");
    op.value = idx;
    op.textContent = m.name;
    expPayer.appendChild(op);

    const lb = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = idx;

    lb.appendChild(cb);
    lb.append(" " + m.name);

    expMembersBox.appendChild(lb);
  });
}

expForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("exp-name").value.trim();
  const amount = Number(document.getElementById("exp-amount").value);
  const payer = Number(expPayer.value);
  const members = Array.from(expMembersBox.querySelectorAll("input:checked"))
    .map(cb => Number(cb.value));

  if (!name || !amount) return alert("請輸入名稱與金額");
  if (!members.length) return alert("至少選 1 個分帳人");

  data.expenses.push({ name, amount, payer, members });
  save();
  renderExpenses();
  renderSettlement();
  expForm.reset();
  renderExpenseMembers();
});

function renderExpenses() {
  expTableBody.innerHTML = "";
  data.expenses.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(e.name)}</td>
      <td>${e.amount}</td>
      <td>${esc(data.members[e.payer]?.name || "已刪除")}</td>
      <td>${e.members.map(i => esc(data.members[i]?.name || "已刪除")).join(", ")}</td>
    `;
    expTableBody.appendChild(tr);
  });
}

function renderSettlement() {
  settlementList.innerHTML = "";
  const balance = {};

  data.members.forEach((_, i) => balance[i] = 0);

  data.expenses.forEach((e) => {
    const share = e.amount / e.members.length;
    e.members.forEach((i) => {
      if (i === e.payer) return;
      balance[i] -= share;
      balance[e.payer] += share;
    });
  });

  data.members.forEach((m, i) => {
    if (Math.abs(balance[i]) > 1) {
      const li = document.createElement("li");
      li.textContent = `${m.name}：${balance[i] > 0 ? "應收" : "應付"} ${Math.abs(balance[i]).toFixed(0)} 元`;
      settlementList.appendChild(li);
    }
  });
}

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
