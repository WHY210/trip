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
      members: parsed.members?.map(m => ({ ...m, demerits: m.demerits || [] })) || [],
      schedules: parsed.schedules || [],
      expenses: parsed.expenses || [],
      memo: parsed.memo || "",
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
      memo: "",
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
  dom.expenseForm = document.getElementById("expense-form");
  dom.expenseDate = document.getElementById("expense-date");
  dom.expenseAmount = document.getElementById("expense-amount");
  dom.expenseTitle = document.getElementById("expense-title");
  dom.expenseCategory = document.getElementById("expense-category");
  dom.expensePayer = document.getElementById("expense-payer");
  dom.expenseMembers = document.getElementById("expense-members");
  dom.currencySelector = document.getElementById("currency-selector");
  dom.scheduleForm = document.getElementById("schedule-form");
  dom.scheduleDate = document.getElementById("schedule-date");
  dom.scheduleTitle = document.getElementById("schedule-title");
  dom.scheduleMembers = document.getElementById("schedule-members");
  dom.scheduleList = document.getElementById("schedule-list");
  dom.leftColumn = document.getElementById("left-column");
  dom.tripTitle = document.getElementById("trip-title");
  dom.sharedMemo = document.getElementById("shared-memo");

  // Schedule Detail Modal
  dom.scheduleDetailModal = document.getElementById("schedule-detail-modal");
  dom.scheduleDetailContent = document.getElementById("schedule-detail-content");
  dom.scheduleDetailTitle = document.getElementById("schedule-detail-title");
  dom.scheduleDetailMembers = document.getElementById("schedule-detail-members");
  dom.scheduleDetailDetails = document.getElementById("schedule-detail-details");
  dom.scheduleDetailMapLink = document.getElementById("schedule-detail-map-link");
  dom.scheduleMapLinkPreview = document.getElementById("schedule-map-link-preview");
  dom.scheduleDetailDeleteBtn = document.getElementById("schedule-detail-delete-btn");
  dom.scheduleDetailSaveBtn = document.getElementById("schedule-detail-save-btn");
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
    } else {
      dom.tripTitle.value = state.tripName;
    }
  });

  // New member modal logic
  dom.modalMemberForm.addEventListener("submit", handleAddMember);
  dom.modalCancelBtn.addEventListener("click", closeMemberModal);

  // Currency Selector
  initCurrencySelector();

  // Shared Memo
  dom.sharedMemo.value = state.memo;
  dom.sharedMemo.addEventListener("input", () => {
    state.memo = dom.sharedMemo.value;
    saveState();
  });

  // Expense Form
  dom.expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat(dom.expenseAmount.value);
    if (!(amount > 0)) {
      alert("金額錯誤");
      return;
    }

    const activeOption = dom.currencySelector.querySelector('.currency-option.active');
    const currency = activeOption.dataset.currency;
    const rateInput = activeOption.querySelector('input');
    const rate = parseFloat(rateInput.value);

    if (!(rate > 0)) {
      alert("匯率錯誤");
      return;
    }

    const date = dom.expenseDate.value;
    const title = dom.expenseTitle.value.trim();
    const category = dom.expenseCategory.value.trim();
    if (!title) return;
    
    const payerInput = dom.expensePayer.querySelector('input[name="payer"]:checked');
    const payerId = payerInput ? payerInput.value : null;

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
      category,
      payerId,
      memberIds
    });
    saveState();
    dom.expenseForm.reset();
    renderCurrencySelector(); // Reset to default view
  });

  // Schedule Form
  dom.scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = dom.scheduleDate.value;
    const title = dom.scheduleTitle.value.trim();
    if (!date || !title) return;
    const memberIds = Array.from(
      dom.scheduleMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((i) => i.value);

    state.schedules.push({
      id: genId("s"),
      date,
      time: "",
      title,
      location: "",
      details: "",
      mapLink: "",
      memberIds
    });
    saveState();
    dom.scheduleForm.reset();
    renderSchedules();
  });
}

function renderCurrencySelector() {
  const currencies = [
    { key: "TWD", rate: 1.0, disabled: true },
    { key: "JPY", rate: state.settings.rateJPY },
    { key: "KRW", rate: state.settings.rateKRW },
  ];

  dom.currencySelector.innerHTML = currencies.map((c, index) => `
    <div class="currency-option ${index === 0 ? 'active' : ''}" data-currency="${c.key}">
      <span>${c.key}</span>
      <input type="number" value="${c.rate}" ${c.disabled ? 'disabled' : ''} min="0" step="0.0001">
    </div>
  `).join('');
}

function initCurrencySelector() {
  renderCurrencySelector();

  dom.currencySelector.addEventListener('click', (e) => {
    const targetOption = e.target.closest('.currency-option');
    if (targetOption) {
      dom.currencySelector.querySelectorAll('.currency-option').forEach(opt => {
        opt.classList.remove('active');
      });
      targetOption.classList.add('active');
    }
  });

  dom.currencySelector.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT') {
      const currency = e.target.parentElement.dataset.currency;
      const newRate = parseFloat(e.target.value);
      if (currency === 'JPY' && newRate > 0) {
        state.settings.rateJPY = newRate;
        saveState();
      } else if (currency === 'KRW' && newRate > 0) {
        state.settings.rateKRW = newRate;
        saveState();
      }
    }
  });
}

/* Render all */

function renderAll() {
  renderMemberDotPreview();
  renderPayerChips();
  renderSharedMemberChips();
  renderMemberChipsForSchedule();
  renderSchedules();
}

/* Member Modal */

let selectedColor = null;



function openMemberModal() {



  dom.modalMemberForm.reset();



  dom.memberModal.classList.remove("hidden");



  dom.memberModal.querySelector('.close-btn').onclick = closeMemberModal;



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



  state.members.push({ id: genId("m"), name, short, note, colorHex: newMemberColor, demerits: [] });

  saveState();

  closeMemberModal();

  renderAll();

}



/* Member Detail Modal */



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



function calculateMemberTotalExpenses(memberId) {

  let total = 0;

  state.expenses.forEach(e => {

    if (e.memberIds.includes(memberId)) {

      const share = (e.amount * e.rate) / e.memberIds.length;

      total += share;

    }

  });

  return total;

}



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



  // Calculations

  const totalExpenses = calculateMemberTotalExpenses(memberId);

  const allBalances = computeBalances();

  const creditors = allBalances.filter(b => b.balance > 0).map(b => ({ member: b.member, amount: Math.round(b.balance) }));

  const debtors = allBalances.filter(b => b.balance < 0).map(b => ({ member: b.member, amount: -Math.round(b.balance) }));

  

  const settlementLines = [];

  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {

    const d = { ...debtors[i] };

    const c = { ...creditors[j] };

    const x = Math.min(d.amount, c.amount);



    if (d.member.id === memberId) {

      settlementLines.push(`<li>需付給 <strong>${c.member.name}</strong>：${x} TWD</li>`);

    }

    if (c.member.id === memberId) {

      settlementLines.push(`<li>可從 <strong>${d.member.name}</strong> 收取：${x} TWD</li>`);

    }



    debtors[i].amount -= x;

    creditors[j].amount -= x;

    if (debtors[i].amount < 1) i++;

    if (creditors[j].amount < 1) j++;

  }

  const settlementHTML = settlementLines.length > 0 ? `<ul>${settlementLines.join('')}</ul>` : '<p>此成員目前帳務平衡。</p>';



  const relatedExpenses = state.expenses.filter(e => e.payerId === memberId || e.memberIds.includes(memberId));

  const expensesHTML = relatedExpenses.length > 0 ? `<ul>${relatedExpenses.map(e => {

    const payerName = e.payerId ? (findMember(e.payerId)?.name || '未知') : '共同';

    return `<li><strong>${e.title}</strong> (${Math.round(e.amount * e.rate)} TWD) - 由 ${payerName} 支付</li>`;

  }).join('')}</ul>` : '<p>沒有相關的記帳項目。</p>';



  const demeritHistoryHTML = member.demerits.length > 0 ? `<ul>${member.demerits.map(d => `<li>${d.reason}</li>`).join('')}</ul>` : '<p>沒有任何計點紀錄。</p>';



  // Build the modal content

  dom.memberDetailContent.innerHTML = `

    <h3>

      <div class="member-dot" style="background-color:${member.colorHex};">${member.short}</div>

      <span>${member.name}</span>

    </h3>

    ${member.note ? `<p class="member-note">${member.note}</p>` : ''}

    

    <div class="detail-section">

      <h4>個人總花費</h4>

      <p>${Math.round(totalExpenses)} TWD</p>

    </div>



    <div class="detail-section">

      <h4>結算詳情</h4>

      ${settlementHTML}

    </div>



    <div class="detail-section">

      <h4>搞事計點 (${member.demerits.length}點)</h4>

      <div id="demerit-history">${demeritHistoryHTML}</div>

      <div class="form-grid" style="margin-top: 8px;">

        <input type="text" id="new-demerit-reason" placeholder="搞事事由" />

        <button id="add-demerit-btn" class="btn secondary">新增計點</button>

      </div>

    </div>



    <div class="detail-section">

      <h4>相關帳目</h4>

      ${expensesHTML}

    </div>



    <div class="form-actions" style="margin-top: 20px;">

      <button id="delete-member-btn" class="btn danger">刪除成員</button>

    </div>

  `;



  // Event Listeners

  document.getElementById("add-demerit-btn").onclick = () => {

    const reasonInput = document.getElementById("new-demerit-reason");

    const reason = reasonInput.value.trim();

    if (!reason) {

      alert("請輸入事由");

      return;

    }

    member.demerits.push({ id: genId('d'), reason });

    saveState();

    openMemberDetailModal(memberId); // Re-render the modal

  };



  document.getElementById("delete-member-btn").addEventListener("click", () => deleteMember(memberId));

  

    dom.memberDetailModal.onclick = (e) => {

  

      if (e.target === dom.memberDetailModal) {

  

        closeMemberDetailModal();

  

      }

  

    };

  

  

  

    dom.memberDetailModal.querySelector('.close-btn').onclick = closeMemberDetailModal;

  

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

function renderPayerChips() {
  dom.expensePayer.innerHTML = "";

  // Add "Common Payer" option
  const commonLabel = document.createElement("label");
  commonLabel.className = "chip";
  commonLabel.title = "共同付款";
  const commonInput = document.createElement("input");
  commonInput.type = "radio";
  commonInput.name = "payer";
  commonInput.value = "";
  commonInput.checked = true;
  const commonText = document.createElement("span");
  commonText.textContent = "共同";
  commonLabel.appendChild(commonInput);
  commonLabel.appendChild(commonText);
  dom.expensePayer.appendChild(commonLabel);

  // Add member options
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.title = m.name;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "payer";
    input.value = m.id;

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    label.appendChild(input);
    label.appendChild(dot);
    dom.expensePayer.appendChild(label);
  });
}

function renderSharedMemberChips() {
  dom.expenseMembers.innerHTML = "";

  const updateSelectAllState = () => {
    const memberCheckboxes = dom.expenseMembers.querySelectorAll('.member-checkbox');
    const selectAllCheckbox = dom.expenseMembers.querySelector('#select-all-checkbox');
    if (!selectAllCheckbox) return;
    
    const allChecked = [...memberCheckboxes].every(c => c.checked);
    selectAllCheckbox.checked = allChecked;
  };

  // Add "Select All" option
  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "chip";
  const selectAllInput = document.createElement("input");
  selectAllInput.type = "checkbox";
  selectAllInput.id = "select-all-checkbox";
  selectAllInput.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    dom.expenseMembers.querySelectorAll('.member-checkbox').forEach(c => {
      c.checked = isChecked;
    });
  });
  const selectAllText = document.createElement("span");
  selectAllText.textContent = "全選";
  selectAllLabel.appendChild(selectAllInput);
  selectAllLabel.appendChild(selectAllText);
  dom.expenseMembers.appendChild(selectAllLabel);

  // Add member options
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.title = m.name; // Show name on hover

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;
    input.classList.add('member-checkbox');
    input.addEventListener('change', updateSelectAllState);

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

  const updateSelectAllState = () => {
    const memberCheckboxes = dom.scheduleMembers.querySelectorAll('.schedule-member-checkbox');
    const selectAllCheckbox = dom.scheduleMembers.querySelector('#schedule-select-all-checkbox');
    if (!selectAllCheckbox) return;
    
    const allChecked = [...memberCheckboxes].every(c => c.checked);
    selectAllCheckbox.checked = allChecked;
  };

  // Add "Select All" option
  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "chip";
  const selectAllInput = document.createElement("input");
  selectAllInput.type = "checkbox";
  selectAllInput.id = "schedule-select-all-checkbox";
  selectAllInput.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    dom.scheduleMembers.querySelectorAll('.schedule-member-checkbox').forEach(c => {
      c.checked = isChecked;
    });
  });
  const selectAllText = document.createElement("span");
  selectAllText.textContent = "全選";
  selectAllLabel.appendChild(selectAllInput);
  selectAllLabel.appendChild(selectAllText);
  dom.scheduleMembers.appendChild(selectAllLabel);

  // Add member options
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.title = m.name; // Show name on hover

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;
    input.classList.add('schedule-member-checkbox');
    input.addEventListener('change', updateSelectAllState);

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    label.appendChild(input);
    label.appendChild(dot);
    dom.scheduleMembers.appendChild(label);
  });
}

/* Schedule Detail Modal */
function closeScheduleDetailModal() {
  dom.scheduleDetailModal.classList.add("hidden");
}

function renderMemberChipsForScheduleDetail(schedule) {
  dom.scheduleDetailMembers.innerHTML = "";
  state.members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.title = m.name;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = m.id;
    if (schedule.memberIds.includes(m.id)) {
      input.checked = true;
    }

    const dot = document.createElement("div");
    dot.className = "member-dot small";
    dot.style.backgroundColor = m.colorHex;
    dot.textContent = m.short;

    label.appendChild(input);
    label.appendChild(dot);
    dom.scheduleDetailMembers.appendChild(label);
  });
}

function openScheduleDetailModal(scheduleId) {
  const schedule = state.schedules.find(s => s.id === scheduleId);
  if (!schedule) return;

  // Populate modal
  dom.scheduleDetailTitle.value = schedule.title;
  dom.scheduleDetailDetails.value = schedule.details || "";
  dom.scheduleDetailMapLink.value = schedule.mapLink || "";
  
  if (schedule.mapLink) {
    dom.scheduleMapLinkPreview.innerHTML = `<a href="${schedule.mapLink}" target="_blank">在地圖上查看</a>`;
  } else {
    dom.scheduleMapLinkPreview.innerHTML = "";
  }

  renderMemberChipsForScheduleDetail(schedule);

  // Setup event listeners
  dom.scheduleDetailModal.querySelector('.close-btn').onclick = closeScheduleDetailModal;
  dom.scheduleDetailModal.onclick = (e) => {
    if (e.target === dom.scheduleDetailModal) {
      closeScheduleDetailModal();
    }
  };

  dom.scheduleDetailSaveBtn.onclick = () => {
    // Collect new data
    schedule.title = dom.scheduleDetailTitle.value.trim();
    schedule.details = dom.scheduleDetailDetails.value.trim();
    schedule.mapLink = dom.scheduleDetailMapLink.value.trim();
    schedule.memberIds = Array.from(
      dom.scheduleDetailMembers.querySelectorAll("input[type=checkbox]:checked")
    ).map((i) => i.value);

    if (!schedule.title) {
      alert("名稱不可為空");
      return;
    }

    saveState();
    closeScheduleDetailModal();
    renderSchedules();
  };

  dom.scheduleDetailDeleteBtn.onclick = () => {
    if (confirm(`確定要刪除行程「${schedule.title}」？`)) {
      state.schedules = state.schedules.filter(s => s.id !== scheduleId);
      saveState();
      closeScheduleDetailModal();
      renderSchedules();
    }
  };

  // Show modal
  dom.scheduleDetailModal.classList.remove("hidden");
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

        // Long-press and context menu logic
        let pressTimer = null;
        const startPress = (e) => {
          pressTimer = setTimeout(() => {
            e.preventDefault();
            openScheduleDetailModal(s.id);
          }, 500); // 500ms for long press
        };
        const cancelPress = () => {
          clearTimeout(pressTimer);
        };
        
        item.addEventListener("mousedown", startPress);
        item.addEventListener("touchstart", startPress);
        item.addEventListener("mouseup", cancelPress);
        item.addEventListener("mouseleave", cancelPress);
        item.addEventListener("touchend", cancelPress);
        item.addEventListener("touchcancel", cancelPress);
        
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          openScheduleDetailModal(s.id);
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
