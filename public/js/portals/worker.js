// ===================== WORKER FIELD PORTAL =====================
async function refreshWorkerTasks() {
  try {
    const result = await api('/api/worker/tasks');
    renderWorkerTasks(result.tasks || []);
  } catch (error) { showToast('Could not load assigned work', error.message); }
}
function renderWorkerTasks(tasks) {
  const target = document.getElementById('workerTasks');
  if (!tasks.length) {
    target.innerHTML = '<div class="bg-cardWhite rounded-xl border border-hairline p-5 text-sm text-ink/60">No requests are assigned yet. The operations desk will assign work here.</div>';
    return;
  }
  target.innerHTML = tasks.map(item=>`
    <article class="bg-cardWhite rounded-2xl border border-hairline p-5">
      <div class="flex flex-wrap justify-between gap-2"><div><b>Request #${Number(item.complaint_id)} · ${escapeHtml(item.category)}</b><p class="text-sm text-ink/65 mt-1">${escapeHtml(item.customer_name)} · ${escapeHtml(item.location)}</p></div><span class="h-fit rounded-full bg-stoneBg px-3 py-1 text-xs font-bold">${escapeHtml(item.status)}</span></div>
      <p class="mt-3 text-sm">${escapeHtml(item.description)}</p>
      <label class="block text-sm font-semibold mt-4" for="workerNote-${Number(item.complaint_id)}">Visit update or blocker
        <textarea id="workerNote-${Number(item.complaint_id)}" maxlength="1000" rows="3" class="mt-1 w-full rounded-lg border border-hairline px-3 py-2 font-normal" placeholder="Explain what you did or why you cannot proceed">${escapeHtml(item.worker_note)}</textarea>
      </label>
      <div class="flex flex-wrap gap-2 mt-3">
        <button onclick="submitWorkerUpdate(${Number(item.complaint_id)},'IN_PROGRESS')" class="rounded-lg bg-action px-3 py-2 text-xs text-white font-semibold">Working on it</button>
        <button onclick="submitWorkerUpdate(${Number(item.complaint_id)},'BLOCKED')" class="rounded-lg border border-amberWatch/40 px-3 py-2 text-xs text-amberWatch font-semibold">Report a blocker</button>
        <button onclick="submitWorkerUpdate(${Number(item.complaint_id)},'RESOLVED')" class="rounded-lg border border-sage/40 px-3 py-2 text-xs text-sage font-semibold">Mark resolved</button>
      </div>
    </article>`).join('');
}
async function submitWorkerUpdate(id, status) {
  const note = document.getElementById(`workerNote-${id}`).value.trim();
  if (!note) { showToast('Add a short update', 'Explain the work completed or what is blocking the visit.'); return; }
  try {
    await api('/api/worker/tasks/update', { method:'POST', body:JSON.stringify({ complaint_id:id, status, note }) });
    showToast('Update sent', 'The admin and customer were notified in the demo portal.');
    refreshWorkerTasks();
  } catch (error) { showToast('Could not send update', error.message); }
}
