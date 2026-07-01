// ===== The Dutchy Order Book =====
const STAGES = ['Inquiry', 'Confirmed', 'Baking', 'Ready', 'Delivered'];
const CAKE_TYPES = ['charm', 'wedding', 'needlepoint', 'trellis', 'other', 'shortbread'];

const loginView = document.getElementById('tkLogin');
const setupView = document.getElementById('tkSetup');
const boardView = document.getElementById('tkBoard');
const rowsEl = document.getElementById('tkRows');
const colsEl = document.getElementById('tkColumns');
const histRowsEl = document.getElementById('tkHistoryRows');
const histSummaryEl = document.getElementById('tkHistorySummary');
const statsEl = document.getElementById('tkStats');
const toolbarEl = document.getElementById('tkToolbar');
const logoutBtn = document.getElementById('tkLogout');
const searchEl = document.getElementById('tkSearch');
const stageFilterEl = document.getElementById('tkStageFilter');
const paidFilterEl = document.getElementById('tkPaidFilter');

let allOrders = [];
let sortKey = 'date_needed';
let sortDir = 1;
let currentView = 'board';

const show = (view) => { [loginView, setupView, boardView].forEach((v) => { if (v) v.hidden = true; }); if (view) view.hidden = false; };
const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => (n == null || n === '' ? '' : '$' + Number(n).toLocaleString());
const label = (t) => ({ charm: 'Charm Cake', wedding: 'Wedding Cake', needlepoint: 'Needlepoint Cake', trellis: 'Trellis Cake', other: 'Other', shortbread: 'Shortbread' }[t] || t || '');
const bal = (o) => (Number(o.total) || 0) - (Number(o.deposit) || 0);

if (!sb) { show(setupView); } else { init(); }

async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session) enterBoard(); else show(loginView);
  sb.auth.onAuthStateChange((_e, session) => { if (session) enterBoard(); else show(loginView); });
}

// ---- login / logout ----
const loginForm = document.getElementById('tkLoginForm');
if (loginForm) loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('tkEmail').value.trim();
  const password = document.getElementById('tkPassword').value;
  const err = document.getElementById('tkLoginError');
  err.hidden = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { err.hidden = false; err.textContent = error.message; return; }
  const remember = document.getElementById('tkRemember');
  if (remember && !remember.checked) window.addEventListener('pagehide', () => sb.auth.signOut());
});
if (logoutBtn) logoutBtn.addEventListener('click', () => sb.auth.signOut());

// ---- data ----
let channel = null;
async function enterBoard() {
  show(boardView);
  if (logoutBtn) logoutBtn.hidden = false;
  await loadOrders();
  if (!channel) {
    channel = sb.channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
      .subscribe();
  }
}
async function loadOrders() {
  const { data, error } = await sb.from('orders').select('*');
  if (error) { console.error(error); return; }
  allOrders = data || [];
  render();
}

// ---- view tabs ----
function applyView() {
  document.querySelectorAll('.tk-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === currentView));
  document.getElementById('tkTableView').hidden = currentView !== 'table';
  document.getElementById('tkCardsView').hidden = currentView !== 'board';
  document.getElementById('tkHistoryView').hidden = currentView !== 'history';
  if (toolbarEl) toolbarEl.style.display = '';
  if (stageFilterEl) stageFilterEl.style.display = currentView === 'table' ? '' : 'none';
}
document.querySelectorAll('.tk-tab').forEach((tab) => tab.addEventListener('click', () => {
  currentView = tab.dataset.view;
  applyView();
  render();
}));
applyView();

// ---- filters / sort ----
[searchEl, stageFilterEl, paidFilterEl].forEach((el) => el && el.addEventListener('input', render));
document.querySelectorAll('.tk-table th[data-sort]').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.sort;
  if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
  render();
}));

function passesSearchPaid(o, q, pf) {
  if (pf === 'paid' && !o.paid) return false;
  if (pf === 'unpaid' && (o.paid || bal(o) <= 0)) return false;
  if (q && ![o.customer_name, o.email, o.phone, o.details, label(o.cake_type)].join(' ').toLowerCase().includes(q)) return false;
  return true;
}

function render() {
  const q = (searchEl.value || '').toLowerCase().trim();
  const sf = stageFilterEl.value;
  const pf = paidFilterEl.value;
  if (currentView === 'table') {
    const rows = allOrders.filter((o) => (!sf || (o.status || 'Inquiry') === sf) && passesSearchPaid(o, q, pf));
    rows.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'total') { av = Number(av) || 0; bv = Number(bv) || 0; }
      else { av = av == null ? '' : String(av); bv = bv == null ? '' : String(bv); }
      return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
    });
    renderTable(rows);
  } else if (currentView === 'board') {
    renderCards(allOrders.filter((o) => passesSearchPaid(o, q, pf)));
  } else {
    renderHistory(allOrders.filter((o) => passesSearchPaid(o, q, pf)));
  }
  let unpaid = 0;
  allOrders.forEach((o) => { if (!o.paid && bal(o) > 0) unpaid += bal(o); });
  const active = allOrders.filter((o) => (o.status || 'Inquiry') !== 'Delivered').length;
  statsEl.textContent = `${active} active · ${allOrders.length} total · ${money(unpaid) || '$0'} outstanding`;
}

const upd = (o, patch) => sb.from('orders').update(patch).eq('id', o.id).then(loadOrders);
const del = (o) => { if (confirm('Delete this order?')) sb.from('orders').delete().eq('id', o.id).then(loadOrders); };
function cakeOptions(val) {
  const opts = ['', ...CAKE_TYPES];
  if (val && !CAKE_TYPES.includes(val)) opts.push(val);
  return opts.map((v) => `<option value="${esc(v)}" ${v === (val || '') ? 'selected' : ''}>${v ? esc(label(v)) : '—'}</option>`).join('');
}
function stageOptions(val) {
  return STAGES.map((s) => `<option ${s === (val || 'Inquiry') ? 'selected' : ''}>${s}</option>`).join('');
}
function detailRowHtml(o) {
  return `<div class="tk-detail">
    <div class="tk-detail-meta">${o.email ? '✉ ' + esc(o.email) + '  ' : ''}${o.phone ? '· ☎ ' + esc(o.phone) + '  ' : ''}${o.occasion ? '· ' + esc(o.occasion) : ''}</div>
    <label class="tk-detail-notes">Order details<textarea class="tk-details-edit" rows="5" placeholder="Size, flavor, filling, charms, delivery…">${esc(o.details || '')}</textarea></label>
    <label class="tk-detail-notes">Private notes<textarea class="tk-notes" rows="2" placeholder="Notes for yourself…">${esc(o.notes || '')}</textarea></label>
  </div>`;
}
function bindDetailEdits(container, o) {
  const d = container.querySelector('.tk-details-edit');
  if (d) d.addEventListener('change', (e) => sb.from('orders').update({ details: e.target.value || null }).eq('id', o.id).then(loadOrders));
  const n = container.querySelector('.tk-notes');
  if (n) n.addEventListener('change', (e) => sb.from('orders').update({ notes: e.target.value || null }).eq('id', o.id));
}

// ---- TABLE ----
function renderTable(orders) {
  rowsEl.innerHTML = '';
  if (!orders.length) { rowsEl.innerHTML = '<tr><td colspan="14" class="tk-empty">No orders match your filters.</td></tr>'; return; }
  orders.forEach((o) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="tk-name" value="${esc(o.customer_name || '')}" placeholder="Name" /></td>
      <td><input type="email" class="tk-email" value="${esc(o.email || '')}" placeholder="—" /></td>
      <td><input type="tel" class="tk-phone" value="${esc(o.phone || '')}" placeholder="—" /></td>
      <td><select class="tk-cake">${cakeOptions(o.cake_type)}</select></td>
      <td><input class="tk-occasion" value="${esc(o.occasion || '')}" placeholder="—" /></td>
      <td><input type="date" class="tk-date" value="${o.date_needed || ''}" /></td>
      <td><select class="tk-status">${stageOptions(o.status)}</select></td>
      <td><input type="number" class="tk-total" value="${o.total ?? ''}" placeholder="—" /></td>
      <td><input type="number" class="tk-deposit" value="${o.deposit ?? ''}" placeholder="—" /></td>
      <td class="tk-balance">${o.paid ? '<span class="paidtag">Paid ✓</span>' : (money(bal(o)) || '$0')}</td>
      <td class="tk-center"><input type="checkbox" class="tk-paid" ${o.paid ? 'checked' : ''} /></td>
      <td class="tk-added">${o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</td>
      <td><button class="tk-expand" title="Details">⊕</button></td>
      <td><button class="tk-del" title="Delete">×</button></td>`;
    const dr = document.createElement('tr');
    dr.className = 'tk-detailrow'; dr.hidden = true;
    dr.innerHTML = `<td colspan="14">${detailRowHtml(o)}</td>`;
    tr.querySelector('.tk-name').addEventListener('change', (e) => upd(o, { customer_name: e.target.value }));
    tr.querySelector('.tk-email').addEventListener('change', (e) => upd(o, { email: e.target.value || null }));
    tr.querySelector('.tk-phone').addEventListener('change', (e) => upd(o, { phone: e.target.value || null }));
    tr.querySelector('.tk-occasion').addEventListener('change', (e) => upd(o, { occasion: e.target.value || null }));
    tr.querySelector('.tk-cake').addEventListener('change', (e) => upd(o, { cake_type: e.target.value || null }));
    tr.querySelector('.tk-date').addEventListener('change', (e) => upd(o, { date_needed: e.target.value || null }));
    tr.querySelector('.tk-status').addEventListener('change', (e) => upd(o, { status: e.target.value }));
    tr.querySelector('.tk-total').addEventListener('change', (e) => upd(o, { total: e.target.value === '' ? null : Number(e.target.value) }));
    tr.querySelector('.tk-deposit').addEventListener('change', (e) => upd(o, { deposit: e.target.value === '' ? null : Number(e.target.value) }));
    tr.querySelector('.tk-paid').addEventListener('change', (e) => upd(o, { paid: e.target.checked }));
    tr.querySelector('.tk-expand').addEventListener('click', () => { dr.hidden = !dr.hidden; });
    tr.querySelector('.tk-del').addEventListener('click', () => del(o));
    bindDetailEdits(dr, o);
    rowsEl.appendChild(tr);
    rowsEl.appendChild(dr);
  });
}

// ---- BOARD (cards) ----
function renderCards(orders) {
  colsEl.innerHTML = '';
  STAGES.forEach((stage) => {
    const inStage = orders.filter((o) => (o.status || 'Inquiry') === stage);
    const col = document.createElement('div');
    col.className = 'tk-col';
    col.innerHTML = `<h3 class="tk-col-head">${stage} <span>${inStage.length}</span></h3>`;
    const list = document.createElement('div');
    list.className = 'tk-col-list';
    inStage.forEach((o) => list.appendChild(card(o)));
    col.appendChild(list);
    colsEl.appendChild(col);
  });
}
function card(o) {
  const el = document.createElement('div');
  el.className = 'tk-card';
  el.innerHTML = `
    <div class="tk-card-top"><strong>${esc(o.customer_name) || 'New order'}</strong><button class="tk-del" title="Delete">×</button></div>
    <p class="tk-card-meta">${esc(label(o.cake_type))}${o.date_needed ? ' · ' + o.date_needed : ''}</p>
    <label class="tk-row">Stage <select class="tk-status">${stageOptions(o.status)}</select></label>
    <div class="tk-bill"><label>Total <input type="number" class="tk-total" value="${o.total ?? ''}" placeholder="—" /></label><label>Deposit <input type="number" class="tk-deposit" value="${o.deposit ?? ''}" placeholder="—" /></label></div>
    <div class="tk-balrow"><span>${o.paid ? '<span class="paidtag">Paid ✓</span>' : 'Balance: ' + (money(bal(o)) || '$0')}</span><label class="tk-paid"><input type="checkbox" class="tk-paid" ${o.paid ? 'checked' : ''} /> Paid</label></div>
    <details class="tk-details"><summary>Details &amp; notes</summary>${detailRowHtml(o)}</details>`;
  el.querySelector('.tk-status').addEventListener('change', (e) => upd(o, { status: e.target.value }));
  el.querySelector('.tk-total').addEventListener('change', (e) => upd(o, { total: e.target.value === '' ? null : Number(e.target.value) }));
  el.querySelector('.tk-deposit').addEventListener('change', (e) => upd(o, { deposit: e.target.value === '' ? null : Number(e.target.value) }));
  el.querySelector('.tk-paid').addEventListener('change', (e) => upd(o, { paid: e.target.checked }));
  el.querySelector('.tk-del').addEventListener('click', () => del(o));
  bindDetailEdits(el, o);
  return el;
}

// ---- HISTORY (completed) ----
function renderHistory(orders) {
  const done = orders.filter((o) => (o.status || '') === 'Delivered').sort((a, b) => String(b.date_needed || '').localeCompare(String(a.date_needed || '')));
  const collected = done.reduce((s, o) => s + (o.paid ? (Number(o.total) || 0) : (Number(o.deposit) || 0)), 0);
  histSummaryEl.textContent = `${done.length} completed order${done.length === 1 ? '' : 's'} · ${money(collected) || '$0'} collected`;
  histRowsEl.innerHTML = '';
  if (!done.length) { histRowsEl.innerHTML = '<tr><td colspan="6" class="tk-empty">No completed orders yet — finished orders land here.</td></tr>'; return; }
  done.forEach((o) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(o.customer_name || '')}</td><td>${esc(label(o.cake_type))}</td><td>${o.date_needed || ''}</td><td>${money(o.total) || '—'}</td><td>${o.paid ? '<span class="paidtag">Paid</span>' : 'Unpaid'}</td><td><button class="tk-expand">⊕</button></td>`;
    const dr = document.createElement('tr');
    dr.className = 'tk-detailrow'; dr.hidden = true;
    dr.innerHTML = `<td colspan="6">${detailRowHtml(o)}</td>`;
    tr.querySelector('.tk-expand').addEventListener('click', () => { dr.hidden = !dr.hidden; });
    bindDetailEdits(dr, o);
    histRowsEl.appendChild(tr);
    histRowsEl.appendChild(dr);
  });
}

// ---- add a manual order ----
const addBtn = document.getElementById('tkAdd');
if (addBtn) addBtn.addEventListener('click', async () => {
  const name = prompt('Customer name for the new order?');
  if (name === null) return;
  await sb.from('orders').insert({ customer_name: name || 'New order', status: 'Inquiry' });
  loadOrders();
});
