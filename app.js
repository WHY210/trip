// Trip Planner v3 - Pure Frontend, localStorage only

const STORAGE_KEY = "tripPlannerV3State_v3";

// 莫蘭迪色盤
const MORANDI_COLORS = [
  { id: "fog-blue", name: "Fog Blue", hex: "#9AA7B1" },
  { id: "mist-green", name: "Mist Green", hex: "#A8B5A2" },
  { id: "soft-sand", name: "Soft Sand", hex: "#DACFC4" },
  { id: "dusty-rose", name: "Dusty Rose", hex: "#C7A0A7" },
  { id: "cloud-gray", name: "Cloud Gray", hex: "#C7CED5" },
  { id: "sage", name: "Sage", hex: "#B9C4A7" },
  { id: "haze-lavender", name: "Haze Lavender", hex: "#C7BEDD" },
  { id: "warm-taupe", name: "Warm Taupe", hex: "#B8A19A" },
  { id: "pale-mint", name: "Pale Mint", hex: "#C8D9C2" },
  { id: "smoke-blue", name: "Smoke Blue", hex: "#8FA2B5" }
];

// ===== STATE =====

let state = loadState();

// 折疊狀態只放在記憶體
const collapsedDates = new Set();

// 拖曳用
let draggingScheduleId = null;

// Layout 判斷（桌機 vs 手機）
let isMobileLayout = window.innerWidth <= 900;

// ===== UTIL =====

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 填補缺欄位（避免版本升級爆炸）
      return {
        members: parsed.members || [],
        schedules: parsed.schedules || [],
        expenses: parsed.expenses || [],
        settings: {
          baseCurrency: parsed.settings?.baseCurrency || "TWD",
          rateJPY: typeof parsed.settings?.rateJPY === "number" ? parsed.settings.rateJPY : 0.22,
          rateKRW: typeof parsed.settings?.rateKRW === "number" ? parsed.settings.rateKRW : 0.024
        }
      };
    }
  } catch (err) {
    console.error("Failed to load state:", err);
  }
  return {
    members: [],
    schedules: [],
    expenses: [],
    settings: {
      baseCurrency: "TWD",
      rateJPY: 0.22,
      rateKRW: 0.024
    }
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function findMember(id) {
  return state.members.find((m) => m.id === id) || null;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dateStr;
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${dateStr}（${weekday}）`;
}

function formatCurrency(amount, currency = "TWD") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "-";
  const fixed = amount.toFixed(0);
  return `${fixed} ${currency}`;
}

function formatTwd(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "-";
  return `${amount.toFixed(0)} TWD`;
}

function sortByDateAsc(a, b) {
  if (a.date === b.date) return 0;
  return a.date < b.date ? -1 : 1;
}

// ===== DOM REFERENCES =====

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  initForms();
  initTabs();
  initResponsive();
  renderAll();
});

const dom = {};

function cacheDom() {
  dom.memberForm = document.getElementById("member-form");
  dom.memberName = document.getElementById("member-name");
  dom.memberShort = document.getElementById("member-short");
  dom.memberColor = document.getElementById("member-color");
  dom.memberNote = document.getElementById("member-note");
  dom.memberList = document.getElementById("member-list");

  dom.scheduleForm = document.getElementById("schedule-form");
  dom.scheduleDate = document.getElementById("schedule-date");
  dom.scheduleTime = document.getElementById("schedule-time");
  dom.scheduleTitle = document.getElementById("schedule-title");
  dom.scheduleLocation = document.getElementById("schedule-location");
  dom.scheduleMembers = document.getElementById("schedule-members");
  dom.scheduleList = document.getElementById("schedule-list");

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

  dom.baseCurrency = document.getElementById("base-currency");
  dom.rateJPY = document.getElementById("rate-jpy");
  dom.rateKRW = document.getElementById("rate-krw");
  dom.saveRates = document.getElementById("save-rates");

  dom.layout = document.getElementById("layout");
  dom.panels = {
    members: document.getElementById("members-panel"),
    schedule: document.getElementById("schedule-panel"),
    expenses: document.getElementById("expenses-panel")
  };
  dom.bottomTabs = document.getElementById("bottom-tabs");
}

// ===== INIT FORMS =====

function initForms() {
  // 填入莫蘭迪顏色選單
  MORANDI_COLORS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.hex})`;
    dom.memberColor.appendChild(opt);
  });

  // 成員表單
  dom.memberForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = dom.memberName.value.trim();
    const short = dom.memberShort.value.trim();
    const colorId = dom.memberColor.value || null;
    const note = dom.memberNote.value.trim();

    if (!name || !short) return;

    const color =
      MORANDI_COLORS.find((c) => c.id === colorId) ||
      MORANDI_COLORS[state.members.length % MORANDI_COLORS.length];

    const newMember = {
      id: genId("m"),
      name,
      short: short.slice(0, 2),
      note,
      colorId: color.id,
      colorHex: color.hex
    };
    state.members.push(newMember);
    saveState();

    dom.memberForm.reset();
    renderAll();
  });

  // 行程表單
  dom.scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = dom.scheduleDate.value;
    const title = dom.scheduleTitle.value.trim();
    const time = dom.scheduleTime.value || "";
    const location = dom.scheduleLocation.value.trim();

    if (!date || !title) return;

    const memberIds = Array.from(
      dom.scheduleMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((input) => input.value);

    const schedule = {
      id: genId("s"),
      date,
      time,
      title,
      location,
      memberIds
    };
    state.schedules.push(schedule);
    state.schedules.sort(sortByDateAsc);
    saveState();

    // 保留日期，其餘清空
    dom.scheduleTitle.value = "";
    dom.scheduleLocation.value = "";
    dom.scheduleTime.value = "";
    dom.scheduleMembers
      .querySelectorAll("input[type=checkbox]")
      .forEach((c) => (c.checked = false));

    renderSchedules();
  });

  // 記帳表單
  dom.expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = dom.expenseDate.value || "";
    const title = dom.expenseTitle.value.trim();
    const amount = parseFloat(dom.expenseAmount.value);
    const currency = dom.expenseCurrency.value;
    const rate = parseFloat(dom.expenseRate.value);
    const payerId = dom.expensePayer.value || null;
    const memberIds = Array.from(
      dom.expenseMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((input) => input.value);

    if (!title || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
      return;
    }
    if (memberIds.length === 0) {
      alert("請至少選擇一位分攤成員 / Please select at least one member to share.");
      return;
    }

    const expense = {
      id: genId("e"),
      title,
      date,
      amount,
      currency,
      rate,
      payerId,
      memberIds
    };

    state.expenses.push(expense);
    saveState();

    dom.expenseForm.reset();
    dom.expenseCurrency.value = "TWD";
    updateExpenseRatePlaceholder();
    renderExpenses();
    renderSettlement();
  });

  // 匯率設定
  dom.rateJPY.value = state.settings.rateJPY;
  dom.rateKRW.value = state.settings.rateKRW;

  dom.saveRates.addEventListener("click", () => {
    const rJPY = parseFloat(dom.rateJPY.value);
    const rKRW = parseFloat(dom.rateKRW.value);
    if (!Number.isFinite(rJPY) || rJPY <= 0 || !Number.isFinite(rKRW) || rKRW <= 0) {
      alert("請輸入有效的匯率數值 / Please input valid rates.");
      return;
    }
    state.settings.rateJPY = rJPY;
    state.settings.rateKRW = rKRW;
    saveState();
    updateExpenseRatePlaceholder();
    alert("匯率已更新（僅影響新建立的記帳項目）。");
  });

  dom.expenseCurrency.addEventListener("change", () => {
    updateExpenseRatePlaceholder();
  });

  updateExpenseRatePlaceholder();
}

// 根據幣別預填匯率
function updateExpenseRatePlaceholder() {
  const currency = dom.expenseCurrency.value;
  let rate = 1;
  if (currency === "JPY") rate = state.settings.rateJPY;
  if (currency === "KRW") rate = state.settings.rateKRW;
  dom.expenseRate.value = rate;
}

// ===== RESPONSIVE TABS =====

function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.dataset.target;
      switchPanel(targetId);
    });
  });
}

function switchPanel(panelId) {
  if (!isMobileLayout) return;
  Object.values(dom.panels).forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(panelId);
  if (target) target.classList.add("active");
}

function initResponsive() {
  function handleResize() {
    const mobileNow = window.innerWidth <= 900;
    if (mobileNow !== isMobileLayout) {
      isMobileLayout = mobileNow;
      if (!isMobileLayout) {
        // 桌機：全部顯示
        Object.values(dom.panels).forEach((p) => p.classList.add("active"));
      } else {
        // 手機：只顯示當前 tab
        const activeTab = document.querySelector(".tab-btn.active");
        const targetId = activeTab?.dataset.target || "members-panel";
        switchPanel(targetId);
      }
    }
  }
  window.addEventListener("resize", handleResize);
  handleResize(); // 初始
}

// ===== RENDER =====

function renderAll() {
  renderMembers();
  renderScheduleMemberChips();
  renderExpenseMemberChipsAndPayer();
  renderSchedules();
  renderExpenses();
  renderSettlement();
}

function renderMembers() {
  dom.memberList.innerHTML = "";
  if (state.members.length === 0) return;

  state.members.forEach((m) => {
    const row = document.createElement("div");
    row.className = "member-row";

    const main = document.createElement("div");
    main.className = "member-main";

    const dot = document.createElement("div");
    dot.className = "member-dot";
    dot.textContent = m.short || "?";
    dot.style.backgroundColor = m.colorHex || "#9AA7B1";

    const info = document.createElement("div");
    info.className = "member-info";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = m.name;

    const meta = document.createElement("div");
    meta.className = "member-meta";
    meta.textContent = `${m.short} · ${MORANDI_COLORS.find((c) => c.id === m.colorId)?.name || ""}${
      m.note ? " · " + m.note : ""
    }`;

    info.appendChild(name);
    info.appendChild(meta);

    main.appendChild(dot);
    main.appendChild(info);

    const actions = document.createElement("div");
    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "刪除";
    delBtn.addEventListener("click", () => {
      if (!confirm(`刪除成員「${m.name}」？此操作也會從行程與記帳中移除該成員。`)) return;
      deleteMember(m.id);
    });
    actions.appendChild(delBtn);

    row.appendChild(main);
    row.appendChild(actions);
    dom.memberList.appendChild(row);
  });
}

function deleteMember(memberId) {
  state.members = state.members.filter((m) => m.id !== memberId);

  state.schedules.forEach((s) => {
    s.memberIds = (s.memberIds || []).filter((id) => id !== memberId);
  });

  state.expenses.forEach((e) => {
    e.memberIds = (e.memberIds || []).filter((id) => id !== memberId);
    if (e.payerId === memberId) e.payerId = null;
  });

  saveState();
  renderAll();
}

// 成員複選（行程用）
function renderScheduleMemberChips() {
  dom.scheduleMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const span = document.createElement("span");
    span.className = "chip-label";

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.textContent = m.short || "?";
    dot.style.backgroundColor = m.colorHex || "#9AA7B1";

    const txt = document.createElement("span");
    txt.textContent = m.name;

    span.appendChild(dot);
    span.appendChild(txt);

    label.appendChild(input);
    label.appendChild(span);

    dom.scheduleMembers.appendChild(label);
  });
}

// 成員複選 + 付款人下拉（記帳用）
function renderExpenseMemberChipsAndPayer() {
  // payer select
  dom.expensePayer.innerHTML = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "共同付款 / None";
  dom.expensePayer.appendChild(noneOpt);

  state.members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    dom.expensePayer.appendChild(opt);
  });

  // members chips
  dom.expenseMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const span = document.createElement("span");
    span.className = "chip-label";

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.textContent = m.short || "?";
    dot.style.backgroundColor = m.colorHex || "#9AA7B1";

    const txt = document.createElement("span");
    txt.textContent = m.name;

    span.appendChild(dot);
    span.appendChild(txt);

    label.appendChild(input);
    label.appendChild(span);

    dom.expenseMembers.appendChild(label);
  });
}

// ===== SCHEDULE RENDER & DRAG =====

function renderSchedules() {
  dom.scheduleList.innerHTML = "";

  if (state.schedules.length === 0) return;

  // group by date
  const byDate = {};
  state.schedules.forEach((s) => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  const dates = Object.keys(byDate).sort();

  dates.forEach((date) => {
    const group = document.createElement("div");
    group.className = "schedule-date-group";
    group.dataset.date = date;

    const header = document.createElement("div");
    header.className = "schedule-date-header";
    header.addEventListener("click", () => {
      if (collapsedDates.has(date)) collapsedDates.delete(date);
      else collapsedDates.add(date);
      renderSchedules();
    });

    const headerLeft = document.createElement("div");
    headerLeft.className = "schedule-date-header-left";

    const label = document.createElement("div");
    label.className = "schedule-date-text";
    label.textContent = formatDateLabel(date);

    const sub = document.createElement("div");
    sub.className = "schedule-date-sub";
    sub.textContent = `${byDate[date].length} item(s)`;

    headerLeft.appendChild(label);
    headerLeft.appendChild(sub);

    const toggle = document.createElement("div");
    toggle.className = "schedule-date-toggle";
    toggle.textContent = collapsedDates.has(date) ? "展開 ▾" : "收合 ▴";

    header.appendChild(headerLeft);
    header.appendChild(toggle);

    group.appendChild(header);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "schedule-items";
    itemsContainer.dataset.date = date;

    if (!collapsedDates.has(date)) {
      byDate[date].forEach((s) => {
        const item = document.createElement("div");
        item.className = "schedule-item";
        item.draggable = true;
        item.dataset.id = s.id;
        item.dataset.date = s.date;

        item.addEventListener("dragstart", handleScheduleDragStart);
        item.addEventListener("dragend", handleScheduleDragEnd);
        item.addEventListener("dragover", handleScheduleDragOver);
        item.addEventListener("drop", handleScheduleDrop);

        const main = document.createElement("div");
        main.className = "schedule-main";

        const titleLine = document.createElement("div");
        titleLine.className = "schedule-title-line";

        const title = document.createElement("div");
        title.className = "schedule-title";
        title.textContent = s.title;

        const time = document.createElement("div");
        time.className = "schedule-time";
        time.textContent = s.time ? s.time : "";

        titleLine.appendChild(title);
        if (s.time) titleLine.appendChild(time);

        const loc = document.createElement("div");
        loc.className = "schedule-location";
        loc.textContent = s.location || "";

        const membersWrap = document.createElement("div");
        membersWrap.className = "schedule-members";

        (s.memberIds || []).forEach((id) => {
          const m = findMember(id);
          if (!m) return;
          const dot = document.createElement("div");
          dot.className = "member-dot small";
          dot.textContent = m.short || "?";
          dot.style.backgroundColor = m.colorHex || "#9AA7B1";
          membersWrap.appendChild(dot);
        });

        main.appendChild(titleLine);
        if (s.location) main.appendChild(loc);
        if ((s.memberIds || []).length) main.appendChild(membersWrap);

        const side = document.createElement("div");
        side.style.display = "flex";
        side.style.flexDirection = "column";
        side.style.gap = "4px";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn small secondary";
        deleteBtn.textContent = "刪除";
        deleteBtn.addEventListener("click", () => {
          if (!confirm(`刪除行程「${s.title}」？`)) return;
          state.schedules = state.schedules.filter((x) => x.id !== s.id);
          saveState();
          renderSchedules();
        });

        side.appendChild(deleteBtn);

        item.appendChild(main);
        item.appendChild(side);

        itemsContainer.appendChild(item);
      });
    }

    group.appendChild(itemsContainer);
    dom.scheduleList.appendChild(group);
  });
}

function handleScheduleDragStart(e) {
  const id = e.currentTarget.dataset.id;
  draggingScheduleId = id;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.classList.add("dragging");
}

function handleScheduleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  draggingScheduleId = null;
  document
    .querySelectorAll(".schedule-item.drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
}

function handleScheduleDragOver(e) {
  e.preventDefault();
  if (!draggingScheduleId) return;

  const target = e.currentTarget;
  const targetId = target.dataset.id;
  const targetDate = target.dataset.date;
  const dragItem = state.schedules.find((s) => s.id === draggingScheduleId);
  if (!dragItem) return;
  if (dragItem.date !== targetDate) return; // 不跨日期

  // highlight
  document
    .querySelectorAll(".schedule-item.drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
  target.classList.add("drag-over");
}

function handleScheduleDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove("drag-over");
  if (!draggingScheduleId) return;

  const targetId = target.dataset.id;
  const targetDate = target.dataset.date;
  const dragItem = state.schedules.find((s) => s.id === draggingScheduleId);
  if (!dragItem || dragItem.date !== targetDate) return;

  // 在同日期內重新排序
  const sameDate = state.schedules.filter((s) => s.date === targetDate);
  const other = state.schedules.filter((s) => s.date !== targetDate);

  const ids = sameDate.map((s) => s.id).filter((id) => id !== draggingScheduleId);
  const targetIndex = ids.indexOf(targetId);
  if (targetIndex === -1) return;
  ids.splice(targetIndex, 0, draggingScheduleId);

  const newSame = ids.map((id) => sameDate.find((s) => s.id === id));
  state.schedules = [...other, ...newSame].sort(sortByDateAsc);
  saveState();
  renderSchedules();
}

// ===== EXPENSES =====

function renderExpenses() {
  dom.expenseList.innerHTML = "";
  if (state.expenses.length === 0) return;

  state.expenses.forEach((e) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const main = document.createElement("div");
    main.className = "expense-main";

    const titleLine = document.createElement("div");
    titleLine.className = "expense-title-line";

    const title = document.createElement("span");
    title.textContent = e.title;

    const amount = document.createElement("span");
    amount.textContent = `${e.amount.toFixed(0)} ${e.currency}`;
    amount.style.fontWeight = "500";

    titleLine.appendChild(title);
    titleLine.appendChild(amount);

    const meta = document.createElement("div");
    meta.className = "expense-meta";

    const payer =
      e.payerId && findMember(e.payerId)
        ? `付款人：${findMember(e.payerId).name}；`
        : `付款人：共同 / Multiple；`;

    const membersText = (e.memberIds || [])
      .map((id) => findMember(id)?.short || "?")
      .join("、");

    const twdAmount = e.amount * e.rate;
    const share = (e.memberIds || []).length ? twdAmount / e.memberIds.length : 0;

    meta.textContent = `${e.date || "無日期"} · ${payer} 分攤：${membersText || "－"} · ≈ ${formatTwd(
      twdAmount
    )} ，每人約 ${formatTwd(share)}`;

    main.appendChild(titleLine);
    main.appendChild(meta);

    const side = document.createElement("div");
    const delBtn = document.createElement("button");
    delBtn.className = "btn small secondary";
    delBtn.textContent = "刪除";
    delBtn.addEventListener("click", () => {
      if (!confirm(`刪除記帳項目「${e.title}」？`)) return;
      state.expenses = state.expenses.filter((x) => x.id !== e.id);
      saveState();
      renderExpenses();
      renderSettlement();
    });

    side.appendChild(delBtn);

    row.appendChild(main);
    row.appendChild(side);

    dom.expenseList.appendChild(row);
  });
}

// ===== SETTLEMENT =====

function computeBalances() {
  const balances = {};
  state.members.forEach((m) => {
    balances[m.id] = {
      member: m,
      paid: 0,
      owed: 0
    };
  });

  state.expenses.forEach((e) => {
    const members = e.memberIds || [];
    if (members.length === 0) return;

    const twdAmount = e.amount * e.rate;
    const share = twdAmount / members.length;

    // 付款人付了全額
    if (e.payerId && balances[e.payerId]) {
      balances[e.payerId].paid += twdAmount;
    } else if (!e.payerId) {
      // 共同付款：視為每人先各付 share（所以 paid += share）
      members.forEach((id) => {
        if (balances[id]) balances[id].paid += share;
      });
    }

    // 每人應付 share
    members.forEach((id) => {
      if (balances[id]) balances[id].owed += share;
    });
  });

  return Object.values(balances).map((b) => ({
    member: b.member,
    balance: b.paid - b.owed
  }));
}

function renderSettlement() {
  const balanceList = computeBalances();

  // 個人總結
  dom.balanceSummary.innerHTML = "";
  if (balanceList.length === 0) return;

  balanceList.forEach((b) => {
    const li = document.createElement("li");
    li.className = "balance-item";

    const left = document.createElement("div");
    left.className = "balance-name";

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.textContent = b.member.short || "?";
    dot.style.backgroundColor = b.member.colorHex || "#9AA7B1";

    const name = document.createElement("span");
    name.textContent = b.member.name;

    left.appendChild(dot);
    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "balance-amount";
    right.textContent = formatTwd(Math.abs(b.balance)) + (b.balance >= 0 ? " 應收" : " 應付");
    if (b.balance > 0.5) right.classList.add("positive");
    if (b.balance < -0.5) right.classList.add("negative");

    li.appendChild(left);
    li.appendChild(right);
    dom.balanceSummary.appendChild(li);
  });

  // pairwise
  renderPairwise(balanceList);
}

function renderPairwise(balanceList) {
  dom.pairwiseList.innerHTML = "";

  const creditors = [];
  const debtors = [];

  balanceList.forEach((b) => {
    if (b.balance > 0.5) {
      creditors.push({ member: b.member, amount: b.balance });
    } else if (b.balance < -0.5) {
      debtors.push({ member: b.member, amount: -b.balance });
    }
  });

  if (!creditors.length && !debtors.length) {
    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = "所有人的結餘皆已平衡，無需結算。";
    dom.pairwiseList.appendChild(li);
    return;
  }

  // greedy match
  let i = 0;
  let j = 0;
  const transactions = [];

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amt = Math.min(debtor.amount, creditor.amount);

    if (amt > 0.5) {
      transactions.push({
        from: debtor.member,
        to: creditor.member,
        amount: amt
      });
    }

    debtor.amount -= amt;
    creditor.amount -= amt;

    if (debtor.amount <= 0.5) i++;
    if (creditor.amount <= 0.5) j++;
  }

  if (!transactions.length) {
    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = "無需進一步結算。";
    dom.pairwiseList.appendChild(li);
    return;
  }

  transactions.forEach((t) => {
    const li = document.createElement("li");
    li.className = "pairwise-item";
    li.textContent = `${t.from.name} → ${t.to.name}：${formatTwd(t.amount)}`;
    dom.pairwiseList.appendChild(li);
  });
}
