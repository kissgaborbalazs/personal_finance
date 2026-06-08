import { itemsRepo, valuesRepo, balancesRepo, rateRepo, isItemActiveInMonth } from './db.js';

// ── Állapot ───────────────────────────────────────────────────────────────────
const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    view: 'month',      // 'month' | 'year' | 'settings'
    items: [],
    values: {},         // { item_id: { amount, is_paid } }
    balances: {},       // { item_id: balance }
    eurRate: 395,
    loading: true,
};

const MONTHS_HU = ['Január','Február','Március','Április','Május','Június',
                   'Július','Augusztus','Szeptember','Október','November','December'];

// ── Formázás ──────────────────────────────────────────────────────────────────
const fmt = (n) => Math.round(n).toLocaleString('hu-HU') + ' Ft';
const fmtEur = (n) => n.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

// ── Aktív tételek az adott hónapban ──────────────────────────────────────────
const activeItems = (type) =>
    state.items.filter(i => i.type === type && i.is_active && isItemActiveInMonth(i, state.year, state.month));

// ── Összeg lekérése (default az item-en tárolt vagy 0) ───────────────────────
const getAmount = (item) => state.values[item.id]?.amount ?? 0;
const isPaid   = (item) => state.values[item.id]?.is_paid ?? false;
const getBalance = (item) => state.balances[item.id] ?? 0;
const toHUF = (item, val) => item.currency === 'EUR' ? val * state.eurRate : val;

// ── Betöltés ──────────────────────────────────────────────────────────────────
async function loadData() {
    state.loading = true;
    render();

    const [itemsRes, valuesRes, balancesRes, rate] = await Promise.all([
        itemsRepo.getAll(),
        valuesRepo.getForMonth(state.year, state.month),
        balancesRepo.getForMonth(state.year, state.month),
        rateRepo.get(),
    ]);

    state.items    = itemsRes.data ?? [];
    state.eurRate  = rate;
    state.values   = Object.fromEntries((valuesRes.data ?? []).map(v => [v.item_id, v]));
    state.balances = Object.fromEntries((balancesRes.data ?? []).map(b => [b.item_id, b.balance]));
    state.loading  = false;
    render();
}

// ── Kifizetés toggle ──────────────────────────────────────────────────────────
async function togglePaid(item) {
    const current = isPaid(item);
    const newVal = !current;
    if (!state.values[item.id]) state.values[item.id] = { amount: 0, is_paid: false };
    state.values[item.id].is_paid = newVal;
    render();
    await valuesRepo.upsert(item.id, state.year, state.month, getAmount(item), newVal);
    toast(newVal ? '✓ Kifizetve' : 'Visszavonva', newVal ? 'success' : '');
}

// ── Összeg mentése ────────────────────────────────────────────────────────────
async function saveAmount(item, rawValue) {
    const amount = parseInt(rawValue.replace(/\D/g, ''), 10) || 0;
    if (!state.values[item.id]) state.values[item.id] = { amount: 0, is_paid: false };
    state.values[item.id].amount = amount;
    render();
    await valuesRepo.upsert(item.id, state.year, state.month, amount, isPaid(item));
}

// ── Egyenleg mentése ──────────────────────────────────────────────────────────
async function saveBalance(item, rawValue) {
    const balance = parseInt(rawValue.replace(/\D/g, ''), 10) || 0;
    state.balances[item.id] = balance;
    render();
    await balancesRepo.upsert(item.id, state.year, state.month, balance);
}

// ── Hónap navigáció ───────────────────────────────────────────────────────────
function prevMonth() {
    if (state.month === 1) { state.month = 12; state.year--; }
    else state.month--;
    loadData();
}
function nextMonth() {
    if (state.month === 12) { state.month = 1; state.year++; }
    else state.month++;
    loadData();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

// ── Modal: tétel hozzáadása ───────────────────────────────────────────────────
function showAddItemModal(type) {
    const typeLabels = { income: 'bevétel', expense: 'kiadás', saving: 'megtakarítás', liquid: 'likvid számla' };
    const html = `
    <div class="modal-overlay" id="modal">
      <div class="modal">
        <div class="modal-title">Új ${typeLabels[type]}</div>
        <div class="form-group">
          <label class="form-label">Megnevezés</label>
          <input class="form-input" id="f-name" placeholder="pl. Villanyóra" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Deviza</label>
            <select class="form-select" id="f-currency">
              <option value="HUF">HUF</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ismétlés (hónap)</label>
            <input class="form-input" id="f-repeat" type="number" value="1" min="1" max="24">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kezdő év</label>
            <input class="form-input" id="f-sy" type="number" value="${state.year}">
          </div>
          <div class="form-group">
            <label class="form-label">Kezdő hónap</label>
            <input class="form-input" id="f-sm" type="number" value="${state.month}" min="1" max="12">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Záró év (opcionális)</label>
            <input class="form-input" id="f-ey" type="number" placeholder="–">
          </div>
          <div class="form-group">
            <label class="form-label">Záró hónap</label>
            <input class="form-input" id="f-em" type="number" placeholder="–" min="1" max="12">
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeModal()">Mégse</button>
          <button class="btn btn-primary" onclick="submitAddItem('${type}')">Mentés</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
}

window.closeModal = () => document.getElementById('modal')?.remove();

window.submitAddItem = async (type) => {
    const name    = document.getElementById('f-name').value.trim();
    const currency = document.getElementById('f-currency').value;
    const repeat  = parseInt(document.getElementById('f-repeat').value) || 1;
    const sy = parseInt(document.getElementById('f-sy').value);
    const sm = parseInt(document.getElementById('f-sm').value);
    const ey = document.getElementById('f-ey').value ? parseInt(document.getElementById('f-ey').value) : null;
    const em = document.getElementById('f-em').value ? parseInt(document.getElementById('f-em').value) : null;
    if (!name) return;
    closeModal();
    const { data, error } = await itemsRepo.insert({
        name, type, currency, repeat_every_x_months: repeat,
        start_year: sy, start_month: sm,
        end_year: ey, end_month: em,
        sort_order: state.items.filter(i => i.type === type).length
    });
    if (error) { toast('Hiba: ' + error.message, 'error'); return; }
    state.items.push(data);
    render();
    toast('Tétel hozzáadva', 'success');
};

// ── Inline összeg szerkesztő ──────────────────────────────────────────────────
function makeAmountEditable(item, el, isSaving = false) {
    const current = isSaving ? getBalance(item) : getAmount(item);
    const input = document.createElement('input');
    input.className = 'amount-input';
    input.value = current || '';
    input.placeholder = '0';
    el.replaceWith(input);
    input.focus();
    input.select();
    const save = () => isSaving ? saveBalance(item, input.value) : saveAmount(item, input.value);
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
}

// ── Render: havi nézet ────────────────────────────────────────────────────────
function renderMonthView() {
    const incomes   = activeItems('income');
    const expenses  = activeItems('expense');
    const savings   = activeItems('saving');
    const liquids   = activeItems('liquid');

    const totalIncome  = incomes.reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const totalExpense = expenses.reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const totalSaving  = savings.reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const available    = totalIncome - totalExpense - totalSaving;
    const unpaid       = expenses.filter(i => !isPaid(i)).reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const totalLiquid  = liquids.reduce((s, i) => s + toHUF(i, getBalance(i)), 0);

    const itemRow = (item, isSaving = false) => `
      <div class="item-row ${isPaid(item) ? 'paid' : ''}" data-id="${item.id}">
        ${!isSaving ? `<button class="pay-toggle" onclick="app.togglePaid('${item.id}')">${isPaid(item) ? '✓' : ''}</button>` : ''}
        <span class="item-name">${item.name}${item.currency === 'EUR' ? ' <small style="color:var(--text3)">EUR</small>' : ''}</span>
        <span class="item-amount" onclick="app.editAmount('${item.id}', this, ${isSaving})">${
            isSaving
            ? (getBalance(item) ? (item.currency === 'EUR' ? fmtEur(getBalance(item)) : fmt(getBalance(item))) : '— egyenleg')
            : (getAmount(item) ? fmt(toHUF(item, getAmount(item))) : '— összeg')
        }</span>
      </div>`;

    const liquidCard = (item) => `
      <div class="liquid-card" onclick="app.editBalance('${item.id}', this)">
        <div class="liquid-name">${item.name}</div>
        <div class="liquid-balance">${
            item.currency === 'EUR'
            ? fmtEur(getBalance(item))
            : fmt(getBalance(item))
        }</div>
        ${item.currency === 'EUR' && getBalance(item) ? `<div class="liquid-balance-eur">≈ ${fmt(getBalance(item) * state.eurRate)}</div>` : ''}
      </div>`;

    return `
      <div class="summary-grid">
        <div class="summary-card wide">
          <div class="card-label">Felhasználható</div>
          <div class="card-value">${fmt(available)}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Bevétel</div>
          <div class="card-value" style="font-size:1.1rem">${fmt(totalIncome)}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Kiadás</div>
          <div class="card-value" style="font-size:1.1rem">${fmt(totalExpense)}</div>
        </div>
        <div class="summary-card ${unpaid > 0 ? 'warn' : ''}">
          <div class="card-label">Még fizetendő</div>
          <div class="card-value" style="font-size:1.1rem">${fmt(unpaid)}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Likvid tartalék</div>
          <div class="card-value" style="font-size:1.1rem;color:var(--blue)">${fmt(totalLiquid)}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Bevételek</span>
          <span class="section-total">${fmt(totalIncome)}</span>
          <button class="add-btn" onclick="app.addItem('income')">+ Hozzáad</button>
        </div>
        <div class="item-list">${
            incomes.length ? incomes.map(i => itemRow(i)).join('') : '<div class="empty-state">Nincs bevétel ebben a hónapban</div>'
        }</div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Kiadások</span>
          <span class="section-total">${fmt(totalExpense)}</span>
          <button class="add-btn" onclick="app.addItem('expense')">+ Hozzáad</button>
        </div>
        <div class="item-list">${
            expenses.length ? expenses.map(i => itemRow(i)).join('') : '<div class="empty-state">Nincs kiadás ebben a hónapban</div>'
        }</div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Megtakarítások</span>
          <span class="section-total">${fmt(totalSaving)}</span>
          <button class="add-btn" onclick="app.addItem('saving')">+ Hozzáad</button>
        </div>
        <div class="item-list">${
            savings.length ? savings.map(i => itemRow(i, true)).join('') : '<div class="empty-state">Nincs megtakarítás</div>'
        }</div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Likvid számlák</span>
          <span class="section-total" style="color:var(--blue)">${fmt(totalLiquid)}</span>
          <button class="add-btn" onclick="app.addItem('liquid')">+ Hozzáad</button>
        </div>
        <div class="liquid-grid">${
            liquids.length ? liquids.map(liquidCard).join('') : '<div class="empty-state">Nincs likvid számla</div>'
        }</div>
      </div>`;
}

// ── Render: fő ────────────────────────────────────────────────────────────────
function render() {
    const app = document.getElementById('app');
    if (state.loading) {
        app.innerHTML = `<div class="loading"><div class="spinner"></div>Betöltés...</div>`;
        return;
    }
    app.innerHTML = `
      <header class="app-header">
        <span class="app-title">HáziPénz</span>
        <div class="month-nav">
          <button onclick="app.prevMonth()">‹</button>
          <span class="month-label">${MONTHS_HU[state.month - 1]} ${state.year}</span>
          <button onclick="app.nextMonth()">›</button>
        </div>
        <span style="font-size:0.7rem;color:var(--text3)">1€ = ${Math.round(state.eurRate)} Ft</span>
      </header>
      <main>${renderMonthView()}</main>
      <nav class="bottom-nav">
        <button class="nav-btn active"><span class="icon">◎</span>Hónap</button>
        <button class="nav-btn"><span class="icon">▦</span>Év</button>
        <button class="nav-btn"><span class="icon">↗</span>Predikció</button>
        <button class="nav-btn"><span class="icon">⚙</span>Beállítás</button>
      </nav>`;
}

// ── Publikus API ──────────────────────────────────────────────────────────────
window.app = {
    prevMonth,
    nextMonth,
    addItem: showAddItemModal,
    togglePaid: (id) => {
        const item = state.items.find(i => i.id === id);
        if (item) togglePaid(item);
    },
    editAmount: (id, el, isSaving) => {
        const item = state.items.find(i => i.id === id);
        if (item) makeAmountEditable(item, el, isSaving);
    },
    editBalance: (id, card) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        const balEl = card.querySelector('.liquid-balance');
        if (balEl) makeAmountEditable(item, balEl, true);
    },
};

// ── Indítás ───────────────────────────────────────────────────────────────────
loadData();
