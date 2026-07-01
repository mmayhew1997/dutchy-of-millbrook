// ----- Custom Orders: cake-type cards open a tailored inquiry popup -----
const form = document.getElementById('intakeForm');
const productInput = document.getElementById('product');
const modal = document.getElementById('orderModal');
const modalTitle = document.getElementById('modalTitle');

const LABELS = {
  charm: 'Charm Cake',
  wedding: 'Wedding Cake',
  needlepoint: 'Needlepoint Cake',
  trellis: 'Trellis Cake',
  other: 'Something Else',
};

// Show only the field groups that match the chosen cake type.
// Hidden groups are disabled so their fields aren't validated or submitted.
function syncIntake() {
  if (!form || !productInput) return;
  const product = productInput.value;
  form.querySelectorAll('.cond').forEach((block) => {
    const when = block.getAttribute('data-when');
    const show = !!product && (when === '*' || when.split(',').includes(product));
    block.hidden = !show;
    block.querySelectorAll('input, select, textarea, button').forEach((el) => {
      el.disabled = !show;
    });
  });
}

function openModal(cake) {
  productInput.value = cake;
  if (modalTitle) modalTitle.textContent = LABELS[cake] || 'Inquiry';
  syncIntake();
  if (cake === 'charm') applyDesign();
  modal.hidden = false;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const firstField = form.querySelector('#name');
  if (firstField) firstField.focus();
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-cake]').forEach((btn) =>
  btn.addEventListener('click', () => openModal(btn.getAttribute('data-cake')))
);
document.querySelectorAll('[data-close]').forEach((el) =>
  el.addEventListener('click', closeModal)
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// On submit, send the inquiry to Elizabeth via Web3Forms (reliable + carries photo attachments).
const WEB3FORMS_KEY = '529c1542-a1d9-4941-abe7-5d2cb027730f';
async function submitOrder(e) {
  e.preventDefault();
  if (!form.reportValidity()) return;

  const fd = new FormData(form);
  // ranked charm list (charm cake only) — not a form field, so append it
  if (productInput && productInput.value === 'charm') {
    const charms = [...form.querySelectorAll('#charmList .charm-text')].map((el, i) => `${i + 1}. ${el.textContent}`);
    if (charms.length) fd.append('Charms (most important first)', '\n' + charms.join('\n'));
  }
  const name = fd.get('Name') || 'New inquiry';

  // Also capture into the Order Book (Supabase), if it's connected
  if (typeof sb !== 'undefined' && sb) {
    const v = (k) => { const x = fd.get(k); return x == null || x === '' ? null : x; };
    const detailKeys = ['Size', 'Flavor', 'Filling', 'Sides', 'Tiers', 'Guest count', 'Vision', 'Venue', 'Needlepoint colors', 'Trellis style', 'Idea', 'Inscription', 'Fulfillment', 'Delivery address'];
    const details = detailKeys.map((k) => (fd.get(k) ? `${k}: ${fd.get(k)}` : null)).filter(Boolean);
    const charmList = [...form.querySelectorAll('#charmList .charm-text')].map((el, i) => `${i + 1}. ${el.textContent}`);
    if (charmList.length) details.push('Charms: ' + charmList.join('; '));
    if (v('Notes')) details.push('Notes: ' + fd.get('Notes'));
    sb.from('orders').insert({
      customer_name: v('Name'), email: v('Email'), phone: v('Phone'),
      cake_type: v('Cake type'), occasion: v('Occasion'), date_needed: v('Date needed'),
      details: details.join('\n'), status: 'Inquiry',
    }).then(({ error }) => { if (error) console.error('Order Book insert:', error.message); });
  }

  fd.append('access_key', WEB3FORMS_KEY);
  fd.append('subject', `CAKE — ${name}`);
  fd.append('from_name', 'The Dutchy of Millbrook website');
  const customerEmail = fd.get('Email');
  if (customerEmail) fd.append('replyto', customerEmail);

  const btn = form.querySelector('button[type="submit"]');
  const status = document.getElementById('orderStatus');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
    const json = await res.json();
    if (json.success) {
      form.hidden = true;
      const emailLine = document.querySelector('#orderModal .email-line');
      if (emailLine) emailLine.hidden = true;
      if (status) {
        status.hidden = false;
        status.innerHTML = '<strong class="tk-confirm-head">Inquiry confirmed!</strong>Elizabeth will be in touch soon. Now — let’s eat cake! 🎂';
      }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Send my inquiry'; }
      alert('Sorry — something went wrong sending your inquiry. Please try again, or email thedutchyofmillbrook.contact@gmail.com.');
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send my inquiry'; }
    alert('Sorry — something went wrong sending your inquiry. Please try again, or email thedutchyofmillbrook.contact@gmail.com.');
  }
}

if (form) {
  form.addEventListener('submit', submitOrder);
  syncIntake();
}

// ----- Ranked, drag-to-reorder charm list (charm cake form) -----
const charmList = document.getElementById('charmList');
const charmInput = document.getElementById('charmInput');
const charmAdd = document.getElementById('charmAdd');
let charmDragEl = null;

function addCharm(text) {
  if (!charmList) return;
  const li = document.createElement('li');
  li.className = 'charm-item';
  li.draggable = true;
  li.innerHTML =
    `<span class="charm-handle" aria-hidden="true">⠿</span>` +
    `<span class="charm-text"></span>` +
    `<button type="button" class="charm-del" aria-label="Remove">×</button>`;
  li.querySelector('.charm-text').textContent = text;
  li.querySelector('.charm-del').addEventListener('click', () => li.remove());
  li.addEventListener('dragstart', () => { charmDragEl = li; li.classList.add('dragging'); });
  li.addEventListener('dragend', () => { charmDragEl = null; li.classList.remove('dragging'); });
  charmList.appendChild(li);
}

if (charmList && charmInput && charmAdd) {
  charmList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!charmDragEl) return;
    const after = [...charmList.querySelectorAll('.charm-item:not(.dragging)')].find((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (after) charmList.insertBefore(charmDragEl, after);
    else charmList.appendChild(charmDragEl);
  });

  const submitCharm = () => {
    const v = charmInput.value.trim();
    if (v) { addCharm(v); charmInput.value = ''; charmInput.focus(); }
  };
  charmAdd.addEventListener('click', submitCharm);
  charmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitCharm(); } });
}

// ----- Pre-fill the charm form from a design made in the Charm Cake Studio -----
function applyDesign() {
  let raw;
  try { raw = localStorage.getItem('dutchyDesign'); } catch (e) { return; }
  if (!raw) return;
  let design;
  try { design = JSON.parse(raw); } catch (e) { return; }
  const insc = document.getElementById('inscription');
  if (insc && design.inscription) insc.value = design.inscription;
  if (Array.isArray(design.charms)) design.charms.forEach((c) => addCharm(c));
  try { localStorage.removeItem('dutchyDesign'); } catch (e) {}
}

// Auto-open a cake inquiry from the URL hash, e.g. order.html#charm
if (modal) {
  const want = (location.hash || '').replace('#', '');
  if (want && LABELS[want]) openModal(want);
}

// ----- Portfolio: click a photo to zoom it in a lightbox -----
const pgrid = document.querySelector('.pgrid');
const lightbox = document.getElementById('lightbox');
if (pgrid && lightbox) {
  const lbImg = lightbox.querySelector('img');
  const closeLb = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  };
  pgrid.addEventListener('click', (e) => {
    if (e.target.tagName !== 'IMG') return;
    lbImg.src = e.target.src;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  lightbox.addEventListener('click', closeLb);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLb();
  });
}
