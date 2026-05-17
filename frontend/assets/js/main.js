/**
 * Kollectozam Kollectables — Frontend JS
 * Shared utilities, API client, and UI components
 */

// ── Config ──────────────────────────────────────────────────────────────────

const KZ = {
  apiBase: window.KZ_API_BASE || 'https://kollectozam-api.YOUR_SUBDOMAIN.workers.dev',
  waNumber: window.KZ_WA_NUMBER || '6738123456',
  categoryEmoji: {
    'pokemon': '⚡',
    'naruto-singles': '🍃',
    'naruto-boxes': '📦',
    'onepiece': '☠️',
  },
  categoryLabel: {
    'pokemon': 'Pokémon',
    'naruto-singles': 'Naruto Singles',
    'naruto-boxes': 'Naruto Boxes',
    'onepiece': 'One Piece',
  },
  statusLabel: {
    'available': 'AVAILABLE',
    'payment_pending': 'PAYMENT PENDING',
    'sold': 'SOLD',
    'expired': 'EXPIRED',
    'backup': 'BACK UP FOR CLAIM',
  },
};

// ── API ──────────────────────────────────────────────────────────────────────

const api = {
  async get(path) {
    const res = await fetch(`${KZ.apiBase}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  },

  async post(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${KZ.apiBase}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data, status: res.status });
    return data;
  },

  async put(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${KZ.apiBase}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data });
    return data;
  },

  async delete(path, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${KZ.apiBase}${path}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data });
    return data;
  },
};

// ── Toast ────────────────────────────────────────────────────────────────────

function toast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Product Card Renderer ────────────────────────────────────────────────────

function renderProductCard(product, options = {}) {
  const { showTimer = true, onClaim } = options;
  const emoji = KZ.categoryEmoji[product.category] || '🃏';
  const catLabel = KZ.categoryLabel[product.category] || product.category;

  const isClaimable = product.status === 'available' || product.status === 'backup';
  const isPending = product.status === 'payment_pending';
  const isSold = product.status === 'sold';
  const isBackup = product.status === 'backup';

  const imgHtml = product.image_url
    ? `<img class="card-img" src="${escHtml(product.image_url)}" alt="${escHtml(product.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>${emoji}</div>'">`
    : `<div class="card-img-placeholder">${emoji}</div>`;

  const statusClass = product.status.replace('_', '_');
  const statusLabel = KZ.statusLabel[product.status] || product.status.toUpperCase();

  let timerHtml = '';
  if (isPending && product.reserved_until && showTimer) {
    timerHtml = `<div class="card-timer" data-timer="${escHtml(product.reserved_until)}">
      <span class="timer-icon">⏱</span>
      <span class="timer-val">--:--</span>
    </div>`;
  }

  let btnHtml = '';
  if (isClaimable) {
    btnHtml = `<button class="btn-claim" data-product-id="${product.id}" onclick="openClaimModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
      ⚡ CLAIM NOW
    </button>`;
  } else if (isPending) {
    btnHtml = `<button class="btn-claim" disabled>⏳ RESERVED</button>`;
  } else if (isSold) {
    btnHtml = `<button class="btn-claim" disabled>✅ SOLD</button>`;
  }

  const backupBadge = isBackup
    ? `<div style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--kz-purple-light);text-align:center;margin-bottom:4px;">🔄 BACK UP FOR CLAIM</div>`
    : '';

  const card = document.createElement('div');
  card.className = `product-card status-${product.status}`;
  card.dataset.productId = product.id;
  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgHtml}
      <div class="card-status status-${product.status}">${statusLabel}</div>
    </div>
    <div class="card-body">
      <div class="card-category">${emoji} ${catLabel}</div>
      <div class="card-title">${escHtml(product.title)}</div>
      <div class="card-meta">
        <span class="card-badge">${escHtml(product.condition)}</span>
        ${product.quantity > 1 ? `<span class="card-badge">Qty: ${product.quantity}</span>` : ''}
      </div>
      <div class="card-price">BND ${Number(product.price_bnd).toFixed(2)} <span>/ item</span></div>
      ${timerHtml}
      ${backupBadge}
      ${btnHtml}
    </div>
  `;

  return card;
}

// ── Claim Modal ──────────────────────────────────────────────────────────────

let activeClaimProduct = null;
let claimTimerInterval = null;

function openClaimModal(product) {
  activeClaimProduct = product;

  const overlay = document.getElementById('claim-modal');
  if (!overlay) return;

  const emoji = KZ.categoryEmoji[product.category] || '🃏';
  const imgHtml = product.image_url
    ? `<img class="modal-product-img" src="${escHtml(product.image_url)}" onerror="this.outerHTML='<div class=modal-product-img style=display:flex;align-items:center;justify-content:center;font-size:28px>${emoji}</div>'">`
    : `<div class="modal-product-img" style="display:flex;align-items:center;justify-content:center;font-size:28px;">${emoji}</div>`;

  document.getElementById('modal-product-info').innerHTML = `
    ${imgHtml}
    <div class="modal-product-info">
      <div class="modal-product-title">${escHtml(product.title)}</div>
      <div class="modal-product-price">BND ${Number(product.price_bnd).toFixed(2)}</div>
    </div>
  `;

  document.getElementById('claim-form-wrap').classList.remove('hidden');
  document.getElementById('claim-success-wrap').classList.add('hidden');
  document.getElementById('claim-form').reset();

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeClaimModal() {
  const overlay = document.getElementById('claim-modal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (claimTimerInterval) { clearInterval(claimTimerInterval); claimTimerInterval = null; }
  activeClaimProduct = null;
}

async function submitClaimForm(e) {
  e.preventDefault();
  if (!activeClaimProduct) return;

  const btn = document.getElementById('claim-submit-btn');
  const name = document.getElementById('claim-name').value.trim();
  const wa = document.getElementById('claim-wa').value.trim();
  const pickup = document.getElementById('claim-pickup').value;
  const payment = document.getElementById('claim-payment').value;

  if (!name || !wa) { toast('Please fill in all fields', 'error'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ RESERVING...';

  try {
    const result = await api.post('/claim', {
      product_id: activeClaimProduct.id,
      buyer_name: name,
      buyer_whatsapp: wa,
      pickup_option: pickup,
      payment_method: payment,
    });

    // Show success state
    document.getElementById('claim-form-wrap').classList.add('hidden');
    const successWrap = document.getElementById('claim-success-wrap');
    successWrap.classList.remove('hidden');

    // Start countdown
    startSuccessCountdown(result.reserved_until, result.timer_minutes);

    // Auto-open WhatsApp after short delay
    setTimeout(() => {
      if (result.whatsapp_url) window.open(result.whatsapp_url, '_blank');
    }, 1500);

    // Refresh product cards on the page
    setTimeout(() => refreshProductCards(), 2000);

  } catch (err) {
    btn.disabled = false;
    btn.textContent = '⚡ CLAIM NOW';
    if (err.status === 409) {
      toast('😅 Sorry! This item was just claimed by someone else.', 'error', 4000);
      closeClaimModal();
      setTimeout(() => refreshProductCards(), 500);
    } else {
      toast(err.message || 'Something went wrong. Please try again.', 'error');
    }
  }
}

function startSuccessCountdown(reservedUntil, timerMins) {
  const until = new Date(reservedUntil).getTime();
  const display = document.getElementById('success-timer');
  const waBtn = document.getElementById('open-wa-btn');

  function update() {
    const now = Date.now();
    const diff = until - now;
    if (diff <= 0) {
      if (display) display.textContent = '00:00';
      clearInterval(claimTimerInterval);
      claimTimerInterval = null;
      toast('⚠️ Timer expired. Item may have been relisted.', 'error', 5000);
      closeClaimModal();
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (display) display.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  update();
  claimTimerInterval = setInterval(update, 1000);
}

// ── Live Timers ──────────────────────────────────────────────────────────────

function startLiveTimers() {
  setInterval(() => {
    document.querySelectorAll('[data-timer]').forEach(el => {
      const until = new Date(el.dataset.timer).getTime();
      const diff = until - Date.now();
      const valEl = el.querySelector('.timer-val');
      if (!valEl) return;
      if (diff <= 0) {
        valEl.textContent = 'EXPIRED';
        el.style.color = 'var(--kz-red)';
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        valEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      }
    });
  }, 1000);
}

// ── Scroll Fade Animations ───────────────────────────────────────────────────

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ── Nav Drawer ───────────────────────────────────────────────────────────────

function initNav() {
  const btn = document.getElementById('nav-menu-btn');
  const drawer = document.getElementById('nav-drawer');
  if (!btn || !drawer) return;

  btn.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Close on backdrop or nav item click
  drawer.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ── Refresh product cards helper ─────────────────────────────────────────────

async function refreshProductCards() {
  // Each page implements this to reload its product grid
  if (typeof window.loadProducts === 'function') window.loadProducts();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('en-BN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getCategoryColor(cat) {
  const map = {
    'pokemon': '#ffcb05',
    'naruto-singles': '#ff6b35',
    'naruto-boxes': '#e84393',
    'onepiece': '#cc0000',
  };
  return map[cat] || 'var(--kz-purple-light)';
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initScrollAnimations();
  startLiveTimers();

  // Claim modal form
  const claimForm = document.getElementById('claim-form');
  if (claimForm) claimForm.addEventListener('submit', submitClaimForm);

  // Modal close on overlay click
  const modal = document.getElementById('claim-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeClaimModal();
    });
  }
});

// Expose globally
window.KZ = KZ;
window.api = api;
window.toast = toast;
window.renderProductCard = renderProductCard;
window.openClaimModal = openClaimModal;
window.closeClaimModal = closeClaimModal;
window.escHtml = escHtml;
window.formatDate = formatDate;
