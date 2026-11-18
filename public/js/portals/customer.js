// ===================== CUSTOMER SERVICE PORTAL =====================
async function refreshCustomer() {
  try {
    const data = await api('/api/customer/overview');
    renderCustomer(data);
  } catch (error) { showToast('Could not load customer account', error.message); }
}
function renderCustomer(data) {
  document.getElementById('customerName').textContent = data.user.full_name;
  document.getElementById('customerId').textContent = data.user.username;
  document.getElementById('customerArea').textContent = data.user.service_area;
  const usage = data.usage || [];
  const latest = usage[usage.length-1];
  const previous = usage[usage.length-2];
  const average = usage.length ? Math.round(usage.reduce((sum, item)=>sum+Number(item.kwh),0)/usage.length) : 0;
  document.getElementById('customerUsage').innerHTML = `
    <div class="rounded-xl bg-stoneBg p-4"><div class="text-xs text-ink/60">This month · ${escapeHtml(latest?.month || '—')}</div><b class="text-2xl">${latest?Number(latest.kwh):0} kWh</b></div>
    <div class="rounded-xl bg-stoneBg p-4"><div class="text-xs text-ink/60">Previous month</div><b class="text-2xl">${previous?Number(previous.kwh):0} kWh</b></div>
    <div class="rounded-xl bg-stoneBg p-4"><div class="text-xs text-ink/60">6-month monthly average</div><b class="text-2xl">${average} kWh</b></div>
    <div class="sm:col-span-3 rounded-xl border border-hairline p-4">
      <div class="flex items-end gap-2 h-24">${usage.map(item=>`<div class="flex-1 h-full flex flex-col justify-end items-center gap-1"><div class="w-full max-w-12 rounded-t bg-sage" style="height:${Math.max(4,Number(item.kwh)/3.2)}%"></div><span class="text-[10px] text-ink/60">${escapeHtml(String(item.month).slice(5))}</span></div>`).join('')}</div>
      <p class="text-[11px] text-ink/70 mt-2">Sample monthly energy use in kWh. Readings are not fetched from a real meter.</p>
    </div>`;
  document.getElementById('customerComplaints').innerHTML = data.complaints.length ? data.complaints.map(item=>`
    <article class="rounded-lg border border-hairline p-3">
      <div class="flex justify-between gap-2"><b class="text-sm">#${Number(item.complaint_id)} · ${escapeHtml(item.category)}</b><span class="text-[11px] font-bold">${escapeHtml(item.status)}</span></div>
      <p class="text-xs text-ink/70 mt-1">${escapeHtml(item.description)}</p>
      <p class="text-[11px] text-ink/70 mt-1">${escapeHtml(item.location)} · ${escapeHtml(item.worker_name || 'Waiting for assignment')}</p>
      ${item.worker_note?`<p class="mt-2 rounded bg-stoneBg p-2 text-xs"><b>Latest worker update:</b> ${escapeHtml(item.worker_note)}</p>`:''}
    </article>`).join('') : '<p class="text-sm text-ink/70">No requests yet.</p>';
  renderNotifications('customerNotifications', data.notifications || []);
}

function addChatMessage(message, from = 'bot') {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble rounded-xl p-3 text-sm ${from==='user'?'ml-auto bg-action text-white':'bg-stoneBg text-ink'}`;
  bubble.textContent = message;
  document.getElementById('chatMessages').appendChild(bubble);
  bubble.scrollIntoView({ block:'nearest' });
}
async function confirmCustomerLocation(event) {
  event.preventDefault();
  const locationValue = document.getElementById('locationInput').value.trim();
  if (!locationValue) return;
  addChatMessage(locationValue, 'user');
  document.getElementById('locationInput').value = '';
  document.getElementById('locationStatus').textContent = 'Checking the registered service area…';
  try {
    const result = await api('/api/location/confirm', { method:'POST', body:JSON.stringify({ location:locationValue }) });
    confirmedLocation = result.confirmed;
    document.getElementById('complaintFields').disabled = !confirmedLocation;
    document.getElementById('locationStatus').textContent = confirmedLocation
      ? `Confirmed area: ${result.registered_area}. You can now submit a problem.`
      : 'Location not confirmed. No complaint was opened.';
    addChatMessage(result.message);
  } catch (error) {
    confirmedLocation = false;
    document.getElementById('complaintFields').disabled = true;
    document.getElementById('locationStatus').textContent = error.message;
    addChatMessage(error.message);
  }
}
async function submitCustomerComplaint(event) {
  event.preventDefault();
  if (!confirmedLocation) return;
  const description = document.getElementById('complaintDescription').value.trim();
  const category = document.querySelector('input[name="complaintCategory"]:checked')?.value;
  if (!category) {
    addChatMessage('Choose the problem type before submitting.');
    return;
  }
  try {
    const result = await api('/api/customer/complaints', {
      method:'POST',
      body:JSON.stringify({
        category,
        description
      })
    });
    addChatMessage(`Request #${result.complaint_id} is in the admin queue. You will see updates here.`, 'bot');
    document.getElementById('complaintForm').reset();
    confirmedLocation = false;
    document.getElementById('complaintFields').disabled = true;
    document.getElementById('locationStatus').textContent = 'Confirm your location again before submitting another request.';
    refreshCustomer();
  } catch (error) { addChatMessage(error.message); }
}
