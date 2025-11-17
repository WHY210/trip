// ================== 常數與資料結構 ==================
const STORAGE_KEY = "tripToolV2";

const MORANDI_COLORS = [
  { id: "fog-blue", name: "Fog Blue", hex: "#9AA7B1" },
  { id: "mist-green", name: "Mist Green", hex: "#A8B5A2" },
  { id: "rose-dust", name: "Rose Dust", hex: "#C7A7A3" },
  { id: "stone-gray", name: "Stone Gray", hex: "#C4C4C0" },
  { id: "clay-brown", name: "Clay Brown", hex: "#B8A39A" },
  { id: "pale-lilac", name: "Pale Lilac", hex: "#C8C2D3" },
  { id: "sage", name: "Sage", hex: "#BFC8B8" },
  { id: "soft-sand", name: "Soft Sand", hex: "#DACFC4" }
];

let state = {
  members: [],   // { id, name, short, colorHex, colorName, note, colorId }
  schedules: [], // { id, date, time, title, location, memberIds: [] }
  expenses: []   // { id, date, title, amount, payerId, memberIds: [] }
};

let draggedScheduleId = null;

// ================== DOM 元素 ==================
// 成員
const memberForm = document.getElementById("member-form");
const memberNameInput = document.getElementById("member-name");
const memberShortInput = document.getElementById("member-short");
const memberColorSelect = document.getElementById("member-color");
const memberNoteInput = document.getElementById("member-note");
const memberTableBody = document.querySelector("#member-table tbody");

// 行程
const scheduleForm = document.getElementById("schedule-form");
const scheduleDateInput = document.getElementById("schedule-date");
const scheduleTimeInput = document.getElementById("schedule-time");
const scheduleTitleInput = document.getElementById("schedule-title");
const scheduleLocationInput = document.getElementById("schedule-location");
const scheduleMembersBox = document.getElementById("schedule-members");
const scheduleList = document.getElementById("schedule-list");

// 記帳
const expenseForm = document.getElementById("expense-form");
const expenseDateInput = document.getElementById("expense-date");
const expenseTitleInput = document.getElementById("expense-title");
const expenseAmountInput = document.getElementById("expense-amount");
const expensePayerSelect = document.getElementById("expense-payer");
const expenseMembersBox = document.getElementById("expense-members");
const expenseList = document.getElementById("expense-list");

// 結算 Summary
const balanceSummaryEl = document.getElementById("balance-summary");
const pairwiseSummaryEl = document.getElementById("pairwise-summary");

// ================== LocalStorage ==================
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = {
          members: parsed.members || [],
          schedules: parsed.schedules || [],
          expenses: parsed.expenses || []
        };
      }
    }
  } catch (e) {
    console.warn("無法載入儲存資料：", e);
  }
}

// ================== 工具函式 ==================
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 回傳下一個未被使用的莫蘭迪顏色
function getNextMorandiColor() {
  if (state.members.length === 0) return MORANDI_COLORS[0];

  const usedIds = state.members.map(m => m.colorId).filter(Boolean);
  const unused = MORANDI_COLORS.filter(c => !usedIds.includes(c.id));
  if (unused.length > 0) return unused[0];

  const index = state.members.length % MORANDI_COLORS.length;
  return MORANDI_COLORS[index];
}

// 建立顏色小點
function createMemberDot(member) {
  const span = document.createElement("span");
  span.className = "member-dot";
  span.style.backgroundColor = member.colorHex;
  const label = (member.short || member.name || "?").toString().slice(0, 2);
  span.textContent = label;
  return span;
}

// 建立成員 chip
function createMemberChip(member) {
  const chip = document.createElement("span");
  chip.className = "member-chip";
  const dot = createMemberDot(member);
  const text = document.createElement("span");
  text.textContent = member.name;
  chip.appendChild(dot);
  chip.appendChild(text);
  return chip;
}

// 找成員
function findMember(id) {
  return state.members.find(m => m.id === id);
}

function formatDateTitle(dateStr) {
  if (!dateStr) return "未指定日期";
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const wd = weekdays[d.getDay()];
  return `${dateStr}（週${wd}）`;
}

// ================== 成員管理 ==================
function initMemberColorSelect() {
  memberColorSelect.innerHTML = '<option value="">自動指派顏色</option>';
  MORANDI_COLORS.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.hex})`;
    opt.style.backgroundColor = c.hex;
    memberColorSelect.appendChild(opt);
  });
}

function renderMemberTable() {
  memberTableBody.innerHTML = "";
  state.members.forEach(member => {
    const tr = document.createElement("tr");

    const tdColor = document.createElement("td");
    tdColor.appendChild(createMemberDot(member));

    const tdName = document.createElement("td");
    tdName.textContent = member.name;

    const tdShort = document.createElement("td");
    tdShort.textContent = member.short;

    const tdNote = document.createElement("td");
    tdNote.textContent = member.note || "";

    const tdDelete = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.textContent = "刪除";
    delBtn.addEventListener("click", () => {
      if (confirm(`確定要刪除成員「${member.name}」嗎？`)) {
        // 刪除成員，同時從行程與記帳中移除
        state.members = state.members.filter(m => m.id !== member.id);
        state.schedules.forEach(s => {
          s.memberIds = s.memberIds.filter(id => id !== member.id);
        });
        state.expenses.forEach(e => {
          e.memberIds = e.memberIds.filter(id => id !== member.id);
          if (e.payerId === member.id) {
            e.payerId = null;
          }
        });
        saveState();
        renderAll();
      }
    });
    tdDelete.appendChild(delBtn);

    tr.appendChild(tdColor);
    tr.appendChild(tdName);
    tr.appendChild(tdShort);
    tr.appendChild(tdNote);
    tr.appendChild(tdDelete);

    memberTableBody.appendChild(tr);
  });
}

memberForm.addEventListener("submit", e => {
  e.preventDefault();
  const name = memberNameInput.value.trim();
  const short = memberShortInput.value.trim();
  const note = memberNoteInput.value.trim();
  const colorId = memberColorSelect.value || null;

  if (!name || !short) return;

  const colorObj = colorId
    ? MORANDI_COLORS.find(c => c.id === colorId) || getNextMorandiColor()
    : getNextMorandiColor();

  const member = {
    id: createId(),
    name,
    short,
    colorId: colorObj.id,
    colorHex: colorObj.hex,
    colorName: colorObj.name,
    note
  };

  state.members.push(member);
  saveState();

  memberNameInput.value = "";
  memberShortInput.value = "";
  memberNoteInput.value = "";
  memberColorSelect.value = "";

  renderAll();
});

// ================== 行程 ==================
function renderScheduleMemberCheckboxes() {
  scheduleMembersBox.innerHTML = "";
  state.members.forEach(member => {
    const label = document.createElement("label");
    label.className = "member-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = member.id;

    const dot = createMemberDot(member);
    const text = document.createElement("span");
    text.textContent = member.name;

    label.appendChild(checkbox);
    label.appendChild(dot);
    label.appendChild(text);

    scheduleMembersBox.appendChild(label);
  });
}

function renderScheduleList() {
  scheduleList.innerHTML = "";
  if (state.schedules.length === 0) return;

  // 按日期 + 時間排序
  const sorted = [...state.schedules].sort((a, b) => {
    const da = (a.date || "") + " " + (a.time || "");
    const db = (b.date || "") + " " + (b.time || "");
    return da.localeCompare(db);
  });

  // 依日期分組
  const groups = {};
  sorted.forEach(item => {
    const key = item.date || "未指定日期";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const dateKeys = Object.keys(groups).sort((a, b) => {
    if (a === "未指定日期") return 1;
    if (b === "未指定日期") return -1;
    return a.localeCompare(b);
  });

  dateKeys.forEach(dateKey => {
    const groupLi = document.createElement("li");
    groupLi.className = "schedule-date-group";

    const header = document.createElement("div");
    header.className = "schedule-date-header";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = formatDateTitle(dateKey === "未指定日期" ? "" : dateKey);
    header.appendChild(labelSpan);

    groupLi.appendChild(header);

    const dayList = document.createElement("ul");
    dayList.className = "schedule-day-list";

    groups[dateKey].forEach(item => {
      const li = document.createElement("li");
      li.className = "item-row schedule-item";
      li.setAttribute("draggable", "true");
      li.dataset.id = item.id;
      li.dataset.date = item.date || "";

      const headerRow = document.createElement("div");
      headerRow.className = "item-row-header";

      const titleEl = document.createElement("div");
      titleEl.className = "item-row-title";
      titleEl.textContent = item.title;

      const metaEl = document.createElement("div");
      metaEl.className = "item-row-meta";
      const timeStr = item.time || "";
      metaEl.textContent = timeStr ? timeStr : "";

      headerRow.appendChild(titleEl);
      headerRow.appendChild(metaEl);

      const locationEl = document.createElement("div");
      locationEl.className = "item-row-meta";
      locationEl.textContent = item.location || "";

      const memberRow = document.createElement("div");
      memberRow.className = "item-row-members";
      item.memberIds.forEach(id => {
        const m = findMember(id);
        if (m) memberRow.appendChild(createMemberChip(m));
      });

      li.appendChild(headerRow);
      if (item.location) li.appendChild(locationEl);
      if (item.memberIds.length > 0) li.appendChild(memberRow);

      dayList.appendChild(li);
    });

    groupLi.appendChild(dayList);
    scheduleList.appendChild(groupLi);

    // 點日期標題可以收合 / 展開
    header.addEventListener("click", () => {
      groupLi.classList.toggle("collapsed");
    });
  });

  enableScheduleDragAndDrop();
}

scheduleForm.addEventListener("submit", e => {
  e.preventDefault();
  const date = scheduleDateInput.value;
  const time = scheduleTimeInput.value;
  const title = scheduleTitleInput.value.trim();
  const location = scheduleLocationInput.value.trim();

  if (!title) return;

  const checked = scheduleMembersBox.querySelectorAll("input[type=checkbox]:checked");
  const memberIds = Array.from(checked).map(cb => cb.value);

  const item = {
    id: createId(),
    date,
    time,
    title,
    location,
    memberIds
  };

  state.schedules.push(item);
  saveState();

  scheduleTitleInput.value = "";
  scheduleLocationInput.value = "";
  // 日期時間保留，方便連續建立同一天行程
  scheduleMembersBox.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = false;
  });

  renderScheduleList();
});

function enableScheduleDragAndDrop() {
  const items = scheduleList.querySelectorAll(".schedule-item");

  items.forEach(item => {
    item.addEventListener("dragstart", e => {
      draggedScheduleId = item.dataset.id;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      scheduleList.querySelectorAll(".schedule-item").forEach(i =>
        i.classList.remove("drop-target-before")
      );
      draggedScheduleId = null;
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      if (!draggedScheduleId) return;
      const targetId = item.dataset.id;
      if (targetId === draggedScheduleId) return;

      const dragged = state.schedules.find(s => s.id === draggedScheduleId);
      const target = state.schedules.find(s => s.id === targetId);
      if (!dragged || !target) return;

      const draggedDate = dragged.date || "";
      const targetDate = target.date || "";
      if (draggedDate !== targetDate) return; // 僅允許同日期內排序

      item.classList.add("drop-target-before");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drop-target-before");
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      item.classList.remove("drop-target-before");
      if (!draggedScheduleId) return;

      const targetId = item.dataset.id;
      if (targetId === draggedScheduleId) return;

      const draggedIndex = state.schedules.findIndex(s => s.id === draggedScheduleId);
      const targetIndex = state.schedules.findIndex(s => s.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return;

      const dragged = state.schedules[draggedIndex];
      const target = state.schedules[targetIndex];
      const draggedDate = dragged.date || "";
      const targetDate = target.date || "";
      if (draggedDate !== targetDate) return; // 僅允許同日期內排序

      const [moved] = state.schedules.splice(draggedIndex, 1);
      let newIndex = targetIndex;
      if (draggedIndex < targetIndex) newIndex -= 1;
      state.schedules.splice(newIndex, 0, moved);

      saveState();
      renderScheduleList();
    });
  });
}

// ================== 記帳 ==================
function renderExpenseMemberCheckboxes() {
  expenseMembersBox.innerHTML = "";
  state.members.forEach(member => {
    const label = document.createElement("label");
    label.className = "member-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = member.id;

    const dot = createMemberDot(member);
    const text = document.createElement("span");
    text.textContent = member.name;

    label.appendChild(checkbox);
    label.appendChild(dot);
    label.appendChild(text);

    expenseMembersBox.appendChild(label);
  });
}

function renderExpensePayerSelect() {
  expensePayerSelect.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "未指定 / 共同付款";
  expensePayerSelect.appendChild(defaultOpt);

  state.members.forEach(member => {
    const opt = document.createElement("option");
    opt.value = member.id;
    opt.textContent = member.name;
    expensePayerSelect.appendChild(opt);
  });
}

function renderExpenseList() {
  expenseList.innerHTML = "";
  if (state.expenses.length === 0) return;

  state.expenses.forEach(exp => {
    const li = document.createElement("li");
    li.className = "item-row";

    const header = document.createElement("div");
    header.className = "item-row-header";

    const titleEl = document.createElement("div");
    titleEl.className = "item-row-title";
    titleEl.textContent = exp.title;

    const metaEl = document.createElement("div");
    metaEl.className = "item-row-meta";
    const payer = exp.payerId ? findMember(exp.payerId) : null;
    const payerName = payer ? payer.name : "未指定";
    const dateStr = exp.date || "";
    metaEl.textContent = [dateStr, `付款人：${payerName}`].filter(Boolean).join(" ｜ ");

    header.appendChild(titleEl);
    header.appendChild(metaEl);

    const amountRow = document.createElement("div");
    amountRow.className = "item-row-meta";
    const badge = document.createElement("span");
    badge.className = "badge-amount";
    badge.textContent = `NT$ ${Number(exp.amount || 0).toLocaleString()}`;
    amountRow.appendChild(badge);

    const memberRow = document.createElement("div");
    memberRow.className = "item-row-members";
    exp.memberIds.forEach(id => {
      const m = findMember(id);
      if (m) memberRow.appendChild(createMemberChip(m));
    });

    li.appendChild(header);
    li.appendChild(amountRow);
    if (exp.memberIds.length > 0) li.appendChild(memberRow);

    expenseList.appendChild(li);
  });
}

expenseForm.addEventListener("submit", e => {
  e.preventDefault();
  const date = expenseDateInput.value;
  const title = expenseTitleInput.value.trim();
  const amount = parseFloat(expenseAmountInput.value);
  const payerId = expensePayerSelect.value || null;

  if (!title || isNaN(amount)) return;

  const checked = expenseMembersBox.querySelectorAll("input[type=checkbox]:checked");
  const memberIds = Array.from(checked).map(cb => cb.value);

  const exp = {
    id: createId(),
    date,
    title,
    amount,
    payerId,
    memberIds
  };

  state.expenses.push(exp);
  saveState();

  expenseTitleInput.value = "";
  expenseAmountInput.value = "";
  expenseMembersBox.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = false;
  });

  renderExpenseList();
  renderBalances();
});

// ================== 結算計算 ==================
function computeBalances() {
  const balances = {};
  state.members.forEach(m => {
    balances[m.id] = 0;
  });

  state.expenses.forEach(exp => {
    const amount = Number(exp.amount || 0);
    if (!amount) return;

    const participants = exp.memberIds && exp.memberIds.length > 0 ? exp.memberIds.slice() : [];
    if (participants.length === 0) return; // 沒勾任何成員就不計算

    const share = amount / participants.length;

    // 參與成員：各自應付 share
    participants.forEach(id => {
      if (!(id in balances)) return;
      balances[id] -= share;
    });

    // 付款人：實際付出 amount
    if (exp.payerId && exp.payerId in balances) {
      balances[exp.payerId] += amount;
    }
  });

  return balances;
}

// 將 balances 轉成兩兩結算建議
function computePairwiseSettlements(balances) {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, val]) => {
    const amount = Math.round(val); // 四捨五入到整數
    if (amount > 0) {
      creditors.push({ id, amount });
    } else if (amount < 0) {
      debtors.push({ id, amount: -amount });
    }
  });

  const settlements = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amount, c.amount);

    if (pay > 0) {
      settlements.push({
        from: d.id,
        to: c.id,
        amount: pay
      });

      d.amount -= pay;
      c.amount -= pay;
    }

    if (d.amount <= 0.5) i++; // 容許一點誤差
    if (c.amount <= 0.5) j++;
  }

  return settlements;
}

function renderBalances() {
  if (!balanceSummaryEl || !pairwiseSummaryEl) return;

  const balances = computeBalances();

  // ===== 每人成員結算 =====
  balanceSummaryEl.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "balance-summary-list";

  const hasAnyExpense = state.expenses.length > 0;

  if (!hasAnyExpense || state.members.length === 0) {
    const p = document.createElement("p");
    p.className = "text-muted";
    p.textContent = "目前尚無可結算的記帳資料。";
    balanceSummaryEl.appendChild(p);
  } else {
    state.members.forEach(member => {
      const li = document.createElement("li");
      li.className = "balance-summary-item";

      const left = document.createElement("div");
      left.appendChild(createMemberDot(member));
      const nameSpan = document.createElement("span");
      nameSpan.textContent = member.name;
      left.appendChild(nameSpan);

      const right = document.createElement("div");
      const val = balances[member.id] || 0;
      const rounded = Math.round(val);

      if (Math.abs(rounded) < 1) {
        right.textContent = "已平衡";
        right.className = "text-muted";
      } else if (rounded > 0) {
        right.textContent = `應收 NT$ ${rounded.toLocaleString()}`;
        right.className = "text-positive";
      } else {
        right.textContent = `應付 NT$ ${(-rounded).toLocaleString()}`;
        right.className = "text-negative";
      }

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });

    balanceSummaryEl.appendChild(ul);
  }

  // ===== 兩兩結算建議 =====
  pairwiseSummaryEl.innerHTML = "";
  if (!hasAnyExpense || state.members.length === 0) {
    const p = document.createElement("p");
    p.className = "text-muted";
    p.textContent = "尚無任何轉帳建議。";
    pairwiseSummaryEl.appendChild(p);
  } else {
    const settlements = computePairwiseSettlements(balances);
    if (settlements.length === 0) {
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = "大家已經結清，不需要轉帳。";
      pairwiseSummaryEl.appendChild(p);
    } else {
      const ul2 = document.createElement("ul");
      ul2.className = "pairwise-summary-list";

      settlements.forEach(s => {
        const from = findMember(s.from);
        const to = findMember(s.to);
        if (!from || !to) return;

        const li = document.createElement("li");
        li.textContent = `${from.name} → ${to.name}：NT$ ${s.amount.toLocaleString()}`;
        ul2.appendChild(li);
      });

      pairwiseSummaryEl.appendChild(ul2);
    }
  }
}

// ================== 初始化 ==================
function renderAll() {
  renderMemberTable();
  renderScheduleMemberCheckboxes();
  renderExpenseMemberCheckboxes();
  renderExpensePayerSelect();
  renderScheduleList();
  renderExpenseList();
  renderBalances();
}

function init() {
  loadState();
  initMemberColorSelect();
  renderAll();

  // 簡單註冊 service worker（若存在）
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
