// ===================== ADMIN OPERATIONS PORTAL =====================
function showAdminView(view) {
  const isPlanner = view === 'planner';
  if (!isPlanner && !document.getElementById(`adminView-${view}`)) view = 'overview';
  document.querySelectorAll('.admin-view-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `adminView-${view}`);
  });
  document.getElementById('feederPlannerPanel').classList.toggle('hidden', !isPlanner);
  document.getElementById('stepNav').classList.toggle('hidden', !isPlanner);
  document.querySelectorAll('[data-admin-view]').forEach(button => {
    button.setAttribute('aria-current', button.dataset.adminView === view ? 'page' : 'false');
  });
  if (isPlanner) document.getElementById('feederPlannerPanel').scrollIntoView({ behavior:'smooth', block:'start' });
}

async function refreshAdmin() {
  try {
    const [health, data] = await Promise.all([api('/health'), api('/api/admin/overview')]);
    const status = document.getElementById('backendHealth');
    status.textContent = health.status === 'ok' ? 'System online · database ready' : 'System status unknown';
    status.className = `rounded-full border px-3 py-1 text-xs font-semibold ${health.status==='ok'?'bg-sage/10 border-sage/30 text-sage':'bg-terracotta/10 border-terracotta/30 text-terracotta'}`;
    renderAdmin(data);
  } catch (error) {
    const status = document.getElementById('backendHealth');
    status.textContent = 'System unavailable';
    status.className = 'rounded-full border border-terracotta/30 bg-terracotta/10 px-3 py-1 text-xs font-semibold text-terracotta';
    showToast('Could not load operations desk', error.message);
  }
}

let adminCaseFilter = 'all';
let latestAdminData = null;

function setAdminCaseFilter(category) {
  adminCaseFilter = category;
  if (latestAdminData) renderAdminCases(latestAdminData);
}

function renderAdminCases(data) {
  const complaints = data.complaints || [];
  const filtered = adminCaseFilter === 'all'
    ? complaints
    : complaints.filter(item => item.category === adminCaseFilter);
  document.querySelectorAll('[data-case-filter]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.caseFilter === adminCaseFilter ? 'true' : 'false');
  });
  const casesNode = document.getElementById('adminCases');
  casesNode.innerHTML = filtered.length ? filtered.map(item => {
    const id = Number(item.complaint_id);
    const workers = data.workers || [];
    const workerOptions = workers.map(worker =>
      `<option value="${escapeHtml(worker.username)}" ${item.assigned_worker===worker.username?'selected':''}>${escapeHtml(worker.full_name)}</option>`
    ).join('');
    return `<article class="rounded-xl border border-hairline bg-cardWhite p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div><p class="text-xs font-bold uppercase tracking-wide text-ink/70">Customer report</p><h4 class="text-lg font-extrabold mt-1">Request #${id}</h4></div>
        <span class="h-fit rounded-full border border-hairline bg-stoneBg px-3 py-1 text-xs font-bold">${escapeHtml(item.status)}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        <div class="rounded-lg bg-stoneBg p-3"><span class="block text-xs font-bold uppercase tracking-wide text-ink/70">Problem type</span><b class="block mt-1 text-sm">${escapeHtml(item.category)}</b></div>
        <div class="rounded-lg bg-stoneBg p-3"><span class="block text-xs font-bold uppercase tracking-wide text-ink/70">Customer</span><b class="block mt-1 text-sm">${escapeHtml(item.customer_name)}</b><span class="text-xs text-ink/70">${escapeHtml(item.customer_username)}</span></div>
        <div class="rounded-lg bg-stoneBg p-3"><span class="block text-xs font-bold uppercase tracking-wide text-ink/70">Reported location</span><b class="block mt-1 text-sm">${escapeHtml(item.location)}</b></div>
      </div>
      <div class="mt-3 rounded-lg border border-hairline p-3"><p class="text-xs font-bold uppercase tracking-wide text-ink/70">What the customer reported</p><p class="mt-1 text-sm whitespace-pre-wrap">${escapeHtml(item.description)}</p></div>
      ${item.worker_note?`<div class="mt-2 rounded-lg border border-amberWatch/30 bg-amberWatch/10 p-3 text-sm"><b>Worker report:</b> ${escapeHtml(item.worker_note)}</div>`:''}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <label class="text-xs font-semibold">Assign worker
          <select id="assign-${id}" class="ml-1 rounded border border-hairline px-2 py-1">${workerOptions}</select>
        </label>
        <button onclick="assignCase(${id})" class="rounded bg-action px-3 py-1.5 text-xs text-white">Assign</button>
        <button onclick="updateCaseStatus(${id},'IN_PROGRESS')" class="rounded border border-hairline px-3 py-1.5 text-xs">In progress</button>
        <button onclick="updateCaseStatus(${id},'RESOLVED')" class="rounded border border-hairline px-3 py-1.5 text-xs">Resolve</button>
        <button onclick="flagPenalty(${id})" ${Number(item.penalty_review)?'disabled':''} class="rounded border border-amberWatch/40 px-3 py-1.5 text-xs text-amberWatch disabled:opacity-50">${Number(item.penalty_review)?'Penalty review flagged':'Flag for penalty review'}</button>
      </div>
    </article>`;
  }).join('') : complaints.length
    ? '<p class="rounded-lg border border-hairline bg-stoneBg p-4 text-sm">No reports match this problem type.</p>'
    : '<p class="rounded-lg border border-hairline bg-stoneBg p-4 text-sm">No customer reports in the queue.</p>';
}

function renderAdmin(data) {
  latestAdminData = data;
  document.getElementById('adminOpenCount').textContent = data.metrics.open;
  document.getElementById('adminUnassignedCount').textContent = data.metrics.unassigned;
  document.getElementById('adminWorkerUpdateCount').textContent = data.metrics.worker_updates;
  document.getElementById('adminPenaltyCount').textContent = data.metrics.penalty_reviews;
  document.getElementById('adminIssuesBadge').textContent = String(data.metrics.open);
  const workers = data.workers || [];
  renderAdminCases(data);

  const customersNode = document.getElementById('adminCustomers');
  const customers = data.customers || [];
  customersNode.innerHTML = customers.length ? customers.map(customer => `
    <article class="rounded-xl border border-hairline p-4">
      <div class="flex justify-between gap-2"><div><b>${escapeHtml(customer.full_name)}</b><div class="text-xs text-ink/60">${escapeHtml(customer.username)} · ${escapeHtml(customer.service_area)}</div></div><span class="text-xs">${escapeHtml(customer.account_status)}</span></div>
      <div class="text-xs text-ink/65 mt-2">${escapeHtml(customer.email)} · ${escapeHtml(customer.phone)}</div>
      <div class="flex flex-wrap gap-2 mt-3">
        <button onclick="notifyCustomer('${escapeHtml(customer.username)}','sms')" class="rounded border border-hairline px-2.5 py-1.5 text-xs">Notice by SMS</button>
        <button onclick="notifyCustomer('${escapeHtml(customer.username)}','email')" class="rounded border border-hairline px-2.5 py-1.5 text-xs">Notice by email</button>
        <button onclick="notifyCustomer('${escapeHtml(customer.username)}','call')" class="rounded border border-hairline px-2.5 py-1.5 text-xs">Log a call</button>
        <button onclick="requestCustomerRemoval('${escapeHtml(customer.username)}')" class="rounded bg-terracotta/10 px-2.5 py-1.5 text-xs text-terracotta">Request removal review</button>
      </div>
    </article>`).join('') : '<p class="text-sm text-ink/70">No customer accounts.</p>';
  const workerAccounts = data.worker_accounts || [];
  document.getElementById('adminWorkersBadge').textContent = String(workerAccounts.length);
  renderWorkerAccounts(workerAccounts);
  renderNotifications('adminNotifications', data.notifications || []);
}

function renderWorkerAccounts(workers) {
  const target = document.getElementById('adminWorkerAccounts');
  target.innerHTML = workers.length ? workers.map(worker => {
    const active = worker.account_status === 'active';
    return `<article class="rounded-xl border border-hairline p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <b>${escapeHtml(worker.full_name)}</b>
        <div class="text-sm text-ink/70">ID: <code>${escapeHtml(worker.username)}</code></div>
        <div class="text-xs font-semibold mt-1">${active ? 'Active · can sign in' : 'Inactive · sign-in disabled'}</div>
      </div>
      <button type="button" onclick="setWorkerAccess('${escapeHtml(worker.username)}',${!active})"
        class="rounded-lg border border-hairline px-3 py-2 text-sm font-semibold hover:bg-softStone">${active ? 'Deactivate access' : 'Reactivate access'}</button>
    </article>`;
  }).join('') : '<p class="text-sm text-ink/70">No worker accounts yet.</p>';
}

async function createWorker(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = document.getElementById('workerFormMessage');
  button.disabled = true;
  message.textContent = '';
  try {
    await api('/api/admin/workers', {
      method:'POST',
      body:JSON.stringify({
        full_name:document.getElementById('workerFullName').value.trim(),
        username:document.getElementById('workerUsername').value.trim(),
        password:document.getElementById('workerPassword').value
      })
    });
    form.reset();
    message.className = 'text-sm min-h-5 text-sage';
    message.textContent = 'Worker account created. Give the worker their ID and password directly; the password will not be shown again.';
    await refreshAdmin();
  } catch (error) {
    message.className = 'text-sm min-h-5 text-terracotta';
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function setWorkerAccess(username, active) {
  if (!active && !window.confirm('This disables the worker’s sign-in but keeps their account and history. Reassign or resolve their open requests first. Continue?')) return;
  try {
    await api('/api/admin/workers/status', {
      method:'POST',
      body:JSON.stringify({ username, active })
    });
    showToast(active ? 'Worker access restored' : 'Worker access deactivated',
      active ? 'The worker can sign in again.' : 'Login is disabled; the account and completed work history remain.');
    await refreshAdmin();
  } catch (error) {
    showToast('Could not update worker access', error.message);
  }
}

async function adminAction(payload, successMessage) {
  try {
    await api('/api/admin/complaints/action', { method:'POST', body:JSON.stringify(payload) });
    showToast('Updated', successMessage);
    await refreshAdmin();
  } catch (error) { showToast('Could not update request', error.message); }
}
function assignCase(id) {
  adminAction({ complaint_id:id, action:'assign', worker_username:document.getElementById(`assign-${id}`).value }, 'Worker assignment was recorded.');
}
function updateCaseStatus(id, status) {
  adminAction({ complaint_id:id, action:'status', status }, `Request status changed to ${status}.`);
}
function flagPenalty(id) {
  adminAction({ complaint_id:id, action:'penalty_review' }, 'Flag sent for human review; no charge was made.');
}
async function notifyCustomer(username, channel) {
  try {
    const result = await api('/api/admin/customers/notice', { method:'POST', body:JSON.stringify({ customer_username:username, channel }) });
    showToast('Demo notice recorded', result.message);
    await refreshAdmin();
  } catch (error) { showToast('Could not record notice', error.message); }
}
async function requestCustomerRemoval(username) {
  try {
    await api('/api/admin/customers/request-removal', { method:'POST', body:JSON.stringify({ customer_username:username }) });
    showToast('Removal review requested', 'The account remains active until a human review; no service was disconnected.');
    await refreshAdmin();
  } catch (error) { showToast('Notice required first', error.message); }
}
