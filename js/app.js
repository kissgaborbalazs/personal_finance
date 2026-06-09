import { itemsRepo, valuesRepo, balancesRepo, rateRepo, authRepo, isItemActiveInMonth } from './db.js';

// ── Állapot ───────────────────────────────────────────────────────────────────
const state = {
    year:  new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    items: [], values: {}, balances: {},
    eurRate: 395, loading: true, user: null,
};

const MONTHS_HU = ['Január','Február','Március','Április','Május','Június',
                   'Július','Augusztus','Szeptember','Október','November','December'];

const fmt    = (n) => Math.round(n).toLocaleString('hu-HU') + ' Ft';
const fmtEur = (n) => n.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const activeItems  = (type) => type === 'saving'
    ? state.items.filter(i => i.type === type && i.is_active)
    : state.items.filter(i => i.type === type && i.is_active && isItemActiveInMonth(i, state.year, state.month));
const getAmount    = (item) => state.values[item.id]?.amount ?? item.default_amount ?? 0;
const isPaid       = (item) => state.values[item.id]?.is_paid ?? false;
const getBalance   = (item) => state.balances[item.id] ?? 0;
const toHUF        = (item, val) => item.currency === 'EUR' ? val * state.eurRate : val;

// ── Auth ──────────────────────────────────────────────────────────────────────
function renderLogin(errorMsg = '') {
    document.getElementById('app').innerHTML = `
      <div class="login-screen">
        <div class="login-box">
          <div class="login-logo">HáziPénz</div>
          <div class="login-sub">Háztartási pénzügyek</div>
          ${errorMsg ? `<div class="login-error">${errorMsg}</div>` : ''}
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="l-email" type="email" placeholder="email@example.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Jelszó</label>
            <input class="form-input" id="l-pass" type="password" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="app.login()">Belépés</button>
        </div>
      </div>`;
    document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') app.login(); });
}

async function doLogin() {
    const email = document.getElementById('l-email')?.value?.trim();
    const pass  = document.getElementById('l-pass')?.value;
    if (!email || !pass) return;
    const { error } = await authRepo.signIn(email, pass);
    if (error) renderLogin('Hibás email vagy jelszó');
}

async function doLogout() {
    await authRepo.signOut();
    state.user = null;
    renderLogin();
}

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

// ── Kifizetés toggle (csak expense) ──────────────────────────────────────────
async function togglePaid(item) {
    const newVal = !isPaid(item);
    if (!state.values[item.id]) state.values[item.id] = { amount: getAmount(item), is_paid: false };
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

async function saveBalance(item, rawValue) {
    const balance = parseInt(rawValue.replace(/\D/g, ''), 10) || 0;
    state.balances[item.id] = balance;
    render();
    await balancesRepo.upsert(item.id, state.year, state.month, balance);
}

// ── Navigáció ─────────────────────────────────────────────────────────────────
function prevMonth() { state.month === 1 ? (state.month = 12, state.year--) : state.month--; loadData(); }
function nextMonth() { state.month === 12 ? (state.month = 1, state.year++) : state.month++; loadData(); }

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = Object.assign(document.createElement('div'), { className: `toast ${type}`, textContent: msg });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

// ── Modal: tétel hozzáadása ───────────────────────────────────────────────────
function showAddItemModal(type) {
    const labels = { income: 'bevétel', expense: 'kiadás', saving: 'megtakarítás', liquid: 'likvid számla' };
    showItemModal({ type, start_year: state.year, start_month: state.month }, `Új ${labels[type]}`, false);
}

// ── Modal: tétel szerkesztése ─────────────────────────────────────────────────
function showEditItemModal(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    showItemModal(item, 'Tétel szerkesztése', true);
}

function showItemModal(item, title, isEdit) {
    const isSaving = item.type === 'saving';
    const html = `
    <div class="modal-overlay" id="modal">
      <div class="modal">
        <div class="modal-title">${title}</div>
        <div class="form-group">
          <label class="form-label">Megnevezés</label>
          <input class="form-input" id="f-name" value="${item.name ?? ''}" placeholder="pl. Villanyóra" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Deviza</label>
            <select class="form-select" id="f-currency">
              <option value="HUF" ${item.currency !== 'EUR' ? 'selected' : ''}>HUF</option>
              <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
            </select>
          </div>
          ${isSaving ? '' : `
          <div class="form-group">
            <label class="form-label">Ismétlés (hónap)</label>
            <input class="form-input" id="f-repeat" type="number" value="${item.repeat_every_x_months ?? 1}" min="1" max="24">
          </div>`}
        </div>
        ${isSaving ? `
        <div class="form-row">
          <div class="form-group" style="flex-direction:column;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;color:var(--text2)">
              <input type="checkbox" id="f-liquid" ${item.is_liquid ? 'checked' : ''}>
              Likvid megtakarítás (beleszámít a felhasználhatóba)
            </label>
            ${isEdit ? `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;color:var(--text2)">
              <input type="checkbox" id="f-active" ${item.is_active ? 'checked' : ''}> Aktív
            </label>` : ''}
          </div>
        </div>` : `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kezdő év / hónap</label>
            <div style="display:flex;gap:6px">
              <input class="form-input" id="f-sy" type="number" value="${item.start_year ?? state.year}" style="width:70px">
              <input class="form-input" id="f-sm" type="number" value="${item.start_month ?? state.month}" min="1" max="12" style="width:60px">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Záró év / hónap</label>
            <div style="display:flex;gap:6px">
              <input class="form-input" id="f-ey" type="number" value="${item.end_year ?? ''}" placeholder="–" style="width:70px">
              <input class="form-input" id="f-em" type="number" value="${item.end_month ?? ''}" placeholder="–" min="1" max="12" style="width:60px">
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="justify-content:flex-end;padding-top:20px">
            ${isEdit ? `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;color:var(--text2)">
              <input type="checkbox" id="f-active" ${item.is_active ? 'checked' : ''}> Aktív
            </label>` : ''}
          </div>
        </div>`}
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeModal()">Mégse</button>
          ${isEdit ? `<button class="btn btn-danger" onclick="app.deactivateItem('${item.id}')">Deaktivál</button>` : ''}
          <button class="btn btn-primary" onclick="${isEdit ? `app.submitEditItem('${item.id}')` : `submitAddItem('${item.type}')`}">Mentés</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
}

window.closeModal = () => document.getElementById('modal')?.remove();

// ── Tétel mentése (új) ────────────────────────────────────────────────────────
window.submitAddItem = async (type) => {
    const payload = readModalForm();
    if (!payload.name) return;
    payload.type = type;
    payload.sort_order = state.items.filter(i => i.type === type).length;
    closeModal();
    const { data, error } = await itemsRepo.insert(payload);
    if (error) { toast('Hiba: ' + error.message, 'error'); return; }
    state.items.push(data);
    render();
    toast('Tétel hozzáadva', 'success');
};

// ── Tétel mentése (szerkesztés) ───────────────────────────────────────────────
window.app_submitEditItem = async (id) => {
    const payload = readModalForm();
    if (!payload.name) return;
    closeModal();
    const { data, error } = await itemsRepo.update(id, payload);
    if (error) { toast('Hiba: ' + error.message, 'error'); return; }
    const idx = state.items.findIndex(i => i.id === id);
    if (idx !== -1) state.items[idx] = data;
    render();
    toast('Tétel frissítve', 'success');
};

function readModalForm() {
    const v = (id) => document.getElementById(id)?.value;
    const activeEl = document.getElementById('f-active');
    const liquidEl = document.getElementById('f-liquid');
    return {
        name:                  v('f-name')?.trim(),
        currency:              v('f-currency'),
        repeat_every_x_months: parseInt(v('f-repeat')) || 1,
        start_year:            parseInt(v('f-sy')) || state.year,
        start_month:           parseInt(v('f-sm')) || 1,
        end_year:              v('f-ey') ? parseInt(v('f-ey')) : null,
        end_month:             v('f-em') ? parseInt(v('f-em')) : null,
        ...(activeEl !== null && { is_active: activeEl.checked }),
        ...(liquidEl !== null && { is_liquid: liquidEl.checked }),
    };
}

// ── Inline összeg szerkesztő ──────────────────────────────────────────────────
function makeAmountEditable(item, el, isSaving = false) {
    const current = isSaving ? getBalance(item) : getAmount(item);
    const input = Object.assign(document.createElement('input'), {
        className: 'amount-input', value: current || '', placeholder: '0'
    });
    el.replaceWith(input);
    input.focus(); input.select();
    const save = () => isSaving ? saveBalance(item, input.value) : saveAmount(item, input.value);
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
}

// ── Render: havi nézet ────────────────────────────────────────────────────────
function renderMonthView() {
    const incomes  = activeItems('income');
    const expenses = activeItems('expense');
    const savings  = activeItems('saving');
    const liquids  = activeItems('liquid');

    const totalIncome    = incomes.reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const totalExpense   = expenses.reduce((s, i) => s + toHUF(i, getAmount(i)), 0);
    const totalSaving    = savings.reduce((s, i) => s + toHUF(i, getBalance(i)), 0);
    const totalLiquid    = liquids.reduce((s, i) => s + toHUF(i, getBalance(i)), 0);
    const liquidSavings  = savings.filter(i => i.is_liquid).reduce((s, i) => s + toHUF(i, getBalance(i)), 0);
    const available      = totalLiquid - liquidSavings - totalExpense;
    const unpaid         = expenses.filter(i => !isPaid(i)).reduce((s, i) => s + toHUF(i, getAmount(i)), 0);

    // Tétel sor – fizetve toggle csak expense-nél
    const itemRow = (item, isSaving = false) => `
      <div class="item-row ${item.type === 'expense' && isPaid(item) ? 'paid' : ''}" data-id="${item.id}">
        ${item.type === 'expense'
            ? `<button class="pay-toggle" onclick="app.togglePaid('${item.id}')">${isPaid(item) ? '✓' : ''}</button>`
            : '<div style="width:28px;flex-shrink:0"></div>'
        }
        <span class="item-name" onclick="app.editItem('${item.id}')">${item.name}${item.currency === 'EUR' ? ' <small style="color:var(--text3)">€</small>' : ''}</span>
        <span class="item-amount" onclick="app.editAmount('${item.id}', this, ${isSaving})">${
            isSaving
            ? (getBalance(item) ? (item.currency === 'EUR' ? fmtEur(getBalance(item)) : fmt(getBalance(item))) : '— egyenleg')
            : (getAmount(item) ? fmt(toHUF(item, getAmount(item))) : '— összeg')
        }</span>
        <button class="edit-btn" onclick="app.editItem('${item.id}')">✎</button>
      </div>`;

    const liquidCard = (item) => `
      <div class="liquid-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="liquid-name">${item.name}</div>
          <button class="edit-btn-sm" onclick="app.editItem('${item.id}')">✎</button>
        </div>
        <div class="liquid-balance" onclick="app.editBalance('${item.id}', this.closest('.liquid-card'))">${
            item.currency === 'EUR' ? fmtEur(getBalance(item)) : fmt(getBalance(item))
        }</div>
        ${item.currency === 'EUR' && getBalance(item) ? `<div class="liquid-balance-eur">≈ ${fmt(getBalance(item) * state.eurRate)}</div>` : ''}
      </div>`;

    const section = (title, type, items, total, isSaving = false) => `
      <div class="section">
        <div class="section-header">
          <span class="section-title">${title}</span>
          <span class="section-total">${fmt(total)}</span>
          <button class="add-btn" onclick="app.addItem('${type}')">+ Hozzáad</button>
        </div>
        <div class="item-list">${items.length
            ? items.map(i => itemRow(i, isSaving)).join('')
            : `<div class="empty-state">Nincs tétel</div>`
        }</div>
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
      ${section('Bevételek', 'income', incomes, totalIncome)}
      ${section('Kiadások', 'expense', expenses, totalExpense)}
      ${section('Megtakarítások', 'saving', savings, totalSaving, true)}
      <div class="section">
        <div class="section-header">
          <span class="section-title">Likvid számlák</span>
          <span class="section-total" style="color:var(--blue)">${fmt(totalLiquid)}</span>
          <button class="add-btn" onclick="app.addItem('liquid')">+ Hozzáad</button>
        </div>
        <div class="liquid-grid">${liquids.length
            ? liquids.map(liquidCard).join('')
            : '<div class="empty-state">Nincs likvid számla</div>'
        }</div>
      </div>`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    const appEl = document.getElementById('app');
    if (state.loading) { appEl.innerHTML = `<div class="loading"><div class="spinner"></div>Betöltés...</div>`; return; }
    appEl.innerHTML = `
      <header class="app-header">
        <span class="app-title">HáziPénz</span>
        <div class="month-nav">
          <button onclick="app.prevMonth()">‹</button>
          <span class="month-label">${MONTHS_HU[state.month - 1]} ${state.year}</span>
          <button onclick="app.nextMonth()">›</button>
        </div>
        <button class="logout-btn" onclick="app.logout()" title="Kijelentkezés">⏻</button>
      </header>
      <div class="eur-rate">1€ = ${Math.round(state.eurRate)} Ft</div>
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
    prevMonth, nextMonth,
    login:   doLogin,
    logout:  doLogout,
    addItem: showAddItemModal,
    editItem: (id) => showEditItemModal(id),
    submitEditItem: (id) => app_submitEditItem(id),
    deactivateItem: async (id) => {
        closeModal();
        await itemsRepo.deactivate(id);
        const item = state.items.find(i => i.id === id);
        if (item) item.is_active = false;
        render();
        toast('Tétel deaktiválva');
    },
    togglePaid: (id) => { const item = state.items.find(i => i.id === id); if (item) togglePaid(item); },
    editAmount: (id, el, isSaving) => { const item = state.items.find(i => i.id === id); if (item) makeAmountEditable(item, el, isSaving); },
    editBalance: (id, card) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        const balEl = card.querySelector('.liquid-balance');
        if (balEl) makeAmountEditable(item, balEl, true);
    },
};

// ── Indítás ───────────────────────────────────────────────────────────────────
authRepo.onAuthChange((event, session) => {
    state.user = session?.user ?? null;
    if (state.user) loadData(); else renderLogin();
});

(async () => {
    const { data } = await authRepo.getSession();
    state.user = data?.session?.user ?? null;
    if (state.user) loadData(); else renderLogin();
})();
