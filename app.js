console.log("app.js loaded");
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
      members: parsed.members?.map(m => ({ ...m, demerits: m.demerits || 0 })) || [],
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
  console.log("DOMContentLoaded event fired. Initializing app...");
  cacheDom();
  initForms();
  // initSplitter(); // Removed
  renderAll();
});

function cacheDom() {
  // Modal elements
  dom.memberModal = document.getElementById("member-modal");
  dom.modalMemberForm = document.getElementById("modal-member-form");
  dom.modalMemberName = document.getElementById("modal-member-name");
  dom.modalMemberShort = document.getElementById("modal-member-short");
  dom.modalMemberNote = document.getElementById("modal-member-note");
  dom.modalColorOptions = document.getElementById("modal-color-options");
  dom.modalCancelBtn = document.getElementById("modal-cancel-btn");
  dom.memberDetailModal = document.getElementById("member-detail-modal");
  dom.memberDetailContent = document.getElementById("member-detail-content");

  // Main UI
  dom.memberDotPreview = document.getElementById("member-dot-preview");
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
  dom.scheduleForm = document.getElementById("schedule-form");
  dom.scheduleDate = document.getElementById("schedule-date");
  dom.scheduleTime = document.getElementById("schedule-time");
  dom.scheduleTitle = document.getElementById("schedule-title");
  dom.scheduleLocation = document.getElementById("schedule-location");
  dom.scheduleMembers = document.getElementById("schedule-members");
  dom.scheduleList = document.getElementById("schedule-list");
  dom.leftColumn = document.getElementById("left-column");
  // dom.splitter = document.getElementById("splitter"); // Removed
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

  // New member modal logic
  dom.modalMemberForm.addEventListener("submit", handleAddMember);
  dom.modalCancelBtn.addEventListener("click", closeMemberModal);

  // --- Old member form logic removed ---

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
  renderMemberDotPreview();
  renderMemberChipsForExpenses();
  renderMemberChipsForSchedule();
  renderSchedules();
}

/* Member Modal */
let selectedColor = null;

function openMemberModal() {
  dom.modalMemberForm.reset();
  dom.memberModal.classList.remove("hidden");
}

function closeMemberModal() {
  dom.memberModal.classList.add("hidden");
}

function handleAddMember(e) {
  e.preventDefault();
  const name = dom.modalMemberName.value.trim();
  if (!name) {
    alert("請輸入姓名");
    return;
  }

  // Auto-assign color, with fallback
  const usedColors = new Set(state.members.map(m => m.colorHex));
  let newMemberColor = MORANDI_COLORS.find(c => !usedColors.has(c));

  if (!newMemberColor) {
    newMemberColor = "#808080"; // Default gray
    alert("預設顏色已用完，將使用灰色作為替代。");
  }

  const shortRaw = dom.modalMemberShort.value.trim();
  const short = shortRaw || (name[1] || name[0] || "?").slice(0, 2);
  const note = dom.modalMemberNote.value.trim();

  state.members.push({ id: genId("m"), name, short, note, colorHex: newMemberColor, demerits: 0 });
  saveState();
  closeMemberModal();
  renderAll();
}

/* Member Detail Modal */
function deleteMember(memberId) {
  const member = findMember(memberId);
  if (!member) return;

  if (confirm(`確定要刪除成員「${member.name}」？此操作無法復原。`)) {
    state.members = state.members.filter((x) => x.id !== memberId);
    // Cascade delete
    state.schedules.forEach((s) => s.memberIds = s.memberIds.filter((id) => id !== memberId));
    state.expenses.forEach((e) => {
      e.memberIds = e.memberIds.filter((id) => id !== memberId);
      if (e.payerId === memberId) e.payerId = null;
    });
    
    saveState();
    closeMemberDetailModal();
    renderAll();
  }
}

document.addEventListener("keydown", (e) => {
  if (dom.memberDetailModal.classList.contains("hidden")) return;

  const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
  if (isInput) return;

  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault(); // Prevent browser back navigation on backspace
    const memberId = dom.memberDetailModal.dataset.memberId;
    if (memberId) {
      deleteMember(memberId);
    }
  }
});

function openMemberDetailModal(memberId) {
  const member = findMember(memberId);
  if (!member) return;

  dom.memberDetailModal.dataset.memberId = memberId;

  const settlementHTML = '';

  dom.memberDetailContent.innerHTML = `
    <h3>
      <div class="member-dot" style="background-color:${member.colorHex};">${member.short}</div>
      <span>${member.name}</span>
    </h3>
    ${member.note ? `<p class="member-note">${member.note}</p>` : ''}
    <div class="demerit-counter">
      <span><strong>計點：</strong></span>
      <span class="demerit-count">${member.demerits}</span>
      <button id="add-demerit-btn" class="btn secondary">+</button>
    </div>
    <div class="form-actions" style="margin-top: 20px;">
      <button id="delete-member-btn" class="btn danger">刪除成員</button>
    </div>
  `;

  document.getElementById("add-demerit-btn").onclick = () => {
    member.demerits += 1;
    saveState();
    openMemberDetailModal(memberId); // Re-render
  };

  document.getElementById("delete-member-btn").onclick = () => deleteMember(memberId);
  
  dom.memberDetailModal.onclick = (e) => {
    if (e.target === dom.memberDetailModal) {
      closeMemberDetailModal();
    }
  };

  dom.memberDetailModal.classList.remove("hidden");
}

function closeMemberDetailModal() {
  dom.memberDetailModal.classList.add("hidden");
}


/* Member Preview */
function renderMemberDotPreview() {
  dom.memberDotPreview.innerHTML = "";
  
  state.members.forEach(m => {
    const dot = document.createElement("div");
    dot.className = "member-dot";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;
    dot.title = m.name;
    dot.style.cursor = 'pointer';

    dot.onclick = () => openMemberDetailModal(m.id);

    dot.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!confirm(`刪除成員「${m.name}」？`)) return;
      state.members = state.members.filter((x) => x.id !== m.id);
      // Cascade delete logic
      state.schedules.forEach((s) => s.memberIds = s.memberIds.filter((id) => id !== m.id));
      state.expenses.forEach((e) => {
        e.memberIds = e.memberIds.filter((id) => id !== m.id);
        if (e.payerId === m.id) e.payerId = null;
      });
      saveState();
      renderAll();
    });

    dom.memberDotPreview.appendChild(dot);
  });

  // Add the "+" button
  const addButton = document.createElement("button");
  addButton.className = "add-member-btn";
  addButton.textContent = "+";
  addButton.onclick = openMemberModal;
  dom.memberDotPreview.appendChild(addButton);
}


/* Member Chips */

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
    label.title = m.name; // Show name on hover
    label.onclick = (e) => {
      // Prevent checkbox from toggling when opening modal
      if (e.target.tagName !== "INPUT") {
        e.preventDefault();
        openMemberDetailModal(m.id);
      }
    };

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    label.appendChild(input);
    label.appendChild(dot);
    dom.expenseMembers.appendChild(label);
  });
}

function renderMemberChipsForSchedule() {
  dom.scheduleMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.title = m.name; // Show name on hover
    label.onclick = (e) => {
      // Prevent checkbox from toggling when opening modal
      if (e.target.tagName !== "INPUT") {
        e.preventDefault();
        openMemberDetailModal(m.id);
      }
    };

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    label.appendChild(input);
    label.appendChild(dot);
    dom.scheduleMembers.appendChild(label);
  });
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

        const memberDotsContainer = document.createElement("div");
        memberDotsContainer.className = "schedule-item-members";
        s.memberIds.forEach(memberId => {
          const member = findMember(memberId);
          if (member) {
            const dot = document.createElement("div");
            dot.className = "member-dot small";
            dot.style.backgroundColor = member.colorHex;
            dot.textContent = member.short;
            dot.title = member.name; // Tooltip with full name
            memberDotsContainer.appendChild(dot);
          }
        });
        if(s.memberIds.length > 0) {
          left.appendChild(memberDotsContainer);
        }

        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (!confirm(`刪除行程「${s.title}」？`)) return;
          state.schedules = state.schedules.filter((x) => x.id !== s.id);
          saveState();
          renderSchedules();
        });

        item.appendChild(left);

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

// The entire initSplitter function has been removed as it's obsolete.
