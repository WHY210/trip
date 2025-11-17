/* ======================================================
   Trip Planner v4 - Full Application Logic (Pure JS)
   - Members
   - Expenses
   - Schedule
   - Settlement
   - Split Pane (Left-Top / Left-Bottom)
   - LocalStorage State
====================================================== */

const STORAGE_KEY = "trip_planner_v4_state";

/* -----------------------
   Load / Save STATE
----------------------- */
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    members: [],
    schedules: [],
    expenses: [],
    settings: {
      rateJPY: 0.22,
      rateKRW: 0.024
    }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* -----------------------
   Utility
----------------------- */
function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function findMember(id) {
  return state.members.find((m) => m.id === id);
}

function dateLabel(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  const w = "日一二三四五六".charAt(dt.getDay());
  return `${d}（${w}）`;
}

/* -----------------------
   DOM Elements
----------------------- */

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  initForms();
  initSplitter();
  renderAll();
});

/* --- Cache DOM --- */
const dom = {};

function cacheDom() {
  // members
  dom.memberForm = document.getElementById("member-form");
  dom.memberName = document.getElementById("member-name");
  dom.memberShort = document.getElementById("member-short");
  dom.memberColor = document.getElementById("member-color");
  dom.memberNote = document.getElementById("member-note");
  dom.memberList = document.getElementById("member-list");

  // expenses
  dom.rateJPY = document.getElementById("rate-jpy");
  dom.rateKRW = document.getElementById("rate-krw");
  dom.saveRates = document.getElementById("save-rates");

  dom.expenseForm = document.getElementById("expense-form");
  dom.expenseDate = document.getElementById("expense-date");
  dom.expenseAmount = document.getElementById("expense-amount");
  dom.expenseCurrency = document.getElementById("expense-currency");
  dom.expenseRate = document.getElementById("expense-rate");
  dom.expenseTitle = document.getElementById("expense-title");
  dom.expensePayer = document.getElementById("expense-payer");
  dom.expenseMembers = document.getElementById("expense-members");
  dom.expenseList = document.getElementById("expense-list");
  dom.balanceSummary = document.getElementById("balance-summary");
  dom.pairwiseList = document.getElementById("pairwise-list");

  // schedule
  dom.scheduleForm = document.getElementById("schedule-form");
  dom.scheduleDate = document.getElementById("schedule-date");
  dom.scheduleTime = document.getElementById("schedule-time");
  dom.scheduleTitle = document.getElementById("schedule-title");
  dom.scheduleLocation = document.getElementById("schedule-location");
  dom.scheduleMembers = document.getElementById("schedule-members");
  dom.scheduleList = document.getElementById("schedule-list");

  // splitter
  dom.splitter = document.getElementById("splitter");
  dom.leftPane = document.querySelector(".left-pane");
}

/* -----------------------
   INIT Forms
----------------------- */

function initForms() {
  /* --- Member Form --- */
  dom.memberForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = dom.memberName.value.trim();
    const short = dom.memberShort.value.trim() || name.charAt(0);
    const note = dom.memberNote.value.trim();
    const colorId = dom.memberColor.value || null;

    // generate default Pastel colors
    const colors = [
      "#9AA7B1", "#A8B5A2", "#DACFC4", "#C7A0A7",
      "#C7CED5", "#B9C4A7", "#C7BEDD", "#B8A19A",
      "#C8D9C2", "#8FA2B5"
    ];

    const id = genId("m");
    const color = colorId ? colorId : colors[state.members.length % colors.length];

    state.members.push({
      id,
      name,
      short,
      note,
      colorHex: color
    });

    saveState();
    dom.memberForm.reset();
    renderAll();
  });

  /* --- Expense Form --- */
  dom.expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const amount = parseFloat(dom.expenseAmount.value);
    const rate = parseFloat(dom.expenseRate.value);
    const currency = dom.expenseCurrency.value;
    const date = dom.expenseDate.value;
    const title = dom.expenseTitle.value.trim();
    const payerId = dom.expensePayer.value || null;

    const members = Array.from(dom.expenseMembers.querySelectorAll("input[type=checkbox]:checked"))
      .map((c) => c.value);

    if (!amount || amount <= 0) return alert("金額不正確");
    if (!members.length) return alert("請勾選分攤成員");

    state.expenses.push({
      id: genId("e"),
      date,
      amount,
      currency,
      rate,
      title,
      payerId,
      memberIds: members
    });

    saveState();
    dom.expenseForm.reset();
    renderAll();
  });

  /* --- Schedule Form --- */
  dom.scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = dom.scheduleTitle.value.trim();
    const date = dom.scheduleDate.value;
    const time = dom.scheduleTime.value;
    const loc = dom.scheduleLocation.value.trim();

    if (!title || !date) return;

    const members = Array.from(dom.scheduleMembers.querySelectorAll("input[type=checkbox]:checked"))
      .map((c) => c.value);

    state.schedules.push({
      id: genId("s"),
      title,
      date,
      time,
      location: loc,
      memberIds: members
    });

    saveState();

    dom.scheduleForm.reset();
    renderSchedules();
  });

  /* --- Currency Rate Save --- */
  dom.saveRates.addEventListener("click", () => {
    const j = parseFloat(dom.rateJPY.value);
    const k = parseFloat(dom.rateKRW.value);
    if (j > 0) state.settings.rateJPY = j;
    if (k > 0) state.settings.rateKRW = k;
    saveState();
    alert("匯率已更新！");
  });
}

/* -----------------------
   RENDER EVERYTHING
----------------------- */
function renderAll() {
  renderMembers();
  renderExpenseChips();
  renderExpenseList();
  renderBalances();
  renderSchedules();
  updateRateFields();
}

/* -----------------------
   RENDER Members
----------------------- */
function renderMembers() {
  dom.memberList.innerHTML = "";

  state.members.forEach((m) => {
    const row = document.createElement("div");
    row.className = "member-row";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";

    const dot = document.createElement("div");
    dot.className = "member-dot";
    dot.style.background = m.colorHex;
    dot.textContent = m.short;

    const info = document.createElement("div");
    info.className = "member-info";
    info.innerHTML = `
      <div>${m.name}</div>
      <div class="member-meta">${m.short}${m.note ? " · " + m.note : ""}</div>
    `;

    left.appendChild(dot);
    left.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.textContent = "刪除";
    btn.onclick = () => {
      if (!confirm("確定刪除？")) return;
      state.members = state.members.filter((x) => x.id !== m.id);

      // Remove from schedules / expenses
      state.schedules.forEach((s) => {
        s.memberIds = s.memberIds.filter((id) => id !== m.id);
      });
      state.expenses.forEach((e) => {
        e.memberIds = e.memberIds.filter((id) => id !== m.id);
        if (e.payerId === m.id) e.payerId = null;
      });

      saveState();
      renderAll();
    };

    row.appendChild(left);
    row.appendChild(btn);
    dom.memberList.appendChild(row);
  });
}

/* -----------------------
   Expenses: Chips & Select
----------------------- */
function renderExpenseChips() {
  // payer
  dom.expensePayer.innerHTML = "<option value=''>共同付款</option>";

  state.members.forEach((m) => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.name;
    dom.expensePayer.appendChild(option);
  });

  // chips
  dom.expenseMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.background = m.colorHex;
    dot.textContent = m.short;

    const name = document.createElement("span");
    name.textContent = m.name;

    label.appendChild(checkbox);
    label.appendChild(dot);
    label.appendChild(name);
    dom.expenseMembers.appendChild(label);
  });
}

/* -----------------------
   Expense List
----------------------- */
function renderExpenseList() {
  dom.expenseList.innerHTML = "";

  state.expenses.forEach((e) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <strong>${e.title}</strong> · ${e.amount} ${e.currency}<br>
      <span class="expense-meta">${e.date || "無日期"}</span>
    `;

    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.textContent = "刪除";
    btn.onclick = () => {
      if (!confirm("刪除記帳？")) return;
      state.expenses = state.expenses.filter((x) => x.id !== e.id);
      saveState();
      renderAll();
    };

    row.appendChild(left);
    row.appendChild(btn);
    dom.expenseList.appendChild(row);
  });
}

/* -----------------------
   Balances (settlement)
----------------------- */
function renderBalances() {
  const balances = computeBalances();

  dom.balanceSummary.innerHTML = "";
  balances.forEach((b) => {
    const li = document.createElement("li");
    li.className = "balance-item";

    const amt = Math.round(b.balance);

    li.innerHTML = `
      ${b.member.name}
      <span class="balance-amount ${amt > 0 ? "positive" : amt < 0 ? "negative" : ""}">
        ${amt > 0 ? "+" : ""}${amt} TWD
      </span>
    `;

    dom.balanceSummary.appendChild(li);
  });

  renderPairwise(balances);
}

function computeBalances() {
  const balances = {};

  state.members.forEach((m) => {
    balances[m.id] = { member: m, balance: 0 };
  });

  state.expenses.forEach((e) => {
    const total = e.amount * e.rate;
    const ids = e.memberIds;
    const share = total / ids.length;

    if (e.payerId) {
      balances[e.payerId].balance += total;
    } else {
      // multiple payer
      ids.forEach((id) => {
        balances[id].balance += share;
      });
    }

    ids.forEach((id) => {
      balances[id].balance -= share;
    });
  });

  return Object.values(balances);
}

/* -----------------------
   Pairwise settlement
----------------------- */
function renderPairwise(list) {
  dom.pairwiseList.innerHTML = "";

  const debtors = list.filter((b) => b.balance < -1).map((b) => ({
    member: b.member,
    amount: -b.balance
  }));

  const creditors = list.filter((b) => b.balance > 1).map((b) => ({
    member: b.member,
    amount: b.balance
  }));

  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const x = Math.min(d.amount, c.amount);

    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = `${d.member.name} → ${c.member.name}：${Math.round(x)} TWD`;
    dom.pairwiseList.appendChild(li);

    d.amount -= x;
    c.amount -= x;

    if (d.amount < 1) i++;
    if (c.amount < 1) j++;
  }
}

/* -----------------------
   SCHEDULE (Right Pane)
----------------------- */

const collapsed = new Set();

function renderSchedules() {
  dom.scheduleList.innerHTML = "";

  const grouped = {};
  state.schedules.forEach((s) => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const dates = Object.keys(grouped).sort();

  dates.forEach((d) => {
    const group = document.createElement("div");
    group.className = "schedule-date-group";

    const header = document.createElement("div");
    header.className = "schedule-date-header";
    header.textContent = dateLabel(d);
    header.onclick = () => {
      collapsed.has(d) ? collapsed.delete(d) : collapsed.add(d);
      renderSchedules();
    };

    group.appendChild(header);

    if (!collapsed.has(d)) {
      const wrap = document.createElement("div");
      wrap.className = "schedule-items";

      grouped[d].forEach((s) => {
        const item = document.createElement("div");
        item.className = "schedule-item";
        item.draggable = true;

        item.dataset.id = s.id;
        item.dataset.date = s.date;

        item.innerHTML = `
          <div>
            <strong>${s.title}</strong>
            ${s.time ? " · " + s.time : ""}
            <br>
            <span style="font-size:11px;color:#666;">${s.location || ""}</span>
          </div>
          <button class="btn danger small">刪除</button>
        `;

        item.querySelector("button").onclick = () => {
          if (!confirm("刪除行程？")) return;
          state.schedules = state.schedules.filter((x) => x.id !== s.id);
          saveState();
          renderSchedules();
        };

        // drag events
        item.addEventListener("dragstart", scheduleDragStart);
        item.addEventListener("dragover", scheduleDragOver);
        item.addEventListener("drop", scheduleDrop);
        item.addEventListener("dragend", scheduleDragEnd);

        wrap.appendChild(item);
      });

      group.appendChild(wrap);
    }

    dom.scheduleList.appendChild(group);
  });
}

let draggingId = null;

function scheduleDragStart(e) {
  draggingId = e.currentTarget.dataset.id;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.classList.add("dragging");
}

function scheduleDragOver(e) {
  e.preventDefault();
  const target = e.currentTarget;
  if (target.dataset.date !== findSchedule(draggingId).date) return;
  target.classList.add("drag-over");
}

function scheduleDrop(e) {
  const target = e.currentTarget;
  const targetId = target.dataset.id;

  const dragItem = findSchedule(draggingId);
  const targetDate = target.dataset.date;

  if (dragItem.date !== targetDate) return;

  const list = state.schedules.filter((s) => s.date === targetDate);
  const rest = state.schedules.filter((s) => s.date !== targetDate);

  const ids = list.map((s) => s.id).filter((id) => id !== draggingId);
  const index = ids.indexOf(targetId);
  ids.splice(index, 0, draggingId);

  const newList = ids.map((id) => list.find((s) => s.id === id));

  state.schedules = [...rest, ...newList];
  saveState();
  renderSchedules();
}

function scheduleDragEnd(e) {
  draggingId = null;
  document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  e.currentTarget.classList.remove("dragging");
}

function findSchedule(id) {
  return state.schedules.find((s) => s.id === id);
}

/* -----------------------
   Rates
----------------------- */
function updateRateFields() {
  dom.rateJPY.value = state.settings.rateJPY;
  dom.rateKRW.value = state.settings.rateKRW;

  const currency = dom.expenseCurrency.value;
  if (currency === "JPY") dom.expenseRate.value = state.settings.rateJPY;
  else if (currency === "KRW") dom.expenseRate.value = state.settings.rateKRW;
  else dom.expenseRate.value = 1;

  dom.expenseCurrency.onchange = updateRateFields;
}

/* -----------------------
   Split Pane Drag
----------------------- */

function initSplitter() {
  let dragging = false;

  dom.splitter.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "row-resize";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
    document.body.style.cursor = "";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const rect = dom.leftPane.getBoundingClientRect();
    let y = e.clientY - rect.top;

    if (y < 120) y = 120;
    if (y > rect.height - 160) y = rect.height - 160;

    dom.leftPane.style.gridTemplateRows = `${y}px 6px 1fr`;
  });
}
