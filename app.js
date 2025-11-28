/* Trip Planner - New Build (split layout, localStorage, multi-currency) */

const STORAGE_KEY = "trip_planner_new_state";

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error();
    const parsed = JSON.parse(raw);
    return {
      tripName: parsed.tripName || "我的旅行計畫",
      members: parsed.members || [],
      schedules: parsed.schedules || [],
      expenses: parsed.expenses || [],
      settings: {
        rateJPY: parsed.settings?.rateJPY ?? 0.22,
        rateKRW: parsed.settings?.rateKRW ?? 0.024
      }
    };
  } catch {
    return {
      tripName: "我的旅行計畫",
      members: [],
      schedules: [],
      expenses: [],
      settings: {
        rateJPY: 0.22,
        rateKRW: 0.024
      }
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* Utils */

const MORANDI_COLORS = [
  "#9AA7B1","#A8B5A2","#DACFC4","#C7A0A7","#C7CED5",
  "#B9C4A7","#C7BEDD","#B8A19A","#C8D9C2","#8FA2B5"
];

function genId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function findMember(id) {
  return state.members.find((m) => m.id === id);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const w = "日一二三四五六"[d.getDay()] || "";
  return `${dateStr}（${w}）`;
}

/* DOM refs */

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  initForms();
  initSplitter();
  renderAll();
});

function cacheDom() {
  dom.memberForm = document.getElementById("member-form");
  dom.memberName = document.getElementById("member-name");
  dom.memberShort = document.getElementById("member-short");
  dom.memberColor = document.getElementById("member-color");
  dom.memberNote = document.getElementById("member-note");
  dom.memberList = document.getElementById("member-list");

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

  dom.scheduleForm = document.getElementById("schedule-form");
  dom.scheduleDate = document.getElementById("schedule-date");
  dom.scheduleTime = document.getElementById("schedule-time");
  dom.scheduleTitle = document.getElementById("schedule-title");
  dom.scheduleLocation = document.getElementById("schedule-location");
  dom.scheduleMembers = document.getElementById("schedule-members");
  dom.scheduleList = document.getElementById("schedule-list");

  dom.leftColumn = document.getElementById("left-column");
  dom.splitter = document.getElementById("splitter");
  dom.tripTitle = document.getElementById("trip-title");
}

/* Init forms */

function initForms() {
  // Trip Title
  dom.tripTitle.value = state.tripName;
  dom.tripTitle.addEventListener("change", () => {
    const newName = dom.tripTitle.value.trim();
    if (newName) {
      state.tripName = newName;
      saveState();
      // Maybe show a small "saved" confirmation? For now, just save.
    } else {
      // Restore previous name if input is empty
      dom.tripTitle.value = state.tripName;
    }
  });

  // 顏色選單
  MORANDI_COLORS.forEach((hex, i) => {
    const opt = document.createElement("option");
    opt.value = hex;
    opt.textContent = `Color ${i + 1} (${hex})`;
    dom.memberColor.appendChild(opt);
  });

  // 成員
  dom.memberForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = dom.memberName.value.trim();
    const shortRaw = dom.memberShort.value.trim();
    if (!name) return;
    const short = (shortRaw || name[0] || "?").slice(0, 2);
    const note = dom.memberNote.value.trim();
    const colorHex =
      dom.memberColor.value ||
      MORANDI_COLORS[state.members.length % MORANDI_COLORS.length];

    state.members.push({ id: genId("m"), name, short, note, colorHex });
    saveState();
    dom.memberForm.reset();
    renderAll();
  });

  // 匯率初始
  dom.rateJPY.value = state.settings.rateJPY;
  dom.rateKRW.value = state.settings.rateKRW;

  dom.saveRates.addEventListener("click", () => {
    const rj = parseFloat(dom.rateJPY.value);
    const rk = parseFloat(dom.rateKRW.value);
    if (!(rj > 0 && rk > 0)) {
      alert("請輸入有效匯率");
      return;
    }
    state.settings.rateJPY = rj;
    state.settings.rateKRW = rk;
    saveState();
    updateExpenseRate();
    alert("匯率已更新");
  });

  dom.expenseCurrency.addEventListener("change", updateExpenseRate);
  updateExpenseRate();

  // 記帳
  dom.expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat(dom.expenseAmount.value);
    const rate = parseFloat(dom.expenseRate.value);
    if (!(amount > 0 && rate > 0)) {
      alert("金額或匯率錯誤");
      return;
    }
    const currency = dom.expenseCurrency.value;
    const date = dom.expenseDate.value;
    const title = dom.expenseTitle.value.trim();
    if (!title) return;
    const payerId = dom.expensePayer.value || null;
    const memberIds = Array.from(
      dom.expenseMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((i) => i.value);
    if (!memberIds.length) {
      alert("請選擇分攤成員");
      return;
    }

    state.expenses.push({
      id: genId("e"),
      date,
      amount,
      currency,
      rate,
      title,
      payerId,
      memberIds
    });
    saveState();
    dom.expenseForm.reset();
    updateExpenseRate();
    renderExpenses();
    renderSettlement();
  });

  // 行程
  dom.scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = dom.scheduleDate.value;
    const title = dom.scheduleTitle.value.trim();
    if (!date || !title) return;
    const time = dom.scheduleTime.value || "";
    const location = dom.scheduleLocation.value.trim();
    const memberIds = Array.from(
      dom.scheduleMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((i) => i.value);

    state.schedules.push({
      id: genId("s"),
      date,
      time,
      title,
      location,
      memberIds
    });
    saveState();
    dom.scheduleForm.reset();
    renderSchedules();
  });
}

function updateExpenseRate() {
  const c = dom.expenseCurrency.value;
  if (c === "JPY") dom.expenseRate.value = state.settings.rateJPY;
  else if (c === "KRW") dom.expenseRate.value = state.settings.rateKRW;
  else dom.expenseRate.value = 1;
}

/* Render all */

function renderAll() {
  renderMembers();
  renderMemberChipsForExpenses();
  renderMemberChipsForSchedule();
  renderExpenses();
  renderSettlement();
  renderSchedules();
}

/* Members */

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
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    const info = document.createElement("div");
    info.className = "member-info";
    info.innerHTML = `
      <div>${m.name}</div>
      <div class="member-meta">${m.short}${m.note ? " · " + m.note : ""}</div>
    `;

    left.appendChild(dot);
    left.appendChild(info);

    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "刪除";
    del.onclick = () => {
      if (!confirm(`刪除成員「${m.name}」？`)) return;
      state.members = state.members.filter((x) => x.id !== m.id);
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
    row.appendChild(del);
    dom.memberList.appendChild(row);
  });
}

function renderMemberChipsForExpenses() {
  dom.expensePayer.innerHTML = `<option value="">共同付款</option>`;
  state.members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    dom.expensePayer.appendChild(opt);
  });

  dom.expenseMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    const span = document.createElement("span");
    span.textContent = m.name;

    label.appendChild(input);
    label.appendChild(dot);
    label.appendChild(span);
    dom.expenseMembers.appendChild(label);
  });
}

function renderMemberChipsForSchedule() {
  dom.scheduleMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    const span = document.createElement("span");
    span.textContent = m.name;

    label.appendChild(input);
    label.appendChild(dot);
    label.appendChild(span);
    dom.scheduleMembers.appendChild(label);
  });
}

/* Expenses */

function renderExpenses() {
  dom.expenseList.innerHTML = "";
  state.expenses.forEach((e) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const main = document.createElement("div");
    main.className = "expense-main";
    const twd = e.amount * e.rate;
    main.innerHTML = `
      <strong>${e.title}</strong> · ${e.amount.toFixed(0)} ${e.currency}<br>
      <span class="expense-meta">${e.date || "無日期"} · ≈ ${twd.toFixed(0)} TWD</span>
    `;

    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "刪除";
    del.onclick = () => {
      if (!confirm(`刪除記帳「${e.title}」？`)) return;
      state.expenses = state.expenses.filter((x) => x.id !== e.id);
      saveState();
      renderExpenses();
      renderSettlement();
    };

    row.appendChild(main);
    row.appendChild(del);
    dom.expenseList.appendChild(row);
  });
}

/* Settlement */

function computeBalances() {
  const balances = {};
  state.members.forEach((m) => {
    balances[m.id] = { member: m, balance: 0 };
  });

  state.expenses.forEach((e) => {
    const total = e.amount * e.rate;
    const ids = e.memberIds || [];
    if (!ids.length) return;
    const share = total / ids.length;

    if (e.payerId && balances[e.payerId]) {
      balances[e.payerId].balance += total;
    } else if (!e.payerId) {
      ids.forEach((id) => {
        if (balances[id]) balances[id].balance += share;
      });
    }

    ids.forEach((id) => {
      if (balances[id]) balances[id].balance -= share;
    });
  });

  return Object.values(balances);
}

function renderSettlement() {
  const list = computeBalances();

  dom.balanceSummary.innerHTML = "";
  list.forEach((b) => {
    const li = document.createElement("li");
    li.className = "balance-item";
    const amt = Math.round(b.balance);
    const label = amt > 0 ? "應收" : amt < 0 ? "應付" : "平衡";
    const cls = amt > 0 ? "positive" : amt < 0 ? "negative" : "";
    li.innerHTML = `
      <span>${b.member.name}</span>
      <span class="balance-amount ${cls}">${amt} TWD ${label}</span>
    `;
    dom.balanceSummary.appendChild(li);
  });

  renderPairwise(list);
}

function renderPairwise(list) {
  dom.pairwiseList.innerHTML = "";

  const creditors = [];
  const debtors = [];
  list.forEach((b) => {
    const amt = Math.round(b.balance);
    if (amt > 0) creditors.push({ member: b.member, amount: amt });
    if (amt < 0) debtors.push({ member: b.member, amount: -amt });
  });

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const x = Math.min(d.amount, c.amount);

    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = `${d.member.name} → ${c.member.name}：${x} TWD`;
    dom.pairwiseList.appendChild(li);

    d.amount -= x;
    c.amount -= x;
    if (d.amount <= 0) i++;
    if (c.amount <= 0) j++;
  }

  if (!dom.pairwiseList.children.length) {
    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = "所有人的結餘已平衡，無需結算。";
    dom.pairwiseList.appendChild(li);
  }
}

/* Schedules + drag & drop */

const collapsedDates = new Set();
let draggingScheduleId = null;

function renderSchedules() {
  dom.scheduleList.innerHTML = "";

  const byDate = {};
  state.schedules.forEach((s) => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  const dates = Object.keys(byDate).sort();

  dates.forEach((date) => {
    const group = document.createElement("div");
    group.className = "schedule-date-group";

    const header = document.createElement("div");
    header.className = "schedule-date-header";
    header.innerHTML = `
      <span>${formatDateLabel(date)}</span>
      <span>${collapsedDates.has(date) ? "展開 ▾" : "收合 ▴"}</span>
    `;
    header.onclick = () => {
      if (collapsedDates.has(date)) collapsedDates.delete(date);
      else collapsedDates.add(date);
      renderSchedules();
    };

    group.appendChild(header);

    if (!collapsedDates.has(date)) {
      const items = document.createElement("div");
      items.className = "schedule-items";

      byDate[date].forEach((s) => {
        const item = document.createElement("div");
        item.className = "schedule-item";
        item.draggable = true;
        item.dataset.id = s.id;
        item.dataset.date = s.date;

        const left = document.createElement("div");
        left.innerHTML = `
          <strong>${s.title}</strong>${s.time ? " · " + s.time : ""}<br>
          <span style="font-size:11px;color:#6b7280;">${s.location || ""}</span>
        `;

        const del = document.createElement("button");
        del.className = "btn danger";
        del.textContent = "刪除";
        del.onclick = () => {
          if (!confirm(`刪除行程「${s.title}」？`)) return;
          state.schedules = state.schedules.filter((x) => x.id !== s.id);
          saveState();
          renderSchedules();
        };

        item.appendChild(left);
        item.appendChild(del);

        item.addEventListener("dragstart", handleScheduleDragStart);
        item.addEventListener("dragover", handleScheduleDragOver);
        item.addEventListener("drop", handleScheduleDrop);
        item.addEventListener("dragend", handleScheduleDragEnd);

        items.appendChild(item);
      });

      group.appendChild(items);
    }

    dom.scheduleList.appendChild(group);
  });
}

function handleScheduleDragStart(e) {
  draggingScheduleId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleScheduleDragOver(e) {
  e.preventDefault();
  const target = e.currentTarget;
  const dragItem = state.schedules.find((s) => s.id === draggingScheduleId);
  if (!dragItem) return;
  if (target.dataset.date !== dragItem.date) return;
  target.classList.add("drag-over");
}

function handleScheduleDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove("drag-over");
  const targetId = target.dataset.id;

  const dragItem = state.schedules.find((s) => s.id === draggingScheduleId);
  if (!dragItem || dragItem.date !== target.dataset.date) return;

  const same = state.schedules.filter((s) => s.date === dragItem.date);
  const others = state.schedules.filter((s) => s.date !== dragItem.date);

  const ids = same.map((s) => s.id).filter((id) => id !== draggingScheduleId);
  const idx = ids.indexOf(targetId);
  ids.splice(idx, 0, draggingScheduleId);

  const newSame = ids.map((id) => same.find((s) => s.id === id));
  state.schedules = [...others, ...newSame];
  saveState();
  renderSchedules();
}

function handleScheduleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".schedule-item.drag-over").forEach((el) =>
    el.classList.remove("drag-over")
  );
  draggingScheduleId = null;
}

/* Splitter */

function initSplitter() {
  const leftColumn = dom.leftColumn;
  const splitter = dom.splitter;
  let dragging = false;

  splitter.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "row-resize";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = leftColumn.getBoundingClientRect();
    let y = e.clientY - rect.top;

    const minTop = 140;
    const minBottom = 180;
    if (y < minTop) y = minTop;
    if (y > rect.height - minBottom) y = rect.height - minBottom;

    leftColumn.style.gridTemplateRows = `${y}px 6px 1fr`;
  });
}
